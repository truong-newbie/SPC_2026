'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with WebRTC and Socket.IO
const P2PTransfer = dynamic(() => import('@/components/P2PTransfer'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
                <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Loading...</p>
            </div>
        </div>
    ),
});

const SwarmTransfer = dynamic(() => import('@/components/SwarmTransfer'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
                <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Loading...</p>
            </div>
        </div>
    ),
});

export default function Home() {
    const [mode, setMode] = useState<'p2p' | 'swarm'>('p2p');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('swarm')) {
                setMode('swarm');
            }
        }
    }, []);

    return (
        <div className="min-h-screen">
            {/* Mode Toggle */}
            <div className="flex justify-center pt-4">
                <div className="inline-flex rounded-lg border bg-background p-1">
                    <button
                        onClick={() => setMode('p2p')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            mode === 'p2p'
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                        }`}
                    >
                        1-to-1 Transfer
                    </button>
                    <button
                        onClick={() => setMode('swarm')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            mode === 'swarm'
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                        }`}
                    >
                        Swarm Sharing
                    </button>
                </div>
            </div>

            {/* Transfer Component */}
            {mode === 'p2p' ? <P2PTransfer /> : <SwarmTransfer />}
        </div>
    );
}
