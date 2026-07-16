# SPEC-FEATURES — Module "Học tập": chi tiết từng tính năng

**Bổ sung cho** [SPEC.md](./SPEC.md) (data model, rule engine, AI, routing). File này: I/O matrix + acceptance từng màn/tính năng. Provenance dùng chung: `[CODE]` / `[PM]` / `[BE]` / `[MOCK→BE]`.

---

## 0. Danh sách space `/study` `[CODE]`

**Layout:** container rộng đồng bộ màn trong (`max-w-4xl` → tối đa ~1400px từ `2xl`). Nút hero "+ Không gian học" trên cùng (lối tạo DUY NHẤT — đã bỏ ghost card trùng lặp).

**4 stat tile gộp toàn bộ space** (số dùng token chữ, icon mang màu ngữ nghĩa), giá trị theo NGÀY hiện tại `[MOCK→BE]`:
1. 🔥 chuỗi ngày (streak) · 2. card đến hạn · 3. phút hôm nay · 4. tiểu mục vững.

**Grid card space** 1→2→3 cột: emoji tile nền `primary/10`, tên, `sourceLabel`, progress bar (% đậm), badge card đến hạn, hover nhấc + "Vào học →". Click = deep-link `/study/:spaceId`.

| Scenario | Input/State | Output | Error |
|---|---|---|---|
| Chưa có space | 0 space | Empty state + nút tạo | — |
| Tạo space `[BE]` | Click "+ Không gian học" | Wizard tạo space (§0.1) → materialize `study_units` từ file được chọn → về overview | Không chọn file nào → chặn |
| Stat tiles | Có tracking | 4 số tính theo hôm nay từ `study_sessions`/`flashcards`/`study_units` | Chưa có data → 0 |

**Acceptance:** Given vào `/study` có space, when render, then 4 stat + grid card đúng số theo hôm nay; when click card, then vào `/study/:id` tab Tổng quan.

### 0.1. Wizard tạo space `[BE]` — chọn file học

**Space = "tủ sách của lớp học"** — phạm vi học liệu ổn định; thứ tự học & lịch để cho Plan lo (§6). Bước:
1. **Tên + emoji.**
2. **Chọn nguồn:** handbook (chọn 1 handbook) HOẶC tài liệu lẻ (cherry-pick nhiều doc).
3. **Chọn file học** (handbook): cây file có checkbox, **tự bỏ tick file phụ trợ** (`00-*`, `_glossary`, tên khớp mục-lục/kế-hoạch/glossary/index/toc — §SPEC 2.1). User tick lại nếu muốn học. Ví dụ handbook thật: tick 01,02,03,04,06,07,08; bỏ `00-KE-HOACH`, `00-MUC-LUC`, `_glossary`.
4. **Xác nhận** → materialize `study_units` (eager, chỉ từ file tick) + ghi `study_space_sources`.

| Scenario | Input | Output | Error |
|---|---|---|---|
| Handbook nhiều file phụ trợ | chọn handbook | file `00-*`/`_glossary` bỏ tick sẵn; nội dung tick sẵn | — |
| Bỏ hết tick | 0 file | nút Tạo disabled | "chọn ít nhất 1 file" |
| Thêm file vào handbook sau | — | reconcile §SPEC 2.3.1 (không auto) | — |

**Acceptance:** file phụ trợ tự bỏ tick; chỉ file được tick thành module trong lộ trình; đổi tập file sau = reconcile chủ động.

---

## 1. Tab Tổng quan (overview) `[CODE]`

**Layout 2 cột ≥xl `[PM]`:** cột chính = lộ trình cây; side rail sticky ~340px = HÔM NAY + CẦN HỌC LẠI + HOẠT ĐỘNG (heatmap) + chú giải. `<xl`: 1 cột xếp dọc. Side rail hiện xuyên mọi tab ở ≥xl.

### 1.1. Lộ trình cây (Syllabus) `[CODE]`

