import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: "card" | "inline";
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "card",
}: EmptyStateProps) {
  const content = (
    <div className="text-center space-y-3 py-8">
      {icon && (
        <div className="text-4xl text-muted-foreground/60 mx-auto leading-none">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex justify-center pt-2">{action}</div>}
    </div>
  );

  if (variant === "inline") return content;
  return (
    <Card className="bg-muted/20 border-dashed">
      <CardContent className="py-4">{content}</CardContent>
    </Card>
  );
}
