# PRD (mỏng) — Module "Học tập" (Study)

**Ngày:** 2026-07-15 · **Trạng thái:** Draft — chờ chốt UI prototype
**Quy trình:** PRD mỏng → UI + seed data (view trước) → chốt giao diện → spec chi tiết → backend

---

## 1. Vấn đề

User upload handbook (Markdown/PDF) lên Web KB và **chỉ đọc rồi thôi** — không có vòng lặp active recall / spaced repetition / tự giải thích, nên kiến thức phai nhanh (đường cong quên Ebbinghaus). Mục tiêu của user là **học sâu và học kỹ**.

## 2. Giải pháp

Module **"Học tập"** riêng (ngang hàng Thư viện / Ghi chú), tổ chức quanh khái niệm **Không gian học (Study Space)**:

- 1 Space = 1 "lớp học" tự tạo, nguồn học liệu gắn từ **handbook (cả cây)** hoặc **tài liệu lẻ** (cherry-pick)
- Handbook lớn được chiếu thành **lộ trình học (study units)** theo đúng cây thư mục, mỗi unit có trạng thái: ⬜ Chưa học → 🔵 Đang học → 🟡 Đã đọc-chưa vững → 🟢 Vững → 🔴 Cần học lại (tự phai khi lâu không ôn)
- Triết lý: **không khóa việc đọc, không trừng phạt** — hậu quả của việc bỏ bài được làm cho *nhìn thấy* (unit vàng/đỏ, streak không nhảy), không chặn

## 3. Tính năng v1 (5 + nền tảng)

| # | Tính năng | Mô tả ngắn | AI |
|---|---|---|---|
| 1 | **Flashcard + ôn giãn cách** | AI sinh 6-9 card/phiên (3 loại: khái niệm / vận dụng / liên kết), user duyệt trước khi lưu; ôn 2 nút Quên/Nhớ, interval nhân đôi | Sinh: có · Ôn: không |
| 2 | **Feynman nói/gõ** | Sau 1-3 tiểu mục, 🎤 giảng lại → AI chấm rubric 4 mục (đúng / sót / sai / chiều sâu — có ví dụ riêng? edge case?), lưu thành nhật ký | 1 call gộp audio+chấm |
| 3 | **Pre-questions** | Mở section chưa đọc → 3-5 câu hỏi định hướng tầng khái niệm, cache 1 lần/section | Có, cache |
| 4 | **Quiz 3+2** | 3 trắc nghiệm tầng vận dụng (mỗi đáp án sai có giải thích) + 2 tự luận ngắn AI chấm ý; mọi câu kèm **trích đoạn gốc** click nhảy về tài liệu; lưu điểm | Có |
| 5 | **Tracking + lộ trình** | Trang Tiến độ: lộ trình cây có trạng thái, "thực đơn hôm nay" (mới xen cũ), chỗ yếu, heatmap + streak (chỉ tính hành động chủ động) | Không |

**Nền tảng dùng chung:** section parser (heading MD / khoảng trang PDF) · `getScopeText` giới hạn scope **1-3 tiểu mục** · checkpoint tự động ("từ lần ôn trước tới chỗ đang đọc") · 1 route AI structured-output · quota guard 429 + map task→model.

## 4. Không làm ở v1 (non-goals)

- AI Chat với tài liệu (RAG) — quota ngốn, để sau
- Knowledge graph / backlinks
- SM-2/FSRS đầy đủ (interval nhân đôi là đủ; `review_logs` ghi sẵn để nâng cấp)
- "Chế độ nghiêm" (khóa unit kế khi quiz < 80%) — flag để sau
- Xuất Anki, TTS, cộng tác nhiều user

## 5. Ràng buộc cứng

- **$0/tháng vĩnh viễn:** Supabase free tier + Gemini free tier qua key user tự cấp (`userAiSettings` có sẵn)
- Quota thực tế ~10 call/ngày học so với trần ~250/ngày → an toàn; mọi hoạt động *ôn* chạy local không AI
- Stack hiện tại: Next.js App Router + Supabase (nhánh `supabase`), panel keep-alive qua AppShell
- Mobile-first cho màn ôn tập (ôn card trên điện thoại)

## 6. Luồng chính

1. **Tạo space** → đặt tên → gắn nguồn (handbook hoặc chọn tài liệu lẻ) → lộ trình tự sinh từ cây
2. **Học hằng ngày:** mở space → "Thực đơn hôm nay" = tiếp unit mới (1-3 tiểu mục) + ôn card đến hạn (xen module cũ) + vá unit 🔴
3. **Trong reader:** nút nổi "Học phần này" → quiz/Feynman đúng scope checkpoint → kết quả ghi về space
4. **Cuối module cấp 1:** trạm tổng kết — quiz xuyên section + Feynman "giảng cả module 5 phút"

## 7. Màn hình (phạm vi UI prototype)

| Màn | Nội dung |
|---|---|
| `/study` — Danh sách space | Card các space (tên, nguồn, tiến độ, card đến hạn, streak) + nút tạo space |
| Space → tab **Tổng quan** | Thực đơn hôm nay · lộ trình cây trạng thái · chỗ yếu · heatmap + streak |
| Space → tab **Ôn tập** | Flashcard lật, 2 nút Quên/Nhớ, đếm tiến độ phiên |
| Space → tab **Kiểm tra** | Danh sách section + lịch sử điểm · quiz runner 3+2 · kết quả kèm trích đoạn |
| Space → tab **Feynman** | Nút 🎤 thu (mock) · kết quả rubric 4 mục · nhật ký phiên |

Điều hướng: thêm tab "Học tập" vào BottomNav (mobile) + mục "Học tập" trong sidebar (desktop). Panel keep-alive `study` trong AppShell, giống Notes/Settings.

## 8. Khái niệm dữ liệu (định hình — chi tiết ở spec sau)

`study_spaces` · `study_space_sources` (↔ handbook/doc) · `study_units` (materialize từ cây, orderIndex, status, masteryScore) · `study_checkpoints` · `section_questions` (cache) · `quiz_attempts` · `flashcards` + `review_logs` · `feynman_sessions` · `study_sessions` (→ heatmap/streak)

## 9. Tiêu chí thành công

- Vòng lặp trọn vẹn chạy được: đọc → quiz → Feynman → card sinh ra → hôm sau có card ôn → heatmap ghi nhận
- 1 ngày học nặng ≤ ~10 call Gemini; hết quota thì mọi tính năng không-AI vẫn chạy
- Unit "Vững" đòi đủ: đọc xong + quiz ≥ 80% + ≥ 1 Feynman
- User (solo) duy trì được thói quen: streak hiển thị đúng, thực đơn ngày < 30 phút

## 10. Câu hỏi mở

- [ ] Tên module: "Học tập" (đang dùng cho prototype) — chốt sau khi xem UI
- [ ] Ngưỡng "Vững" 80% và ngưỡng phai màu 🔴 (bao nhiêu ngày không ôn?) — tinh chỉnh ở spec
- [ ] Trạm tổng kết module: bắt buộc trên lộ trình hay optional?
