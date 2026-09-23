/**
 * File download utilities
 */

export function downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Sanitizes display text for safe rendering.
 * Caps at maxChars UTF-16 code units, never leaving a lone surrogate.
 */
export function sanitizeDisplayText(text: string, maxChars: number = 300): string {
    if (!text) return '';
    if (text.length <= maxChars) return text;

    let truncated = text.slice(0, maxChars);

    // Check for lone surrogate at end
    const code = truncated.charCodeAt(truncated.length - 1);
    if (code >= 0xD800 && code <= 0xDBFF) {
        truncated = truncated.slice(0, -1);
    }

    return truncated;
}

/**
 * Formats bytes into human readable format
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Formats speed in bytes per second
 */
export function formatSpeed(bytesPerSec: number): string {
    return `${formatBytes(bytesPerSec)}/s`;
}

/**
 * Formats ETA in seconds to human readable
 */
export function formatETA(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '--';
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
