// Seed data cho UI prototype module Học tập — sẽ thay bằng Supabase sau khi chốt giao diện.
// Nội dung lấy theo handbook THẬT "Supply Chain 360 — The four lens handbook" của user;
// cây M2 (02-demand-planning.md) bung đúng heading thật đến cấp tiểu mục x.y.z (###).
// Đơn vị ôn tập = 1 tiểu mục x.y.z (vd 2.1.3) — cấp x.y (vd 2.1) quá dài cho 1 lần ôn.

export type UnitStatus = "new" | "reading" | "read" | "mastered" | "decayed";

export type StudyUnit = {
  id: string;
  title: string;
  status: UnitStatus;
  readPct: number;
  quizBest?: number; // điểm quiz cao nhất /100
  feynmanCount: number;
  children?: StudyUnit[]; // đệ quy: file → mục (x.y) → tiểu mục (x.y.z)
  docId?: string; // click tiểu mục → mở reader đúng tài liệu (bản thật sẽ kèm heading anchor)
  cardsMade?: boolean; // đã tạo bộ flashcard cho tiểu mục này chưa (mục checklist thứ 3)
  chars?: number; // độ dài extractedText — đầu vào rule ước tính thời gian (mặc định 43k/tiểu mục nếu thiếu)
};

export type TodayItem = {
  type: "read" | "review" | "quiz" | "fix";
  label: string;
  detail: string;
  quizSectionId?: string; // điều phối sang tab Kiểm tra thì highlight đúng section này
};

export type WeakSpot = { id: string; label: string; reason: string };

export type StudySpace = {
  id: string;
  name: string;
  emoji: string;
  sourceLabel: string;
  sourceType: "handbook" | "docs";
  streak: number;
  dueCards: number;
  unitsTotal: number;
  unitsMastered: number;
  minutesToday: number;
  todayMenu: TodayItem[];
  units: StudyUnit[];
  weakSpots: WeakSpot[];
};

export type CardType = "concept" | "apply" | "link";

export type Flashcard = {
  id: string;
  front: string;
  back: string;
  quote: string;
  type: CardType;
  intervalDays: number;
  unitLabel: string;
  due?: boolean; // đến hạn ôn hôm nay
};

export type QuizSection = {
  id: string;
  title: string;
  unitLabel: string;
  attempts: { date: string; score: number }[];
};

export type QuizQuestion =
  | {
      kind: "mcq";
      q: string;
      options: string[];
      correct: number;
      explainWrong: string[]; // giải thích cho từng option (option đúng để chuỗi rỗng)
      quote: string;
    }
  | {
      kind: "open";
      q: string;
      feedbackGood: string[];
      feedbackMissing: string[];
      quote: string;
    };

export type FeynmanSession = {
  id: string;
  date: string;
  scopeLabel: string;
  durationSec: number;
  excerpt: string;
  rubric: {
    correct: string[];
    missing: string[];
    wrong: string[];
    hasExample: boolean;
    hasEdgeCase: boolean;
    followUp: string;
  };
};

// ─── Heatmap (12 tuần × 7 ngày, 0..4) — pattern cố định để view ổn định ──────
export const HEATMAP: number[] = Array.from({ length: 84 }, (_, i) => {
  const wave = Math.round(2 + 2 * Math.sin(i / 3.1) * Math.cos(i / 8.7));
  const gap = i % 11 === 3 || i % 17 === 8; // vài ngày nghỉ
  return gap ? 0 : Math.max(0, Math.min(4, wave));
});

