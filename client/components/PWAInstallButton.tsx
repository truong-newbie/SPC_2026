'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, Check } from 'lucide-react';

export function PWAInstallButton({ className = '' }: { className?: string }) {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Register service worker if supported
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
        }

        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        const handleAppInstalled = () => {
            setIsInstalled(true);
            setDeferredPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        try {
            deferredPrompt.prompt();
            const choiceResult = await deferredPrompt.userChoice;
            if (choiceResult.outcome === 'accepted') {
                setIsInstalled(true);
            }
            setDeferredPrompt(null);
        } catch {
            // ignore
        }
    };

    if (isInstalled) {
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200 ${className}`}>
                <Check className="w-3.5 h-3.5" />
                <span>Đã cài ứng dụng</span>
            </span>
        );
    }

    if (!deferredPrompt) return null;

    return (
        <button
            onClick={handleInstallClick}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50/90 hover:bg-blue-100/90 rounded-lg border border-blue-200 transition-all shadow-xs cursor-pointer ${className}`}
            title="Cài đặt FileBridge thành ứng dụng độc lập trên Desktop / Mobile"
        >
            <Smartphone className="w-3.5 h-3.5 text-blue-600" />
            <span>Cài đặt App</span>
        </button>
    );
}
