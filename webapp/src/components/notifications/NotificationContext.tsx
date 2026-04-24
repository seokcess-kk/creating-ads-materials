"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type OpKind =
  | "strategy"
  | "copy"
  | "visual"
  | "retouch"
  | "compose"
  | "brand_analyze"
  | "website_analyze"
  | "fork_channel"
  | "ship";

export interface OpStep {
  label: string;
  /** 이 step까지 누적되는 예상 초 (0부터 시작, 마지막은 전체 예상) */
  atSec: number;
}

export interface NotificationOp {
  id: string;
  kind: OpKind;
  title: string;
  subtitle?: string;
  startedAt: number;
  estimatedSeconds: number;
  steps?: OpStep[];
  status: "running" | "completed" | "failed";
  completedAt?: number;
  errorMsg?: string;
  /** 완료 배너 클릭 시 이동 URL */
  href?: string;
  /** 완료 시 강조 표시 여부 (false면 조용히 사라짐) */
  celebrate?: boolean;
}

interface NotificationContextValue {
  ops: NotificationOp[];
  completed: NotificationOp[];
  dismissed: Set<string>;
  startOp: (
    input: Omit<NotificationOp, "id" | "startedAt" | "status"> & { id?: string },
  ) => string;
  completeOp: (id: string, result?: { href?: string; subtitle?: string }) => void;
  failOp: (id: string, errorMsg: string) => void;
  dismissCompleted: (id: string) => void;
  clearAll: () => void;
  notificationsEnabled: boolean;
  requestBrowserPermission: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const BROWSER_NOTIF_KEY = "ad-studio-browser-notifications";

function tryBrowserNotify(op: NotificationOp) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const enabled = localStorage.getItem(BROWSER_NOTIF_KEY) === "on";
  if (!enabled) return;
  try {
    const n = new Notification(
      op.status === "completed"
        ? `✅ ${op.title} 완료`
        : `❌ ${op.title} 실패`,
      {
        body: op.status === "completed" ? op.subtitle ?? "작업이 완료됐습니다" : op.errorMsg ?? "오류",
        tag: op.id,
        icon: "/favicon.ico",
      },
    );
    n.onclick = () => {
      window.focus();
      if (op.href) window.location.href = op.href;
      n.close();
    };
    // 5초 후 자동 닫기
    setTimeout(() => n.close(), 5000);
  } catch {
    // ignore
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [ops, setOps] = useState<NotificationOp[]>([]);
  const [completed, setCompleted] = useState<NotificationOp[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const opsRef = useRef(ops);
  useEffect(() => {
    opsRef.current = ops;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const enabled =
      localStorage.getItem(BROWSER_NOTIF_KEY) === "on" &&
      Notification.permission === "granted";
    // 마운트 시 1회 브라우저 API를 읽어 동기화. SSR-safe한 초기값(false) + 마운트 후 보정 패턴.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotificationsEnabled(enabled);
  }, []);

  const startOp = useCallback<NotificationContextValue["startOp"]>((input) => {
    const id = input.id ?? globalThis.crypto.randomUUID();
    const op: NotificationOp = {
      id,
      kind: input.kind,
      title: input.title,
      subtitle: input.subtitle,
      startedAt: Date.now(),
      estimatedSeconds: input.estimatedSeconds,
      steps: input.steps,
      href: input.href,
      celebrate: input.celebrate ?? true,
      status: "running",
    };
    setOps((prev) => {
      // 같은 id가 있으면 교체
      const filtered = prev.filter((o) => o.id !== id);
      return [...filtered, op];
    });
    return id;
  }, []);

  const completeOp = useCallback<NotificationContextValue["completeOp"]>(
    (id, result) => {
      const op = opsRef.current.find((o) => o.id === id);
      if (!op) return;
      const finished: NotificationOp = {
        ...op,
        status: "completed",
        completedAt: Date.now(),
        href: result?.href ?? op.href,
        subtitle: result?.subtitle ?? op.subtitle,
      };
      setOps((prev) => prev.filter((o) => o.id !== id));
      setCompleted((c) =>
        [finished, ...c.filter((x) => x.id !== id)].slice(0, 10),
      );
      tryBrowserNotify(finished);
    },
    [],
  );

  const failOp = useCallback<NotificationContextValue["failOp"]>(
    (id, errorMsg) => {
      const op = opsRef.current.find((o) => o.id === id);
      if (!op) return;
      const finished: NotificationOp = {
        ...op,
        status: "failed",
        completedAt: Date.now(),
        errorMsg,
      };
      setOps((prev) => prev.filter((o) => o.id !== id));
      setCompleted((c) =>
        [finished, ...c.filter((x) => x.id !== id)].slice(0, 10),
      );
      tryBrowserNotify(finished);
    },
    [],
  );

  const dismissCompleted = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setCompleted([]);
    setDismissed(new Set());
  }, []);

  const requestBrowserPermission = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    let perm = Notification.permission;
    if (perm === "default") {
      perm = await Notification.requestPermission();
    }
    if (perm === "granted") {
      localStorage.setItem(BROWSER_NOTIF_KEY, "on");
      setNotificationsEnabled(true);
    } else {
      localStorage.setItem(BROWSER_NOTIF_KEY, "off");
      setNotificationsEnabled(false);
    }
  }, []);

  const value = useMemo<NotificationContextValue>(
    () => ({
      ops,
      completed,
      dismissed,
      startOp,
      completeOp,
      failOp,
      dismissCompleted,
      clearAll,
      notificationsEnabled,
      requestBrowserPermission,
    }),
    [
      ops,
      completed,
      dismissed,
      startOp,
      completeOp,
      failOp,
      dismissCompleted,
      clearAll,
      notificationsEnabled,
      requestBrowserPermission,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be inside NotificationProvider");
  return ctx;
}
