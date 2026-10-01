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
import { getRoomFromUrl, buildShareLink, isValidRoomId, extractRoomId } from '@/lib/roomLink';
import { formatBytes, formatSpeed, formatETA, downloadBlob } from '@/lib/download';
import { DEFAULT_ICE_SERVERS, fetchIceServers, filterIceServers } from '@/lib/relay';
import { soundManager } from '@/lib/audio';
import { requestNotificationPermission, sendTransferNotification } from '@/lib/notification';
import { formatHashShort } from '@/lib/crypto/checksum';
import { QRScannerModal } from './QRScannerModal';
import { QRCodeSVG } from 'qrcode.react';
import { SpeedWaveform } from './SpeedWaveform';
import { Button } from './Button';
import { ProgressBar } from './ProgressBar';
import { FileCard } from './FileCard';
import { FileIcon } from './FileIcon';
import {
    Download,
    Upload,
    Copy,
    Check,
    Wifi,
    Loader2,
    Volume2,
    VolumeX,
    QrCode,
    Camera,
    ShieldCheck,
    AlertTriangle,
    Share2,
    Zap,
    Shield,
    X,
    Plus,
    RotateCcw,
    Archive,
} from 'lucide-react';
import { createZip, generateZipFilename, shouldZipAll, type ZipProgress } from '@/lib/zipManager';

interface P2PTransferProps {
    className?: string;
}

