# KỊCH BẢN QUAY VIDEO DEMO SẢN PHẨM FILEBRIDGE (< 5 PHÚT)
> **Dự án**: FileBridge — Nền tảng Truyền tệp Ngang hàng (P2P) & Lưu trữ E2EE Zero-Knowledge (SPC 2026)  
> **Thời lượng chuẩn**: ~4 phút 30 giây  
> **Mục tiêu**: Trình diễn trọn vẹn 3 chế độ truyền tệp, tính năng gửi cả thư mục, xác thực mật mã SHA-256 và cơ chế tự hủy Zero-Knowledge một cách trực quan, hấp dẫn nhất.

---

## 🎬 1. CHUẨN BỊ TRƯỚC KHI BẤM MÁY (1 PHÚT)

1. **Thiết lập màn hình**: Chia đôi màn hình (Split screen 50/50 trên Windows bằng phím `Win + Phím mũi tên`):
   - **Nửa màn hình trái**: Trình duyệt chính (Đóng vai trò **Máy Người Gửi**).
   - **Nửa màn hình phải**: Cửa sổ Trình duyệt ẩn danh (Incognito) hoặc màn hình điện thoại (Đóng vai trò **Máy Người Nhận**).
2. **Chuẩn bị dữ liệu demo**:
   - Tạo một thư mục mẫu tên `Du_An_SPC_2026` (dung lượng tầm 15MB - 30MB để truyền nhanh trong vài giây).
   - Bên trong gồm: 1 thư mục con `Hinh_Anh` chứa vài ảnh đẹp chất lượng cao và 1 file tài liệu `Bao_Cao.pdf`.
3. **Công cụ quay màn hình**:
   - Nhấn `Windows + Alt + R` (Xbox Game Bar có sẵn trên Windows 10/11) để bắt đầu/dừng quay.
   - Hoặc sử dụng ứng dụng **Clipchamp / OBS Studio**.

---

## ⏱️ 2. BẢNG PHÂN CẢNH CHI TIẾT THEO THỜI GIAN

---

### PHẦN 1: MỞ ĐẦU & NỖI ĐAU THỰC TẾ (0:00 – 0:40)
*Mục tiêu: Đánh trúng tâm lý người dùng trong 5 giây đầu.*

| Thời gian | Thao tác trên màn hình (Visual Actions) | Lời thoại thuyết minh (Voiceover Script) |
| :--- | :--- | :--- |
| **0:00 – 0:20** | - Quay cận cảnh logo FileBridge và giao diện trang chủ tại `https://filebridge.click`.<br>- Lướt chuột nhẹ qua dòng tiêu đề: *Truyền tệp P2P & Lưu trữ E2EE Zero-Knowledge*. | *"Bạn đã từng bực bội khi gửi ảnh qua Zalo bị mờ, video chất lượng 4K bị bóp méo, hay gửi file nặng qua Google Drive thì báo đầy bộ nhớ 15GB? Các nền tảng gửi file truyền thống bắt bạn tải lên máy chủ của họ, vừa tốn thời gian, vừa tiềm ẩn nguy cơ lộ lọt dữ liệu."* |
| **0:20 – 0:40** | - Con trỏ chuột chỉ lần lượt vào 3 tab chuyển đổi chế độ:<br>1. Gửi trực tiếp P2P<br>2. Chia sẻ nhóm Swarm<br>3. Lưu trữ E2EE | *"Chào mừng các bạn đến với **FileBridge** — giải pháp truyền tệp đa phương thức thế hệ mới. Không tài khoản, không giới hạn dung lượng, không nén mờ và bảo vệ quyền riêng tư tuyệt đối bằng mã hóa đầu cuối."* |

---

### PHẦN 2: CHẾ ĐỘ 1 — GỬI TRỰC TIẾP P2P & CẢ THƯ MỤC (0:40 – 2:00)
*Mục tiêu: Trình diễn tính năng P2P 1-1, truyền thư mục nguyên vẹn và xác thực SHA-256.*

