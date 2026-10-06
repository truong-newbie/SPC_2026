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
    Archive,
    Folder,
    FolderUp,
} from 'lucide-react';
import { Button } from './Button';
import { FileIcon } from './FileIcon';
import { ProgressBar } from './ProgressBar';
import { formatBytes, downloadBlob } from '@/lib/download';
import { createZip, generateZipFilename, shouldZipAll, type ZipProgress } from '@/lib/zipManager';
import { packFiles, unpackFiles, type UnpackedFile } from '@/lib/swarm/pack';
import { getFilesFromDataTransfer, getFilesFromInput } from '@/lib/directory';
import {
    encryptData,
    decryptData,
    generateSecurePassword,
} from '@/lib/crypto/e2ee';
import { useLanguage } from '@/lib/i18n';

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
        // If running locally in development on localhost, target port 3001
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:3001';
        }
        // In production on filebridge.click, use relative path so Nginx reverse proxies /api/
        return '';
    }
    return '';
}

export default function StoredTransfer({ className }: StoredTransferProps) {
    const { t, isVi } = useLanguage();
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
    const [isZipping, setIsZipping] = useState(false);
    const [zipProgress, setZipProgress] = useState<ZipProgress | null>(null);

    // Sender State
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [ttlHours, setTtlHours] = useState<number>(24);
    const [burnAfterReading, setBurnAfterReading] = useState<boolean>(true);
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
    const folderInputRef = useRef<HTMLInputElement | null>(null);

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
            const scanned = getFilesFromInput(e.target.files);
            addFiles(scanned.map((s) => s.file));
            e.target.value = '';
        }
    };

    const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const scanned = getFilesFromInput(e.target.files);
            addFiles(scanned.map((s) => s.file));
            e.target.value = '';
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
        if (folderInputRef.current) folderInputRef.current.value = '';
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

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const scanned = await getFilesFromDataTransfer(e.dataTransfer);
        if (scanned.length > 0) {
            addFiles(scanned.map((s) => s.file));
        }
    };

    const totalSelectedBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);

    // Dynamic TTL policy based on file size:
    // - File nhỏ (< 20MB): Tự động gán 24 giờ
    // - File trung bình (20MB - 100MB): Tự động gán 6 giờ
    // - File lớn (> 100MB): Tự động gán 2 giờ (tiết kiệm ổ cứng server)
    const MB = 1024 * 1024;
    let autoTtlHours = 24;
    let sizeCategory = t('Tệp nhỏ (< 20MB)', 'Small bundle (< 20MB)');

    if (totalSelectedBytes > 100 * MB) {
        autoTtlHours = 2;
        sizeCategory = t('Tệp lớn (> 100MB)', 'Large bundle (> 100MB)');
    } else if (totalSelectedBytes > 20 * MB) {
        autoTtlHours = 6;
        sizeCategory = t('Tệp trung bình (20MB - 100MB)', 'Medium bundle (20MB - 100MB)');
    }

    // Auto-sync ttlHours to dynamic policy
    useEffect(() => {
        setTtlHours(autoTtlHours);
    }, [autoTtlHours]);

    // ---------------------------------------------------------------------------
    // Sender: Encrypt & Upload
    // ---------------------------------------------------------------------------
    const handleUploadAndStore = async () => {
        if (selectedFiles.length === 0) {
            setUploadError(t('Vui lòng chọn ít nhất 1 file để lưu tạm.', 'Please select at least 1 file.'));
            return;
        }
        if (totalSelectedBytes > MAX_STORAGE_BYTES) {
            setUploadError(t(`Tổng dung lượng (${formatBytes(totalSelectedBytes)}) vượt quá mức tối đa 500 MB.`, `Total size (${formatBytes(totalSelectedBytes)}) exceeds the 500 MB maximum.`));
            return;
        }
        if (!senderPassword.trim()) {
            setUploadError(t('Vui lòng nhập hoặc tạo mật khẩu mã hóa.', 'Please enter or generate an encryption password.'));
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        setUploadError('');

        try {
            // 1. Pack files
            setUploadPhase(t('Đang đóng gói tập tin...', 'Packing files...'));
            const packResult = await packFiles(selectedFiles);

            // 2. Encrypt with AES-256-GCM via Web Crypto
            setUploadPhase(t('Đang mã hóa AES-256-GCM (Zero-Knowledge)...', 'Encrypting AES-256-GCM (Zero-Knowledge)...'));
            const encryptionResult = await encryptData(packResult.buffer, senderPassword.trim());

            // 3. Upload stream
            setUploadPhase(t('Đang tải lên server lưu tạm...', 'Uploading encrypted file to server...'));
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

    // ZIP all unpacked files into a single archive
    const handleZipAllFiles = useCallback(async () => {
        if (downloadedFiles.length === 0) return;
        const totalBytes = downloadedFiles.reduce((sum, f) => sum + f.size, 0);
        const check = shouldZipAll(totalBytes);
        if (!check.canZip) {
            alert(check.reason + '. Vui lòng tải từng tệp riêng lẻ.');
            return;
        }

        setIsZipping(true);
        setZipProgress(null);

        try {
            const filesToZip = downloadedFiles.map((f) => ({
                name: f.name,
                blob: f.blob,
                relativePath: f.relativePath,
            }));
            const zipFilename = generateZipFilename(receiverFileId || undefined);
            const zipBlob = await createZip(filesToZip, {
                filename: zipFilename,
                onProgress: (p) => setZipProgress(p),
            });
            downloadBlob(zipBlob, zipFilename);
        } catch (err) {
            console.error('Lỗi tạo ZIP:', err);
            alert('Không thể tạo file ZIP: ' + (err instanceof Error ? err.message : 'Lỗi không xác định'));
        } finally {
            setIsZipping(false);
            setZipProgress(null);
        }
    }, [downloadedFiles, receiverFileId]);

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
        if (diff <= 0) return t('Đã hết hạn', 'Expired');
        const hours = Math.floor(diff / (3600 * 1000));
        const minutes = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
        if (hours > 0) {
            return isVi
                ? `Còn ${hours} giờ ${minutes} phút (Hết hạn lúc: ${new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                : `${hours}h ${minutes}m left (Expires: ${new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
        }
        return isVi ? `Còn ${minutes} phút` : `${minutes}m left`;
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
                        {t('Trở về trang chủ gửi file', 'Back to file sharing home')}
                    </button>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Zero-Knowledge E2EE
                    </span>
                </div>

                {isLoadingMeta ? (
                    <div className="bg-card border rounded-2xl p-12 text-center space-y-4 shadow-sm">
                        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
                        <p className="text-muted-foreground">{t('Đang lấy thông tin bảo mật của file...', 'Fetching file security details...')}</p>
                    </div>
                ) : metaError ? (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-8 text-center space-y-4">
                        <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
                        <h3 className="text-lg font-semibold text-destructive">{t('Không thể mở file', 'Unable to open file')}</h3>
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
                            {t('Gửi hoặc tải file mới', 'Send or download new file')}
                        </Button>
                    </div>
                ) : previewMeta ? (
                    <div className="bg-card border rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
                        {/* File Preview Card */}
                        <div className="border-b pb-6 space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        {t('File lưu tạm được mã hóa', 'Encrypted stored file')}
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
                                        <div className="text-muted-foreground">{t('Dung lượng', 'Size')}</div>
                                        <div className="font-semibold text-foreground">
                                            {formatBytes(previewMeta.fileSize || previewMeta.cipherSize)}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border text-xs">
                                    <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                                    <div>
                                        <div className="text-muted-foreground">{t('Thời hạn lưu', 'Expires in')}</div>
                                        <div className="font-semibold text-foreground">
                                            {formatTimeRemaining(previewMeta.expiresAt)}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border text-xs">
                                    <Flame className={`w-4 h-4 shrink-0 ${previewMeta.burnAfterReading ? 'text-rose-500' : 'text-muted-foreground'}`} />
                                    <div>
                                        <div className="text-muted-foreground">{t('Tự hủy sau tải', 'Burn after download')}</div>
                                        <div className="font-semibold text-foreground">
                                            {previewMeta.burnAfterReading ? t('Có (1 lần tải duy nhất)', 'Yes (1-time download)') : t('Không', 'No')}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {previewMeta.burnAfterReading && (
                                <div className="flex items-center gap-2 text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">
                                    <Flame className="w-4 h-4 shrink-0" />
                                    <span>
                                        <strong>{t('Lưu ý:', 'Notice:')}</strong> {t('File này được cài đặt tự hủy vĩnh viễn trên máy chủ ngay sau khi bạn tải xong lần đầu tiên.', 'This file is set to permanently self-destruct from the server after the first download.')}
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
                                            {t('Mật khẩu giải mã file:', 'Decryption password:')}
                                        </span>
                                        {receiverHashKey && (
                                            <span className="text-xs text-emerald-500 flex items-center gap-1">
                                                <Check className="w-3 h-3" />
                                                {t('Đã nhận diện từ liên kết', 'Auto-filled from link')}
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
                                            placeholder={t('Nhập mật khẩu do người gửi cung cấp...', 'Enter password provided by sender...')}
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
                                        {t('Mật khẩu là chìa khóa để giải mã trực tiếp trên trình duyệt của bạn (Server không lưu mật khẩu này).', 'The password decrypts files locally in your browser (never stored on server).')}
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
                                            {t('Đang xử lý tải & giải mã...', 'Downloading & decrypting...')}
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-5 h-5" />
                                            {t('Tải xuống & Giải mã an toàn', 'Download & Decrypt Securely')}
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
                                        <div className="font-semibold">{t('Giải mã thành công!', 'Decrypted successfully!')}</div>
                                        <div className="text-xs opacity-90">
                                            {downloadedFiles.length === 1
                                                ? t('File đã được tải xuống máy tính của bạn.', 'File has been downloaded to your computer.')
                                                : t(`Đã mở gói ${downloadedFiles.length} tập tin.`, `Extracted ${downloadedFiles.length} files.`)}
                                            {isBurned && t(' File đã tự hủy trên server theo cấu hình của người gửi.', ' File was burned from server as configured.')}
                                        </div>
                                    </div>
                                </div>

                                {/* List of unpacked files */}
                                <div className="space-y-2">
                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        {t('Danh sách tập tin', 'File list')} ({downloadedFiles.length})
                                    </div>
                                    <div className="divide-y border rounded-xl overflow-hidden bg-background">
                                        {downloadedFiles.map((file, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                                            >
                                                <div className="flex items-center gap-3 min-w-0 pr-4">
                                                    <FileIcon fileName={file.name} mimeType={file.blob?.type} size="sm" />
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-medium truncate" title={file.relativePath || file.name}>
                                                            {file.name}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                            <span>{formatBytes(file.size)}</span>
                                                            {file.relativePath && file.relativePath.includes('/') && (
                                                                <span
                                                                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 bg-blue-50/80 px-1.5 py-0.5 border border-blue-200/60 rounded font-mono truncate max-w-[180px]"
                                                                    title={file.relativePath}
                                                                >
                                                                    <Folder className="w-3 h-3 shrink-0" />
                                                                    <span className="truncate">{file.relativePath.slice(0, file.relativePath.lastIndexOf('/'))}</span>
                                                                </span>
                                                            )}
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
                                                    {t('Lưu file', 'Save file')}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {downloadedFiles.length > 1 && (
                                    <Button
                                        onClick={handleZipAllFiles}
                                        disabled={isZipping}
                                        variant="default"
                                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                                    >
                                        {isZipping ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>{t('Đang đóng gói ZIP', 'Creating ZIP archive')} ({zipProgress ? `${zipProgress.percent}%` : '...'})</span>
                                            </>
                                        ) : (
                                            <>
                                                <Archive className="w-4 h-4" />
                                                <span>{t(`Tải toàn bộ ${downloadedFiles.length} file (.zip)`, `Download all ${downloadedFiles.length} files (.zip)`)}</span>
                                            </>
                                        )}
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
                    {t('Lưu tạm file trên Server (Mã hóa E2EE)', 'Secure Encrypted Server Storage (E2EE)')}
                </h1>
                <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                    {t(
                        'File được mã hóa AES-256 trực tiếp trên trình duyệt của bạn trước khi đưa lên server. Server chỉ lưu bản mã, không thể xem trộm nội dung vì mật khẩu do bạn nắm giữ.',
                        'Files are AES-256 encrypted in your browser before upload. The server only stores ciphertext and cannot inspect files as you hold the encryption key.'
                    )}
                </p>
            </div>

            {/* IF ALREADY UPLOADED: SHOW SUCCESS & SHARE SCREEN */}
            {uploadResult ? (
                <div className="bg-card border rounded-2xl p-6 md:p-8 space-y-6 shadow-sm animate-in fade-in duration-300">
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                        <CheckCircle2 className="w-6 h-6 shrink-0" />
                        <div>
                            <div className="font-semibold text-sm">{t('Đã tải lên và mã hóa an toàn!', 'Uploaded & Encrypted Securely!')}</div>
                            <div className="text-xs opacity-90">
                                {t('File đang được lưu tạm trên server và sẵn sàng để gửi cho người nhận.', 'Files are temporarily preserved on the server and ready to be downloaded.')}
                            </div>
                        </div>
                    </div>

                    {/* File summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg bg-muted/40 border text-xs">
                            <span className="text-muted-foreground">{t('Tập tin:', 'File:')}</span>
                            <div className="font-semibold text-foreground truncate mt-0.5">
                                {uploadResult.fileName}
                            </div>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/40 border text-xs">
                            <span className="text-muted-foreground">{t('Thời hạn tự hủy:', 'Expires in:')}</span>
                            <div className="font-semibold text-foreground mt-0.5">
                                {formatTimeRemaining(uploadResult.expiresAt)}
                            </div>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/40 border text-xs">
                            <span className="text-muted-foreground">{t('Chế độ tự hủy:', 'Auto-burn mode:')}</span>
                            <div className="font-semibold text-foreground mt-0.5">
                                {uploadResult.burnAfterReading ? t('Tự xóa sau 1 lần tải', 'Burn after 1 download') : t('Theo thời hạn TTL', 'TTL expiration')}
                            </div>
                        </div>
                    </div>

                    {/* Share Link & QR */}
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                {t('Liên kết chia sẻ (Tự động mở khóa cho người nhận):', 'Share Link (Auto-unlocks for recipient):')}
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
                                    {copiedLink ? t('Đã chép', 'Copied') : t('Sao chép link', 'Copy Link')}
                                </Button>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                {t('Liên kết này chứa mật khẩu ở đuôi URL fragment (#), trình duyệt người nhận sẽ tự động giải mã.', 'This link embeds the encryption key in the URL hash (#) so receiver auto-decrypts without typing.')}
                            </p>
                        </div>

                        {/* Separate Password Box */}
                        <div className="p-4 rounded-xl bg-muted/30 border space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-medium flex items-center gap-1.5">
                                    <Key className="w-3.5 h-3.5 text-primary" />
                                    {t('Mật khẩu mã hóa riêng (nếu muốn gửi tách biệt):', 'Decryption password (if sent separately):')}
                                </span>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(uploadResult.password);
                                        setCopiedPass(true);
                                        setTimeout(() => setCopiedPass(false), 2000);
                                    }}
                                    className="text-primary hover:underline text-xs flex items-center gap-1"
                                >
                                    {copiedPass ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                    {copiedPass ? t('Đã sao chép', 'Copied') : t('Chép mật khẩu', 'Copy Password')}
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
                                {t('Quét mã QR bằng điện thoại để tải file', 'Scan QR code with phone to download')}
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
                            {t('Tải lên tập tin khác', 'Upload another file')}
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => handleDeleteStoredFile(uploadResult.fileId)}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive flex items-center justify-center gap-1.5"
                        >
                            <Trash2 className="w-4 h-4" />
                            {t('Xóa file khỏi server ngay', 'Delete from server now')}
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
                        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
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
                        <input
                            ref={folderInputRef}
                            type="file"
                            multiple
                            {...({ webkitdirectory: '', directory: '' } as any)}
                            onChange={handleFolderSelect}
                            className="hidden"
                        />
                        <div className="flex flex-col items-center gap-3">
                            <div className="p-3 rounded-full bg-primary/10 text-primary">
                                <Upload className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">
                                    {t('Kéo thả tệp hoặc thư mục vào đây', 'Drag & drop files or folders here')}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {t('Hỗ trợ chọn nhiều tệp và cả thư mục cùng lúc. Tối đa 500 MB cho mỗi gói file.', 'Supports multiple files and entire folders. Up to 500 MB per bundle.')}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-xs cursor-pointer text-xs font-semibold px-3 py-1.5"
                                >
                                    <Upload className="w-3.5 h-3.5" />
                                    {t('Chọn tệp', 'Choose files')}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => folderInputRef.current?.click()}
                                    className="border-slate-300 text-slate-700 hover:bg-slate-100 gap-1.5 shadow-xs cursor-pointer text-xs font-semibold px-3 py-1.5"
                                >
                                    <FolderUp className="w-3.5 h-3.5 text-blue-600" />
                                    {t('Chọn thư mục', 'Choose folder')}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Selected Files List */}
                    {selectedFiles.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-muted-foreground uppercase tracking-wider">
                                    {t(`Đã chọn ${selectedFiles.length} file`, `Selected ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}`)} ({formatBytes(totalSelectedBytes)})
                                </span>
                                <button
                                    onClick={clearFiles}
                                    className="text-destructive hover:underline text-xs"
                                >
                                    {t('Xóa tất cả', 'Clear all')}
                                </button>
                            </div>
                            <div className="max-h-48 overflow-y-auto divide-y border rounded-xl bg-background">
                                {selectedFiles.map((file, idx) => {
                                    const relPath = (file as any).relativePath as string | undefined;
                                    const folderPath = relPath && relPath.includes('/')
                                        ? relPath.slice(0, relPath.lastIndexOf('/'))
                                        : null;
                                    return (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between p-2.5 text-xs hover:bg-muted/30 transition-colors"
                                        >
                                            <div className="flex items-center gap-2 min-w-0 pr-2">
                                                <FileIcon fileName={file.name} mimeType={file.type} size="sm" />
                                                <div className="min-w-0">
                                                    <span className="font-medium truncate block" title={relPath || file.name}>{file.name}</span>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-muted-foreground shrink-0">
                                                            {formatBytes(file.size)}
                                                        </span>
                                                        {folderPath && (
                                                            <span
                                                                className="inline-flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50/80 px-1.5 py-0.2 border border-blue-200/60 rounded font-mono truncate max-w-[180px]"
                                                                title={relPath}
                                                            >
                                                                <Folder className="w-2.5 h-2.5 shrink-0" />
                                                                <span className="truncate">{folderPath}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removeFile(idx)}
                                                className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Options Container */}
                    <div className="space-y-4 pt-2 border-t">
                        {/* Security & Storage Policy Notification Card */}
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 space-y-2.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                            <ShieldCheck className="w-4 h-4 text-blue-600" />
                            <span>{t('Chính sách lưu trữ & Tự hủy bảo mật', 'Storage & Auto-Burn Policy')}</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {/* Auto TTL Info Card */}
                            <div className="bg-white border border-slate-200/70 rounded-lg p-3 flex items-start gap-2.5 shadow-2xs">
                                <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                <div className="space-y-0.5 text-xs">
                                    <div className="font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                        <span>{t('Thời hạn lưu tạm:', 'Storage expiration:')}</span>
                                        <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                            {autoTtlHours} {t('giờ', 'hours')}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">
                                        {sizeCategory}. {t('Tệp sẽ tự động hủy nếu người nhận không tải trước hạn chót.', 'Files will automatically self-destruct if not downloaded before deadline.')}
                                    </p>
                                </div>
                            </div>

                            {/* Auto Burn After Reading Info Card */}
                            <div className="bg-white border border-slate-200/70 rounded-lg p-3 flex items-start gap-2.5 shadow-2xs">
                                <Flame className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                <div className="space-y-0.5 text-xs">
                                    <div className="font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                        <span>{t('Tự hủy sau khi tải:', 'Burn after download:')}</span>
                                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                            {t('Luôn bật', 'Always On')}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">
                                        {t('Xóa vĩnh viễn khỏi máy chủ ngay khi tải xong 100%, bảo vệ tuyệt đối quyền riêng tư.', 'Permanently deleted from server upon complete download, ensuring absolute privacy.')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                        {/* Encryption Password */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <label className="font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <Lock className="w-3.5 h-3.5 text-primary" />
                                    {t('Mật khẩu mã hóa E2EE:', 'E2EE Encryption Password:')}
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setSenderPassword(generateSecurePassword(16))}
                                    className="text-primary hover:underline text-xs flex items-center gap-1"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    {t('Tạo mật khẩu ngẫu nhiên mới', 'Generate random password')}
                                </button>
                            </div>
                            <div className="relative">
                                <input
                                    type={showSenderPassword ? 'text' : 'password'}
                                    value={senderPassword}
                                    onChange={(e) => setSenderPassword(e.target.value)}
                                    placeholder={t('Nhập hoặc để mật khẩu tự tạo...', 'Enter or use auto-generated password...')}
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
                                {t('Mật khẩu này được dùng để mã hóa bằng thuật toán AES-256-GCM trên máy bạn. Server không bao giờ nhận được mật khẩu này.', 'This password is used to encrypt files with AES-256-GCM locally. The server never receives this password.')}
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
                                {t('Đang mã hóa & tải lên...', 'Encrypting & uploading...')}
                            </>
                        ) : (
                            <>
                                <ShieldCheck className="w-5 h-5" />
                                {t('Mã hóa & Lưu tạm lên Server', 'Encrypt & Store on Server')} ({formatBytes(totalSelectedBytes)})
                            </>
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
}
