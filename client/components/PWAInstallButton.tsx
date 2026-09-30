'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, Check, X, Share, PlusSquare, Monitor } from 'lucide-react';

export function PWAInstallButton({ className = '' }: { className?: string }) {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [showGuideModal, setShowGuideModal] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Register service worker if supported
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
        }

        // Detect if running in standalone mode (already installed)
        if (typeof window !== 'undefined') {
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
            if (isStandalone) {
                setIsInstalled(true);
            }
            setIsIOS(/iPhone|iPad|iPod/i.test(navigator.userAgent));
        }

        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        const handleAppInstalled = () => {
            setIsInstalled(true);
            setDeferredPrompt(null);
            setShowGuideModal(false);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            try {
                deferredPrompt.prompt();
                const choiceResult = await deferredPrompt.userChoice;
                if (choiceResult.outcome === 'accepted') {
                    setIsInstalled(true);
                }
                setDeferredPrompt(null);
            } catch {
                setShowGuideModal(true);
            }
        } else {
            setShowGuideModal(true);
        }
    };

    if (isInstalled) {
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200/80 ${className}`}>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Đã cài App</span>
            </span>
        );
    }

    return (
        <>
            <button
                type="button"
                onClick={handleInstallClick}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50/90 hover:bg-blue-100 rounded-lg border border-blue-200/80 transition-all shadow-xs cursor-pointer ${className}`}
                title="Cài đặt FileBridge thành ứng dụng độc lập trên Desktop / Mobile"
            >
                <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                <span>Cài App</span>
            </button>

            {/* Guide Modal for iOS / Browser Manual Install */}
            {showGuideModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 text-slate-800">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <Smartphone className="w-4 h-4" />
                                </div>
                                <h3 className="font-bold text-sm text-slate-900">Cài đặt ứng dụng FileBridge</h3>
                            </div>
                            <button
                                onClick={() => setShowGuideModal(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {isIOS ? (
                            <div className="space-y-3 text-xs text-slate-600">
                                <p className="font-medium text-slate-800">
                                    Để cài đặt FileBridge trên iPhone / iPad (iOS):
                                </p>
                                <div className="space-y-2.5 pl-1">
                                    <div className="flex items-start gap-2.5">
                                        <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 text-[11px] font-bold">1</div>
                                        <p>Nhấn vào biểu tượng <strong>Chia sẻ</strong> <Share className="w-3.5 h-3.5 inline mx-1 text-blue-600" /> ở thanh điều hướng Safari (dưới cùng).</p>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                        <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 text-[11px] font-bold">2</div>
                                        <p>Cuộn xuống và chọn <strong>"Thêm vào MH chính"</strong> (Add to Home Screen <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-slate-700" />).</p>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                        <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 text-[11px] font-bold">3</div>
                                        <p>Nhấn <strong>Thêm</strong> ở góc trên bên phải. Ứng dụng sẽ xuất hiện như App độc lập trên màn hình chính!</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3 text-xs text-slate-600">
                                <p className="font-medium text-slate-800">
                                    Để cài đặt trên Desktop hoặc Android:
                                </p>
                                <div className="space-y-2.5 pl-1">
                                    <div className="flex items-start gap-2.5">
                                        <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 text-[11px] font-bold">1</div>
                                        <p>Trên máy tính (Chrome/Edge): Nhấn biểu tượng <strong>Cài đặt</strong> <Monitor className="w-3.5 h-3.5 inline mx-1 text-blue-600" /> ở góc phải thanh địa chỉ URL.</p>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                        <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 text-[11px] font-bold">2</div>
                                        <p>Trên Android: Nhấn vào menu ba chấm (⋮) ở góc phải trình duyệt và chọn <strong>"Cài đặt ứng dụng"</strong> hoặc <strong>"Thêm vào màn hình chính"</strong>.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="pt-2 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setShowGuideModal(false)}
                                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                            >
                                Đã hiểu
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
