import type { ReactNode } from "react";
import "./PageHeader.css";

interface PageHeaderProps {
  title: string;
  description?: string;
  centered?: boolean;
  /** Action-Element (z.B. Button) rechtsbündig auf Höhe der Überschrift */
  action?: ReactNode;
}

export function PageHeader({ title, description, centered, action }: PageHeaderProps) {
  return (
    <header className={"page-header" + (centered ? " page-header--centered" : "")}>
      <h1>{title}</h1>
      {description && <p className="page-header__desc">{description}</p>}
      {action && <div className="page-header__action">{action}</div>}
    </header>
  );
}
