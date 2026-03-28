import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-theme-text-primary">{title}</h1>
        {description != null && description !== "" && (
          <div className="mt-2 text-theme-text-muted">{description}</div>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
