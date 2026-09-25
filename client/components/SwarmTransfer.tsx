'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { SwarmManager } from '@/lib/swarm';
import { formatBytes } from '@/lib/download';
import { fetchIceServers } from '@/lib/relay';
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
    FileText,
    CheckCircle2,
    XCircle,
    ArrowDownToLine,
    RefreshCw,
    Radio,
} from 'lucide-react';

interface SwarmTransferProps {
    className?: string;
    socketUrl?: string;
}

interface DownloadFileInfo {
    name: string;
    size: number;
    totalPieces: number;
}

export default function SwarmTransfer({ className, socketUrl }: SwarmTransferProps) {
    // Connection state
    const [isConnected, setIsConnected] = useState(false);
    const [isHosting, setIsHosting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    // File state (Host)
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [shareLink, setShareLink] = useState('');
    const [password, setPassword] = useState('');

    // Download state (Receiver)
    const [downloadLink, setDownloadLink] = useState('');
    const [downloadFileInfo, setDownloadFileInfo] = useState<DownloadFileInfo | null>(null);
    const [downloadedBlob, setDownloadedBlob] = useState<Blob | null>(null);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

    // Progress state
    const [progress, setProgress] = useState(0);
    const [peersCount, setPeersCount] = useState(0);
    const [seedsCount, setSeedsCount] = useState(0);
    const [status, setStatus] = useState('Connect to start');
    const [error, setError] = useState('');

    // UI state
    const [isCopied, setIsCopied] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [iceServers, setIceServers] = useState<RTCIceServer[]>([]);

    // Refs
    const socketRef = useRef<Socket | null>(null);
    const swarmRef = useRef<SwarmManager | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const serverUrl = socketUrl || process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

    // Auto-populate downloadLink if swarm parameter is in URL
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const swarmParam = params.get('swarm');
            if (swarmParam) {
                setDownloadLink(window.location.href);

                // Pre-fetch file info if available
                const name = params.get('name');
                const size = parseInt(params.get('size') || '0', 10);
                const pieces = parseInt(params.get('pieces') || '0', 10);

                if (name && size > 0) {
                    setDownloadFileInfo({
                        name: decodeURIComponent(name),
                        size,
                        totalPieces: pieces || Math.ceil(size / (512 * 1024)),
                    });
                } else {
                    // Try fetch from server API
                    fetch(`${serverUrl}/api/swarm/${swarmParam}`)
                        .then((res) => res.json())
                        .then((data) => {
                            if (data && data.fileName) {
                                setDownloadFileInfo({
                                    name: data.fileName,
                                    size: data.fileSize || 0,
                                    totalPieces: data.totalPieces || 1,
                                });
                            }
                        })
                        .catch(() => {});
                }
            }
        }
    }, [serverUrl]);

    // Initialize socket connection & ICE servers
    useEffect(() => {
        const url = serverUrl;

        fetchIceServers(url)
            .then((servers) => setIceServers(servers))
            .catch(() => {});

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
            if (info) {
                if (info.fileName || info.fileSize) {
                    setDownloadFileInfo((prev) => ({
                        name: info.fileName || prev?.name || 'downloaded-file',
                        size: info.fileSize || prev?.size || 0,
                        totalPieces: info.totalPieces || prev?.totalPieces || 1,
                    }));
                }
                if (typeof info.peerCount === 'number') {
                    setPeersCount(info.peerCount);
                }
                if (typeof info.seedCount === 'number') {
                    setSeedsCount(info.seedCount);
                }
            }
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

        socket.on('signal', ({ signal, sender }: { signal: any; sender: string }) => {
            if (swarmRef.current && sender && signal) {
                swarmRef.current.handleSignal(sender, signal);
            }
        });

        socketRef.current = socket;

        return () => {
            socket.off('swarm-info');
            socket.off('peer-joined');
            socket.off('peer-left');
            socket.off('peer-pieces');
            socket.off('piece-available');
            socket.off('signal');
            swarmRef.current?.destroy();
            socket.disconnect();
        };
    }, [serverUrl]);

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
            const totalPieces = Math.ceil(selectedFile.size / (512 * 1024));

            const currentIceServers = iceServers.length > 0 ? iceServers : await fetchIceServers(serverUrl);

            // Create swarm manager
            const swarm = new SwarmManager(
                {
                    fileId,
                    fileName: selectedFile.name,
                    fileSize: selectedFile.size,
                    iceServers: currentIceServers,
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

            // Assign swarmRef IMMEDIATELY so any incoming events are processed
            swarmRef.current = swarm;

            // Generate password
            const pw = swarm.generatePassword();

            // 1. Create swarm on server with metadata (fileName & fileSize)
            socketRef.current.emit('create-swarm', {
                fileId,
                totalPieces,
                fileName: selectedFile.name,
                fileSize: selectedFile.size,
            });

            // 2. Join swarm as seeder BEFORE announcing pieces
            socketRef.current.emit('join-swarm', { fileId });

            // 3. Start seeding (splits file into memory and announces pieces)
            await swarm.startSeeding(fileData);

            // Create share link with file info
            const link = `${window.location.origin}?swarm=${fileId}&name=${encodeURIComponent(selectedFile.name)}&size=${selectedFile.size}&pieces=${totalPieces}`;
            setShareLink(link);
            setPassword(pw);
            setProgress(100);
            setStatus(`Seeding: ${selectedFile.name} (${totalPieces} pieces)`);

        } catch (err) {
            console.error('Host error:', err);
            setError('Failed to host file');
            setIsHosting(false);
        }
    }, [selectedFile, serverUrl, iceServers]);

    // Join swarm (download)
    const handleJoinSwarm = useCallback(async () => {
        if (!downloadLink || !socketRef.current) return;

        // Extract file info from link or raw UUID
        let fileId: string | null = null;
        let fileName = '';
        let fileSize = 0;
        let totalPieces = 0;

        try {
            const url = new URL(downloadLink, window.location.origin);
            fileId = url.searchParams.get('swarm');
            fileName = url.searchParams.get('name') || '';
            fileSize = parseInt(url.searchParams.get('size') || '0', 10);
            totalPieces = parseInt(url.searchParams.get('pieces') || '0', 10);
        } catch {
            // Check if user entered raw UUID
            const trimmed = downloadLink.trim();
            if (/^[0-9a-fA-F-]{36}$/.test(trimmed)) {
                fileId = trimmed;
            }
        }

        if (!fileId) {
            const trimmed = downloadLink.trim();
            if (/^[0-9a-fA-F-]{36}$/.test(trimmed)) {
                fileId = trimmed;
            } else {
                setError('Invalid swarm link or ID');
                return;
            }
        }

        // If metadata is missing in URL, query server tracker
        if (!fileName || fileSize === 0) {
            try {
                const res = await fetch(`${serverUrl}/api/swarm/${fileId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.fileName) fileName = data.fileName;
                    if (data.fileSize) fileSize = data.fileSize;
                    if (data.totalPieces) totalPieces = data.totalPieces;
                }
            } catch {}
        }

        const decodedFileName = decodeURIComponent(fileName || 'downloaded-file');
        const calculatedPieces = totalPieces || (fileSize > 0 ? Math.ceil(fileSize / (512 * 1024)) : 1);

        setDownloadFileInfo({
            name: decodedFileName,
            size: fileSize,
            totalPieces: calculatedPieces,
        });

        setIsDownloading(true);
        setProgress(0);
        setDownloadedBlob(null);
        setDownloadUrl(null);
        setStatus('Connecting to swarm...');
        setError('');

        const currentIceServers = iceServers.length > 0 ? iceServers : await fetchIceServers(serverUrl);

        // Create swarm manager with file info
        const swarm = new SwarmManager(
            {
                fileId,
                fileName: decodedFileName,
                fileSize: fileSize || 1,
                iceServers: currentIceServers,
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
                    const url = URL.createObjectURL(blob);
                    setDownloadedBlob(blob);
                    setDownloadUrl(url);
                    setProgress(100);
                    setStatus('Download complete! Click button below to save.');

                    // Trigger browser download
                    try {
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = decodedFileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                    } catch {}
                },
            }
        );

        // Assign swarmRef IMMEDIATELY
        swarmRef.current = swarm;

        // Join swarm on server
        if (socketRef.current?.connected) {
            socketRef.current.emit('join-swarm', { fileId });
        } else {
            socketRef.current?.once('connect', () => {
                socketRef.current?.emit('join-swarm', { fileId });
            });
        }

        swarm.startDownloading();

    }, [downloadLink, serverUrl, iceServers]);

    // Copy to clipboard
    const copyShareLink = useCallback(() => {
        const fullLink = shareLink + (password ? `#${password}` : '');
        navigator.clipboard.writeText(fullLink);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    }, [shareLink, password]);

    // Stop hosting
    const handleStopHosting = useCallback(() => {
        swarmRef.current?.destroy();
        swarmRef.current = null;
        setIsHosting(false);
        setShareLink('');
        setPassword('');
        setProgress(0);
        setStatus('Stopped hosting');
    }, []);

    // Cancel download
    const handleCancelDownload = useCallback(() => {
        swarmRef.current?.destroy();
        swarmRef.current = null;
        setIsDownloading(false);
        setDownloadFileInfo(null);
        setDownloadedBlob(null);
        if (downloadUrl) {
            URL.revokeObjectURL(downloadUrl);
            setDownloadUrl(null);
        }
        setProgress(0);
        setStatus('Download cancelled');
    }, [downloadUrl]);

    return (
        <div className={`p-6 max-w-2xl mx-auto ${className || ''}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-100 rounded-xl">
                        <Share2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Swarm File Sharing</h2>
                        <p className="text-sm text-gray-500">
                            P2P BitTorrent-style multi-peer transfer
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
                    {isConnected ? 'Server Online' : 'Connecting...'}
                </div>
            </div>

            {/* Status & Peer Counters Bar */}
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 font-medium text-gray-700">
                        <Radio className="w-4 h-4 text-blue-500 animate-pulse" />
                        <span>{status}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm font-semibold">
                        <div className="flex items-center gap-1.5 text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                            <Users className="w-4 h-4" />
                            <span>{peersCount} peers</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-green-700 bg-green-50 px-2.5 py-1 rounded-lg">
                            <span className="w-2 h-2 bg-green-500 rounded-full" />
                            <span>{seedsCount} seeds</span>
                        </div>
                    </div>
                </div>
                {error && (
                    <div className="flex items-center gap-2 text-sm text-red-600 pt-2 border-t border-gray-200">
                        <XCircle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}
            </div>

            {/* ======================================================== */}
            {/* VIEW 1: ACTIVE DOWNLOADER PANEL                          */}
            {/* ======================================================== */}
            {isDownloading && (
                <div className="space-y-6 bg-white border border-blue-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                <FileText className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 break-all">
                                    {downloadFileInfo?.name || 'File in Swarm'}
                                </h3>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    {downloadFileInfo?.size ? formatBytes(downloadFileInfo.size) : 'Detecting size...'} • {downloadFileInfo?.totalPieces || 1} pieces
                                </p>
                            </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            progress === 100
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-100 text-blue-700 animate-pulse'
                        }`}>
                            {progress === 100 ? 'Downloaded' : 'Downloading'}
                        </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="font-medium text-gray-700">
                                {progress === 100 ? 'Complete' : 'Transfer Progress'}
                            </span>
                            <span className="font-bold text-blue-600">{progress}%</span>
                        </div>
                        <ProgressBar value={progress} />
                        <div className="flex justify-between text-xs text-gray-500 pt-1">
                            <span>
                                {downloadFileInfo?.totalPieces ? `${Math.round((progress / 100) * downloadFileInfo.totalPieces)} / ${downloadFileInfo.totalPieces} pieces` : ''}
                            </span>
                            <span>{seedsCount > 0 ? `${seedsCount} seeder(s) active` : 'Waiting for seeder...'}</span>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="space-y-3 pt-2">
                        {downloadUrl && (
                            <a
                                href={downloadUrl}
                                download={downloadFileInfo?.name || 'downloaded-file'}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors shadow-sm"
                            >
                                <ArrowDownToLine className="w-5 h-5" />
                                Save File to Computer
                            </a>
                        )}

                        <div className="flex gap-3">
                            <Button
                                onClick={handleCancelDownload}
                                variant="outline"
                                className="w-full text-gray-700"
                            >
                                {progress === 100 ? 'Leave Swarm' : 'Cancel Download'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* VIEW 2: ACTIVE HOSTER PANEL                              */}
            {/* ======================================================== */}
            {isHosting && (
                <div className="space-y-6">
                    {/* File Seeding Info */}
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-green-100 text-green-700 rounded-xl">
                                    <FileText className="w-7 h-7" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 break-all">{selectedFile?.name}</h3>
                                    <p className="text-sm text-gray-600">
                                        {selectedFile ? formatBytes(selectedFile.size) : ''} • Seeding to swarm
                                    </p>
                                </div>
                            </div>
                            <span className="flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                                Seeding Active
                            </span>
                        </div>

                        {/* Share link box */}
                        {shareLink && (
                            <div className="space-y-3 mt-4 pt-4 border-t border-green-200">
                                <div className="flex items-center gap-2 text-green-800 text-sm font-semibold">
                                    <Lock className="w-4 h-4" />
                                    <span>Share this link to let others download:</span>
                                </div>
                                <div className="bg-white rounded-lg p-3 font-mono text-xs text-gray-800 border border-green-200 break-all select-all">
                                    {shareLink}
                                </div>
                                {password && (
                                    <div className="text-xs text-green-800 font-medium">
                                        Password: <span className="font-mono bg-white px-2 py-0.5 rounded border border-green-200">{password}</span>
                                    </div>
                                )}
                                <Button
                                    onClick={copyShareLink}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                                >
                                    {isCopied ? (
                                        <>
                                            <Check className="w-4 h-4 mr-2" />
                                            Copied to Clipboard!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-4 h-4 mr-2" />
                                            Copy Share Link
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>

                    <Button
                        onClick={handleStopHosting}
                        className="w-full text-red-600 border-red-200 hover:bg-red-50"
                        variant="outline"
                    >
                        Stop Hosting
                    </Button>
                </div>
            )}

            {/* ======================================================== */}
            {/* VIEW 3: INITIAL SCREEN (Drop File or Paste Link)         */}
            {/* ======================================================== */}
            {!isHosting && !isDownloading && (
                <div className="space-y-6">
                    {/* Host section: Drop Zone */}
                    <div
                        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer ${
                            isDragging
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-300 hover:border-blue-400 bg-white'
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload className="w-12 h-12 mx-auto text-blue-500 mb-3" />
                        <p className="font-semibold text-gray-800 mb-1">
                            {selectedFile ? selectedFile.name : 'Drop file here to host on Swarm'}
                        </p>
                        <p className="text-sm text-gray-500">
                            {selectedFile ? formatBytes(selectedFile.size) : 'or click to browse from device'}
                        </p>

                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={(e) => handleFileSelect(e.target.files)}
                        />

                        {selectedFile && (
                            <Button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleHost();
                                }}
                                disabled={!isConnected || isHosting}
                                className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                <Upload className="w-4 h-4 mr-2" />
                                Start Hosting This File
                            </Button>
                        )}
                    </div>

                    {/* Download section: Paste Link */}
                    <div className="pt-6 border-t border-gray-200">
                        <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Download className="w-4 h-4 text-blue-600" />
                            Download from Swarm
                        </h3>

                        {/* If preview info was fetched from URL, show it */}
                        {downloadFileInfo && downloadFileInfo.name && (
                            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <FileText className="w-5 h-5 text-blue-600" />
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">{downloadFileInfo.name}</p>
                                        <p className="text-xs text-gray-500">{downloadFileInfo.size ? formatBytes(downloadFileInfo.size) : 'Unknown size'}</p>
                                    </div>
                                </div>
                                <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-1 rounded">Ready to Join</span>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Paste swarm share link or swarm ID..."
                                value={downloadLink}
                                onChange={(e) => setDownloadLink(e.target.value)}
                                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                            <Button
                                onClick={handleJoinSwarm}
                                disabled={!isConnected || !downloadLink.trim()}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-5"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Join & Download
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
