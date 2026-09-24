/**
 * SPC_2026 - Swarm Tracker
 *
 * Manages swarm state for multi-peer file sharing.
 * Server acts as tracker only - NO file data stored here.
 *
 * Swarm structure:
 * - swarms: Map<fileId, { peers: Map<peerId, Set<pieceIndex>>, totalPieces, createdAt }>
 * - peerSwarms: Map<peerId, Set<fileId>>
 */

const swarms = new Map(); // fileId → SwarmData
const peerSwarms = new Map(); // peerId → Set<fileId>

// Piece availability cache: fileId → pieceIndex → peerCount
const pieceAvailability = new Map(); // fileId → Map<pieceIndex, count>

const MAX_PIECES_PER_SWARM = 65536;
const SWARM_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * @typedef {Object} SwarmData
 * @property {Map<string, Set<number>>} peers - peerId → Set of piece indices
 * @property {number} totalPieces
 * @property {number} createdAt
 * @property {string} fileHash - optional hash for verification
 */

/**
 * Create a new swarm for a file
 * @param {string} fileId - Unique file identifier
 * @param {number} totalPieces - Total number of pieces
 * @param {string} [fileHash] - Optional hash for verification
 * @returns {{ success: boolean, error?: string }}
 */
function createSwarm(fileId, totalPieces, fileHash = null) {
    if (swarms.has(fileId)) {
        return { success: false, error: 'Swarm already exists' };
    }

    if (!Number.isInteger(totalPieces) || totalPieces < 1) {
        return { success: false, error: 'Invalid totalPieces' };
    }

    if (totalPieces > MAX_PIECES_PER_SWARM) {
        return { success: false, error: `Too many pieces (max ${MAX_PIECES_PER_SWARM})` };
    }

    const swarmData = {
        peers: new Map(),
        totalPieces,
        createdAt: Date.now(),
        fileHash,
    };

    swarms.set(fileId, swarmData);
    pieceAvailability.set(fileId, new Map());

    console.log(`[Swarm] Created: ${fileId} with ${totalPieces} pieces`);

    return { success: true };
}

/**
 * Join a peer to a swarm
 * @param {string} fileId
 * @param {string} peerId
 * @returns {{ success: boolean, error?: string, swarmInfo?: object }}
 */
function joinSwarm(fileId, peerId) {
    const swarm = swarms.get(fileId);
    if (!swarm) {
        return { success: false, error: 'Swarm not found' };
    }

    // Leave any previous swarm with this peer for this file
    leaveSwarmInternal(fileId, peerId);

    // Add peer to swarm
    swarm.peers.set(peerId, new Set());

    // Track peer in peerSwarms
    if (!peerSwarms.has(peerId)) {
        peerSwarms.set(peerId, new Set());
    }
    peerSwarms.get(peerId).add(fileId);

    // Initialize piece availability
    for (let i = 0; i < swarm.totalPieces; i++) {
        const avail = pieceAvailability.get(fileId);
        if (!avail.has(i)) avail.set(i, 0);
    }

    console.log(`[Swarm] Peer ${peerId} joined ${fileId}. Peers: ${swarm.peers.size}`);

    return {
        success: true,
        swarmInfo: getSwarmInfo(fileId),
    };
}

/**
 * Internal leave (no event emission)
 */
function leaveSwarmInternal(fileId, peerId) {
    const swarm = swarms.get(fileId);
    if (!swarm) return;

    const peerPieces = swarm.peers.get(peerId);
    if (peerPieces) {
        // Update piece availability
        const avail = pieceAvailability.get(fileId);
        if (avail) {
            for (const pieceIndex of peerPieces) {
                const count = avail.get(pieceIndex) || 1;
                avail.set(pieceIndex, Math.max(0, count - 1));
            }
        }
        swarm.peers.delete(peerId);
    }

    // Update peerSwarms
    const peerFileSet = peerSwarms.get(peerId);
    if (peerFileSet) {
        peerFileSet.delete(fileId);
        if (peerFileSet.size === 0) {
            peerSwarms.delete(peerId);
        }
    }
}