| Thời gian | Thao tác trên màn hình (Visual Actions) | Lời thoại thuyết minh (Voiceover Script) |
| :--- | :--- | :--- |
| **0:40 – 1:05** | - Ở nửa màn hình bên trái (Người gửi): Bấm nút **"Chọn thư mục"** hoặc kéo thả folder `Du_An_SPC_2026` vào.<br>- Danh sách file hiện ra với huy hiệu thư mục `📁 Du_An_SPC_2026/Hinh_Anh/`.<br>- Bấm **"Tạo phòng kết nối"** $\rightarrow$ Mã QR và link phòng xuất hiện. | *"Đầu tiên là chế độ **Gửi trực tiếp 1-1 qua WebRTC**. FileBridge hỗ trợ kéo thả cả thư mục lẫn file lẻ cùng lúc, bảo toàn trọn vẹn cấu trúc cây phân cấp. Chỉ với 1 click, hệ thống tạo ngay phòng kết nối bảo mật kèm mã QR."* |
| **1:05 – 1:30** | - Copy link phòng dán sang nửa màn hình bên phải (Người nhận).<br>- Hai bên tự động bắt tay kết nối P2P (chấm xanh Online).<br>- File bắt đầu truyền: Thanh tiến trình chạy, biểu đồ **Speed Waveform** nhảy sóng âm thanh động theo thời gian thực. | *"Người nhận chỉ cần nhấp link hoặc quét mã QR bằng điện thoại. Lúc này, dữ liệu nhị phân chạy thẳng qua kênh WebRTC DataChannel giữa hai máy tính mà không lưu bất kỳ byte nào lên máy chủ. Tốc độ truyền đạt tối đa băng thông mạng nội bộ mà không lo tràn RAM nhờ cơ chế Backpressure Flow Control."* |
| **1:30 – 2:00** | - File nhận xong: Âm thanh ting ting phát ra.<br>- Hiện huy hiệu xanh: **"SHA-256 Verified 100%"**.<br>- Bên người nhận bấm nút **"Tải toàn bộ (.zip)"**.<br>- Mở file ZIP vừa tải về: Cho người xem thấy cấu trúc thư mục con vẫn còn nguyên vẹn. | *"Ngay khi nhận xong, thuật toán mã băm SHA-256 sẽ tự động đối chiếu để đảm bảo file nhận được nguyên bản từng pixel. Đặc biệt, người nhận chỉ cần bấm 'Tải toàn bộ (.zip)', toàn bộ cây thư mục sẽ được đóng gói tức thì trong RAM bằng engine fflate siêu nhẹ."* |

---

### PHẦN 3: CHẾ ĐỘ 2 — CHIA SẺ NHÓM (SWARM MESH) (2:00 – 2:50)
*Mục tiêu: Giới thiệu giải pháp chia sẻ cho lớp học/văn phòng theo mô hình BitTorrent.*

| Thời gian | Thao tác trên màn hình (Visual Actions) | Lời thoại thuyết minh (Voiceover Script) |
| :--- | :--- | :--- |
| **2:00 – 2:25** | - Chuyển sang Tab **"Chia sẻ cho nhóm"**.<br>- Chọn 1 file/folder $\rightarrow$ Bấm **"Start Hosting"**.<br>- Hệ thống hiển thị Swarm Link và thông số tổng số Pieces (mảnh 64KB). | *"Tình huống thứ hai: Bạn là giảng viên cần gửi tài liệu cho 50 sinh viên trong phòng, nếu gửi từng người sẽ bị nghẽn mạng. Hãy chọn **Swarm Transfer** — ứng dụng công nghệ WebTorrent phân tán trên nền WebRTC."* |
| **2:25 – 2:50** | - Mở thêm tab người nhận thứ 2 và thứ 3.<br>- Dán link Swarm vào $\rightarrow$ Các tab cùng tải và cùng chia sẻ các mảnh (pieces) cho nhau. | *"Tệp được băm nhỏ thành các mảnh 64KB. Người tải về sẽ đồng thời chia sẻ lại các mảnh đã có cho những người khác trong phòng. Càng nhiều người tải, tốc độ mạng lưới càng nhanh và người gửi ban đầu chỉ cần tải lên đúng một lần duy nhất."* |

---

### PHẦN 4: CHẾ ĐỘ 3 — LƯU TRỮ TẠM ZERO-KNOWLEDGE E2EE (2:50 – 4:00)
*Mục tiêu: Đỉnh cao bảo mật — Giải quyết bài toán người nhận đang offline.*

