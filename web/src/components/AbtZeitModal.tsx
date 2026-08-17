import { useState } from "react";
import { fromLocalInput, toLocalInput } from "../lib/datetime";
import "./JobForm.css";
import "./AbtZeitModal.css";

interface AbtZeitModalProps {
  initial: Date | undefined;
  onUebernehmen: (wert: Date | undefined) => void;
  onAbbrechen: () => void;
}

export function AbtZeitModal({ initial, onUebernehmen, onAbbrechen }: AbtZeitModalProps) {
  const [eingabe, setEingabe] = useState(toLocalInput(initial));

  function handleUebernehmen() {
    // Leeres Feld ist eine bewusste Eingabe (iOS-Zeitrad: "Zurücksetzen"):
    // die manuelle Abt.Zeit wird gelöscht, es gilt wieder die berechnete.
    onUebernehmen(eingabe === "" ? undefined : fromLocalInput(eingabe));
  }

  return (
    <div className="job-form">
      <div className="job-form__row">
        <label className="abtzeit-feld">
          Abt. Zeit:
          <input type="datetime-local" value={eingabe} onChange={(e) => setEingabe(e.target.value)} />
        </label>
      </div>

      <div className="job-form__actions">
        <button type="button" className="btn btn--ghost" onClick={onAbbrechen}>
          Abbrechen
        </button>
        <span className="job-form__spacer" />
        <button type="button" className="btn btn--accent" onClick={handleUebernehmen}>
          Übernehmen
        </button>
      </div>
    </div>
  );
}
