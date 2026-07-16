"use client";
// Render inline markdown + công thức (KaTeX) cho nội dung card/quiz/Feynman.
// Nội dung sinh từ handbook chứa $...$ (toán) và **đậm** — không được hiển thị thô.
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

// Nén khoảng cách để hợp trong thẻ nhỏ; giữ list/code/công thức đọc được.
const BASE =
  "[&_p]:my-0 [&_p]:leading-snug [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 " +
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_strong]:font-semibold " +
  "[&_.katex]:text-[1em] [&>*+*]:mt-1.5 break-words";

export function StudyMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={`${BASE} ${className ?? ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
