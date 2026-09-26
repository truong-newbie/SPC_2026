import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FileBridge — Direct P2P & Zero-Knowledge E2EE Transfer (SPC 2026)',
  description: 'Nền tảng truyền tệp P2P trực tiếp và lưu trữ tạm thời Zero-Knowledge E2EE. Không trung gian, không nén tệp, bảo mật tuyệt đối. Dự án tham dự SPC 2026.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="dark scroll-smooth">
      <body className="bg-[#04070e] text-slate-200 min-h-screen flex flex-col font-sans antialiased selection:bg-cyan-500/30 selection:text-cyan-200 pb-36 relative">
        {children}
      </body>
    </html>
  );
}
