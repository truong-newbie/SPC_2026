/**
 * SPC_2026 - Swarm Manager
 *
 * Manages P2P swarm for multi-peer file sharing.
 */

import SimplePeer from 'simple-peer';
import { v4 as uuidv4 } from 'uuid';
import {
    deriveKey,
    encryptPiece,
    decryptPiece,
    generatePassword,
    type EncryptionKey,
} from './encryption';
import {
    selectNextPiece,
    splitIntoPieces,
    mergePieces,
    DEFAULT_PIECE_SIZE,
    calculatePieceCount,
    type PieceInfo,
} from './piece';

export interface SwarmConfig {
    fileId: string;
    fileName: string;
    fileSize: number;
    pieceSize?: number;
}

export interface SwarmCallbacks {
    onProgress?: (percent: number, speed?: number) => void;
    onPieceComplete?: (pieceIndex: number) => void;
    onComplete?: (blob: Blob) => void;
    onError?: (error: string) => void;
    onPeersUpdate?: (peerCount: number, seedCount: number) => void;
    onStatus?: (status: string) => void;
}

export interface SwarmPeer {
    peerId: string;
    connection: SimplePeer.Instance;
    pieces: Set<number>;
    isConnected: boolean;
}

export interface Swarminfo {
    fileId: string;
    totalPieces: number;
    peerCount: number;
    seedCount: number;
    leecherCount: number;
    peers: Array<{ peerId: string; pieces: number[] }>;
    pieceAvailability?: Array<{ index: number; count: number }>;
}

interface PeerConnection {
    peerId: string;
    peer: SimplePeer.Instance;
    pieces: Set<number>;
    isConnected: boolean;
}

// ICE servers
const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

export class SwarmManager {
    private config: Required<SwarmConfig>;
    private callbacks: SwarmCallbacks;
    private socket: any; // Socket.IO socket

    // Swarm state
    private isSeeding: boolean;
    private filePieces: Map<number, ArrayBuffer>; // Pieces we hold (as seeder)
    private heldPieces: Set<number>; // Pieces we have (as leecher)
    private pendingRequests: Set<number>; // Pieces being requested

    // Peer management
    private peers: Map<string, PeerConnection>;
    private peerPieceMap: Map<string, Set<number>>; // peerId -> pieces they have

    // Piece availability tracking
    private pieceAvailability: Map<number, number>; // pieceIndex -> peerCount

    // ICE servers
    private iceServers: RTCIceServer[];

    // Encryption
    private encryptionKey: EncryptionKey | null = null;

    constructor(
        config: SwarmConfig,
        socket: any,
        callbacks: SwarmCallbacks = {}
    ) {
        this.config = {
            pieceSize: DEFAULT_PIECE_SIZE,
            ...config,
        };
        this.socket = socket;
        this.callbacks = callbacks;
        this.isSeeding = false;
        this.filePieces = new Map();
        this.heldPieces = new Set();
        this.pendingRequests = new Set();
        this.peers = new Map();
        this.peerPieceMap = new Map();
        this.pieceAvailability = new Map();
        this.iceServers = ICE_SERVERS;
    }

    /**
     * Set encryption password for the file
     */
    setPassword(password: string): void {
        this.encryptionKey = deriveKey(password);
    }

    /**
     * Generate and get shareable password
     */
    generatePassword(): string {
        const password = generatePassword();
        this.encryptionKey = deriveKey(password);
        return password;
    }

    /**
     * Get share info (fileId + password for sharing)
     */
    getShareInfo(): { fileId: string; password: string; totalPieces: number } {
        return {
            fileId: this.config.fileId,
            password: this.encryptionKey?.key || '',
            totalPieces: calculatePieceCount(this.config.fileSize, this.config.pieceSize),
        };
    }

    /**
     * Start seeding (hosting a file)
     */
    async startSeeding(fileData: ArrayBuffer): Promise<void> {
        this.isSeeding = true;
        this.callbacks.onStatus?.('Splitting file into pieces...');

        // Split file into pieces
        const pieces = splitIntoPieces(fileData, this.config.pieceSize);

        // Store pieces (in memory for now)
        for (let i = 0; i < pieces.length; i++) {
            this.filePieces.set(i, pieces[i]);
            this.heldPieces.add(i);
        }

        this.callbacks.onStatus?.('Announcing to swarm...');

        // Announce pieces to server
        this.socket.emit('announce-pieces', {
            fileId: this.config.fileId,
            pieces: [...this.filePieces.keys()],
        });

        this.callbacks.onStatus?.(`Seeding ${this.filePieces.size} pieces`);
    }

    /**
     * Start downloading (joining swarm as leecher)
     */
    startDownloading(): void {
        this.isSeeding = false;
        this.callbacks.onStatus?.('Connecting to swarm...');
    }

