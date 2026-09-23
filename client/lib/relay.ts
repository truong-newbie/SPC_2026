/**
 * Relay policy utilities
 */

export const RELAY_SIZE_LIMIT = 2 * 1024 * 1024 * 1024; // 2 GB

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