// ─── Cây M2 — đúng heading thật của 02-demand-planning.md ────────────────────
const M2_UNITS: StudyUnit = {
  id: "m2",
  title: "M2 · Demand Planning & Khoa học dữ liệu",
  status: "reading",
  readPct: 30,
  feynmanCount: 2,
  children: [
    {
      id: "m2-1",
      title: "2.1. Bản chất Dự báo & Quản trị Nhu cầu",
      status: "decayed",
      readPct: 100,
      feynmanCount: 1,
      children: [
        { id: "m2-1-1", title: "2.1.1. Dữ liệu đầu vào & làm sạch: Unconstrained Demand vs. Sales History", status: "mastered", readPct: 100, quizBest: 90, feynmanCount: 1, docId: "45319b19-46e8-4a58-adce-0bb34584a0e1", cardsMade: true },
        { id: "m2-1-2", title: "2.1.2. Phân rã Chuỗi thời gian: mô hình cộng & nhân", status: "read", readPct: 100, quizBest: 72, feynmanCount: 0, docId: "45319b19-46e8-4a58-adce-0bb34584a0e1", cardsMade: true },
        { id: "m2-1-3", title: "2.1.3. Phân loại khả năng dự báo: ADI–CV²", status: "decayed", readPct: 100, quizBest: 55, feynmanCount: 1, docId: "45319b19-46e8-4a58-adce-0bb34584a0e1", cardsMade: true },
      ],
    },
    {
      id: "m2-2",
      title: "2.2. Dự báo Thống kê Cổ điển",
      status: "reading",
      readPct: 30,
      feynmanCount: 1,
      children: [
        { id: "m2-2-1", title: "2.2.1. San bằng số mũ đơn (SES)", status: "mastered", readPct: 100, quizBest: 88, feynmanCount: 1, docId: "45319b19-46e8-4a58-adce-0bb34584a0e1", cardsMade: true },
        { id: "m2-2-2", title: "2.2.2. Holt (Double ES) & xu hướng giảm chấn (Damped Trend)", status: "reading", readPct: 40, feynmanCount: 0, docId: "45319b19-46e8-4a58-adce-0bb34584a0e1", cardsMade: true },
        { id: "m2-2-3", title: "2.2.3. Holt-Winters (Triple) & khung ETS state-space", status: "new", readPct: 0, feynmanCount: 0, docId: "45319b19-46e8-4a58-adce-0bb34584a0e1" },
        { id: "m2-2-4", title: "2.2.4. ARIMA / SARIMA / SARIMAX (Box–Jenkins)", status: "new", readPct: 0, feynmanCount: 0, docId: "45319b19-46e8-4a58-adce-0bb34584a0e1" },
        { id: "m2-2-5", title: "2.2.5. Nhu cầu gián đoạn: Croston, SBA & TSB", status: "new", readPct: 0, feynmanCount: 0, docId: "45319b19-46e8-4a58-adce-0bb34584a0e1" },
      ],
    },
    {
      id: "m2-3",
      title: "2.3. Dự báo Nhân quả & Học máy",
      status: "new",
      readPct: 0,
      feynmanCount: 0,
      children: [
        { id: "m2-3-1", title: "2.3.1. Dự báo nhân quả & khuyến mãi: baseline + uplift", status: "new", readPct: 0, feynmanCount: 0, docId: "45319b19-46e8-4a58-adce-0bb34584a0e1" },
        { id: "m2-3-2", title: "2.3.2. Kỹ nghệ Đặc trưng (Feature Engineering)", status: "new", readPct: 0, feynmanCount: 0, docId: "45319b19-46e8-4a58-adce-0bb34584a0e1" },
        { id: "m2-3-3", title: "2.3.3. Mô hình ML & Deep TS", status: "new", readPct: 0, feynmanCount: 0, docId: "45319b19-46e8-4a58-adce-0bb34584a0e1" },
        { id: "m2-3-4", title: "2.3.4. Dự báo sản phẩm mới (NPI)", status: "new", readPct: 0, feynmanCount: 0, docId: "45319b19-46e8-4a58-adce-0bb34584a0e1" },
      ],
    },
    {
      id: "m2-4",
      title: "2.4. Đánh giá, Kết hợp & Kiểm soát Dự báo",
      status: "new",
      readPct: 0,
      feynmanCount: 0,
      children: [
        { id: "m2-4-1", title: "2.4.1. Chỉ số sai số & benchmark naive", status: "new", readPct: 0, feynmanCount: 0, docId: "45319b19-46e8-4a58-adce-0bb34584a0e1" },
        { id: "m2-4-2", title: "2.4.2. Backtesting & Rolling-origin Cross-Validation", status: "new", readPct: 0, feynmanCount: 0, docId: "45319b19-46e8-4a58-adce-0bb34584a0e1" },
        { id: "m2-4-3", title: "2.4.3. Kết hợp dự báo & Ensemble (Bates–Granger)", status: "new", readPct: 0, feynmanCount: 0, docId: "45319b19-46e8-4a58-adce-0bb34584a0e1" },
        { id: "m2-4-4", title: "2.4.4. Kiểm soát Độ lệch & Tracking Signal", status: "new", readPct: 0, feynmanCount: 0, docId: "45319b19-46e8-4a58-adce-0bb34584a0e1" },
        { id: "m2-4-5", title: "2.4.5. Quản trị phân cấp dự báo & Reconciliation", status: "new", readPct: 0, feynmanCount: 0, docId: "45319b19-46e8-4a58-adce-0bb34584a0e1" },
        { id: "m2-4-6", title: "2.4.6. Dự báo xác suất & Quantile", status: "new", readPct: 0, feynmanCount: 0, docId: "45319b19-46e8-4a58-adce-0bb34584a0e1" },
      ],
    },
    {
      id: "m2-5",
      title: "2.5. Demand Planning là Quy trình: Con người & Trách nhiệm giải trình",
      status: "new",
      readPct: 0,
      feynmanCount: 0,
      children: [
        { id: "m2-5-1", title: "2.5.1. Dự báo phán đoán & Forecast Value Added (FVA)", status: "new", readPct: 0, feynmanCount: 0, docId: "45319b19-46e8-4a58-adce-0bb34584a0e1" },
        { id: "m2-5-2", title: "2.5.2. Consensus / One-number forecast & Demand Review", status: "new", readPct: 0, feynmanCount: 0, docId: "45319b19-46e8-4a58-adce-0bb34584a0e1" },
      ],
    },
    {
      id: "m2-6",
      title: "2.6. Phân khúc khách hàng bằng Data",
      status: "new",
      readPct: 0,
      feynmanCount: 0,
      children: [
        { id: "m2-6-1", title: "2.6.1. RFM Analysis & Cohort Analysis", status: "new", readPct: 0, feynmanCount: 0, docId: "45319b19-46e8-4a58-adce-0bb34584a0e1" },
        { id: "m2-6-2", title: "2.6.2. Phân cụm: k-means / DBSCAN / Gaussian Mixture", status: "new", readPct: 0, feynmanCount: 0, docId: "45319b19-46e8-4a58-adce-0bb34584a0e1" },
      ],
    },
    {
      id: "m2-7",
      title: "2.7. Cộng tác dự báo: CPFR & VMI",
      status: "new",
      readPct: 0,
      feynmanCount: 0,
      children: [
        { id: "m2-7-1", title: "2.7.1. Chia sẻ tín hiệu cầu qua biên doanh nghiệp: từ VMI tới CPFR", status: "new", readPct: 0, feynmanCount: 0, docId: "45319b19-46e8-4a58-adce-0bb34584a0e1" },
      ],
    },
  ],
};

