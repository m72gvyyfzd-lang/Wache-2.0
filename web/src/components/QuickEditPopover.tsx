/**
 * Kleines Bearbeitungsfenster direkt an einer Tabellenspalte ("Quick Edit",
 * Einsatzstation): öffnet per Doppelklick auf eine Zelle, liegt waagerecht
 * etwa über der jeweiligen Spalte und senkrecht knapp unter der
 * Seitenüberschrift — nicht über der Zeile selbst, damit die Liste beim
 * Bearbeiten sichtbar bleibt und die Position beim Scrollen nicht wandert.
 *
 * Bewusst KEIN Modal: kein Abdunkeln, keine Ja/Nein-Rückfrage. Ein Klick
 * daneben (oder Escape) schließt ohne Änderung — das Übernehmen erledigen
 * die Felder selbst (siehe Einsatzstation.tsx).
 */
import { useEffect, useRef, type ReactNode } from "react";
import "./QuickEditPopover.css";

interface QuickEditPopoverProps {
  /** Spaltenname als Beschriftung über dem Feld */
  titel: string;
  /** Ankerpunkte in Viewport-Koordinaten (position: fixed) */
  top: number;
  left: number;
  onClose: () => void;
  children: ReactNode;
}

/** Randabstand, damit das Fenster an schmalen Spalten am Bildschirmrand
 *  nicht aus dem sichtbaren Bereich rutscht. */
const RAND_PX = 12;
const BREITE_PX = 230;

export function QuickEditPopover({ titel, top, left, onClose, children }: QuickEditPopoverProps) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Fokus auf das erste Eingabeelement, damit direkt getippt bzw. gewählt
  // werden kann, ohne noch einmal zu tippen.
  useEffect(() => {
    box.current?.querySelector<HTMLElement>("input, select")?.focus();
  }, []);

  const maxLinks = Math.max(RAND_PX, window.innerWidth - BREITE_PX - RAND_PX);
  const begrenztesLinks = Math.min(Math.max(left, RAND_PX), maxLinks);

  return (
    // Unsichtbare Fangfläche über der ganzen Seite: fängt den Klick daneben
    // ab (schließt ohne Änderung), ohne die Seite abzudunkeln.
    <div className="quick-edit__fang" onMouseDown={onClose}>
      <div
        ref={box}
        className="quick-edit"
        style={{ top, left: begrenztesLinks, width: BREITE_PX }}
        role="dialog"
        aria-label={titel}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="quick-edit__titel">{titel}</div>
        {children}
      </div>
    </div>
  );
}
