/**
 * Room link utilities - reading room IDs from URL and building share links.
 */

const ROOM_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getRoomFromUrl(hash: string, search: string): string | null {
    const fromHash = new URLSearchParams(hash.replace(/^#/, '')).get('room');
    if (fromHash) return fromHash;
    return new URLSearchParams(search).get('room');
}

export function isValidRoomId(roomId: string): boolean {
    return ROOM_ID_REGEX.test(roomId);
}

export function buildShareLink(origin: string, roomId: string, nonce: string): string {
    return `${origin}/?s=${nonce}#room=${roomId}`;
}

export function extractRoomId(input: string): string | null {
    if (!input) return null;
    const trimmed = input.trim();
    if (isValidRoomId(trimmed)) return trimmed;
    try {
        const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
        const fromHash = new URLSearchParams(url.hash.replace(/^#/, '')).get('room');
        if (fromHash && isValidRoomId(fromHash)) return fromHash;
        const fromSearch = url.searchParams.get('room');
        if (fromSearch && isValidRoomId(fromSearch)) return fromSearch;
    } catch {
        // Not a URL
    }
    const match = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (match && isValidRoomId(match[0])) return match[0];
    return null;
}