// ─── Spaces ──────────────────────────────────────────────────────────────────
export const SPACES: StudySpace[] = [
  {
    id: "sp-sc360",
    name: "Supply Chain 360",
    emoji: "🚚",
    sourceLabel: "Handbook · Supply Chain 360 — The four lens handbook (7 module)",
    sourceType: "handbook",
    streak: 6,
    dueCards: 8,
    unitsTotal: 29, // 23 tiểu mục M2 + 6 module còn lại
    unitsMastered: 3,
    minutesToday: 25,
    todayMenu: [
      { type: "read", label: "Đọc tiếp: 2.2.2 Holt & Damped Trend", detail: "M2 · đang ở 40% — còn tầng Python & giới hạn" },
      { type: "review", label: "Ôn 8 flashcard đến hạn", detail: "Trộn 2.1.x + 2.2.1 · ~5 phút" },
      { type: "fix", label: "Làm lại quiz: 2.1.3 ADI–CV²", detail: "Điểm gần nhất 55% · unit đang 🔴", quizSectionId: "q-2-1-3" },
    ],
    units: [
      { id: "m1", title: "M1 · Chiến lược & Rủi ro chuỗi cung ứng", status: "mastered", readPct: 100, quizBest: 82, feynmanCount: 2 },
      M2_UNITS,
      { id: "m3", title: "M3 · Supply Planning & MPC", status: "new", readPct: 0, feynmanCount: 0, chars: 850000 },
      { id: "m4", title: "M4 · Inventory Management", status: "new", readPct: 0, feynmanCount: 0, chars: 780000 },
      { id: "m6", title: "M6 · Warehouse Management", status: "new", readPct: 0, feynmanCount: 0, chars: 620000 },
      { id: "m7", title: "M7 · Transportation", status: "new", readPct: 0, feynmanCount: 0, chars: 590000 },
      { id: "m8", title: "M8 · Supply Chain Finance", status: "new", readPct: 0, feynmanCount: 0, chars: 540000 },
    ],
    weakSpots: [
      { id: "w1", label: "2.1.3 Phân loại khả năng dự báo: ADI–CV²", reason: "Quiz 55% · 3 card bị Quên ≥ 3 lần · 12 ngày chưa ôn" },
      { id: "w2", label: "2.1.2 Phân rã Chuỗi thời gian", reason: "Quiz 72% · chưa có phiên Feynman nào" },
    ],
  },
  {
    id: "sp-sql",
    name: "SQL & Dữ liệu",
    emoji: "🗄️",
    sourceLabel: "2 tài liệu lẻ · SQL Cheatsheet, Data Modeling Notes",
    sourceType: "docs",
    streak: 2,
    dueCards: 3,
    unitsTotal: 2,
    unitsMastered: 0,
    minutesToday: 0,
    todayMenu: [
      { type: "review", label: "Ôn 3 flashcard đến hạn", detail: "SQL Cheatsheet · ~2 phút" },
      { type: "read", label: "Đọc tiếp: Data Modeling Notes", detail: "Đang ở 30%" },
    ],
    units: [
      { id: "d1", title: "SQL Cheatsheet", status: "read", readPct: 100, quizBest: 75, feynmanCount: 1, chars: 18000 },
      { id: "d2", title: "Data Modeling Notes", status: "reading", readPct: 30, feynmanCount: 0, chars: 22000 },
    ],
    weakSpots: [],
  },
];