- Đệ quy: `ModuleNode` (có children) vs `UnitRow` (leaf). Module tự bung nếu `status='reading'` hoặc chứa unit decayed sâu.
- Header module: chấm trạng thái + tiêu đề + `"{mastered}/{total} vững"` (đếm leaf đệ quy).
- **Checklist 4 việc/tiểu mục `[PM]`** — click dòng = bung checklist (KHÔNG mở doc trực tiếp). Thứ tự cố định:
  1. **Đọc bài** — done khi `readPct ≥ 100`; action mở reader + scroll heading.
  2. **Quiz ≥ 80%** — done khi `quizBest ≥ 80`; action `GoTab('quiz',{sectionId})`.
  3. **Tạo flashcard** — done khi `cardsMade`; action `GoTab('review',{unitKey})`.
  4. **Giảng lại (Feynman)** — done khi `feynmanCount > 0`; action `GoTab('feynman',{unitKey})`.
  - Badge `N/4`; 4 icon mini (emerald nếu done) trên dòng thu gọn (desktop).
  - **Đủ 4 = Vững 🟢** (mastery formula hiển thị tường minh).
  - Unit decayed 🔴: banner đỏ "Từng hoàn thành nhưng lâu không ôn — làm lại quiz để xanh trở lại" (recovery = **quiz-only**).
  - "Ôn flashcard định kỳ" KHÔNG nằm trong checklist (vòng lặp vô hạn, thuộc tab Ôn tập).
- **Trạm tổng kết** `[PM]`: banner dashed ở mục x.y khi các tiểu mục con đều leaf — "mở khi đủ 🟢". Quiz xuyên section + Feynman "giảng cả mục". **Đã chốt: OPTIONAL (khuyến nghị)** — hiện như gợi ý, KHÔNG chặn qua mục kế (không thêm cột gating). "Chế độ nghiêm" (chặn) là flag để sau.

### 1.2. HÔM NAY (today menu) `[MOCK→BE]`

Rule chọn nội dung (0 AI), thứ tự ưu tiên + **DEDUP bắt buộc** (1 việc không xuất hiện 2 nguồn), cap 4–5:
1. Việc buổi hôm nay trong plan chưa xong.
2. Nợ carry-over buổi đã qua (vd "còn nợ Quiz 2.2.3 từ hôm qua").
3. Ôn X card đến hạn (luôn hiện khi X>0).
4. Chưa có plan → fallback "Đọc tiếp" unit 🔵 + remediation 🔴.

`TodayItem = { type: 'read'|'review'|'quiz'|'fix'; label; detail; quizSectionId? }`. Icon/target theo type; `fix` viền đỏ. Click = điều phối tab đúng ngữ cảnh.

### 1.3. CẦN HỌC LẠI (weak spots) `[MOCK→BE]`

Công thức vào danh sách (tính từ `quiz_attempts`/`review_logs`/`study_sessions`):
- unit 🔴 decay (>14 ngày không hoạt động chủ động sau khi 🟢), HOẶC
- quiz best < 80% (≥1 lần làm), HOẶC
- card "Quên" ≥ 3 lần / 30 ngày (`forgetCount30d`).

`reason` = template + số thật; sort theo điểm rủi ro; cap 3. Ra khỏi danh sách khi quiz lại ≥ 80%. Nút "Học lại" → `GoTab('quiz',{sectionId})`.

### 1.4. HOẠT ĐỘNG (heatmap + streak) `[MOCK→BE]`

- Heatmap 84 ô (12 tuần), 5 mức màu emerald theo phút chủ động/ngày (§SPEC 2.9).
- Streak: chỉ ngày có active-recall; có plan → chỉ tính ngày-học-theo-lịch (nghỉ đúng lịch không đứt). Footnote: "chỉ tính khi ôn card / làm quiz / Feynman (mở ra đọc không tính)".

**Acceptance:** đủ 4 việc → unit thành 🟢; unit 🟢 quá 14 ngày → 🔴 + vào CẦN HỌC LẠI; ngày làm quiz/Feynman/ôn card → 1 ô heatmap sáng + streak +1; mở-đọc-thôi → không đổi streak.

---

## 2. Tab Ôn tập (Review) — Flashcard + SRS `[CODE]`

