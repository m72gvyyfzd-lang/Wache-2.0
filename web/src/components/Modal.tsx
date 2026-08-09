import { useEffect, type ReactNode } from "react";
import "./Modal.css";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** überschreibt die Standard-max-width (560px) aus Modal.css, z.B. für
   *  schmalere Formulare */
  maxWidth?: string;
  /** Überschrift zentrieren (z.B. Abteilen-Fragefenster) */
  titelZentriert?: boolean;
  /** Zusatzelement auf Ebene der Überschrift, rechtsbündig vor dem
   *  Schließen-Button (z.B. Kat.-Dropdown im Seestation-Bearbeitungsfenster) */
  headerExtra?: ReactNode;
}

export function Modal({ title, onClose, children, maxWidth, titelZentriert, headerExtra }: ModalProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={"modal" + (titelZentriert ? " modal--titel-zentriert" : "")}
        style={maxWidth ? { maxWidth } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h2>{title}</h2>
          <div className="modal__head-right">
            {headerExtra}
            <button type="button" className="modal__close" onClick={onClose} aria-label="Schließen">
              ×
            </button>
          </div>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
