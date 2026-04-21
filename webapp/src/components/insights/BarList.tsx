import { Badge } from "@/components/ui/badge";

interface BarListProps {
  title: string;
  subtitle?: string;
  items: Array<{ key: string; count: number }>;
  emptyLabel?: string;
  color?: "primary" | "accent";
}

export function BarList({ title, subtitle, items, emptyLabel, color = "primary" }: BarListProps) {
  const max = Math.max(...items.map((i) => i.count), 1);
  const barColor = color === "accent" ? "bg-amber-500/70" : "bg-primary";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold">{title}</p>
        {subtitle && <Badge variant="outline" className="text-[10px]">{subtitle}</Badge>}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel ?? "데이터 없음"}</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={item.key} className="flex items-center gap-2 text-xs">
              <span className="w-28 truncate" title={item.key}>
                {item.key}
              </span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor}`}
                  style={{ width: `${(item.count / max) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right tabular-nums">{item.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
