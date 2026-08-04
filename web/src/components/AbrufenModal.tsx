import "./JobForm.css";
import "./AbrufenModal.css";

interface AbrufenModalProps {
  abgerufen: boolean;
  onToggle: () => void;
  onAbbrechen: () => void;
}

export function AbrufenModal({ abgerufen, onToggle, onAbbrechen }: AbrufenModalProps) {
  return (
    <div className="job-form abrufen-modal__actions">
      <button type="button" className="btn btn--accent" onClick={onToggle}>
        {abgerufen ? "Abruf zurück" : "Lotsen abrufen"}
      </button>
      <button type="button" className="btn btn--ghost" onClick={onAbbrechen}>
        Abbrechen
      </button>
    </div>
  );
}