// ─── Thư viện flashcard (từ nội dung thật M2) ────────────────────────────────
// Quy tắc thiết kế: AI sinh 8-12 card/tiểu mục, phủ đủ 4 tầng (trực giác → công thức
// → Python/giải số → giới hạn/nhân quả) × 3 loại (khái niệm/vận dụng/liên kết).
// Seed: 2.1.3 là bộ ĐẦY ĐỦ (10 card) làm mẫu chuẩn; các tiểu mục khác seed mỏng hơn.
export const ALL_CARDS: Flashcard[] = [
  {
    id: "c1", due: true,
    type: "concept",
    front: "Vì sao nói dữ liệu bán hàng thô \"nói dối một chiều\"? Unconstrained Demand khác Sales History ở đâu?",
    back: "Sales History chỉ ghi được cái ĐÃ BÁN — khi hết hàng, cầu thật vẫn tồn tại nhưng không để lại vết. Doanh số chỉ lệch XUỐNG so với cầu thật, không bao giờ lệch lên. Unconstrained Demand là cầu đã khôi phục phần bị che đó — đầu vào bắt buộc trước mọi mô hình.",
    quote: "“Doanh số thô luôn phản bội người tin nó — cầu bị kiểm duyệt khi hết hàng, và kiểm duyệt chỉ theo một chiều.” — §2.1.1.1",
    intervalDays: 1,
    unitLabel: "2.1.1 Unconstrained Demand",
  },
  {
    id: "c2", due: true,
    type: "concept",
    front: "ADI và CV² đo hai thứ gì? Vì sao CV² chỉ tính trên các kỳ có cầu khác 0?",
    back: "ADI = tổng số kỳ ÷ số kỳ có cầu > 0 → đo độ THƯA. CV² = (σz/z̄)² trên cỡ cầu khác 0 → đo độ LOẠN CỠ. Nếu nhét cả kỳ 0 vào CV², chuỗi thưa-nhưng-đều sẽ bị chấm oan là biến động cao — tách ra thì hai trục trực giao, mỗi trục lo một việc.",
    quote: "“ADI lo phần thưa, CV² lo phần loạn cỡ, hai trục trực giao.” — §2.1.3.2",
    intervalDays: 1,
    unitLabel: "2.1.3 ADI–CV²",
  },
  {
    id: "c3", due: true,
    type: "apply",
    front: "SKU bánh trung thu: 10 tháng bằng 0, ADI rất cao → hệ thống tự xếp vào ô \"gián đoạn\" và định tuyến sang Croston. Bạn duyệt hay bác?",
    back: "Bác. Mười tháng bằng 0 của hàng mùa vụ ngắn là mùa vụ ĐÃ BIẾT TRƯỚC, không phải cầu gián đoạn ngẫu nhiên — phải xử bằng lịch mùa vụ. Khung ADI–CV² là dụng cụ chẩn đoán, không phải quan tòa; planner phải đọc VÌ SAO mã rơi vào ô đó.",
    quote: "“Quà Tết, bánh trung thu nhìn qua ADI thì giống cầu gián đoạn, nhưng bản chất là mùa vụ đã biết trước.” — §2.1.3.2",
    intervalDays: 2,
    unitLabel: "2.1.3 ADI–CV²",
  },
  {
    id: "c4", due: true,
    type: "link",
    front: "\"Số 0 bẩn\" ở §2.1.1 phá phân loại ADI–CV² ở §2.1.3 như thế nào?",
    back: "Kỳ bằng 0 có thể là \"không ai mua\" (cầu thật) hoặc \"hết hàng nên không bán được\" (cầu bị che). Nếu chưa khôi phục cầu, ADI bị thổi phồng giả tạo → mã lẽ ra \"mượt\" bị gắn nhầm nhãn \"gián đoạn\" và định tuyến sai mô hình. Phân loại phải chạy SAU bước unconstrain.",
    quote: "“Phân loại phải chạy sau khi đã khôi phục cầu ở §2.1.1, không phải trên doanh số thô.” — §2.1.3.2",
    intervalDays: 1,
    unitLabel: "2.1.1 ↔ 2.1.3",
  },
  {
    id: "c5", due: true,
    type: "concept",
    front: "SES là \"một dòng học từ sai số\" — viết dạng đó và giải thích α điều khiển trade-off gì?",
    back: "F(t+1) = F(t) + α·e(t): dự báo mới = dự báo cũ + α lần sai số vừa mắc. α cao → đáp ứng nhanh nhưng đuổi theo nhiễu; α thấp → ổn định nhưng phản ứng chậm khi mức cầu thật sự đổi. Trọng số quá khứ phai theo cấp số nhân (trí nhớ phai dần).",
    quote: "“Trí nhớ phai dần: một dòng học-từ-sai-số và vòng lặp đáp ứng–ổn định.” — §2.2.1.1",
    intervalDays: 8,
    unitLabel: "2.2.1 SES",
  },
  {
    id: "c6", due: true,
    type: "apply",
    front: "Chạy SES lên chuỗi phụ tùng đầy số 0 — dự báo sai kiểu gì và vì sao Croston phải \"tách đôi\" bài toán?",
    back: "SES nhảy vọt ngay sau kỳ có cầu rồi phân rã dần qua các kỳ 0 → ước lượng CAO NHẤT rơi đúng lúc ít khả năng cầu lặp lại nhất (nghịch pha). Croston (1972) tách 2 dòng: cỡ cầu (size) và khoảng cách (interval), san bằng độc lập rồi chia.",
    quote: "“Ước lượng cao nhất lại rơi đúng vào lúc vừa xảy ra cầu — là lúc ít có khả năng cầu lặp lại nhất.” — §2.1.3.1",
    intervalDays: 2,
    unitLabel: "2.2.1 SES ↔ 2.2.5 Croston",
  },
  {
    id: "c7", due: true,
    type: "link",
    front: "Chọn phân rã cộng hay nhân (2.1.2) quyết định gì khi lên Holt-Winters (2.2.3)?",
    back: "Cùng một câu hỏi ở hai chỗ: biên độ mùa vụ có PHÌNH theo mức cầu không? Phình theo → mô hình nhân (hệ số mùa ×), ổn định tuyệt đối → cộng (+). Chọn sai ở 2.1.2 thì Holt-Winters kế thừa nguyên lỗi: mùa vụ bị nén hoặc thổi phồng ở đuôi dự báo.",
    quote: "“Mọi chuỗi cầu là một bản hợp âm: bốn thành phần & hai cách chồng.” — §2.1.2.1",
    intervalDays: 4,
    unitLabel: "2.1.2 ↔ 2.2.3",
  },
  {
    id: "c8", due: true,
    type: "apply",
    front: "Cầu 8 quý tăng nhưng ĐANG CHẬM LẠI (+20,+18,+15,+12,+8,+5,+3). Holt tuyến tính hay Damped Trend? Hệ quả nếu chọn sai?",
    back: "Damped Trend (thêm φ<1 giảm chấn độ dốc). Holt tuyến tính sẽ \"bay thẳng\" — ngoại suy độ dốc cũ mãi mãi → dự báo dài hạn phóng đại, kéo theo mua hàng/tồn kho thừa. Damped cho xu hướng \"hạ cánh\" tiệm cận.",
    quote: "“Học cả mức lẫn độ dốc, rồi quyết định bay thẳng hay hạ cánh.” — §2.2.2.1",
    intervalDays: 2,
    unitLabel: "2.2.2 Holt & Damped",
  },

  // ── Bộ đầy đủ của 2.1.3 (8 card thêm vào 2 card due ở trên = 10) ──
  {
    id: "c9",
    type: "concept",
    front: "Gọi tên 4 ô của khung SBC (ADI–CV²) và đặc điểm cầu của từng ô.",
    back: "Smooth: dày & đều (ADI thấp, CV² thấp). Erratic: dày nhưng cỡ loạn (ADI thấp, CV² cao). Intermittent: thưa nhưng cỡ đều (ADI cao, CV² thấp). Lumpy: vừa thưa vừa loạn (cả hai cao) — khó dự báo nhất.",
    quote: "“Hai trục, bốn ô: định nghĩa ADI–CV², xuất xứ ngưỡng & định tuyến mô hình.” — §2.1.3.2",
    intervalDays: 5,
    unitLabel: "2.1.3 ADI–CV²",
  },
  {
    id: "c10",
    type: "concept",
    front: "Ngưỡng phân loại ADI ≈ 1.32 và CV² ≈ 0.49 từ đâu ra — vì sao không phải số chọn đại?",
    back: "Suy từ so sánh sai số bình phương trung bình (MSE) giữa các bộ ước lượng (Croston vs SBA…): tìm điểm mà bộ này bắt đầu thắng bộ kia. Vì MSE nói chuyện với phương sai (bậc hai) nên trục phải là CV² chứ không phải CV — ngưỡng mới rơi vào hằng số sạch.",
    quote: "“Ngưỡng phân loại được suy ra từ so sánh MSE giữa các bộ ước lượng… dùng CV² cho ngưỡng rơi vào một hằng số sạch.” — §2.1.3.2",
    intervalDays: 6,
    unitLabel: "2.1.3 ADI–CV²",
  },
  {
    id: "c11",
    type: "apply",
    front: "SKU nước ngọt: kỳ nào cũng bán (ADI ≈ 1) nhưng cỡ bán loạn dữ dội theo khuyến mãi (CV² cao). Ô nào, và định tuyến mô hình ra sao?",
    back: "Erratic. KHÔNG cần Croston (cầu không thưa) — dùng họ san bằng số mũ/ETS nhưng phải chấp nhận khoảng dự báo rộng; và vì cỡ loạn do khuyến mãi (nguyên nhân biết được) nên hướng đúng là tách baseline + uplift ở §2.3.1 thay vì để mô hình mù đoán.",
    quote: "“Định tuyến: mã nào dùng san bằng số mũ, mã nào Croston/SBA, mã nào bootstrap.” — §2.1.3.2",
    intervalDays: 4,
    unitLabel: "2.1.3 ADI–CV²",
  },
  {
    id: "c12",
    type: "concept",
    front: "Cơ chế 'hai chiếc đồng hồ' của Croston: tách bài toán thành 2 dòng nào, và vì sao chỉ cập nhật khi có cầu?",
    back: "Dòng 1: cỡ cầu khi có cầu (size). Dòng 2: khoảng cách giữa hai lần cầu (interval). Mỗi dòng san bằng số mũ độc lập, dự báo = size ÷ interval. Chỉ cập nhật khi có cầu để các kỳ 0 không kéo ước lượng phân rã về 0 — chính khuyết tật khiến SES nghịch pha.",
    quote: "“Đừng san bằng chuỗi thô, hãy tách riêng cỡ cầu và khoảng cách rồi san bằng độc lập.” — §2.1.3.1",
    intervalDays: 5,
    unitLabel: "2.1.3 ADI–CV²",
  },
  {
    id: "c13",
    type: "concept",
    front: "Croston vẫn CHỆCH — SBA sửa bằng gì và hệ số đó là bao nhiêu?",
    back: "Croston ước lượng E[size]/E[interval] nhưng kỳ vọng của thương ≠ thương của kỳ vọng → chệch lên hệ thống. SBA (Syntetos–Boylan Approximation) nhân thêm hệ số chỉnh (1 − α/2) vào dự báo Croston — gần như khử hết thiên lệch.",
    quote: "“SBA — Croston nhân hệ số chỉnh thiên lệch (1 − α/2).” — §2.1.3 bảng thuật ngữ",
    intervalDays: 6,
    unitLabel: "2.1.3 ADI–CV²",
  },
  {
    id: "c14",
    type: "apply",
    front: "Phụ tùng cho dòng máy sắp ngừng sản xuất — cầu đang tắt dần. Croston/SBA hay TSB? Vì sao?",
    back: "TSB. Croston/SBA chỉ cập nhật khi CÓ cầu — hàng đang chết thì mãi không có cầu mới, ước lượng cũ treo lơ lửng không hạ. TSB cập nhật XÁC SUẤT có cầu mỗi kỳ (kể cả kỳ 0) nên bắt được obsolescence, kéo dự báo về 0 dần.",
    quote: "“Croston, SBA & TSB — khác nhau ở chỗ khi nào đồng hồ cập nhật… TSB bắt obsolescence.” — §2.2.5.2/§2.1.3.3",
    intervalDays: 4,
    unitLabel: "2.1.3 ADI–CV²",
  },
  {
    id: "c15",
    type: "link",
    front: "Vì sao cầu gián đoạn (2.1.3) làm MAPE (2.4.1) sập tiệm — và thay bằng thước nào?",
    back: "MAPE chia cho giá trị thực: kỳ có cầu = 0 thì chia cho 0 — vô nghĩa trên chuỗi gián đoạn (quá nửa số kỳ). Phải dùng thước chuẩn hóa theo benchmark như MASE (so với naive) — đúng lý do 2.4.1 dạy 'thước đo không trung lập, phải chọn theo dạng cầu'.",
    quote: "“Nếu quá nửa danh mục không phải dạng mượt… phần còn lại cần một họ công cụ khác hẳn.” — §2.1.3.1",
    intervalDays: 9,
    unitLabel: "2.1.3 ↔ 2.4.1",
  },
  {
    id: "c16",
    type: "apply",
    front: "Cùng 1 SKU: gộp theo tuần bị xếp 'Intermittent', gộp theo tháng lại thành 'Smooth'. Nhãn nào đúng — và bài học là gì?",
    back: "Cả hai đều 'đúng' — nhãn phân loại là thuộc tính của cặp (mã hàng × kỳ gộp), không phải của riêng mã hàng. Planner chọn kỳ gộp tức là đang CHỌN nhãn. Có thể lợi dụng điều này: gộp thời gian lên (ADIDA) để chuỗi thưa thành dày rồi dự báo — nhưng phải rã ngược khi dùng.",
    quote: "“Nhãn phân loại có thật là thuộc tính của mã hàng không — hay chính planner tạo ra nó qua lựa chọn kỳ gộp.” — §2.1.3.4",
    intervalDays: 7,
    unitLabel: "2.1.3 ADI–CV²",
  },
];

