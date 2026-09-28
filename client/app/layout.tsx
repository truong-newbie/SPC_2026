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
    <html lang="vi" className="scroll-smooth">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.global = window;
              window.process = window.process || { env: { DEBUG: undefined }, browser: true, version: '' };
              window.process.nextTick = function(fn, ...args) {
                if (typeof queueMicrotask === 'function') {
                  queueMicrotask(function() { fn(...args); });
                } else {
                  setTimeout(function() { fn(...args); }, 0);
                }
              };
            `,
          }}
        />
      </head>
      <body className="light-bg text-slate-700 min-h-screen flex flex-col font-sans antialiased selection:bg-blue-100 selection:text-blue-900 pb-20 relative">
        {children}
      </body>
    </html>
  );
}
