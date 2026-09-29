'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, RefreshCw, AlertCircle, Upload, CheckCircle2, Link2 } from 'lucide-react';
import { Button } from './Button';
import { soundManager } from '@/lib/audio';
import jsQR from 'jsqr';

interface QRScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (scannedText: string) => void;
}

export function QRScannerModal({ isOpen, onClose, onScan }: QRScannerModalProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [cameraError, setCameraError] = useState<string>('');
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    const [manualCode, setManualCode] = useState('');
    const [imageError, setImageError] = useState('');
    const streamRef = useRef<MediaStream | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Stop camera stream cleanly
    const stopCamera = () => {
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
    };

    // Scan loop using jsQR
    useEffect(() => {
        if (!isOpen) {
            stopCamera();
            return;
        }

        let isMounted = true;
        setCameraError('');
        setImageError('');

        async function initCamera() {
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error('Trình duyệt của bạn không hỗ trợ truy cập máy ảnh.');
                }

                stopCamera();

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode,
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: false,
                });

                if (!isMounted) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }

                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }

                // Create offscreen canvas for frame capture
                const canvas = canvasRef.current || document.createElement('canvas');
                canvasRef.current = canvas;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });

                const scanFrame = () => {
                    if (!isMounted) return;

                    const video = videoRef.current;
                    if (video && video.readyState >= 2 && ctx) {
                        const vw = video.videoWidth;
                        const vh = video.videoHeight;
                        if (vw > 0 && vh > 0) {
                            if (canvas.width !== vw || canvas.height !== vh) {
                                canvas.width = vw;
                                canvas.height = vh;
                            }
                            ctx.drawImage(video, 0, 0, vw, vh);
                            const imageData = ctx.getImageData(0, 0, vw, vh);
                            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                                inversionAttempts: 'attemptBoth',
                            });

                            if (code && code.data) {
                                soundManager.playSuccess();
                                onScan(code.data);
                                stopCamera();
                                onClose();
                                return;
                            }
                        }
                    }

                    animFrameRef.current = requestAnimationFrame(scanFrame);
                };

                animFrameRef.current = requestAnimationFrame(scanFrame);
            } catch (err: any) {
                if (isMounted) {
                    setCameraError(
                        err.name === 'NotAllowedError'
                            ? 'Vui lòng cấp quyền truy cập Camera để quét mã QR.'
                            : `Không thể mở camera: ${err.message || 'Lỗi thiết bị'}`
                    );
                }
            }
        }

        initCamera();

        return () => {
            isMounted = false;
            stopCamera();
        };
    }, [isOpen, facingMode]);

    // Handle picking image from disk / phone photo library
    const handleImageFile = (file: File) => {
        if (!file || !file.type.startsWith('image/')) return;
        setImageError('');

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) return;
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'attemptBoth',
                });
                if (code && code.data) {
                    soundManager.playSuccess();
                    onScan(code.data);
                    stopCamera();
                    onClose();
                } else {
                    setImageError('Không tìm thấy mã QR trong bức ảnh này. Vui lòng thử lại với ảnh rõ hơn.');
                }
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (manualCode.trim()) {
            onScan(manualCode.trim());
            stopCamera();
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Camera className="w-4 h-4" />
                        </div>
                        <h3 className="font-bold text-sm text-slate-800">Quét mã QR nhận tệp</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Viewfinder Area */}
                <div className="relative bg-slate-950 aspect-square w-full flex items-center justify-center overflow-hidden">
                    {cameraError ? (
                        <div className="p-6 text-center text-slate-200 space-y-3">
                            <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
                            <p className="text-xs sm:text-sm font-medium">{cameraError}</p>
                            <p className="text-xs text-slate-400">
                                Bạn có thể tải ảnh chụp mã QR từ máy hoặc dán link phòng bên dưới.
                            </p>
                        </div>
                    ) : (
                        <>
                            <video
                                ref={videoRef}
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                            />

                            {/* Viewfinder Target Overlay */}
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                <div className="w-60 h-60 border-2 border-blue-400/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(15,23,42,0.5)]">
                                    {/* Corner Accents */}
                                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
                                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
                                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
                                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />

                                    {/* Animated Scan Line */}
                                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse absolute top-1/2 -translate-y-1/2 shadow-lg shadow-cyan-400/50" />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {imageError && (
                    <div className="p-3 bg-red-50 text-red-700 text-xs text-center border-t border-red-100 font-medium">
                        {imageError}
                    </div>
                )}

                {/* Footer Controls & Upload */}
                <div className="p-4 bg-slate-50 space-y-3 border-t border-slate-100 text-xs text-slate-500">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            {/* Upload QR image button */}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
                            >
                                <Upload className="w-3.5 h-3.5 text-blue-600" />
                                <span>Chọn ảnh QR</span>
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    if (e.target.files?.[0]) handleImageFile(e.target.files[0]);
                                }}
                                className="hidden"
                            />

                            {/* Switch camera button */}
                            {!cameraError && (
                                <button
                                    type="button"
                                    onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>Đổi camera</span>
                                </button>
                            )}
                        </div>

                        <Button onClick={onClose} variant="outline" size="sm">
                            Đóng
                        </Button>
                    </div>

                    {/* Manual input form */}
                    <form onSubmit={handleManualSubmit} className="flex gap-2 pt-1 border-t border-slate-200/60">
                        <input
                            type="text"
                            placeholder="Hoặc dán liên kết / mã phòng tại đây..."
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <Button type="submit" size="sm" disabled={!manualCode.trim()} className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 text-xs">
                            Kết nối
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
