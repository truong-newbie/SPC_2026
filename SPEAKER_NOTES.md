# FileBridge SPC 2026 - Speaker Notes

## Slide 1: Cover (30 giây)
- Chào ban giám khảo
- Giới thiệu nhóm: Đỗ Đăng Trường (nhóm trưởng), Trần Quốc Toàn
- Mentor: Vương Quốc Bình

## Slide 2: Vấn đề hiện tại (1-2 phút)
- Hỏi: "Ai đã từng gặp khó khăn khi gửi file lớn?"
- Vấn đề 1: Email giới hạn 25MB, Cloud drive cần đăng ký
- Vấn đề 2: Upload chậm, phụ thuộc server
- Vấn đề 3: Bảo mật kém - server trung gian có thể đọc file
- Vấn đề 4: Không hỗ trợ truyền trực tiếp P2P

## Slide 3: Giải pháp FileBridge (1 phút)
- FileBridge = File + Bridge = Cầu nối file
- Ý tưởng: Truyền file trực tiếp, không qua server
- Mã hóa đầu cuối - chỉ sender và receiver đọc được
- Zero-Knowledge - ngay cả server cũng không biết nội dung

## Slide 4: 3 Chế độ hoạt động (2 phút)
### P2P Transfer
- Truyền file 1-1 trực tiếp qua WebRTC
- Không qua server trung gian
- Tốc độ cao nhất vì truyền thẳng

### Swarm Sharing
- Chia sẻ file với nhiều người cùng lúc
- Tải song song từ nhiều nguồn (như BitTorrent)
- Tự động khôi phục khi mất kết nối

### Stored Transfer
- Lưu trữ file trên server (tùy chọn)
- Mã hóa Zero-Knowledge
- Tự động xóa sau 24h
- Phù hợp khi người nhận không online

## Slide 5: Công nghệ (1-2 phút)
### WebRTC DataChannel
- Công nghệ truyền dữ liệu P2P của trình duyệt
- Không cần cài plugin, hoạt động trong trình duyệt

### AES-256 E2EE
- Mã hóa đầu cuối
- Sender mã hóa, receiver giải mã
- Không ai ở giữa có thể đọc

### Zero-Knowledge
- Server chỉ lưu ciphertext (đã mã hóa)
- Server không biết plaintext
- Bảo mật tuyệt đối

### WebCrypto API
- Native trên trình duyệt
- Không cần thư viện bên ngoài
- An toàn, nhanh

## Slide 6: So sánh bảo mật (30 giây)
- FileBridge: E2EE ✓, Zero-Knowledge ✓, Không qua server ✓
- Email/Drive: Không có gì
- FTP: Không mã hóa đầu cuối

## Slide 7: Demo (2-3 phút)
### Demo 1: P2P Transfer
1. Mở filebridge.click trên 2 trình duyệt
2. Chọn P2P Transfer
3. Kéo thả file → Generate link
4. QR code hoặc copy link
5. Paste link ở trình duyệt kia
6. → Kết nối P2P, truyền file

### Demo 2: Swarm Sharing
1. Chọn Swarm mode
2. Host upload file
3. Share room code
4. Nhiều người join cùng lúc
5. → Mỗi người tải song song

### Demo 3: Stored Transfer
1. Chọn Stored mode
2. Upload file
3. Server mã hóa với password
4. Share encrypted link
5. Người nhận download & giải mã

## Slide 8: Kiến trúc hệ thống (30 giây)
- Frontend: Next.js + React
- WebRTC cho P2P
- Socket.IO cho signaling
- Server chỉ làm cầu nối, không lưu file

## Slide 9: Hướng phát triển (30 giây)
- Tối ưu WebRTC qua LAN
- Thêm chat trong lúc truyền file
- Hỗ trợ folder
- Video/Audio call
- App di động

## Slide 10: Cảm ơn
- Cảm ơn ban giám khảo
- Website: https://filebridge.click
- Sẵn sàng demo & trả lời câu hỏi
