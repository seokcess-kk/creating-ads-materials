"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { TagInput } from "./TagInput";
import type { BrandColor, BrandColorRole, BrandIdentity, BrandLogo, BrandVoice } from "@/lib/memory/types";

const COLOR_ROLES: BrandColorRole[] = ["primary", "secondary", "accent", "neutral", "semantic"];

const TONE_OPTIONS = [
  "신뢰감 있고 전문적인",
  "친근하고 따뜻한",
  "직설적이고 명확한",
  "감성적이고 스토리 중심",
  "실용적이고 간결한",
  "혁신적이고 도전적인",
  "고급스럽고 절제된",
  "캐주얼하고 대화형",
];

const PERSONALITY_OPTIONS = [
  "전문적",
  "정확한",
  "동기부여",
  "공감적",
  "혁신적",
  "신뢰",
  "친밀함",
  "유머러스",
  "진지한",
  "격려하는",
  "실용적",
  "창의적",
  "따뜻한",
  "세련된",
];

const DO_OPTIONS = [
  "구체적 수치 제시",
  "증거·인증 병기",
  "실사용자 후기",
  "단계별 설명",
  "개인 맞춤 제안",
  "전문 용어 쉽게",
  "즉시 사용 가능한 혜택",
  "긴급성·한정성 표시",
];

const DONT_OPTIONS = [
  "과장 표현",
  "100% 확언",
  "추상적 수사",
  "격식 과잉",
  "전문용어 남발",
  "개인 속성 단정",
  "before-after 비교",
  "결과 확약",
];

const TABOO_DEFAULTS = [
  "무조건",
  "역대급",
  "최고의",
  "완벽한",
  "100%",
  "확실히",
  "반드시",
  "파격적",
];

function mergeUnique<T>(a: T[] | undefined, b: T[] | undefined): T[] {
  const set = new Set<T>();
  const out: T[] = [];
  for (const x of [...(a ?? []), ...(b ?? [])]) {
    if (!set.has(x)) {
      set.add(x);
      out.push(x);
    }
  }
  return out;
}

function OptionChips({
  options,
  active,
  onToggle,
  disabled,
}: {
  options: readonly string[];
  active: string[];
  onToggle: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1 pt-1">
      {options.map((o) => {
        const on = active.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            disabled={disabled}
            className={`text-[11px] rounded-full border px-2 py-0.5 transition-colors ${
              on ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
            }`}
          >
            {on ? "✓ " : "+ "}
            {o}
          </button>
        );
      })}
    </div>
  );
}

interface IdentityFormProps {
  brandId: string;
  initial: BrandIdentity | null;
  brandWebsiteUrl: string | null;
}