**2 chế độ:** `CardLibrary` (duyệt) ↔ `ReviewSession` (lật/chấm). Đổi ctx (`focusUnitKey`) → luôn về library.

### 2.1. Thư viện card `[CODE][PM]`

- Nút "Ôn hôm nay (X card đến hạn)" trên cùng → session với **tất cả card `due` toàn space, trộn thứ tự tiểu mục**.
- Card gom theo tiểu mục → theo module. **Chỉ tiểu mục ĐÃ CÓ ≥1 card mới xuất hiện** (chưa tạo → vô hình; tạo qua checklist Tổng quan).
- Mỗi nhóm tiểu mục: bung xem từng card (front/back/quote + "mở tài liệu →"), nút "Ôn bộ này" (session scope = card của đúng tiểu mục, bỏ qua due).
- 3 loại card: `concept` (Khái niệm, xanh, 💡) / `apply` (Vận dụng, tím, 🔧) / `link` (Liên kết, teal, 🔗). Card row hiện due badge hoặc "ôn lại sau Nd".

### 2.2. Phiên ôn (flip) `[CODE][PM]`

- Front → tap → `flipped` lộ back + quote. **2 nút chỉ hiện sau khi lật:**
  - **Quên** → "ôn lại ngày mai" (`intervalAfter=1`).
  - **Nhớ** → "gặp lại sau `intervalDays*2` ngày" (**interval nhân đôi**).
- Mỗi lần chấm ghi `review_logs` (rating, interval trước/sau) + cập nhật `flashcards.dueAt/intervalDays/lastReviewedAt`; "Quên" tăng `forgetCount30d`.
- Kết thúc: "Nhớ X/total · (total−X) Quên quay lại mai, Nhớ giãn gấp đôi". Nút "Về thư viện" / "Ôn lại".

### 2.3. Tạo card (từ checklist) `[MOCK→BE]`

Lần đầu bấm "Tạo flashcard" 1 tiểu mục → 1 call Gemini sinh **8–12 card** (§SPEC 4.2) → **user duyệt từng card trước khi lưu** (giữ/sửa/bỏ) → lưu `flashcards`, `dueAt = now` (đến hạn ngay để vào vòng ôn). `cardsMade` của unit thành true.

| Scenario | Input | Output | Error |
|---|---|---|---|
| Ôn hôm nay | X card due | session trộn tiểu mục | X=0 → ẩn nút / "không có card đến hạn" |
| Chấm Nhớ | card interval N | dueAt = now + 2N ngày; log | — |
| Chấm Quên | card | dueAt = mai; log; forget+1 | — |
| Tạo card lần đầu | tiểu mục | "AI đang tạo…" → duyệt N card → lưu | 429 → toast quota, không lưu |
| Tiểu mục chưa có card | — | không hiện trong thư viện | — |

**Acceptance:** Nhớ → interval gấp đôi ghi log; Quên → về mai + forget+1; tạo card = 1 call + duyệt trước khi lưu; chỉ tiểu mục có card hiện trong thư viện.

---

## 3. Tab Kiểm tra (Quiz) — 3 MCQ + 2 tự luận `[CODE]`

**View states:** `list → generating → run → review`.

### 3.1. Danh sách section `[CODE][PM]`

- Gom theo module. **Chỉ section có lịch sử (`attempts>0`) hiện**, TRỪ khi được điều phối tới (`focusSectionId`) → section chưa làm cũng hiện + scroll + ring + nhãn "quiz của tiểu mục bạn vừa chọn".
- Mỗi section: chip điểm từng lần (≥80 xanh / 60–79 vàng / <60 đỏ), "↗ tiến bộ" nếu lần cuối > lần đầu. Nút "Xem lại" (mở bài cũ) + "Làm lại".

### 3.2. Sinh & làm quiz `[MOCK→BE]`

