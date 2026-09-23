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
