# SPC_2026 - Nền Tảng Chuyển File P2P

Ứng dụng chuyển file ngang hàng (peer-to-peer) bảo mật, được xây dựng bằng WebRTC và Socket.IO. File được chuyển trực tiếp giữa các trình duyệt mà không cần lưu trữ trên server.

## Tính Năng

- **Mã Hóa Đầu Cuối**: File không bao giờ chạm server - chỉ tín hiệu WebRTC đi qua server
- **Kết Nối P2P Trực Tiếp**: Sử dụng WebRTC DataChannel để chuyển file trực tiếp giữa các trình duyệt
- **Không Giới Hạn Dung Lượng**: Chuyển file có dung lượng bao nhiêu cũng được qua kết nối trực tiếp
- **Hỗ Trợ Relay**: Dự phòng qua TURN relay khi không kết nối trực tiếp được (giới hạn 2GB)
- **Theo Dõi Tiến Trình**: Thanh tiến trình, tốc độ chuyển và thời gian ước tính thời gian thực
- **Chia Sẻ Theo Phòng**: Tạo link dùng chung với room ID được nhúng trong URL fragment

## Kiến Trúc

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│    Gửi      │◄───────►│   Server    │◄───────►│   Nhận      │
│ (Trình duyệt)│ Signaling│ (Socket.IO) │ Signaling│ (Trình duyệt)│
└─────────────┘         └─────────────┘         └─────────────┘
      │                                               │
      │            WebRTC DataChannel (Trực tiếp)       │
      └───────────────────────────────────────────────┘
                    Chuyển File
```

### Server (Node.js)
- Express.js + Socket.IO cho WebSocket signaling
- Quản lý phòng (tối đa 2 người mỗi phòng)
- Chuyển tiếp ICE candidate WebRTC
- Giới hạn tốc độ cho bảo mật
- Hỗ trợ tạo TURN credentials

### Client (Next.js)
- Next.js 15 App Router
- Tailwind CSS để style
- Radix UI components
- SimplePeer cho WebRTC
- Socket.IO client cho signaling

## Bắt Đầu Nhanh

### Yêu Cầu
- Node.js 18+
- npm hoặc yarn

### Cài Đặt

```bash
# Di chuyển vào thư mục
cd SPC_2026

# Cài đặt server
cd server
npm install

# Cài đặt client
cd ../client
npm install
```

### Cấu Hình

Tạo file `.env` dựa trên ví dụ:

**Server (.env)**
```env
PORT=3001
CLIENT_URL=http://localhost:3000
```

**Client (.env.local)**
```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

### Chạy

```bash
# Terminal 1: Chạy server
cd server
npm run dev

# Terminal 2: Chạy client
cd client
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) trong 2 tab/trình duyệt.

## Cách Sử Dụng

### Gửi File

1. Mở ứng dụng trong trình duyệt
2. Kéo thả file hoặc click "Browse Files" để chọn
3. Click "Create Secure Link"
4. Copy link đã tạo
5. Gửi link cho người nhận qua bất kỳ kênh nào

### Nhận File

1. Mở link dùng chung trong trình duyệt
2. Ứng dụng tự nhận biết đang là người nhận
3. Chờ kết nối và bắt đầu chuyển file
4. Tải file đã nhận khi hoàn tất

## Cấu Trúc Dự Án

```
SPC_2026/
├── server/                     # Node.js Signaling Server
│   ├── server.js              # Điểm khởi đầu server
│   ├── words.json             # Danh sách từ để tạo code
│   └── package.json
│
└── client/                     # Next.js Web Application
    ├── app/
    │   ├── page.tsx           # Trang chính
    │   ├── layout.tsx         # Layout gốc
    │   └── api/
    │       └── config/        # API endpoints
    │
    ├── components/
    │   ├── P2PTransfer.tsx   # Component chuyển file chính
    │   ├── FileCard.tsx       # Thẻ hiển thị file
    │   ├── ProgressBar.tsx     # Thanh tiến trình
    │   └── Button.tsx         # Nút bấm
    │
    ├── hooks/
    │   ├── useSignaling.ts    # Socket.IO signaling
    │   ├── useFileManagement.ts # Xử lý chọn file
    │   └── useRelayConfiguration.ts # Cài đặt relay
    │
    └── lib/
        ├── transfer/
        │   ├── protocol.ts    # Hằng số giao thức
        │   ├── sender.ts      # Engine người gửi
        │   └── receiver.ts    # Engine người nhận
        ├── relay.ts           # Tiện ích relay
        ├── roomLink.ts        # Xử lý room ID từ URL
        ├── download.ts         # Tiện ích tải file
        └── socketUrl.ts        # Resolver URL socket
