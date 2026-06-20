"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const MODES = [
  { value: "light", label: "라이트", Icon: SunIcon },
  { value: "system", label: "시스템", Icon: MonitorIcon },
  { value: "dark", label: "다크", Icon: MoonIcon },
] as const;

const subscribe = () => () => {};
const getServerSnapshot = () => false;
const getClientSnapshot = () => true;

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const active = mounted ? (theme ?? "system") : "system";

  return (
    <div
      role="radiogroup"
      aria-label="테마 선택"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border bg-muted/40 p-0.5",
        className,
      )}
    >
      {MODES.map(({ value, label, Icon }) => {
        const isActive = active === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-sm transition-colors",
              isActive
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