// Card đến hạn ôn hôm nay (queue giãn cách) — subset của thư viện
export const DUE_CARDS: Flashcard[] = ALL_CARDS.filter((c) => c.due);

// ─── Quiz — section = tiểu mục x.y.z ─────────────────────────────────────────
export const QUIZ_SECTIONS: QuizSection[] = [
  {
    id: "q-2-1-3",
    title: "2.1.3. Phân loại khả năng dự báo: ADI–CV²",
    unitLabel: "M2 · mục 2.1",
    attempts: [
      { date: "02/07", score: 40 },
      { date: "05/07", score: 55 },
    ],
  },
  {
    id: "q-2-2-1",
    title: "2.2.1. San bằng số mũ đơn (SES)",
    unitLabel: "M2 · mục 2.2",
    attempts: [
      { date: "08/07", score: 70 },
      { date: "10/07", score: 88 },
    ],
  },
  {
    id: "q-2-2-2",
    title: "2.2.2. Holt & Damped Trend",
    unitLabel: "M2 · mục 2.2 · đang đọc 40%",
    attempts: [],
  },
  {
    id: "q-2-1-2",
    title: "2.1.2. Phân rã Chuỗi thời gian",
    unitLabel: "M2 · mục 2.1",
    attempts: [{ date: "11/07", score: 72 }],
  },
];

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    kind: "mcq",
    q: "Danh mục MRO của bạn có SKU vòng bi: 24 tháng dữ liệu, chỉ 6 tháng có cầu, cỡ cầu mỗi lần khá đều (4-6 cái). Theo khung ADI–CV², mã này thuộc ô nào và định tuyến mô hình gì?",
    options: [
      "Smooth — dùng SES/ETS như hàng bán chạy",
      "Intermittent (ADI cao, CV² thấp) — định tuyến Croston/SBA, không dùng SES trực tiếp",
      "Erratic — cần bootstrap phân phối",
      "Lumpy — bó tay, chỉ dự trữ theo cảm tính",
    ],
    correct: 1,
    explainWrong: [
      "ADI = 24/6 = 4 → rất thưa, không phải smooth; SES trên chuỗi đầy số 0 cho ước lượng nghịch pha.",
      "",
      "Erratic là ADI thấp + CV² cao — mã này ngược lại: thưa nhưng cỡ đều.",
      "Lumpy đòi cả hai trục cùng cao; và kể cả lumpy cũng có công cụ (bootstrap), không phải bó tay.",
    ],
    quote: "“ADI = tổng số kỳ ÷ số kỳ có cầu > 0… hai trục, bốn ô: định tuyến mã nào dùng san bằng số mũ, mã nào Croston/SBA.” — §2.1.3.2",
  },
  {
    kind: "mcq",
    q: "Chuỗi doanh số một SKU nước giải khát có nhiều kỳ bằng 0 rơi đúng các tuần khuyến mãi của đối thủ + kho báo hết hàng 3 đợt. Chạy phân loại ADI–CV² NGAY trên chuỗi này sẽ sai kiểu gì?",
    options: [
      "Không sai — ADI–CV² miễn nhiễm với nguồn gốc số 0",
      "CV² bị âm do nhiều số 0",
      "ADI bị thổi phồng giả tạo bởi \"số 0 bẩn\" (hết hàng ≠ không ai mua) → mã mượt bị gắn nhầm nhãn gián đoạn, định tuyến sai mô hình",
      "Chỉ sai nếu dữ liệu theo ngày, theo tuần thì không sao",
    ],
    correct: 2,
    explainWrong: [
      "Khung này đọc số 0 một cách mù quáng — nó không biết số 0 nào là cầu thật, số 0 nào là cầu bị che.",
      "CV² là bình phương nên không bao giờ âm — và nó còn không tính các kỳ bằng 0.",
      "",
      "Kỳ gộp tuần hay ngày chỉ đổi mức độ — bản chất \"số 0 bẩn\" vẫn nguyên: phải khôi phục cầu (§2.1.1) trước khi phân loại.",
    ],
    quote: "“Số 0 trong dữ liệu Việt Nam thường là số 0 bẩn… nếu để cầu bị che lọt vào, ADI bị thổi phồng giả tạo.” — §2.1.3.2",
  },
  {
    kind: "mcq",
    q: "Planner đề xuất: \"CV² của mã này cao quá, chắc do lắm kỳ bằng 0 — cứ tính CV² trên toàn chuỗi kể cả số 0 cho 'trung thực'.\" Vì sao handbook thiết kế NGƯỢC lại (chỉ tính trên kỳ khác 0)?",
    options: [
      "Để công thức nhẹ hơn cho Excel",
      "Vì số 0 không phải dữ liệu",
      "Vì nếu trộn số 0 vào, CV² sẽ trộn lẫn \"thưa\" và \"loạn\" — chuỗi thưa nhưng cỡ đều bị chấm oan là biến động cao; tách ra thì ADI–CV² thành hai trục trực giao",
      "Vì CV² trên toàn chuỗi luôn nhỏ hơn 0.49 nên mất khả năng phân loại",
    ],
    correct: 2,
    explainWrong: [
      "Khối lượng tính toán gần như nhau — lý do nằm ở ý nghĩa thống kê, không phải hiệu năng.",
      "Số 0 vẫn là dữ liệu — nhưng nó thuộc về trục THƯA (ADI), không thuộc trục LOẠN CỠ (CV²).",
      "",
      "Không có hằng số nào như vậy — ngưỡng 0.49 là của CV² tính đúng cách, suy từ so sánh MSE.",
    ],
    quote: "“Vì sao chỉ tính trên kỳ khác 0? Vì nếu nhét cả các kỳ bằng 0 vào, CV² sẽ trộn lẫn thưa và loạn.” — §2.1.3.2",
  },
  {
    kind: "open",
    q: "Giải thích ngắn (2-3 câu): vì sao SES trên cầu gián đoạn cho dự báo \"nghịch pha\", và Croston chữa bằng cách nào? Nêu 1 ví dụ mặt hàng thực tế của riêng bạn thuộc dạng này.",
    feedbackGood: [
      "Nêu đúng cơ chế: SES nhảy vọt sau kỳ có cầu rồi phân rã qua các kỳ 0 → đỉnh dự báo rơi đúng lúc ít khả năng cầu lặp lại nhất",
      "Nêu đúng lời chữa: tách cỡ cầu và khoảng cách, san bằng độc lập",
    ],
    feedbackMissing: [
      "Chưa nhắc Croston vẫn chệch — cần hệ số chỉnh SBA (1 − α/2), đúng lý do 2.1.3.3 tồn tại",
    ],
    quote: "“Đừng san bằng chuỗi thô, hãy tách riêng cỡ cầu và khoảng cách rồi san bằng độc lập.” — §2.1.3.1",
  },
  {
    kind: "open",
    q: "Sếp muốn \"một mô hình ETS duy nhất cho cả 5.000 SKU cho đồng bộ\". Dựa trên 2.1.3, phản biện đề xuất này và mô tả cách làm đúng.",
    feedbackGood: [
      "Chỉ ra thực nghiệm: với phụ tùng/MRO, 60–80% mã có cầu gián đoạn hoặc vón cục — ETS chỉ phục vụ thiểu số mã mượt",
      "Đề xuất quy trình phân loại → định tuyến: chạy ADI–CV² (sau khi unconstrain) rồi gán họ mô hình theo ô",
    ],
    feedbackMissing: [
      "Chưa nhắc cảnh báo cuối tiểu mục: nhãn phân loại không phải thuộc tính cố định của mã hàng — nó đổi theo kỳ gộp planner chọn",
    ],
    quote: "“Nếu quá nửa danh mục không phải dạng mượt, mọi công phu bỏ vào ETS/ARIMA chỉ phục vụ thiểu số mã hàng.” — §2.1.3.1",
  },
];

