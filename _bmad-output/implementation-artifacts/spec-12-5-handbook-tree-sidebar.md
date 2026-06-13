---
title: 'Story 12.5 — Cây thư mục phân cấp (Domain > Handbook > Folder > File)'
type: 'feature'
created: '2026-06-11'
status: 'draft'
baseline_commit: '2463397'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Cần thanh menu trái dạng cây Domain > Handbook > Folder > File (giống explorer của trình soạn code), giữ thứ tự theo tiền tố số (`00-`,`01-`,...,`10-`), tự highlight file đang mở. Đồng thời tài liệu lẻ (không thuộc handbook) vẫn phải truy cập được trong cùng sidebar đó.

**Approach:** Một **sidebar CHUNG** gồm 2 phần:
- **Phần A — Handbooks:** cây build từ `listDomains` → `listHandbooks` → `listHandbookFiles` (relPath). Dựng cây folder từ `relPath` (tách theo `/`).
- **Phần B — Tài liệu lẻ:** hiển thị document `handbookId=undefined` theo **hệ folder hiện tại** (`folders`/`document_folders`) — tái dùng dữ liệu/logic của library cũ, KHÔNG migrate.

Sort node bằng comparator natural-numeric (tách tiền tố số). Auto-expand tổ tiên + highlight node theo active docId (từ `useActiveTab`/`useTabSync`). Resizable bằng `useResizable`. Click file → mở reader (openTab + setActivePanel).

## Boundaries & Constraints

**Always:**
- Build cây client-side từ `relPath`; folder = đoạn path trung gian.
- Sort: comparator tách số đầu tên (`/^(\d+)/`) → so sánh số trước, fallback `localeCompare` (numeric). Áp cho cả file lẫn folder.
- Highlight file đang mở: so `node.docId === activeDocId`; auto-expand mọi folder tổ tiên.
- Lazy-load file list theo handbook khi expand (tránh query mọi handbook 1 lúc).
- Dùng `useResizable` cho độ rộng sidebar; trạng thái expand/collapse lưu localStorage theo handbookId.
- Mobile: ẩn sau drawer (giống reader hiện có).

**Quyết định đã chốt:**
- Sidebar **CHUNG** (1 thanh): phần trên = cây Domain/Handbook, phần dưới = "Tài liệu lẻ" theo folder cũ. KHÔNG tạo 2 sidebar tách rời.
- Tài liệu lẻ giữ nguyên hệ `folders` hiện tại — không gom vào handbook (xem 12.7).

**Never:**
- Không gọi resolver/ảnh ở đây (chỉ điều hướng).
- Không CRUD file/folder ở đây (12.6).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior |
|----------|--------------|---------------------------|
| Render cây | có domains/handbooks/files | Domain > Handbook > folder > file, thu gọn được |
| Sort số | `00-,01-,02-,10-,06-warehouse` | đúng thứ tự số (10 sau 09, không sau 1) |
| File trong assets | `assets/img/m06/x.png` | hiện dưới folder assets/img/m06 |
| Mở file | click node file | openTab + chuyển panel reader |
| Active highlight | đang đọc `06-warehouse.md` | node sáng + tổ tiên auto-expand |
| Handbook rỗng | 0 file | hiện handbook, không có con |

</frozen-after-approval>

## Code Map

- `apps/web/src/lib/handbook/buildTree.ts` (mới) — `buildTree(files: {docId,relPath,format}[])` → cây; `naturalCompare(a,b)`.
- `apps/web/src/components/handbook/HandbookTree.tsx` (mới) — render đệ quy Domain/Handbook/folder/file; expand state + localStorage; resizable.
- `apps/web/src/components/handbook/HandbookSidebar.tsx` (mới) — sidebar CHUNG: phần A handbooks (`listDomains`/`listHandbooks`/`listHandbookFiles`) + phần B "Tài liệu lẻ" (`folders.queries.*` + docs `handbookId=undefined`). Tích hợp vào AppShell.
- Tái dùng phần B: query/logic folder của library cũ (`convex/folders/queries.ts`, `LibraryPageInner` sidebar) — chỉ lọc doc `handbookId=undefined`.
- Tái dùng: `useResizable` (`apps/web/src/hooks/useResizable.ts`), `useTabSync.openTab`, `useActiveTab.setActivePanel`, icon `lucide-react` (Folder, FileText, ChevronRight...).
- Active docId: từ `useActiveTab` (`activePanel` dạng `reader:<docId>`) — parse như `AppShell.pathnameToPanel`.

## Tasks & Acceptance

**Execution:**
- [ ] `lib/handbook/buildTree.ts` — buildTree + naturalCompare (+ test thủ công thứ tự số).
- [ ] `components/handbook/HandbookTree.tsx` — render đệ quy, expand/collapse, highlight active, click → openTab.
- [ ] `components/handbook/HandbookSidebar.tsx` — phần A handbooks + phần B "Tài liệu lẻ" (folder cũ, lọc `handbookId=undefined`), resizable, lazy expand handbook.
- [ ] Tích hợp sidebar CHUNG vào AppShell (thanh trái cố định cho cả library/reader).
- [ ] `npm run build` xanh.

**Acceptance Criteria:**
- Given handbook nhiều file đánh số, when render cây, then thứ tự `00→01→...→09→10` đúng (numeric).
- Given mở 1 file, when active, then node sáng + folder tổ tiên tự mở.
- Given click file trong cây, when click, then reader mở đúng doc.
- Given kéo divider, when kéo, then sidebar đổi rộng mượt.
- Given có tài liệu lẻ (không thuộc handbook), when xem sidebar, then phần "Tài liệu lẻ" hiển thị chúng theo folder cũ, mở đọc được.