/**
 * Leave a swarm
 * @param {string} fileId
 * @param {string} peerId
 * @returns {{ success: boolean }}
 */
function leaveSwarm(fileId, peerId) {
    const swarm = swarms.get(fileId);
    if (!swarm) {
        return { success: false };
    }

    leaveSwarmInternal(fileId, peerId);
    console.log(`[Swarm] Peer ${peerId} left ${fileId}. Peers: ${swarm.peers.size}`);

    // Clean up empty swarm
    if (swarm.peers.size === 0) {
        swarms.delete(fileId);
        pieceAvailability.delete(fileId);
        console.log(`[Swarm] Cleaned up empty swarm: ${fileId}`);
    }

    return { success: true };
}

/**
 * Announce pieces held by a peer
 * @param {string} fileId
 * @param {string} peerId
 * @param {number[]} pieces - Array of piece indices
 * @returns {{ success: boolean, updatedAvailability?: object }}
 */
function announcePieces(fileId, peerId, pieces) {
    const swarm = swarms.get(fileId);
    if (!swarm) {
        return { success: false, error: 'Swarm not found' };
    }

    const peerPieces = swarm.peers.get(peerId);
    if (!peerPieces) {
        return { success: false, error: 'Peer not in swarm' };
    }

    if (!Array.isArray(pieces)) {
        return { success: false, error: 'Invalid pieces array' };
    }

    const avail = pieceAvailability.get(fileId);
    const oldPieces = new Set(peerPieces);

    // Clear old pieces
    for (const pieceIndex of peerPieces) {
        const count = avail.get(pieceIndex) || 1;
        avail.set(pieceIndex, Math.max(0, count - 1));
    }
    peerPieces.clear();

    // Add new pieces
    for (const pieceIndex of pieces) {
        if (Number.isInteger(pieceIndex) && pieceIndex >= 0 && pieceIndex < swarm.totalPieces) {
            peerPieces.add(pieceIndex);
            avail.set(pieceIndex, (avail.get(pieceIndex) || 0) + 1);
        }
    }

    const newPieces = new Set(peerPieces);
    const justAdded = [...newPieces].filter(x => !oldPieces.has(x));

    console.log(`[Swarm] Peer ${peerId} announced ${pieces.length} pieces for ${fileId}`);

    return {
        success: true,
        justAdded,
        totalHeld: peerPieces.size,
    };
}

/**
 * Get peers that have a specific piece
 * @param {string} fileId
 * @param {number} pieceIndex
 * @returns {string[]} Array of peer IDs
 */
function getPeersWithPiece(fileId, pieceIndex) {
    const swarm = swarms.get(fileId);
    if (!swarm) return [];

    const result = [];
    for (const [peerId, pieces] of swarm.peers) {
        if (pieces.has(pieceIndex)) {
            result.push(peerId);
        }
    }
    return result;
}

/**
 * Get all peers with their pieces
 * @param {string} fileId
 * @returns {Array<{ peerId: string, pieces: number[] }>}
 */
function getPeersWithAllPieces(fileId) {
    const swarm = swarms.get(fileId);
    if (!swarm) return [];

    const result = [];
    for (const [peerId, pieces] of swarm.peers) {
        result.push({
            peerId,
            pieces: [...pieces],
            totalPieces: swarm.totalPieces,
        });
    }
    return result;
}

/**
 * Get swarm info
 * @param {string} fileId
 * @returns {object|null}
 */
function getSwarmInfo(fileId) {
    const swarm = swarms.get(fileId);
    if (!swarm) return null;

    const peers = [];
    for (const [peerId, pieces] of swarm.peers) {
        peers.push({
            peerId,
            pieces: [...pieces],
            hasAll: pieces.size === swarm.totalPieces,
        });
    }

    // Calculate piece availability
    const pieceAvail = [];
    for (let i = 0; i < swarm.totalPieces; i++) {
        pieceAvail.push({
            index: i,
            count: pieceAvailability.get(fileId)?.get(i) || 0,
        });
    }

    // Rarest pieces first
    pieceAvail.sort((a, b) => a.count - b.count);

    return {
        fileId,
        totalPieces: swarm.totalPieces,
        peerCount: swarm.peers.size,
        seedCount: peers.filter(p => p.hasAll).length,
        leecherCount: peers.filter(p => !p.hasAll).length,
        peers,
        pieceAvailability: pieceAvail,
        createdAt: swarm.createdAt,
    };
}

