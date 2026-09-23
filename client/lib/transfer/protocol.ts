/**
 * SPC_2026 Wire Protocol Constants and Message Helpers
 * Mirrors the server-side transfer protocol
 */

// Flow control
export const HIGH_WATER = 8 * 1024 * 1024;  // 8 MB - pause sending at/above
export const LOW_WATER = 4 * 1024 * 1024;   // 4 MB - resume sending below
export const READ_SLAB = 4 * 1024 * 1024;    // 4 MB - disk read slab size
export const DEFAULT_CHUNK = 64 * 1024;       // 64 KB - fallback chunk size
export const MAX_CHUNK = 256 * 1024;          // 256 KB - cap on adaptive chunk

// Protocol version
export const PROTOCOL_VERSION = 1;
export const MIN_PROTOCOL_VERSION = 1;

// Ack timeout (2 minutes for receiver to respond)
export const ACK_TIMEOUT_MS = 120_000;

// Max control message size
export const CONTROL_MSG_MAX = 1000;

// --- Message Types ---

export interface Metadata {
    type: 'metadata';
    id: string;
    fileName: string;
    fileSize: number;
    index: number;
    total: number;
    totalBytes: number;
    pv?: number;
    pvMin?: number;
    ver?: string;
}

export interface Ack {
    type: 'ack';
    id: string;
    offset: number;
    pv?: number;
    pvMin?: number;
    ver?: string;
}

export interface End {
    type: 'end';
}

export interface Incompatible {
    type: 'incompatible';
    reason: string;
    pv?: number;
    pvMin?: number;
    ver?: string;
}

export type ControlMessage = Metadata | Ack | End | Incompatible;

// --- Message Builders ---

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function metadataMessage(
    id: string,
    fileName: string,
    fileSize: number,
    index: number,
    total: number,
    totalBytes: number,
    ver?: string
): string {
    return JSON.stringify({
        type: 'metadata',
        id,
        fileName,
        fileSize,
        index,
        total,
        totalBytes,
        pv: PROTOCOL_VERSION,
        pvMin: MIN_PROTOCOL_VERSION,
        ver,
    } satisfies Metadata);
}

export function ackMessage(id: string, offset: number, ver?: string): string {
    return JSON.stringify({
        type: 'ack',
        id,
        offset,
        pv: PROTOCOL_VERSION,
        pvMin: MIN_PROTOCOL_VERSION,
        ver,
    } satisfies Ack);
}

export function endMessage(): string {
    return JSON.stringify({ type: 'end' } satisfies End);
}

export function incompatibleMessage(reason: string): string {
    return JSON.stringify({
        type: 'incompatible',
        reason,
        pv: PROTOCOL_VERSION,
        pvMin: MIN_PROTOCOL_VERSION,
    } satisfies Incompatible);
}

// --- Protocol Compatibility ---

export function checkCompat(
    localMin: number,
    localMax: number,
    remoteMin: number,
    remoteMax: number
): { ok: boolean; localTooOld: boolean } {
    if (!remoteMin) remoteMin = 1;
    if (!remoteMax) remoteMax = 1;
    const lo = Math.max(localMin, remoteMin);
    const hi = Math.min(localMax, remoteMax);
    if (lo <= hi) return { ok: true, localTooOld: false };
    return { ok: false, localTooOld: remoteMin > localMax };
}

export function compatErrorMessage(
    localTooOld: boolean,
    localVer: string,
    remoteVer: string,
    localMin: number,
    localMax: number,
    remoteMin: number,
    remoteMax: number
): string {
    const localStr = `protocol ${localMin}-${localMax}${localVer ? ` (${localVer})` : ''}`;
    const remoteStr = `protocol ${remoteMin}-${remoteMax}${remoteVer ? ` (${remoteVer})` : ''}`;
    if (localTooOld) {
        return `Cannot transfer: your browser is running an older version.\nYou: ${localStr}  Peer: ${remoteStr}\nRefresh the page to get the latest version.`;
    }
    return `Cannot transfer: peer's version is too old.\nYou: ${localStr}  Peer: ${remoteStr}\nAsk the other side to update.`;
}

// --- Control Message Classifier ---

export function isControlFrame(data: string | ArrayBuffer | Uint8Array): data is string {
    return typeof data === 'string';
}

export function classifyControl(data: string | ArrayBuffer | Uint8Array): ControlMessage | null {
    let text: string;

    if (typeof data === 'string') {
        if (encoder.encode(data).byteLength > CONTROL_MSG_MAX) return null;
        text = data;
    } else {
        const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
        if (buf.byteLength > CONTROL_MSG_MAX) return null;
        try {
            text = decoder.decode(buf);
        } catch {
            return null;
        }
    }

    if (!text.startsWith('{')) return null;

    let msg: Record<string, unknown>;
    try {
        msg = JSON.parse(text) as Record<string, unknown>;
    } catch {
        return null;
    }

    const t = msg['type'];
    if (t === 'metadata') return msg as unknown as Metadata;
    if (t === 'ack') return msg as unknown as Ack;
    if (t === 'end') return msg as unknown as End;
    if (t === 'incompatible') return msg as unknown as Incompatible;
    return null;
}

export function isAbortReason(msg: Incompatible): boolean {
    const { ok } = checkCompat(MIN_PROTOCOL_VERSION, PROTOCOL_VERSION, msg.pvMin ?? 1, msg.pv ?? 1);
    return ok;
}

export function compatErrorFromIncompatible(msg: Incompatible): string {
    if (!isAbortReason(msg)) {
        const { localTooOld } = checkCompat(
            MIN_PROTOCOL_VERSION, PROTOCOL_VERSION, msg.pvMin ?? 0, msg.pv ?? 0
        );
        return compatErrorMessage(
            localTooOld, '', msg.ver ?? '',
            MIN_PROTOCOL_VERSION, PROTOCOL_VERSION,
            msg.pvMin || 1, msg.pv || 1
        );
    }
    return msg.reason || 'The other side rejected the transfer.';
}

// --- File Size Validation ---

export function normalizeFileSize(value: unknown): number | null {
    if (typeof value !== 'number') return null;
    if (!Number.isInteger(value)) return null;
    if (value < 0 || value > Number.MAX_SAFE_INTEGER) return null;
    return value;
}

// --- Chunk Size ---

export function chunkSize(sctpMax?: number | null): number {
    if (sctpMax && Number.isFinite(sctpMax) && sctpMax > 0) {
        return Math.min(MAX_CHUNK, sctpMax);
    }
    return DEFAULT_CHUNK;
}