// ─── Tra cứu cây lộ trình cho 3 tab lịch sử ──────────────────────────────────
// "2.1.1" → tiêu đề tiểu mục; "M2" → tiêu đề module. Dựng từ chính cây units.
export const UNIT_TITLES: Record<string, string> = {};
function indexUnitTitles(u: StudyUnit) {
  if (/^m\d+(-\d+)*$/.test(u.id)) {
    const key = u.id.includes("-") ? u.id.slice(1).split("-").join(".") : u.id.toUpperCase();
    UNIT_TITLES[key] = u.title;
  }
  u.children?.forEach(indexUnitTitles);
}
SPACES.forEach((sp) => sp.units.forEach(indexUnitTitles));

// Danh sách tiểu mục lá (x.y.z) — nguồn cho scope picker Feynman/quiz
export type LeafUnit = { key: string; title: string; readPct: number; status: UnitStatus };
export const LEAF_UNITS: LeafUnit[] = [];
function collectLeaves(u: StudyUnit) {
  if (u.children) { u.children.forEach(collectLeaves); return; }
  if (/^m\d+(-\d+)+$/.test(u.id)) {
    LEAF_UNITS.push({ key: u.id.slice(1).split("-").join("."), title: u.title, readPct: u.readPct, status: u.status });
  } else if (/^m\d+$/.test(u.id)) {
    // Module dạng 1 file (M1, M3…) — cũng chọn được khi giảng liên kết cross-module
    LEAF_UNITS.push({ key: u.id.toUpperCase(), title: u.title, readPct: u.readPct, status: u.status });
  }
}
SPACES[0].units.forEach(collectLeaves);

