import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://filebridge.click'),
  title: {
    default: 'FileBridge — Truyền tệp P2P & Lưu trữ E2EE Zero-Knowledge (SPC 2026)',
    template: '%s | FileBridge',
  },
  description:
    'Nền tảng truyền tệp ngang hàng (P2P) tốc độ cao qua WebRTC và lưu trữ tạm thời Zero-Knowledge mã hóa AES-256 E2EE. Không giới hạn dung lượng, không qua máy chủ trung gian. Tác giả: Đỗ Đăng Trường (Dự án tham dự SPC 2026).',
  keywords: [
    'FileBridge',
    'Đỗ Đăng Trường',
    'SPC 2026',
    'cuộc thi SPC',
    'truyền file P2P',
    'WebRTC DataChannel',
    'chia sẻ file không giới hạn',
    'Zero-Knowledge storage',
    'mã hóa AES-256 E2EE',
    'truyền tệp bảo mật',
    'send large files free',
    'file transfer p2p',
  ],
  authors: [{ name: 'Đỗ Đăng Trường', url: 'https://filebridge.click' }],
  creator: 'Đỗ Đăng Trường',
  publisher: 'Đỗ Đăng Trường',
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: 'https://filebridge.click',
    siteName: 'FileBridge',
    title: 'FileBridge — Truyền tệp P2P & Lưu trữ E2EE Zero-Knowledge',
    description:
      'Nền tảng truyền file trực tiếp qua WebRTC và lưu trữ bảo mật Zero-Knowledge E2EE. Không giới hạn dung lượng, bảo mật tuyệt đối. Tác giả: Đỗ Đăng Trường (Dự án tham dự SPC 2026).',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'FileBridge — Direct P2P & Zero-Knowledge E2EE Transfer (SPC 2026)',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FileBridge — Truyền tệp P2P & Lưu trữ E2EE Zero-Knowledge',
    description:
      'Nền tảng truyền file trực tiếp qua WebRTC và lưu trữ bảo mật Zero-Knowledge E2EE. Tác giả: Đỗ Đăng Trường (Dự án tham dự SPC 2026).',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'FileBridge',
    url: 'https://filebridge.click',
    description:
      'Nền tảng truyền tệp ngang hàng (P2P) tốc độ cao qua WebRTC và lưu trữ tạm thời Zero-Knowledge mã hóa AES-256 E2EE.',
    applicationCategory: 'NetworkingApplication',
    operatingSystem: 'All',
    browserRequirements: 'Requires WebRTC and WebCrypto API support',
    creator: {
      '@type': 'Person',
      name: 'Đỗ Đăng Trường',
      jobTitle: 'Developer & Researcher',
      affiliation: {
        '@type': 'Organization',
        name: 'Dự án tham dự SPC 2026',
      },
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'VND',
    },
  };

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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd),
          }}
        />
      </head>
      <body className="light-bg text-slate-700 min-h-screen flex flex-col font-sans antialiased selection:bg-blue-100 selection:text-blue-900 pb-20 relative">
        {children}
      </body>
    </html>
  );
}