```

## Luồng WebRTC

### Thiết Lập Kết Nối

1. **Người gửi tạo phòng**: Vào Socket.IO room với vai trò "sender"
2. **Người nhận vào**: Mở link dùng chung, vào cùng phòng với vai trò "receiver"
3. **Server thông báo**: Server gửi `user-connected` cho người gửi
4. **Người gửi tạo offer**: SimplePeer tạo WebRTC offer
5. **Trao đổi tín hiệu**: ICE candidates và SDP được truyền qua server
6. **Kết nối sẵn sàng**: WebRTC DataChannel sẵn sàng chuyển file

### Giao Thức Chuyển File

```
Người Gửi                      Người Nhận
   │                                │
   │───── metadata (id, name) ────►│
   │                                │
   │◄──────────── ack ──────────────│
   │                                │
   │───── binary chunks ──────────►│ (kiểm soát luồng)
   │                                │
   │◄──────────── ack ──────────────│ (mỗi 8MB)
   │                                │
   │─────── end ─────────────────►│
   │                                │
```

### Kiểm Soát Luồng

- **Ngưỡng Cao**: 8MB - người gửi tạm dừng khi buffer vượt ngưỡng
- **Ngưỡng Thấp**: 4MB - người gửi tiếp tục khi buffer giảm xuống
- **Kích Thước Chunk**: Thích ứng lên đến 256KB dựa trên khả năng kênh

## Bảo Mật

### Quyền Riêng Tư Room ID
- Room ID là UUID được nhúng trong URL fragment (`#room=<id>`)
- Fragments không bao giờ được gửi đến server (trình duyệt xử lý phía client)
- Mỗi link có một nonce duy nhất để phát hiện quét tab

### Bảo Mật Kết Nối
- Kết nối WebRTC được mã hóa theo mặc định
- STUN server dùng cho NAT traversal (công khai, không cần credentials)
- TURN relay sử dụng credentials khi được cấu hình

### Giới Hạn Tốc Độ
- Tạo code: 60 request mỗi IP mỗi 15 phút
- Chuyển tiếp tín hiệu: Không giới hạn rõ ràng
- Kết nối: 30 mỗi IP

## Xử Lý Sự Cố

### "Waiting for peer..."
- Đảm bảo cả 2 tab đều kết nối đến server
- Kiểm tra console trình duyệt xem lỗi WebRTC
- Thử refresh cả 2 tab

### "Connection failed"
- Có thể do firewall hoặc vấn đề NAT
- Bật relay fallback trong cài đặt
- Kiểm tra TURN server được cấu hình đúng

### Tốc Độ Chuyển Chậm
- Kết nối trực tiếp thường nhanh nhất
- Kết nối relay chậm hơn nhưng đáng tin cậy hơn
- Kiểm tra điều kiện mạng cả 2 phía

## Phụ Thuộc

### Server
- express: ^4.18.x - HTTP server
- socket.io: ^4.x - WebSocket signaling
- cors: ^2.8.x - Xử lý CORS
- ws: ^8.x - Hỗ trợ WebSocket
- uuid: ^9.x - Tạo room ID

### Client
- next: 15.0.4 - React framework
- simple-peer: ^9.x - WebRTC abstraction
- socket.io-client: ^4.x - Socket.IO client
- tailwindcss: ^3.4.x - Styling
- @radix-ui/react-progress: ^1.x - Component tiến trình
- lucide-react: ^0.x - Icons
- uuid: ^9.x - Tạo file ID

## Giấy Phép

MIT License - Xem file LICENSE để biết chi tiết

## Ghi Nhận

Được xây dựng như một dự án học tập, lấy cảm hứng từ [Floe](https://github.com/floe/discord), một ứng dụng chuyển file P2P sẵn sàng sản xuất.