- Lần đầu (`attempts=0`) → state `generating`: "AI đang tạo đề… 1 call Gemini, lưu lại, lần sau không tốn call". → 1 call sinh 5 câu → cache `section_questions`. Làm lại dùng cache (0 call).
- **Runner:** tuần tự. MCQ: chọn → "Trả lời" → lộ đúng/sai + `explainWrong` → "Câu tiếp". Open: textarea, "Trả lời" (non-empty) → lộ nhận xét. Quote hiện sau khi nộp, click "mở đúng vị trí trong tài liệu →".
- **Chấm `[MOCK→BE]`:** MCQ đúng/3 (deterministic) + **2 tự luận AI chấm thật /2** (prototype hardcode 1.5/2). `score = round((mcqCorrect + essayScore)/5*100)`. Nộp = 1 call chấm gộp 2 câu open.
- Ghi `quiz_attempts` (append-only) gồm `answers` JSON + `aiFeedback` → render lại bài. `quizBest` = max.
- Nút "Tạo flashcard từ câu sai" → wire tới flow tạo card scope các câu sai `[BE]` (prototype nút chết).

### 3.3. Xem lại (AttemptReview) `[CODE][PM]`

Chip điểm cũ click → màn xem lại đầy đủ: MCQ hiện đáp án đã chọn (✓/✗) + `explainWrong`; open hiện `openText` (hoặc "(bỏ trống)") + nhận xét AI + quote. Nút "Làm lại bài này". Lịch sử append-only — làm lại KHÔNG xóa.

**Acceptance:** section chưa làm chỉ hiện khi điều phối tới; lần đầu = 1 call sinh đề rồi cache; làm lại 0 call; tự luận AI chấm thật; chip điểm cũ render lại được bài từ `answers`; điểm tốt nhất dùng cho checklist.

---

## 4. Tab Feynman — giảng nói/gõ `[CODE]`

**State máy thu (mock→thật):** `idle → recording → processing → result`. Bản thật: thu audio thật → dừng → **1 call Gemini gộp** (transcribe + đối chiếu tài liệu + rubric) → result.

### 4.1. Hai chế độ `[PM]`

- **Checklist mode** (`focusUnitKey` && !freeMode): **khóa scope = [unitKey]**, không picker. Link thoát "giảng tự do →".
- **Free mode:** scope mặc định = checkpoint (từ lần ôn trước → chỗ đang đọc, §SPEC 2.4). `toggleScope` cap **`MAX_SCOPE=4`**. Chọn ≥2 → AI chấm thêm `connection` (kết nối, kể cả cross-module).
- **Scope tường minh `[PM]`:** hiện "SẼ GIẢNG THEO N TIỂU MỤC" + chip tên từng tiểu mục (không câu mơ hồ). Nút "chỉnh" mở picker checkbox: **chỉ tiểu mục đã đọc (`readPct>0`)**, tối đa 3–4, có ô lọc tên/số + chấm trạng thái + "↺ phần vừa đọc" reset về checkpoint. Mic disable khi scope rỗng.
- Nút "hoặc gõ thay vì nói" → textarea fallback `[BE]` (prototype nút chết).

### 4.2. Rubric + nhật ký `[CODE]`

- `RubricCard`: header scope + ngày + thời lượng + badge (✓ correct luôn hiện, "sót N"/"sai N" khi >0). Body: transcript excerpt → **Nắm đúng → Bỏ sót (vàng) → Hiểu chưa đúng (đỏ)** → khối CHIỀU SÂU (2 pill: có ví dụ riêng? / có nêu giới hạn?) → **follow-up question (luôn có)** → (nếu linked) mục `connection`. Nút "Giảng lại tiểu mục này".
- **Nhật ký:** phiên liên kết (`scopeLabel` chứa "↔") tách nhóm riêng "🔗 Phiên liên kết" trên cùng; còn lại gom module→tiểu mục. Chỉ tiểu mục có ≥1 phiên hiện. Điều phối tới unit chưa có phiên → box dashed mời ghi lần đầu.
- Xem lại đầy đủ + "Giảng lại" (append-only).

| Scenario | Input | Output | Error |
|---|---|---|---|
| Từ checklist | unitKey | scope khóa [unitKey], mic sẵn sàng | — |
| Tự do ≥2 mục | 2–4 unit đã đọc | rubric + connection | chọn mục chưa đọc → không cho |
| Dừng thu | audio + scope | 1 call → rubric | 429 → toast quota, giữ audio |
| Chọn >4 mục | — | chặn ở 4 (im lặng) | — |

