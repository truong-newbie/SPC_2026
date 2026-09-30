'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Activity, Zap, TrendingUp, CheckCircle2, X } from 'lucide-react';
import { formatSpeed } from '@/lib/download';

interface SpeedWaveformProps {
    currentBps: number;
    isActive: boolean;
    isComplete?: boolean;
    className?: string;
}

const MAX_POINTS = 32;

export function SpeedWaveform({ currentBps, isActive, isComplete = false, className = '' }: SpeedWaveformProps) {
    const [history, setHistory] = useState<number[]>(() => new Array(MAX_POINTS).fill(0));
    const [peakBps, setPeakBps] = useState<number>(0);
    const [isDismissed, setIsDismissed] = useState(false);
    const bpsRef = useRef(currentBps);

    // Update current BPS ref and peak
    useEffect(() => {
        bpsRef.current = currentBps;
        if (currentBps > peakBps) {
            setPeakBps(currentBps);
        }
    }, [currentBps, peakBps]);

    // Fast sampling (200ms) for high-fidelity 60fps waveform
    useEffect(() => {
        if (!isActive && !isComplete) {
            return;
        }

        if (isActive) {
            setIsDismissed(false);
            const interval = setInterval(() => {
                setHistory((prev) => {
                    const sample = bpsRef.current;
                    const next = [...prev.slice(1), sample];
                    return next;
                });
            }, 200);

            return () => clearInterval(interval);
        }
    }, [isActive, isComplete]);

    // Reset history when starting a fresh transfer from 0
    useEffect(() => {
        if (isActive && currentBps === 0 && peakBps === 0) {
            setHistory(new Array(MAX_POINTS).fill(0));
            setIsDismissed(false);
        }
    }, [isActive, currentBps, peakBps]);

    // Don't render if dismissed, or if completely inactive with 0 peak
    if (isDismissed) return null;
    if (!isActive && !isComplete && peakBps === 0) return null;

    // Calculate scaling
    const maxVal = Math.max(peakBps, 1024 * 512, ...history);
    const width = 360;
    const height = 56;
    const step = width / (MAX_POINTS - 1);

    // Compute coordinate points
    const points = history.map((val, idx) => {
        const x = idx * step;
        const normalized = maxVal > 0 ? val / maxVal : 0;
        const y = height - normalized * (height - 10) - 5;
        return { x, y };
    });

    // Build smooth SVG cubic bezier path
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
        <div className={`mt-3 p-3 bg-gradient-to-b from-blue-50/50 via-slate-50/50 to-indigo-50/40 border ${isComplete ? 'border-emerald-200/80' : 'border-blue-200/80'} rounded-2xl shadow-xs transition-all duration-300 ${className}`}>
            <div className="flex items-center justify-between text-xs mb-2">
                <div className="flex items-center gap-1.5 font-semibold">
                    {isComplete ? (
                        <div className="flex items-center gap-1.5 text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Hoàn tất truyền tệp</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-blue-700">
                            <Activity className="w-3.5 h-3.5 animate-pulse text-blue-600" />
                            <span>Băng thông thời gian thực</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2.5 text-[11px] text-slate-500">
                    {!isComplete && (
                        <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3 text-amber-500" />
                            <span>Tức thời:</span>
                            <strong className="text-slate-800 font-mono">{formatSpeed(currentBps)}</strong>
                        </span>
                    )}
                    <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-emerald-600" />
                        <span>Đỉnh (Peak):</span>
                        <strong className="text-emerald-700 font-mono font-bold">{formatSpeed(peakBps)}</strong>
                    </span>
                    {isComplete && (
                        <button
                            onClick={() => setIsDismissed(true)}
                            className="p-1 hover:bg-slate-200/60 rounded text-slate-400 hover:text-slate-700 transition-colors ml-1"
                            title="Đóng đồ thị"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>

            {/* SVG Waveform Chart */}
            <div className="relative w-full h-[56px] overflow-hidden rounded-xl bg-white/80 border border-slate-200/60 shadow-inner">
                {/* Horizontal reference grid lines */}
                <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-200/70 pointer-events-none" />
                <div className="absolute inset-x-0 top-1/4 border-t border-dotted border-slate-200/50 pointer-events-none" />

                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    preserveAspectRatio="none"
                    className="w-full h-full"
                >
                    <defs>
                        <linearGradient id={isComplete ? "waveComplete" : "waveGradient"} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={isComplete ? "#059669" : "#2563eb"} stopOpacity={isComplete ? "0.28" : "0.32"} />
                            <stop offset="70%" stopColor={isComplete ? "#10b981" : "#06b6d4"} stopOpacity={isComplete ? "0.10" : "0.12"} />
                            <stop offset="100%" stopColor={isComplete ? "#10b981" : "#06b6d4"} stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id={isComplete ? "lineComplete" : "lineGradient"} x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={isComplete ? "#34d399" : "#3b82f6"} />
                            <stop offset="50%" stopColor={isComplete ? "#059669" : "#2563eb"} />
                            <stop offset="100%" stopColor={isComplete ? "#10b981" : "#06b6d4"} />
                        </linearGradient>
                    </defs>

                    {/* Gradient Area Fill */}
                    <path d={areaD} fill={`url(#${isComplete ? "waveComplete" : "waveGradient"})`} />

                    {/* Stroke Curve */}
                    <path
                        d={pathD}
                        fill="none"
                        stroke={`url(#${isComplete ? "lineComplete" : "lineGradient"})`}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Pulsing Dot at current position (during active transfer) */}
                    {isActive && points.length > 0 && (
                        <>
                            <circle
                                cx={points[points.length - 1].x}
                                cy={points[points.length - 1].y}
                                r="4"
                                className="fill-blue-600 animate-ping"
                            />
                            <circle
                                cx={points[points.length - 1].x}
                                cy={points[points.length - 1].y}
                                r="3.2"
                                className="fill-blue-600 stroke-2 stroke-white shadow-sm"
                            />
                        </>
                    )}
                </svg>
            </div>
        </div>
    );
}
