import type { ReactNode } from "react";
import "./Panel.css";

interface PanelProps {
  title: string;
  description?: string;
  count?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function Panel({ title, description, count, action, children }: PanelProps) {
  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <h2>{title}</h2>
          {description && <div className="panel__desc">{description}</div>}
        </div>
        <div className="panel__head-right">
          {count && <div className="panel__count">{count}</div>}
          {action}
        </div>
      </div>
      <div className="panel__body">{children}</div>
    </section>
  );
}
