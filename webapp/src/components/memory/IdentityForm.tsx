"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { TagInput } from "./TagInput";
import type { BrandColor, BrandColorRole, BrandIdentity, BrandLogos, BrandVoice } from "@/lib/memory/types";

type LogoVariant = "full" | "icon" | "light" | "dark";
const LOGO_VARIANTS: Array<{ id: LogoVariant; label: string; hint: string }> = [
  { id: "full", label: "Full", hint: "기본 워드마크" },
  { id: "icon", label: "Icon", hint: "아이콘/심볼 단독" },
  { id: "light", label: "Light", hint: "밝은 배경용" },
  { id: "dark", label: "Dark", hint: "어두운 배경용" },
];

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
          <CardTitle className="text-base">로고 업로드</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {LOGO_VARIANTS.map((v) => (
            <LogoSlot
              key={v.id}
              brandId={brandId}
              variant={v.id}
              label={v.label}
              hint={v.hint}
              url={logos[v.id]}
              disabled={saving}
              onChange={(url) => setLogos((prev) => ({ ...prev, [v.id]: url ?? undefined }))}
            />
          ))}
          <p className="col-span-2 md:col-span-4 text-xs text-muted-foreground">
            PNG 투명 배경 권장 · 최대 10MB · 업로드 즉시 Storage에 저장됩니다.
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

interface LogoSlotProps {
  brandId: string;
  variant: LogoVariant;
  label: string;
  hint: string;
  url: string | undefined;
  disabled: boolean;
  onChange: (url: string | null) => void;
}

function LogoSlot({ brandId, variant, label, hint, url, disabled, onChange }: LogoSlotProps) {
  const [busy, setBusy] = useState<"upload" | "delete" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 업로드 가능");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("10MB를 초과합니다");
      return;
    }
    setBusy("upload");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("variant", variant);
      const res = await fetch(`/api/brands/${brandId}/identity/logos`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "업로드 실패");
      onChange(data.url);
      toast.success(`${label} 업로드 완료`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove() {
    if (!confirm(`${label} 로고를 삭제할까요?`)) return;
    setBusy("delete");
    try {
      const res = await fetch(
        `/api/brands/${brandId}/identity/logos?variant=${variant}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error((await res.json()).error ?? "삭제 실패");
      onChange(null);
      toast.success(`${label} 삭제 완료`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류");
    } finally {
      setBusy(null);
    }
  }

  const isBusy = busy !== null;
  const controlsDisabled = disabled || isBusy;

  return (
    <div className="border rounded-md p-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-[10px] text-muted-foreground">{hint}</span>
      </div>
      <div className="aspect-square rounded bg-muted/40 border flex items-center justify-center overflow-hidden">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`${label} logo`} className="max-w-full max-h-full object-contain p-2" />
        ) : (
          <span className="text-xs text-muted-foreground">없음</span>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        disabled={controlsDisabled}
        className="hidden"
      />
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => fileRef.current?.click()}
          disabled={controlsDisabled}
        >
          {busy === "upload" ? "업로드 중..." : url ? "교체" : "업로드"}
        </Button>
        {url && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={remove}
            disabled={controlsDisabled}
            className="text-destructive"
          >
            {busy === "delete" ? "..." : "삭제"}
          </Button>
        )}
      </div>
    </div>
  );
}
