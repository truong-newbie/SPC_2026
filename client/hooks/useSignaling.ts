'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import { resolveSocketUrl } from '@/lib/socketUrl';

// Module-level singleton socket
let socketPromise: Promise<Socket> | null = null;

function getSocket(): Promise<Socket> {
    if (typeof window === 'undefined') return new Promise<Socket>(() => {});

    if (!socketPromise) {
        socketPromise = resolveSocketUrl().then((url) =>
            io(url, {
                reconnectionDelay: 500,
                reconnectionDelayMax: 3000,
            })
        );
    }
    return socketPromise;
}

export interface SignalPayload {
    target: string | null;
    signal: unknown;
}

export interface UseSignalingCallbacks {
    onSignal: (data: any) => void;
    onPeerDisconnected: () => void;
    onDisconnect: () => void;
    onConnectError: (err: Error) => void;
    onReconnect: () => void;
}

export function useSignaling(callbacks: UseSignalingCallbacks) {
    const [isConnected, setIsConnected] = useState(false);
    const [ping, setPing] = useState(0);

    const cbRef = useRef(callbacks);
    useEffect(() => {
        cbRef.current = callbacks;
    });

    useEffect(() => {
        let cancelled = false;
        let sock: Socket | null = null;
        let pingInterval: ReturnType<typeof setInterval> | null = null;

        getSocket().then((socket) => {
            if (cancelled) return;
            sock = socket;

            if (socket.connected) setIsConnected(true);

            socket.on('connect', () => setIsConnected(true));
            socket.on('disconnect', () => {
                setIsConnected(false);
                setPing(0);
                cbRef.current.onDisconnect();
            });
            socket.on('connect_error', (err) => {
                setIsConnected(false);
                cbRef.current.onConnectError(err);
            });
            socket.io.on('reconnect', () => cbRef.current.onReconnect());

            pingInterval = setInterval(() => {
                const start = performance.now();
                socket.emit('ping', () => {
                    const duration = performance.now() - start;
                    setPing(Number(duration.toFixed(2)));
                });
            }, 2000);

            socket.on('signal', (data: any) => cbRef.current.onSignal(data));
            socket.on('peer-disconnected', () => cbRef.current.onPeerDisconnected());
        });

        return () => {
            cancelled = true;
            if (pingInterval) clearInterval(pingInterval);
            if (!sock) return;
            sock.off('signal');
            sock.off('user-connected');
            sock.off('connect');
            sock.off('disconnect');
            sock.off('room-full');
            sock.off('room-joined');
            sock.off('peer-disconnected');
            sock.off('connect_error');
            sock.io.off('reconnect');
        };
    }, []);

    const joinRoom = useCallback((roomId: string) => {
        void getSocket().then((s) => s.emit('join-room', roomId));
    }, []);

    const sendSignal = useCallback((payload: SignalPayload) => {
        void getSocket().then((s) => s.emit('signal', payload));
    }, []);

    const onUserConnected = useCallback((handler: (userId: string) => void) => {
        void getSocket().then((s) => {
            s.off('user-connected');
            s.on('user-connected', handler);
        });
    }, []);

    const onRoomFull = useCallback((handler: () => void) => {
        void getSocket().then((s) => {
            s.off('room-full');
            s.on('room-full', handler);
        });
    }, []);

    const onRoomJoined = useCallback((handler: (data: { role: string }) => void) => {
        void getSocket().then((s) => {
            s.off('room-joined');
            s.on('room-joined', handler);
        });
    }, []);

    return {
        isConnected,
        setIsConnected,
        ping,
        joinRoom,
        sendSignal,
        onUserConnected,
        onRoomFull,
        onRoomJoined,
    };
}
