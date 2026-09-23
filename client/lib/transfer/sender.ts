/**
 * SPC_2026 Sender Engine
 * Framework-agnostic, no React or simple-peer imports
 */

import {
    HIGH_WATER,
    LOW_WATER,
    READ_SLAB,
    chunkSize,
    classifyControl,
    metadataMessage,
    endMessage,
    checkCompat,
    compatErrorMessage,
    compatErrorFromIncompatible,
    PROTOCOL_VERSION,
    MIN_PROTOCOL_VERSION,
    ACK_TIMEOUT_MS,
    type Ack,
    type Incompatible,
} from './protocol';

export interface SenderCallbacks {
    onFileStart?: (index: number, total: number, fileName: string) => void;
    onProgress?: (percent: number) => void;
    onSpeed?: (bytesPerSec: number, etaSeconds: number) => void;
    onSpeedReset?: () => void;
    onError?: (msg: string) => void;
    onAllSent?: () => void;
    isDestroyed?: () => boolean;
}

export interface FileEntry {
    id: string;
    file: File;
}

export interface BufferChannel {
    readonly bufferedAmount: number;
    bufferedAmountLowThreshold: number;
    addEventListener(type: 'bufferedamountlow', handler: () => void): void;
    removeEventListener(type: 'bufferedamountlow', handler: () => void): void;
}

export interface SenderDeps {
    send: (data: string | Uint8Array) => void;
    onData: (handler: (data: string | Uint8Array | ArrayBuffer) => void) => () => void;
    channel: BufferChannel;
    sctpMaxMessageSize?: number | null;
}

const PROGRESS_TICK_MS = 500;
const METADATA_DRAIN_THRESHOLD = 64 * 1024;

interface ProgressView {
    active: boolean;
    size: number;
    offset: number;
    lastSpeedTime: number;
    lastSpeedDelivered: number;
}

export async function sendFiles(
    deps: SenderDeps,
    files: FileEntry[],
    cb: SenderCallbacks = {}
): Promise<void> {
    const destroyed = cb.isDestroyed ?? (() => false);
    const totalBytes = files.reduce((s, e) => s + e.file.size, 0);

    const view: ProgressView = {
        active: false,
        size: 0,
        offset: 0,
        lastSpeedTime: performance.now(),
        lastSpeedDelivered: 0,
    };

    const emitView = () => {
        if (!view.active || destroyed()) return;
        const delivered = Math.min(
            view.size,
            Math.max(0, view.offset - deps.channel.bufferedAmount)
        );
        cb.onProgress?.(
            view.size > 0 ? Math.round((delivered / view.size) * 100) : 100
        );
        const now = performance.now();
        const dt = (now - view.lastSpeedTime) / 1000;
        if (dt >= 1 && delivered > view.lastSpeedDelivered) {
            const bytesPerSec = (delivered - view.lastSpeedDelivered) / dt;
            cb.onSpeed?.(bytesPerSec, (view.size - delivered) / bytesPerSec);
            view.lastSpeedTime = now;
            view.lastSpeedDelivered = delivered;
        }
    };

    const ticker = setInterval(emitView, PROGRESS_TICK_MS);

    try {
        for (let i = 0; i < files.length; i++) {
            if (destroyed()) return;
            const entry = files[i];
            const ok = await sendSingleFile(
                deps, entry, i + 1, files.length, totalBytes, cb, view, emitView
            );
            if (!ok) return;
        }

        if (destroyed()) return;

        await drainBelow(deps.channel, 0, destroyed);
        if (destroyed()) return;

        emitView();
        cb.onSpeedReset?.();
        cb.onAllSent?.();
    } finally {
        clearInterval(ticker);
    }
}

export const CONTROL_FLUSH_MS = 2000;

export async function sendAbortReason(
    send: (data: string | Uint8Array) => void,
    channel: BufferChannel | undefined,
    reason: string
): Promise<void> {
    try {
        send(incompatibleMessage(reason));
    } catch {
        return;
    }
    if (!channel) return;

    let over = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    await Promise.race([
        drainBelow(channel, 0, () => over),
        new Promise<void>((resolve) => {
            timer = setTimeout(() => {
                over = true;
                resolve();
            }, CONTROL_FLUSH_MS);
        }),
    ]);
    over = true;
    if (timer) clearTimeout(timer);
}

function drainBelow(
    channel: BufferChannel,
    threshold: number,
    destroyed: () => boolean
): Promise<void> {
    if (channel.bufferedAmount <= threshold || destroyed()) {
        return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
        const prevThreshold = channel.bufferedAmountLowThreshold;
        channel.bufferedAmountLowThreshold = threshold;
        let poll: ReturnType<typeof setInterval> | null = null;
        const finish = () => {
            channel.removeEventListener('bufferedamountlow', onLow);
            if (poll) clearInterval(poll);
            channel.bufferedAmountLowThreshold = prevThreshold;
            resolve();
        };
        const onLow = () => {
            if (channel.bufferedAmount <= threshold) finish();
        };
        channel.addEventListener('bufferedamountlow', onLow);
        poll = setInterval(() => {
            if (destroyed() || channel.bufferedAmount <= threshold) finish();
        }, 200);
    });
}

type AckResult =
    | { type: 'ack'; offset: number; pv?: number; pvMin?: number; ver?: string }
    | { type: 'incompatible'; reason: string; pv?: number; pvMin?: number; ver?: string }
    | { type: 'timeout' };

