import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FileBridge — Direct P2P & Zero-Knowledge E2EE Transfer (SPC 2026)',
  description: 'Nền tảng truyền tệp P2P ngang hàng siêu tốc và lưu trữ tạm thời Zero-Knowledge E2EE. Dự án SPC 2026.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-900">
        <main className="container mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
