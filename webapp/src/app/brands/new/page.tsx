"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface BrandAnalysis {
  industry?: string;
  tone?: string;
  brand_colors?: Record<string, string>;
  brand_personality?: string[];
  recommended_ad_style?: string;
}

interface ColorEntry {
  role: string;
  hex: string;
  usage: string;
}

interface LogoAnalysis {
  index: number;
  variant: string;
  theme: string;
  dominant_color: string;
  suitable_for: { dark_background: boolean; light_background: boolean };
  has_text: boolean;
  quality_score: number;
  description: string;
}

interface UploadedLogo {
  file: File;
  preview: string;
  url?: string;
  analysis?: LogoAnalysis;
}

const STEPS = [
  { label: "기본 정보", description: "브랜드명, 홈페이지" },
  { label: "에셋 업로드", description: "로고, 키 비주얼" },
  { label: "컬러 설정", description: "브랜드 컬러 확인" },
  { label: "확인", description: "등록 완료" },
];

export default function NewBrandWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1: 기본 정보
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [brandId, setBrandId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<BrandAnalysis | null>(null);

  // Step 2: 에셋
  const [logos, setLogos] = useState<UploadedLogo[]>([]);
  const [logoAnalyzing, setLogoAnalyzing] = useState(false);
  const [keyVisualFiles, setKeyVisualFiles] = useState<File[]>([]);
  const [keyVisualUrls, setKeyVisualUrls] = useState<string[]>([]);

  // Step 3: 컬러
  const [colors, setColors] = useState<ColorEntry[]>([
    { role: "primary", hex: "#1A2335", usage: "배경, 메인" },
    { role: "secondary", hex: "#D4AF37", usage: "강조, CTA" },
    { role: "text", hex: "#FFFFFF", usage: "텍스트" },
    { role: "cta_bg", hex: "#D4AF37", usage: "CTA 버튼 배경" },
    { role: "cta_text", hex: "#1A2335", usage: "CTA 버튼 텍스트" },
  ]);

  // === Step 1: 기본 정보 + 브랜드 생성 + 웹사이트 분석 ===
  async function handleStep1Next() {
    if (!name.trim()) {
      toast.error("브랜드명을 입력하세요");
      return;
    }

    setLoading(true);
    try {
      // 브랜드 생성
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), websiteUrl: websiteUrl.trim() || undefined }),
      });
      if (!res.ok) throw new Error("브랜드 생성 실패");
      const brand = await res.json();
      setBrandId(brand.id);

      // 웹사이트가 있으면 자동 분석
      if (websiteUrl.trim()) {
        toast.info("웹사이트를 분석하는 중...");
        try {
          const analyzeRes = await fetch(`/api/brands/${brand.id}/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ websiteUrl: websiteUrl.trim() }),
          });
          if (analyzeRes.ok) {
            const result = await analyzeRes.json();
            const guide = result.style_guide_json || {};
            setAnalysis(guide);

            // 분석된 컬러가 있으면 반영
            if (guide.brand_colors) {
              const extracted: ColorEntry[] = Object.entries(guide.brand_colors).map(
                ([role, hex]) => ({ role, hex: hex as string, usage: role })
              );
              if (extracted.length > 0) setColors(extracted);
            }
            toast.success("웹사이트 분석 완료!");
          }
        } catch {
          toast.warning("웹사이트 분석 실패 — 수동으로 설정해 주세요");
        }
      }

      setStep(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류 발생");
    } finally {
      setLoading(false);
    }
  }

  // === Step 2: 에셋 업로드 ===
  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const files = Array.from(e.target.files).filter((f) => f.type.startsWith("image/"));
    const newLogos = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setLogos((prev) => [...prev, ...newLogos]);
  }

  function removeLogo(index: number) {
    setLogos((prev) => prev.filter((_, i) => i !== index));
  }

  function handleKeyVisualSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const files = Array.from(e.target.files).filter((f) => f.type.startsWith("image/"));
    setKeyVisualFiles((prev) => [...prev, ...files]);
  }

  async function handleStep2Next() {
    if (!brandId) return;
    if (logos.length === 0) {
      toast.error("로고를 최소 1개 업로드하세요");
      return;
    }

    setLoading(true);
    try {
      // 1. 로고 파일 업로드
      const logoUrls: string[] = [];
      for (let i = 0; i < logos.length; i++) {
        const logo = logos[i];
        const formData = new FormData();
        formData.append("file", logo.file);
        formData.append("bucket", "brand-assets");
        formData.append("path", `${brandId}/logos/${Date.now()}_${logo.file.name}`);

        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error("로고 업로드 실패");
        const { url } = await res.json();
        logoUrls.push(url);
        setLogos((prev) =>
          prev.map((l, idx) => (idx === i ? { ...l, url } : l))
        );
      }

      // 2. Claude로 로고 자동 분류
      setLogoAnalyzing(true);
      toast.info("Claude가 로고를 분석하는 중...");

      const analyzeRes = await fetch(`/api/brands/${brandId}/logos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrls }),
      });

      if (analyzeRes.ok) {
        const { analyses } = await analyzeRes.json();
        setLogos((prev) =>
          prev.map((l, i) => ({ ...l, analysis: analyses[i] }))
        );
        toast.success(`${analyses.length}개 로고 분석 완료!`);
      } else {
        toast.warning("로고 분석 실패 — 업로드는 완료됨");
      }
      setLogoAnalyzing(false);

      // 3. 키 비주얼 업로드
      for (const file of keyVisualFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("bucket", "brand-assets");
        formData.append("path", `${brandId}/key_visuals/${Date.now()}_${file.name}`);

        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (res.ok) {
          const { url } = await res.json();
          setKeyVisualUrls((prev) => [...prev, url]);

          await fetch("/api/brands/" + brandId + "/assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileUrl: url,
              fileName: file.name,
              assetCategory: "key_visual",
              metadata: { visual_type: "space" },
            }),
          });
        }
      }

      setStep(2);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "업로드 실패");
    } finally {
      setLoading(false);
      setLogoAnalyzing(false);
    }
  }

  // === Step 3: 컬러 설정 ===
  function updateColor(index: number, hex: string) {
    setColors((prev) => prev.map((c, i) => (i === index ? { ...c, hex } : c)));
  }

  async function handleStep3Next() {
    if (!brandId) return;
    setLoading(true);

    try {
      await fetch("/api/brands/" + brandId + "/colors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colors }),
      });

      toast.success("브랜드 컬러 저장 완료");
      setStep(3);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setLoading(false);
    }
  }

  // === Step 4: 완료 ===
  function handleComplete() {
    router.push(`/brands/${brandId}`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">새 브랜드 등록</h1>
        <p className="text-muted-foreground">단계별로 브랜드 정보를 설정합니다</p>
      </div>

      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i < step
                  ? "bg-primary text-primary-foreground"
                  : i === step
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </div>
            <div className={`text-sm ${i === step ? "font-medium" : "text-muted-foreground"}`}>
              {s.label}
            </div>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1: 기본 정보 */}
      {step === 0 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">브랜드명 *</Label>
              <Input
                id="name"
                placeholder="예: STUDYCORE"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">홈페이지 URL</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://example.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                입력하면 AI가 자동으로 브랜드를 분석하여 컬러, 톤, 스타일을 추출합니다
              </p>
            </div>
            <Button onClick={handleStep1Next} className="w-full" disabled={loading}>
              {loading ? "분석 중..." : "다음 →"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: 에셋 업로드 */}
      {step === 1 && (
        <Card>
          <CardContent className="pt-6 space-y-6">
            {analysis && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                <p className="font-medium">웹사이트 분석 결과</p>
                {analysis.tone && <p>톤: {analysis.tone}</p>}
                {analysis.brand_personality && (
                  <p>성격: {analysis.brand_personality.join(", ")}</p>
                )}
              </div>
            )}

            {/* 로고 업로드 (복수) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label>로고</Label>
                <Badge variant="destructive">필수</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                투명 배경(PNG) 권장. 여러 버전을 업로드하면 AI가 자동으로 용도를 분류합니다.
              </p>

              <label className="block border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors">
                <input type="file" accept="image/*" multiple onChange={handleLogoSelect} className="hidden" />
                <p className="text-sm text-muted-foreground">
                  클릭하여 로고 업로드 (복수 가능)
                </p>
              </label>

              {logos.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {logos.map((logo, i) => (
                    <div key={i} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="w-16 h-16 bg-muted rounded flex items-center justify-center p-1">
                          <img src={logo.preview} alt={`로고 ${i + 1}`} className="max-w-full max-h-full object-contain" />
                        </div>
                        <button onClick={() => removeLogo(i)} className="text-muted-foreground hover:text-destructive text-xs">
                          삭제
                        </button>
                      </div>
                      <p className="text-xs truncate text-muted-foreground">{logo.file.name}</p>

                      {logo.analysis && (
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="secondary" className="text-xs">{logo.analysis.variant}</Badge>
                            {logo.analysis.suitable_for.dark_background && (
                              <Badge variant="outline" className="text-xs">어두운 배경용</Badge>
                            )}
                            {logo.analysis.suitable_for.light_background && (
                              <Badge variant="outline" className="text-xs">밝은 배경용</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{logo.analysis.description}</p>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">품질:</span>
                            {Array.from({ length: 5 }).map((_, s) => (
                              <span key={s} className={`text-xs ${s < (logo.analysis?.quality_score || 0) ? "text-yellow-500" : "text-muted"}`}>★</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 키 비주얼 업로드 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label>키 비주얼</Label>
                <Badge variant="secondary">선택</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                공간 사진, 제품 사진, 시설 사진 등. 없으면 AI가 생성합니다.
              </p>

              <label className="block border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors">
                <input type="file" accept="image/*" multiple onChange={handleKeyVisualSelect} className="hidden" />
                <p className="text-sm text-muted-foreground">클릭하여 이미지 업로드 (복수 가능)</p>
              </label>

              {keyVisualFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {keyVisualFiles.map((f, i) => (
                    <Badge key={i} variant="outline">{f.name}</Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)}>← 이전</Button>
              <Button onClick={handleStep2Next} className="flex-1" disabled={loading || logoAnalyzing || logos.length === 0}>
                {loading || logoAnalyzing ? "업로드 및 분석 중..." : "다음 →"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: 컬러 설정 */}
      {step === 2 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              {analysis?.brand_colors
                ? "웹사이트에서 추출한 컬러입니다. 변경할 수 있습니다."
                : "브랜드 컬러를 설정하세요. 캠페인마다 변경할 수 있습니다."}
            </p>

            <div className="space-y-3">
              {colors.map((color, i) => (
                <div key={i} className="flex items-center gap-3">
                  <input
                    type="color"
                    value={color.hex}
                    onChange={(e) => updateColor(i, e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border-0"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{color.role}</p>
                    <p className="text-xs text-muted-foreground">{color.usage}</p>
                  </div>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{color.hex}</code>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>← 이전</Button>
              <Button onClick={handleStep3Next} className="flex-1" disabled={loading}>
                {loading ? "저장 중..." : "다음 →"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: 확인 */}
      {step === 3 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <h3 className="font-medium">등록 완료!</h3>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">브랜드</p>
                  <p className="font-medium">{name}</p>
                </div>
                {websiteUrl && (
                  <div>
                    <p className="text-muted-foreground">홈페이지</p>
                    <p className="font-medium truncate">{websiteUrl}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">로고</p>
                  <p className="font-medium">
                    {logos.length > 0 ? `✅ ${logos.length}개 (자동 분류 완료)` : "❌ 없음"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">키 비주얼</p>
                  <p className="font-medium">
                    {keyVisualUrls.length > 0
                      ? `✅ ${keyVisualUrls.length}개`
                      : "AI 생성 예정"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-muted-foreground text-sm mb-2">브랜드 컬러</p>
                <div className="flex gap-2">
                  {colors.map((c, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded border"
                      style={{ backgroundColor: c.hex }}
                      title={`${c.role}: ${c.hex}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>← 이전</Button>
              <Button onClick={handleComplete} className="flex-1">
                브랜드 상세로 이동 →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
