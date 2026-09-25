import { resolveSocketUrl } from './socketUrl';

export const RELAY_SIZE_LIMIT = 2 * 1024 * 1024 * 1024; // 2 GB

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:openrelay.metered.ca:80' },
    {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
    {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
    {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
];

let cachedIceServers: RTCIceServer[] | null = null;

export async function fetchIceServers(socketUrl?: string): Promise<RTCIceServer[]> {
    if (cachedIceServers && cachedIceServers.length > 0) {
        return cachedIceServers;
    }
    try {
        let serverUrl = socketUrl || process.env.NEXT_PUBLIC_SOCKET_URL;
        if (!serverUrl) {
            serverUrl = await resolveSocketUrl();
        }
        if (!serverUrl) {
            serverUrl = 'http://localhost:3001';
        }
        const res = await fetch(`${serverUrl}/api/turn-credentials`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
            const servers = await res.json();
            if (Array.isArray(servers) && servers.length > 0) {
                cachedIceServers = servers;
                return servers;
            }
        }
    } catch (e) {
        console.warn('Failed to fetch TURN credentials, using default ICE servers', e);
    }
    return DEFAULT_ICE_SERVERS;
}

export function filterIceServers(
    servers: RTCIceServer[],
    relayEnabled: boolean
): RTCIceServer[] {
    if (relayEnabled) return servers;
    return servers.filter((s) => {
        const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
        return !urls.some((u) => u.startsWith('turn:') || u.startsWith('turns:'));
    });
}

export function isRelayPair(localType?: string, remoteType?: string): boolean {
    return localType === 'relay' || remoteType === 'relay';
}

export type RelayGateVerdict =
    | { action: 'proceed' }
    | { action: 'block-relay-disabled' }
    | { action: 'block-over-limit'; totalSize: number };

export function evaluateRelayGate(opts: {
    isRelay: boolean;
    relayEnabled: boolean;
    totalSize: number;
}): RelayGateVerdict {
    const { isRelay, relayEnabled, totalSize } = opts;
    if (isRelay && !relayEnabled) return { action: 'block-relay-disabled' };
    if (isRelay && totalSize > RELAY_SIZE_LIMIT) {
        return { action: 'block-over-limit', totalSize };
    }
    return { action: 'proceed' };
}

export function probeIsRelay(stats: RTCStatsReport): boolean {
    let relay = false;
    stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) {
            const local = stats.get(report.localCandidateId);
            const remote = stats.get(report.remoteCandidateId);
            if (isRelayPair(local?.candidateType, remote?.candidateType)) {
                relay = true;
            }
        }
    });
    return relay;
}

export function readConnectionType(stats: RTCStatsReport): 'direct' | 'relay' | null {
    let nominated = false;
    let relay = false;
    stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) {
            nominated = true;
            const local = stats.get(report.localCandidateId);
            const remote = stats.get(report.remoteCandidateId);
            if (isRelayPair(local?.candidateType, remote?.candidateType)) {
                relay = true;
            }
        }
    });
    if (!nominated) return null;
    return relay ? 'relay' : 'direct';
}
