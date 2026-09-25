/**
 * SPC_2026 - Swarm Module Exports
 */

export { SwarmManager } from './swarm';
export type { SwarmConfig, SwarmCallbacks, SwarmPeer, Swarminfo } from './swarm';

export {
    deriveKey,
    encryptPiece,
    decryptPiece,
    generatePassword,
    encryptString,
    decryptString,
} from './encryption';
export type { EncryptedPiece, EncryptionKey } from './encryption';

export {
    selectNextPiece,
    splitIntoPieces,
    mergePieces,
    getCompletionPercent,
    getRarityStats,
    calculatePieceCount,
    DEFAULT_PIECE_SIZE,
} from './piece';
export type { PieceInfo, PieceSelectionOptions } from './piece';

export { packFiles, unpackFiles } from './pack';
export type { PackedFileInfo, UnpackedFile } from './pack';
