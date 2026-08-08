import type { ReactNode } from "react";
import "./Panel.css";

interface PanelProps {
  title?: string;
  description?: string;
  count?: string;
  /** Action-Element links (an der Stelle des Titels) */
  actionLeft?: ReactNode;
  /** Action-Element rechts (Standardposition, wie bisher) */
  action?: ReactNode;
  children: ReactNode;
}

export function Panel({ title, description, count, actionLeft, action, children }: PanelProps) {
  // Ohne jeglichen Kopf-Inhalt entfällt die Kopfzeile komplett (z.B.
  // Einsatzstation). Ein leeres Fragment als action zählt als Inhalt —
  // so bleibt der Kopf als Platzhalter erhalten (z.B. Einsatzplanung,
  // deren Abteilen-Button erst bei einer Auswahl erscheint).
  const hatKopf = Boolean(title || description || count || actionLeft || action);
  return (
    <section className="panel">
      {hatKopf && (
        <div className="panel__head">
          {actionLeft}
          <div>
            {title && <h2>{title}</h2>}
            {description && <div className="panel__desc">{description}</div>}
          </div>
          <div className="panel__head-right">
            {count && <div className="panel__count">{count}</div>}
            {action}
          </div>
        </div>
      )}
      <div className="panel__body">{children}</div>
    </section>
  );
}
