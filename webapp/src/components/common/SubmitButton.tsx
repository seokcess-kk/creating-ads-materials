"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/**
 * 서버 액션 폼 전용 제출 버튼. useFormStatus로 제출 진행 상태를 읽어
 * 스피너 + 자동 비활성화를 처리한다(클라이언트 상태 관리 불필요).
 */
export function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className={className} pending={pending}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
