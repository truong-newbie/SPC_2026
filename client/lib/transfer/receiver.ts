/**
 * SPC_2026 Receiver Engine
 * Framework-agnostic, no React or simple-peer imports
 */

import {
    classifyControl,
    isControlFrame,
    isAbortReason,
    CONTROL_MSG_MAX,
    ackMessage,
    incompatibleMessage,
    checkCompat,
    compatErrorMessage,
    peerCompatErrorMessage,
    PROTOCOL_VERSION,
    MIN_PROTOCOL_VERSION,
    normalizeFileSize,
    sanitizeDisplayText,
    type Metadata,
    type Incompatible,
} from './protocol';

export interface ReceivedFile {
    id: string;
    fileName: string;
    fileSize: number;
    blob: Blob;
}

export interface ReceiverCallbacks {
    send: (data: string | Uint8Array) => void;
    onFileStart?: (index: number, total: number, fileName: string, fileSize: number) => void;
    onProgress?: (percent: number, received: number, fileSize: number) => void;
    onSpeed?: (bytesPerSec: number, etaSeconds: number) => void;
    onSpeedReset?: () => void;
    onFileComplete?: (file: ReceivedFile, index: number, total: number) => void;
    onAllComplete?: (totalBytes: number, fileCount: number) => void;
    onWaiting?: () => void;
    onError?: (msg: string) => void;
}

const PROGRESS_STEP = 1024 * 1024; // 1 MB

interface PartialDownload {
    chunks: ArrayBuffer[];
    received: number;
    lastReported: number;
}

