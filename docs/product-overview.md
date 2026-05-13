# Web Knowledge Base — Tổng Quan Sản Phẩm

> Phiên bản tài liệu: 1.0 — Cập nhật: 2026-05-06

---

## 1. Tầm Nhìn Sản Phẩm

**Web Knowledge Base** là nền tảng quản lý kiến thức cá nhân chạy trên trình duyệt, được thiết kế để trở thành "thư viện số" duy nhất mà người dùng cần. Thay vì lưu trữ tài liệu rải rác ở nhiều nơi, người dùng tập trung toàn bộ tài liệu — từ PDF học thuật, sách EPUB, file ghi âm bài giảng đến video học tập — vào một không gian duy nhất, có thể đọc, ghi chú, tra cứu và nghe lại mọi lúc, kể cả khi không có mạng.

**Giá trị cốt lõi:**
- **Tập trung** — Một nơi duy nhất cho mọi loại tài liệu học tập
- **Sâu hơn** — Ghi chú, highlight, transcript tự động giúp nắm bắt nội dung hiệu quả
- **Liền mạch** — Đồng bộ vị trí đọc cross-device, hoạt động offline

---

## 2. Đối Tượng Người Dùng

| Nhóm | Nhu Cầu Chính | Tính Năng Phù Hợp |
|------|--------------|-------------------|
| **Học sinh / Sinh viên** | Đọc tài liệu học tập, ghi chú bài giảng | PDF/EPUB reader, highlights, ghi chú Markdown |
| **Người đi học thêm / học online** | Lưu trữ và xem lại video/audio bài giảng | Audio/Video viewer, transcript tự động, subtitle |
| **Nghiên cứu viên** | Tổ chức nguồn tài liệu lớn, tìm kiếm nội dung | Thư mục/thẻ, full-text search, Web Clip |
| **Người học tự chủ** | Ghi âm lại buổi học, tạo phiên âm | Ghi âm tích hợp, Groq Whisper transcription |
| **Chuyên gia / Nhân viên** | Lưu tài liệu nội bộ, tìm lại nhanh | DOCX/PPTX viewer, folder hierarchy, search |

---

## 3. Tính Năng Chính

### 3.1 Thư Viện Tài Liệu

Trung tâm quản lý toàn bộ nội dung của người dùng.

- **Tải lên đa định dạng** — Kéo-thả hoặc chọn file; hỗ trợ 9 loại định dạng (xem bảng bên dưới)
- **Tổ chức thư mục** — Cấu trúc folder lồng nhau tùy ý
- **Gắn thẻ tự do** — Tag nhiều nhãn trên một tài liệu, lọc theo thẻ
- **Tìm kiếm toàn văn** — Tìm theo tiêu đề và nội dung trích xuất
- **Lọc nâng cao** — Theo định dạng, trạng thái, thẻ, thư mục
- **Thùng rác** — Xóa mềm, tự dọn sau 30 ngày

**Định dạng được hỗ trợ:**

| Định dạng | Mô tả |
|-----------|-------|
| PDF | Tài liệu học thuật, sách giáo khoa |
| EPUB | Sách điện tử |
| DOCX | Tài liệu Word |
| PPTX | Bài thuyết trình PowerPoint |
| Markdown | Ghi chú kỹ thuật, tài liệu code |
| Hình ảnh | JPG, PNG, WebP, GIF |
| Audio | MP3, M4A, WAV, WebM |
| Video | MP4, WebM |
| Web Clip | Bài viết lưu từ trình duyệt |

---

### 3.2 Đọc Tài Liệu

Mỗi loại tài liệu có viewer chuyên biệt, tối ưu cho trải nghiệm đọc.

- **PDF** — Chế độ Trang (page-by-page) hoặc Cuộn liên tục; zoom; text layer
- **EPUB** — Flow phân trang hoặc cuộn; tùy chỉnh font, cỡ chữ, độ rộng cột
- **DOCX / PPTX** — Hiển thị bám sát layout gốc; mục lục tự động
- **Markdown** — Render đầy đủ với biểu đồ Mermaid, công thức KaTeX, TOC
- **Web Clip** — Chế độ "đọc sạch" (Readability) loại bỏ quảng cáo
- **Tùy chỉnh giao diện** — Theme sáng / sepia / tối; font size 12–28px; line height

---

### 3.3 Nghe & Xem Media

- **Audio Player** — Tốc độ phát 0.5×–2×; thanh seek với tổng thời gian; hiển thị sóng âm
- **Video Player** — Phát video với subtitle overlay; tốc độ phát tùy chỉnh
- **Transcript Panel** — Hiển thị phiên âm cuộn đồng bộ với thời gian phát

---

### 3.4 Ghi Âm Tích Hợp

Người dùng có thể ghi âm trực tiếp trong ứng dụng mà không cần công cụ bên ngoài.

- **Ghi âm giọng nói** — Từ micro; lưu tự động vào thư viện
- **Ghi màn hình** — Kèm âm thanh hệ thống hoặc micro
- **Lưu dưới dạng audio** — Xuất hiện trong thư viện như tài liệu audio thông thường
- **Xử lý thông minh** — Tự động phát hiện thời lượng, tối ưu dung lượng file