// Lấy số tiểu mục đầu tiên trong 1 nhãn ("2.1.1 ↔ 2.1.3" → "2.1.1")
export function firstUnitKey(label: string): string {
  return (label.match(/\d+\.\d+\.\d+/) ?? [label])[0];
}

// "2.1.1" → "M2"
export function moduleKeyOf(unitKey: string): string {
  return "M" + unitKey.split(".")[0];
}

// ─── Bài làm cũ (xem lại attempt) ────────────────────────────────────────────
// Demo: lần làm 05/07 của quiz 2.1.3 (55%) — đúng câu 1, sai câu 2 & 3, tự luận thiếu ý.
export type AttemptAnswer = { mcqPick?: number; openText?: string };

export type AttemptDetail = {
  sectionId: string;
  date: string;
  score: number;
  answers: AttemptAnswer[]; // theo thứ tự QUIZ_QUESTIONS
};

export const ATTEMPT_DETAILS: AttemptDetail[] = [
  {
    sectionId: "q-2-1-3",
    date: "05/07",
    score: 55,
    answers: [
      { mcqPick: 1 }, // đúng
      { mcqPick: 0 }, // sai — tưởng ADI–CV² miễn nhiễm với nguồn gốc số 0
      { mcqPick: 3 }, // sai — bịa ra hằng số 0.49
      { openText: "Vì SES cứ thấy số 0 là kéo dự báo xuống, nên với hàng ít bán nó dự báo thấp. Croston thì xử lý riêng mấy kỳ bằng 0 nên chính xác hơn." },
      { openText: "Không nên dùng một mô hình vì mỗi SKU khác nhau. Nên phân loại SKU trước rồi chọn mô hình theo nhóm." },
    ],
  },
];

