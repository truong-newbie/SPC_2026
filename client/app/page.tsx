'use client';

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

export default function Home() {
    return (
        <div className="min-h-screen">
            <P2PTransfer />
        </div>
    );
}
