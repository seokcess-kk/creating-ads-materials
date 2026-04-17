"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function NewBrandPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("브랜드명을 입력하세요");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), websiteUrl: websiteUrl.trim() || undefined }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "브랜드 생성 실패");
      }

      const brand = await res.json();
      toast.success(`${brand.name} 브랜드가 등록되었습니다`);
      router.push(`/brands/${brand.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">새 브랜드 등록</h1>
        <p className="text-muted-foreground">브랜드 정보를 입력하고 에셋을 업로드하세요</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>브랜드 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">브랜드명 *</Label>
              <Input
                id="name"
                placeholder="예: STUDYCORE"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">웹사이트 URL</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://example.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                입력하면 Claude가 웹사이트를 분석하여 스타일 가이드에 반영합니다
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "등록 중..." : "브랜드 등록"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
