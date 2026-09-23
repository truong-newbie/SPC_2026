/**
 * Socket URL resolution - resolves the signaling server URL at runtime.
 * The server URL comes from the NEXT_PUBLIC_SOCKET_URL env var,
 * defaulting to the same origin for same-origin deployments.
 */

let cachedUrl: string | null = null;

export function resolveSocketUrl(): Promise<string> {
    if (cachedUrl) return Promise.resolve(cachedUrl);
    return fetch('/api/config')
        .then(r => r.json())
        .then(({ socketUrl }) => {
            cachedUrl = socketUrl;
            return socketUrl;
        })
        .catch(() => {
            const fallback = process.env.NEXT_PUBLIC_SOCKET_URL || '';
            cachedUrl = fallback;
            return fallback;
        });
}

export function peekSocketUrl(): string | null {
    return cachedUrl;
}