**Acceptance:** checklist mode khóa đúng 1 tiểu mục; tự do tối đa 4, ≥2 mục có `connection`; dừng thu = 1 call gộp; rubric đủ 6 phần + follow-up luôn có; phiên liên kết tách nhóm; nhật ký append-only.

---

## 5. Pre-questions (câu hỏi định hướng) `[PRD][BE]`

Mở section CHƯA đọc → 3–5 câu hỏi định hướng tầng khái niệm (kích hoạt tò mò trước khi đọc). 1 call, cache `section_questions(kind='pre')` 1 lần/section. Optional v1 (ưu tiên sau 4 tính năng lõi). Không chấm — chỉ gợi mở.

---

## 6. Tab Kế hoạch (Plan) `[CODE][PM]`

Rule engine §SPEC 3. **0 call Gemini** kể cả ở BE.

### 6.1. Wizard `[CODE]`+`[BE mở rộng]`

- **Bước 1 — Chọn & xếp module:** bảng `ModuleLoad` theo module (tick chọn subset học đợt này, `defaultOn` = module đang học dở). Module coarse gắn "(ước lượng)". **Kéo-thả sắp thứ tự học** (lưu `moduleOrder`). Footer: tổng tiểu mục + tổng giờ. Footnote định mức (600 ký/phút, ACT_MIN).
- **Bước 2 — Mô hình lịch** (chọn 1 trong 2, §SPEC 2.10):
  - **① Tuần tự** (mặc định, `[CODE]`): chip chọn T2–CN chung; học hết module này sang module kế theo thứ đã xếp. Stepper số ngày (±1, ±5 khi ≥30) ↔ giờ/ngày **live 2 chiều**; khuyến nghị `recommendDays`; ngày xong dự kiến; cảnh báo Nặng (>150′)/Nhẹ (<25′).
  - **② Theo luồng** (`[BE]`): **bảng gán module × thứ** — mỗi module tick các thứ nó học. 1 thứ gán nhiều module thì học **tuần tự theo thứ tự đã xếp** (module trước hết sạch unit mới sang module sau — KHÔNG chia đôi buổi; buổi giao nhau học tiếp module kế để không phí giờ). Chỉ chọn target giờ/ngày; rule **mô phỏng** ra ngày xong dự kiến + tải/buổi (không có stepper số ngày vì lịch do bảng gán quyết định). Cảnh báo ngày nào vượt ngưỡng nặng.

    | Module | T2 | T3 | T4 | T5 | T6 | T7 | CN |
    |---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
    | M2 | ☑ | ☐ | ☑ | ☐ | ☑ | ☐ | ☐ |
    | M3 | ☐ | ☑ | ☐ | ☑ | ☐ | ☑ | ☐ |
    | M6 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☑ |
- **NHẮC HỌC:** toggle + tối đa 4 `<input type=time>` (mặc định 08:45 / 21:15) + caveat iOS PWA. → §7.
- Nút "Tạo kế hoạch chi tiết →" (disable nếu totalMin=0 hoặc — mode tuần tự: không chọn thứ / mode luồng: có module chưa gán thứ nào) = **LƯU SNAPSHOT** (§SPEC 2.10), KHÔNG regenerate.

### 6.2. Lịch (calendar grid) `[CODE][PM]` (benchmark Prep.vn)

- Buổi = CARD "Buổi N" xếp **grid** `sm:2 xl:3` cột, separator theo tháng "Tháng M · YYYY".
- Border trạng thái: `allDone` xanh / `isToday` ring primary / `late` (quá khứ + chưa xong) vàng / else neutral. Badge "Buổi N" + ✓ nếu xong hết.
- Task row: **chấm tròn trái = tick done** (mock local; thật = suy từ hành động, §SPEC 2.10) + **nhãn click = điều hướng** (read→reader; quiz/cards/feynman→GoTab ctx; review→tab Ôn; station→toast giải thích gating). Nhãn task **tự giải thích** vì sao tồn tại.
- Legend màu type: read=xanh, quiz=vàng, cards=tím, feynman=emerald, station=primary, review=xám.

