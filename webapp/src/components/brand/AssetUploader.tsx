"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface AssetUploaderProps {
  brandId: string;
}

export function AssetUploader({ brandId }: AssetUploaderProps) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    setFiles((prev) => [...prev, ...droppedFiles]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter((f) =>
        f.type.startsWith("image/")
      );
      setFiles((prev) => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);

    try {
      const urls: string[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("bucket", "brand-assets");
        formData.append("path", `${brandId}/${Date.now()}_${file.name}`);

        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error("업로드 실패");
        const { url } = await res.json();
        urls.push(url);
      }

      setUploadedUrls(urls);
      setFiles([]);
      toast.success(`${urls.length}개 파일 업로드 완료`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "업로드 오류");
    } finally {
      setUploading(false);
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/brands/${brandId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetUrls: uploadedUrls }),
      });
      if (!res.ok) throw new Error("분석 실패");
      toast.success("스타일 가이드가 생성되었습니다");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "분석 오류");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        }`}
      >
        <p className="text-sm text-muted-foreground mb-2">
          로고, 기존 소재, 웹사이트 스크린샷 등을 드래그하세요
        </p>
        <label>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 cursor-pointer">
            파일 선택
          </span>
        </label>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">선택된 파일 ({files.length}개)</p>
          <div className="flex flex-wrap gap-2">
            {files.map((file, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                {file.name}
                <button onClick={() => removeFile(i)} className="ml-1 hover:text-destructive">
                  x
                </button>
              </Badge>
            ))}
          </div>
          <Button onClick={handleUpload} disabled={uploading} size="sm">
            {uploading ? "업로드 중..." : "업로드"}
          </Button>
        </div>
      )}

      {uploadedUrls.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-green-600">
            {uploadedUrls.length}개 파일 업로드 완료
          </p>
          <Button onClick={handleAnalyze} disabled={analyzing}>
            {analyzing ? "Claude 분석 중..." : "스타일 가이드 생성 (Claude 분석)"}
          </Button>
        </div>
      )}
    </div>
  );
}