| Thời gian | Thao tác trên màn hình (Visual Actions) | Lời thoại thuyết minh (Voiceover Script) |
| :--- | :--- | :--- |
| **2:50 – 3:20** | - Chuyển sang Tab **"Lưu trữ E2EE"**.<br>- Kéo file vào.<br>- Chỉ chuột vào ô thông tin: Mật khẩu bảo vệ (16 ký tự) và bảng chính sách: *Thời hạn lưu tạm Dynamic TTL* và *Tự hủy sau khi tải (Burn After Reading)*.<br>- Bấm **"Mã hóa & Lưu tạm"**. | *"Vậy nếu người nhận đang tắt máy thì sao? Chế độ **Lưu trữ E2EE Zero-Knowledge** sinh ra cho tình huống này. Trước khi gửi lên server, file được mã hóa bằng chuẩn quân sự AES-256-GCM kết hợp PBKDF2 100.000 vòng lặp trực tiếp trong RAM trình duyệt của bạn."* |
| **3:20 – 3:45** | - Copy link kết quả: `filebridge.click?stored=xyz#Password`<br>- Phóng to hoặc lia chuột vào phần `#Password`.<br>- Dán link sang tab Người nhận $\rightarrow$ Giải mã và tải về thành công. | *"Điểm đặc biệt nhất: Mật khẩu nằm ở phần sau dấu thăng (#) của đường link. Theo chuẩn web RFC 3986, trình duyệt không bao giờ gửi đoạn này lên máy chủ. Server chỉ thấy các chuỗi byte mã hóa vô nghĩa, hoàn toàn 'Zero-Knowledge' về nội dung của bạn."* |
| **3:45 – 4:00** | - Ngay khi tải xong $100\%$, hiện thông báo: *"File đã tự hủy trên server"*. | *"Để tối ưu ổ cứng và bảo vệ quyền riêng tư, tính năng 'Burn After Reading' sẽ lập tức kích hoạt lệnh xóa sạch vĩnh viễn file trên server ngay khi người nhận tải xong."* |

---

### PHẦN 5: TỔNG KẾT & KÊU GỌI HÀNH ĐỘNG (4:00 – 4:35)
*Mục tiêu: Đọng lại ấn tượng chuyên nghiệp trong lòng ban giám khảo.*

| Thời gian | Thao tác trên màn hình (Visual Actions) | Lời thoại thuyết minh (Voiceover Script) |
| :--- | :--- | :--- |
| **4:00 – 4:20** | - Trở về giao diện trang chủ, chuyển đổi giao diện Dark/Light mode hoặc chuyển đổi ngôn ngữ Tiếng Anh / Tiếng Việt.<br>- Bật icon cài đặt ứng dụng PWA. | *"Với FileBridge, chúng tôi mang đến một trải nghiệm chia sẻ tệp: Nhanh như chớp, Không giới hạn, và Tuyệt đối riêng tư — gói gọn trong một trang web duy nhất không cần cài đặt phần mềm phức tạp."* |
| **4:20 – 4:35** | - Màn hình hiển thị logo lớn và địa chỉ website: `https://filebridge.click`<br>- Thông tin dự án tham dự: *SPC 2026*. | *"Hãy truy cập ngay **filebridge.click** để tự mình trải nghiệm. Cảm ơn quý thầy cô và các bạn đã theo dõi!"* |

---

## 🎙️ 3. TOÀN VĂN LỜI THOẠI (COPY-PASTE VÀO AI LỒNG TIẾNG)

> Bạn có thể copy toàn bộ đoạn văn bản dưới đây và dán thẳng vào các công cụ AI Text-to-Speech (như **CapCut**, **ElevenLabs**, hoặc **Vbee**) để xuất ra file audio lồng tiếng trong 30 giây:

