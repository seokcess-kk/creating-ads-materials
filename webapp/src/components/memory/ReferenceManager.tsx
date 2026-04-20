"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { BrandReference, ReferenceSource } from "@/lib/memory/types";
import { VisionAnalysisCard } from "./VisionAnalysisCard";

interface ReferenceManagerProps {
  brandId: string;
  initial: BrandReference[];
}

const SOURCE_LABELS: Record<ReferenceSource, string> = {
  bp_upload: "BP",
  own_archive: "자사",
  competitor: "경쟁사",
  industry: "업계",
};

export function ReferenceManager({ brandId, initial }: ReferenceManagerProps) {
  const router = useRouter();
  const [list, setList] = useState<BrandReference[]>(initial);
  const [sourceType, setSourceType] = useState<ReferenceSource>("bp_upload");
  const [sourceNote, setSourceNote] = useState("");
  const [isNegative, setIsNegative] = useState(false);
  const [weight, setWeight] = useState(50);
  const [uploading, setUploading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadOne(file: File): Promise<BrandReference | null> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("source_type", sourceType);
    if (sourceNote) fd.append("source_note", sourceNote);
    fd.append("is_negative", String(isNegative));
    fd.append("weight", String(weight));
    const res = await fetch(`/api/brands/${brandId}/references`, { method: "POST", body: fd });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "업로드 실패");
    }
    const { reference } = await res.json();
    return reference as BrandReference;
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) {
      toast.error("이미지 파일만 업로드 가능");
      return;
    }
    setUploading(true);
    toast.info(`${arr.length}개 업로드 + Vision 분석 시작 (장당 10~30초)`);

    const results = await Promise.allSettled(arr.map(uploadOne));
    const uploaded: BrandReference[] = [];
    let failed = 0;
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) uploaded.push(r.value);
      else failed++;
    }
    setList((prev) => [...uploaded, ...prev]);
    if (uploaded.length > 0) toast.success(`${uploaded.length}개 완료`);
    if (failed > 0) toast.error(`${failed}개 실패`);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  async function changeWeight(id: string, newWeight: number) {
    setList((prev) => prev.map((r) => (r.id === id ? { ...r, weight: newWeight } : r)));
    try {
      const res = await fetch(`/api/brands/${brandId}/references/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight: newWeight }),
      });
      if (!res.ok) throw new Error("저장 실패");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    }
  }

  async function remove(id: string) {
    if (!confirm("이 레퍼런스를 삭제할까요? Storage 파일은 그대로 남습니다.")) return;
    try {
      const res = await fetch(`/api/brands/${brandId}/references/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      setList((prev) => prev.filter((r) => r.id !== id));
      toast.success("삭제 완료");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    }
  }

  async function reanalyze(id: string) {
    setList((prev) =>
      prev.map((r) => (r.id === id ? { ...r, vision_status: "pending", vision_error: null } : r)),
    );
    toast.info("Vision 재분석 시작");
    try {
      const res = await fetch(`/api/brands/${brandId}/references/${id}/reanalyze`, {
        method: "POST",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "재분석 실패");
      const { reference } = await res.json();
      setList((prev) => prev.map((r) => (r.id === id ? reference : r)));
      toast.success("재분석 완료");
      router.refresh();
    } catch (e) {
      setList((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                vision_status: "failed",
                vision_error: e instanceof Error ? e.message : "오류",
              }
            : r,
        ),
      );
      toast.error(e instanceof Error ? e.message : "오류");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">업로드</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>출처</Label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as ReferenceSource)}
                disabled={uploading}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="bp_upload">BP (우수 사례)</option>
                <option value="own_archive">자사 아카이브</option>
                <option value="competitor">경쟁사</option>
                <option value="industry">업계 일반</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>가중치 (0~100)</Label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  disabled={uploading}
                  className="flex-1"
                />
                <span className="w-10 text-sm text-right">{weight}</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>메모 (선택)</Label>
            <Input
              value={sourceNote}
              onChange={(e) => setSourceNote(e.target.value)}
              placeholder="출처·맥락 메모"
              disabled={uploading}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isNegative}
              onChange={(e) => setIsNegative(e.target.checked)}
              disabled={uploading}
            />
            <span className="text-sm">Negative 샘플 (이렇게 만들지 말 것)</span>
          </label>
          <label className="block border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:border-primary/50 transition-colors">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              disabled={uploading}
              className="hidden"
            />
            <p className="text-sm text-muted-foreground">
              {uploading ? "업로드 및 분석 중..." : "클릭하여 이미지 업로드 (복수 가능)"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              업로드 즉시 Claude Vision이 8축으로 자동 분석
            </p>
          </label>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-semibold mb-3">등록된 레퍼런스 {list.length}개</h2>
        <div className="space-y-3">
          {list.map((r) => (
            <Card key={r.id}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex gap-4">
                  <a href={r.file_url} target="_blank" rel="noreferrer" className="shrink-0">
                    <img
                      src={r.file_url}
                      alt={r.file_name ?? "reference"}
                      className="w-28 h-28 object-cover rounded-md border"
                    />
                  </a>
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.file_name}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge variant="outline">{SOURCE_LABELS[r.source_type]}</Badge>
                          {r.is_negative && <Badge variant="destructive">negative</Badge>}
                          {r.vision_status === "ready" && (
                            <Badge variant="secondary">분석 완료</Badge>
                          )}
                          {r.vision_status === "pending" && <Badge>분석 중</Badge>}
                          {r.vision_status === "failed" && (
                            <Badge variant="destructive">실패</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {r.vision_status !== "pending" && (
                          <Button size="sm" variant="ghost" onClick={() => reanalyze(r.id)}>
                            재분석
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                          disabled={r.vision_status !== "ready"}
                        >
                          {expandedId === r.id ? "접기" : "펼치기"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => remove(r.id)}
                          className="text-destructive"
                        >
                          삭제
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16">가중치</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={r.weight}
                        onChange={(e) => changeWeight(r.id, Number(e.target.value))}
                        className="flex-1"
                      />
                      <span className="w-10 text-xs text-right">{r.weight}</span>
                    </div>
                    {r.vision_error && (
                      <p className="text-xs text-destructive">오류: {r.vision_error}</p>
                    )}
                  </div>
                </div>
                {expandedId === r.id && r.vision_status === "ready" && (
                  <div className="border-t pt-4">
                    <VisionAnalysisCard analysis={r.vision_analysis_json} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {list.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                아직 레퍼런스가 없습니다. 우수 사례 이미지를 업로드하세요.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
