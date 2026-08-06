import "./JobForm.css";

interface FrageModalProps {
  frage: string;
  /** Auffälliger Warnhinweis über der Frage (z.B. "Kat. des Lotsen zu klein") */
  warnung?: string;
  /** Frage (und Warnung) zentriert darstellen */
  zentriert?: boolean;
  onJa: () => void;
  onNein: () => void;
}

/** Einfache Ja/Nein-Rückfrage (Abteilen / Abteilung rückgängig). */
export function FrageModal({ frage, warnung, zentriert, onJa, onNein }: FrageModalProps) {
  return (
    <div className={"job-form" + (zentriert ? " frage-modal--zentriert" : "")}>
      {warnung && <p className="frage-modal__warnung">⚠️ {warnung} ⚠️</p>}
      <p className="frage-modal__text">{frage}</p>
      <div className="job-form__actions">
        <button type="button" className="btn btn--ghost" onClick={onNein}>
          Nein
        </button>
        <span className="job-form__spacer" />
        <button type="button" className="btn btn--accent" onClick={onJa}>
          Ja
        </button>
      </div>
    </div>
  );
}
