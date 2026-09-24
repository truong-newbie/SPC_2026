'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { SwarmManager } from '@/lib/swarm';
import { formatBytes } from '@/lib/download';
import { Button } from './Button';
import { ProgressBar } from './ProgressBar';
import {
    Upload,
    Download,
    Copy,
    Check,
    Users,
    Lock,
    Loader2,
    Share2,
    Link,
} from 'lucide-react';

interface SwarmTransferProps {
    className?: string;
    socketUrl?: string;
}

export default function SwarmTransfer({ className, socketUrl }: SwarmTransferProps) {
    // Connection state
    const [isConnected, setIsConnected] = useState(false);
    const [isHosting, setIsHosting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    // File state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [shareLink, setShareLink] = useState('');
    const [password, setPassword] = useState('');

    // Download state
    const [downloadPassword, setDownloadPassword] = useState('');
    const [downloadLink, setDownloadLink] = useState('');

    // Progress state
    const [progress, setProgress] = useState(0);
    const [peersCount, setPeersCount] = useState(0);
    const [seedsCount, setSeedsCount] = useState(0);
    const [status, setStatus] = useState('Connect to start');
    const [error, setError] = useState('');

    // UI state
    const [isCopied, setIsCopied] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // Refs
    const socketRef = useRef<Socket | null>(null);
    const swarmRef = useRef<SwarmManager | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize socket connection
    useEffect(() => {
        const url = socketUrl || process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
        const socket = io(url, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socket.on('connect', () => {
            setIsConnected(true);
            setStatus('Connected - Select a file to host or enter a link to download');
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
            setStatus('Disconnected');
        });

        socket.on('connect_error', () => {
            setError('Connection failed. Check if server is running.');
        });

        // Swarm events
        socket.on('swarm-info', (info: any) => {
            if (swarmRef.current) {
                swarmRef.current.handleSwarmInfo(info);
            }
        });

        socket.on('peer-joined', ({ peerId }: { peerId: string }) => {
            if (swarmRef.current) {
                swarmRef.current.handlePeerJoined(peerId);
            }
        });

        socket.on('peer-left', ({ peerId }: { peerId: string }) => {
            if (swarmRef.current) {
                swarmRef.current.handlePeerLeft(peerId);
            }
        });

        socket.on('peer-pieces', ({ peerId, pieces }: { peerId: string; pieces: number[] }) => {
            if (swarmRef.current) {
                swarmRef.current.handlePeerPieces(peerId, pieces);
            }
        });

        socket.on('piece-available', ({ fileId, pieceIndex, peers }: { fileId: string; pieceIndex: number; peers: string[] }) => {
            console.log('Piece available:', { fileId, pieceIndex, peers });
        });

        socketRef.current = socket;

        return () => {
            swarmRef.current?.destroy();
            socket.disconnect();
        };
    }, [socketUrl]);

    // Handle file selection
    const handleFileSelect = useCallback((files: FileList | null) => {
        if (!files || files.length === 0) return;
        setSelectedFile(files[0]);
        setError('');
    }, []);

    // Handle drag and drop
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileSelect(e.dataTransfer.files);
    }, [handleFileSelect]);

    // Host file (start seeding)
    const handleHost = useCallback(async () => {
        if (!selectedFile || !socketRef.current) return;

        setIsHosting(true);
        setStatus('Reading file...');

        try {
            const fileData = await selectedFile.arrayBuffer();
            const fileId = uuidv4();

            // Create swarm manager
            const swarm = new SwarmManager(
                {
                    fileId,
                    fileName: selectedFile.name,
                    fileSize: selectedFile.size,
                },
                socketRef.current,
                {
                    onProgress: (percent) => setProgress(percent),
                    onPeersUpdate: (peers, seeds) => {
                        setPeersCount(peers);
                        setSeedsCount(seeds);
                    },
                    onStatus: (s) => setStatus(s),
                    onError: (e) => setError(e),
                }
            );

            // Generate password
            const pw = swarm.generatePassword();

            // Create swarm on server
            socketRef.current.emit('create-swarm', {
                fileId,
                totalPieces: Math.ceil(selectedFile.size / (512 * 1024)),
            });

            // Start seeding
            await swarm.startSeeding(fileData);

            // Join swarm as seeder
            socketRef.current.emit('join-swarm', { fileId });

            swarmRef.current = swarm;

            // Create share link with file info
            const totalPieces = Math.ceil(selectedFile.size / (512 * 1024));
            const link = `${window.location.origin}?swarm=${fileId}&name=${encodeURIComponent(selectedFile.name)}&size=${selectedFile.size}&pieces=${totalPieces}`;
            setShareLink(link);
            setPassword(pw);
            setStatus(`Seeding: ${selectedFile.name}`);

        } catch (err) {
            setError('Failed to host file');
            setIsHosting(false);
        }
    }, [selectedFile]);

    // Join swarm (download)
    const handleJoinSwarm = useCallback(() => {
        if (!downloadLink || !socketRef.current) return;

        // Extract file info from link
        const url = new URL(downloadLink);
        const fileId = url.searchParams.get('swarm');
        const fileName = url.searchParams.get('name') || 'downloaded-file';
        const fileSize = parseInt(url.searchParams.get('size') || '0', 10);

        if (!fileId) {
            setError('Invalid swarm link');
            return;
        }

        if (fileSize === 0) {
            setError('Invalid file info in link');
            return;
        }

        setIsDownloading(true);
        setStatus('Connecting to swarm...');

        // Create swarm manager with file info
        const swarm = new SwarmManager(
            {
                fileId,
                fileName: decodeURIComponent(fileName),
                fileSize,
            },
            socketRef.current,
            {
                onProgress: (percent) => setProgress(percent),
                onPeersUpdate: (peers, seeds) => {
                    setPeersCount(peers);
                    setSeedsCount(seeds);
                },
                onStatus: (s) => setStatus(s),
                onError: (e) => setError(e),
                onComplete: (blob) => {
                    // Download file
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'downloaded-file';
                    a.click();
                    URL.revokeObjectURL(url);
                    setStatus('Download complete!');
                },
            }
        );

        swarmRef.current = swarm;

        // Join swarm - emit AFTER swarm manager is ready
        // Check socket is connected first
        if (socketRef.current?.connected) {
            socketRef.current.emit('join-swarm', { fileId });
        } else {
            // Wait for connection then emit
            socketRef.current?.once('connect', () => {
                socketRef.current?.emit('join-swarm', { fileId });
            });
        }

        swarm.startDownloading();

    }, [downloadLink]);

    // Copy to clipboard
    const copyShareLink = useCallback(() => {
        const fullLink = shareLink + (password ? `#${password}` : '');
        navigator.clipboard.writeText(fullLink);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    }, [shareLink, password]);

    return (
        <div className={`p-6 max-w-2xl mx-auto ${className || ''}`}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg">
                    <Share2 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold">Swarm Sharing</h2>
                    <p className="text-sm text-gray-500">
                        {isConnected ? 'Connected' : 'Connecting...'}
                    </p>
                </div>
            </div>

            {/* Status */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">{status}</p>
                {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
            </div>

            {/* Peers Info */}
            <div className="flex gap-4 mb-4">
                <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span>{peersCount} peers</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span>{seedsCount} seeds</span>
                </div>
            </div>

            {/* Host Section */}
            {!isHosting && !isDownloading && (
                <div className="space-y-4">
                    {/* File Drop Zone */}
                    <div
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                            isDragging
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-300 hover:border-gray-400'
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                        <p className="text-gray-600 mb-2">
                            {selectedFile
                                ? selectedFile.name
                                : 'Drop file here or click to browse'}
                        </p>
                        {selectedFile && (
                            <p className="text-sm text-gray-400">
                                {formatBytes(selectedFile.size)}
                            </p>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={(e) => handleFileSelect(e.target.files)}
                        />
                        <Button
                            onClick={() => fileInputRef.current?.click()}
                            className="mt-4"
                            variant="outline"
                        >
                            Browse Files
                        </Button>
                    </div>

                    {/* Host Button */}
                    {selectedFile && (
                        <Button
                            onClick={handleHost}
                            disabled={!isConnected || isHosting}
                            className="w-full"
                        >
                            {isHosting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Hosting...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4 mr-2" />
                                    Host File
                                </>
                            )}
                        </Button>
                    )}
                </div>
            )}

            {/* Share Link Section */}
            {shareLink && (
                <div className="space-y-4 mt-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-2 text-green-700 mb-2">
                            <Lock className="w-4 h-4" />
                            <span className="text-sm font-medium">Share this link</span>
                        </div>
                        <p className="text-xs text-green-600 mb-3">
                            Include the password below for decryption
                        </p>
                        <div className="bg-white rounded p-3 font-mono text-sm break-all">
                            {shareLink}
                        </div>
                        <div className="bg-white rounded p-3 mt-2 font-mono text-sm">
                            Password: {password}
                        </div>
                        <Button
                            onClick={copyShareLink}
                            className="mt-3 w-full"
                            variant="outline"
                        >
                            {isCopied ? (
                                <>
                                    <Check className="w-4 h-4 mr-2" />
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copy Full Link
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            )}

            {/* Progress */}
            {(isHosting || isDownloading) && progress > 0 && (
                <div className="mt-4">
                    <ProgressBar value={progress} />
                    <p className="text-sm text-gray-500 mt-2 text-center">
                        {progress}% complete
                    </p>
                </div>
            )}

            {/* Download Section */}
            {!isHosting && !isDownloading && (
                <div className="mt-6 pt-6 border-t">
                    <h3 className="text-lg font-medium mb-3">Download</h3>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Paste swarm link..."
                            value={downloadLink}
                            onChange={(e) => setDownloadLink(e.target.value)}
                            className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <Button onClick={handleJoinSwarm} disabled={!isConnected}>
                            <Download className="w-4 h-4 mr-2" />
                            Join
                        </Button>
                    </div>
                </div>
            )}

            {/* Disconnect Button */}
            {isHosting && (
                <Button
                    onClick={() => {
                        swarmRef.current?.destroy();
                        setIsHosting(false);
                        setShareLink('');
                        setPassword('');
                        setProgress(0);
                        setStatus('Disconnected');
                    }}
                    className="mt-4 w-full"
                    variant="outline"
                >
                    Stop Hosting
                </Button>
            )}
        </div>
    );
}