    /**
     * Handle incoming swarm info
     */
    handleSwarmInfo(info: Swarminfo): void {
        this.callbacks.onPeersUpdate?.(info.peerCount, info.seedCount);

        // Update piece availability
        this.pieceAvailability.clear();
        for (const piece of info.pieceAvailability || []) {
            this.pieceAvailability.set(piece.index, piece.count);
        }

        // Update peer piece maps
        for (const peer of info.peers) {
            this.peerPieceMap.set(peer.peerId, new Set(peer.pieces));
        }

        // Request pieces if downloading
        if (!this.isSeeding && this.peers.size > 0) {
            this.requestNextPiece();
        }
    }

    /**
     * Handle peer joined
     */
    handlePeerJoined(peerId: string): void {
        this.callbacks.onStatus?.(`Peer joined: ${peerId.substring(0, 8)}`);
        this.callbacks.onPeersUpdate?.(this.peers.size + 1, this.getSeedCount());

        // Initiate WebRTC connection to new peer
        this.connectToPeer(peerId, true);
    }

    /**
     * Handle peer left
     */
    handlePeerLeft(peerId: string): void {
        this.callbacks.onStatus?.(`Peer left: ${peerId.substring(0, 8)}`);

        // Remove peer and their pieces from availability
        const peerPieces = this.peerPieceMap.get(peerId);
        if (peerPieces) {
            for (const piece of peerPieces) {
                const current = this.pieceAvailability.get(piece) || 1;
                this.pieceAvailability.set(piece, Math.max(0, current - 1));
            }
        }

        this.peerPieceMap.delete(peerId);
        this.removePeer(peerId);
        this.callbacks.onPeersUpdate?.(this.peers.size, this.getSeedCount());
    }

    /**
     * Handle peer pieces update
     */
    handlePeerPieces(peerId: string, pieces: number[]): void {
        const oldPieces = this.peerPieceMap.get(peerId) || new Set();
        this.peerPieceMap.set(peerId, new Set(pieces));

        // Update availability
        for (const piece of oldPieces) {
            if (!pieces.includes(piece)) {
                const current = this.pieceAvailability.get(piece) || 1;
                this.pieceAvailability.set(piece, Math.max(0, current - 1));
            }
        }
        for (const piece of pieces) {
            if (!oldPieces.has(piece)) {
                this.pieceAvailability.set(piece, (this.pieceAvailability.get(piece) || 0) + 1);
            }
        }

        // If we're downloading and just got new pieces, request next
        if (!this.isSeeding) {
            this.requestNextPiece();
        }
    }

    /**
     * Request next piece to download
     */
    private requestNextPiece(): void {
        if (this.peers.size === 0) return;

        const totalPieces = calculatePieceCount(this.config.fileSize, this.config.pieceSize);
        const availInfo: PieceInfo[] = [];
        for (let i = 0; i < totalPieces; i++) {
            availInfo.push({ index: i, count: this.pieceAvailability.get(i) || 0 });
        }

        const nextPiece = selectNextPiece(totalPieces, this.heldPieces, availInfo, {
            sequentialPreference: true,
            rarestFirst: true,
        });

        if (nextPiece === null) {
            // All pieces downloaded
            if (this.heldPieces.size === totalPieces) {
                this.completeDownload();
            }
            return;
        }

        // Find peers who have this piece
        for (const [peerId, pieces] of this.peerPieceMap) {
            if (pieces.has(nextPiece) && !this.pendingRequests.has(nextPiece)) {
                this.pendingRequests.add(nextPiece);
                this.requestPieceFromPeer(nextPiece, peerId);
                break;
            }
        }
    }

    /**
     * Request a specific piece from a peer
     */
    private requestPieceFromPeer(pieceIndex: number, peerId: string): void {
        const peer = this.peers.get(peerId);
        if (!peer || !peer.isConnected) {
            this.pendingRequests.delete(pieceIndex);
            return;
        }

        peer.peer.send(JSON.stringify({
            type: 'request-piece',
            fileId: this.config.fileId,
            pieceIndex,
        }));
    }

    /**
     * Handle received piece
     */
    handleReceivedPiece(pieceIndex: number, data: ArrayBuffer): void {
        this.pendingRequests.delete(pieceIndex);
        this.heldPieces.add(pieceIndex);

        // Update availability
        this.pieceAvailability.set(pieceIndex, (this.pieceAvailability.get(pieceIndex) || 0) + 1);

        this.callbacks.onPieceComplete?.(pieceIndex);

        // Update progress
        const totalPieces = calculatePieceCount(this.config.fileSize, this.config.pieceSize);
        const percent = Math.round((this.heldPieces.size / totalPieces) * 100);
        this.callbacks.onProgress?.(percent);

        // Announce new piece to swarm
        this.socket.emit('announce-pieces', {
            fileId: this.config.fileId,
            pieces: [...this.heldPieces],
        });

        // Request next piece
        this.requestNextPiece();
    }