export function IdentityForm({
  brandId,
  initial,
  brandWebsiteUrl,
}: IdentityFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [voice, setVoice] = useState<BrandVoice>(initial?.voice_json ?? {});
  const [taboos, setTaboos] = useState<string[]>(initial?.taboos ?? []);
  const [colors, setColors] = useState<BrandColor[]>(
    initial?.colors_json ?? [{ role: "primary", hex: "#1A2335" }],
  );
  const [logos, setLogos] = useState<BrandLogo[]>(initial?.logos_json ?? []);

  const [analyzing, setAnalyzing] = useState(false);
  const [websiteOverride, setWebsiteOverride] = useState("");

  function toggleList<T extends string>(arr: T[] | undefined, v: T): T[] {
    const a = arr ?? [];
    return a.includes(v) ? a.filter((x) => x !== v) : [...a, v];
  }

  async function runWebsiteAnalysis() {
    const url = websiteOverride.trim() || brandWebsiteUrl || "";
    if (!url) {
      toast.error("브랜드의 홈페이지 URL을 먼저 등록해주세요");
      return;
    }
    setAnalyzing(true);
    toast.info("Claude가 홈페이지를 분석하는 중... (10~30초)");
    try {
      const res = await fetch(`/api/brands/${brandId}/analyze-website`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_url: websiteOverride.trim() || undefined,
          save_brand_fields: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "분석 실패");

      const a = data.analysis as {
        voice?: BrandVoice;
        taboos?: string[];
        colors?: BrandColor[];
      };
      if (a.voice) {
        setVoice((prev) => ({
          tone: a.voice?.tone ?? prev.tone,
          personality: mergeUnique(prev.personality, a.voice?.personality),
          do: mergeUnique(prev.do, a.voice?.do),
          dont: mergeUnique(prev.dont, a.voice?.dont),
        }));
      }
      if (a.taboos) setTaboos((prev) => mergeUnique(prev, a.taboos));
      if (a.colors) {
        setColors((prev) => {
          const existing = new Set(prev.map((c) => c.hex.toUpperCase()));
          const fresh = (a.colors ?? []).filter(
            (c) => !existing.has(c.hex.toUpperCase()),
          );
          return [...prev, ...fresh];
        });
      }
      toast.success("자동 분석 완료 — 검토 후 저장 버튼을 눌러주세요");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setAnalyzing(false);
    }
  }

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
      <Card className="bg-muted/30 border-dashed">
        <CardHeader>
          <CardTitle className="text-base">홈페이지 자동 분석</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            홈페이지 URL을 입력하면 Claude가 본문을 읽고 Voice·Taboos·Colors를 추출해
            아래 필드에 자동 반영합니다. 기존 값은 유지되고 <strong>새 항목만 추가</strong>됩니다.
          </p>
          <div className="flex gap-2">
            <Input
              value={websiteOverride}
              onChange={(e) => setWebsiteOverride(e.target.value)}
              placeholder={brandWebsiteUrl ?? "https://example.com"}
              disabled={analyzing}
            />
            <Button onClick={runWebsiteAnalysis} disabled={analyzing}>
              {analyzing ? "분석 중..." : "자동 분석"}
            </Button>
          </div>
          {brandWebsiteUrl && !websiteOverride && (
            <p className="text-[11px] text-muted-foreground">
              현재 브랜드 URL 사용: {brandWebsiteUrl}
            </p>
          )}
        </CardContent>
      </Card>

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
            <OptionChips
              options={TONE_OPTIONS}
              active={voice.tone ? [voice.tone] : []}
              onToggle={(t) =>
                setVoice({ ...voice, tone: voice.tone === t ? "" : t })
              }
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
            <OptionChips
              options={PERSONALITY_OPTIONS}
              active={voice.personality ?? []}
              onToggle={(v) =>
                setVoice({
                  ...voice,
                  personality: toggleList(voice.personality, v),
                })
              }
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
              <OptionChips
                options={DO_OPTIONS}
                active={voice.do ?? []}
                onToggle={(v) =>
                  setVoice({ ...voice, do: toggleList(voice.do, v) })
                }
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
              <OptionChips
                options={DONT_OPTIONS}
                active={voice.dont ?? []}
                onToggle={(v) =>
                  setVoice({ ...voice, dont: toggleList(voice.dont, v) })
                }
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
          <OptionChips
            options={TABOO_DEFAULTS}
            active={taboos}
            onToggle={(v) => setTaboos(toggleList(taboos, v))}
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
          <CardTitle className="text-base">로고</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            자유롭게 업로드하세요. ⭐ 기본 로고는 Compose 단계에서 자동 선택되며,
            다른 로고를 원하면 Compose에서 썸네일 클릭으로 교체할 수 있습니다.
          </p>
          <LogoGallery
            brandId={brandId}
            logos={logos}
            onChange={setLogos}
            disabled={saving}
          />
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

interface LogoGalleryProps {
  brandId: string;
  logos: BrandLogo[];
  onChange: (logos: BrandLogo[]) => void;
  disabled?: boolean;
}

function LogoGallery({ brandId, logos, onChange, disabled }: LogoGalleryProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    // 사전 검증 (전체 일괄 차단)
    for (const f of files) {
      if (!f.type.startsWith("image/")) {
        toast.error(`${f.name}: 이미지 파일이 아님`);
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name}: 10MB 초과`);
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
    }

    setUploadProgress({ current: 0, total: files.length });
    let ok = 0;
    let latestIdentity: { logos_json?: BrandLogo[] } | undefined;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress({ current: i + 1, total: files.length });
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/brands/${brandId}/identity/logos`, {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "업로드 실패");
        latestIdentity = data.identity;
        ok += 1;
      } catch (err) {
        toast.error(
          `${file.name}: ${err instanceof Error ? err.message : "오류"}`,
        );
      }
    }

    if (latestIdentity?.logos_json) {
      onChange(latestIdentity.logos_json);
    }
    if (ok > 0) {
      toast.success(
        ok === files.length
          ? `${ok}개 로고 업로드 완료`
          : `${ok}/${files.length}개 완료 (나머지 실패)`,
      );
    }
    setUploadProgress(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function setPrimary(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/brands/${brandId}/identity/logos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo_id: id, is_primary: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "변경 실패");
      onChange(data.identity?.logos_json ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류");
    } finally {
      setBusyId(null);
    }
  }

  async function saveLabel(id: string, label: string) {
    try {
      const res = await fetch(`/api/brands/${brandId}/identity/logos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo_id: id, label: label.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      onChange(data.identity?.logos_json ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류");
    }
  }

  async function remove(id: string) {
    if (!confirm("이 로고를 삭제할까요?")) return;
    setBusyId(id);
    try {
      const res = await fetch(
        `/api/brands/${brandId}/identity/logos?logo_id=${id}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "삭제 실패");
      onChange(data.identity?.logos_json ?? []);
      toast.success("삭제 완료");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {logos.map((logo) => (
          <LogoCard
            key={logo.id}
            logo={logo}
            busy={busyId === logo.id}
            disabled={disabled}
            onSetPrimary={() => setPrimary(logo.id)}
            onLabelChange={(label) => saveLabel(logo.id, label)}
            onRemove={() => remove(logo.id)}
          />
        ))}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || uploadProgress !== null}
          className="aspect-square rounded-md border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-40"
        >
          <span className="text-2xl">+</span>
          <span>
            {uploadProgress
              ? `업로드 ${uploadProgress.current}/${uploadProgress.total}`
              : "로고 추가"}
          </span>
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={upload}
        className="hidden"
      />
      <p className="text-[11px] text-muted-foreground">
        PNG 투명 배경 권장 · 최대 10MB · 여러 파일 동시 선택 가능 ·
        ⭐ 기본 로고 1개 지정 (Compose에서 자동 선택)
      </p>
    </div>
  );
}