/**
 * Get peer info
 * @param {string} peerId
 * @returns {object|null}
 */
function getPeerInfo(peerId) {
    const fileSet = peerSwarms.get(peerId);
    if (!fileSet) return null;

    const files = [];
    for (const fileId of fileSet) {
        const swarm = swarms.get(fileId);
        if (swarm) {
            const pieces = swarm.peers.get(peerId);
            files.push({
                fileId,
                piecesHeld: pieces?.size || 0,
                totalPieces: swarm.totalPieces,
                complete: pieces?.size === swarm.totalPieces,
            });
        }
    }

    return {
        peerId,
        swarmCount: fileSet.size,
        files,
    };
}

/**
 * Check if a piece is available (at least 1 peer has it)
 * @param {string} fileId
 * @param {number} pieceIndex
 * @returns {boolean}
 */
function isPieceAvailable(fileId, pieceIndex) {
    const avail = pieceAvailability.get(fileId);
    if (!avail) return false;
    return (avail.get(pieceIndex) || 0) > 0;
}

/**
 * Get next rarest piece not held by peer
 * @param {string} fileId
 * @param {string} peerId
 * @returns {number|null} piece index or null if all pieces obtained
 */
function getNextRarestPiece(fileId, peerId) {
    const swarm = swarms.get(fileId);
    if (!swarm) return null;

    const peerPieces = swarm.peers.get(peerId);
    if (!peerPieces) return null;

    const avail = pieceAvailability.get(fileId);
    const rarestAvailable = [];

    for (let i = 0; i < swarm.totalPieces; i++) {
        if (!peerPieces.has(i)) {
            const count = avail?.get(i) || 0;
            rarestAvailable.push({ index: i, count });
        }
    }

    if (rarestAvailable.length === 0) return null;

    // Sort by rarity (ascending)
    rarestAvailable.sort((a, b) => a.count - b.count);

    // Get all pieces with minimum count
    const minCount = rarestAvailable[0].count;
    const minPieces = rarestAvailable.filter(p => p.count === minCount);

    // Random among pieces with same rarity
    return minPieces[Math.floor(Math.random() * minPieces.length)].index;
}

/**
 * Get all missing pieces for a peer
 * @param {string} fileId
 * @param {string} peerId
 * @returns {number[]}
 */
function getMissingPieces(fileId, peerId) {
    const swarm = swarms.get(fileId);
    if (!swarm) return [];

    const peerPieces = swarm.peers.get(peerId);
    if (!peerPieces) return [];

    const missing = [];
    for (let i = 0; i < swarm.totalPieces; i++) {
        if (!peerPieces.has(i)) {
            missing.push(i);
        }
    }
    return missing;
}

/**
 * Clean up timed-out swarms
 */
function cleanup() {
    const now = Date.now();
    for (const [fileId, swarm] of swarms) {
        if (now - swarm.createdAt > SWARM_TIMEOUT_MS && swarm.peers.size === 0) {
            swarms.delete(fileId);
            pieceAvailability.delete(fileId);
            console.log(`[Swarm] Cleaned up timed-out swarm: ${fileId}`);
        }
    }
}

// Cleanup every 5 minutes
setInterval(cleanup, 5 * 60 * 1000).unref();

// Stats
function getStats() {
    return {
        totalSwarms: swarms.size,
        totalPeers: peerSwarms.size,
        totalPieces: Array.from(pieceAvailability.values())
            .reduce((sum, m) => sum + m.size, 0),
    };
}

module.exports = {
    createSwarm,
    joinSwarm,
    leaveSwarm,
    announcePieces,
    getPeersWithPiece,
    getPeersWithAllPieces,
    getSwarmInfo,
    getPeerInfo,
    isPieceAvailable,
    getNextRarestPiece,
    getMissingPieces,
    getStats,
};
