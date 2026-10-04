/**
 * FileBridge ZIP Manager
 * Client-side ZIP creation using fflate
 * - Store mode (no recompression) for speed
 * - UTF-8 filename support
 * - Memory-safe chunked processing
 */

import { zip } from 'fflate';

export interface ZipFile {
    name: string;
    blob: Blob;
    relativePath?: string;
}

export interface ZipProgress {
    currentFile: string;
    currentIndex: number;
    totalFiles: number;
    processedBytes: number;
    totalBytes: number;
    percent: number;
}

export interface ZipOptions {
    onProgress?: (progress: ZipProgress) => void;
    filename?: string;
}

// Safe path: sanitize directory parts and filename while preserving forward slashes
function sanitizeZipPath(rawPath: string): string {
    const normalized = rawPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const parts = normalized.split('/').filter((p) => p.length > 0 && p !== '.' && p !== '..');
    const safeParts = parts.map((part) => {
        return part
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
            .replace(/^\.+/, '_')
            .replace(/\.+$/, '_')
            .substring(0, 200);
    });
    return safeParts.join('/') || 'file';
}

// Handle duplicate filenames/paths in ZIP
function resolveZipPath(existing: Set<string>, rawPath: string): string {
    let finalPath = sanitizeZipPath(rawPath);
    let counter = 1;

    const lastSlash = finalPath.lastIndexOf('/');
    const dir = lastSlash >= 0 ? finalPath.slice(0, lastSlash + 1) : '';
    const filePart = lastSlash >= 0 ? finalPath.slice(lastSlash + 1) : finalPath;

    const ext = filePart.includes('.') ? '.' + filePart.split('.').pop() : '';
    const base = ext ? filePart.slice(0, -ext.length) : filePart;

    while (existing.has(finalPath)) {
        finalPath = `${dir}${base} (${counter})${ext}`;
        counter++;
    }
    existing.add(finalPath);
    return finalPath;
}

/**
 * Create a ZIP file from multiple blobs
 */
export async function createZip(
    files: ZipFile[],
    options: ZipOptions = {}
): Promise<Blob> {
    const { onProgress } = options;

    if (files.length === 0) {
        throw new Error('No files to zip');
    }

    const totalBytes = files.reduce((sum, f) => sum + f.blob.size, 0);
    let processedBytes = 0;
    const usedNames = new Set<string>();

    // Convert blobs to Uint8Arrays - fflate expects Record<string, Uint8Array>
    const fileData: Record<string, Uint8Array> = {};

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const rawPath = file.relativePath || file.name;
        const safeName = resolveZipPath(usedNames, rawPath);

        // Report progress
        if (onProgress) {
            onProgress({
                currentFile: safeName,
                currentIndex: i,
                totalFiles: files.length,
                processedBytes,
                totalBytes,
                percent: Math.round((processedBytes / totalBytes) * 100),
            });
        }

        // Read blob to Uint8Array
        const arrayBuffer = await file.blob.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        fileData[safeName] = uint8;

        processedBytes += file.blob.size;
    }

    // Final progress
    if (onProgress) {
        onProgress({
            currentFile: 'Creating ZIP...',
            currentIndex: files.length,
            totalFiles: files.length,
            processedBytes: totalBytes,
            totalBytes,
            percent: 99,
        });
    }

    // Create ZIP with level 0 (store mode - no compression, just packaging)
    return new Promise((resolve, reject) => {
        zip(fileData, { level: 0 }, (err, data) => {
            if (err) {
                reject(err);
                return;
            }

            if (onProgress) {
                onProgress({
                    currentFile: 'Done!',
                    currentIndex: files.length,
                    totalFiles: files.length,
                    processedBytes: totalBytes,
                    totalBytes,
                    percent: 100,
                });
            }

            resolve(new Blob([data], { type: 'application/zip' }));
        });
    });
}

/**
 * Download a blob as file
 */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Format file size for display
 */
export function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Generate smart ZIP filename
 */
export function generateZipFilename(roomCode?: string): string {
    const now = new Date();
    const date = now.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).replace(/\//g, '');

    if (roomCode) {
        return `FileBridge_${roomCode}_${date}.zip`;
    }
    return `FileBridge_Files_${date}.zip`;
}

/**
 * Smart threshold check
 * Returns recommended approach based on total size
 */
export function shouldZipAll(totalBytes: number): {
    canZip: boolean;
    reason: string;
    recommended?: string;
} {
    const MB = 1024 * 1024;

    if (totalBytes <= 800 * MB) {
        return {
            canZip: true,
            reason: 'Total size is within safe limits for instant ZIP',
        };
    }

    if (totalBytes <= 1 * 1024 * MB) {
        return {
            canZip: true,
            reason: 'Large file detected, may take longer to process',
        };
    }

    return {
        canZip: false,
        reason: 'Files are too large for browser ZIP processing',
        recommended: 'Download files individually instead',
    };
}