    /**
     * Complete download and assemble file
     */
    private completeDownload(): void {
        const totalPieces = calculatePieceCount(this.config.fileSize, this.config.pieceSize);

        if (this.heldPieces.size !== totalPieces) {
            this.callbacks.onError?.('Missing pieces - download incomplete');
            return;
        }

        this.callbacks.onStatus?.('Assembling file...');

        // Collect pieces in order
        const pieces: ArrayBuffer[] = [];
        for (let i = 0; i < totalPieces; i++) {
            const piece = this.filePieces.get(i);
            if (!piece) {
                this.callbacks.onError?.(`Missing piece ${i}`);
                return;
            }
            pieces.push(piece);
        }

        // Merge pieces
        const fileData = mergePieces(pieces, this.config.fileSize);
        const blob = new Blob([fileData]);

        this.callbacks.onComplete?.(blob);
        this.callbacks.onStatus?.('Download complete!');
    }

    /**
     * Connect to a peer via WebRTC
     */
    private connectToPeer(peerId: string, initiator: boolean): void {
        if (this.peers.has(peerId)) return;

        const peer = new SimplePeer({
            initiator,
            trickle: true,
            config: { iceServers: this.iceServers },
        });

        peer.on('signal', (data) => {
            // Send signal through server
            this.socket.emit('signal', {
                target: peerId,
                signal: data,
            });
        });

        peer.on('connect', () => {
            const conn = this.peers.get(peerId);
            if (conn) conn.isConnected = true;

            // Announce our pieces
            peer.send(JSON.stringify({
                type: 'announce-pieces',
                fileId: this.config.fileId,
                pieces: [...this.heldPieces],
            }));

            // Request piece if downloading
            if (!this.isSeeding) {
                this.requestNextPiece();
            }
        });

        peer.on('data', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                this.handlePeerMessage(peerId, msg);
            } catch {
                // Binary piece data
                if (data instanceof ArrayBuffer) {
                    // This is a piece!
                    const pieceIndex = this.extractPieceIndex(data);
                    if (pieceIndex !== null) {
                        this.handleReceivedPiece(pieceIndex, data);
                    }
                }
            }
        });

        peer.on('close', () => {
            this.removePeer(peerId);
        });

        peer.on('error', (err) => {
            console.error(`Peer ${peerId} error:`, err);
            this.removePeer(peerId);
        });

        this.peers.set(peerId, { peerId, peer, pieces: new Set(), isConnected: false });
    }

    /**
     * Handle message from peer
     */
    private handlePeerMessage(peerId: string, msg: any): void {
        switch (msg.type) {
            case 'announce-pieces':
                if (Array.isArray(msg.pieces)) {
                    this.handlePeerPieces(peerId, msg.pieces);
                }
                break;

            case 'request-piece':
                this.handlePieceRequest(peerId, msg.pieceIndex);
                break;

            case 'piece-data':
                if (msg.pieceIndex !== undefined && msg.data) {
                    const buffer = this.base64ToArrayBuffer(msg.data);
                    this.handleReceivedPiece(msg.pieceIndex, buffer);
                }
                break;
        }
    }

    /**
     * Handle piece request from peer
     */
    private handlePieceRequest(peerId: string, pieceIndex: number): void {
        if (!this.isSeeding) return;

        const piece = this.filePieces.get(pieceIndex);
        if (!piece) return;

        const peer = this.peers.get(peerId);
        if (!peer || !peer.isConnected) return;

        // Send piece
        peer.peer.send(JSON.stringify({
            type: 'piece-data',
            pieceIndex,
            data: this.arrayBufferToBase64(piece),
        }));
    }

    /**
     * Extract piece index from binary data (first 4 bytes)
     */
    private extractPieceIndex(data: ArrayBuffer): number | null {
        if (data.byteLength < 4) return null;
        const view = new DataView(data);
        return view.getUint32(0, false);
    }

    /**
     * Remove peer connection
     */
    private removePeer(peerId: string): void {
        const conn = this.peers.get(peerId);
        if (conn) {
            conn.peer.destroy();
            this.peers.delete(peerId);
        }
        this.peerPieceMap.delete(peerId);
    }

    /**
     * Get current seed count
     */
    private getSeedCount(): number {
        const totalPieces = calculatePieceCount(this.config.fileSize, this.config.pieceSize);
        let seeds = 0;
        for (const pieces of this.peerPieceMap.values()) {
            if (pieces.size === totalPieces) seeds++;
        }
        if (this.isSeeding) seeds++;
        return seeds;
    }

    /**
     * Utility: ArrayBuffer to Base64
     */
    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Utility: Base64 to ArrayBuffer
     */
    private base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Cleanup and destroy
     */
    destroy(): void {
        for (const peer of this.peers.values()) {
            peer.peer.destroy();
        }
        this.peers.clear();
        this.filePieces.clear();
        this.heldPieces.clear();
        this.peerPieceMap.clear();
    }

    /**
     * Get progress
     */
    getProgress(): number {
        const totalPieces = calculatePieceCount(this.config.fileSize, this.config.pieceSize);
        return Math.round((this.heldPieces.size / totalPieces) * 100);
    }

    /**
     * Get held pieces count
     */
    getHeldPiecesCount(): number {
        return this.heldPieces.size;
    }
}
