'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { PWAInstallButton } from '@/components/PWAInstallButton';
import { useLanguage } from '@/lib/i18n';
import {
    Zap,
    Users,
    Lock,
    Sparkles,
    Check,
    X,
    ShieldCheck,
    Globe,
    ChevronDown,
    Clock,
    HelpCircle,
    Info,
} from 'lucide-react';

// Dynamic import of transfer components to avoid SSR WebRTC issues
const P2PTransfer = dynamic(() => import('@/components/P2PTransfer'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center min-h-[30vh]">
            <div className="text-center space-y-3">
                <div className="h-9 w-9 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-500 font-medium">Đang sẵn sàng kết nối...</p>
            </div>
        </div>
    ),
});

const SwarmTransfer = dynamic(() => import('@/components/SwarmTransfer'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center min-h-[30vh]">
            <div className="text-center space-y-3">
                <div className="h-9 w-9 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-500 font-medium">Đang tải bộ chia sẻ nhóm...</p>
            </div>
        </div>
    ),
});

const StoredTransfer = dynamic(() => import('@/components/StoredTransfer'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center min-h-[30vh]">
            <div className="text-center space-y-3">
                <div className="h-9 w-9 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-500 font-medium">Đang nạp chế độ lưu tạm bảo mật...</p>
            </div>
        </div>
    ),
});

type TransferMode = 'p2p' | 'swarm' | 'stored';