interface LogoCardProps {
  logo: BrandLogo;
  busy: boolean;
  disabled?: boolean;
  onSetPrimary: () => void;
  onLabelChange: (label: string) => void;
  onRemove: () => void;
}

function LogoCard({ logo, busy, disabled, onSetPrimary, onLabelChange, onRemove }: LogoCardProps) {
  const [labelDraft, setLabelDraft] = useState(logo.label ?? "");

  return (
    <div
      className={
        "border rounded-md p-2 space-y-2 " +
        (logo.is_primary ? "border-primary bg-primary/5" : "")
      }
    >
      <div className="aspect-square rounded bg-muted/40 border flex items-center justify-center overflow-hidden relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo.url}
          alt={logo.label ?? "logo"}
          className="max-w-full max-h-full object-contain p-2"
        />
        {logo.is_primary && (
          <Badge className="absolute top-1 left-1 text-[9px]">⭐ 기본</Badge>
        )}
      </div>
      <Input
        value={labelDraft}
        onChange={(e) => setLabelDraft(e.target.value)}
        onBlur={() => {
          if (labelDraft !== (logo.label ?? "")) onLabelChange(labelDraft);
        }}
        placeholder="라벨 (선택)"
        disabled={disabled || busy}
        className="h-7 text-xs"
      />
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          variant={logo.is_primary ? "secondary" : "outline"}
          onClick={onSetPrimary}
          disabled={disabled || busy || logo.is_primary}
          className="flex-1 text-xs"
        >
          {logo.is_primary ? "⭐ 기본" : "기본으로"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onRemove}
          disabled={disabled || busy}
          className="text-destructive text-xs"
        >
          {busy ? "..." : "삭제"}
        </Button>
      </div>
    </div>
  );
}
