'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import of transfer components to avoid SSR WebRTC issues
const P2PTransfer = dynamic(() => import('@/components/P2PTransfer'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center min-h-[40vh]">
            <div className="text-center space-y-3">
                <div className="h-10 w-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-400 font-mono">Đang khởi tạo P2P DataChannel...</p>
            </div>
        </div>
    ),
});

const SwarmTransfer = dynamic(() => import('@/components/SwarmTransfer'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center min-h-[40vh]">
            <div className="text-center space-y-3">
                <div className="h-10 w-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-400 font-mono">Đang nạp bộ điều phối Swarm Tracker...</p>
            </div>
        </div>
    ),
});

const StoredTransfer = dynamic(() => import('@/components/StoredTransfer'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center min-h-[40vh]">
            <div className="text-center space-y-3">
                <div className="h-10 w-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-400 font-mono">Đang nạp mô-đun Zero-Knowledge E2EE...</p>
            </div>
        </div>
    ),
});

type TabType = 'transfer' | 'about' | 'security' | 'privacy' | 'faq' | 'roadmap';
type TransferMode = 'p2p' | 'swarm' | 'stored';

export default function Home() {
    const [activeTab, setActiveTab] = useState<TabType>('transfer');
    const [transferMode, setTransferMode] = useState<TransferMode>('p2p');
    const [currentLang, setCurrentLang] = useState<'vi' | 'en'>('vi');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const hash = window.location.hash.replace('#', '');

            // Auto-detect transfer mode from params or hash
            if (params.get('stored')) {
                setTransferMode('stored');
                setActiveTab('transfer');
            } else if (params.get('swarm')) {
                setTransferMode('swarm');
                setActiveTab('transfer');
            } else if (hash.startsWith('room-') || params.get('room')) {
                setTransferMode('p2p');
                setActiveTab('transfer');
            } else if (['about', 'security', 'privacy', 'faq', 'roadmap', 'transfer'].includes(hash)) {
                setActiveTab(hash as TabType);
            }

            // Keyboard shortcuts: 1..6 to switch tabs
            const handleKeyDown = (e: KeyboardEvent) => {
                if (['input', 'textarea'].includes((document.activeElement?.tagName || '').toLowerCase())) return;
                const tabs: TabType[] = ['transfer', 'about', 'security', 'privacy', 'faq', 'roadmap'];
                const num = parseInt(e.key, 10);
                if (num >= 1 && num <= 6) {
                    switchTab(tabs[num - 1]);
                }
            };
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, []);

    const switchTab = (tab: TabType) => {
        setActiveTab(tab);
        if (typeof window !== 'undefined') {
            history.replaceState(null, '', '#' + tab);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <div className="flex flex-col min-h-screen">
            {/* TOP CRAFTED NAVIGATION BAR */}
            <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#04070e]/85 backdrop-blur-xl">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    {/* Brand Logo with Linear-Grade Emblem */}
                    <button
                        onClick={() => switchTab('transfer')}
                        className="flex items-center gap-3.5 group text-left focus:outline-none"
                    >
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-b from-cyan-400 to-blue-600 p-[1px] shadow-glow-subtle transition-transform duration-300 group-hover:scale-105">
                            <div className="w-full h-full bg-[#060a14] rounded-[11px] flex items-center justify-center relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 to-transparent"></div>
                                <svg
                                    className="w-4 h-4 text-cyan-400 transition-colors group-hover:text-cyan-300"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M4 11V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5" />
                                    <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                                    <path d="m9 11 3 3 3-3" />
                                    <circle cx="12" cy="14" r="1" />
                                </svg>
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-lg tracking-[-0.03em] text-white group-hover:text-cyan-300 transition-colors">
                                    FileBridge
                                </span>
                                <span
                                    className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-white/[0.05] text-cyan-300 border border-white/[0.08] shadow-inner-bevel"
                                    title="Dự án dự thi SPC 2026"
                                >
                                    SPC 2026 Edition
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono hidden sm:block">
                                Zero-Knowledge &amp; Direct P2P Protocol
                            </p>
                        </div>
                    </button>

                    {/* Status Indicator & Live Signal */}
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs font-mono text-slate-300">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span>P2P DataChannel: Sẵn sàng</span>
                        </div>
                        <button
                            onClick={() => switchTab('transfer')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-glow-subtle transition-all active:scale-95"
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M12 5v14M5 12h14" />
                            </svg>
                            <span>Gửi file ngay</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 pt-10 pb-16">
                {/* =================================================================== */}
                {/* TAB 0: TRUYỀN TỆP (DEFAULT SCREEN) */}
                {/* =================================================================== */}
                {activeTab === 'transfer' && (
                    <section className="space-y-8 animate-fadeIn">
                        {/* App Hero Header */}
                        <div className="text-center space-y-3.5">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/25">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                                <span>WebRTC DataChannel • DTLS 1.3 Encryption • Zero-Knowledge</span>
                            </div>
                            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-[-0.035em] text-white leading-[1.15]">
                                Chuyển Tệp Siêu Tốc &amp; <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-300 bg-clip-text text-transparent">Bảo Mật Tuyệt Đối</span>
                            </h1>
                            <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto font-normal leading-relaxed">
                                Truyền trực tiếp giữa các trình duyệt không qua máy chủ trung gian, hoặc lưu tạm mã hóa đầu cuối với mật khẩu do bạn nắm giữ.
                            </p>
                        </div>

                        {/* LIVE ANIMATED P2P TRANSMISSION DIAGRAM (CRAFTED VISUAL ASSET) */}
                        <div className="tech-card rounded-xl p-5 sm:p-6 relative overflow-hidden">
                            <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] text-xs font-mono">
                                <div className="flex items-center gap-2 text-slate-400">
                                    <span className="inline-block w-2 h-2 rounded-full bg-cyan-400"></span>
                                    <span className="text-slate-300 font-semibold">TRUYỀN TRỰC TIẾP NGANG HÀNG</span>
                                </div>
                                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                    <span className="text-emerald-400 font-semibold">E2EE: AES-256-GCM</span>
                                    <span className="hidden sm:inline text-slate-600">|</span>
                                    <span className="hidden sm:inline">Máy chủ lưu: <strong className="text-white">0 Byte</strong></span>
                                </div>
                            </div>

                            <div className="py-6 sm:py-8 px-2 flex items-center justify-between relative">
                                {/* Left Node: Sender */}
                                <div className="flex flex-col items-center gap-2 relative z-10 w-28 sm:w-36 text-center">
                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-b from-cyan-500/20 to-blue-600/10 border border-cyan-500/30 flex items-center justify-center shadow-glow-subtle relative group">
                                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#080d1a]"></div>
                                        <svg className="w-7 h-7 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                            <line x1="8" y1="21" x2="16" y2="21" />
                                            <line x1="12" y1="17" x2="12" y2="21" />
                                        </svg>
                                    </div>
                                    <span className="text-xs font-bold text-white tracking-tight">Người gửi (Bạn)</span>
                                    <span className="text-[10px] font-mono text-cyan-400/80 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/20">Peer-Local</span>
                                </div>

                                {/* Center Laser DataChannel Beam with Floating Packets */}
                                <div className="flex-1 px-4 relative flex flex-col items-center justify-center">
                                    <div className="w-full h-[2px] bg-gradient-to-r from-cyan-500/30 via-cyan-400 to-cyan-500/30 relative">
                                        <div className="absolute -top-[5px] left-0 w-3 h-3 rounded-full bg-cyan-300 shadow-glow-cyan packet-dot"></div>
                                        <div className="absolute -top-[3px] left-1/4 w-2 h-2 rounded-full bg-emerald-300 packet-dot" style={{ animationDelay: '0.7s' }}></div>
                                        <div className="absolute -top-[4px] left-1/2 w-2.5 h-2.5 rounded-full bg-blue-300 packet-dot" style={{ animationDelay: '1.4s' }}></div>
                                    </div>

                                    <div className="mt-3 px-3 py-1 rounded-full bg-[#0a1122] border border-cyan-500/30 shadow-inner-bevel flex items-center gap-1.5 text-[11px] font-mono text-cyan-300">
                                        <svg className="w-3.5 h-3.5 text-cyan-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                        </svg>
                                        <span>Đường hầm P2P trực tiếp</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-500 mt-1">Không nén • Không lưu đệm</span>
                                </div>

                                {/* Right Node: Receiver */}
                                <div className="flex flex-col items-center gap-2 relative z-10 w-28 sm:w-36 text-center">
                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-b from-blue-500/20 to-indigo-600/10 border border-blue-500/30 flex items-center justify-center shadow-glow-subtle relative group">
                                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400 border-2 border-[#080d1a] animate-pulse"></div>
                                        <svg className="w-7 h-7 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                                            <line x1="12" y1="18" x2="12.01" y2="18" />
                                        </svg>
                                    </div>
                                    <span className="text-xs font-bold text-white tracking-tight">Người nhận</span>
                                    <span className="text-[10px] font-mono text-blue-400/80 bg-blue-950/40 px-2 py-0.5 rounded border border-blue-500/20">Peer-Remote</span>
                                </div>
                            </div>
                        </div>

                        {/* Transfer Mode Selector */}
                        <div className="flex justify-center">
                            <div className="inline-flex p-1 rounded-xl bg-[#080d1a] border border-white/[0.08] shadow-inner-bevel">
                                <button
                                    onClick={() => setTransferMode('p2p')}
                                    className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                                        transferMode === 'p2p'
                                            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-glow-subtle'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    1-to-1 Transfer (P2P)
                                </button>
                                <button
                                    onClick={() => setTransferMode('swarm')}
                                    className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                                        transferMode === 'swarm'
                                            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-glow-subtle'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    Swarm Sharing (BitTorrent)
                                </button>
                                <button
                                    onClick={() => setTransferMode('stored')}
                                    className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                                        transferMode === 'stored'
                                            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-glow-subtle'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    Lưu tạm E2EE (500MB)
                                </button>
                            </div>
                        </div>

                        {/* Active Functional Transfer Component */}
                        <div className="tech-card rounded-xl p-6 sm:p-8 space-y-6 relative corner-cross">
                            {transferMode === 'p2p' ? (
                                <P2PTransfer />
                            ) : transferMode === 'swarm' ? (
                                <SwarmTransfer />
                            ) : (
                                <StoredTransfer />
                            )}

                            {/* Information Badges */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-white/[0.06] text-xs text-slate-400 font-mono">
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                                    <span>Không cần tài khoản</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                    <span>Mã hóa WebCrypto E2EE</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                                    <span>Tốc độ tối đa đường truyền</span>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* =================================================================== */}
                {/* TAB 1: VỀ CHÚNG TÔI (ABOUT US) */}
                {/* =================================================================== */}
                {activeTab === 'about' && (
                    <section className="space-y-12 animate-fadeIn">
                        <div className="space-y-3.5">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/25">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                                Sứ mệnh bảo vệ dữ liệu &amp; quyền tự do số
                            </div>
                            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-[-0.035em] text-white leading-tight">
                                Về FileBridge
                            </h1>
                            <p className="text-base text-cyan-300/90 font-medium">
                                Tại sao chúng tôi xây dựng nền tảng này?
                            </p>
                        </div>

                        <div className="space-y-6 text-slate-300 text-sm sm:text-base leading-relaxed">
                            <p>
                                Chúng tôi tạo ra <strong>FileBridge</strong> (dự án phát triển tranh tài tại cuộc thi <em>SPC 2026</em>) bắt đầu từ một nỗi trăn trở có thật mà bất kỳ ai làm việc với dữ liệu số đều từng trải qua: khi bạn cần gửi một thước phim 4K sắc nét, một bản vẽ kiến trúc 3D hay tài liệu nội bộ qua các ứng dụng chat hoặc đám mây phổ biến, thuật toán của họ âm thầm <em>nén nát tập tin</em> của bạn nhằm tiết kiệm chi phí băng thông máy chủ cho chính họ.
                            </p>
                            <p>
                                Kết quả là tệp tin bị giảm chất lượng, hình ảnh nhòe mờ. Nhưng điều đáng lo ngại hơn là: <strong>sự riêng tư của bạn bị tước đoạt</strong>.
                            </p>

                            <div className="tech-card p-6 sm:p-7 rounded-xl border-l-2 border-l-cyan-400 my-8 shadow-glow-subtle">
                                <h3 className="text-base font-bold text-white mb-2 tracking-tight">Kỷ nguyên &ldquo;Khai thác dữ liệu người dùng&rdquo;</h3>
                                <p className="text-slate-300 text-sm leading-relaxed mb-4">
                                    Ngày nay, các tập đoàn Big Tech mặc định coi dữ liệu tải lên máy chủ của họ là nguồn tài nguyên miễn phí. Hợp đồng kinh doanh, bản nháp sáng tạo chưa công bố, hay hình ảnh gia đình riêng tư đều có nguy cơ bị quét tự động, phân tích hành vi và trở thành nguyên liệu huấn luyện cho các mô hình AI của họ.
                                </p>
                                <blockquote className="italic text-cyan-300 text-sm font-medium font-mono">
                                    &ldquo;Sự riêng tư không phải là một đặc quyền xa xỉ. Đó là quyền cơ bản của mỗi con người trong kỷ nguyên số.&rdquo;
                                </blockquote>
                            </div>

                            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight pt-2">Lời đáp trả từ FileBridge</h2>
                            <p>
                                Chúng tôi tin rằng: <strong>Dữ liệu của bạn là của riêng bạn</strong>. Tập tin bạn tạo ra thuộc về bạn, không phải của bất kỳ thuật toán quét dữ liệu nào.
                            </p>
                            <p>
                                FileBridge không phải là một mạng xã hội, cũng không phải một dịch vụ lưu trữ đám mây tò mò thu thập dữ liệu cá nhân. Chúng tôi cung cấp giải pháp <strong>vận chuyển dữ liệu trực tiếp ngang hàng (P2P)</strong> và <strong>lưu tạm mã hóa Zero-Knowledge</strong> với tốc độ tối đa của đường truyền mạng.
                            </p>
                        </div>

                        <div className="space-y-4 pt-2">
                            <h3 className="text-xs uppercase tracking-widest font-mono text-cyan-400 font-semibold">Triết lý thiết kế cốt lõi</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="tech-card p-5 sm:p-6 rounded-xl space-y-3">
                                    <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold font-mono text-xs border border-cyan-500/20">
                                        01
                                    </div>
                                    <h4 className="text-sm font-bold text-white tracking-tight">Peer-to-Peer (P2P)</h4>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        Truyền trực tiếp từ trình duyệt sang trình duyệt qua WebRTC. Không máy chủ trung gian xem trộm, không giới hạn dung lượng lý thuyết.
                                    </p>
                                </div>

                                <div className="tech-card p-5 sm:p-6 rounded-xl space-y-3">
                                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold font-mono text-xs border border-blue-500/20">
                                        02
                                    </div>
                                    <h4 className="text-sm font-bold text-white tracking-tight">Pure Quality (100%)</h4>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        Bảo toàn nguyên vẹn 100% dung lượng và chất lượng file bit-for-bit. Bạn gửi 5GB, người nhận nhận đúng 5GB không sai một byte.
                                    </p>
                                </div>

                                <div className="tech-card p-5 sm:p-6 rounded-xl space-y-3">
                                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold font-mono text-xs border border-emerald-500/20">
                                        03
                                    </div>
                                    <h4 className="text-sm font-bold text-white tracking-tight">Privacy by Math</h4>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        Không bắt buộc đăng ký tài khoản, không thu thập email hay số điện thoại. Bảo mật bằng mật mã học AES-256-GCM và WebCrypto.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* =================================================================== */}
                {/* TAB 2: BẢO MẬT (SECURITY) */}
                {/* =================================================================== */}
                {activeTab === 'security' && (
                    <section className="space-y-12 animate-fadeIn">
                        <div className="space-y-3.5">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                                <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                                Kiến trúc mật mã bảo vệ tuyệt đối
                            </div>
                            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-[-0.035em] text-white leading-tight">
                                Zero-Knowledge by Design
                            </h1>
                            <p className="text-base text-slate-300 font-medium">
                                Tại FileBridge, &ldquo;Bảo mật&rdquo; không phải là một tính năng gắn thêm. Nó là nền móng cốt lõi toán học của toàn bộ hệ thống.
                            </p>
                        </div>

                        <div className="space-y-6 text-slate-300 text-sm sm:text-base leading-relaxed">
                            <p>
                                Chúng tôi áp dụng triết lý <strong>Zero-Knowledge (Không lưu trữ và không thể xem thông tin)</strong>. Nghĩa là về mặt toán học và hạ tầng kỹ thuật, máy chủ của FileBridge hoàn toàn &ldquo;mù tịt&rdquo; trước nội dung bạn đang truyền tải.
                            </p>

                            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight pt-2">Ba Tầng Bảo Vệ Toàn Diện</h2>

                            {/* Layer 1 */}
                            <div className="tech-card p-6 rounded-xl space-y-3 border-l-2 border-l-cyan-400">
                                <div className="flex items-center gap-2.5">
                                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-cyan-500/20 text-cyan-300">TẦNG 1</span>
                                    <h3 className="text-base font-bold text-white">Truyền trực tiếp Peer-to-Peer (WebRTC DataChannel)</h3>
                                </div>
                                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                                    Khi 2 máy tính kết nối với nhau, máy chủ chỉ làm nhiệm vụ kết nối ban đầu (Signaling SDP/ICE). Sau khi kênh dữ liệu mở thành công, dữ liệu tập tin bay trực tiếp giữa 2 thiết bị qua đường hầm mã hóa <strong>DTLS 1.3 / SRTP</strong>. Máy chủ không hề lưu lại hoặc đọc bất kỳ byte dữ liệu nào của file.
                                </p>
                            </div>

                            {/* Layer 2 */}
                            <div className="tech-card p-6 rounded-xl space-y-3 border-l-2 border-l-blue-400">
                                <div className="flex items-center gap-2.5">
                                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-500/20 text-blue-300">TẦNG 2</span>
                                    <h3 className="text-base font-bold text-white">Mạng lưới Swarm Sharing &amp; Băm toàn vẹn (BitTorrent Web)</h3>
                                </div>
                                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                                    Tệp tin được chia nhỏ thành các mảnh (pieces) từ 256KB đến 1MB. Mỗi mảnh được gán mã băm toàn vẹn SHA-256 để đảm bảo không một nút trung gian nào có thể can thiệp hoặc sửa đổi dữ liệu trong quá trình chia sẻ giữa các peer.
                                </p>
                            </div>

                            {/* Layer 3 */}
                            <div className="tech-card p-6 rounded-xl space-y-4 border-l-2 border-l-emerald-400">
                                <div className="flex items-center gap-2.5">
                                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300">TẦNG 3</span>
                                    <h3 className="text-base font-bold text-white">Lưu tạm E2EE (Client-Side Encryption) &amp; Tự hủy (Burn)</h3>
                                </div>
                                <div className="text-xs sm:text-sm text-slate-300 space-y-3 leading-relaxed">
                                    <p>Khi người nhận chưa online, bạn có thể chọn chế độ <strong>Lưu tạm E2EE</strong>:</p>
                                    <ul className="list-disc list-inside space-y-2 text-slate-300 pl-1 font-mono text-xs">
                                        <li><strong className="text-white">Mã hóa ngay trên RAM máy bạn:</strong> Sử dụng <code>PBKDF2</code> (100,000 vòng lặp) và thuật toán <code>AES-256-GCM</code> Web Crypto API. File biến thành bản mã vô nghĩa (.enc) trước khi gửi lên server.</li>
                                        <li><strong className="text-white">Đường link chứa Chìa khóa (#hash):</strong> Mật khẩu giải mã được đặt ở URL hash. Theo chuẩn RFC 3986, trình duyệt <em>không bao giờ gửi nội dung sau dấu # lên máy chủ</em>. Máy chủ không có chìa khóa mở file.</li>
                                        <li><strong className="text-white">Cơ chế Tự hủy (Burn After Reading &amp; TTL):</strong> File sẽ tự động bị xóa sạch khỏi máy chủ sau khi hết hạn (1h-24h) hoặc xóa ngay lập tức sau 1 lần tải thành công duy nhất.</li>
                                    </ul>
                                </div>
                            </div>

                            {/* Transparency Table */}
                            <div className="pt-4">
                                <h3 className="text-lg font-bold text-white mb-4 tracking-tight">Minh bạch: Chúng tôi biết gì và không biết gì?</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="tech-card p-5 rounded-xl border-emerald-500/25 bg-emerald-950/[0.08]">
                                        <div className="text-[11px] uppercase tracking-wider font-mono font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
                                            <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
                                            NHỮNG GÌ MÁY CHỦ BIẾT
                                        </div>
                                        <ul className="text-xs text-slate-300 space-y-2 leading-relaxed">
                                            <li>• Dung lượng bản mã ước tính (để kiểm tra giới hạn 500MB).</li>
                                            <li>• Thời điểm tệp tải lên và thời hạn tự hủy (để sweeper xóa file định kỳ).</li>
                                            <li>• Số lượt tải (để kích hoạt tự hủy sau 1 lần tải thành công).</li>
                                        </ul>
                                    </div>

                                    <div className="tech-card p-5 rounded-xl border-cyan-500/25 bg-cyan-950/[0.08]">
                                        <div className="text-[11px] uppercase tracking-wider font-mono font-bold text-cyan-400 mb-2 flex items-center gap-1.5">
                                            <svg className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                                            NHỮNG GÌ MÁY CHỦ KHÔNG THỂ BIẾT
                                        </div>
                                        <ul className="text-xs text-slate-300 space-y-2 leading-relaxed">
                                            <li>• Mật khẩu giải mã và chìa khóa bảo mật của bạn.</li>
                                            <li>• Tên tập tin gốc, nội dung bên trong file (ảnh, video, văn bản hay mã nguồn).</li>
                                            <li>• Danh tính người gửi và người nhận (không cần tài khoản).</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* =================================================================== */}
                {/* TAB 3: CHÍNH SÁCH (PRIVACY & TERMS) */}
                {/* =================================================================== */}
                {activeTab === 'privacy' && (
                    <section className="space-y-12 animate-fadeIn">
                        <div className="space-y-3.5">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/25">
                                <svg className="w-3.5 h-3.5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                </svg>
                                Minh bạch pháp lý bằng ngôn ngữ rõ ràng
                            </div>
                            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-[-0.035em] text-white leading-tight">
                                Chính Sách &amp; Quyền Riêng Tư
                            </h1>
                            <p className="text-base text-slate-300 font-medium">
                                Chúng tôi tin rằng các điều khoản nên được viết bằng ngôn ngữ con người có thể hiểu được, không phải những trang bẫy từ ngữ pháp lý mơ hồ.
                            </p>
                        </div>

                        <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
                            <div className="tech-card p-6 sm:p-7 rounded-xl space-y-4">
                                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5 tracking-tight">
                                    <span className="w-6 h-6 rounded-md bg-cyan-500/20 text-cyan-400 inline-flex items-center justify-center text-xs font-mono font-bold">1</span>
                                    Chính sách Quyền riêng tư (Privacy Policy)
                                </h3>
                                <p>
                                    <strong>Triết lý thu thập tối thiểu (Data Minimization):</strong> Do kiến trúc truyền tệp P2P và Mã hóa đầu cuối E2EE, chúng tôi không có khả năng kỹ thuật để giải mã, xem hay biết nội dung các tệp bạn gửi.
                                </p>
                                <div className="bg-black/40 p-4 rounded-lg space-y-2 border border-white/5">
                                    <div className="text-emerald-400 font-semibold text-xs uppercase tracking-wider font-mono flex items-center gap-1.5">
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                        CAM KẾT TUYỆT ĐỐI KHÔNG ĐÀO TẠO AI (NO-AI-TRAINING)
                                    </div>
                                    <p className="text-xs text-slate-300">
                                        Chúng tôi cam kết <strong>KHÔNG BAO GIỜ</strong> bán dữ liệu, và <strong>KHÔNG BAO GIỜ</strong> sử dụng tệp tin của người dùng để huấn luyện cho bất kỳ mô hình Trí tuệ Nhân tạo (AI) nào, dù là nội bộ hay của bên thứ ba.
                                    </p>
                                </div>
                            </div>

                            <div className="tech-card p-6 sm:p-7 rounded-xl space-y-4">
                                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5 tracking-tight">
                                    <span className="w-6 h-6 rounded-md bg-blue-500/20 text-blue-400 inline-flex items-center justify-center text-xs font-mono font-bold">2</span>
                                    Điều khoản Sử dụng có trách nhiệm (Acceptable Use)
                                </h3>
                                <p>
                                    FileBridge được tạo ra nhằm phục vụ việc chuyển dữ liệu hợp pháp và an toàn giữa các cá nhân, tổ chức. Khi sử dụng nền tảng, bạn đồng ý không tải lên hoặc phát tán:
                                </p>
                                <ol className="list-decimal list-inside space-y-1.5 pl-2 text-slate-300 text-xs sm:text-sm">
                                    <li>Mã độc, phần mềm gián điệp, virus hoặc ransomware.</li>
                                    <li>Tài liệu xâm hại hoặc lạm dụng trẻ em (CSAM).</li>
                                    <li>Nội dung vi phạm nghiêm trọng bản quyền sở hữu trí tuệ.</li>
                                    <li>Dữ liệu đánh cắp từ tài khoản ngân hàng hoặc phục vụ hành vi lừa đảo (Phishing).</li>
                                </ol>
                                <p className="text-xs text-slate-400">
                                    Mặc dù chúng tôi không xem được nội dung tệp, nếu một liên kết bị cộng đồng báo cáo lạm dụng công khai, chúng tôi có quyền vô hiệu hóa và xóa gói dữ liệu mã hóa đó ngay lập tức.
                                </p>
                            </div>

                            <div className="tech-card p-6 sm:p-7 rounded-xl space-y-4">
                                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5 tracking-tight">
                                    <span className="w-6 h-6 rounded-md bg-indigo-500/20 text-indigo-400 inline-flex items-center justify-center text-xs font-mono font-bold">3</span>
                                    Miễn trừ Trách nhiệm &amp; Trách nhiệm sao lưu
                                </h3>
                                <p>
                                    Nền tảng được cung cấp theo nguyên tắc <strong>&ldquo;nguyên trạng&rdquo; (as-is)</strong>. Vì toàn bộ khóa mã hóa nằm trong tay bạn, nếu bạn làm mất đường link chứa mật khẩu, <strong>không ai (kể cả đội ngũ FileBridge) có thể giải mã hay khôi phục lại dữ liệu cho bạn</strong>. Người dùng có trách nhiệm lưu trữ an toàn các bản sao của dữ liệu quan trọng.
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                {/* =================================================================== */}
                {/* TAB 4: FAQ (CÂU HỎI THƯỜNG GẶP) */}
                {/* =================================================================== */}
                {activeTab === 'faq' && (
                    <section className="space-y-12 animate-fadeIn">
                        <div className="space-y-3.5">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/25">
                                <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                                Giải đáp minh bạch mọi thắc mắc
                            </div>
                            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-[-0.035em] text-white leading-tight">
                                Câu Hỏi Thường Gặp (FAQ)
                            </h1>
                            <p className="text-base text-slate-300 font-medium">
                                Mọi thắc mắc của bạn về cách FileBridge hoạt động, giới hạn dung lượng và tính an toàn.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <div className="tech-card p-5 sm:p-6 rounded-xl space-y-2">
                                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                                    <span className="text-cyan-400 font-mono text-xs">01.</span>
                                    Kích thước tệp tối đa tôi có thể gửi là bao nhiêu?
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pl-6">
                                    - <strong>Chế độ 1-to-1 P2P &amp; Swarm Sharing:</strong> Không giới hạn dung lượng từ máy chủ, vì file được truyền trực tiếp từ máy bạn sang máy người nhận qua WebRTC DataChannel. Bạn có thể gửi file 10GB, 30GB hay 50GB tùy vào cấu hình RAM và mạng.<br />
                                    - <strong>Chế độ Lưu tạm E2EE:</strong> Giới hạn tối đa <strong>500 MB</strong> cho mỗi gói file (hỗ trợ đóng gói nhiều file thành một) để máy chủ phục vụ lưu trữ đệm cho cộng đồng.
                                </p>
                            </div>

                            <div className="tech-card p-5 sm:p-6 rounded-xl space-y-2">
                                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                                    <span className="text-cyan-400 font-mono text-xs">02.</span>
                                    Tập tin của tôi có bị nén hay suy hao chất lượng không?
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pl-6">
                                    Tuyệt đối không! FileBridge bảo toàn 100% dữ liệu gốc bit-by-bit. File ảnh RAW, video 4K ProRes hay tập tin nén ZIP được giữ nguyên dung lượng, chất lượng và siêu dữ liệu không suy giảm một byte nào.
                                </p>
                            </div>

                            <div className="tech-card p-5 sm:p-6 rounded-xl space-y-2">
                                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                                    <span className="text-cyan-400 font-mono text-xs">03.</span>
                                    Tôi có cần phải đăng ký tài khoản hay đăng nhập không?
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pl-6">
                                    Hoàn toàn <strong>KHÔNG</strong>. FileBridge được thiết kế tôn trọng sự tự do và tính ẩn danh. Bạn không cần đăng ký tài khoản, không cần nhập email hay số điện thoại. Chỉ cần mở trình duyệt web lên và thực hiện chia sẻ ngay lập tức.
                                </p>
                            </div>

                            <div className="tech-card p-5 sm:p-6 rounded-xl space-y-2">
                                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                                    <span className="text-cyan-400 font-mono text-xs">04.</span>
                                    Chế độ Swarm Sharing hoạt động như thế nào?
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pl-6">
                                    Swarm Sharing hoạt động tương tự nguyên lý của mạng lưới BitTorrent: khi một file được chia sẻ cho nhiều người nhận, những người đã nhận được một phần dữ liệu sẽ đồng thời hỗ trợ gửi mảnh dữ liệu đó cho những người khác trong mạng lưới. Càng nhiều người cùng tải thì tốc độ truyền càng nhanh và giảm tải tối đa cho máy người gửi ban đầu.
                                </p>
                            </div>

                            <div className="tech-card p-5 sm:p-6 rounded-xl space-y-2">
                                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                                    <span className="text-cyan-400 font-mono text-xs">05.</span>
                                    Nếu tôi làm mất đường link chứa mật khẩu, tôi có lấy lại được file không?
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pl-6">
                                    Không thể. Do chúng tôi áp dụng mã hóa Zero-Knowledge, mật khẩu chỉ nằm trên đường link hoặc do bạn giữ, server không hề biết mật khẩu. Nếu làm mất link chứa mật khẩu, dữ liệu sẽ vĩnh viễn không thể giải mã.
                                </p>
                            </div>

                            <div className="tech-card p-5 sm:p-6 rounded-xl space-y-2">
                                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                                    <span className="text-cyan-400 font-mono text-xs">06.</span>
                                    Tính năng &ldquo;Tự hủy sau 1 lần tải&rdquo; (Burn After Reading) là gì?
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pl-6">
                                    Khi người gửi kích hoạt tùy chọn này trong tab Lưu tạm E2EE, ngay sau khi người nhận tải xong toàn bộ tập tin lần đầu tiên, máy chủ sẽ lập tức hủy bỏ và xóa vĩnh viễn bản mã khỏi đĩa cứng. Không ai có thể tải lại file này lần thứ hai.
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                {/* =================================================================== */}
                {/* TAB 5: LỘ TRÌNH (ROADMAP) */}
                {/* =================================================================== */}
                {activeTab === 'roadmap' && (
                    <section className="space-y-12 animate-fadeIn">
                        <div className="space-y-3.5">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-medium bg-purple-500/10 text-purple-400 border border-purple-500/25">
                                <svg className="w-3.5 h-3.5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                                </svg>
                                Xây dựng minh bạch cùng cộng đồng (Build in Public)
                            </div>
                            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-[-0.035em] text-white leading-tight">
                                Lộ Trình Phát Triển
                            </h1>
                            <p className="text-base text-slate-300 font-medium">
                                Hành trình phát triển kiến trúc chia sẻ tệp thế hệ mới của FileBridge (SPC 2026 Edition).
                            </p>
                        </div>

                        <div className="relative pl-6 sm:pl-10 space-y-8 timeline-line">
                            {/* Stage 1 */}
                            <div className="relative space-y-2.5">
                                <div className="absolute -left-[33px] sm:-left-[49px] top-1 w-5 h-5 rounded-full bg-cyan-500 border-4 border-[#04070e] flex items-center justify-center shadow-glow-subtle">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></div>
                                </div>
                                <div>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                        HIỆN TẠI — ĐÃ HOÀN THÀNH
                                    </span>
                                    <h3 className="text-base sm:text-lg font-bold text-white mt-1 tracking-tight">Giai đoạn 1: Nền tảng cốt lõi (The MVP)</h3>
                                </div>
                                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                                    Tập trung tối đa vào độ ổn định kết nối, truyền tải dữ liệu nguyên bản và kiến trúc Zero-Knowledge.
                                </p>
                                <ul className="text-xs text-slate-300 space-y-2 tech-card p-4 rounded-xl">
                                    <li className="flex items-center gap-2 text-cyan-300">
                                        <svg className="w-3.5 h-3.5 text-cyan-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                        Giao diện kéo thả hiện đại, không cần đăng nhập hay cấu hình phức tạp.
                                    </li>
                                    <li className="flex items-center gap-2 text-cyan-300">
                                        <svg className="w-3.5 h-3.5 text-cyan-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                        Truyền trực tiếp 1-1 qua WebRTC DataChannel (kèm STUN/TURN fallback).
                                    </li>
                                    <li className="flex items-center gap-2 text-cyan-300">
                                        <svg className="w-3.5 h-3.5 text-cyan-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                        Mạng lưới Swarm Sharing chia sẻ đa điểm theo mảnh băm 256KB-1MB.
                                    </li>
                                    <li className="flex items-center gap-2 text-cyan-300">
                                        <svg className="w-3.5 h-3.5 text-cyan-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                        Lưu tạm E2EE Zero-Knowledge (AES-256-GCM) kèm TTL và tự hủy sau 1 lần tải (Burn).
                                    </li>
                                </ul>
                            </div>

                            {/* Stage 2 */}
                            <div className="relative space-y-2.5">
                                <div className="absolute -left-[33px] sm:-left-[49px] top-1 w-5 h-5 rounded-full bg-blue-500 border-4 border-[#04070e]"></div>
                                <div>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                        KẾ HOẠCH — QUÝ TIẾP THEO
                                    </span>
                                    <h3 className="text-base sm:text-lg font-bold text-white mt-1 tracking-tight">Giai đoạn 2: Tự động phục hồi &amp; Chia sẻ Thư mục</h3>
                                </div>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    Nâng cao độ bền bỉ khi truyền các tệp tin khổng lồ qua đường truyền mạng chập chờn.
                                </p>
                                <ul className="text-xs text-slate-300 space-y-2 tech-card p-4 rounded-xl">
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                        Resumable Transfer: Tiếp tục tải tự động khi mạng mất kết nối mà không phải truyền lại từ đầu.
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                        Folder Tree Drag-and-Drop: Kéo thả nguyên thư mục giữ trọn cấu trúc cây thư mục con.
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                        Local LAN Discovery: Tự nhận diện các thiết bị cùng mạng Wi-Fi/LAN để truyền tốc độ cao không tốn băng thông internet.
                                    </li>
                                </ul>
                            </div>

                            {/* Stage 3 */}
                            <div className="relative space-y-2.5">
                                <div className="absolute -left-[33px] sm:-left-[49px] top-1 w-5 h-5 rounded-full bg-indigo-500 border-4 border-[#04070e]"></div>
                                <div>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                        NĂM 2027
                                    </span>
                                    <h3 className="text-base sm:text-lg font-bold text-white mt-1 tracking-tight">Giai đoạn 3: Đa nền tảng &amp; Ứng dụng Chuyên dụng</h3>
                                </div>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    Mở rộng khả năng tích hợp cho lập trình viên và người dùng chuyên nghiệp.
                                </p>
                                <ul className="text-xs text-slate-300 space-y-2 tech-card p-4 rounded-xl">
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                                        Phát hành ứng dụng PWA Desktop (Windows, macOS, Linux) hoạt động ngoại tuyến.
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                                        Công cụ dòng lệnh FileBridge CLI cho Developer truyền tệp trực tiếp từ terminal.
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                                        Tích hợp xác thực mã băm SHA-256 đối chiếu 2 đầu độc lập.
                                    </li>
                                </ul>
                            </div>

                            {/* Stage 4 */}
                            <div className="relative space-y-2.5">
                                <div className="absolute -left-[33px] sm:-left-[49px] top-1 w-5 h-5 rounded-full bg-slate-700 border-4 border-[#04070e]"></div>
                                <div>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                        TẦM NHÌN DÀI HẠN
                                    </span>
                                    <h3 className="text-base sm:text-lg font-bold text-white mt-1 tracking-tight">Giai đoạn 4: Hệ sinh thái Phi tập trung &amp; Self-Hosted</h3>
                                </div>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    Gói triển khai độc lập (Docker image) cho các doanh nghiệp, tổ chức yêu cầu hạ tầng nội bộ tuyệt mật.
                                </p>
                                <ul className="text-xs text-slate-300 space-y-2 tech-card p-4 rounded-xl">
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                        Bản cài đặt 1-Click Docker cho doanh nghiệp tự vận hành hệ thống riêng.
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                        Cầu nối kết nối mạng lưu trữ phi tập trung (IPFS / WebTorrent).
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </section>
                )}
            </main>

            {/* CRAFTED FLOATING COMMAND DOCK (RAYCAST / LINEAR INSPIRATION) */}
            <nav className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-2xl">
                <div className="glass-dock rounded-xl px-2 py-1.5 sm:px-3 sm:py-2 flex items-center justify-between">
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                        <button
                            onClick={() => switchTab('transfer')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 ${
                                activeTab === 'transfer'
                                    ? 'text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 shadow-glow-subtle'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                                <path d="M12 12v9" />
                                <path d="m16 17-4 4-4-4" />
                            </svg>
                            <span>Truyền tệp</span>
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-white/10 text-slate-400 hidden sm:inline">1</span>
                        </button>
                        <button
                            onClick={() => switchTab('about')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 ${
                                activeTab === 'about'
                                    ? 'text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 shadow-glow-subtle font-semibold'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <span>Về chúng tôi</span>
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-white/5 text-slate-500 hidden sm:inline">2</span>
                        </button>
                        <button
                            onClick={() => switchTab('security')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 ${
                                activeTab === 'security'
                                    ? 'text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 shadow-glow-subtle font-semibold'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <span>Bảo mật</span>
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-white/5 text-slate-500 hidden sm:inline">3</span>
                        </button>
                        <button
                            onClick={() => switchTab('privacy')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 ${
                                activeTab === 'privacy'
                                    ? 'text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 shadow-glow-subtle font-semibold'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <span>Chính sách</span>
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-white/5 text-slate-500 hidden sm:inline">4</span>
                        </button>
                        <button
                            onClick={() => switchTab('faq')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 ${
                                activeTab === 'faq'
                                    ? 'text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 shadow-glow-subtle font-semibold'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <span>FAQ</span>
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-white/5 text-slate-500 hidden sm:inline">5</span>
                        </button>
                        <button
                            onClick={() => switchTab('roadmap')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 ${
                                activeTab === 'roadmap'
                                    ? 'text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 shadow-glow-subtle font-semibold'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <span>Lộ trình</span>
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-white/5 text-slate-500 hidden sm:inline">6</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2 pl-2 border-l border-white/10 shrink-0">
                        <button
                            onClick={() => setCurrentLang(currentLang === 'vi' ? 'en' : 'vi')}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                            title="Ngôn ngữ"
                        >
                            <span className="text-sm">{currentLang === 'vi' ? '🇻🇳' : '🇬🇧'}</span>
                            <span className="text-[11px] font-mono font-medium hidden sm:inline">
                                {currentLang === 'vi' ? 'VIE' : 'ENG'}
                            </span>
                        </button>
                    </div>
                </div>
            </nav>
        </div>
    );
}