```text
Bạn đã từng bực bội khi gửi ảnh qua Zalo bị mờ, video chất lượng 4K bị bóp méo, hay gửi file nặng qua Google Drive thì báo đầy bộ nhớ 15GB? Các nền tảng gửi file truyền thống bắt bạn tải lên máy chủ của họ, vừa tốn thời gian, vừa tiềm ẩn nguy cơ lộ lọt dữ liệu.

Chào mừng các bạn đến với FileBridge — giải pháp truyền tệp đa phương thức thế hệ mới. Không tài khoản, không giới hạn dung lượng, không nén mờ và bảo vệ quyền riêng tư tuyệt đối bằng mã hóa đầu cuối.

Đầu tiên là chế độ Gửi trực tiếp 1-1 qua WebRTC. FileBridge hỗ trợ kéo thả cả thư mục lẫn file lẻ cùng lúc, bảo toàn trọn vẹn cấu trúc cây phân cấp. Chỉ với 1 click, hệ thống tạo ngay phòng kết nối bảo mật kèm mã QR.

Người nhận chỉ cần nhấp link hoặc quét mã QR bằng điện thoại. Lúc này, dữ liệu nhị phân chạy thẳng qua kênh WebRTC DataChannel giữa hai máy tính mà không lưu bất kỳ byte nào lên máy chủ. Tốc độ truyền đạt tối đa băng thông mạng nội bộ mà không lo tràn RAM nhờ cơ chế Backpressure Flow Control.

Ngay khi nhận xong, thuật toán mã băm SHA-256 sẽ tự động đối chiếu để đảm bảo file nhận được nguyên bản từng pixel. Đặc biệt, người nhận chỉ cần bấm 'Tải toàn bộ (.zip)', toàn bộ cây thư mục sẽ được đóng gói tức thì trong RAM bằng engine fflate siêu nhẹ.

Tình huống thứ hai: Bạn là giảng viên cần gửi tài liệu cho 50 sinh viên trong phòng, nếu gửi từng người sẽ bị nghẽn mạng. Hãy chọn Swarm Transfer — ứng dụng công nghệ WebTorrent phân tán trên nền WebRTC.

Tệp được băm nhỏ thành các mảnh 64KB. Người tải về sẽ đồng thời chia sẻ lại các mảnh đã có cho những người khác trong phòng. Càng nhiều người tải, tốc độ mạng lưới càng nhanh và người gửi ban đầu chỉ cần tải lên đúng một lần duy nhất.

Vậy nếu người nhận đang tắt máy thì sao? Chế độ Lưu trữ E2EE Zero-Knowledge sinh ra cho tình huống này. Trước khi gửi lên server, file được mã hóa bằng chuẩn quân sự AES-256-GCM kết hợp PBKDF2 100.000 vòng lặp trực tiếp trong RAM trình duyệt của bạn.

Điểm đặc biệt nhất: Mật khẩu nằm ở phần sau dấu thăng (#) của đường link. Theo chuẩn web RFC 3986, trình duyệt không bao giờ gửi đoạn này lên máy chủ. Server chỉ thấy các chuỗi byte mã hóa vô nghĩa, hoàn toàn 'Zero-Knowledge' về nội dung của bạn.

Để tối ưu ổ cứng và bảo vệ quyền riêng tư, tính năng 'Burn After Reading' sẽ lập tức kích hoạt lệnh xóa sạch vĩnh viễn file trên server ngay khi người nhận tải xong.

Với FileBridge, chúng tôi mang đến một trải nghiệm chia sẻ tệp: Nhanh như chớp, Không giới hạn, và Tuyệt đối riêng tư — gói gọn trong một trang web duy nhất không cần cài đặt phần mềm phức tạp.

Hãy truy cập ngay filebridge.click để tự mình trải nghiệm. Cảm ơn quý thầy cô và các bạn đã theo dõi!
```

---

## 🛠️ 4. HƯỚNG DẪN DỰNG VIDEO BẰNG CAPCUT TRONG 15 PHÚT

1. **Bước 1**: Mở CapCut $\rightarrow$ Nhập video quay màn hình vừa quay.
2. **Bước 2**: Nhấn *Văn bản (Text) $\rightarrow$ Thêm chữ $\rightarrow$ Dán toàn văn lời thoại ở trên vào $\rightarrow$ Chọn Đọc văn bản (Text to Speech)*:
   - Chọn giọng: *Thanh niên tự tin* hoặc *MC truyền cảm*.
3. **Bước 3**: Canh chỉnh tốc độ phát của video màn hình cho khớp với từng câu của giọng đọc AI (chỗ nào tải file nhanh thì tua chậm lại x0.8, chỗ nào chờ bắt tay thì tua nhanh x1.5).
4. **Bước 4**: Nhấn *Tự động tạo phụ đề (Auto Captions)* để CapCut tự sinh phụ đề tiếng Việt chạy theo lời nói.
5. **Bước 5**: Thêm một bài nhạc nền nhẹ nhàng (BGM) với âm lượng nhỏ khoảng $15\%$ $\rightarrow$ Xuất file video 1080p 60fps!
