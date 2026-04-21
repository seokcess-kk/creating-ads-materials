"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { BrandKeyVisual, KeyVisualKind } from "@/lib/memory/types";
import { directUpload } from "@/lib/upload/direct-upload";
import { resizeImageFile } from "@/lib/upload/resize-image";

interface KeyVisualManagerProps {
  brandId: string;
  initial: BrandKeyVisual[];
}

const KIND_LABELS: Record<KeyVisualKind, string> = {
  person: "인물",
  space: "공간",
  product: "제품",
};

const KIND_HINTS: Record<KeyVisualKind, string> = {
  person: "원장·대표·직원 등 광고에 등장할 실제 인물 (Phase 2에서 안전 합성)",
  space: "매장·스튜디오·시설 등 브랜드 공간 (즉시 사용 가능)",
  product: "실제 상품·기기·패키지 (즉시 사용 가능)",
};

export function KeyVisualManager({ brandId, initial }: KeyVisualManagerProps) {
  const router = useRouter();
  const [list, setList] = useState<BrandKeyVisual[]>(initial);
  const [filterKind, setFilterKind] = useState<KeyVisualKind | "all">("all");
  const [kind, setKind] = useState<KeyVisualKind>("space");
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!label.trim()) {
      toast.error("라벨을 먼저 입력하세요");
      return;
    }
    setUploading(true);
    toast.info("업로드 + Vision 분석 시작 (20~40초)");
    try {
      const resized = await resizeImageFile(file, { maxEdge: 2048, quality: 0.9 });
      const uploaded = await directUpload(brandId, "key_visual", resized);
      const res = await fetch(`/api/brands/${brandId}/key-visuals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storage_url: uploaded.publicUrl,
          kind,
          label: label.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "업로드 실패");
      }
      const { keyVisual } = await res.json();
      setList((prev) => [keyVisual as BrandKeyVisual, ...prev]);
      setLabel("");
      if (fileRef.current) fileRef.current.value = "";
      toast.success("등록 완료");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setUploading(false);
    }
  }

  async function toggleLabel(id: string, newLabel: string) {
    setList((prev) =>
      prev.map((kv) => (kv.id === id ? { ...kv, label: newLabel } : kv)),
    );
    try {
      const res = await fetch(`/api/brands/${brandId}/key-visuals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel }),
      });
      if (!res.ok) throw new Error("저장 실패");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    }
  }

  async function togglePrimary(id: string, current: boolean) {
    try {
      const res = await fetch(`/api/brands/${brandId}/key-visuals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_primary: !current }),
      });
      if (!res.ok) throw new Error("저장 실패");
      setList((prev) =>
        prev.map((kv) => (kv.id === id ? { ...kv, is_primary: !current } : kv)),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    }
  }

  async function remove(id: string) {
    if (!confirm("이 실사 자산을 삭제할까요? Storage 파일은 남습니다.")) return;
    try {
      const res = await fetch(`/api/brands/${brandId}/key-visuals/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("삭제 실패");
      setList((prev) => prev.filter((kv) => kv.id !== id));
      toast.success("삭제 완료");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    }
  }

  const filtered =
    filterKind === "all" ? list : list.filter((kv) => kv.kind === filterKind);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">새 실사 자산 업로드</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>종류</Label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as KeyVisualKind)}
                disabled={uploading}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="space">공간</option>
                <option value="product">제품</option>
                <option value="person">인물</option>
              </select>
              <p className="text-xs text-muted-foreground">{KIND_HINTS[kind]}</p>
            </div>
            <div className="space-y-2">
              <Label>라벨</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={
                  kind === "person"
                    ? "예: 김OO 원장 프로필"
                    : kind === "space"
                      ? "예: 1층 독서실 전경"
                      : "예: 시그니처 크림 전면"
                }
                disabled={uploading}
              />
            </div>
          </div>
          <label className="block border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:border-primary/50 transition-colors">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              disabled={uploading}
              className="hidden"
            />
            <p className="text-sm text-muted-foreground">
              {uploading ? "업로드 및 분석 중..." : "클릭하여 이미지 선택"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Claude Vision이 자동으로 설명·무드 태그를 추출합니다
            </p>
          </label>
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">등록된 자산 {list.length}개</h2>
          <div className="flex gap-1">
            {(["all", "space", "product", "person"] as const).map((k) => (
              <Button
                key={k}
                size="sm"
                variant={filterKind === k ? "secondary" : "ghost"}
                onClick={() => setFilterKind(k)}
              >
                {k === "all" ? "전체" : KIND_LABELS[k]}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((kv) => (
            <Card key={kv.id}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex gap-3">
                  <a
                    href={kv.storage_url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0"
                  >
                    <img
                      src={kv.storage_url}
                      alt={kv.label}
                      className="w-28 h-28 object-cover rounded-md border"
                    />
                  </a>
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-start gap-2">
                      <Input
                        value={kv.label}
                        onChange={(e) => toggleLabel(kv.id, e.target.value)}
                        className="text-sm font-medium h-8"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline">{KIND_LABELS[kv.kind]}</Badge>
                      {kv.is_primary && <Badge variant="secondary">primary</Badge>}
                      {kv.vision_status === "ready" && (
                        <Badge variant="secondary">분석 완료</Badge>
                      )}
                      {kv.vision_status === "pending" && <Badge>분석 중</Badge>}
                      {kv.vision_status === "failed" && (
                        <Badge variant="destructive">실패</Badge>
                      )}
                    </div>
                    {kv.description && (
                      <p className="text-xs text-muted-foreground line-clamp-3">
                        {kv.description}
                      </p>
                    )}
                    {kv.mood_tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {kv.mood_tags.map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px]">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {kv.vision_error && (
                      <p className="text-xs text-destructive">오류: {kv.vision_error}</p>
                    )}
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => togglePrimary(kv.id, kv.is_primary)}
                      >
                        {kv.is_primary ? "primary 해제" : "primary"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(kv.id)}
                        className="text-destructive ml-auto"
                      >
                        삭제
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <Card className="md:col-span-2">
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                {list.length === 0
                  ? "아직 등록된 실사 자산이 없습니다. 공간·제품 사진부터 업로드해보세요."
                  : `${filterKind === "all" ? "" : KIND_LABELS[filterKind] + " "}자산이 없습니다.`}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
