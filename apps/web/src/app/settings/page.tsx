"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "@/_generated/api";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2, AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const deleteAccount = useAction(api.users.actions.deleteAccount);
  const [confirm, setConfirm] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const CONFIRM_WORD = "XÓA TÀI KHOẢN";

  async function handleDelete() {
    if (input !== CONFIRM_WORD) return;
    setLoading(true);
    try {
      await deleteAccount({});
      await signOut();
      toast.success("Tài khoản đã được xóa hoàn toàn");
      router.replace("/login");
    } catch (e: any) {
      toast.error("Xóa thất bại: " + e.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Button variant="ghost" size="sm" className="mb-8" onClick={() => router.push("/library")}>
          ← Quay lại thư viện
        </Button>

        <h1 className="mb-8 text-2xl font-bold">Cài đặt tài khoản</h1>

        {/* Danger zone */}
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
          <div className="mb-4 flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="font-semibold">Vùng nguy hiểm</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Xóa tài khoản sẽ xóa vĩnh viễn toàn bộ tài liệu, ghi chú, transcript, lịch sử đọc và mọi dữ liệu liên quan. <strong>Không thể khôi phục.</strong>
          </p>

          {!confirm ? (
            <Button variant="destructive" onClick={() => setConfirm(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Xóa tài khoản
            </Button>
          ) : (
            <div className="space-y-4">
              <p className="text-sm font-medium">
                Gõ <span className="font-mono text-destructive">{CONFIRM_WORD}</span> để xác nhận:
              </p>
              <input
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={CONFIRM_WORD}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-destructive"
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  disabled={input !== CONFIRM_WORD || loading}
                  onClick={handleDelete}
                >
                  {loading ? "Đang xóa..." : "Xác nhận xóa"}
                </Button>
                <Button variant="ghost" onClick={() => { setConfirm(false); setInput(""); }}>
                  Hủy
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
