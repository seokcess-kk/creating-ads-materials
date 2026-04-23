import type { ReactNode } from "react";

export type PageContainerSize = "default" | "narrow" | "slim";

const SIZE_CLASS: Record<PageContainerSize, string> = {
  default: "max-w-5xl",
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
