import {
  FileText, BookOpen, FileType2, Presentation, Image, Music, Video, FileCode, Globe, Library,
} from "lucide-react";

export const FORMAT_ICONS: Record<string, React.ElementType> = {
  pdf: FileText, epub: BookOpen, docx: FileType2, pptx: Presentation,
  image: Image, audio: Music, video: Video, markdown: FileCode, web_clip: Globe,
  handbook: Library, // bìa "bộ sách" Handbook
};

export const FORMAT_LABELS: Record<string, string> = {
  pdf: "PDF", epub: "EPUB", docx: "DOCX", pptx: "Slide", image: "Ảnh",
  audio: "Âm thanh", video: "Video", markdown: "Ghi chép", web_clip: "Web clip",
  handbook: "Handbook",
};

/**
 * Bảng màu bìa "mực in" — tông trầm như bìa vải sách cũ, hợp nền giấy ấm.
 * [nền, nền tối hơn (gradient), mực chữ]
 */
const COVER_INKS: [string, string, string][] = [
  ["#7A2E2E", "#5A1F22", "#F6E9DA"], // đỏ rượu
  ["#2F4A3A", "#1F3328", "#EEF2E6"], // xanh rêu
  ["#24395E", "#172742", "#E9EEF7"], // xanh mực
  ["#A26A1F", "#7C4E13", "#FBF1DE"], // vàng đất
  ["#3E5A63", "#2A4047", "#E7F1F2"], // xanh đá
  ["#5B3A4E", "#402636", "#F5E8EF"], // mận
  ["#B0573A", "#8A3F27", "#FCEDE4"], // đất nung
  ["#5C5A2E", "#42401E", "#F3F1DE"], // ô liu
  ["#2E2B33", "#1C1A20", "#ECE7DF"], // than
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Màu bìa ổn định theo tiêu đề (cùng tài liệu → cùng bìa ở mọi nơi). */
export function coverInk(seed: string): { base: string; deep: string; ink: string; tilt: number } {
  const h = hash(seed);
  const [base, deep, ink] = COVER_INKS[h % COVER_INKS.length];
  return { base, deep, ink, tilt: 110 + (h % 50) };
}