// ─── Feynman sessions ────────────────────────────────────────────────────────
// Phiên có "↔" trong scopeLabel = phiên LIÊN KẾT (nhiều tiểu mục / cross-module, giảng từ tab Feynman)
export const FEYNMAN_SESSIONS: FeynmanSession[] = [
  {
    id: "f3",
    date: "05/07/2026 · 22:02",
    scopeLabel: "M1 Bullwhip ↔ 2.1.1 Unconstrained Demand (liên kết)",
    durationSec: 175,
    excerpt:
      "…hiệu ứng bullwhip làm đơn hàng méo dần khi đi ngược chuỗi, mà cái sales history mình dùng để dự báo lại chính là đơn hàng đã méo đó chứ đâu phải cầu thật của người tiêu dùng…",
    rubric: {
      correct: [
        "Nối đúng hai module: sell-in (đơn đại lý) là tín hiệu đã bị bullwhip khuếch đại, khác sell-out (cầu người dùng cuối) — đúng tinh thần unconstrained demand",
        "Chỉ ra dự báo trên sell-in sẽ học cả phần méo chứ không chỉ phần cầu",
      ],
      missing: [
        "Chưa nhắc hướng xử lý M2 gợi ý: ưu tiên dữ liệu POS/sell-out, hoặc chia sẻ tín hiệu cầu qua CPFR/VMI (§2.7)",
      ],
      wrong: [],
      hasExample: true,
      hasEdgeCase: false,
      followUp: "Nếu chỉ có dữ liệu sell-in, safety stock ở module tồn kho (M4) sẽ bị thổi phồng theo cách nào? Thử nối tiếp sang M4.",
    },
  },
  {
    id: "f1",
    date: "12/07/2026 · 21:15",
    scopeLabel: "2.2.1 SES (từ checkpoint 11/07)",
    durationSec: 142,
    excerpt:
      "…SES nó giống kiểu mình dự báo hôm nay bằng dự báo hôm qua cộng thêm một phần cái sai số mình vừa mắc, cái alpha là mình tin cái mới tới đâu, alpha to thì bám sát thị trường hơn…",
    rubric: {
      correct: [
        "Nắm đúng dạng học-từ-sai-số: F(t+1) = F(t) + α·e(t), và vai trò α là \"độ tin cái mới\"",
        "Giải thích đúng trade-off: α cao đáp ứng nhanh, α thấp ổn định",
      ],
      missing: [
        "Chưa nhắc trọng số quá khứ phai theo cấp số nhân (dạng trung bình có trọng số hình học) — nửa còn lại của §2.2.1.2",
        "Bỏ sót cách chọn α bằng tối thiểu hóa SSE trên dữ liệu lịch sử",
      ],
      wrong: [
        "Nói \"alpha to thì bám sát thị trường hơn nên tốt hơn\" — α cao cũng đuổi theo nhiễu; bám sát nhiễu không phải bám sát thị trường",
      ],
      hasExample: true,
      hasEdgeCase: false,
      followUp: "Nếu chuỗi có XU HƯỚNG tăng đều thì SES sẽ trễ hệ thống như thế nào — và đó là lý do tồn tại của mô hình nào ở 2.2.2?",
    },
  },
  {
    id: "f2",
    date: "09/07/2026 · 20:40",
    scopeLabel: "2.1.3 ADI–CV² (từ checkpoint 08/07)",
    durationSec: 98,
    excerpt:
      "…nó có hai trục, một trục đo bao lâu mới bán được một lần là ADI, trục kia đo mỗi lần bán thì cỡ nó loạn tới đâu là CV bình phương, chia ra bốn ô để biết mã nào dùng mô hình nào…",
    rubric: {
      correct: [
        "Hệ thống hóa đúng hai trục thưa/loạn cỡ và tư duy phân loại → định tuyến mô hình",
        "Nhớ đúng rằng CV² chỉ tính trên kỳ có cầu khác 0",
      ],
      missing: [
        "Chưa nhắc xuất xứ hai ngưỡng (ADI 1.32, CV² 0.49) — suy từ so sánh MSE giữa các bộ ước lượng, không phải số chọn tùy ý",
      ],
      wrong: [],
      hasExample: true,
      hasEdgeCase: true,
      followUp: "Cùng một SKU, gộp dữ liệu theo tuần thì bị xếp \"gián đoạn\", gộp theo tháng lại thành \"mượt\" — vậy nhãn phân loại là thuộc tính của mã hàng hay của planner? (§2.1.3.4)",
    },
  },
];
