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
}

export function Modal({ title, onClose, children, maxWidth, titelZentriert }: ModalProps) {
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
          <button type="button" className="modal__close" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
