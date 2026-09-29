'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from './Button';
import { soundManager } from '@/lib/audio';

interface QRScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (scannedText: string) => void;
}

export function QRScannerModal({ isOpen, onClose, onScan }: QRScannerModalProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [hasCamera, setHasCamera] = useState(true);
    const [cameraError, setCameraError] = useState<string>('');
    const [isScanning, setIsScanning] = useState(false);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    const streamRef = useRef<MediaStream | null>(null);
    const animFrameRef = useRef<number | null>(null);

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

    // Start camera stream
    useEffect(() => {
        if (!isOpen) {
            stopCamera();
            return;
        }

        let isMounted = true;
        setCameraError('');
        setIsScanning(true);

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

                // Check for native BarcodeDetector API
                if ('BarcodeDetector' in window) {
                    const barcodeDetector = new (window as any).BarcodeDetector({
                        formats: ['qr_code'],
                    });

                    const detectLoop = async () => {
                        if (!isMounted || !videoRef.current || videoRef.current.readyState < 2) {
                            animFrameRef.current = requestAnimationFrame(detectLoop);
                            return;
                        }

                        try {
                            const barcodes = await barcodeDetector.detect(videoRef.current);
                            if (barcodes.length > 0) {
                                const rawValue = barcodes[0].rawValue;
                                if (rawValue) {
                                    soundManager.playSuccess();
                                    onScan(rawValue);
                                    stopCamera();
                                    onClose();
                                    return;
                                }
                            }
                        } catch {
                            // frame skip
                        }

                        animFrameRef.current = requestAnimationFrame(detectLoop);
                    };

                    animFrameRef.current = requestAnimationFrame(detectLoop);
                }
            } catch (err: any) {
                if (isMounted) {
                    setHasCamera(false);
                    setCameraError(
                        err.name === 'NotAllowedError'
                            ? 'Vui lòng cấp quyền truy cập Camera trong trình duyệt để quét mã QR.'
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
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
                                Bạn có thể dán trực tiếp liên kết chia sẻ hoặc mã phòng vào ô nhận tệp bên dưới.
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
                                <div className="w-60 h-60 border-2 border-blue-400/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]">
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

                {/* Footer Controls */}
                <div className="p-4 bg-slate-50 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span className="truncate">Hướng máy ảnh vào mã QR của người gửi</span>
                    <div className="flex items-center gap-2 shrink-0">
                        {hasCamera && !cameraError && (
                            <button
                                onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 font-semibold text-slate-700 transition-colors"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Đổi camera
                            </button>
                        )}
                        <Button onClick={onClose} variant="outline" size="sm">
                            Đóng
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
