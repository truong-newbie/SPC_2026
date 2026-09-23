'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import SimplePeer from 'simple-peer';
import { v4 as uuidv4 } from 'uuid';
import { useSignaling } from '@/hooks/useSignaling';
import { useFileManagement } from '@/hooks/useFileManagement';
import { useRelayConfiguration } from '@/hooks/useRelayConfiguration';
import { sendFiles, sendAbortReason } from '@/lib/transfer/sender';
import { createReceiver, type ReceivedFile } from '@/lib/transfer/receiver';
import { getRoomFromUrl, buildShareLink, isValidRoomId } from '@/lib/roomLink';
import { formatBytes, formatSpeed, formatETA, downloadBlob } from '@/lib/download';
import { Button } from './Button';
import { ProgressBar } from './ProgressBar';
import { FileCard } from './FileCard';
import { Download, Upload, Copy, Check, Wifi, WifiOff, Loader2 } from 'lucide-react';

// ICE Server configuration - STUN only by default
const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

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

    // Received files
    const [receivedFiles, setReceivedFiles] = useState<(ReceivedFile & { downloadUrl: string })[]>([]);

    // Peer refs
    const peerRef = useRef<SimplePeer.Instance | null>(null);
    const channelRef = useRef<RTCDataChannel | null>(null);
    const destroyedRef = useRef(false);

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
        setError('');
        setStatus(isReceiver ? 'Reconnecting...' : 'Select files to send');
    }, [isReceiver]);

    const signaling = useSignaling({
        onSignal,
        onPeerDisconnected,
        onDisconnect,
        onConnectError,
        onReconnect,
    });

    // Create peer with initiator flag based on role
    const createPeer = useCallback((initiator: boolean) => {
        if (destroyedRef.current) return;

        const peer = new SimplePeer({
            initiator,
            trickle: true,
            config: {
                iceServers: ICE_SERVERS,
            },
        });

        peer.on('signal', (data) => {
            signaling.sendSignal({ target: null, signal: data });
        });

        peer.on('connect', () => {
            setStatus('Connected! Preparing transfer...');
            checkConnectionType(peer);
        });

        peer.on('data', (data) => {
            if (destroyedRef.current) return;
            const rx = createReceiver({
                send: (d) => peer.send(d),
                onFileStart: (index, total, fileName, fileSize) => {
                    setStatus(`Receiving file ${index + 1} of ${total}: ${fileName}`);
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
            rx.handleMessage(data);
        });

        peer.on('stream', () => {
            // Not using streams for file transfer
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

        // Get data channel once established
        peer.on('channel', (channel) => {
            channelRef.current = channel;
            channel.binaryType = 'arraybuffer';

            if (initiator && files.length > 0) {
                // Start sending files as sender
                setStatus('Sending files...');
                sendFiles(
                    {
                        send: (d) => channel.send(d),
                        onData: (h) => { channel.on('data', h); return () => channel.off('data', h); },
                        channel,
                    },
                    files.map((f) => ({ id: f.id, file: f.file })),
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
                        isDestroyed: () => destroyedRef.current,
                    }
                );
            }
        });
    }, [files, signaling]);

    // Check connection type (direct vs relay)
    const checkConnectionType = async (peer: SimplePeer.Instance) => {
        try {
            const pc = (peer as any)._pc as RTCPeerConnection;
            const stats = await pc.getStats();
            stats.forEach((report: RTCStatsReport) => {
                if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) {
                    const local = stats.get(report.localCandidateId);
                    const remote = stats.get(report.remoteCandidateId);
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

    // Handle room joined
    useEffect(() => {
        signaling.onRoomJoined(({ role }) => {
            if (destroyedRef.current) return;
            setStatus('Waiting for peer...');
            const initiator = role === 'sender';
            createPeer(initiator);
        });
    }, [signaling, createPeer]);

    // Handle user connected (sender side)
    useEffect(() => {
        signaling.onUserConnected(() => {
            if (destroyedRef.current) return;
            setStatus('Peer connected! Setting up connection...');
        });
    }, [signaling]);

    // Handle room full
    useEffect(() => {
        signaling.onRoomFull(() => {
            setError('Room is full');
            setStatus('Room full');
        });
    }, [signaling]);

    // Join room if receiver
    useEffect(() => {
        if (roomId && isReceiver && signaling.isConnected) {
            if (isValidRoomId(roomId)) {
                signaling.joinRoom(roomId);
            } else {
                setError('Invalid room ID');
            }
        }
    }, [roomId, isReceiver, signaling.isConnected, signaling.joinRoom]);

    // Generate share link
    const handleCreateLink = () => {
        if (files.length === 0) {
            setError('Please select at least one file');
            return;
        }

        const newRoomId = uuidv4();
        const nonce = uuidv4();
        const link = buildShareLink(window.location.origin, newRoomId, nonce);

        setGeneratedLink(link);
        setStatus('Waiting for receiver...');

        if (signaling.isConnected) {
            signaling.joinRoom(newRoomId);
        }
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
            {/* Header */}
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold mb-2">SPC_2026</h1>
                <p className="text-muted-foreground">
                    {isReceiver ? 'Receiving files via P2P' : 'Send files directly to another browser'}
                </p>
            </div>

            {/* Connection Status */}
            <div className="flex items-center justify-center gap-2 mb-6">
                {signaling.isConnected ? (
                    <div className="flex items-center gap-2 text-green-600">
                        <Wifi className="h-4 w-4" />
                        <span className="text-sm">Connected</span>
                        {signaling.ping > 0 && (
                            <span className="text-xs text-muted-foreground">
                                ({signaling.ping}ms)
                            </span>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-yellow-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Connecting...</span>
                    </div>
                )}
                {connectionType && (
                    <div className={`text-xs px-2 py-1 rounded ${connectionType === 'direct' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {connectionType === 'direct' ? 'Direct' : 'Relay'}
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
                        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                            isDragging
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                        }`}
                    >
                        <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-lg mb-2">Drag & drop files here</p>
                        <p className="text-sm text-muted-foreground mb-4">or</p>
                        <label>
                            <input
                                type="file"
                                multiple
                                onChange={handleFileSelection}
                                className="hidden"
                            />
                            <Button asChild>
                                <span className="cursor-pointer">Browse Files</span>
                            </Button>
                        </label>
                    </div>

                    {/* File List */}
                    {files.length > 0 && (
                        <div className="mt-6 space-y-2">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium">
                                    {files.length} file{files.length > 1 ? 's' : ''} selected
                                </span>
                                <span className="text-sm text-muted-foreground">
                                    Total: {formatBytes(totalBytes)}
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
                            <Button onClick={handleCreateLink} className="w-full mt-4" size="lg">
                                Create Secure Link
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
