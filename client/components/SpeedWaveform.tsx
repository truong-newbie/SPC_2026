'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Activity, Zap, TrendingUp } from 'lucide-react';
import { formatSpeed } from '@/lib/download';

interface SpeedWaveformProps {
    currentBps: number;
    isActive: boolean;
    className?: string;
}

const MAX_POINTS = 24;

export function SpeedWaveform({ currentBps, isActive, className = '' }: SpeedWaveformProps) {
    const [history, setHistory] = useState<number[]>(() => new Array(MAX_POINTS).fill(0));
    const [peakBps, setPeakBps] = useState<number>(0);
    const bpsRef = useRef(currentBps);

    useEffect(() => {
        bpsRef.current = currentBps;
        if (currentBps > peakBps) {
            setPeakBps(currentBps);
        }
    }, [currentBps, peakBps]);

    // Sample speed at fixed 600ms intervals for a steady chart
    useEffect(() => {
        if (!isActive) {
            setHistory(new Array(MAX_POINTS).fill(0));
            setPeakBps(0);
            return;
        }

        const interval = setInterval(() => {
            setHistory((prev) => {
                const next = [...prev.slice(1), bpsRef.current];
                return next;
            });
        }, 600);

        return () => clearInterval(interval);
    }, [isActive]);

    if (!isActive && currentBps === 0) return null;

    // Calculate scaling
    const maxVal = Math.max(peakBps, 1024 * 1024, ...history);
    const width = 320;
    const height = 54;
    const step = width / (MAX_POINTS - 1);

    // Compute coordinate points
    const points = history.map((val, idx) => {
        const x = idx * step;
        const normalized = maxVal > 0 ? val / maxVal : 0;
        const y = height - normalized * (height - 8) - 4;
        return { x, y };
    });

    // Build smooth SVG path using Catmull-Rom or cubic bezier
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i === 0 ? 0 : i - 1];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2 < points.length ? i + 2 : points.length - 1];

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        pathD += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

    return (
        <div className={`mt-3 p-3 bg-gradient-to-b from-blue-50/40 to-slate-50/60 border border-blue-100/80 rounded-2xl ${className}`}>
            <div className="flex items-center justify-between text-xs mb-2">
                <div className="flex items-center gap-1.5 text-blue-700 font-semibold">
                    <Activity className="w-3.5 h-3.5 animate-pulse text-blue-600" />
                    <span>Băng thông trực tiếp</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-500" />
                        Đang truyền: <strong className="text-slate-700 font-mono">{formatSpeed(currentBps)}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-emerald-600" />
                        Đỉnh: <strong className="text-slate-700 font-mono">{formatSpeed(peakBps)}</strong>
                    </span>
                </div>
            </div>

            {/* SVG Waveform Chart */}
            <div className="relative w-full h-[54px] overflow-hidden rounded-lg bg-white/70 border border-slate-200/50">
                {/* Horizontal reference grid lines */}
                <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-200/60 pointer-events-none" />
                <div className="absolute inset-x-0 top-1/4 border-t border-dotted border-slate-200/40 pointer-events-none" />

                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    preserveAspectRatio="none"
                    className="w-full h-full"
                >
                    <defs>
                        <linearGradient id="waveGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.32" />
                            <stop offset="70%" stopColor="#06b6d4" stopOpacity="0.12" />
                            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="50%" stopColor="#2563eb" />
                            <stop offset="100%" stopColor="#06b6d4" />
                        </linearGradient>
                    </defs>

                    {/* Gradient Area Fill */}
                    <path d={areaD} fill="url(#waveGradient)" />

                    {/* Stroke Curve */}
                    <path
                        d={pathD}
                        fill="none"
                        stroke="url(#lineGradient)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Pulsing Dot at current position */}
                    {points.length > 0 && (
                        <circle
                            cx={points[points.length - 1].x}
                            cy={points[points.length - 1].y}
                            r="3.5"
                            className="fill-blue-600 animate-ping"
                        />
                    )}
                    {points.length > 0 && (
                        <circle
                            cx={points[points.length - 1].x}
                            cy={points[points.length - 1].y}
                            r="3"
                            className="fill-blue-600 stroke-2 stroke-white shadow-sm"
                        />
                    )}
                </svg>
            </div>
        </div>
    );
}
