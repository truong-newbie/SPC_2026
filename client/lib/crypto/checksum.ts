/**
 * SPC_2026 SHA-256 File & Blob Integrity Helper
 * Uses native WebCrypto API for ultra-fast client-side hashing without external libraries
 */

/**
 * Compute SHA-256 hash of a File or Blob.
 * Returns a 64-character lowercase hexadecimal string.
 */
export async function computeSHA256(data: Blob | File): Promise<string> {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
        return '';
    }
    try {
        const buffer = await data.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        console.warn('SHA-256 computation failed:', e);
        return '';
    }
}

/**
 * Shorten a 64-character hash for clean display in UI badges
 * e.g. "7f83b165...e2d5"
 */
export function formatHashShort(hash: string): string {
    if (!hash || hash.length < 16) return hash;
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}
