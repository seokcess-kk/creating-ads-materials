"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface KeyVisual {
  id: string;
  file_url: string;
  file_name: string;
  metadata_json: Record<string, unknown>;
}

interface KeyVisualManagerProps {
  brandId: string;
}

export function KeyVisualManager({ brandId }: KeyVisualManagerProps) {
  const router = useRouter();
  const [visuals, setVisuals] = useState<KeyVisual[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const loadVisuals = useCallback(async () => {
    const res = await fetch(`/api/brands/${brandId}/key-visuals`);
    if (res.ok) setVisuals(await res.json());
  }, [brandId]);

  useEffect(() => { loadVisuals(); }, [loadVisuals]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length > 0) uploadFiles(files);
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const files = Array.from(e.target.files).filter((f) => f.type.startsWith("image/"));
    if (files.length > 0) uploadFiles(files);
  }

  async function uploadFiles(files: File[]) {
    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("bucket", "brand-assets");
        formData.append("path", `${brandId}/key_visuals/${Date.now()}_${file.name}`);

        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) throw new Error("업로드 실패");
        const { url } = await uploadRes.json();

        await fetch(`/api/brands/${brandId}/assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileUrl: url,
            fileName: file.name,
            assetCategory: "key_visual",
            metadata: { visual_type: "direct_use" },
          }),
        });
      }
      toast.success(`${files.length}개 이미지 업로드 완료`);
      loadVisuals();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/brands/${brandId}/key-visuals/${id}`, { method: "DELETE" });
      toast.success("삭제 완료");
      loadVisuals();
    } catch {
      toast.error("삭제 실패");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        소재에 직접 사용할 사진을 업로드하세요 (공간, 제품, 인물 등).
        캠페인에서 AI 생성 이미지와 함께 선택할 수 있습니다.
      </p>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        }`}
      >
        <label className="cursor-pointer">
          <input type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
          <span className="text-sm text-muted-foreground">
            {uploading ? "업로드 중..." : "클릭 또는 드래그하여 이미지 추가"}
          </span>
        </label>
      </div>

      {visuals.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {visuals.map((v) => (
            <div key={v.id} className="relative group">
              <img src={v.file_url} alt={v.file_name} className="rounded-lg w-full aspect-square object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                <Button size="sm" variant="destructive" onClick={() => handleDelete(v.id)}>삭제</Button>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-1">{v.file_name}</p>
            </div>
          ))}
        </div>
      )}

      {visuals.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          업로드된 이미지가 없습니다. AI가 이미지를 생성합니다.
        </p>
      )}
    </div>
  );
}
