/**
 * Socket URL resolution - resolves the signaling server URL at runtime.
 * Defaults to same-origin (empty string) for production deployments,
 * falling back to local port 3001 only when developing on localhost.
 */

let cachedUrl: string | null = null;

export async function resolveSocketUrl(): Promise<string> {
    if (cachedUrl !== null) {
        return cachedUrl;
    }

    // If running in a browser on any production host (e.g. filebridge.click),
    // always connect to the same origin so Nginx reverse proxies /socket.io/ to port 3001
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        cachedUrl = '';
        return '';
    }

    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        const url: string = (data && typeof data.socketUrl === 'string') ? data.socketUrl : '';
        if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            cachedUrl = '';
            return '';
        }
        cachedUrl = url;
        return url;
    } catch {
        const fallback: string = process.env.NEXT_PUBLIC_SOCKET_URL || '';
        cachedUrl = fallback;
        return fallback;
    }
}

export function peekSocketUrl(): string | null {
    return cachedUrl;
}

