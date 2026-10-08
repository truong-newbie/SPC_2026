'use client';

import React, { useEffect } from 'react';
import { X, ShieldCheck, Scale, Lock, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import { Button } from './Button';
import { useLanguage } from '@/lib/i18n';

interface LegalModalProps {
    isOpen: boolean;
    type: 'privacy' | 'terms' | null;
    onClose: () => void;
    onSwitchType?: (type: 'privacy' | 'terms') => void;
}

export function LegalModal({ isOpen, type, onClose, onSwitchType }: LegalModalProps) {
    const { isVi } = useLanguage();

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !type) return null;

    const isPrivacy = type === 'privacy';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${isPrivacy ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                            {isPrivacy ? <ShieldCheck className="w-5 h-5" /> : <Scale className="w-5 h-5" />}
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900">
                                {isPrivacy
                                    ? (isVi ? 'Chính sách quyền riêng tư (Privacy Policy)' : 'Privacy Policy')
                                    : (isVi ? 'Điều khoản dịch vụ (Terms of Service)' : 'Terms of Service')}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {isPrivacy
                                    ? (isVi ? 'Cam kết Zero-Knowledge & Bảo vệ dữ liệu cá nhân' : 'Zero-Knowledge & Personal Data Protection')
                                    : (isVi ? 'Quy định sử dụng & Miễn trừ trách nhiệm pháp lý' : 'Usage Agreement & Legal Disclaimers')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
                        title={isVi ? 'Đóng' : 'Close'}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="overflow-y-auto px-6 py-5 space-y-6 text-xs sm:text-sm text-slate-700 leading-relaxed">
                    {isPrivacy ? (
                        /* PRIVACY POLICY CONTENT */
                        <>
                            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
                                <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-semibold">{isVi ? 'Tuyên bố Zero-Knowledge:' : 'Zero-Knowledge Statement:'} </span>
                                    {isVi
                                        ? 'FileBridge không lưu trữ tệp tin P2P của bạn, không quét nội dung, không yêu cầu tài khoản và không có khả năng giải mã dữ liệu của bạn.'
                                        : 'FileBridge does not store your P2P files, inspect contents, require accounts, or possess any capability to decrypt your data.'}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs flex items-center justify-center font-bold">1</span>
                                    {isVi ? 'Không thu thập dữ liệu cá nhân' : 'No Personal Data Collection'}
                                </h4>
                                <p className="text-slate-600 pl-7 text-xs sm:text-sm">
                                    {isVi
                                        ? 'Chúng tôi không yêu cầu đăng ký tài khoản, không thu thập họ tên, email, số điện thoại, vị trí địa lý hoặc bất kỳ thông tin nhận dạng cá nhân nào (PII). Bạn hoàn toàn ẩn danh khi sử dụng FileBridge.'
                                        : 'We do not require account registration, nor do we collect names, emails, phone numbers, GPS locations, or personally identifiable information (PII). You remain fully anonymous.'}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs flex items-center justify-center font-bold">2</span>
                                    {isVi ? 'Cơ chế truyền dữ liệu ngang hàng (P2P)' : 'Peer-to-Peer Data Transfer'}
                                </h4>
                                <p className="text-slate-600 pl-7 text-xs sm:text-sm">
                                    {isVi
                                        ? 'Ở chế độ P2P và Swarm, dữ liệu được truyền thẳng giữa các trình duyệt qua giao thức WebRTC DataChannel. Tệp tin không bao giờ đi qua hoặc lưu lại trên máy chủ trung gian. Khóa giải mã được lưu trên URL Fragment (#) và không bao giờ gửi lên máy chủ (theo chuẩn RFC 3986).'
                                        : 'In P2P and Swarm modes, data streams directly between client browsers via WebRTC DataChannel. Files never touch or rest on intermediate servers. Encryption keys live exclusively in the URL Fragment (#) and are never sent to servers (RFC 3986).'}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs flex items-center justify-center font-bold">3</span>
                                    {isVi ? 'Chế độ lưu tạm thời (Stored Mode)' : 'Encrypted Stored Transfer'}
                                </h4>
                                <p className="text-slate-600 pl-7 text-xs sm:text-sm">
                                    {isVi
                                        ? 'Khi sử dụng chế độ lưu tạm, tệp tin được mã hóa AES-256 trực tiếp trên trình duyệt của bạn trước khi đưa lên máy chủ. Máy chủ chỉ lưu bản mã nhị phân vô nghĩa và tự động xóa vĩnh viễn (auto-burn) sau khi người nhận tải xong hoặc khi hết thời hạn TTL (2h - 24h).'
                                        : 'In stored mode, files are AES-256 encrypted in your browser before upload. The server only hosts indecipherable ciphertext and automatically purges it permanently after download or TTL expiry (2h - 24h).'}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs flex items-center justify-center font-bold">4</span>
                                    {isVi ? 'Tuân thủ bảo vệ dữ liệu' : 'Compliance & Governance'}
                                </h4>
                                <p className="text-slate-600 pl-7 text-xs sm:text-sm">
                                    {isVi
                                        ? 'FileBridge tuân thủ nghiêm ngặt tinh thần Nghị định 13/2023/NĐ-CP về Bảo vệ dữ liệu cá nhân tại Việt Nam và Quy định chung về bảo vệ dữ liệu (GDPR) của Liên minh Châu Âu.'
                                        : 'FileBridge strictly adheres to Vietnam Decree 13/2023/ND-CP on Personal Data Protection and the EU General Data Protection Regulation (GDPR) principles.'}
                                </p>
                            </div>
                        </>
                    ) : (
                        /* TERMS OF SERVICE CONTENT */
                        <>
                            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                                <Scale className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-semibold">{isVi ? 'Quy ước dịch vụ:' : 'Service Terms:'} </span>
                                    {isVi
                                        ? 'Bằng việc sử dụng FileBridge, bạn đồng ý với các điều khoản sử dụng và miễn trừ trách nhiệm dưới đây.'
                                        : 'By using FileBridge, you agree to comply with the usage terms and liability disclaimers outlined below.'}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs flex items-center justify-center font-bold">1</span>
                                    {isVi ? 'Mục đích sử dụng hợp pháp' : 'Lawful Use'}
                                </h4>
                                <p className="text-slate-600 pl-7 text-xs sm:text-sm">
                                    {isVi
                                        ? 'FileBridge được phát triển phục vụ mục đích truyền tải tệp tin hợp pháp trong học tập, nghiên cứu và công việc. Bạn cam kết chỉ sử dụng dịch vụ cho các mục đích tuân thủ quy định pháp luật hiện hành.'
                                        : 'FileBridge is engineered for lawful data transmission in education, research, and business. You agree to use the service strictly in compliance with applicable laws.'}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs flex items-center justify-center font-bold">2</span>
                                    {isVi ? 'Hành vi bị nghiêm cấm' : 'Prohibited Activities'}
                                </h4>
                                <div className="text-slate-600 pl-7 space-y-1 text-xs sm:text-sm">
                                    <p>{isVi ? 'Nghiêm cấm người dùng lợi dụng FileBridge để:' : 'Users are strictly prohibited from using FileBridge to:'}</p>
                                    <ul className="list-disc pl-4 space-y-0.5 text-xs">
                                        <li>{isVi ? 'Phát tán virus, mã độc, trojan, spyware hoặc phần mềm tống tiền (ransomware).' : 'Distribute viruses, malware, trojans, spyware, or ransomware.'}</li>
                                        <li>{isVi ? 'Truyền tải các tài liệu vi phạm bản quyền, bí mật quốc gia hoặc nội dung khiêu dâm, bạo lực.' : 'Transmit copyrighted materials without authorization, state secrets, or unlawful media.'}</li>
                                        <li>{isVi ? 'Tấn công từ chối dịch vụ (DoS/DDoS) hoặc can thiệp vào máy chủ Signaling.' : 'Execute Denial of Service (DoS) attacks or tamper with signaling infrastructure.'}</li>
                                    </ul>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs flex items-center justify-center font-bold">3</span>
                                    {isVi ? 'Quyền sở hữu tệp tin' : 'Intellectual Property Ownership'}
                                </h4>
                                <p className="text-slate-600 pl-7 text-xs sm:text-sm">
                                    {isVi
                                        ? 'Bạn giữ 100% quyền sở hữu trí tuệ đối với tệp tin mà bạn truyền tải. FileBridge không đòi hỏi bất kỳ quyền sở hữu hay quyền cấp phép nào đối với nội dung của bạn.'
                                        : 'You retain 100% ownership and copyright of files transferred. FileBridge asserts zero claims, licenses, or rights over your content.'}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs flex items-center justify-center font-bold">4</span>
                                    {isVi ? 'Tuyên bố miễn trừ trách nhiệm (Disclaimer)' : 'Disclaimer of Liability'}
                                </h4>
                                <p className="text-slate-600 pl-7 text-xs sm:text-sm">
                                    {isVi
                                        ? 'FileBridge là công cụ hạ tầng kỹ thuật truyền dẫn trực tiếp. Nhóm phát triển không kiểm duyệt và không chịu trách nhiệm pháp lý đối với bất kỳ nội dung nào do người dùng trao đổi cho nhau. Người dùng tự chịu hoàn toàn trách nhiệm pháp lý trước cơ quan có thẩm quyền về hành vi của mình.'
                                        : 'FileBridge operates strictly as a conduit communication infrastructure. The development team does not inspect, monitor, or assume legal liability for contents exchanged between users. Users remain solely accountable under the law.'}
                                </p>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                    {onSwitchType ? (
                        <button
                            type="button"
                            onClick={() => onSwitchType(isPrivacy ? 'terms' : 'privacy')}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline flex items-center gap-1"
                        >
                            <FileText className="w-3.5 h-3.5" />
                            {isPrivacy
                                ? (isVi ? 'Xem Điều khoản dịch vụ →' : 'View Terms of Service →')
                                : (isVi ? 'Xem Chính sách quyền riêng tư →' : 'View Privacy Policy →')}
                        </button>
                    ) : (
                        <span />
                    )}

                    <Button
                        size="sm"
                        onClick={onClose}
                        className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-4"
                    >
                        {isVi ? 'Đã hiểu & Đóng' : 'Got it & Close'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
