import { InboxIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      <div className="bg-muted mb-4 rounded-full p-4">
        {icon || <InboxIcon className="text-muted-foreground h-8 w-8" />}
      </div>
      <h3 className="mb-1 text-lg font-semibold">{title}</h3>
      {description && <p className="text-muted-foreground mb-4 max-w-sm text-sm">{description}</p>}
      {action}
    </div>
  );
}
