import "./JobForm.css";

interface AbrufenModalProps {
  abgerufen: boolean;
  onToggle: () => void;
  onAbbrechen: () => void;
}

export function AbrufenModal({ abgerufen, onToggle, onAbbrechen }: AbrufenModalProps) {
  return (
    <div className="job-form">
      <div className="job-form__actions">
        <button type="button" className="btn btn--ghost" onClick={onAbbrechen}>
          Abbrechen
        </button>
        <span className="job-form__spacer" />
        <button type="button" className="btn btn--accent" onClick={onToggle}>
          {abgerufen ? "Abruf zurück" : "Lotsen abrufen"}
        </button>
      </div>
    </div>
  );
}
