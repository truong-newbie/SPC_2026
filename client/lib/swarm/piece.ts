/**
 * SPC_2026 - Piece Selection Algorithm
 *
 * Implements rarest-first piece selection with sequential preference.
 */

export interface PieceInfo {
    index: number;
    count: number; // Number of peers with this piece
}

export interface PieceSelectionOptions {
    sequentialPreference: boolean; // Prefer sequential pieces for sequential download
    rarestFirst: boolean;        // Prioritize rarest pieces
}

/**
 * Select next piece to download using rarest-first algorithm
 */
export function selectNextPiece(
    totalPieces: number,
    heldPieces: Set<number>,
    pieceAvailability: PieceInfo[],
    options: Partial<PieceSelectionOptions> = {}
): number | null {
    const { sequentialPreference = true, rarestFirst = true } = options;

    // Find missing pieces
    const missing: PieceInfo[] = [];
    for (let i = 0; i < totalPieces; i++) {
        if (!heldPieces.has(i)) {
            const avail = pieceAvailability.find(p => p.index === i);
            missing.push({
                index: i,
                count: avail?.count ?? 0,
            });
        }
    }

    if (missing.length === 0) return null;

    if (!rarestFirst) {
        // Random selection
        return missing[Math.floor(Math.random() * missing.length)].index;
    }

    // Sort by rarity (ascending - rarest first means lowest count)
    missing.sort((a, b) => a.count - b.count);

    // Get pieces with minimum count
    const minCount = missing[0].count;
    const rarest = missing.filter(p => p.count === minCount);

    if (!sequentialPreference) {
        // Pure rarest-first: random among rarest
        return rarest[Math.floor(Math.random() * rarest.length)].index;
    }

    // Sequential + Rarest: prefer next sequential piece if it has same rarity
    const nextSequential = findNextSequentialPiece(heldPieces, totalPieces);
    const sequentialCandidate = rarest.find(p => p.index === nextSequential);

    if (sequentialCandidate) {
        return sequentialCandidate.index;
    }

    // Fall back to rarest
    return rarest[Math.floor(Math.random() * rarest.length)].index;
}

/**
 * Find the next sequential piece (the one after our last held piece)
 */
function findNextSequentialPiece(heldPieces: Set<number>, totalPieces: number): number | null {
    for (let i = 0; i < totalPieces; i++) {
        if (!heldPieces.has(i)) {
            return i;
        }
    }
    return null;
}

/**
 * Calculate completion percentage
 */
export function getCompletionPercent(heldPieces: Set<number>, totalPieces: number): number {
    if (totalPieces === 0) return 100;
    return Math.round((heldPieces.size / totalPieces) * 100);
}

/**
 * Calculate rarity statistics
 */
export function getRarityStats(pieceAvailability: PieceInfo[]): {
    min: number;
    max: number;
    avg: number;
    missing: number;
} {
    if (pieceAvailability.length === 0) {
        return { min: 0, max: 0, avg: 0, missing: 0 };
    }

    let min = Infinity;
    let max = 0;
    let sum = 0;

    for (const piece of pieceAvailability) {
        if (piece.count < min) min = piece.count;
        if (piece.count > max) max = piece.count;
        sum += piece.count;
    }

    return {
        min,
        max,
        avg: Math.round(sum / pieceAvailability.length),
        missing: pieceAvailability.filter(p => p.count === 0).length,
    };
}

/**
 * Split file into pieces
 */
export function splitIntoPieces(
    data: ArrayBuffer,
    pieceSize: number
): ArrayBuffer[] {
    const pieces: ArrayBuffer[] = [];
    const view = new Uint8Array(data);
    let offset = 0;

    while (offset < view.length) {
        const end = Math.min(offset + pieceSize, view.length);
        pieces.push(view.slice(offset, end).buffer);
        offset = end;
    }

    return pieces;
}

/**
 * Merge pieces into file
 */
export function mergePieces(pieces: ArrayBuffer[], totalSize: number): ArrayBuffer {
    const result = new Uint8Array(totalSize);
    let offset = 0;

    for (const piece of pieces) {
        const view = new Uint8Array(piece);
        result.set(view, offset);
        offset += view.length;
    }

    return result.buffer;
}

/**
 * Default piece size (512KB)
 */
export const DEFAULT_PIECE_SIZE = 512 * 1024;

/**
 * Calculate number of pieces for a file
 */
export function calculatePieceCount(fileSize: number, pieceSize = DEFAULT_PIECE_SIZE): number {
    return Math.ceil(fileSize / pieceSize);
}