---

### 3.5 Tạo Transcript Tự Động

Biến file audio/video thành văn bản có thể đọc và tra cứu.

- **Nhận dạng giọng nói** — Powered by Groq Whisper (whisper-large-v3), hỗ trợ tiếng Việt và đa ngôn ngữ
- **Xử lý file lớn** — Tự động chia nhỏ file theo cluster webm boundary, gửi từng phần đến Groq
- **Tự động phát hiện ngôn ngữ** — Không cần cài đặt thủ công
- **Đồng bộ thời gian** — Mỗi đoạn văn bản gắn với timestamp trong file gốc

---

### 3.6 Dịch Transcript

- **Dịch sang tiếng Việt / tiếng Anh** — Powered by Groq LLaMA 3.3 70B
- **Chế độ song ngữ** — Hiển thị song song nguyên bản và bản dịch
- **Subtitle overlay** — Hiển thị phụ đề trực tiếp trên video/audio đang phát

---

### 3.7 Ghi Chú & Annotation

Công cụ ghi chú gắn liền với nội dung tài liệu.

- **Highlight** — Bôi đánh dấu văn bản với 5 màu cố định + màu tùy chỉnh (HEX)
- **Sticky note** — Gắn ghi chú vào từng highlight
- **Bookmark** — Đánh dấu trang / vị trí / timestamp
- **Ghi chú cá nhân** — Workspace Markdown riêng bên cạnh tài liệu
- **Panel annotation** — Sidebar tổng hợp toàn bộ highlights và notes của một tài liệu

---

### 3.8 Đồng Bộ & Offline

- **Ghi nhớ vị trí đọc** — Tự động lưu và khôi phục vị trí trên mọi thiết bị
- **Multi-tab workspace** — Mở nhiều tài liệu cùng lúc, trạng thái tab được đồng bộ
- **Offline-first (PWA)** — Cài đặt như app native; hoạt động khi mất mạng
- **Xung đột dữ liệu** — Giải quyết tự động theo cơ chế Last-Write-Wins

---

## 4. Luồng Sử Dụng Chính

### Luồng A — Học từ file tài liệu có sẵn

```
Tải lên PDF/EPUB
    → Mở đọc trong Reader
    → Bôi highlight các đoạn quan trọng
    → Viết ghi chú bên cạnh
    → Bookmark trang cần xem lại
    → Tìm lại nội dung qua Search
```

### Luồng B — Học từ bài giảng audio/video

```
Upload file audio/video (hoặc ghi âm trực tiếp)
    → Nghe / xem trong Media Viewer
    → Tạo Transcript tự động
    → Đọc transcript đồng bộ với audio
    → Dịch transcript sang tiếng Việt (nếu cần)
    → Ghi chú những điểm quan trọng
```

### Luồng C — Lưu bài viết từ web

```
Lưu URL bài viết (Web Clip)
    → Mở ở chế độ "đọc sạch"
    → Highlight và ghi chú
    → Tổ chức vào folder theo chủ đề
    → Tìm kiếm lại bằng từ khóa
```

### Luồng D — Ghi âm và học lại

```
Ghi âm buổi học / cuộc họp
    → File lưu tự động vào thư viện
    → Tạo transcript tự động
    → Đọc phiên âm có đánh dấu thời gian
    → Dịch nếu là nội dung tiếng Anh
    → Lưu ghi chú từ buổi học
```

---

## 5. Kiến Trúc Kỹ Thuật (Tóm Tắt)

| Lớp | Công Nghệ | Ghi Chú |
|-----|-----------|---------|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS | App Router, Turbopack |
| **Backend / DB** | Convex | Realtime, serverless, tự đồng bộ |
| **Storage** | Cloudflare R2 / Convex Storage | Chọn theo dung lượng file |
| **Auth** | Better Auth | OAuth + email/password + 2FA TOTP |
| **Transcription** | Groq Whisper API | whisper-large-v3 |
| **Translation** | Groq LLaMA 3.3 70B | Chat completions |
| **PWA** | Service Worker | Offline, installable |

---

## 6. Trạng Thái Phát Triển

| Tính Năng | Trạng Thái |
|-----------|------------|
| Thư viện tài liệu (9 định dạng) | ✅ Hoàn thành |
| Reader với annotation | ✅ Hoàn thành |
| Ghi âm tích hợp | ✅ Hoàn thành |
| Transcript tự động | ✅ Hoàn thành |
| Dịch transcript | ✅ Hoàn thành |
| Offline / PWA | ✅ Hoàn thành |
| Ghi chú Markdown | ✅ Hoàn thành |
| Thư mục & thẻ | ✅ Hoàn thành |
| Full-text search | ✅ Hoàn thành |
| Chia sẻ & cộng tác | 🔄 Đang phát triển |

---

*Tài liệu này mô tả sản phẩm từ góc nhìn business. Tài liệu kỹ thuật chi tiết (schema, API, deployment) xem tại thư mục `docs/`.*
