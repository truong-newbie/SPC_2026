'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useLanguage } from '@/lib/i18n';
import {
    Check,
    ShieldCheck,
    Zap,
    Clock,
    Lock,
    FileImage,
    Smartphone,
    Users,
    ChevronDown,
} from 'lucide-react';

// Dynamic import of transfer components to avoid SSR WebRTC issues
const P2PTransfer = dynamic(() => import('@/components/P2PTransfer'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center py-12">
            <div className="text-center">
                <div className="h-8 w-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500">Loading...</p>
            </div>
        </div>
    ),
});

const SwarmTransfer = dynamic(() => import('@/components/SwarmTransfer'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center py-12">
            <div className="text-center">
                <div className="h-8 w-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500">Loading...</p>
            </div>
        </div>
    ),
});

const StoredTransfer = dynamic(() => import('@/components/StoredTransfer'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center py-12">
            <div className="text-center">
                <div className="h-8 w-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500">Loading...</p>
            </div>
        </div>
    ),
});

type TransferMode = 'p2p' | 'swarm' | 'stored';

export default function Home() {
    const { lang, isVi, setLang, toggleLang, t } = useLanguage();
    const [transferMode, setTransferMode] = useState<TransferMode>('p2p');
    const [faqOpen, setFaqOpen] = useState<{ [key: number]: boolean }>({});

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const hash = window.location.hash.replace('#', '');

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
        <div className="flex flex-col min-h-screen bg-slate-50">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
                    <a href="#transfer-card" className="flex items-center gap-2.5">
                        <img src="/logo.png" alt="FileBridge" className="w-8 h-8 object-contain" />
                        <span className="font-bold text-slate-900">FileBridge</span>
                    </a>

                    <nav className="hidden md:flex items-center gap-7">
                        <a href="#transfer-card" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                            {isVi ? 'Gửi tệp' : 'Transfer'}
                        </a>
                        <a href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                            {isVi ? 'Tính năng' : 'Features'}
                        </a>
                        <a href="#security" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                            {isVi ? 'Bảo mật' : 'Security'}
                        </a>
                        <a href="#faq" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                            FAQ
                        </a>
                    </nav>

                    <button
                        onClick={() => setLang(isVi ? 'en' : 'vi')}
                        className="text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded"
                    >
                        {isVi ? 'EN' : 'VI'}
                    </button>
                </div>
            </header>

            <main className="flex-1">
                {/* Hero Section */}
                <section className="pt-10 pb-8">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
                        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
                            {isVi ? 'Gửi tệp nhanh, bảo mật' : 'Fast, secure file transfer'}
                        </h1>
                        <p className="text-base text-slate-500 max-w-xl mx-auto">
                            {isVi
                                ? 'Truyền file trực tiếp P2P giữa các thiết bị. Không qua server trung gian, không lưu trữ, bảo mật tuyệt đối.'
                                : 'Transfer files directly between devices. No server relay, no storage, absolute security.'}
                        </p>
                    </div>
                </section>

                {/* Transfer Card */}
                <section id="transfer-card" className="max-w-5xl mx-auto px-4 sm:px-6 -mt-6 relative z-10">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        {/* Mode Tabs */}
                        <div className="flex border-b border-slate-200">
                            <button
                                onClick={() => setTransferMode('p2p')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium ${
                                    transferMode === 'p2p'
                                        ? 'text-slate-900 bg-slate-50 border-b-2 border-slate-900'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                }`}
                            >
                                <Zap className="w-4 h-4" />
                                {isVi ? 'Gửi trực tiếp' : 'Direct'}
                            </button>
                            <button
                                onClick={() => setTransferMode('swarm')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium ${
                                    transferMode === 'swarm'
                                        ? 'text-slate-900 bg-slate-50 border-b-2 border-slate-900'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                }`}
                            >
                                <Users className="w-4 h-4" />
                                {isVi ? 'Gửi nhóm' : 'Group'}
                            </button>
                            <button
                                onClick={() => setTransferMode('stored')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium ${
                                    transferMode === 'stored'
                                        ? 'text-slate-900 bg-slate-50 border-b-2 border-slate-900'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                }`}
                            >
                                <Clock className="w-4 h-4" />
                                {isVi ? 'Gửi lấy sau' : 'Later'}
                            </button>
                        </div>

                        {/* Mode Description */}
                        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-sm text-slate-600">
                            {transferMode === 'p2p' && (isVi
                                ? 'Truyền trực tiếp giữa 2 thiết bị. Tốc độ tối đa, không qua server.'
                                : 'Transfer directly between 2 devices. Maximum speed, no server relay.')}
                            {transferMode === 'swarm' && (isVi
                                ? 'Chia sẻ với nhiều người. Tốc độ tăng khi có nhiều người tải.'
                                : 'Share with multiple people. Speed increases with more downloaders.')}
                            {transferMode === 'stored' && (isVi
                                ? 'File được mã hóa, lưu trữ 24 giờ. Người nhận tải khi sẵn sàng.'
                                : 'Files encrypted and stored for 24h. Receiver downloads when ready.')}
                        </div>

                        {/* Transfer Component */}
                        <div className="p-4">
                            {transferMode === 'p2p' ? <P2PTransfer /> : transferMode === 'swarm' ? <SwarmTransfer /> : <StoredTransfer />}
                        </div>

                        {/* Trust Badges */}
                        <div className="flex flex-wrap items-center justify-center gap-5 px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
                            <span className="flex items-center gap-1.5">
                                <Check className="w-3.5 h-3.5" />{isVi ? 'Không cần đăng ký' : 'No signup'}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5" />E2EE
                            </span>
                            <span className="flex items-center gap-1.5">
                                <FileImage className="w-3.5 h-3.5" />{isVi ? 'Chất lượng gốc' : 'Original quality'}
                            </span>
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section id="features" className="py-16 max-w-5xl mx-auto px-4 sm:px-6">
                    <h2 className="text-xl font-bold text-slate-900 mb-6">
                        {isVi ? 'Tại sao chọn FileBridge?' : 'Why FileBridge?'}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-5 rounded-lg border border-slate-200">
                            <FileImage className="w-5 h-5 text-slate-600 mb-3" />
                            <h3 className="text-sm font-semibold text-slate-900 mb-1">
                                {isVi ? 'Chất lượng gốc' : 'Original Quality'}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {isVi
                                    ? 'Không nén, giữ nguyên 100% chất lượng.'
                                    : 'No compression, preserve 100% quality.'}
                            </p>
                        </div>

                        <div className="bg-white p-5 rounded-lg border border-slate-200">
                            <Zap className="w-5 h-5 text-slate-600 mb-3" />
                            <h3 className="text-sm font-semibold text-slate-900 mb-1">
                                {isVi ? 'Tốc độ tối đa' : 'Maximum Speed'}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {isVi
                                    ? 'P2P trực tiếp, không bị giới hạn bởi server.'
                                    : 'Direct P2P, not limited by server.'}
                            </p>
                        </div>

                        <div className="bg-white p-5 rounded-lg border border-slate-200">
                            <Lock className="w-5 h-5 text-slate-600 mb-3" />
                            <h3 className="text-sm font-semibold text-slate-900 mb-1">
                                {isVi ? 'Bảo mật E2EE' : 'E2EE Security'}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {isVi
                                    ? 'Mã hóa đầu cuối, không lưu trên server.'
                                    : 'End-to-end encryption, no server storage.'}
                            </p>
                        </div>

                        <div className="bg-white p-5 rounded-lg border border-slate-200">
                            <Smartphone className="w-5 h-5 text-slate-600 mb-3" />
                            <h3 className="text-sm font-semibold text-slate-900 mb-1">
                                {isVi ? 'Mọi thiết bị' : 'Any Device'}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {isVi
                                    ? 'Chrome, Safari, Edge. QR code để tải nhanh.'
                                    : 'Chrome, Safari, Edge. QR code for quick download.'}
                            </p>
                        </div>
                    </div>
                </section>

                {/* Comparison Section */}
                <section className="py-12 bg-white border-y border-slate-200">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6">
                        <h2 className="text-lg font-bold text-slate-900 mb-6">
                            {isVi ? 'So sánh với các giải pháp khác' : 'Compare with other solutions'}
                        </h2>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="py-3 px-4 text-left font-medium text-slate-600">{isVi ? 'Tiêu chí' : 'Feature'}</th>
                                        <th className="py-3 px-4 text-center text-slate-500">{isVi ? 'Chat apps' : 'Chat apps'}</th>
                                        <th className="py-3 px-4 text-center font-medium text-slate-900">FileBridge</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    <tr>
                                        <td className="py-3 px-4 text-slate-700">{isVi ? 'Chất lượng' : 'Quality'}</td>
                                        <td className="py-3 px-4 text-center text-red-500">{isVi ? 'Bị nén' : 'Compressed'}</td>
                                        <td className="py-3 px-4 text-center font-medium text-slate-900">{isVi ? '100% gốc' : '100% Original'}</td>
                                    </tr>
                                    <tr className="bg-slate-50">
                                        <td className="py-3 px-4 text-slate-700">{isVi ? 'Giới hạn' : 'Limit'}</td>
                                        <td className="py-3 px-4 text-center text-slate-500">~1GB</td>
                                        <td className="py-3 px-4 text-center font-medium text-slate-900">{isVi ? 'Không giới hạn' : 'Unlimited'}</td>
                                    </tr>
                                    <tr>
                                        <td className="py-3 px-4 text-slate-700">{isVi ? 'Đăng ký' : 'Signup'}</td>
                                        <td className="py-3 px-4 text-center text-slate-500">{isVi ? 'Cần' : 'Required'}</td>
                                        <td className="py-3 px-4 text-center font-medium text-slate-900">{isVi ? 'Không' : 'None'}</td>
                                    </tr>
                                    <tr className="bg-slate-50">
                                        <td className="py-3 px-4 text-slate-700">{isVi ? 'Lưu server' : 'Server Storage'}</td>
                                        <td className="py-3 px-4 text-center text-slate-500">{isVi ? 'Có' : 'Yes'}</td>
                                        <td className="py-3 px-4 text-center font-medium text-slate-900">{isVi ? 'Không' : 'No'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* Security Section */}
                <section id="security" className="py-12 max-w-5xl mx-auto px-4 sm:px-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-6">
                        {isVi ? 'Bảo mật minh bạch' : 'Transparent Security'}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-5 rounded-lg border border-slate-200">
                            <div className="flex items-center gap-2 mb-3">
                                <Check className="w-4 h-4 text-slate-600" />
                                <h3 className="text-sm font-medium text-slate-900">
                                    {isVi ? 'Server biết gì' : 'What we know'}
                                </h3>
                            </div>
                            <ul className="space-y-1.5 text-xs text-slate-500">
                                <li>{isVi ? 'Tín hiệu kết nối tạm thời (WebRTC signaling)' : 'Temporary connection signals (WebRTC signaling)'}</li>
                                <li>{isVi ? 'Thời gian hết hạn file (chế độ gửi lấy sau)' : 'File expiration time (for stored mode)'}</li>
                            </ul>
                        </div>

                        <div className="bg-white p-5 rounded-lg border border-slate-200">
                            <div className="flex items-center gap-2 mb-3">
                                <ShieldCheck className="w-4 h-4 text-slate-600" />
                                <h3 className="text-sm font-medium text-slate-900">
                                    {isVi ? 'Server KHÔNG biết gì' : 'What we cannot know'}
                                </h3>
                            </div>
                            <ul className="space-y-1.5 text-xs text-slate-500">
                                <li>{isVi ? 'Tên file, nội dung, dữ liệu của bạn' : 'File names, contents, or any of your data'}</li>
                                <li>{isVi ? 'Danh tính người gửi và người nhận' : 'Identity of sender or receiver'}</li>
                                <li>{isVi ? 'Lịch sử giao dịch hoặc log truy cập' : 'Transfer history or access logs'}</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* FAQ Section */}
                <section id="faq" className="py-12 max-w-3xl mx-auto px-4 sm:px-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-6">FAQ</h2>

                    <div className="space-y-2">
                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                            <button
                                onClick={() => toggleFaq(1)}
                                className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-slate-50"
                            >
                                <span className="text-sm font-medium text-slate-900">
                                    {isVi ? 'File có giới hạn kích thước không?' : 'Is there a file size limit?'}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${faqOpen[1] ? 'rotate-180' : ''}`} />
                            </button>
                            {faqOpen[1] && (
                                <div className="px-4 pb-3 text-xs text-slate-600 border-t border-slate-100 pt-3">
                                    {isVi
                                        ? 'Không giới hạn ở chế độ P2P. Gửi video, album ảnh lớn thoải mái. Gửi lấy sau tối đa 500MB.'
                                        : 'No limit in P2P mode. Send large videos and albums freely. Stored mode max 500MB.'}
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                            <button
                                onClick={() => toggleFaq(2)}
                                className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-slate-50"
                            >
                                <span className="text-sm font-medium text-slate-900">
                                    {isVi ? 'Gửi từ PC sang điện thoại?' : 'PC to phone transfer?'}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${faqOpen[2] ? 'rotate-180' : ''}`} />
                            </button>
                            {faqOpen[2] && (
                                <div className="px-4 pb-3 text-xs text-slate-600 border-t border-slate-100 pt-3">
                                    {isVi
                                        ? 'Có. Quét QR code trên màn hình máy tính bằng điện thoại là tải được ngay.'
                                        : 'Yes. Scan the QR code on PC screen with your phone to download instantly.'}
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                            <button
                                onClick={() => toggleFaq(3)}
                                className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-slate-50"
                            >
                                <span className="text-sm font-medium text-slate-900">
                                    {isVi ? 'Hai người khác mạng có gửi được không?' : 'Different networks?'}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${faqOpen[3] ? 'rotate-180' : ''}`} />
                            </button>
                            {faqOpen[3] && (
                                <div className="px-4 pb-3 text-xs text-slate-600 border-t border-slate-100 pt-3">
                                    {isVi
                                        ? 'Có. Wi-Fi, LAN, 4G/5G đều hoạt động bình thường.'
                                        : 'Yes. Wi-Fi, LAN, 4G/5G all work seamlessly.'}
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                            <button
                                onClick={() => toggleFaq(4)}
                                className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-slate-50"
                            >
                                <span className="text-sm font-medium text-slate-900">
                                    {isVi ? 'File có lưu trên server không?' : 'Files stored on server?'}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${faqOpen[4] ? 'rotate-180' : ''}`} />
                            </button>
                            {faqOpen[4] && (
                                <div className="px-4 pb-3 text-xs text-slate-600 border-t border-slate-100 pt-3">
                                    {isVi
                                        ? 'Không. P2P truyền trực tiếp. Gửi lấy sau mã hóa và tự xóa sau 24h.'
                                        : 'No. P2P transfers directly. Stored mode encrypts and auto-deletes after 24h.'}
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-slate-200 py-6">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-400">
                    <span>FileBridge — {isVi ? 'Sản phẩm SPC 2026' : 'SPC 2026 Product'}</span>
                    <div className="flex items-center gap-4">
                        <a href="https://github.com/truong-newbie/SPC_2026" target="_blank" rel="noreferrer" className="hover:text-slate-600">GitHub</a>
                        <a href="#security" className="hover:text-slate-600">{isVi ? 'Bảo mật' : 'Security'}</a>
                        <a href="#faq" className="hover:text-slate-600">FAQ</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