export function createReceiver(cb: ReceiverCallbacks): { handleMessage: (data: string | Uint8Array | ArrayBuffer) => void } {
    const partialDownloads = new Map<string, PartialDownload>();
    let currentMetadata: Metadata | null = null;
    let hasCheckedCompat = false;
    let aborted = false;
    let expectedSize: number | null = null;
    let sessionBytes = 0;

    let receiveSpeedStart = performance.now();
    let receiveSpeedBytes = 0;
    let lastReceiveSpeedUpdate = 0;

    function handleMessage(data: string | Uint8Array | ArrayBuffer): void {
        if (aborted) return;

        // Framing determines type, not content
        if (isControlFrame(data)) {
            const text = data;

            if (new TextEncoder().encode(text).byteLength > CONTROL_MSG_MAX) {
                aborted = true;
                partialDownloads.clear();
                currentMetadata = null;
                expectedSize = null;
                cb.onError?.(
                    'The sender sent a control message larger than ' +
                        `${CONTROL_MSG_MAX} bytes, so the transfer was stopped.`
                );
                return;
            }

            const msg = classifyControl(text);
            if (!msg) return;

            if (msg.type === 'metadata') {
                // Protocol compatibility check on first file
                if (!hasCheckedCompat) {
                    hasCheckedCompat = true;
                    const remotePv = msg.pv ?? 0;
                    const remotePvMin = msg.pvMin ?? 0;
                    const { ok, localTooOld } = checkCompat(
                        MIN_PROTOCOL_VERSION, PROTOCOL_VERSION,
                        remotePvMin, remotePv
                    );
                    if (!ok) {
                        aborted = true;
                        const errMsg = compatErrorMessage(
                            localTooOld, '', msg.ver ?? '',
                            MIN_PROTOCOL_VERSION, PROTOCOL_VERSION,
                            remotePvMin || 1, remotePv || 1
                        );
                        const peerMsg = peerCompatErrorMessage(
                            localTooOld, '', msg.ver ?? '',
                            MIN_PROTOCOL_VERSION, PROTOCOL_VERSION,
                            remotePvMin || 1, remotePv || 1
                        );
                        const enc = new TextEncoder().encode(incompatibleMessage(peerMsg));
                        cb.send(new Uint8Array(enc));
                        cb.onError?.(errMsg);
                        return;
                    }
                }

                currentMetadata = msg;
                expectedSize = normalizeFileSize(msg.fileSize);
                receiveSpeedStart = performance.now();
                receiveSpeedBytes = 0;
                lastReceiveSpeedUpdate = 0;
                cb.onSpeedReset?.();
                cb.onFileStart?.(msg.index, msg.total, msg.fileName, expectedSize ?? 0);

                let offset = 0;
                const existing = partialDownloads.get(msg.id);
                if (existing) {
                    offset = existing.received;
                } else {
                    partialDownloads.set(msg.id, { chunks: [], received: 0, lastReported: 0 });
                }

                cb.send(ackMessage(msg.id, offset));
            } else if (msg.type === 'incompatible') {
                aborted = true;
                partialDownloads.clear();
                currentMetadata = null;
                expectedSize = null;
                const incompat = msg as Incompatible;
                const reason = sanitizeDisplayText(incompat.reason ?? '', 300);
                cb.onError?.(
                    isAbortReason(incompat) && reason
                        ? reason
                        : 'The sender stopped the transfer.'
                );
                return;
            } else if (msg.type === 'end') {
                if (!currentMetadata) return;
                const fileData = partialDownloads.get(currentMetadata.id);
                if (!fileData) return;

                // Integrity check
                if (expectedSize !== null && fileData.received !== expectedSize) {
                    const name = sanitizeDisplayText(currentMetadata.fileName);
                    const got = fileData.received;
                    const want = expectedSize;
                    const detail = `Incomplete file "${name}": received ${got} of ${want} bytes`;
                    partialDownloads.delete(currentMetadata.id);
                    currentMetadata = null;
                    expectedSize = null;
                    aborted = true;
                    cb.onProgress?.(0, 0, 0);
                    cb.onSpeedReset?.();
                    try {
                        const enc = new TextEncoder().encode(
                            incompatibleMessage(`receiver discarded a file: ${detail}`)
                        );
                        cb.send(new Uint8Array(enc));
                    } catch { }
                    cb.onError?.(
                        `${detail}. ` +
                        (got < want
                            ? 'The transfer was cut short, so the file was discarded.'
                            : 'More data arrived than the sender announced, so the file was discarded.') +
                        ' Ask the sender to try again.'
                    );
                    return;
                }

                const blob = new Blob(fileData.chunks);
                const completed: ReceivedFile = {
                    id: currentMetadata.id,
                    fileName: currentMetadata.fileName,
                    fileSize: fileData.received,
                    blob,
                };

                partialDownloads.delete(currentMetadata.id);
                cb.onFileComplete?.(completed, currentMetadata.index, currentMetadata.total);

                sessionBytes += fileData.received;
                if (currentMetadata.index === currentMetadata.total) {
                    cb.onAllComplete?.(sessionBytes, currentMetadata.total);
                    sessionBytes = 0;
                }

                currentMetadata = null;
                expectedSize = null;
                cb.onWaiting?.();
                cb.onProgress?.(0, 0, 0);
                cb.onSpeedReset?.();
            }
            return;
        }

        // Binary frame: file data
        const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
        if (!currentMetadata) return;
        const fileData = partialDownloads.get(currentMetadata.id);
        if (!fileData) return;

        fileData.chunks.push(new Uint8Array(buf).buffer);
        fileData.received += buf.byteLength;
        receiveSpeedBytes += buf.byteLength;

        const now = performance.now();
        if (now - lastReceiveSpeedUpdate > 1000) {
            const elapsed = (now - receiveSpeedStart) / 1000;
            if (elapsed > 0 && expectedSize) {
                const bytesPerSec = receiveSpeedBytes / elapsed;
                const remaining = expectedSize - fileData.received;
                cb.onSpeed?.(bytesPerSec, remaining / bytesPerSec);
            }
            receiveSpeedStart = now;
            receiveSpeedBytes = 0;
            lastReceiveSpeedUpdate = now;
        }

        if (
            expectedSize &&
            (fileData.received - fileData.lastReported >= PROGRESS_STEP ||
                fileData.received === expectedSize)
        ) {
            fileData.lastReported = fileData.received;
            cb.onProgress?.(
                Math.round((fileData.received / expectedSize) * 100),
                fileData.received,
                expectedSize
            );
        }
    }

    return { handleMessage };
}