### 6.3. Panel tiến độ `[CODE][PM]`

- "{N} buổi · ≈{giờ}/buổi", ngày xong dự kiến, chip giờ nhắc.
- Thanh tiến độ `done/total`; **đếm "N buổi chưa hoàn thành"** (ngày quá khứ còn task chưa done); cảnh báo "chậm hơn kế hoạch".
- **"Xếp lại lịch"** = dồn việc chưa xong, xếp lại từ mai bằng rule (§SPEC 3.5) — plan mới active, cũ archived. **"Điều chỉnh"** = về wizard (đổi module/thứ tự/mô hình lịch/bảng gán) rồi tạo plan mới.
- **Đổi thứ tự / gán lại thứ giữa chừng** = "Điều chỉnh" → sửa → "Xếp lại lịch": chỉ áp cho việc chưa xong, giữ tiến độ (§SPEC 3.5).
- **Module xong sớm (mode luồng):** panel gợi ý "M2 đã xong — còn N buổi T2/4/6 trống, Xếp lại lịch để dồn phần còn lại?" (không auto).
- Việc dở KHÔNG auto-trượt (§SPEC 3.5).

**Acceptance:** đổi số ngày → giờ/ngày + ngày xong tính lại live (mode tuần tự); mode luồng → gán module×thứ, rule mô phỏng ra ngày xong; tạo plan = 1 snapshot bất biến (mở lại thấy đúng lịch cũ); done-state suy từ hành động thật; đổi thứ tự = "Xếp lại lịch" giữ tiến độ; tạo/xếp = 0 call Gemini.

---

## 7. Nhắc học — Push PWA `[BE]`

**Khả thi $0** (Web Push chuẩn + VAPID tự sinh, không Firebase/dịch vụ trả phí).

### 7.1. Kiến trúc

1. **Client:** xin quyền + `subscribe` → lưu `push_subscriptions` (mỗi thiết bị 1 dòng, `endpoint` unique).
2. **Service worker (sw.js sẵn có):** thêm listener `push` + `notificationclick` → click mở deep-link `/study/...` (URL scheme §SPEC 5.1 là tiền đề).
3. **Gửi:** Supabase **Edge Function + pg_cron** (free tier) chạy 15′/lần, so khớp `notification_settings.times[]` sau khi quy đổi từ `timezone` (mặc định Asia/Ho_Chi_Minh UTC+7; pg_cron chạy UTC nên quy đổi từ cột, **không hardcode**). Nội dung **100% rule từ plan** (giờ học hôm nay, X card đến hạn, buổi dở, streak sắp đứt) — **0 call Gemini**.

### 7.2. Ngữ nghĩa 2 mốc `[PM]`

- **Sáng (08:45):** tóm tắt việc hôm nay (buổi học + X card đến hạn).
- **Tối (21:15):** nhắc vào học / còn gì chưa xong của buổi hôm nay.
- User đổi/thêm giờ (tối đa 4).

### 7.3. Caveat `[PM]`

iOS chỉ nhận push khi PWA đã **Add to Home Screen + iOS ≥ 16.4**; Android/desktop đầy đủ. Phần mock được trước = màn cài đặt nhắc (bật/tắt, giờ, loại) để chốt UX.

| Scenario | Input | Output | Error |
|---|---|---|---|
| Subscribe | cho phép quyền | 1 dòng push_subscriptions | từ chối → hiện hướng dẫn, không lưu |
| Cron gửi | đến giờ + có buổi/card | push deep-link /study | không có gì nhắc → skip |
| Click push | notif | mở app đúng màn | — |
| iOS chưa A2HS | — | banner hướng dẫn cài PWA | — |

**Acceptance:** subscribe lưu đúng thiết bị; cron gửi đúng giờ theo timezone; nội dung từ rule (0 AI); click mở deep-link; iOS chưa cài PWA có hướng dẫn.

---

