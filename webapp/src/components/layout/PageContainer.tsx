import type { ReactNode } from "react";

export type PageContainerSize = "default" | "narrow" | "slim" | "wide";

const SIZE_CLASS: Record<PageContainerSize, string> = {
  // default/wide: ShellChrome의 max-w-[96rem]에 맞춤 (1536px)
  default: "max-w-none",
  wide: "max-w-none",
  // form 페이지는 좁은 폭 유지 (가독성·집중)
  narrow: "max-w-3xl",
  slim: "max-w-xl",
};

interface PageContainerProps {
  size?: PageContainerSize;
  className?: string;
  children: ReactNode;
}

export function PageContainer({
  size = "default",
  className = "",
  children,
}: PageContainerProps) {
  return (
    <div className={`${SIZE_CLASS[size]} mx-auto space-y-6 ${className}`}>
      {children}
    </div>
  );
}
