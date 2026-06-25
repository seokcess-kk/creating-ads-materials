"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Brand } from "@/lib/memory/types";

export function BrandInfoEditButton({ brand }: { brand: Brand }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(brand.name);
  const [websiteUrl, setWebsiteUrl] = useState(brand.website_url ?? "");
  const [category, setCategory] = useState(brand.category ?? "");
  const [description, setDescription] = useState(brand.description ?? "");
  const [saving, setSaving] = useState(false);

  function reset() {
    setName(brand.name);
    setWebsiteUrl(brand.website_url ?? "");
    setCategory(brand.category ?? "");
    setDescription(brand.description ?? "");
  }

  async function save() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("브랜드명은 비울 수 없습니다");
      return;
    }
    const trimmedUrl = websiteUrl.trim();
    if (trimmedUrl) {
      try {
        new URL(trimmedUrl);
      } catch {
        toast.error("올바른 URL이 아닙니다");
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/brands/${brand.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          website_url: trimmedUrl || null,
          category: category.trim() || null,
          description: description.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "수정 실패");
      }
      toast.success("브랜드 정보가 저장되었습니다");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        setOpen(o);
      }}
    >
      <DialogTrigger>
        <span className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">
          정보 수정
        </span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>브랜드 정보 수정</DialogTitle>
          <DialogDescription>
            브랜드의 기본 정보를 변경합니다. 메모리(Identity·Offer·Audience)는 별도
            섹션에서 관리됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="brand-edit-name">브랜드명 *</Label>
            <Input
              id="brand-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand-edit-url">홈페이지 URL</Label>
            <Input
              id="brand-edit-url"
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
              disabled={saving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand-edit-category">카테고리</Label>
            <Input
              id="brand-edit-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="education, ecommerce, saas, fnb 등"
              disabled={saving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand-edit-description">설명</Label>
            <Textarea
              id="brand-edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={saving}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            disabled={saving}
          >
            취소
          </Button>
          <Button onClick={save} disabled={saving} pending={saving}>
            {saving ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
