"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { TagInput } from "./TagInput";
import type { BrandColor, BrandColorRole, BrandIdentity, BrandLogos, BrandVoice } from "@/lib/memory/types";

const COLOR_ROLES: BrandColorRole[] = ["primary", "secondary", "accent", "neutral", "semantic"];

interface IdentityFormProps {
  brandId: string;
  initial: BrandIdentity | null;
}

export function IdentityForm({ brandId, initial }: IdentityFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [voice, setVoice] = useState<BrandVoice>(initial?.voice_json ?? {});
  const [taboos, setTaboos] = useState<string[]>(initial?.taboos ?? []);
  const [colors, setColors] = useState<BrandColor[]>(
    initial?.colors_json ?? [{ role: "primary", hex: "#1A2335" }],
  );
  const [logos, setLogos] = useState<BrandLogos>(initial?.logo_urls_json ?? {});

  function updateColor(index: number, patch: Partial<BrandColor>) {
    setColors((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }
  function addColor() {
    setColors((prev) => [...prev, { role: "accent", hex: "#888888" }]);
  }
  function removeColor(index: number) {
    setColors((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/brands/${brandId}/identity`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice, taboos, colors, logos }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "저장 실패");
      }
      toast.success("Identity 저장 완료");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">브랜드 보이스</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>톤 (한 줄)</Label>
            <Input
              value={voice.tone ?? ""}
              onChange={(e) => setVoice({ ...voice, tone: e.target.value })}
              placeholder="예: 신뢰감 있고 친근한"
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label>성격 (personality)</Label>
            <TagInput
              value={voice.personality ?? []}
              onChange={(v) => setVoice({ ...voice, personality: v })}
              placeholder="예: 전문적, 따뜻함, 혁신적"
              disabled={saving}
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Do (지향)</Label>
              <TagInput
                value={voice.do ?? []}
                onChange={(v) => setVoice({ ...voice, do: v })}
                placeholder="권장 표현·태도"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Don&apos;t (지양)</Label>
              <TagInput
                value={voice.dont ?? []}
                onChange={(v) => setVoice({ ...voice, dont: v })}
                placeholder="회피할 표현·태도"
                disabled={saving}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">금지 표현 (Taboos)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            카피 생성 시 절대 사용하지 않을 단어·표현
          </p>
          <TagInput
            value={taboos}
            onChange={setTaboos}
            placeholder="예: 무조건, 최고의, 역대급"
            disabled={saving}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">브랜드 컬러</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {colors.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="color"
                value={c.hex}
                onChange={(e) => updateColor(i, { hex: e.target.value })}
                disabled={saving}
                className="w-10 h-10 rounded border-0 cursor-pointer"
              />
              <select
                value={c.role}
                onChange={(e) => updateColor(i, { role: e.target.value as BrandColorRole })}
                disabled={saving}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {COLOR_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <Input
                value={c.usage ?? ""}
                onChange={(e) => updateColor(i, { usage: e.target.value })}
                placeholder="용도 (예: CTA 배경)"
                disabled={saving}
                className="flex-1"
              />
              <code className="text-xs bg-muted px-2 py-1 rounded">{c.hex}</code>
              <button
                type="button"
                onClick={() => removeColor(i)}
                disabled={saving || colors.length === 1}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                삭제
              </button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addColor} disabled={saving}>
            + 컬러 추가
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">로고 URL</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          {(["full", "icon", "light", "dark"] as const).map((key) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs capitalize">{key}</Label>
              <Input
                value={logos[key] ?? ""}
                onChange={(e) => setLogos({ ...logos, [key]: e.target.value || undefined })}
                placeholder="https://..."
                disabled={saving}
              />
            </div>
          ))}
          <p className="md:col-span-2 text-xs text-muted-foreground">
            Storage 업로드 UI는 M2에서 추가 예정. 지금은 공개 URL 직접 입력.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()} disabled={saving}>
          돌아가기
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "저장 중..." : "저장"}
        </Button>
      </div>
    </div>
  );
}
