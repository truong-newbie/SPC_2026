'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { QRCodeSVG } from 'qrcode.react';
import {
    Upload,
    Download,
    Copy,
    Check,
    Lock,
    Unlock,
    ShieldCheck,
    Trash2,
    RefreshCw,
    FileText,
    Files,
    AlertCircle,
    Clock,
    Flame,
    Eye,
    EyeOff,
    ArrowLeft,
    CheckCircle2,
    Loader2,
    ExternalLink,
    HardDrive,
    Key,
} from 'lucide-react';
import { Button } from './Button';
import { ProgressBar } from './ProgressBar';
import { formatBytes, downloadBlob } from '@/lib/download';
import { packFiles, unpackFiles, type UnpackedFile } from '@/lib/swarm/pack';
import {
    encryptData,
    decryptData,
    generateSecurePassword,
} from '@/lib/crypto/e2ee';

interface StoredTransferProps {
    className?: string;
}

interface StoredMetadata {
    fileId: string;
    fileName: string;
    fileSize: number;
    cipherSize: number;
    salt: string;
    iv: string;
    uploadedAt: number;
    expiresAt: number;
    maxDownloads: number;
    downloadCount: number;
    burnAfterReading: boolean;
}

const MAX_STORAGE_BYTES = 500 * 1024 * 1024; // 500 MB

function getApiBaseUrl(): string {
    if (typeof window !== 'undefined') {
        const envUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
        if (envUrl && envUrl.startsWith('http')) return envUrl;
        return `${window.location.protocol}//${window.location.hostname}:3001`;
    }
    return 'http://localhost:3001';
}