async function sendSingleFile(
    deps: SenderDeps,
    entry: FileEntry,
    index: number,
    total: number,
    totalBytes: number,
    cb: SenderCallbacks,
    view: ProgressView,
    emitView: () => void
): Promise<boolean> {
    const { file, id } = entry;
    const { send, onData, channel } = deps;
    const destroyed = cb.isDestroyed ?? (() => false);

    if (destroyed()) return true;

    const CHUNK_SIZE = chunkSize(deps.sctpMaxMessageSize);

    await drainBelow(channel, METADATA_DRAIN_THRESHOLD, destroyed);
    if (destroyed()) return true;

    channel.bufferedAmountLowThreshold = LOW_WATER;

    try {
        send(metadataMessage(id, file.name, file.size, index, total, totalBytes));
    } catch {
        return false;
    }

    const ackResult = await waitForAck(onData, id);
    if (ackResult.type === 'timeout') {
        cb.onError?.('Transfer timed out waiting for receiver. Please try again.');
        return false;
    }
    if (ackResult.type === 'incompatible') {
        cb.onError?.(compatErrorFromIncompatible(ackResult));
        return false;
    }

    if (index === 1 && (ackResult.pv !== undefined || ackResult.pvMin !== undefined)) {
        const { ok, localTooOld } = checkCompat(
            MIN_PROTOCOL_VERSION, PROTOCOL_VERSION,
            ackResult.pvMin ?? 0, ackResult.pv ?? 0
        );
        if (!ok) {
            cb.onError?.(compatErrorMessage(
                localTooOld, '', ackResult.ver ?? '',
                MIN_PROTOCOL_VERSION, PROTOCOL_VERSION,
                ackResult.pvMin ?? 1, ackResult.pv ?? 1
            ));
            return false;
        }
    }

    const resumeAt: unknown = ackResult.offset;
    if (typeof resumeAt !== 'number' || !Number.isInteger(resumeAt) || resumeAt < 0 || resumeAt > file.size) {
        cb.onError?.(
            `The receiver asked to resume "${file.name}" from byte ${String(resumeAt)} of ${file.size}, ` +
            `which is not possible. Please try again.`
        );
        return false;
    }

    cb.onFileStart?.(index - 1, total, file.name);
    view.active = true;
    view.size = file.size;
    view.offset = ackResult.offset;
    view.lastSpeedTime = performance.now();
    view.lastSpeedDelivered = ackResult.offset;
    emitView();

    let offset = ackResult.offset;

    const waitForBuffer = () =>
        new Promise<void>((r) => {
            let poll: ReturnType<typeof setInterval> | null = null;
            const finish = () => {
                channel.removeEventListener('bufferedamountlow', onLow);
                if (poll) clearInterval(poll);
                r();
            };
            const onLow = () => finish();
            if (channel.bufferedAmount < LOW_WATER || destroyed()) {
                r();
            } else {
                channel.addEventListener('bufferedamountlow', onLow);
                poll = setInterval(() => {
                    if (destroyed() || channel.bufferedAmount < LOW_WATER) finish();
                }, 200);
            }
        });

    while (offset < file.size) {
        if (destroyed()) break;

        const slabEnd = Math.min(offset + READ_SLAB, file.size);
        let slabBuffer: ArrayBuffer;
        try {
            slabBuffer = await file.slice(offset, slabEnd).arrayBuffer();
        } catch {
            cb.onError?.(
                `Could not read "${file.name}". It may have been moved, renamed, ` +
                `or on a drive or folder that is no longer available. Nothing further was sent.`
            );
            return false;
        }

        let slabOffset = 0;
        while (slabOffset < slabBuffer.byteLength) {
            if (destroyed()) break;

            if (channel.bufferedAmount >= HIGH_WATER) {
                await waitForBuffer();
            }

            if (destroyed()) break;

            const chunkLen = Math.min(CHUNK_SIZE, slabBuffer.byteLength - slabOffset);
            const chunk = new Uint8Array(slabBuffer, slabOffset, chunkLen);

            try {
                send(chunk);
            } catch {
                await new Promise((r) => setTimeout(r, 100));
                continue;
            }

            slabOffset += chunkLen;
            offset += chunkLen;
            view.offset = offset;
        }
    }

    try {
        send(endMessage());
    } catch { }

    return true;
}

function waitForAck(
    onData: (handler: (data: string | Uint8Array | ArrayBuffer) => void) => () => void,
    fileId: string
): Promise<AckResult> {
    let off: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const done = (r: AckResult): AckResult => {
        off?.();
        off = null;
        if (timer) clearTimeout(timer);
        timer = null;
        return r;
    };
    return Promise.race([
        new Promise<AckResult>((resolve) => {
            off = onData((raw) => {
                const msg = classifyControl(raw);
                if (!msg) return;
                if (msg.type === 'ack' && (msg as Ack).id === fileId) {
                    const ack = msg as Ack;
                    resolve({ type: 'ack', offset: ack.offset, pv: ack.pv, pvMin: ack.pvMin, ver: ack.ver });
                } else if (msg.type === 'incompatible') {
                    const incompat = msg as Incompatible;
                    resolve({
                        type: 'incompatible',
                        reason: incompat.reason,
                        pv: incompat.pv,
                        pvMin: incompat.pvMin,
                        ver: incompat.ver,
                    });
                }
            });
        }),
        new Promise<AckResult>((resolve) => {
            timer = setTimeout(() => resolve({ type: 'timeout' }), ACK_TIMEOUT_MS);
        }),
    ]).then(done);
}
