import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Supabase Storage 동적 URL을 광범위하게 사용하는 내부 도구라 LCP 영향이 제한적이다.
      // next/image로 전환하려면 remotePatterns 설정 + width/height 강제 필요. 우선 완화.
      "@next/next/no-img-element": "off",

      // service role 클라이언트는 RLS를 우회하므로 새 파일에서 무분별하게 import하지 못하도록
      // 막는다. 허용되는 경로(내부 파이프라인·배치·시스템 테이블)는 별도 override로 푼다.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/admin",
              message:
                "service role 클라이언트는 RLS를 우회합니다. 사용자 요청에서는 @/lib/supabase/server 의 createClient() 를 쓰고, 시스템 전용 경로에서만 admin을 허용하는 override 목록에 추가하세요.",
            },
          ],
        },
      ],
    },
  },
  // service role 사용이 정당한 경로들: 내부 파이프라인·배치·시스템 테이블
  // ([brandId]와 같은 동적 라우트 폴더는 glob 대괄호로 처리되므로 **/ 패턴으로 매칭한다)
  {
    files: [
      "src/lib/usage/record.ts",
      "src/lib/learning/aggregate-preferences.ts",
      "src/app/api/**/embed-backfill/route.ts",
      "src/lib/supabase/admin.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
