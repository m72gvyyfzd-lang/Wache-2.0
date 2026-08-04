import { useState } from "react";
import { fromLocalInput, toLocalInput } from "../lib/datetime";
import "./JobForm.css";
import "./AbtZeitModal.css";

interface AnStationModalProps {
  initial: Date | undefined;
  onUebernehmen: (wert: Date | undefined) => void;
  onAbbrechen: () => void;
}

export function AnStationModal({ initial, onUebernehmen, onAbbrechen }: AnStationModalProps) {
  const [eingabe, setEingabe] = useState(toLocalInput(initial));

  function handleOk() {
    onUebernehmen(eingabe === "" ? initial : fromLocalInput(eingabe));
  }

  return (
    <div className="job-form">
      <div className="job-form__row">
        <label className="abtzeit-feld">
          An Stn.:
          <input type="datetime-local" value={eingabe} onChange={(e) => setEingabe(e.target.value)} />
        </label>
      </div>

      <div className="job-form__actions">
        <button type="button" className="btn btn--ghost" onClick={onAbbrechen}>
          Abbrechen
        </button>
        <span className="job-form__spacer" />
        <button type="button" className="btn btn--accent" onClick={handleOk}>
          OK
        </button>
      </div>
    </div>
  );
}
