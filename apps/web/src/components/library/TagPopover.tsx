"use client";

import { useState, useRef } from "react";
import { Tag, X, Plus } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/_generated/api";
import { Id } from "@/_generated/dataModel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { labels } from "@/lib/i18n/labels";

const L = labels.tag;

interface TagPopoverProps {
  docId: Id<"documents">;
}

export function TagPopover({ docId }: TagPopoverProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const allTags = useQuery(api.tags.queries.listByUser);
  const docTags = useQuery(api.tags.queries.listForDoc, { docId });
  const addToDoc = useMutation(api.tags.mutations.addToDoc);
  const removeFromDoc = useMutation(api.tags.mutations.removeFromDoc);
  const createAndAdd = useMutation(api.tags.mutations.createAndAddToDoc);

  const docTagIds = new Set(docTags?.map((t) => t._id) ?? []);

  const filtered = (allTags ?? []).filter((t) =>
    t.name.toLowerCase().includes(input.toLowerCase()),
  );

  async function handleToggle(tagId: Id<"tags">) {
    if (docTagIds.has(tagId)) {
      await removeFromDoc({ docId, tagId });
    } else {
      await addToDoc({ docId, tagId });
    }
  }

  async function handleCreate() {
    const name = input.trim();
    if (!name) return;
    await createAndAdd({ docId, name });
    setInput("");
    inputRef.current?.focus();
  }

  const showCreate = input.trim() && !filtered.some((t) => t.name === input.trim());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium hover:bg-muted transition-colors" aria-label="Gán tag">
        <Tag className="h-4 w-4" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2" align="start">
        <p className="mb-2 px-1 text-xs font-semibold text-muted-foreground">{L.addTag}</p>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          placeholder={L.searchOrCreate}
          className="mb-2 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          aria-label="Tìm hoặc tạo tag"
        />
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {showCreate && (
            <button
              onClick={handleCreate}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span>Tạo &ldquo;{input.trim()}&rdquo;</span>
            </button>
          )}
          {filtered.length === 0 && !showCreate && (
            <p className="px-2 py-2 text-sm text-muted-foreground">{L.noTags}</p>
          )}
          {filtered.map((tag) => {
            const active = docTagIds.has(tag._id);
            return (
              <button
                key={tag._id}
                onClick={() => handleToggle(tag._id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted ${active ? "bg-muted" : ""}`}
                aria-pressed={active}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: tag.color ?? "#6b7280" }}
                  aria-hidden
                />
                <span className="flex-1 text-left truncate">{tag.name}</span>
                {active && <X className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