export default function StoredTransfer({ className }: StoredTransferProps) {
    // ---------------------------------------------------------------------------
    // Mode & Receiver Params Detection
    // ---------------------------------------------------------------------------
    const [receiverFileId, setReceiverFileId] = useState<string | null>(null);
    const [receiverHashKey, setReceiverHashKey] = useState<string>('');

    // Receiver State
    const [previewMeta, setPreviewMeta] = useState<StoredMetadata | null>(null);
    const [isLoadingMeta, setIsLoadingMeta] = useState(false);
    const [metaError, setMetaError] = useState<string>('');
    const [receiverPassword, setReceiverPassword] = useState('');
    const [showReceiverPassword, setShowReceiverPassword] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [downloadStatus, setDownloadStatus] = useState('');
    const [downloadError, setDownloadError] = useState('');
    const [downloadedFiles, setDownloadedFiles] = useState<UnpackedFile[]>([]);
    const [isBurned, setIsBurned] = useState(false);

    // Sender State
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [ttlHours, setTtlHours] = useState<number>(24);
    const [burnAfterReading, setBurnAfterReading] = useState<boolean>(false);
    const [senderPassword, setSenderPassword] = useState<string>('');
    const [showSenderPassword, setShowSenderPassword] = useState(false);

    // Sender Upload Progress State
    const [isUploading, setIsUploading] = useState(false);
    const [uploadPhase, setUploadPhase] = useState<string>(''); // 'packing' | 'encrypting' | 'uploading'
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [uploadError, setUploadError] = useState<string>('');

    // Sender Upload Success State
    const [uploadResult, setUploadResult] = useState<{
        fileId: string;
        fileName: string;
        cipherSize: number;
        password: string;
        expiresAt: number;
        burnAfterReading: boolean;
        shareLink: string;
    } | null>(null);

    // Copy Feedback
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedPass, setCopiedPass] = useState(false);

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Initialize default password for sender
    useEffect(() => {
        setSenderPassword(generateSecurePassword(16));
    }, []);

    // Detect URL params for Receiver
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const storedId = params.get('stored');
        const hash = window.location.hash ? window.location.hash.slice(1) : '';

        if (storedId) {
            setReceiverFileId(storedId);
            if (hash) {
                setReceiverHashKey(hash);
                setReceiverPassword(hash);
            }
            fetchMetadata(storedId);
        }
    }, []);

    // Fetch metadata for receiver preview
    const fetchMetadata = async (fileId: string) => {
        setIsLoadingMeta(true);
        setMetaError('');
        try {
            const apiBase = getApiBaseUrl();
            const res = await fetch(`${apiBase}/api/temp-storage/meta/${fileId}`);
            if (!res.ok) {
                if (res.status === 404) {
                    throw new Error('File không tồn tại, đã hết thời gian lưu trữ hoặc đã tự hủy sau khi tải.');
                }
                throw new Error(`Máy chủ trả về lỗi (${res.status})`);
            }
            const data: StoredMetadata = await res.json();
            setPreviewMeta(data);
        } catch (err: any) {
            setMetaError(err.message || 'Không thể lấy thông tin file từ máy chủ');
        } finally {
            setIsLoadingMeta(false);
        }
    };

    // ---------------------------------------------------------------------------
    // Sender File Handling
    // ---------------------------------------------------------------------------
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            addFiles(newFiles);
        }
    };

    const addFiles = (filesToAdd: File[]) => {
        setUploadError('');
        setSelectedFiles((prev) => {
            const combined = [...prev, ...filesToAdd];
            const total = combined.reduce((acc, f) => acc + f.size, 0);
            if (total > MAX_STORAGE_BYTES) {
                setUploadError(`Tổng dung lượng vượt quá giới hạn 500 MB (hiện tại: ${formatBytes(total)}).`);
            }
            return combined;
        });
    };

    const removeFile = (index: number) => {
        setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
        setUploadError('');
    };

    const clearFiles = () => {
        setSelectedFiles([]);
        setUploadError('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            addFiles(Array.from(e.dataTransfer.files));
        }
    };

    const totalSelectedBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);

    // ---------------------------------------------------------------------------
    // Sender: Encrypt & Upload
    // ---------------------------------------------------------------------------
    const handleUploadAndStore = async () => {
        if (selectedFiles.length === 0) {
            setUploadError('Vui lòng chọn ít nhất 1 file để lưu tạm.');
            return;
        }
        if (totalSelectedBytes > MAX_STORAGE_BYTES) {
            setUploadError(`Tổng dung lượng (${formatBytes(totalSelectedBytes)}) vượt quá mức tối đa 500 MB.`);
            return;
        }
        if (!senderPassword.trim()) {
            setUploadError('Vui lòng nhập hoặc tạo mật khẩu mã hóa.');
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        setUploadError('');

        try {
            // 1. Pack files
            setUploadPhase('Đang đóng gói tập tin...');
            const packResult = await packFiles(selectedFiles);

            // 2. Encrypt with AES-256-GCM via Web Crypto
            setUploadPhase('Đang mã hóa AES-256-GCM (Zero-Knowledge)...');
            const encryptionResult = await encryptData(packResult.buffer, senderPassword.trim());

            // 3. Upload stream
            setUploadPhase('Đang tải lên server lưu tạm...');
            const fileId = uuidv4();
            const apiBase = getApiBaseUrl();

            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `${apiBase}/api/temp-storage/upload/${fileId}`);

                xhr.setRequestHeader('x-file-name', encodeURIComponent(packResult.displayName));
                xhr.setRequestHeader('x-file-size', String(packResult.totalSize));
                xhr.setRequestHeader('x-ttl-hours', String(ttlHours));
                xhr.setRequestHeader('x-burn-after-reading', burnAfterReading ? 'true' : 'false');
                xhr.setRequestHeader('x-salt', encryptionResult.saltHex);
                xhr.setRequestHeader('x-iv', encryptionResult.ivHex);
                xhr.setRequestHeader('Content-Type', 'application/octet-stream');

                xhr.upload.onprogress = (evt) => {
                    if (evt.lengthComputable) {
                        const pct = Math.round((evt.loaded / evt.total) * 100);
                        setUploadProgress(pct);
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const resJson = JSON.parse(xhr.responseText);
                            const origin = typeof window !== 'undefined' ? window.location.origin : '';
                            const fullLink = `${origin}?stored=${fileId}#${senderPassword.trim()}`;

                            setUploadResult({
                                fileId,
                                fileName: packResult.displayName,
                                cipherSize: resJson.cipherSize || encryptionResult.ciphertext.byteLength,
                                password: senderPassword.trim(),
                                expiresAt: resJson.expiresAt || (Date.now() + ttlHours * 3600 * 1000),
                                burnAfterReading: resJson.burnAfterReading || burnAfterReading,
                                shareLink: fullLink,
                            });
                            resolve();
                        } catch (err: any) {
                            reject(new Error('Phản hồi từ server không hợp lệ'));
                        }
                    } else {
                        try {
                            const errJson = JSON.parse(xhr.responseText);
                            reject(new Error(errJson.error || `Upload thất bại với mã lỗi ${xhr.status}`));
                        } catch {
                            reject(new Error(`Upload thất bại với mã lỗi ${xhr.status}`));
                        }
                    }
                };

                xhr.onerror = () => {
                    reject(new Error('Lỗi kết nối mạng khi tải lên server.'));
                };

                xhr.send(new Blob([encryptionResult.ciphertext]));
            });
        } catch (err: any) {
            console.error('[StoredTransfer] Upload failed:', err);
            setUploadError(err.message || 'Đã có lỗi xảy ra trong quá trình mã hóa hoặc tải lên.');
        } finally {
            setIsUploading(false);
            setUploadPhase('');
        }
    };

    // ---------------------------------------------------------------------------
    // Receiver: Download & Decrypt
    // ---------------------------------------------------------------------------
    const handleDownloadAndDecrypt = async () => {
        if (!receiverFileId || !previewMeta) return;
        const pass = receiverPassword.trim();
        if (!pass) {
            setDownloadError('Vui lòng nhập mật khẩu để giải mã file!');
            return;
        }

        setIsDownloading(true);
        setDownloadProgress(0);
        setDownloadStatus('Đang tải dữ liệu mã hóa từ server...');
        setDownloadError('');

        try {
            const apiBase = getApiBaseUrl();
            const res = await fetch(`${apiBase}/api/temp-storage/download/${receiverFileId}`);

            if (!res.ok) {
                if (res.status === 404) {
                    throw new Error('File không còn trên server (có thể đã bị hủy hoặc tự xóa sau khi tải).');
                }
                throw new Error(`Lỗi tải dữ liệu (${res.status})`);
            }

            const contentLength = Number(res.headers.get('Content-Length') || previewMeta.cipherSize || 0);
            const reader = res.body?.getReader();
            if (!reader) {
                throw new Error('Trình duyệt không hỗ trợ đọc stream dữ liệu.');
            }

            const chunks: Uint8Array[] = [];
            let receivedBytes = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                receivedBytes += value.length;
                if (contentLength > 0) {
                    setDownloadProgress(Math.min(99, Math.round((receivedBytes / contentLength) * 100)));
                }
            }

            setDownloadProgress(100);

            // Concatenate chunks
            setDownloadStatus('Đang tổng hợp dữ liệu mã hóa...');
            const allBytes = new Uint8Array(receivedBytes);
            let offset = 0;
            for (const chunk of chunks) {
                allBytes.set(chunk, offset);
                offset += chunk.length;
            }

            // Decrypt
            setDownloadStatus('Đang xác thực và giải mã AES-256-GCM...');
            const decryptedBuffer = await decryptData(
                allBytes.buffer,
                pass,
                previewMeta.salt,
                previewMeta.iv
            );

            // Unpack files
            setDownloadStatus('Đang giải nén tập tin...');
            const unpacked = unpackFiles(decryptedBuffer, previewMeta.fileName);
            setDownloadedFiles(unpacked);

            if (previewMeta.burnAfterReading) {
                setIsBurned(true);
            }

            setDownloadStatus('Hoàn tất giải mã thành công!');

            // If single file, auto trigger download
            if (unpacked.length === 1) {
                downloadBlob(unpacked[0].blob, unpacked[0].name);
            }
        } catch (err: any) {
            console.error('[StoredTransfer] Decrypt error:', err);
            setDownloadError(err.message || 'Mật khẩu sai hoặc file bị hỏng.');
        } finally {
            setIsDownloading(false);
        }
    };

    // ---------------------------------------------------------------------------
    // Delete Stored File (by fileId)
    // ---------------------------------------------------------------------------
    const handleDeleteStoredFile = async (fileId: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa file này khỏi server ngay lập tức?')) return;
        try {
            const apiBase = getApiBaseUrl();
            await fetch(`${apiBase}/api/temp-storage/${fileId}`, { method: 'DELETE' });
            if (uploadResult && uploadResult.fileId === fileId) {
                setUploadResult(null);
                setSelectedFiles([]);
            }
            if (receiverFileId === fileId) {
                setPreviewMeta(null);
                setMetaError('File đã bị xóa theo yêu cầu của bạn.');
            }
        } catch (err: any) {
            alert('Không thể xóa: ' + err.message);
        }
    };

    // Helper: Format Expiration Time Remaining
    const formatTimeRemaining = (expiresAt: number) => {
        const diff = expiresAt - Date.now();
        if (diff <= 0) return 'Đã hết hạn';
        const hours = Math.floor(diff / (3600 * 1000));
        const minutes = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
        if (hours > 0) {
            return `Còn ${hours} giờ ${minutes} phút (Hết hạn lúc: ${new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
        }
        return `Còn ${minutes} phút`;
    };

    // ---------------------------------------------------------------------------
    // RENDER: RECEIVER VIEW
    // ---------------------------------------------------------------------------
    if (receiverFileId) {
        return (
            <div className={`w-full max-w-3xl mx-auto p-4 md:p-6 space-y-6 ${className || ''}`}>
                {/* Header Back Button */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => {
                            if (typeof window !== 'undefined') {
                                window.location.href = window.location.origin;
                            }
                        }}
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Trở về trang chủ gửi file
                    </button>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Zero-Knowledge E2EE
                    </span>
                </div>

                {isLoadingMeta ? (
                    <div className="bg-card border rounded-2xl p-12 text-center space-y-4 shadow-sm">
                        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
                        <p className="text-muted-foreground">Đang lấy thông tin bảo mật của file...</p>
                    </div>
                ) : metaError ? (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-8 text-center space-y-4">
                        <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
                        <h3 className="text-lg font-semibold text-destructive">Không thể mở file</h3>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">{metaError}</p>
                        <Button
                            onClick={() => {
                                if (typeof window !== 'undefined') {
                                    window.location.href = window.location.origin;
                                }
                            }}
                            variant="outline"
                            className="mt-2"
                        >
                            Gửi hoặc tải file mới
                        </Button>
                    </div>
                ) : previewMeta ? (
                    <div className="bg-card border rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
                        {/* File Preview Card */}
                        <div className="border-b pb-6 space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        File lưu tạm được mã hóa
                                    </span>
                                    <h2 className="text-xl md:text-2xl font-bold break-all">
                                        {previewMeta.fileName}
                                    </h2>
                                </div>
                                <div className="p-3 bg-primary/10 text-primary rounded-xl shrink-0">
                                    <FileText className="w-8 h-8" />
                                </div>
                            </div>

                            {/* Meta Badges */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border text-xs">
                                    <HardDrive className="w-4 h-4 text-muted-foreground shrink-0" />
                                    <div>
                                        <div className="text-muted-foreground">Dung lượng</div>
                                        <div className="font-semibold text-foreground">
                                            {formatBytes(previewMeta.fileSize || previewMeta.cipherSize)}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border text-xs">
                                    <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                                    <div>
                                        <div className="text-muted-foreground">Thời hạn lưu</div>
                                        <div className="font-semibold text-foreground">
                                            {formatTimeRemaining(previewMeta.expiresAt)}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border text-xs">
                                    <Flame className={`w-4 h-4 shrink-0 ${previewMeta.burnAfterReading ? 'text-rose-500' : 'text-muted-foreground'}`} />
                                    <div>
                                        <div className="text-muted-foreground">Tự hủy sau tải</div>
                                        <div className="font-semibold text-foreground">
                                            {previewMeta.burnAfterReading ? 'Có (1 lần tải duy nhất)' : 'Không'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {previewMeta.burnAfterReading && (
                                <div className="flex items-center gap-2 text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">
                                    <Flame className="w-4 h-4 shrink-0" />
                                    <span>
                                        <strong>Lưu ý:</strong> File này được cài đặt tự hủy vĩnh viễn trên máy chủ ngay sau khi bạn tải xong lần đầu tiên.
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Password Entry */}
                        {downloadedFiles.length === 0 ? (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center justify-between">
                                        <span className="flex items-center gap-1.5">
                                            <Lock className="w-4 h-4 text-primary" />
                                            Mật khẩu giải mã file:
                                        </span>
                                        {receiverHashKey && (
                                            <span className="text-xs text-emerald-500 flex items-center gap-1">
                                                <Check className="w-3 h-3" />
                                                Đã nhận diện từ liên kết
                                            </span>
                                        )}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showReceiverPassword ? 'text' : 'password'}
                                            value={receiverPassword}
                                            onChange={(e) => {
                                                setReceiverPassword(e.target.value);
                                                setDownloadError('');
                                            }}
                                            placeholder="Nhập mật khẩu do người gửi cung cấp..."
                                            className="w-full pl-4 pr-10 py-2.5 rounded-lg border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowReceiverPassword(!showReceiverPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showReceiverPassword ? (
                                                <EyeOff className="w-4 h-4" />
                                            ) : (
                                                <Eye className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Mật khẩu là chìa khóa để giải mã trực tiếp trên trình duyệt của bạn (Server không lưu mật khẩu này).
                                    </p>
                                </div>

                                {downloadError && (
                                    <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>{downloadError}</span>
                                    </div>
                                )}

                                {/* Progress bar while downloading/decrypting */}
                                {isDownloading && (
                                    <div className="space-y-2 pt-2">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>{downloadStatus}</span>
                                            <span>{downloadProgress}%</span>
                                        </div>
                                        <ProgressBar value={downloadProgress} />
                                    </div>
                                )}

                                {/* Action Button */}
                                <Button
                                    onClick={handleDownloadAndDecrypt}
                                    disabled={isDownloading || !receiverPassword.trim()}
                                    className="w-full py-3 text-base flex items-center justify-center gap-2"
                                >
                                    {isDownloading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Đang xử lý tải & giải mã...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-5 h-5" />
                                            Tải xuống & Giải mã an toàn
                                        </>
                                    )}
                                </Button>
                            </div>
                        ) : (
                            /* Download Complete View */
                            <div className="space-y-6">
                                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center gap-3">
                                    <CheckCircle2 className="w-6 h-6 shrink-0" />
                                    <div className="text-sm">
                                        <div className="font-semibold">Giải mã thành công!</div>
                                        <div className="text-xs opacity-90">
                                            {downloadedFiles.length === 1
                                                ? 'File đã được tải xuống máy tính của bạn.'
                                                : `Đã mở gói ${downloadedFiles.length} tập tin.`}
                                            {isBurned && ' File đã tự hủy trên server theo cấu hình của người gửi.'}
                                        </div>
                                    </div>
                                </div>

                                {/* List of unpacked files */}
                                <div className="space-y-2">
                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Danh sách tập tin ({downloadedFiles.length})
                                    </div>
                                    <div className="divide-y border rounded-xl overflow-hidden bg-background">
                                        {downloadedFiles.map((file, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                                            >
                                                <div className="flex items-center gap-3 min-w-0 pr-4">
                                                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-medium truncate">
                                                            {file.name}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {formatBytes(file.size)}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => downloadBlob(file.blob, file.name)}
                                                    className="shrink-0 flex items-center gap-1.5"
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                    Lưu file
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {downloadedFiles.length > 1 && (
                                    <Button
                                        onClick={() => {
                                            downloadedFiles.forEach((f) => downloadBlob(f.blob, f.name));
                                        }}
                                        variant="default"
                                        className="w-full flex items-center justify-center gap-2"
                                    >
                                        <Download className="w-4 h-4" />
                                        Tải toàn bộ {downloadedFiles.length} file về máy
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        );
    }

    // ---------------------------------------------------------------------------
    // RENDER: SENDER VIEW
    // ---------------------------------------------------------------------------
    return (
        <div className={`w-full max-w-3xl mx-auto p-4 md:p-6 space-y-6 ${className || ''}`}>
            {/* Header info */}
            <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Zero-Knowledge E2EE Server Storage
                </div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                    Lưu tạm file trên Server (Mã hóa E2EE)
                </h1>
                <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                    File được mã hóa AES-256 trực tiếp trên trình duyệt của bạn trước khi đưa lên server.
                    Server chỉ lưu bản mã, <strong>không thể xem trộm nội dung</strong> vì mật khẩu do bạn nắm giữ.
                </p>
            </div>

            {/* IF ALREADY UPLOADED: SHOW SUCCESS & SHARE SCREEN */}
            {uploadResult ? (
                <div className="bg-card border rounded-2xl p-6 md:p-8 space-y-6 shadow-sm animate-in fade-in duration-300">
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                        <CheckCircle2 className="w-6 h-6 shrink-0" />
                        <div>
                            <div className="font-semibold text-sm">Đã tải lên và mã hóa an toàn!</div>
                            <div className="text-xs opacity-90">
                                File đang được lưu tạm trên server và sẵn sàng để gửi cho người nhận.
                            </div>
                        </div>
                    </div>

                    {/* File summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg bg-muted/40 border text-xs">
                            <span className="text-muted-foreground">Tập tin:</span>
                            <div className="font-semibold text-foreground truncate mt-0.5">
                                {uploadResult.fileName}
                            </div>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/40 border text-xs">
                            <span className="text-muted-foreground">Thời hạn tự hủy:</span>
                            <div className="font-semibold text-foreground mt-0.5">
                                {formatTimeRemaining(uploadResult.expiresAt)}
                            </div>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/40 border text-xs">
                            <span className="text-muted-foreground">Chế độ tự hủy:</span>
                            <div className="font-semibold text-foreground mt-0.5">
                                {uploadResult.burnAfterReading ? 'Tự xóa sau 1 lần tải' : 'Theo thời hạn TTL'}
                            </div>
                        </div>
                    </div>

                    {/* Share Link & QR */}
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Liên kết chia sẻ (Tự động mở khóa cho người nhận):
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={uploadResult.shareLink}
                                    className="flex-1 px-3 py-2 text-xs font-mono rounded-lg border bg-muted/40 text-foreground focus:outline-none"
                                />
                                <Button
                                    size="sm"
                                    onClick={() => {
                                        navigator.clipboard.writeText(uploadResult.shareLink);
                                        setCopiedLink(true);
                                        setTimeout(() => setCopiedLink(false), 2000);
                                    }}
                                    className="flex items-center gap-1.5 shrink-0"
                                >
                                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                    {copiedLink ? 'Đã chép' : 'Sao chép link'}
                                </Button>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                Liên kết này chứa mật khẩu ở đuôi URL fragment (#), trình duyệt người nhận sẽ tự động giải mã.
                            </p>
                        </div>

                        {/* Separate Password Box */}
                        <div className="p-4 rounded-xl bg-muted/30 border space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-medium flex items-center gap-1.5">
                                    <Key className="w-3.5 h-3.5 text-primary" />
                                    Mật khẩu mã hóa riêng (nếu muốn gửi tách biệt):
                                </span>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(uploadResult.password);
                                        setCopiedPass(true);
                                        setTimeout(() => setCopiedPass(false), 2000);
                                    }}
                                    className="text-primary hover:underline text-xs flex items-center gap-1"
                                >
                                    {copiedPass ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    {copiedPass ? 'Đã sao chép' : 'Chép mật khẩu'}
                                </button>
                            </div>
                            <div className="font-mono text-sm font-bold tracking-wider bg-background px-3 py-2 rounded-lg border border-dashed text-center">
                                {uploadResult.password}
                            </div>
                        </div>

                        {/* QR Code */}
                        <div className="flex flex-col items-center justify-center p-4 bg-muted/20 border rounded-xl space-y-2">
                            <div className="p-3 bg-white rounded-lg shadow-sm">
                                <QRCodeSVG value={uploadResult.shareLink} size={140} />
                            </div>
                            <span className="text-xs text-muted-foreground">
                                Quét mã QR bằng điện thoại để tải file
                            </span>
                        </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setUploadResult(null);
                                setSelectedFiles([]);
                                setSenderPassword(generateSecurePassword(16));
                            }}
                            className="flex-1"
                        >
                            Tải lên tập tin khác
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => handleDeleteStoredFile(uploadResult.fileId)}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive flex items-center justify-center gap-1.5"
                        >
                            <Trash2 className="w-4 h-4" />
                            Xóa file khỏi server ngay
                        </Button>
                    </div>
                </div>
            ) : (
                /* SENDER UPLOAD FORM */
                <div className="bg-card border rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
                    {/* Drag and Drop Zone */}
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                            isDragging
                                ? 'border-primary bg-primary/5'
                                : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/20'
                        }`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <div className="flex flex-col items-center gap-3">
                            <div className="p-3 rounded-full bg-primary/10 text-primary">
                                <Upload className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">
                                    Nhấn để chọn file hoặc kéo thả vào đây
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Hỗ trợ chọn nhiều file cùng lúc. Tối đa 500 MB cho mỗi gói file.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Selected Files List */}
                    {selectedFiles.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-muted-foreground uppercase tracking-wider">
                                    Đã chọn {selectedFiles.length} file ({formatBytes(totalSelectedBytes)})
                                </span>
                                <button
                                    onClick={clearFiles}
                                    className="text-destructive hover:underline text-xs"
                                >
                                    Xóa tất cả
                                </button>
                            </div>
                            <div className="max-h-48 overflow-y-auto divide-y border rounded-xl bg-background">
                                {selectedFiles.map((file, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between p-2.5 text-xs hover:bg-muted/30 transition-colors"
                                    >
                                        <div className="flex items-center gap-2 min-w-0 pr-2">
                                            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                                            <span className="font-medium truncate">{file.name}</span>
                                            <span className="text-muted-foreground shrink-0">
                                                ({formatBytes(file.size)})
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => removeFile(idx)}
                                            className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Options Grid */}
                    <div className="space-y-4 pt-2 border-t">
                        {/* Expiration (TTL) */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-primary" />
                                Thời gian lưu tạm trên server (Tự hủy sau):
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {[
                                    { hours: 1, label: '1 giờ' },
                                    { hours: 6, label: '6 giờ' },
                                    { hours: 12, label: '12 giờ' },
                                    { hours: 24, label: '24 giờ (mặc định)' },
                                ].map((item) => (
                                    <button
                                        key={item.hours}
                                        type="button"
                                        onClick={() => setTtlHours(item.hours)}
                                        className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                                            ttlHours === item.hours
                                                ? 'bg-primary text-primary-foreground border-primary'
                                                : 'hover:bg-muted/50 bg-background text-foreground'
                                        }`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Burn After Reading Checkbox */}
                        <div className="p-3 rounded-xl border bg-muted/20 flex items-start gap-3">
                            <input
                                id="burn-toggle"
                                type="checkbox"
                                checked={burnAfterReading}
                                onChange={(e) => setBurnAfterReading(e.target.checked)}
                                className="mt-1 w-4 h-4 rounded text-primary focus:ring-primary border-muted-foreground/30 cursor-pointer"
                            />
                            <label htmlFor="burn-toggle" className="text-xs space-y-0.5 cursor-pointer">
                                <div className="font-semibold text-foreground flex items-center gap-1.5">
                                    <Flame className="w-3.5 h-3.5 text-rose-500" />
                                    Tự hủy ngay sau 1 lần tải thành công (Burn after reading)
                                </div>
                                <div className="text-muted-foreground">
                                    Khi bật tùy chọn này, server sẽ tự động xóa file vĩnh viễn ngay khi người nhận tải xong lần đầu tiên.
                                </div>
                            </label>
                        </div>

                        {/* Encryption Password */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <label className="font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <Lock className="w-3.5 h-3.5 text-primary" />
                                    Mật khẩu mã hóa E2EE:
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setSenderPassword(generateSecurePassword(16))}
                                    className="text-primary hover:underline text-xs flex items-center gap-1"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    Tạo mật khẩu ngẫu nhiên mới
                                </button>
                            </div>
                            <div className="relative">
                                <input
                                    type={showSenderPassword ? 'text' : 'password'}
                                    value={senderPassword}
                                    onChange={(e) => setSenderPassword(e.target.value)}
                                    placeholder="Nhập hoặc để mật khẩu tự tạo..."
                                    className="w-full pl-4 pr-10 py-2.5 rounded-lg border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowSenderPassword(!showSenderPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showSenderPassword ? (
                                        <EyeOff className="w-4 h-4" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                Mật khẩu này được dùng để mã hóa bằng thuật toán AES-256-GCM trên máy bạn. Server không bao giờ nhận được mật khẩu này.
                            </p>
                        </div>
                    </div>

                    {/* Error display */}
                    {uploadError && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{uploadError}</span>
                        </div>
                    )}

                    {/* Upload progress */}
                    {isUploading && (
                        <div className="space-y-2 pt-2">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{uploadPhase}</span>
                                <span>{uploadProgress}%</span>
                            </div>
                            <ProgressBar value={uploadProgress} />
                        </div>
                    )}

                    {/* Submit Button */}
                    <Button
                        onClick={handleUploadAndStore}
                        disabled={isUploading || selectedFiles.length === 0 || totalSelectedBytes > MAX_STORAGE_BYTES}
                        className="w-full py-3 text-base flex items-center justify-center gap-2"
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Đang mã hóa & tải lên...
                            </>
                        ) : (
                            <>
                                <ShieldCheck className="w-5 h-5" />
                                Mã hóa & Lưu tạm lên Server ({formatBytes(totalSelectedBytes)})
                            </>
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
}
