'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import of transfer components to avoid SSR WebRTC issues
const P2PTransfer = dynamic(() => import('@/components/P2PTransfer'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center min-h-[30vh]">
            <div className="text-center space-y-3">
                <div className="h-9 w-9 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-500 font-medium">Đang khởi tạo P2P DataChannel...</p>
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
                <p className="text-xs text-slate-500 font-medium">Đang nạp bộ điều phối Swarm Tracker...</p>
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
                <p className="text-xs text-slate-500 font-medium">Đang nạp mô-đun Zero-Knowledge E2EE...</p>
            </div>
        </div>
    ),
});

type TransferMode = 'p2p' | 'swarm' | 'stored';

export default function Home() {
    const [transferMode, setTransferMode] = useState<TransferMode>('p2p');
    const [currentLang, setCurrentLang] = useState<'vi' | 'en'>('vi');
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

    const isVi = currentLang === 'vi';

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
                            href="#security-section"
                            className="hover:text-slate-900 transition-colors whitespace-nowrap"
                        >
                            {isVi ? 'Bảo mật Zero-Knowledge' : 'Zero-Knowledge Security'}
                        </a>
                        <a
                            href="#about-section"
                            className="hover:text-slate-900 transition-colors whitespace-nowrap"
                        >
                            {isVi ? 'Về dự án' : 'About SPC 2026'}
                        </a>
                        <a
                            href="#faq-section"
                            className="hover:text-slate-900 transition-colors whitespace-nowrap"
                        >
                            {isVi ? 'Hỏi đáp (FAQ)' : 'FAQ'}
                        </a>
                    </nav>

                    {/* Actions: Status & Language */}
                    <div className="flex items-center gap-2.5 shrink-0">
                        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-semibold text-emerald-700 whitespace-nowrap">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>{isVi ? '• P2P Sẵn sàng' : '• P2P Ready'}</span>
                        </div>

                        <button
                            onClick={() => setCurrentLang(isVi ? 'en' : 'vi')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-400 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all shadow-xs whitespace-nowrap"
                            title={isVi ? 'Chuyển sang Tiếng Anh' : 'Switch to Vietnamese'}
                        >
                            <span>{isVi ? '🇻🇳' : '🇬🇧'}</span>
                            <span>{isVi ? 'VIE' : 'ENG'}</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* =================================================================== */}
            {/* MAIN CONTENT AREA */}
            {/* =================================================================== */}
            <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 pt-8 sm:pt-12 pb-20 space-y-16">
                {/* Hero Header */}
                <section className="text-center space-y-3 max-w-2xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-xs">
                        <span className="text-blue-500">✨</span>
                        <span>
                            {isVi
                                ? 'Truyền tệp trực tiếp qua WebRTC • Không qua máy chủ'
                                : 'Direct WebRTC Transfer • Zero Intermediate Server'}
                        </span>
                    </div>
                    <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.2]">
                        <span>{isVi ? 'Chia sẻ tệp siêu tốc,' : 'Lightning-fast file transfer,'}</span>
                        <br />
                        <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 bg-clip-text text-transparent">
                            {isVi ? '100% chất lượng gốc' : '100% original quality'}
                        </span>
                    </h1>
                    <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
                        {isVi
                            ? 'Gửi video 4K, ảnh RAW, tài liệu lớn trực tiếp giữa 2 thiết bị. Không nén file, không lưu trên máy chủ, bảo mật tối đa và hoàn toàn miễn phí.'
                            : 'Transfer 4K videos, RAW photos, large datasets directly between 2 devices. Lossless, no data stored on server, maximum mathematical security.'}
                    </p>
                </section>

                {/* =============================================================== */}
                {/* CORE TRANSFER CARD                                              */}
                {/* =============================================================== */}
                <section
                    id="transfer-card"
                    className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-200/80 shadow-floating space-y-6 relative overflow-hidden transition-all"
                >
                    {/* Transfer Mode Segmented Switcher */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-100 pb-5">
                        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl text-xs w-full sm:w-auto overflow-x-auto">
                            <button
                                onClick={() => setTransferMode('p2p')}
                                className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                                    transferMode === 'p2p'
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                ⚡ {isVi ? '1-1 Trực tiếp (P2P)' : '1-to-1 Direct (P2P)'}
                            </button>
                            <button
                                onClick={() => setTransferMode('swarm')}
                                className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                                    transferMode === 'swarm'
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                👥 {isVi ? 'Nhóm (Swarm P2P)' : 'Swarm Sharing'}
                            </button>
                            <button
                                onClick={() => setTransferMode('stored')}
                                className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                                    transferMode === 'stored'
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                🔒 {isVi ? 'Lưu tạm E2EE (500MB)' : 'Stored E2EE (500MB)'}
                            </button>
                        </div>

                        <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-xl border border-blue-200/80 hidden sm:inline">
                            {transferMode === 'p2p'
                                ? 'WebRTC DataChannel'
                                : transferMode === 'swarm'
                                ? 'BitTorrent Web Mesh'
                                : 'AES-256-GCM Zero-Knowledge'}
                        </span>
                    </div>

                    {/* Mode Info Banner */}
                    <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-blue-50/70 border border-blue-100 text-xs transition-colors">
                        <div className="flex items-center gap-2.5 text-blue-900 font-medium">
                            <span className="text-base">
                                {transferMode === 'p2p' ? '⚡' : transferMode === 'swarm' ? '👥' : '🔒'}
                            </span>
                            <span>
                                {transferMode === 'p2p'
                                    ? isVi
                                        ? 'Chế độ 1-1: Truyền trực tiếp giữa 2 máy, không giới hạn dung lượng, máy chủ không lưu byte nào.'
                                        : '1-to-1 Mode: Direct browser-to-browser WebRTC DataChannel, unlimited size, 0 byte on server.'
                                    : transferMode === 'swarm'
                                    ? isVi
                                        ? 'Chế độ Swarm: Chia sẻ cho nhiều người cùng lúc theo mô hình BitTorrent mesh, tải càng đông càng nhanh.'
                                        : 'Swarm Mode: Multi-peer BitTorrent mesh sharing. More seeders = faster download speeds.'
                                    : isVi
                                    ? 'Chế độ Lưu tạm: Mã hóa AES-256 phía client, lưu tối đa 500MB, người nhận không cần online cùng lúc.'
                                    : 'Stored E2EE: Client-side AES-256 encrypted, 500MB quota. Receiver downloads asynchronously.'}
                            </span>
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-5 border-t border-slate-100 text-xs text-slate-500 font-medium">
                        <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center text-xs font-bold">
                                ✓
                            </span>
                            <span>{isVi ? '100% Không cần tài khoản' : '100% No Account Needed'}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">
                                🔒
                            </span>
                            <span>{isVi ? 'Mã hóa WebCrypto E2EE' : 'WebCrypto E2EE Encryption'}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">
                                ⚡
                            </span>
                            <span>{isVi ? 'Tốc độ tối đa đường truyền' : 'Full Line Connection Speed'}</span>
                        </div>
                    </div>
                </section>

                {/* =============================================================== */}
                {/* 3 FEATURES PILLARS                                              */}
                {/* =============================================================== */}
                <section id="features-section" className="space-y-6 pt-4">
                    <div className="text-center space-y-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 font-mono">
                            {isVi ? 'TRIẾT LÝ THIẾT KẾ' : 'DESIGN PHILOSOPHY'}
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                            {isVi ? 'Tại sao chọn FileBridge?' : 'Why choose FileBridge?'}
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-soft space-y-3 hover:border-blue-300 transition-all hover:shadow-card">
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-base font-mono border border-blue-100">
                                01
                            </div>
                            <h3 className="text-base font-bold text-slate-900">
                                {isVi ? 'Trực tiếp Peer-to-Peer' : 'Pure Peer-to-Peer'}
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                                {isVi
                                    ? 'Truyền thẳng từ trình duyệt sang trình duyệt qua WebRTC. Không có máy chủ trung gian xem trộm, không giới hạn dung lượng lý thuyết.'
                                    : 'Direct browser-to-browser via WebRTC. No intermediary server snooping, no artificial size limits.'}
                            </p>
                        </div>

                        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-soft space-y-3 hover:border-blue-300 transition-all hover:shadow-card">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-base font-mono border border-indigo-100">
                                02
                            </div>
                            <h3 className="text-base font-bold text-slate-900">
                                {isVi ? '100% Chất Lượng Gốc' : '100% Original Quality'}
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                                {isVi
                                    ? 'Không nén suy hao hình ảnh hay video như Messenger hay Zalo. Video 4K, bản vẽ CAD hay tệp RAW được giữ nguyên vẹn từng byte dữ liệu.'
                                    : 'Zero lossy compression. 4K ProRes videos, CAD blueprints, and RAW files arrive identical bit-for-bit.'}
                            </p>
                        </div>

                        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-soft space-y-3 hover:border-blue-300 transition-all hover:shadow-card">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-base font-mono border border-emerald-100">
                                03
                            </div>
                            <h3 className="text-base font-bold text-slate-900">
                                {isVi ? 'Bảo Mật Zero-Knowledge' : 'Zero-Knowledge Privacy'}
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                                {isVi
                                    ? 'Mật mã học AES-256-GCM ngay trên máy tính của bạn. Cam kết vĩnh viễn không thu thập dữ liệu và KHÔNG sử dụng tệp để huấn luyện AI.'
                                    : 'Client-side AES-256-GCM encryption. Guaranteed NO AI model training on your private files.'}
                            </p>
                        </div>
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
                            {isVi ? 'Máy chủ biết gì và không thể biết gì?' : 'What the server knows vs. cannot know?'}
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-200 space-y-3.5 shadow-soft">
                            <div className="text-xs font-mono font-bold text-emerald-800 flex items-center gap-2 uppercase tracking-wider">
                                <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center text-xs">
                                    ✓
                                </span>
                                <span>{isVi ? 'NHỮNG GÌ MÁY CHỦ BIẾT (TỐI THIỂU)' : 'WHAT THE SERVER KNOWS (MINIMAL)'}</span>
                            </div>
                            <ul className="text-xs sm:text-sm text-slate-700 space-y-2.5 leading-relaxed font-normal">
                                <li>
                                    • {isVi
                                        ? 'Dung lượng bản mã ước tính (để kiểm tra giới hạn quota lưu tạm 500MB).'
                                        : 'Encrypted bundle estimated size (to check 500MB storage quota).'}
                                </li>
                                <li>
                                    • {isVi
                                        ? 'Thời điểm tạo phòng và thời hạn tự hủy (để tự động xóa tệp hết hạn).'
                                        : 'Upload timestamp and expiration time (to auto-purge expired bundles).'}
                                </li>
                                <li>
                                    • {isVi
                                        ? 'Tín hiệu bắt tay mạng (SDP/ICE candidates để 2 máy tìm thấy nhau).'
                                        : 'Signaling handshake packets (SDP/ICE candidates for peer discovery).'}
                                </li>
                            </ul>
                        </div>

                        <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-200 space-y-3.5 shadow-soft">
                            <div className="text-xs font-mono font-bold text-blue-800 flex items-center gap-2 uppercase tracking-wider">
                                <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-xs">
                                    ✕
                                </span>
                                <span>{isVi ? 'NHỮNG GÌ MÁY CHỦ KHÔNG THỂ BIẾT' : 'WHAT THE SERVER CANNOT KNOW'}</span>
                            </div>
                            <ul className="text-xs sm:text-sm text-slate-700 space-y-2.5 leading-relaxed font-normal">
                                <li>
                                    • {isVi
                                        ? 'Mật khẩu giải mã và chìa khóa bí mật (nằm ở #hash URL trên trình duyệt).'
                                        : 'Decryption passphrase and cryptographic keys (held strictly in client #hash).'}
                                </li>
                                <li>
                                    • {isVi
                                        ? 'Tên file gốc, hình ảnh, video hay nội dung bên trong tài liệu.'
                                        : 'Original file names, images, video content, or binary payloads.'}
                                </li>
                                <li>
                                    • {isVi
                                        ? 'Danh tính người gửi & người nhận (hoàn toàn không cần tài khoản).'
                                        : 'Identity of sender and receiver (zero registration, completely anonymous).'}
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
                            {isVi ? 'Sứ mệnh dự án SPC 2026' : 'SPC 2026 Project Mission'}
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                        {isVi ? 'Trả lại quyền sở hữu dữ liệu cho người dùng' : 'Reclaiming Data Ownership for Users'}
                    </h2>
                    <div className="text-xs sm:text-sm text-slate-600 space-y-3 leading-relaxed font-normal">
                        <p>
                            {isVi
                                ? 'Ngày nay, các dịch vụ chat và lưu trữ đám mây của Big Tech âm thầm nén nhỏ hình ảnh, video và thu thập tệp tin của bạn để phân tích hành vi hoặc huấn luyện AI.'
                                : "Today's Big Tech messaging and cloud storage quietly compress your photos and train AI models on user data without explicit consent."}
                        </p>
                        <p>
                            {isVi ? (
                                <>
                                    <strong>FileBridge</strong> ra đời với sứ mệnh mang đến một phương thức chia sẻ tệp thuần khiết:{' '}
                                    <strong>P2P không máy chủ trung gian</strong>. Tệp tin đi thẳng từ thiết bị người gửi tới người
                                    nhận với chất lượng gốc 100%, bảo mật toán học và hoàn toàn miễn phí.
                                </>
                            ) : (
                                <>
                                    <strong>FileBridge</strong> was built for the SPC 2026 competition to offer a pure, untracked
                                    alternative: <strong>P2P direct transfer</strong>, mathematical security, and maximum transfer
                                    speeds.
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
                                <svg
                                    className={`w-4 h-4 text-slate-400 transition-transform ${
                                        faqOpen[1] ? 'rotate-180' : ''
                                    }`}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                >
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            </button>
                            {faqOpen[1] && (
                                <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                                    {isVi
                                        ? 'Ở chế độ P2P 1-1 và Swarm Sharing: Không giới hạn dung lượng từ máy chủ (có thể gửi 10GB, 30GB, 50GB...). Ở chế độ Lưu tạm E2EE: Giới hạn 500MB để đảm bảo tài nguyên đệm cho hệ thống.'
                                        : 'For 1-to-1 P2P & Swarm modes: No server limit (10GB, 30GB, 50GB...). For Stored E2EE mode: Capped at 500MB per bundle to preserve server community cache.'}
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
                                        ? '2. Tập tin có bị nén hay giảm độ phân giải không?'
                                        : '2. Are my files compressed or resized?'}
                                </span>
                                <svg
                                    className={`w-4 h-4 text-slate-400 transition-transform ${
                                        faqOpen[2] ? 'rotate-180' : ''
                                    }`}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                >
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            </button>
                            {faqOpen[2] && (
                                <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                                    {isVi
                                        ? 'Tuyệt đối không! FileBridge truyền dữ liệu nhị phân bit-by-bit nguyên gốc. Video 4K, ảnh RAW hay file nén giữ nguyên 100% chất lượng.'
                                        : 'Never! FileBridge delivers original bit-by-bit binary data without any loss.'}
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
                                        ? '3. Hai người ở hai mạng khác nhau (Wi-Fi và 4G) có gửi được không?'
                                        : '3. Can two users on different networks (e.g. Wi-Fi & 4G) connect?'}
                                </span>
                                <svg
                                    className={`w-4 h-4 text-slate-400 transition-transform ${
                                        faqOpen[3] ? 'rotate-180' : ''
                                    }`}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                >
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            </button>
                            {faqOpen[3] && (
                                <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                                    {isVi
                                        ? 'Hoàn toàn được! FileBridge tích hợp máy chủ Coturn STUN/TURN chuyên dụng trên VPS, tự động vượt qua tường lửa và NAT của nhà mạng 4G/5G để thông suốt kết nối.'
                                        : 'Yes! FileBridge runs a dedicated Coturn STUN/TURN server on VPS, bypassing strict NATs and mobile firewalls smoothly.'}
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
                                        ? '4. Tính năng "Tự hủy sau 1 lần tải" hoạt động ra sao?'
                                        : '4. How does "Burn after reading" work?'}
                                </span>
                                <svg
                                    className={`w-4 h-4 text-slate-400 transition-transform ${
                                        faqOpen[4] ? 'rotate-180' : ''
                                    }`}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                >
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            </button>
                            {faqOpen[4] && (
                                <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                                    {isVi
                                        ? 'Khi kích hoạt, ngay sau khi người nhận tải xong toàn bộ tập tin thành công lần đầu tiên, file mã hóa sẽ lập tức bị xóa vĩnh viễn khỏi ổ cứng máy chủ. Không ai có thể tải lại lần thứ hai.'
                                        : 'Once enabled, the encrypted bundle is permanently purged from disk the moment the receiver finishes the first successful download.'}
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </main>

            {/* =================================================================== */}
            {/* FOOTER SÁNG & GỌN GÀNG                                              */}
            {/* =================================================================== */}
            <footer className="border-t border-slate-200/80 bg-white py-8 text-xs text-slate-500 font-medium">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                        <img src="/logo.png" alt="FileBridge Logo" className="w-5 h-5 object-contain" />
                        <span className="text-slate-900 font-bold">FileBridge</span>
                        <span>• Tác giả: Đỗ Đăng Trường • Dự án tham dự SPC 2026</span>
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