## 8. Non-goals v1 `[PRD]`

- AI Chat với tài liệu (RAG) — ngốn quota, để sau.
- Knowledge graph / backlinks.
- SM-2/FSRS đầy đủ (interval nhân đôi là đủ; `review_logs` ghi sẵn để nâng cấp).
- "Chế độ nghiêm" (khóa unit kế khi quiz <80%) — flag để sau.
- Xuất Anki, TTS, cộng tác nhiều user.

---

## 9. Tiêu chí thành công tổng `[PRD]`

- Vòng lặp trọn vẹn: đọc → quiz → Feynman → card sinh ra → hôm sau có card ôn → heatmap ghi nhận.
- 1 ngày học nặng ≤ ~10 call Gemini; hết quota → tính năng không-AI vẫn chạy.
- Unit "Vững" đòi đủ 4: đọc xong + quiz ≥80% + card + ≥1 Feynman.
- Solo duy trì thói quen: streak đúng, thực đơn ngày < 30 phút, PWA + laptop cùng 1 lịch.

---

## 10. Quyết định đã chốt (2026-07-16)

- [x] **Tên module:** "Học tập" — giữ (đã dùng xuyên suốt URL/sidebar).
- [x] **Ngưỡng Vững / phai:** quiz **≥ 80%** = đạt; unit 🟢 quá **21 ngày** không active-recall → 🔴 (nới từ 14 → 21 ngày, giảm áp lực ôn lại cho nhịp học thưa). → cập nhật §SPEC 3.3.
- [x] **Trạm tổng kết:** **Optional (khuyến nghị)** — hiện như gợi ý, KHÔNG chặn qua mục kế. Đúng triết lý "không khóa, không trừng phạt"; không thêm cột gating. "Chế độ nghiêm" (chặn) vẫn là flag để sau.
- [x] **Định mức rule:** giữ mặc định prototype (600 ký/phút, ACT_MIN, target 60′/ngày), gom vào 1 file hằng số, tinh chỉnh sau khi dùng thật.
- [x] **Pre-questions:** **dời sau** 4 tính năng lõi (schema đã chừa `section_questions kind='pre'`; thêm sau không rework). → §5 = Phase 2.
- [x] **Materialize `study_units`:** **Eager lúc tạo space** — parse toàn bộ heading thành units ngay (1 lần) khi tạo space. Truy vấn lộ trình nhanh & đơn giản; chấp nhận tạo space chậm hơn với handbook lớn. Cột `coarse` chỉ dùng cho module tài liệu lẻ chưa có heading rõ.

> Các ngưỡng vẫn có thể tinh chỉnh sau khi học thật vài tuần — nhưng đây là giá trị chốt để vào backend.

### 10b. Quyết định về chọn file & lập lịch (2026-07-16)

- [x] **Chọn file học:** lúc tạo Space (loại `00-*`/`_glossary`/mục-lục tự bỏ tick). Space = phạm vi ổn định; Plan lo thứ tự & lịch. → §0.1, §SPEC 2.1.
- [x] **Thứ tự module + đổi giữa chừng:** kéo-thả trong wizard Plan (`moduleOrder`); đổi giữa chừng = "Điều chỉnh" → "Xếp lại lịch" (plan mới, giữ tiến độ). → §6.3, §SPEC 3.5.
- [x] **Mô hình lịch:** giữ **CẢ HAI** — ① Tuần tự (mặc định) + ② Theo luồng (bảng gán module × thứ, học song song). → §6.1, §SPEC 2.10 & 3.4b.
- [x] **Chung thứ:** **cho phép** 1 thứ gán nhiều module, học **tuần tự theo `moduleOrder`** — module trước hết sạch unit mới sang module sau (KHÔNG chia đôi buổi). Buổi giao nhau (module trước hết giữa buổi) → phần giờ dư học tiếp module kế, không bỏ phí. → §SPEC 3.4b.
- [x] **Module xong sớm (mode luồng):** **hỏi khi xếp lịch** — không auto-chuyển module kế; ngày trống chỉ còn slot ôn, panel gợi ý "Xếp lại lịch".
