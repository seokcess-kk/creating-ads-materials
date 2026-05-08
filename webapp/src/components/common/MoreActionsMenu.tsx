"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { MoreHorizontalIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MoreActionsMenuProps {
  children: ReactNode;
  /** 트리거 버튼 ARIA 라벨 — 페이지 컨텍스트별로 다르게 ("캠페인 더보기" 등) */
  ariaLabel?: string;
  align?: "start" | "end";
  triggerClassName?: string;
}

/**
 * 우측 정렬 드롭다운 메뉴. 트리거(⋯) 클릭 시 children을 패널로 노출.
 * 외부 클릭 / Escape로 닫힘. 자식 MenuItem 클릭 시 자동으로 닫힘.
 */
export function MoreActionsMenu({
  children,
  ariaLabel = "더보기",
  align = "end",
  triggerClassName,
}: MoreActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  // 자식 MenuItem이 클릭되면 메뉴 자동 닫기 (별도 onItemClick 콜백 없이도 동작)
  const enhanced = Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    type WithClickProps = {
      onClick?: (e: React.MouseEvent) => void;
      [key: string]: unknown;
    };
    const el = child as ReactElement<WithClickProps>;
    const original = el.props.onClick;
    return cloneElement<WithClickProps>(el, {
      onClick: (e: React.MouseEvent) => {
        original?.(e);
        if (!e.defaultPrevented) setOpen(false);
      },
    });
  });

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          triggerClassName,
        )}
      >
        <MoreHorizontalIcon className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute top-full z-20 mt-1 min-w-[160px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {enhanced}
        </div>
      )}
    </div>
  );
}

interface MenuItemProps {
  onClick?: (e: React.MouseEvent) => void;
  destructive?: boolean;
  disabled?: boolean;
  children: ReactNode;
}

export function MenuItem({
  onClick,
  destructive,
  disabled,
  children,
}: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "block w-full rounded-sm px-2 py-1.5 text-left text-sm transition-colors",
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "hover:bg-muted",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {children}
    </button>
  );
}
