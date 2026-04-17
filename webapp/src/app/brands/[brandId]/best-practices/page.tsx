"use client";

import { useState, useEffect, useCallback, use } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface BPItem {
  id: string;
  file_url: string;
  file_name: string;
  source: string | null;
  tags: string[];
  analysis_json: Record<string, unknown>;
  created_at: string;
}

export default function BestPracticesPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = use(params);
  const [bps, setBps] = useState<BPItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [source, setSource] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const loadBPs = useCallback(async () => {
    const res = await fetch(`/api/brands/${brandId}/best-practices/list`);
    if (res.ok) setBps(await res.json());
  }, [brandId]);

  useEffect(() => { loadBPs(); }, [loadBPs]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...dropped]);
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    setFiles((prev) => [...prev, ...Array.from(e.target.files!).filter((f) => f.type.startsWith("image/"))]);
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);

    try {
      for (const file of files) {
        // 1. Storage 업로드
        const formData = new FormData();
        formData.append("file", file);
        formData.append("bucket", "best-practices");
        formData.append("path", `${brandId}/${Date.now()}_${file.name}`);

        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) throw new Error("업로드 실패");
        const { url } = await uploadRes.json();

        // 2. BP 저장 + Claude 분석
        await fetch(`/api/brands/${brandId}/best-practices`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileUrl: url,
            fileName: file.name,
            source: source || undefined,
            analyze: true,
          }),
        });
      }

      toast.success(`${files.length}개 BP 업로드 및 분석 완료`);
      setFiles([]);
      setSource("");
      loadBPs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">BP 레퍼런스</h1>
        <p className="text-muted-foreground">경쟁사/업계 우수 광고 소재를 수집하고 분석합니다</p>
      </div>

      {/* 업로드 영역 */}
      <Card>
        <CardHeader>
          <CardTitle>새 레퍼런스 추가</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
            }`}
          >
            <p className="text-sm text-muted-foreground mb-2">
              경쟁사 광고 소재 스크린샷을 드래그하세요 (복수 가능)
            </p>
            <label>
              <input type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
              <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent h-8 px-3 cursor-pointer">
                파일 선택
              </span>
            </label>
          </div>

          {files.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <Badge key={i} variant="secondary">
                    {f.name}
                    <button onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} className="ml-1 hover:text-destructive">×</button>
                  </Badge>
                ))}
              </div>

              <div className="space-y-2">
                <Label>출처 (선택)</Label>
                <Input placeholder="경쟁사명, 채널 등" value={source} onChange={(e) => setSource(e.target.value)} />
              </div>

              <Button onClick={handleUpload} disabled={uploading}>
                {uploading ? "업로드 및 분석 중..." : `${files.length}개 업로드 + Claude 분석`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* BP 목록 */}
      {bps.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-4">수집된 레퍼런스 ({bps.length}개)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bps.map((bp) => {
              const analysis = bp.analysis_json || {};
              const mood = analysis.mood as string[] | undefined;
              const strengths = analysis.strengths as string[] | undefined;
              const adStyle = analysis.ad_style as string | undefined;
              const colors = analysis.color_palette as string[] | undefined;

              return (
                <Card key={bp.id}>
                  <CardContent className="pt-4 space-y-3">
                    <img src={bp.file_url} alt={bp.file_name} className="rounded-lg w-full aspect-square object-cover" />

                    <div>
                      <p className="text-xs text-muted-foreground truncate">{bp.file_name}</p>
                      {bp.source && <p className="text-xs text-muted-foreground">출처: {bp.source}</p>}
                    </div>

                    {adStyle && <Badge variant="outline" className="text-xs">{adStyle}</Badge>}

                    {colors && colors.length > 0 && (
                      <div className="flex gap-1">
                        {colors.slice(0, 6).map((hex, i) => (
                          <div key={i} className="w-5 h-5 rounded border" style={{ backgroundColor: hex }} title={hex} />
                        ))}
                      </div>
                    )}

                    {mood && mood.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {mood.map((m, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{m}</Badge>
                        ))}
                      </div>
                    )}

                    {strengths && strengths.length > 0 && (
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {strengths.slice(0, 3).map((s, i) => (
                          <li key={i}>• {s}</li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
