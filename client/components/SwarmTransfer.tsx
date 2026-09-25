'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { SwarmManager, packFiles, unpackFiles, type UnpackedFile, type PackedFileInfo } from '@/lib/swarm';
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
    Search,
    Trash2,
    Files,
    Eye,
} from 'lucide-react';

interface SwarmTransferProps {
    className?: string;
    socketUrl?: string;
}

interface SwarmFileInfo {
    fileId: string;
    name: string;
    size: number;
    totalPieces: number;
}

export default function SwarmTransfer({ className, socketUrl }: SwarmTransferProps) {
    // Connection state
    const [isConnected, setIsConnected] = useState(false);
    const [isHosting, setIsHosting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    // Host state
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [hostedFiles, setHostedFiles] = useState<PackedFileInfo[]>([]);
    const [hostedTotalSize, setHostedTotalSize] = useState<number>(0);
    const [shareLink, setShareLink] = useState('');
    const [password, setPassword] = useState('');

    // Preview state (Receiver)
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [previewFileInfo, setPreviewFileInfo] = useState<SwarmFileInfo | null>(null);

    // Download state (Receiver)
    const [downloadLink, setDownloadLink] = useState('');
    const [downloadFileInfo, setDownloadFileInfo] = useState<SwarmFileInfo | null>(null);
    const [unpackedFiles, setUnpackedFiles] = useState<UnpackedFile[]>([]);
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

    // Auto-detect ?swarm= in URL and enter PREVIEW MODE (Never auto-download!)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const swarmParam = params.get('swarm');
            if (swarmParam) {
                setDownloadLink(window.location.href);

                const name = params.get('name');
                const size = parseInt(params.get('size') || '0', 10);
                const pieces = parseInt(params.get('pieces') || '0', 10);

                if (name && size > 0) {
                    setPreviewFileInfo({
                        fileId: swarmParam,
                        name: decodeURIComponent(name),
                        size,
                        totalPieces: pieces || Math.ceil(size / (512 * 1024)),
                    });
                    setIsPreviewing(true);
                    setStatus('Previewing shared file(s)');
                } else {
                    // Pre-fetch from server REST API
                    fetch(`${serverUrl}/api/swarm/${swarmParam}`)
                        .then((res) => res.json())
                        .then((data) => {
                            if (data && data.fileId) {
                                setPreviewFileInfo({
                                    fileId: data.fileId,
                                    name: data.fileName || 'Shared Files',
                                    size: data.fileSize || 0,
                                    totalPieces: data.totalPieces || 1,
                                });
                                setIsPreviewing(true);
                                setStatus('Previewing shared file(s)');
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
            setStatus('Connected - Select files to host or enter a link to download');
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
            setStatus('Disconnected from server');
        });

        socket.on('connect_error', () => {
            setError('Connection failed. Server may be offline.');
        });

        // Swarm tracker events
        socket.on('swarm-info', (info: any) => {
            if (info) {
                if (typeof info.peerCount === 'number') {
                    setPeersCount(info.peerCount);
                }
                if (typeof info.seedCount === 'number') {
                    setSeedsCount(info.seedCount);
                }
                if (info.fileName || info.fileSize) {
                    setDownloadFileInfo((prev) =>
                        prev
                            ? {
                                  ...prev,
                                  name: info.fileName || prev.name,
                                  size: info.fileSize || prev.size,
                                  totalPieces: info.totalPieces || prev.totalPieces,
                              }
                            : null
                    );
                    setPreviewFileInfo((prev) =>
                        prev
                            ? {
                                  ...prev,
                                  name: info.fileName || prev.name,
                                  size: info.fileSize || prev.size,
                                  totalPieces: info.totalPieces || prev.totalPieces,
                              }
                            : null
                    );
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
            socket.off('signal');
            swarmRef.current?.destroy();
            socket.disconnect();
        };
    }, [serverUrl]);

    // Handle file selection (multi-file)
    const handleFileSelect = useCallback((files: FileList | null) => {
        if (!files || files.length === 0) return;
        const incoming = Array.from(files);
        setSelectedFiles((prev) => {
            // Filter duplicates by name + size
            const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}`));
            const novel = incoming.filter((f) => !existingKeys.has(`${f.name}-${f.size}`));
            return [...prev, ...novel];
        });
        setError('');
    }, []);

    // Remove single file
    const handleRemoveFile = useCallback((index: number) => {
        setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    }, []);

    // Clear all files
    const handleClearFiles = useCallback(() => {
        setSelectedFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    // Drag and drop handlers
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

    // Start hosting selected file(s)
    const handleHost = useCallback(async () => {
        if (selectedFiles.length === 0 || !socketRef.current) return;

        setIsHosting(true);
        setStatus('Packing files for swarm...');
        setError('');

        try {
            // 1. Pack files into container bundle (or single raw file)
            const { buffer, totalSize, displayName, files } = await packFiles(selectedFiles);
            setHostedFiles(files);
            setHostedTotalSize(totalSize);

            const fileId = uuidv4();
            const totalPieces = Math.ceil(totalSize / (512 * 1024));

            const currentIceServers = iceServers.length > 0 ? iceServers : await fetchIceServers(serverUrl);

            // 2. Create SwarmManager
            const swarm = new SwarmManager(
                {
                    fileId,
                    fileName: displayName,
                    fileSize: totalSize,
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
                    onError: (e) => {
                        console.warn('[Swarm Host Warning]:', e);
                    },
                }
            );

            // Immediately set ref so incoming signals are processed
            swarmRef.current = swarm;

            const pw = swarm.generatePassword();

            // 3. Create swarm on server tracker with metadata
            socketRef.current.emit('create-swarm', {
                fileId,
                totalPieces,
                fileName: displayName,
                fileSize: totalSize,
            });

            // 4. Join swarm room
            socketRef.current.emit('join-swarm', { fileId });

            // 5. Start seeding pieces
            await swarm.startSeeding(buffer);

            // 6. Generate shareable link
            const link = `${window.location.origin}?swarm=${fileId}&name=${encodeURIComponent(displayName)}&size=${totalSize}&pieces=${totalPieces}`;
            setShareLink(link);
            setPassword(pw);
            setProgress(100);
            setStatus(`Seeding ${selectedFiles.length} file(s) to swarm`);

        } catch (err: any) {
            console.error('Hosting failed:', err);
            setError(`Failed to host: ${err?.message || err}`);
            setIsHosting(false);
        }
    }, [selectedFiles, serverUrl, iceServers]);

    // Preview link before downloading (triggered by user typing/pasting link)
    const handleTriggerPreview = useCallback(async () => {
        if (!downloadLink.trim()) return;

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

        // Query server tracker if size/name missing
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

        const decodedFileName = decodeURIComponent(fileName || 'Shared File(s)');
        const piecesCount = totalPieces || (fileSize > 0 ? Math.ceil(fileSize / (512 * 1024)) : 1);

        setPreviewFileInfo({
            fileId,
            name: decodedFileName,
            size: fileSize,
            totalPieces: piecesCount,
        });

        setIsPreviewing(true);
        setStatus('Previewing shared file(s) - click "Download Now" to start');
        setError('');
    }, [downloadLink, serverUrl]);

    // Cancel preview
    const handleCancelPreview = useCallback(() => {
        setIsPreviewing(false);
        setPreviewFileInfo(null);
        setStatus('Select files to host or enter a link to download');
    }, []);

    // User confirms preview -> Start downloading!
    const handleStartDownload = useCallback(async () => {
        if (!previewFileInfo || !socketRef.current) return;

        const info = previewFileInfo;
        setDownloadFileInfo(info);
        setIsDownloading(true);
        setIsPreviewing(false);
        setProgress(0);
        setUnpackedFiles([]);
        setDownloadedBlob(null);
        setDownloadUrl(null);
        setStatus('Connecting to swarm peers...');
        setError('');

        const currentIceServers = iceServers.length > 0 ? iceServers : await fetchIceServers(serverUrl);

        const swarm = new SwarmManager(
            {
                fileId: info.fileId,
                fileName: info.name,
                fileSize: info.size || 1,
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
                onError: (e) => {
                    console.warn('[Swarm Download Warning]:', e);
                },
                onComplete: async (blob) => {
                    try {
                        const buffer = await blob.arrayBuffer();
                        const files = unpackFiles(buffer, info.name);
                        setUnpackedFiles(files);

                        const mainUrl = URL.createObjectURL(blob);
                        setDownloadedBlob(blob);
                        setDownloadUrl(mainUrl);
                        setProgress(100);
                        setStatus('Download complete! Save your files below.');

                        // Auto-download if single file
                        if (files.length === 1) {
                            const a = document.createElement('a');
                            a.href = mainUrl;
                            a.download = files[0].name;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                        }
                    } catch (err) {
                        console.error('Unpack error:', err);
                        setStatus('Download complete (auto-save ready)');
                    }
                },
            }
        );

        swarmRef.current = swarm;

        // Join swarm room on tracker
        if (socketRef.current?.connected) {
            socketRef.current.emit('join-swarm', { fileId: info.fileId });
        } else {
            socketRef.current?.once('connect', () => {
                socketRef.current?.emit('join-swarm', { fileId: info.fileId });
            });
        }

        swarm.startDownloading();
    }, [previewFileInfo, serverUrl, iceServers]);

    // Save individual file from unpacked list
    const handleSaveFile = useCallback((file: UnpackedFile) => {
        const url = URL.createObjectURL(file.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 30000);
    }, []);

    // Save all files sequentially
    const handleSaveAllFiles = useCallback(() => {
        if (unpackedFiles.length === 0) return;
        unpackedFiles.forEach((file, index) => {
            setTimeout(() => {
                handleSaveFile(file);
            }, index * 250);
        });
    }, [unpackedFiles, handleSaveFile]);

    // Copy share link
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
        setHostedFiles([]);
        setHostedTotalSize(0);
        setShareLink('');
        setPassword('');
        setSelectedFiles([]);
        setProgress(0);
        setStatus('Stopped hosting');
    }, []);

    // Cancel download
    const handleCancelDownload = useCallback(() => {
        swarmRef.current?.destroy();
        swarmRef.current = null;
        setIsDownloading(false);
        setIsPreviewing(false);
        setDownloadFileInfo(null);
        setPreviewFileInfo(null);
        setUnpackedFiles([]);
        setDownloadedBlob(null);
        if (downloadUrl) {
            URL.revokeObjectURL(downloadUrl);
            setDownloadUrl(null);
        }
        setProgress(0);
        setStatus('Download cancelled');
    }, [downloadUrl]);

    const totalSelectedBytes = selectedFiles.reduce((sum, f) => sum + f.size, 0);

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
                            P2P multi-peer transfer • Multi-file support
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
                        <span className="truncate max-w-xs">{status}</span>
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
                                {progress === 100 ? 'Download Finished' : 'Transfer Progress'}
                            </span>
                            <span className="font-bold text-blue-600">{progress}%</span>
                        </div>
                        <ProgressBar value={progress} />
                        <div className="flex justify-between text-xs text-gray-500 pt-1">
                            <span>
                                {downloadFileInfo?.totalPieces
                                    ? `${Math.round((progress / 100) * downloadFileInfo.totalPieces)} / ${downloadFileInfo.totalPieces} pieces`
                                    : ''}
                            </span>
                            <span>{seedsCount > 0 ? `${seedsCount} seeder(s) active` : 'Searching for seeds...'}</span>
                        </div>
                    </div>

                    {/* Unpacked Files List (When multi-file download completes) */}
                    {unpackedFiles.length > 0 && (
                        <div className="space-y-3 pt-3 border-t border-gray-200">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                    <Files className="w-4 h-4 text-blue-600" />
                                    Received Files ({unpackedFiles.length}):
                                </h4>
                                {unpackedFiles.length > 1 && (
                                    <Button
                                        onClick={handleSaveAllFiles}
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700 text-white text-xs px-3"
                                    >
                                        <ArrowDownToLine className="w-3.5 h-3.5 mr-1" />
                                        Save All Files
                                    </Button>
                                )}
                            </div>

                            <div className="space-y-2 max-h-56 overflow-y-auto">
                                {unpackedFiles.map((file, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
                                                <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                                            </div>
                                        </div>
                                        <Button
                                            onClick={() => handleSaveFile(file)}
                                            size="sm"
                                            className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 ml-3"
                                        >
                                            <Download className="w-3.5 h-3.5 mr-1" />
                                            Save
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Single File Save Button (Fallback) */}
                    {unpackedFiles.length === 0 && downloadUrl && (
                        <a
                            href={downloadUrl}
                            download={downloadFileInfo?.name || 'downloaded-file'}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors shadow-sm"
                        >
                            <ArrowDownToLine className="w-5 h-5" />
                            Save File to Computer
                        </a>
                    )}

                    <div className="pt-2">
                        <Button
                            onClick={handleCancelDownload}
                            variant="outline"
                            className="w-full text-gray-700"
                        >
                            {progress === 100 ? 'Leave Swarm' : 'Cancel Download'}
                        </Button>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* VIEW 2: ACTIVE HOSTER PANEL                              */}
            {/* ======================================================== */}
            {isHosting && (
                <div className="space-y-6">
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-green-100 text-green-700 rounded-xl">
                                    {hostedFiles.length > 1 ? <Files className="w-7 h-7" /> : <FileText className="w-7 h-7" />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 break-all">
                                        {hostedFiles.length > 1
                                            ? `${hostedFiles.length} files (${formatBytes(hostedTotalSize)})`
                                            : selectedFiles[0]?.name}
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        Seeding to swarm • Sharing with peers
                                    </p>
                                </div>
                            </div>
                            <span className="flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                                Seeding Active
                            </span>
                        </div>

                        {/* List of files being hosted */}
                        {hostedFiles.length > 1 && (
                            <div className="mb-4 space-y-1.5 max-h-40 overflow-y-auto bg-white/70 p-3 rounded-xl border border-green-200">
                                {hostedFiles.map((file, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs">
                                        <span className="font-medium text-gray-800 truncate mr-2">{file.name}</span>
                                        <span className="text-gray-500 shrink-0">{formatBytes(file.size)}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Share link box */}
                        {shareLink && (
                            <div className="space-y-3 mt-4 pt-4 border-t border-green-200">
                                <div className="flex items-center gap-2 text-green-800 text-sm font-semibold">
                                    <Lock className="w-4 h-4" />
                                    <span>Share this link for others to preview & download:</span>
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
            {/* VIEW 3: PREVIEW MODE (Before Downloading)                */}
            {/* ======================================================== */}
            {isPreviewing && previewFileInfo && !isDownloading && !isHosting && (
                <div className="bg-white border-2 border-blue-300 rounded-2xl p-6 shadow-sm space-y-6">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                                <Eye className="w-8 h-8" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded uppercase tracking-wider">
                                        File Preview
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mt-1 break-all">
                                    {previewFileInfo.name}
                                </h3>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    {previewFileInfo.size ? formatBytes(previewFileInfo.size) : 'Unknown size'} • {previewFileInfo.totalPieces} pieces
                                </p>
                            </div>
                        </div>
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                            <span className="w-2 h-2 bg-green-500 rounded-full" />
                            {seedsCount > 0 ? `${seedsCount} Seeds Available` : 'Swarm Active'}
                        </span>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-600 space-y-1 border border-gray-200">
                        <p className="font-medium text-gray-800">Ready to download via P2P Swarm?</p>
                        <p className="text-xs text-gray-500">
                            Files will be transferred in pieces directly from active seeders in the room.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            onClick={handleStartDownload}
                            disabled={!isConnected}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 text-base font-semibold"
                        >
                            <Download className="w-5 h-5 mr-2" />
                            Download Now
                        </Button>
                        <Button
                            onClick={handleCancelPreview}
                            variant="outline"
                            className="text-gray-700 px-5"
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* VIEW 4: INITIAL SCREEN (Upload Multiple Files or Link)   */}
            {/* ======================================================== */}
            {!isHosting && !isDownloading && !isPreviewing && (
                <div className="space-y-6">
                    {/* Host section: Multi-file Drop Zone */}
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
                            {selectedFiles.length > 0
                                ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected`
                                : 'Drop file(s) here to host on Swarm'}
                        </p>
                        <p className="text-sm text-gray-500">
                            {selectedFiles.length > 0
                                ? `${formatBytes(totalSelectedBytes)} total`
                                : 'or click to browse from device (multi-file supported)'}
                        </p>

                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => handleFileSelect(e.target.files)}
                        />

                        {/* Selected files list */}
                        {selectedFiles.length > 0 && (
                            <div className="mt-4 space-y-2 max-h-48 overflow-y-auto text-left">
                                {selectedFiles.map((file, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-200"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                            <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-semibold text-gray-900 truncate">{file.name}</p>
                                                <p className="text-[11px] text-gray-500">{formatBytes(file.size)}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveFile(idx);
                                            }}
                                            className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                                            title="Remove file"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedFiles.length > 0 && (
                            <div className="mt-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                                <Button
                                    onClick={handleHost}
                                    disabled={!isConnected || isHosting}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                                >
                                    <Upload className="w-4 h-4 mr-2" />
                                    Start Hosting {selectedFiles.length} File{selectedFiles.length > 1 ? 's' : ''} ({formatBytes(totalSelectedBytes)})
                                </Button>
                                <Button
                                    onClick={handleClearFiles}
                                    variant="outline"
                                    className="text-gray-600 hover:text-red-600"
                                >
                                    Clear
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Download section: Input Swarm Link / ID */}
                    <div className="pt-6 border-t border-gray-200">
                        <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Download className="w-4 h-4 text-blue-600" />
                            Download from Swarm
                        </h3>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Paste swarm share link or swarm room ID..."
                                value={downloadLink}
                                onChange={(e) => setDownloadLink(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleTriggerPreview();
                                }}
                                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                            <Button
                                onClick={handleTriggerPreview}
                                disabled={!isConnected || !downloadLink.trim()}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-5"
                            >
                                <Search className="w-4 h-4 mr-2" />
                                Preview
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
