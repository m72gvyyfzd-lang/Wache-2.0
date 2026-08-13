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
  /** Zusätzliche Klasse am Wurzelelement, z.B. für Breite/Position in
   *  einer Kachelreihe (siehe Settings.tsx) */
  className?: string;
  children: ReactNode;
}

export function Panel({ title, description, count, actionLeft, action, className, children }: PanelProps) {
  // Ohne jeglichen Kopf-Inhalt entfällt die Kopfzeile komplett (z.B.
  // Einsatzstation). Ein leeres Fragment als action zählt als Inhalt —
  // so bleibt der Kopf als Platzhalter erhalten (z.B. Einsatzplanung,
  // deren Abteilen-Button erst bei einer Auswahl erscheint).
  const hatKopf = Boolean(title || description || count || actionLeft || action);
  return (
    <section className={"panel" + (className ? ` ${className}` : "")}>
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