export default function Home() {
    const { lang, isVi, setLang, toggleLang, t } = useLanguage();
    const [transferMode, setTransferMode] = useState<TransferMode>('p2p');
    const [faqOpen, setFaqOpen] = useState<{ [key: number]: boolean }>({ 1: true });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const hash = window.location.hash.replace('#', '');

            // Auto-detect transfer mode from params or hash
            if (params.get('stored')) {
                setTransferMode('stored');
            } else if (params.get('swarm')) {
                setTransferMode('swarm');
            } else if (hash.startsWith('room=') || hash.startsWith('room-') || params.get('room')) {
                setTransferMode('p2p');
            }
        }
    }, []);

    const toggleFaq = (id: number) => {
        setFaqOpen((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div className="flex flex-col min-h-screen relative">
            {/* =================================================================== */}
            {/* TOP CRAFTED NAVIGATION BAR (SINGLE LINE, WHITESPACE-NOWRAP) */}
            {/* =================================================================== */}
            <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
                    {/* Brand Logo */}
                    <a href="#transfer-card" className="flex items-center gap-2.5 shrink-0 group">
                        <img
                            src="/logo.png"
                            alt="FileBridge Logo"
                            className="w-9 h-9 object-contain transition-transform group-hover:scale-105"
                        />
                        <div className="flex items-center gap-2">
                            <span className="font-extrabold text-lg tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                                FileBridge
                            </span>
                            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70 whitespace-nowrap">
                                SPC 2026
                            </span>
                        </div>
                    </a>

                    {/* Quick Navigation Menu (Strictly Single Line, whitespace-nowrap) */}
                    <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-xs font-semibold text-slate-600 shrink-0">
                        <a
                            href="#transfer-card"
                            className="text-blue-600 hover:text-blue-700 transition-colors whitespace-nowrap"
                        >
                            {isVi ? 'Gửi & Nhận' : 'Send & Receive'}
                        </a>
                        <a
                            href="#features-section"
                            className="hover:text-slate-900 transition-colors whitespace-nowrap"
                        >
                            {isVi ? 'Tính năng' : 'Features'}
                        </a>
                        <a
                            href="#comparison-section"
                            className="hover:text-slate-900 transition-colors whitespace-nowrap"
                        >
                            {isVi ? 'So sánh' : 'Comparison'}
                        </a>
                        <a
                            href="#security-section"
                            className="hover:text-slate-900 transition-colors whitespace-nowrap"
                        >
                            {isVi ? 'Bảo mật' : 'Security'}
                        </a>
                        <a
                            href="#about-section"
                            className="hover:text-slate-900 transition-colors whitespace-nowrap"
                        >
                            {isVi ? 'Về dự án' : 'About'}
                        </a>
                        <a
                            href="#faq-section"
                            className="hover:text-slate-900 transition-colors whitespace-nowrap"
                        >
                            {isVi ? 'Hỏi đáp (FAQ)' : 'FAQ'}
                        </a>
                    </nav>

                    {/* Actions: PWA Install & Status & Language */}
                    <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                        <PWAInstallButton />

                        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-semibold text-emerald-700 whitespace-nowrap">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>{isVi ? '• Sẵn sàng gửi' : '• Ready'}</span>
                        </div>

                        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-bold shrink-0">
                            <button
                                type="button"
                                onClick={() => setLang('vi')}
                                className={`px-2 py-1 rounded-md transition-all ${
                                    isVi
                                        ? 'bg-white text-blue-600 shadow-xs'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                                title="Tiếng Việt"
                            >
                                VIE
                            </button>
                            <button
                                type="button"
                                onClick={() => setLang('en')}
                                className={`px-2 py-1 rounded-md transition-all ${
                                    !isVi
                                        ? 'bg-white text-blue-600 shadow-xs'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                                title="English"
                            >
                                ENG
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* =================================================================== */}
            {/* MAIN CONTENT AREA */}
            {/* =================================================================== */}
            <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 pt-8 sm:pt-12 pb-20 space-y-16">
                {/* Hero Header */}
                <section className="text-center space-y-3 max-w-2xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-xs">
                        <Zap className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>
                            {isVi
                                ? 'Chia sẻ tệp không giới hạn • Miễn phí • Không cần đăng ký'
                                : 'Unlimited File Transfer • Free • No Account Needed'}
                        </span>
                    </div>
                    <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.2]">
                        <span>{isVi ? 'Gửi tệp siêu tốc,' : 'Lightning-fast file transfer,'}</span>
                        <br />
                        <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 bg-clip-text text-transparent">
                            {isVi ? 'giữ nguyên 100% độ nét' : '100% original quality'}
                        </span>
                    </h1>
                    <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
                        {isVi
                            ? 'Tạm biệt nỗi lo vỡ ảnh khi gửi qua Zalo hay thông báo đầy bộ nhớ Google Drive. Kéo thả và chia sẻ ngay video 4K, album ảnh hay tài liệu nặng cho bạn bè chỉ với một đường link hoặc mã QR.'
                            : 'No more blurry compressed photos via chat apps or Google Drive storage limit alerts. Drag, drop, and instantly share 4K videos, full photo albums, and large documents via a link or QR code.'}
                    </p>
                </section>

                {/* =============================================================== */}
                {/* CORE TRANSFER CARD                                              */}
                {/* =============================================================== */}
                <section
                    id="transfer-card"
                    className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-200/80 shadow-floating space-y-6 relative overflow-hidden transition-all"
                >
                    {/* Transfer Mode Segmented Switcher (With no-scrollbar to remove grey bar) */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-100 pb-5">
                        <div className="flex items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl text-xs w-full sm:w-auto overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => setTransferMode('p2p')}
                                className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                                    transferMode === 'p2p'
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Zap className="w-3.5 h-3.5 text-amber-500" />
                                <span>{isVi ? 'Gửi trực tiếp' : 'Direct Transfer'}</span>
                            </button>
                            <button
                                onClick={() => setTransferMode('swarm')}
                                className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                                    transferMode === 'swarm'
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Users className="w-3.5 h-3.5 text-blue-600" />
                                <span>{isVi ? 'Gửi cho nhóm' : 'Group Sharing'}</span>
                            </button>
                            <button
                                onClick={() => setTransferMode('stored')}
                                className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                                    transferMode === 'stored'
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                                <span>{isVi ? 'Gửi lấy sau' : 'Send for Later'}</span>
                            </button>
                        </div>

                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200/80 hidden sm:inline-flex items-center gap-1.5">
                            {transferMode === 'p2p'
                                ? isVi ? '⚡ Tốc độ cao nhất' : '⚡ Fastest Speed'
                                : transferMode === 'swarm'
                                ? isVi ? '👥 Càng đông càng nhanh' : '👥 Multi-Peer Boost'
                                : isVi ? '⏱️ Người nhận mở sau' : '⏱️ Download Later'}
                        </span>
                    </div>

                    {/* Mode Info Banner */}
                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-50/70 border border-blue-100 text-xs sm:text-sm transition-colors">
                        <span className="p-1.5 rounded-xl bg-blue-100/80 text-blue-700 shrink-0 mt-0.5">
                            {transferMode === 'p2p' ? (
                                <Zap className="w-4 h-4 text-amber-600" />
                            ) : transferMode === 'swarm' ? (
                                <Users className="w-4 h-4 text-blue-600" />
                            ) : (
                                <Clock className="w-4 h-4 text-indigo-600" />
                            )}
                        </span>
                        <div className="text-blue-900 leading-relaxed font-normal">
                            {transferMode === 'p2p' ? (
                                isVi ? (
                                    <>
                                        <strong className="font-bold text-blue-950 block mb-0.5">Gửi trực tiếp giữa 2 thiết bị (Khuyên dùng):</strong>
                                        Hai bên cùng mở trang web. Tệp truyền thẳng từ máy bạn sang máy người nhận với tốc độ tối đa của đường truyền mạng. Không giới hạn dung lượng và máy chủ hoàn toàn không giữ bản sao nào của bạn.
                                    </>
                                ) : (
                                    <>
                                        <strong className="font-bold text-blue-950 block mb-0.5">Direct 1-to-1 Transfer (Recommended):</strong>
                                        Both peers open the web page. Files stream directly between your devices at maximum network speed. Unlimited size, zero copies kept on the server.
                                    </>
                                )
                            ) : transferMode === 'swarm' ? (
                                isVi ? (
                                    <>
                                        <strong className="font-bold text-blue-950 block mb-0.5">Gửi cho nhóm người nhận (Lớp học, phòng họp):</strong>
                                        Chia sẻ một tệp cho cả nhóm cùng lúc. Người nhận vừa tải vừa tiếp sức chia sẻ cho nhau giúp tốc độ tăng gấp bội khi có nhiều người cùng tải.
                                    </>
                                ) : (
                                    <>
                                        <strong className="font-bold text-blue-950 block mb-0.5">Group Sharing (Classrooms, meetings):</strong>
                                        Share one file to multiple peers at once. Receivers help relay data chunks to each other, accelerating speeds as more people join.
                                    </>
                                )
                            ) : isVi ? (
                                <>
                                    <strong className="font-bold text-blue-950 block mb-0.5">Gửi nhận linh hoạt khi người kia chưa mở máy:</strong>
                                    Người nhận đang bận hoặc chưa online? Tệp được khóa an toàn và lưu giữ trong 24 giờ. Bạn chỉ cần gửi link hoặc mã tệp, người nhận có thể tải về bất cứ lúc nào.
                                </>
                            ) : (
                                <>
                                    <strong className="font-bold text-blue-950 block mb-0.5">Send for Later (When receiver is offline):</strong>
                                    Receiver busy or offline? Files are securely locked and preserved for 24 hours. Just share the link, and they can download whenever ready.
                                </>
                            )}
                        </div>
                    </div>

                    {/* Active Functional Transfer Component */}
                    <div className="py-2">
                        {transferMode === 'p2p' ? (
                            <P2PTransfer />
                        ) : transferMode === 'swarm' ? (
                            <SwarmTransfer />
                        ) : (
                            <StoredTransfer />
                        )}
                    </div>

                    {/* 3 Trust Badges */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-5 border-t border-slate-100 text-xs text-slate-600 font-medium">
                        <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            </span>
                            <span>{isVi ? 'Không cần tài khoản' : 'No Account Needed'}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                                <ShieldCheck className="w-3.5 h-3.5" />
                            </span>
                            <span>{isVi ? 'Bảo mật riêng tư 100%' : '100% Private & Secure'}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                                <Sparkles className="w-3.5 h-3.5" />
                            </span>
                            <span>{isVi ? 'Giữ nguyên chất lượng gốc' : '100% Original Quality'}</span>
                        </div>
                    </div>
                </section>

                {/* =============================================================== */}
                {/* 3 FEATURES PILLARS                                              */}
                {/* =============================================================== */}
                <section id="features-section" className="space-y-6 pt-4">
                    <div className="text-center space-y-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 font-mono">
                            {isVi ? 'LÝ DO BẠN SẼ YÊU THÍCH FILEBRIDGE' : 'WHY YOU WILL LOVE FILEBRIDGE'}
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                            {isVi ? 'Chia sẻ tệp dễ dàng như trò chuyện' : 'File sharing as effortless as chatting'}
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-soft space-y-3.5 hover:border-blue-300 transition-all hover:shadow-card">
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                <Sparkles className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-bold text-slate-900">
                                {isVi ? 'Không nén, không mờ' : 'Lossless & Crystal Clear'}
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                                {isVi
                                    ? 'Khác với các ứng dụng nhắn tin thường âm thầm nén nhỏ ảnh và làm vỡ hạt video, FileBridge giữ nguyên vẹn từng khung hình sắc nét và chất lượng gốc 100%.'
                                    : 'Unlike chat apps that secretly downscale photos and pixelate videos, FileBridge preserves every single pixel and delivers identical original quality.'}
                            </p>
                        </div>

                        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-soft space-y-3.5 hover:border-blue-300 transition-all hover:shadow-card">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <Zap className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-bold text-slate-900">
                                {isVi ? 'Mở là dùng, không rườm rà' : 'Instant, Zero Setup'}
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                                {isVi
                                    ? 'Không cần đăng ký, không cần mật khẩu, không cài đặt phần mềm. Hoạt động mượt mà trên cả máy tính và điện thoại thông qua mọi trình duyệt phổ biến.'
                                    : 'No registration, no password, no software to install. Works seamlessly across phones and laptops right in your browser.'}
                            </p>
                        </div>

                        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-soft space-y-3.5 hover:border-blue-300 transition-all hover:shadow-card">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                <Lock className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-bold text-slate-900">
                                {isVi ? 'Riêng tư tuyệt đối' : 'Strictly Private'}
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                                {isVi
                                    ? 'Tệp truyền thẳng từ thiết bị này sang thiết bị kia và biến mất ngay khi gửi xong. Không ai — kể cả hệ thống — có thể xem hay lưu trộm tệp tin của bạn.'
                                    : 'Files flow straight from sender to receiver and vanish once delivered. Nobody — not even our servers — can snoop on or store your files.'}
                            </p>
                        </div>
                    </div>
                </section>

                {/* =============================================================== */}
                {/* COMPARISON TABLE SECTION (USER-FRIENDLY COMPARISON)             */}
                {/* =============================================================== */}
                <section id="comparison-section" className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-soft space-y-5">
                    <div className="text-center space-y-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 font-mono">
                            {isVi ? 'BẢNG SO SÁNH TRỰC QUAN' : 'SIDE-BY-SIDE COMPARISON'}
                        </span>
                        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                            {isVi ? 'FileBridge có gì vượt trội?' : 'Why is FileBridge Better?'}
                        </h2>
                    </div>

                    <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-left text-xs sm:text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                                    <th className="py-3 px-3">{isVi ? 'Tiêu chí' : 'Feature'}</th>
                                    <th className="py-3 px-3 text-slate-400">{isVi ? 'Ứng dụng chat (Zalo, Messenger)' : 'Chat apps'}</th>
                                    <th className="py-3 px-3 text-slate-400">{isVi ? 'Đám mây (Drive, Dropbox)' : 'Cloud Storage'}</th>
                                    <th className="py-3 px-3 text-blue-600 font-bold bg-blue-50/60 rounded-t-xl">FileBridge ✨</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                <tr>
                                    <td className="py-3.5 px-3 font-semibold text-slate-900">{isVi ? 'Chất lượng ảnh & video' : 'Media Quality'}</td>
                                    <td className="py-3.5 px-3 text-red-500 flex items-center gap-1.5 mt-0.5">
                                        <X className="w-4 h-4 shrink-0" />
                                        <span>{isVi ? 'Bị nén, giảm độ phân giải' : 'Downscaled & compressed'}</span>
                                    </td>
                                    <td className="py-3.5 px-3 text-emerald-600 font-medium">{isVi ? 'Giữ nguyên gốc' : 'Original'}</td>
                                    <td className="py-3.5 px-3 font-bold text-blue-700 bg-blue-50/60">{isVi ? 'Giữ nguyên 100% bản gốc' : '100% Original Quality'}</td>
                                </tr>
                                <tr>
                                    <td className="py-3.5 px-3 font-semibold text-slate-900">{isVi ? 'Giới hạn dung lượng' : 'Size Limit'}</td>
                                    <td className="py-3.5 px-3 text-slate-500">{isVi ? 'Giới hạn 100MB – 1GB' : '100MB – 1GB max'}</td>
                                    <td className="py-3.5 px-3 text-amber-600">{isVi ? 'Nhanh đầy 15GB, phải mua thêm' : '15GB cap, paid upgrades'}</td>
                                    <td className="py-3.5 px-3 font-bold text-blue-700 bg-blue-50/60">{isVi ? 'Không giới hạn dung lượng' : 'Unlimited file size'}</td>
                                </tr>
                                <tr>
                                    <td className="py-3.5 px-3 font-semibold text-slate-900">{isVi ? 'Yêu cầu tài khoản' : 'Account Required'}</td>
                                    <td className="py-3.5 px-3 text-slate-500">{isVi ? 'Bắt buộc đăng ký tài khoản' : 'Required'}</td>
                                    <td className="py-3.5 px-3 text-slate-500">{isVi ? 'Bắt buộc đăng nhập email' : 'Required'}</td>
                                    <td className="py-3.5 px-3 font-bold text-blue-700 bg-blue-50/60">{isVi ? 'Mở web dùng ngay' : 'None — instant'}</td>
                                </tr>
                                <tr>
                                    <td className="py-3.5 px-3 font-semibold text-slate-900">{isVi ? 'Quyền riêng tư' : 'Privacy'}</td>
                                    <td className="py-3.5 px-3 text-slate-500">{isVi ? 'Lưu trữ trên máy chủ công ty' : 'Stored by big tech'}</td>
                                    <td className="py-3.5 px-3 text-slate-500">{isVi ? 'Lưu trữ trên máy chủ công ty' : 'Stored in cloud'}</td>
                                    <td className="py-3.5 px-3 font-bold text-blue-700 bg-blue-50/60 rounded-b-xl">{isVi ? 'Đi thẳng giữa 2 máy, không lưu lại' : 'Direct P2P, zero retention'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* =============================================================== */}
                {/* SECURITY TRANSPARENCY SECTION                                   */}
                {/* =============================================================== */}
                <section id="security-section" className="space-y-6 pt-4">
                    <div className="text-center space-y-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 font-mono">
                            {isVi ? 'MINH BẠCH BẢO MẬT' : 'SECURITY TRANSPARENCY'}
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                            {isVi ? 'Dữ liệu của bạn được bảo vệ ra sao?' : 'How is your data protected?'}
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-200 space-y-3.5 shadow-soft">
                            <div className="text-xs font-mono font-bold text-emerald-800 flex items-center gap-2 uppercase tracking-wider">
                                <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center">
                                    <Check className="w-3 h-3 stroke-[2.5]" />
                                </span>
                                <span>{isVi ? 'HỆ THỐNG BIẾT GÌ (TỐI THIỂU)' : 'WHAT THE SYSTEM KNOWS (MINIMAL)'}</span>
                            </div>
                            <ul className="text-xs sm:text-sm text-slate-700 space-y-2.5 leading-relaxed font-normal">
                                <li>
                                    • {isVi
                                        ? 'Tín hiệu kết nối tạm thời giữa 2 trình duyệt để hai máy tìm thấy nhau.'
                                        : 'Temporary networking handshake signals so peers can discover each other.'}
                                </li>
                                <li>
                                    • {isVi
                                        ? 'Thời gian tự hủy của tệp (chế độ gửi lấy sau để tự động dọn dẹp khi hết hạn).'
                                        : 'File expiration time (for stored mode to automatically purge on schedule).'}
                                </li>
                            </ul>
                        </div>

                        <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-200 space-y-3.5 shadow-soft">
                            <div className="text-xs font-mono font-bold text-blue-800 flex items-center gap-2 uppercase tracking-wider">
                                <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center">
                                    <X className="w-3 h-3 stroke-[2.5]" />
                                </span>
                                <span>{isVi ? 'HỆ THỐNG KHÔNG BAO GIỜ BIẾT GÌ' : 'WHAT THE SYSTEM CANNOT KNOW'}</span>
                            </div>
                            <ul className="text-xs sm:text-sm text-slate-700 space-y-2.5 leading-relaxed font-normal">
                                <li>
                                    • {isVi
                                        ? 'Không thể biết tên file, hình ảnh hay nội dung bên trong tài liệu của bạn.'
                                        : 'Cannot read file names, images, videos, or contents of your files.'}
                                </li>
                                <li>
                                    • {isVi
                                        ? 'Không lưu trữ bất kỳ tệp tin nào ở chế độ gửi trực tiếp.'
                                        : 'Zero bytes saved or retained in direct transfer mode.'}
                                </li>
                                <li>
                                    • {isVi
                                        ? 'Không lưu danh tính, email hay theo dõi lịch sử gửi nhận của bạn.'
                                        : 'Zero tracking, no identity logs, completely anonymous.'}
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* =============================================================== */}
                {/* ABOUT SECTION (SPC 2026 MISSION)                                */}
                {/* =============================================================== */}
                <section
                    id="about-section"
                    className="bg-white p-6 sm:p-9 rounded-3xl border border-slate-200/80 shadow-soft space-y-4"
                >
                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
                            {isVi ? 'Sứ mệnh FileBridge • SPC 2026' : 'FileBridge Mission • SPC 2026'}
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                        {isVi ? 'Trao lại quyền làm chủ dữ liệu cho bạn' : 'Reclaiming Data Ownership for Users'}
                    </h2>
                    <div className="text-xs sm:text-sm text-slate-600 space-y-3 leading-relaxed font-normal">
                        <p>
                            {isVi
                                ? 'Ngày nay, hầu hết các dịch vụ chat và đám mây lớn đều âm thầm nén nhỏ chất lượng ảnh, video và lưu trữ dữ liệu của người dùng trên máy chủ của họ.'
                                : "Today, most popular messaging and cloud services silently downscale your media and retain user data on corporate servers."}
                        </p>
                        <p>
                            {isVi ? (
                                <>
                                    <strong>FileBridge</strong> được xây dựng với mục tiêu mang đến một phương thức chia sẻ tệp thuần khiết:{' '}
                                    <strong>Trực tiếp giữa 2 thiết bị, không máy chủ trung gian</strong>. Tệp tin đi thẳng với chất lượng gốc 100%, bảo mật riêng tư và hoàn toàn miễn phí.
                                </>
                            ) : (
                                <>
                                    <strong>FileBridge</strong> offers a pure, privacy-first alternative:{' '}
                                    <strong>Direct device-to-device transfer</strong> with 100% original quality, zero tracking, and completely free.
                                </>
                            )}
                        </p>
                    </div>
                </section>

                {/* =============================================================== */}
                {/* FAQ ACCORDION SECTION                                           */}
                {/* =============================================================== */}
                <section id="faq-section" className="space-y-4 pt-2">
                    <div className="text-center space-y-1.5 mb-6">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 font-mono">
                            {isVi ? 'GIẢI ĐÁP THẮC MẮC' : 'FREQUENTLY ASKED QUESTIONS'}
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                            {isVi ? 'Câu Hỏi Thường Gặp (FAQ)' : 'Frequently Asked Questions (FAQ)'}
                        </h2>
                    </div>

                    <div className="space-y-3">
                        {/* FAQ 1 */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden transition-colors">
                            <button
                                onClick={() => toggleFaq(1)}
                                className="w-full p-4 sm:p-5 text-left flex items-center justify-between text-xs sm:text-sm font-bold text-slate-800 hover:text-blue-600"
                            >
                                <span>
                                    {isVi
                                        ? '1. Kích thước tệp tối đa tôi có thể gửi là bao nhiêu?'
                                        : '1. What is the maximum file size I can transfer?'}
                                </span>
                                <ChevronDown
                                    className={`w-4 h-4 text-slate-400 transition-transform ${
                                        faqOpen[1] ? 'rotate-180' : ''
                                    }`}
                                />
                            </button>
                            {faqOpen[1] && (
                                <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                                    {isVi
                                        ? 'Thoải mái gửi các tệp từ vài MB đến hàng chục GB (video độ nét cao 4K, album ảnh, tệp đồ họa, phim...). Ở chế độ gửi trực tiếp, hệ thống không giới hạn dung lượng tệp tin. Ở chế độ gửi lấy sau, hệ thống hỗ trợ tối đa 500MB.'
                                        : 'Feel free to send files from a few MBs up to tens of GBs (4K videos, photo albums, graphic designs, large archives). Direct transfer has no size limit. Stored mode supports up to 500MB.'}
                                </div>
                            )}
                        </div>

                        {/* FAQ 2 */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden transition-colors">
                            <button
                                onClick={() => toggleFaq(2)}
                                className="w-full p-4 sm:p-5 text-left flex items-center justify-between text-xs sm:text-sm font-bold text-slate-800 hover:text-blue-600"
                            >
                                <span>
                                    {isVi
                                        ? '2. Tôi dùng máy tính gửi cho bạn bè dùng điện thoại (iPhone/Android) được không?'
                                        : '2. Can I send files from a PC to someone on iPhone or Android?'}
                                </span>
                                <ChevronDown
                                    className={`w-4 h-4 text-slate-400 transition-transform ${
                                        faqOpen[2] ? 'rotate-180' : ''
                                    }`}
                                />
                            </button>
                            {faqOpen[2] && (
                                <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                                    {isVi
                                        ? 'Rất đơn giản! Người nhận chỉ cần mở camera trên điện thoại quét mã QR hiển thị trên màn hình máy tính của bạn là có thể nhận và tải tệp về máy ngay lập tức, không cần cài đặt thêm ứng dụng.'
                                        : 'Extremely easy! The receiver just opens their phone camera to scan the QR code displayed on your screen, and the download begins right in their browser without installing any app.'}
                                </div>
                            )}
                        </div>

                        {/* FAQ 3 */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden transition-colors">
                            <button
                                onClick={() => toggleFaq(3)}
                                className="w-full p-4 sm:p-5 text-left flex items-center justify-between text-xs sm:text-sm font-bold text-slate-800 hover:text-blue-600"
                            >
                                <span>
                                    {isVi
                                        ? '3. Hai người ở hai mạng khác nhau (Wi-Fi và 4G/5G) có gửi được không?'
                                        : '3. Can two users on different networks (e.g. Wi-Fi & 4G/5G) transfer?'}
                                </span>
                                <ChevronDown
                                    className={`w-4 h-4 text-slate-400 transition-transform ${
                                        faqOpen[3] ? 'rotate-180' : ''
                                    }`}
                                />
                            </button>
                            {faqOpen[3] && (
                                <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                                    {isVi
                                        ? 'Hoàn toàn bình thường! FileBridge tự động kết nối thông minh giữa hai thiết bị dù bạn đang dùng mạng văn phòng, Wi-Fi ở nhà hay kết nối mạng di động 4G/5G.'
                                        : 'Yes, seamlessly! FileBridge automatically establishes an optimal connection whether you are on home Wi-Fi, office LAN, or mobile 4G/5G.'}
                                </div>
                            )}
                        </div>

                        {/* FAQ 4 */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden transition-colors">
                            <button
                                onClick={() => toggleFaq(4)}
                                className="w-full p-4 sm:p-5 text-left flex items-center justify-between text-xs sm:text-sm font-bold text-slate-800 hover:text-blue-600"
                            >
                                <span>
                                    {isVi
                                        ? '4. Tệp tin của tôi có bị lưu trữ lại trên mạng không?'
                                        : '4. Are my files stored on the server?'}
                                </span>
                                <ChevronDown
                                    className={`w-4 h-4 text-slate-400 transition-transform ${
                                        faqOpen[4] ? 'rotate-180' : ''
                                    }`}
                                />
                            </button>
                            {faqOpen[4] && (
                                <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                                    {isVi
                                        ? 'Không! Ở chế độ gửi trực tiếp, tệp đi thẳng từ máy bạn sang máy người nhận và biến mất ngay lập tức. Ở chế độ gửi lấy sau, tệp được mã hóa và sẽ tự động xóa vĩnh viễn sau 24 giờ hoặc ngay khi người nhận tải xong.'
                                        : 'Never! In direct mode, files stream peer-to-peer and vanish once delivered. In stored mode, files are encrypted and automatically deleted after 24 hours or after the first download.'}
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </main>

            {/* =================================================================== */}
            {/* FOOTER SÁNG & GỌN GÀNG                                              */}
            {/* =================================================================== */}
            <footer className="border-t border-slate-200/80 bg-white py-6 text-xs text-slate-500 font-medium">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                        <img src="/logo.png" alt="FileBridge Logo" className="w-5 h-5 object-contain" />
                        <span className="text-slate-900 font-bold">FileBridge</span>
                    </div>
                    <div className="flex items-center gap-5 text-slate-600 font-semibold">
                        <a href="#transfer-card" className="hover:text-blue-600 transition-colors">
                            {isVi ? 'Gửi tệp' : 'Transfer'}
                        </a>
                        <a href="#security-section" className="hover:text-blue-600 transition-colors">
                            {isVi ? 'Bảo mật' : 'Security'}
                        </a>
                        <a href="#about-section" className="hover:text-blue-600 transition-colors">
                            {isVi ? 'Về dự án' : 'About'}
                        </a>
                        <a
                            href="https://github.com/truong-newbie/SPC_2026"
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-blue-600 transition-colors"
                        >
                            GitHub
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
