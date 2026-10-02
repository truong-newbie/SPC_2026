# FileBridge — Nền Tảng Truyền Tệp Ngang Hàng (P2P) & Lưu Trữ Zero-Knowledge E2EE

[![Next.js](https://img.shields.io/badge/Next.js-15.0.4-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![WebRTC](https://img.shields.io/badge/WebRTC-Peer--to--Peer-333333?style=flat&logo=webrtc)](https://webrtc.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?style=flat&logo=socket.io)](https://socket.io/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

> **FileBridge** là giải pháp truyền tệp đa phương thức thế hệ mới dành cho web, kết hợp giữa mạng ngang hàng trực tiếp **WebRTC DataChannel**, mạng phân tán **WebTorrent Swarm**, và kho lưu trữ bảo mật **Zero-Knowledge E2EE**. 
> Tệp được truyền đi với **100% chất lượng gốc**, không giới hạn kích thước, không nén mờ và bảo vệ quyền riêng tư tuyệt đối.

**Trải nghiệm trực tiếp:** [https://filebridge.click](https://filebridge.click)

---

## 📑 Mục Lục
- [1. Vấn Đề & Giải Pháp](#1-vấn-đề--giải-pháp)
- [2. Ba Chế Độ Truyền Tệp Toàn Diện](#2-ba-chế-độ-truyền-tệp-toàn-diện)
- [3. Tính Năng Nổi Bật](#3-tính-năng-nổi-bật)
- [4. Kiến Trúc Hệ Thống](#4-kiến-trúc-hệ-thống)
- [5. Yêu Cầu & Cài Đặt Khởi Chạy](#5-yêu-cầu--cài-đặt-khởi-chạy)
- [6. Cấu Hình Biến Môi Trường](#6-cấu-hình-biến-môi-trường)
- [7. Hướng Dẫn Triển Khai VPS / Production](#7-hướng-dẫn-triển-khai-vps--production)
- [8. Bảo Mật & Toàn Vẹn Dữ Liệu](#8-bảo-mật--toàn-vẹn-dữ-liệu)
- [9. Đóng Góp & Tác Giả](#9-đóng-góp--tác-giả)

---

## 1. Vấn Đề & Giải Pháp

| Vấn đề của các nền tảng truyền thống | Giải pháp của FileBridge |
| :--- | :--- |
| **Ứng dụng chat (Zalo, Messenger):** Tự động bóp méo, nén mờ ảnh/video; chặn file > 100MB - 1GB. | **100% Giữ nguyên gốc:** Truyền byte-to-byte trực tiếp qua WebRTC, giữ nguyên từng pixel và metadata. |
| **Cloud Storage (Google Drive, Dropbox):** Phải upload lên máy chủ trước rồi mới cho tải; giới hạn 15GB, dễ bị quét nội dung. | **Không cần máy chủ trung gian:** Dữ liệu đi thẳng giữa 2 máy, không tốn dung lượng đám mây, server không lưu dữ liệu. |
| **Dịch vụ gửi file (WeTransfer):** Tốc độ upload phụ thuộc băng thông server; file nằm trên server của bên thứ ba. | **Mã hóa E2EE Zero-Knowledge:** Nếu lưu tạm, dữ liệu được mã hóa AES-256 tại trình duyệt. Server chỉ thấy chuỗi vô nghĩa. |
| **Rườm rà tài khoản:** Bắt đăng ký, xác minh email, đăng nhập trước khi nhận file. | **Mở là dùng ngay:** Tạo link chia sẻ hoặc mã QR, quét là kết nối tức thì, không cần tài khoản. |

---

## 2. Ba Chế Độ Truyền Tệp Toàn Diện

```
                             ┌────────────────────────┐
                             │       FILEBRIDGE       │
                             └───────────┬────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
┌───────────────────────┐  ┌───────────────────────────┐  ┌──────────────────────────────┐
│  1. GỬI TRỰC TIẾP     │  │  2. CHIA SẺ NHÓM          │  │  3. GỬI LẤY SAU              │
│  (1-to-1 WebRTC P2P)  │  │  (WebTorrent Swarm Mesh)  │  │  (Zero-Knowledge E2EE Storage)│
├───────────────────────┤  ├───────────────────────────┤  ├──────────────────────────────┤
│ • Không giới hạn size │  │ • 1 người gửi -> Nhiều    │  │ • Người nhận tải bất đồng bộ │
│ • 0 byte đĩa server   │  │   người nhận cùng lúc     │  │ • Mã hóa AES-256-GCM tại máy │
│ • Kiểm soát luồng ACK │  │ • Càng đông tải càng nhanh │  │ • Tự hủy sau khi tải (Burn)  │
│ • Xác thực SHA-256    │  │ • Chia nhỏ Piece 64KB     │  │ • Dynamic TTL thông minh     │
└───────────────────────┘  └───────────────────────────┘  └──────────────────────────────┘
```

### 1. Gửi trực tiếp 1-1 (P2P WebRTC)
- **Công nghệ:** WebRTC DataChannel + WebSocket Signaling (Socket.IO).
- **Cơ chế:** Thiết lập luồng truyền dữ liệu Peer-to-Peer trực tiếp giữa 2 trình duyệt. Server chỉ làm nhiệm vụ bắt tay (Signaling SDP/ICE). Sau khi kết nối, dữ liệu truyền độc lập, không đi qua server.
- **Tối ưu:** Kiểm soát luồng (Backpressure Flow Control) với ngưỡng đệm 8MB/4MB và cơ chế `EndAck` chống mất gói khi gửi nhiều file lớn.

### 2. Chia sẻ cho nhóm (Swarm Transfer)
- **Công nghệ:** WebTorrent Swarm Mesh P2P.
- **Cơ chế:** Tệp được chia thành các mảnh (Pieces 64KB) và tạo mã băm SHA-1 cho từng mảnh. Người tải về sẽ đồng thời trở thành seeder chia sẻ lại các mảnh đã có cho những người khác trong nhóm, giúp giải phóng hoàn toàn băng thông cho người gửi ban đầu.

### 3. Gửi lấy sau (Zero-Knowledge E2EE Stored Transfer)
- **Công nghệ:** WebCrypto API (AES-256-GCM + PBKDF2) + Express Streaming Engine.
- **Cơ chế:** Áp dụng khi người nhận chưa online. Toàn bộ tệp được mã hóa ở trình duyệt người gửi bằng mật khẩu riêng (E2EE), sau đó đẩy luồng ciphertext lên server lưu tạm. Server hoàn toàn không có khóa giải mã (Zero-Knowledge).
- **Chính sách tự động:**
  - **Tự hủy sau khi tải (Burn After Reading):** Xóa sạch file vĩnh viễn ngay khi người nhận tải xong 100%.
  - **Dynamic TTL:** Thời hạn lưu tạm tự động gán theo dung lượng (<20MB: 24h; 20-100MB: 6h; >100MB: 2h).
  - **Global Storage Quota:** Giới hạn trần 15GB toàn server, tự động từ chối và hướng dẫn dùng P2P khi hệ thống bận.

---

## 3. Tính Năng Nổi Bật

- 📦 **Tải toàn bộ dưới dạng file ZIP (1-Click ZIP All):** Sử dụng thư viện siêu nhẹ `fflate` đóng gói toàn bộ file nhận được thành file `.zip` ngay trong bộ nhớ trình duyệt (Store mode, UTF-8 tiếng Việt, không tốn CPU nén lại).
- 🛡️ **Kiểm tra toàn vẹn mật mã SHA-256:** Tự động tính hash SHA-256 của file gửi và file nhận theo thời gian thực bằng WebCrypto API, đối chiếu và gắn huy hiệu toàn vẹn 100%.
- 📱 **Quét mã QR siêu tốc:** Tích hợp camera scanner (`jsqr`) và bộ sinh mã QR (`qrcode.react`) giúp kết nối máy tính $\leftrightarrow$ điện thoại trong 1 giây mà không cần gõ link.
- ⚡ **Biểu đồ sóng tốc độ (Speed Waveform):** Trực quan hóa tốc độ truyền tải MB/s theo thời gian thực dạng sóng âm thanh động.
- 🔔 **Thông báo âm thanh & Web Push:** Phát âm thanh dễ chịu (Web Audio API synthesis) và gửi thông báo hệ thống khi hoàn tất truyền tệp.
- 🌐 **Hỗ trợ đa ngôn ngữ (Tiếng Việt / English):** Chuyển đổi ngôn ngữ linh hoạt 1-click.
- 📲 **Cài đặt như ứng dụng (PWA Ready):** Hỗ trợ Service Worker, cài đặt nhanh lên màn hình chính điện thoại/máy tính.

---

## 4. Kiến Trúc Hệ Thống

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Next.js 15)                           │
│                                                                        │
│  ┌──────────────────────┐  ┌─────────────────────┐  ┌──────────────┐  │
│  │     P2P Transfer     │  │   Swarm Transfer    │  │StoredTransfer│  │
│  │ (SimplePeer + WebRTC)│  │    (WebTorrent)     │  │ (AES-256-GCM)│  │
│  └──────────┬───────────┘  └──────────┬──────────┘  └──────┬───────┘  │
│             │                         │                    │          │
│             │                         │             HTTP Stream (.enc)│
│             ▼                         ▼                    ▼          │
└─────────────┼─────────────────────────┼────────────────────┼──────────┘
      Signaling (SDP/ICE)         Tracker/Peers              │
              │                         │                    │
┌─────────────┼─────────────────────────┼────────────────────┼──────────┐
│             ▼                         ▼                    ▼          │
│     Socket.IO Signaling        Torrent Tracker    Temp Storage Engine │
│     - Room Management          - Peer Discovery   - Global Quota 15GB │
│     - Rate Limiting            - Piece Exchange   - Dynamic TTL       │
│     - TURN Credentials                            - Auto Sweeper      │
│                                                                        │
│                          SERVER (Node.js)                              │
└────────────────────────────────────────────────────────────────────────┘
```

### Cấu Trúc Thư Mục
```
SPC_2026/
├── client/                      # Next.js 15 App Router Frontend
│   ├── app/                     # Layout, Pages, Global CSS, Metadata
│   ├── components/              # UI Components (P2PTransfer, StoredTransfer, FileIcon, v.v.)
│   ├── hooks/                   # Custom React Hooks (Signaling, Files, Relay)
│   ├── lib/
│   │   ├── crypto/              # Checksum SHA-256, E2EE AES-GCM
│   │   ├── swarm/               # WebTorrent packaging, Piece manager
│   │   ├── transfer/            # P2P Protocol, Sender, Receiver engines
│   │   └── zipManager.ts        # Client-side fflate ZIP packager
│   └── public/                  # Favicons, Logos, Manifest, Video assets
│
└── server/                      # Node.js Signaling & Storage Backend
    ├── server.js                # Express Server, Socket.IO Signaling, API routes
    ├── tempStorage.js           # Engine lưu trữ Zero-Knowledge, 15GB Quota, TTL
    ├── swarm.js                 # WebTorrent Tracker & Swarm Signaling
    └── data/                    # Thư mục chứa ciphertext tạm (.enc)
```

---

## 5. Yêu Cầu & Cài Đặt Khởi Chạy

### Yêu cầu tiên quyết
- **Node.js**: Phiên bản 18 trở lên (khuyên dùng Node.js 20 LTS)
- **npm** hoặc **yarn** / **pnpm**

### Các bước cài đặt Local Development

1. **Clone mã nguồn:**
   ```bash
   git clone https://github.com/truong-newbie/SPC_2026.git
   cd SPC_2026
   ```

2. **Cài đặt dependencies:**
   ```bash
   # Cài đặt server
   cd server
   npm install

   # Cài đặt client
   cd ../client
   npm install
   ```

3. **Cấu hình môi trường local (Xem mục 6 bên dưới)**

4. **Khởi chạy ứng dụng:**
   ```bash
   # Terminal 1: Chạy Server (Port 3001)
   cd server
   node server.js

   # Terminal 2: Chạy Client Next.js (Port 3000)
   cd client
   npm run dev
   ```

5. Truy cập trình duyệt tại: `http://localhost:3000`

---

## 6. Cấu Hình Biến Môi Trường

### Server (`server/.env`)
```env
PORT=3001
CLIENT_URL=http://localhost:3000
MAX_TEMP_STORAGE_BYTES=16106127360   # 15 GB Quota (Bytes)
MAX_TEMP_UPLOADS_PER_IP=30          # Giới hạn upload mỗi IP / phút
```

### Client (`client/.env.local`)
```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX       # Google Analytics 4 Measurement ID
```

---

## 7. Hướng Dẫn Triển Khai VPS / Production

Dự án hiện đang vận hành thực tế tại địa chỉ: **[https://filebridge.click](https://filebridge.click)**

### Kiến trúc triển khai Production:
- **Hệ điều hành:** Ubuntu 22.04 LTS
- **Reverse Proxy:** Nginx (hỗ trợ HTTP/2, WebSocket Upgrade, SSL Let's Encrypt Certbot)
- **Quản lý tiến trình:** PM2 Cluster Mode (tự khởi động lại khi crash)

### Các lệnh quản lý PM2 trên VPS:
```bash
# Xem trạng thái các dịch vụ
pm2 status

# Khởi động lại dịch vụ
pm2 restart all

# Xem nhật ký log thời gian thực
pm2 logs
```

### Cấu hình Nginx mẫu:
```nginx
server {
    server_name filebridge.click www.filebridge.click;

    # Client (Next.js)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket & Signaling API
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Temporary Storage API
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        client_max_body_size 500M;
    }
}
```

---

## 8. Bảo Mật & Toàn Vẹn Dữ Liệu

1. **Bảo mật phân đoạn URL (URL Hash Nonce):**
   - Mã phòng và mật khẩu giải mã được truyền qua URL Fragment (`#room=...` hoặc `#password`).
   - Theo tiêu chuẩn RFC 3986, nội dung sau dấu `#` chỉ xử lý ở trình duyệt và **không bao giờ gửi lên server**, chống lộ lọt lịch sử truy cập hay log máy chủ.

2. **Mã hóa E2EE cấp quân sự (AES-256-GCM):**
   - Sử dụng thư viện chuẩn WebCrypto API có sẵn của trình duyệt.
   - Hàm dẫn xuất khóa PBKDF2 thực thi 100.000 vòng lặp kết hợp Salt 128-bit và IV 96-bit ngẫu nhiên cho mỗi phiên gửi.

3. **Cơ chế phòng thủ quá tải (DoS / Storage Exhaustion):**
   - Giới hạn kích thước file tối đa 500MB cho chế độ lưu tạm.
   - Quota trần 15GB toàn hệ thống.
   - Bộ quét Sweeper tự động kích hoạt mỗi 60 giây dọn sạch các tệp mồ côi và tệp hết hạn.

---

## 9. Đóng Góp & Bản Quyền

Dự án được xây dựng và phát triển phục vụ mục đích nghiên cứu công nghệ truyền thông mạng ngang hàng WebRTC và tham dự cuộc thi sáng tạo **SPC 2026**.

- **Tác giả:** Đỗ Đăng Trường
- **Giấy phép:** [MIT License](LICENSE) — Miễn phí sử dụng và phát triển mã nguồn mở.
