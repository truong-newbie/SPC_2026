'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import SimplePeer, { Instance as PeerInstance } from 'simple-peer';

declare module 'simple-peer' {
    interface Options {
        readableObjectMode?: boolean;
    }
}

import { v4 as uuidv4 } from 'uuid';
import { useSignaling } from '@/hooks/useSignaling';
import { useFileManagement } from '@/hooks/useFileManagement';
import { useRelayConfiguration } from '@/hooks/useRelayConfiguration';
import { sendFiles } from '@/lib/transfer/sender';
import { createReceiver, type ReceivedFile } from '@/lib/transfer/receiver';
import { getRoomFromUrl, buildShareLink, isValidRoomId } from '@/lib/roomLink';
import { formatBytes, formatSpeed, formatETA, downloadBlob } from '@/lib/download';
import { DEFAULT_ICE_SERVERS, fetchIceServers, filterIceServers } from '@/lib/relay';
import { Button } from './Button';
import { ProgressBar } from './ProgressBar';
import { FileCard } from './FileCard';
import { Download, Upload, Copy, Check, Wifi, Loader2 } from 'lucide-react';

interface P2PTransferProps {
    className?: string;
}

export default function P2PTransfer({ className }: P2PTransferProps) {
    // Room and role detection
    const roomId = typeof window !== 'undefined' ? getRoomFromUrl(window.location.hash, window.location.search) : null;
    const isReceiver = Boolean(roomId);

    // Transfer state
    const [status, setStatus] = useState<string>(isReceiver ? 'Connecting...' : 'Select files to send');
    const [generatedLink, setGeneratedLink] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [progress, setProgress] = useState<number>(0);
    const [transferSpeed, setTransferSpeed] = useState<string>('');
    const [estimatedTime, setEstimatedTime] = useState<string>('');
    const [connectionType, setConnectionType] = useState<'direct' | 'relay' | null>(null);
    const [currentFileName, setCurrentFileName] = useState<string>('');
    const [isCopying, setIsCopying] = useState(false);

    // File management
    const { files, isDragging, totalBytes, handleFileSelection, handleDeleteFile, handleDragOver, handleDragLeave, handleDrop } = useFileManagement();
    const { relayEnabled } = useRelayConfiguration();
    const [rawIceServers, setRawIceServers] = useState<RTCIceServer[]>(DEFAULT_ICE_SERVERS);

    useEffect(() => {
        fetchIceServers().then(setRawIceServers).catch(() => {});
    }, []);

    const effectiveIceServers = filterIceServers(rawIceServers, relayEnabled);

    // Received files
    const [receivedFiles, setReceivedFiles] = useState<(ReceivedFile & { downloadUrl: string })[]>([]);

    // Peer refs
    const peerRef = useRef<PeerInstance | null>(null);
    const destroyedRef = useRef(false);
    const filesRef = useRef(files);
    const hasJoinedRef = useRef(false);
    const joinedRoomRef = useRef<string | null>(null);
    const createdRoomRef = useRef<string | null>(null);

    // Keep refs in sync
    useEffect(() => { filesRef.current = files; }, [files]);

    // Signaling callbacks
    const onSignal = useCallback((data: { signal: unknown }) => {
        if (peerRef.current && data.signal) {
            peerRef.current.signal(data.signal as SimplePeer.SignalData);
        }
    }, []);

    const onPeerDisconnected = useCallback(() => {
        if (!destroyedRef.current) {
            setError('Peer disconnected');
            setStatus('Connection lost');
        }
    }, []);

    const onDisconnect = useCallback(() => {
        setStatus('Disconnected from server');
    }, []);

    const onConnectError = useCallback((err: Error) => {
        setError(`Connection error: ${err.message}`);
    }, []);

    const onReconnect = useCallback(() => {
        // Reset join state so user can reconnect
        hasJoinedRef.current = false;
        joinedRoomRef.current = null;
        setError('');
        setStatus(isReceiver ? 'Reconnected. Click link again.' : 'Select files to send');
    }, [isReceiver]);

    const signaling = useSignaling({
        onSignal,
        onPeerDisconnected,
        onDisconnect,
        onConnectError,
        onReconnect,
    });

    // Check connection type (direct vs relay)
    const checkConnectionType = async (peer: PeerInstance) => {
        try {
            const pc = (peer as any)._pc as RTCPeerConnection | undefined;
            if (!pc) return;
            const stats = await pc.getStats();
            stats.forEach((report) => {
                const r = report as any;
                if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.nominated) {
                    const local = stats.get(r.localCandidateId);
                    const remote = stats.get(r.remoteCandidateId);
                    if (local?.candidateType === 'relay' || remote?.candidateType === 'relay') {
                        setConnectionType('relay');
                    } else {
                        setConnectionType('direct');
                    }
                }
            });
        } catch {
            // Ignore stats errors
        }
    };

    // Start transfer (sender side)
    const startTransfer = useCallback((userId: string) => {
        if (destroyedRef.current) return;

        // Destroy old peer if exists
        if (peerRef.current && !peerRef.current.destroyed) {
            peerRef.current.destroy();
        }

        setStatus('Peer joined. Starting transfer...');

        const peer = new SimplePeer({
            initiator: true,
            trickle: true,
            readableObjectMode: true,
            config: {
                iceServers: effectiveIceServers,
            },
        });

        peer.on('signal', (signal) => {
            signaling.sendSignal({ target: userId, signal });
        });

        peer.on('connect', () => {
            setStatus('Connected!');
            checkConnectionType(peer);

            // Start sending files
            const filesToSend = filesRef.current;
            if (filesToSend.length === 0) {
                setStatus('Connected. Waiting...');
                return;
            }

            setStatus('Sending files...');
            const peerForSender = peer;

            const channel = (peer as any)._channel as RTCDataChannel | undefined;

            sendFiles(
                {
                    send: (d: string | Uint8Array) => peerForSender.send(d),
                    onData: (h: (data: string | Uint8Array | ArrayBuffer) => void) => {
                        peerForSender.on('data', h);
                        return () => peerForSender.off('data', h);
                    },
                    channel: channel as any,
                },
                filesToSend.map((f) => ({ id: f.id, file: f.file })),
                {
                    onFileStart: (index, total, fileName) => {
                        setStatus(`Sending file ${index + 1} of ${total}: ${fileName}`);
                        setCurrentFileName(fileName);
                        setProgress(0);
                    },
                    onProgress: (percent) => setProgress(percent),
                    onSpeed: (bps, eta) => {
                        setTransferSpeed(formatSpeed(bps));
                        setEstimatedTime(formatETA(eta));
                    },
                    onSpeedReset: () => {
                        setTransferSpeed('');
                        setEstimatedTime('');
                    },
                    onAllSent: () => {
                        setProgress(100);
                        setStatus('All files sent!');
                    },
                    onError: (msg) => {
                        setError(msg);
                        setStatus('Transfer failed');
                    },
                    isDestroyed: () => destroyedRef.current || peer.destroyed,
                }
            );
        });

        peer.on('data', (data) => {
            // Sender receives ack messages
            if (destroyedRef.current) return;
        });

        peer.on('close', () => {
            if (!destroyedRef.current) {
                setError('Connection closed');
                setStatus('Connection closed');
            }
        });

        peer.on('error', (err) => {
            if (!destroyedRef.current) {
                setError(`Connection error: ${err.message}`);
                setStatus('Connection error');
            }
        });

        peerRef.current = peer;
    }, [signaling]);

    // Receiver: join room and create peer
    const joinAsReceiver = useCallback((roomId: string) => {
        if (hasJoinedRef.current) return;
        hasJoinedRef.current = true;
        joinedRoomRef.current = roomId;

        setStatus('Connecting...');

        signaling.onRoomFull(() => {
            setError('Link Expired or Busy');
            setStatus('Access Denied');
        });

        signaling.joinRoom(roomId);

        const peer = new SimplePeer({
            initiator: false,
            trickle: true,
            readableObjectMode: true,
            config: {
                iceServers: effectiveIceServers,
            },
        });

        peer.on('signal', (signal) => {
            signaling.sendSignal({ target: null, signal });
        });

        peer.on('connect', () => {
            setStatus('Connected!');
            checkConnectionType(peer);
        });

        // Receiver handles incoming data
        const rx = createReceiver({
            send: (d) => peer.send(d),
            onFileStart: (index, total, fileName, fileSize) => {
                setStatus(`Receiving file ${index} of ${total}: ${fileName}`);
                setCurrentFileName(fileName);
                setProgress(0);
            },
            onProgress: (percent) => setProgress(percent),
            onSpeed: (bps, eta) => {
                setTransferSpeed(formatSpeed(bps));
                setEstimatedTime(formatETA(eta));
            },
            onSpeedReset: () => {
                setTransferSpeed('');
                setEstimatedTime('');
            },
            onFileComplete: (file, index, total) => {
                const url = URL.createObjectURL(file.blob);
                setReceivedFiles((prev) => [...prev, { ...file, downloadUrl: url }]);
                if (index === total) {
                    setStatus('Transfer complete!');
                } else {
                    setStatus(`Waiting for next file...`);
                }
            },
            onAllComplete: () => {
                setProgress(100);
                setStatus('All files received!');
            },
            onWaiting: () => setStatus('Waiting for next file...'),
            onError: (msg) => {
                setError(msg);
                setStatus('Transfer failed');
            },
        });

        peer.on('data', (data) => {
            if (destroyedRef.current) return;
            rx.handleMessage(data);
        });

        peer.on('close', () => {
            if (!destroyedRef.current) {
                setError('Connection closed');
                setStatus('Connection closed');
            }
        });

        peer.on('error', (err) => {
            if (!destroyedRef.current) {
                setError(`Connection error: ${err.message}`);
                setStatus('Connection error');
            }
        });

        peerRef.current = peer;
    }, [signaling]);

    // Register onUserConnected handler at top level (BEFORE any joinRoom calls)
    useEffect(() => {
        signaling.onUserConnected((userId: string) => {
            startTransfer(userId);
        });
    }, [signaling, startTransfer]);

    // Receiver: mount and join room
    useEffect(() => {
        if (!roomId || !isReceiver || !signaling.isConnected) return;

        if (isValidRoomId(roomId)) {
            joinAsReceiver(roomId);
        } else {
            setError('Invalid Room ID');
        }
    }, [roomId, isReceiver, signaling.isConnected, joinAsReceiver]);

    // Generate share link (sender side)
    const handleCreateLink = () => {
        if (files.length === 0) {
            setError('Please select at least one file');
            return;
        }

        const newRoomId = uuidv4();
        const nonce = uuidv4();
        const link = buildShareLink(window.location.origin, newRoomId, nonce);

        setGeneratedLink(link);
        createdRoomRef.current = newRoomId;
        setStatus('Waiting for peer...');

        signaling.joinRoom(newRoomId);
    };

    // Copy link to clipboard
    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(generatedLink);
            setIsCopying(true);
            setTimeout(() => setIsCopying(false), 2000);
        } catch {
            setError('Failed to copy link');
        }
    };

    // Download received file
    const handleDownload = (file: ReceivedFile & { downloadUrl: string }) => {
        downloadBlob(file.blob, file.fileName);
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            destroyedRef.current = true;
            if (peerRef.current) {
                peerRef.current.destroy();
            }
            receivedFiles.forEach((f) => URL.revokeObjectURL(f.downloadUrl));
        };
    }, []);

    return (
        <div className={className}>
            {/* Receiver Notification */}
            {isReceiver && (
                <div className="text-center mb-6">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                        <Download className="w-3.5 h-3.5 text-cyan-400" />
                        Đang kết nối nhận tệp P2P trực tiếp
                    </span>
                </div>
            )}

            {/* Connection Status */}
            <div className="flex items-center justify-center gap-2 mb-6">
                {signaling.isConnected ? (
                    <div className="flex items-center gap-2 text-emerald-400">
                        <Wifi className="h-4 w-4" />
                        <span className="text-xs font-medium">Signaling Connected</span>
                        {signaling.ping > 0 && (
                            <span className="text-xs text-slate-400">
                                ({signaling.ping}ms)
                            </span>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-amber-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs">Đang kết nối signaling...</span>
                    </div>
                )}
                {connectionType && (
                    <div className={`text-xs px-2.5 py-0.5 rounded-full font-mono ${connectionType === 'direct' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                        {connectionType === 'direct' ? 'Direct P2P' : 'Relay TURN'}
                    </div>
                )}
            </div>

            {/* Error Display */}
            {error && (
                <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                    {error}
                </div>
            )}

            {/* Sender Panel */}
            {!isReceiver && !generatedLink && (
                <div className="max-w-2xl mx-auto">
                    {/* File Drop Zone */}
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
                            isDragging
                                ? 'border-cyan-400 bg-cyan-950/20 shadow-glow'
                                : 'border-cyan-500/30 hover:border-cyan-400 bg-cyan-950/5 hover:bg-cyan-950/15'
                        }`}
                    >
                        <Upload className="h-12 w-12 mx-auto mb-3 text-cyan-400" />
                        <p className="text-base font-bold text-white mb-1">Kéo thả tập tin vào đây hoặc nhấn duyệt file</p>
                        <p className="text-xs text-slate-400 mb-4">Hỗ trợ truyền đa file đồng thời. Không nén, bảo toàn 100% chất lượng gốc.</p>
                        <label>
                            <input
                                type="file"
                                multiple
                                onChange={handleFileSelection}
                                className="hidden"
                            />
                            <Button asChild className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-glow">
                                <span className="cursor-pointer">Duyệt tập tin</span>
                            </Button>
                        </label>
                    </div>

                    {/* File List */}
                    {files.length > 0 && (
                        <div className="mt-6 space-y-2">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium">
                                    {files.length} file{files.length > 1 ? 's' : ''} đã chọn
                                </span>
                                <span className="text-sm text-slate-400">
                                    Tổng: {formatBytes(totalBytes)}
                                </span>
                            </div>
                            {files.map((f) => (
                                <FileCard
                                    key={f.id}
                                    id={f.id}
                                    file={f.file}
                                    onDelete={handleDeleteFile}
                                />
                            ))}
                            <Button onClick={handleCreateLink} className="w-full mt-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white shadow-glow hover:opacity-95" size="lg">
                                Tạo liên kết chia sẻ bảo mật (P2P)
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Generated Link Panel */}
            {!isReceiver && generatedLink && (
                <div className="max-w-2xl mx-auto">
                    <div className="bg-card border rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <Check className="h-5 w-5 text-green-600" />
                            <span className="font-medium">Link ready!</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                            Share this link with the receiver. The room ID is hidden in the URL fragment
                            and never sent to our server.
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={generatedLink}
                                readOnly
                                className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono truncate"
                            />
                            <Button onClick={handleCopyLink} variant="outline">
                                {isCopying ? (
                                    <Check className="h-4 w-4" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Transfer Status */}
                    <div className="mt-6 bg-card border rounded-xl p-6 shadow-sm">
                        <p className="text-center text-lg mb-4">{status}</p>
                        {progress > 0 && (
                            <>
                                <ProgressBar value={progress} className="mb-2" />
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span>{currentFileName}</span>
                                    <span>{progress}%</span>
                                </div>
                                {transferSpeed && (
                                    <div className="flex justify-between text-sm text-muted-foreground mt-1">
                                        <span>{transferSpeed}</span>
                                        <span>{estimatedTime}</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Receiver Panel */}
            {isReceiver && (
                <div className="max-w-2xl mx-auto">
                    <div className="bg-card border rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <Download className="h-5 w-5 text-primary" />
                            <span className="font-medium">Receiving Files</span>
                        </div>
                        <p className="text-center text-lg mb-4">{status}</p>

                        {progress > 0 && (
                            <>
                                <ProgressBar value={progress} className="mb-2" />
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span className="truncate">{currentFileName}</span>
                                    <span>{progress}%</span>
                                </div>
                                {transferSpeed && (
                                    <div className="flex justify-between text-sm text-muted-foreground mt-1">
                                        <span>{transferSpeed}</span>
                                        <span>{estimatedTime}</span>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Received Files */}
                        {receivedFiles.length > 0 && (
                            <div className="mt-6 space-y-2">
                                <h3 className="font-medium">Received Files</h3>
                                {receivedFiles.map((f) => (
                                    <div key={f.id} className="flex items-center justify-between bg-muted rounded-lg p-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="truncate text-sm font-medium">{f.fileName}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatBytes(f.fileSize)}
                                            </p>
                                        </div>
                                        <Button onClick={() => handleDownload(f)} variant="outline" size="sm">
                                            Download
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