export default function P2PTransfer({ className }: P2PTransferProps) {
    // Room and role detection with reactive hash listener
    const [activeRoomId, setActiveRoomId] = useState<string | null>(() => {
        return typeof window !== 'undefined' ? getRoomFromUrl(window.location.hash, window.location.search) : null;
    });
    const isReceiver = Boolean(activeRoomId);

    // Transfer state
    const [status, setStatus] = useState<string>(isReceiver ? 'Đang kết nối vào phòng...' : 'Chọn tệp để bắt đầu gửi');
    const [generatedLink, setGeneratedLink] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [progress, setProgress] = useState<number>(0);
    const [transferSpeed, setTransferSpeed] = useState<string>('');
    const [estimatedTime, setEstimatedTime] = useState<string>('');
    const [currentBps, setCurrentBps] = useState<number>(0);
    const [connectionType, setConnectionType] = useState<'direct' | 'relay' | null>(null);
    const [currentFileName, setCurrentFileName] = useState<string>('');
    const [isCopying, setIsCopying] = useState(false);

    // Audio & QR & Notification state
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [showSenderQR, setShowSenderQR] = useState(false);
    const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
    const [manualRoomInput, setManualRoomInput] = useState('');

    useEffect(() => {
        setSoundEnabled(soundManager.isEnabled());

        const handleHashChange = () => {
            const id = getRoomFromUrl(window.location.hash, window.location.search);
            setActiveRoomId(id);
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // Dynamic Tab Title during transfer
    useEffect(() => {
        if (typeof document === 'undefined') return;
        if (progress > 0 && progress < 100) {
            const fileLabel = currentFileName ? ` ${currentFileName}` : '';
            const speedLabel = transferSpeed ? ` (${transferSpeed})` : '';
            document.title = `[${Math.round(progress)}%] Đang truyền${fileLabel}${speedLabel} — FileBridge`;
        } else if (progress === 100) {
            document.title = `[Hoàn thành] Đã truyền tệp xong — FileBridge`;
        } else {
            document.title = 'FileBridge — Truyền tệp P2P & Lưu trữ E2EE Zero-Knowledge (SPC 2026)';
        }
    }, [progress, currentFileName, transferSpeed]);

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

    // ZIP all received files
    const [isZipping, setIsZipping] = useState(false);
    const [zipProgress, setZipProgress] = useState<ZipProgress | null>(null);
    const [zipError, setZipError] = useState<string | null>(null);

    const handleZipAllFiles = useCallback(async () => {
        const validFiles = receivedFiles.filter((f) => f.blob);
        if (validFiles.length === 0) return;

        const totalBytes = validFiles.reduce((sum, f) => sum + (f.fileSize || f.blob?.size || 0), 0);
        const check = shouldZipAll(totalBytes);

        if (!check.canZip) {
            alert(check.reason + '. Vui lòng tải từng tệp riêng lẻ để tránh tràn bộ nhớ.');
            return;
        }

        setIsZipping(true);
        setZipProgress(null);
        setZipError(null);

        try {
            const filesToZip = validFiles.map((f) => ({ name: f.fileName, blob: f.blob! }));
            const zipFilename = generateZipFilename(activeRoomId || undefined);

            const zipBlob = await createZip(filesToZip, {
                filename: zipFilename,
                onProgress: (progress) => {
                    setZipProgress(progress);
                },
            });

            downloadBlob(zipBlob, zipFilename);
        } catch (err) {
            console.error('Lỗi đóng gói ZIP:', err);
            setZipError('Không thể tạo file ZIP: ' + (err instanceof Error ? err.message : 'Lỗi không xác định'));
        } finally {
            setIsZipping(false);
            setZipProgress(null);
        }
    }, [receivedFiles, activeRoomId]);

    // Peer refs
    const peerRef = useRef<PeerInstance | null>(null);
    const destroyedRef = useRef(false);
    const filesRef = useRef(files);
    const hasJoinedRef = useRef(false);
    const joinedRoomRef = useRef<string | null>(null);
    const createdRoomRef = useRef<string | null>(null);
    const isSendingRef = useRef(false);
    const sentFileIdsRef = useRef<Set<string>>(new Set());
    const [isSending, setIsSending] = useState(false);

    // Send any pending/newly added files over WebRTC DataChannel
    const sendPendingFiles = useCallback(() => {
        if (!peerRef.current || peerRef.current.destroyed || isSendingRef.current) return;
        const peerInstance = peerRef.current;
        const channel = (peerInstance as any)._channel as RTCDataChannel | undefined;
        if (!channel || channel.readyState !== 'open') return;

        const currentFiles = filesRef.current;
        const pending = currentFiles.filter((f) => !sentFileIdsRef.current.has(f.id));
        if (pending.length === 0) return;

        isSendingRef.current = true;
        setIsSending(true);
        setStatus(`Đang gửi ${pending.length} tệp qua P2P...`);

        sendFiles(
            {
                send: (d: string | Uint8Array) => peerInstance.send(d),
                onData: (h: (data: string | Uint8Array | ArrayBuffer) => void) => {
                    peerInstance.on('data', h);
                    return () => peerInstance.off('data', h);
                },
                channel: channel as any,
            },
            pending.map((f) => ({ id: f.id, file: f.file })),
            {
                onFileStart: (index, total, fileName) => {
                    setStatus(`Đang gửi tệp ${index + 1}/${total}: ${fileName}`);
                    setCurrentFileName(fileName);
                    setProgress(0);
                },
                onProgress: (percent) => setProgress(percent),
                onSpeed: (bps, eta) => {
                    setCurrentBps(bps);
                    setTransferSpeed(formatSpeed(bps));
                    setEstimatedTime(formatETA(eta));
                },
                onSpeedReset: () => {
                    setCurrentBps(0);
                    setTransferSpeed('');
                    setEstimatedTime('');
                },
                onAllSent: () => {
                    pending.forEach((f) => sentFileIdsRef.current.add(f.id));
                    isSendingRef.current = false;
                    setIsSending(false);
                    setProgress(100);
                    setStatus('Đã gửi toàn bộ tệp thành công!');
                    soundManager.playSuccess();
                    sendTransferNotification(
                        'Đã gửi tệp thành công!',
                        'Tất cả tệp đã được chuyển an toàn qua WebRTC P2P.'
                    );
                    setTimeout(() => {
                        const remaining = filesRef.current.filter((f) => !sentFileIdsRef.current.has(f.id));
                        if (remaining.length > 0) {
                            sendPendingFiles();
                        }
                    }, 400);
                },
                onError: (msg) => {
                    isSendingRef.current = false;
                    setIsSending(false);
                    setError(msg);
                    setStatus('Quá trình truyền tệp thất bại');
                },
                isDestroyed: () => destroyedRef.current || peerInstance.destroyed,
            }
        );
    }, []);

    // Keep refs in sync and send newly added files if peer is already connected
    useEffect(() => {
        filesRef.current = files;
        if (peerRef.current && !peerRef.current.destroyed && !isSendingRef.current) {
            const channel = (peerRef.current as any)._channel as RTCDataChannel | undefined;
            if (channel && channel.readyState === 'open') {
                sendPendingFiles();
            }
        }
    }, [files, sendPendingFiles]);

    // Signaling callbacks
    const onSignal = useCallback((data: { signal: unknown }) => {
        if (peerRef.current && data.signal) {
            peerRef.current.signal(data.signal as SimplePeer.SignalData);
        }
    }, []);

    const onPeerDisconnected = useCallback(() => {
        if (!destroyedRef.current) {
            setError('Thiết bị đối tác đã ngắt kết nối');
            setStatus('Mất kết nối P2P');
        }
    }, []);

    const onDisconnect = useCallback(() => {
        setStatus('Đã ngắt kết nối máy chủ signaling');
    }, []);

    const onConnectError = useCallback((err: Error) => {
        setError(`Lỗi kết nối signaling: ${err.message}`);
    }, []);

    const onReconnect = useCallback(() => {
        // Reset join state so user can reconnect
        hasJoinedRef.current = false;
        joinedRoomRef.current = null;
        setError('');
        setStatus(isReceiver ? 'Đã kết nối lại signaling. Vui lòng thử lại.' : 'Chọn tệp để bắt đầu gửi');
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

        setStatus('Người nhận đã tham gia. Đang khởi tạo kết nối P2P...');

        const peer = new SimplePeer({
            initiator: true,
            trickle: true,
            readableObjectMode: true,
            config: {
                iceServers: effectiveIceServers,
            },
        });

        peerRef.current = peer;

        peer.on('signal', (signal) => {
            signaling.sendSignal({ target: userId, signal });
        });

        peer.on('connect', () => {
            setStatus('Đã kết nối P2P thành công!');
            checkConnectionType(peer);

            // Start sending files
            if (filesRef.current.length === 0) {
                setStatus('Đã kết nối P2P! Vui lòng chọn tệp để bắt đầu gửi...');
                return;
            }

            sendPendingFiles();
        });

        peer.on('data', (data) => {
            // Sender receives ack messages
            if (destroyedRef.current) return;
        });

        peer.on('close', () => {
            if (!destroyedRef.current) {
                setError('Đã đóng kết nối');
                setStatus('Đã đóng kết nối');
            }
        });

        peer.on('error', (err) => {
            if (!destroyedRef.current) {
                setError(`Lỗi kết nối P2P: ${err.message}`);
                setStatus('Lỗi kết nối P2P');
            }
        });

        peerRef.current = peer;
    }, [signaling, effectiveIceServers]);

    // Receiver: join room and create peer
    const joinAsReceiver = useCallback((roomId: string) => {
        if (hasJoinedRef.current) return;
        hasJoinedRef.current = true;
        joinedRoomRef.current = roomId;

        setStatus('Đang kết nối vào phòng...');

        signaling.onRoomFull(() => {
            setError('Liên kết phòng đã hết hạn hoặc đang bận');
            setStatus('Từ chối truy cập');
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
            setStatus('Đã kết nối P2P thành công!');
            checkConnectionType(peer);
        });

        // Receiver handles incoming data
        const rx = createReceiver({
            send: (d) => peer.send(d),
            onFileStart: (index, total, fileName, fileSize) => {
                setStatus(`Đang nhận tệp ${index}/${total}: ${fileName}`);
                setCurrentFileName(fileName);
                setProgress(0);
            },
            onProgress: (percent) => setProgress(percent),
            onSpeed: (bps, eta) => {
                setCurrentBps(bps);
                setTransferSpeed(formatSpeed(bps));
                setEstimatedTime(formatETA(eta));
            },
            onSpeedReset: () => {
                setCurrentBps(0);
                setTransferSpeed('');
                setEstimatedTime('');
            },
            onFileComplete: (file, index, total) => {
                const url = URL.createObjectURL(file.blob);
                setReceivedFiles((prev) => [...prev, { ...file, downloadUrl: url }]);
                soundManager.playSuccess();
                sendTransferNotification(
                    'Đã nhận tệp thành công!',
                    `${file.fileName} (${formatBytes(file.fileSize)}) đã được chuyển xong.`
                );
                if (index === total) {
                    setStatus('Hoàn tất nhận tệp!');
                } else {
                    setStatus('Đang chờ tệp tiếp theo...');
                }
            },
            onAllComplete: () => {
                setProgress(100);
                setStatus('Đã nhận toàn bộ tệp!');
                soundManager.playSuccess();
                sendTransferNotification(
                    'Hoàn tất nhận tệp!',
                    'Toàn bộ các tệp đã được nhận và kiểm tra toàn vẹn SHA-256 thành công.'
                );
            },
            onWaiting: () => setStatus('Đang chờ tệp tiếp theo...'),
            onError: (msg) => {
                setError(msg);
                setStatus('Nhận tệp thất bại');
            },
        });

        peer.on('data', (data) => {
            if (destroyedRef.current) return;
            rx.handleMessage(data);
        });

        peer.on('close', () => {
            if (!destroyedRef.current) {
                setError('Đã đóng kết nối');
                setStatus('Đã đóng kết nối');
            }
        });

        peer.on('error', (err) => {
            if (!destroyedRef.current) {
                setError(`Lỗi kết nối WebRTC: ${err.message}`);
                setStatus('Lỗi kết nối');
            }
        });

        peerRef.current = peer;
    }, [signaling, effectiveIceServers]);

    // Register onUserConnected handler at top level (BEFORE any joinRoom calls)
    useEffect(() => {
        signaling.onUserConnected((userId: string) => {
            startTransfer(userId);
        });
    }, [signaling, startTransfer]);

    // Receiver: mount and join room
    useEffect(() => {
        if (!activeRoomId || !isReceiver || !signaling.isConnected) return;

        if (isValidRoomId(activeRoomId)) {
            requestNotificationPermission();
            joinAsReceiver(activeRoomId);
        } else {
            setError('Mã phòng không hợp lệ');
        }
    }, [activeRoomId, isReceiver, signaling.isConnected, joinAsReceiver]);

    // Reset session (sender side)
    const handleResetSession = () => {
        if (peerRef.current && !peerRef.current.destroyed) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
        setGeneratedLink('');
        setStatus('Chọn tệp để bắt đầu gửi');
        setProgress(0);
        setCurrentFileName('');
        setCurrentBps(0);
        setTransferSpeed('');
        setEstimatedTime('');
        sentFileIdsRef.current.clear();
        isSendingRef.current = false;
        setIsSending(false);
        createdRoomRef.current = null;
        hasJoinedRef.current = false;
        joinedRoomRef.current = null;
    };

    // Generate share link (sender side)
    const handleCreateLink = () => {
        requestNotificationPermission();

        const newRoomId = uuidv4();
        const nonce = uuidv4();
        const link = buildShareLink(window.location.origin, newRoomId, nonce);

        setGeneratedLink(link);
        createdRoomRef.current = newRoomId;
        setStatus(files.length > 0 ? 'Đang chờ người nhận kết nối...' : 'Phòng chia sẻ đã tạo! Thêm tệp để gửi...');

        signaling.joinRoom(newRoomId);
    };

    // Manual connect or QR scan handler
    const handleManualConnect = () => {
        const extractedId = extractRoomId(manualRoomInput);
        if (!extractedId) {
            setError('Mã phòng hoặc liên kết không hợp lệ. Vui lòng kiểm tra lại.');
            return;
        }
        setError('');
        window.location.href = `${window.location.origin}/#room=${extractedId}`;
        window.location.reload();
    };

    const handleScanSuccess = (scannedText: string) => {
        const extractedId = extractRoomId(scannedText);
        if (extractedId) {
            setError('');
            window.location.href = `${window.location.origin}/#room=${extractedId}`;
            window.location.reload();
        } else {
            setError('Mã QR không chứa mã phòng FileBridge hợp lệ.');
        }
    };

    // Copy link to clipboard
    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(generatedLink);
            setIsCopying(true);
            setTimeout(() => setIsCopying(false), 2000);
        } catch {
            setError('Không thể sao chép liên kết vào clipboard');
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
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        <Download className="w-3.5 h-3.5 text-blue-600" />
                        Đang kết nối nhận tệp P2P trực tiếp
                    </span>
                </div>
            )}

            {/* Status & Controls Bar */}
            <div className="flex items-center justify-between max-w-2xl mx-auto mb-6 px-1">
                <div className="flex items-center gap-2">
                    {signaling.isConnected ? (
                        <div className="flex items-center gap-1.5 text-emerald-600">
                            <Wifi className="h-4 w-4" />
                            <span className="text-xs font-semibold">Signaling sẵn sàng</span>
                            {signaling.ping > 0 && (
                                <span className="text-[11px] text-slate-500 font-mono">
                                    ({signaling.ping}ms)
                                </span>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-amber-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-xs font-medium">Đang kết nối signaling...</span>
                        </div>
                    )}
                    {connectionType && (
                        <span
                            className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-medium shadow-xs ${
                                connectionType === 'direct'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                            title={
                                connectionType === 'direct'
                                    ? 'Kết nối ngang hàng P2P trực tiếp (Không qua máy chủ trung gian, tốc độ tối đa theo mạng nội bộ/Internet).'
                                    : 'Chuyển tiếp qua máy chủ TURN Relay (Tự động kích hoạt để xuyên tường lửa 4G/LTE hoặc NAT đối xứng. Tệp được mã hóa đầu-cuối an toàn 100%).'
                            }
                        >
                            {connectionType === 'direct' ? (
                                <>
                                    <Zap className="w-3 h-3 text-emerald-600" />
                                    <span>P2P Trực tiếp</span>
                                </>
                            ) : (
                                <>
                                    <Shield className="w-3 h-3 text-blue-600" />
                                    <span>Chuyển tiếp TURN (4G/NAT)</span>
                                </>
                            )}
                        </span>
                    )}
                </div>

                {/* Controls: Quick QR Scanner & Sound Toggle */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsQRScannerOpen(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors shadow-xs"
                        title="Quét mã QR để nhận tệp"
                    >
                        <Camera className="w-3.5 h-3.5 text-blue-600" />
                        <span className="hidden sm:inline">Quét QR</span>
                    </button>
                    <button
                        onClick={() => {
                            const next = soundManager.toggleSound();
                            setSoundEnabled(next);
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-xs"
                        title={soundEnabled ? 'Âm báo đang bật (Click để tắt)' : 'Âm báo đang tắt (Click để bật)'}
                    >
                        {soundEnabled ? (
                            <Volume2 className="w-4 h-4 text-blue-600" />
                        ) : (
                            <VolumeX className="w-4 h-4 text-slate-400" />
                        )}
                    </button>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs sm:text-sm font-medium flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-2 p-1 rounded-md hover:bg-red-100 transition-colors" title="Đóng">
                        <X className="w-4 h-4" />
                    </button>
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
                        className={`border-2 border-dashed rounded-3xl p-8 sm:p-14 text-center transition-all cursor-pointer ${
                            isDragging
                                ? 'border-blue-500 bg-blue-50/80 shadow-md'
                                : 'border-blue-200 hover:border-blue-500 bg-gradient-to-b from-blue-50/30 to-indigo-50/20 hover:bg-blue-50/70'
                        }`}
                    >
                        <Upload className="h-12 w-12 mx-auto mb-3 text-blue-600" />
                        <p className="text-base sm:text-lg font-bold text-slate-800 mb-1">Kéo thả tập tin vào đây hoặc nhấn duyệt file</p>
                        <p className="text-xs sm:text-sm text-slate-500 mb-4">Hỗ trợ truyền đa file đồng thời. Tính toán SHA-256 bảo toàn toàn vẹn dữ liệu gốc.</p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <label>
                                <input
                                    type="file"
                                    multiple
                                    onChange={handleFileSelection}
                                    className="hidden"
                                />
                                <Button asChild className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md">
                                    <span className="cursor-pointer">Duyệt tập tin</span>
                                </Button>
                            </label>
                            <Button
                                variant="outline"
                                onClick={handleCreateLink}
                                className="border-slate-200 text-slate-700 hover:text-blue-600 hover:bg-white text-xs font-semibold"
                            >
                                Tạo phòng trước, thêm tệp sau →
                            </Button>
                        </div>
                    </div>

                    {/* File List */}
                    {files.length > 0 && (
                        <div className="mt-6 space-y-2">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-bold text-slate-800">
                                    {files.length} file{files.length > 1 ? 's' : ''} đã chọn
                                </span>
                                <span className="text-sm text-slate-500 font-medium">
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
                            <Button onClick={handleCreateLink} className="w-full mt-4 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-glow-btn hover:opacity-95" size="lg">
                                Tạo liên kết chia sẻ bảo mật (P2P)
                            </Button>
                        </div>
                    )}

                    {/* Join room / QR Scanner option */}
                    <div className="mt-8 pt-6 border-t border-slate-200">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-blue-50/60 border border-blue-100 rounded-2xl p-4">
                            <div className="text-left w-full sm:w-auto">
                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                    <Download className="w-3.5 h-3.5 text-blue-600" />
                                    Bạn muốn nhận tệp từ thiết bị khác?
                                </h4>
                                <p className="text-xs text-slate-500 mt-0.5">Dán mã phòng, liên kết hoặc quét mã QR bằng camera.</p>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <input
                                    type="text"
                                    placeholder="Mã phòng hoặc link..."
                                    value={manualRoomInput}
                                    onChange={(e) => setManualRoomInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleManualConnect()}
                                    className="flex-1 sm:w-44 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-700"
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsQRScannerOpen(true)}
                                    className="bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shrink-0 text-xs gap-1"
                                    title="Quét mã QR bằng Camera"
                                >
                                    <Camera className="w-3.5 h-3.5 text-blue-600" />
                                    <span className="hidden sm:inline">Quét</span>
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleManualConnect}
                                    disabled={!manualRoomInput.trim()}
                                    className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 text-xs"
                                >
                                    Nhận
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Generated Link Panel */}
            {!isReceiver && generatedLink && (
                <div className="max-w-2xl mx-auto space-y-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Check className="h-5 w-5 text-emerald-600" />
                                <span className="font-bold text-slate-800">Liên kết chia sẻ đã sẵn sàng!</span>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowSenderQR(!showSenderQR)}
                                className="gap-1.5 text-xs text-slate-700 border-slate-200 hover:bg-slate-50"
                            >
                                <QrCode className="w-3.5 h-3.5 text-blue-600" />
                                {showSenderQR ? 'Ẩn mã QR' : 'Hiện mã QR'}
                            </Button>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">
                            Gửi liên kết này cho người nhận hoặc cho họ quét mã QR. Mã phòng được lưu trong URL fragment, không bao giờ gửi đến máy chủ.
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={generatedLink}
                                readOnly
                                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 truncate"
                            />
                            <Button onClick={handleCopyLink} variant="outline" className="shrink-0 gap-1.5">
                                {isCopying ? (
                                    <>
                                        <Check className="h-4 w-4 text-emerald-600" />
                                        <span className="text-xs text-emerald-600">Đã chép</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-4 w-4" />
                                        <span className="text-xs">Sao chép</span>
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Inline QR Code Display */}
                        {showSenderQR && (
                            <div className="mt-5 p-5 bg-gradient-to-b from-slate-50 to-blue-50/30 border border-blue-100 rounded-2xl flex flex-col items-center justify-center gap-2 animate-in fade-in duration-200">
                                <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200">
                                    <QRCodeSVG value={generatedLink} size={180} level="M" />
                                </div>
                                <span className="text-xs font-medium text-slate-600 mt-2">
                                    Người nhận dùng Camera điện thoại hoặc tính năng "Quét QR" trên FileBridge để kết nối tức thì
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Transfer Status */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <p className="text-center font-semibold text-slate-800 mb-4">{status}</p>
                        {progress > 0 && (
                            <>
                                <ProgressBar value={progress} className="mb-2" />
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span className="truncate max-w-[240px] font-medium text-slate-700">{currentFileName}</span>
                                    <span className="font-bold text-blue-600">{progress}%</span>
                                </div>
                                {transferSpeed && (
                                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                                        <span>Tốc độ: <strong className="text-slate-700">{transferSpeed}</strong></span>
                                        <span>Ước tính: <strong className="text-slate-700">{estimatedTime}</strong></span>
                                    </div>
                                )}
                                <SpeedWaveform currentBps={currentBps} isActive={progress > 0 && progress < 100} isComplete={progress === 100} />
                            </>
                        )}
                    </div>

                    {/* Active Files Management in Session */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                            <div>
                                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                    <span>Tệp đang chia sẻ</span>
                                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-mono font-bold border border-blue-200/80">
                                        {files.length} {files.length > 1 ? 'tệp' : 'tệp'}
                                    </span>
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Tổng dung lượng: <strong className="text-slate-700">{formatBytes(totalBytes)}</strong>
                                </p>
                            </div>

                            {/* Add More Files Button */}
                            <label className="shrink-0">
                                <input
                                    type="file"
                                    multiple
                                    onChange={handleFileSelection}
                                    className="hidden"
                                    disabled={isSending}
                                />
                                <Button
                                    asChild
                                    size="sm"
                                    disabled={isSending}
                                    className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-xs cursor-pointer text-xs font-semibold px-3 py-1.5"
                                >
                                    <span>
                                        <Plus className="w-3.5 h-3.5" />
                                        Thêm tệp
                                    </span>
                                </Button>
                            </label>
                        </div>

                        {/* Drop zone to add more files */}
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
                                isDragging
                                    ? 'border-blue-500 bg-blue-50/80 shadow-xs'
                                    : 'border-slate-200 hover:border-blue-300 bg-slate-50/60 hover:bg-blue-50/30'
                            }`}
                        >
                            <label className="flex items-center justify-center gap-2 text-xs text-slate-600 cursor-pointer">
                                <input
                                    type="file"
                                    multiple
                                    onChange={handleFileSelection}
                                    className="hidden"
                                    disabled={isSending}
                                />
                                <Upload className="w-4 h-4 text-blue-600" />
                                <span>
                                    Kéo thả thêm tệp vào đây hoặc{' '}
                                    <strong className="text-blue-600 hover:underline">duyệt từ máy</strong>
                                </span>
                            </label>
                        </div>

                        {/* List of files with FileCard */}
                        {files.length > 0 ? (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {files.map((f) => (
                                    <FileCard
                                        key={f.id}
                                        id={f.id}
                                        file={f.file}
                                        onDelete={handleDeleteFile}
                                        showDelete={!isSending}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="py-6 text-center text-xs text-slate-400">
                                Chưa có tệp nào được chọn. Nhấn <strong>+ Thêm tệp</strong> hoặc kéo thả file vào khung trên.
                            </div>
                        )}
                    </div>

                    {/* Reset Session Button */}
                    <div className="text-center pt-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleResetSession}
                            className="text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 gap-1.5 transition-colors"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Đóng phòng & Tạo phiên mới
                        </Button>
                    </div>
                </div>
            )}

            {/* Receiver Panel */}
            {isReceiver && (
                <div className="max-w-2xl mx-auto space-y-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Download className="h-5 w-5 text-blue-600" />
                                <span className="font-bold text-slate-800">Đang nhận tệp P2P</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                <span>Xác thực SHA-256</span>
                            </div>
                        </div>
                        <p className="text-center font-semibold text-slate-800 mb-4">{status}</p>

                        {progress > 0 && (
                            <>
                                <ProgressBar value={progress} className="mb-2" />
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span className="truncate max-w-[240px] font-medium text-slate-700">{currentFileName}</span>
                                    <span className="font-bold text-blue-600">{progress}%</span>
                                </div>
                                {transferSpeed && (
                                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                                        <span>Tốc độ: <strong className="text-slate-700">{transferSpeed}</strong></span>
                                        <span>Ước tính: <strong className="text-slate-700">{estimatedTime}</strong></span>
                                    </div>
                                )}
                                <SpeedWaveform currentBps={currentBps} isActive={progress > 0 && progress < 100} isComplete={progress === 100} />
                            </>
                        )}

                        {/* Received Files with SHA-256 Badges */}
                        {receivedFiles.length > 0 && (
                            <div className="mt-6 space-y-3">
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div>
                                        <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                            <span>Tệp đã nhận ({receivedFiles.length})</span>
                                            <span className="text-xs font-normal text-slate-500">
                                                ({formatBytes(receivedFiles.reduce((sum, f) => sum + (f.fileSize || f.blob?.size || 0), 0))})
                                            </span>
                                        </h3>
                                        <span className="text-[11px] font-normal text-slate-400">Toàn vẹn mật mã SHA-256</span>
                                    </div>
                                    {receivedFiles.length >= 2 && (
                                        <Button
                                            type="button"
                                            onClick={handleZipAllFiles}
                                            disabled={isZipping}
                                            size="sm"
                                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 shadow-xs gap-1.5"
                                        >
                                            {isZipping ? (
                                                <>
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    <span>Đang nén {zipProgress ? `${zipProgress.percent}%` : '...'}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Archive className="w-3.5 h-3.5" />
                                                    <span>Tải toàn bộ (.zip)</span>
                                                </>
                                            )}
                                        </Button>
                                    )}
                                </div>
                                {zipError && (
                                    <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                                        {zipError}
                                    </p>
                                )}
                                {receivedFiles.map((f) => (
                                    <div key={f.id} className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 space-y-2.5 transition-all hover:bg-slate-50">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <FileIcon fileName={f.fileName} mimeType={f.blob?.type} size="md" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="truncate text-sm font-semibold text-slate-800">{f.fileName}</p>
                                                    <p className="text-xs text-slate-500 font-medium">{formatBytes(f.fileSize)}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <Button
                                                    asChild
                                                    size="sm"
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
                                                >
                                                    <a
                                                        href={f.downloadUrl}
                                                        download={f.fileName}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                        Tải về
                                                    </a>
                                                </Button>
                                                {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleDownload(f)}
                                                        className="px-2.5 text-slate-700 hover:text-blue-600 hover:bg-blue-50 border-slate-200"
                                                        title="Lưu hoặc chia sẻ sang ứng dụng khác (Zalo, Tệp, Photos...)"
                                                    >
                                                        <Share2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {/* SHA-256 Integrity Verification Badge */}
                                        {f.checksum && (
                                            <div className="flex items-center flex-wrap gap-2 pt-1 border-t border-slate-200/60 text-xs font-mono">
                                                {f.checksumVerified === true ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-medium border border-emerald-300">
                                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                        SHA-256: {formatHashShort(f.checksum)} (Toàn vẹn 100%)
                                                    </span>
                                                ) : f.checksumVerified === false ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 text-red-800 font-medium border border-red-300">
                                                        <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                                        Cảnh báo SHA-256 không khớp!
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                                        SHA-256: {formatHashShort(f.checksum)}
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        if (f.checksum) {
                                                            navigator.clipboard.writeText(f.checksum);
                                                        }
                                                    }}
                                                    className="text-slate-400 hover:text-slate-700 text-[11px] underline ml-auto cursor-pointer"
                                                    title={`Sao chép mã SHA-256: ${f.checksum}`}
                                                >
                                                    Sao chép hash
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Live Camera QR Code Scanner Modal */}
            <QRScannerModal
                isOpen={isQRScannerOpen}
                onClose={() => setIsQRScannerOpen(false)}
                onScan={handleScanSuccess}
            />
        </div>
    );
}
