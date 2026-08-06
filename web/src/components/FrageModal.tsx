import "./JobForm.css";

interface FrageModalProps {
  frage: string;
  onJa: () => void;
  onNein: () => void;
}

/** Einfache Ja/Nein-Rückfrage (Abteilen / Abteilung rückgängig). */
export function FrageModal({ frage, onJa, onNein }: FrageModalProps) {
  return (
    <div className="job-form">
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
