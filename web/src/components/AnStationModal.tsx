import { useState } from "react";
import { toLocalTimeInput } from "../lib/datetime";
import "./JobForm.css";
import "./AbtZeitModal.css";

interface AnStationModalProps {
  initial: Date | undefined;
  onUebernehmen: (wert: Date | undefined) => void;
  onAbbrechen: () => void;
}

export function AnStationModal({ initial, onUebernehmen, onAbbrechen }: AnStationModalProps) {
  // Datum bleibt unverändert (nur die Uhrzeit ist editierbar) — ohne
  // bisherigen Wert wird der heutige Tag als Basis verwendet.
  const [basis] = useState(() => initial ?? new Date());
  const [zeit, setZeit] = useState(toLocalTimeInput(initial));

  function handleOk() {
    // Leeres Feld ist eine bewusste Eingabe (iOS-Zeitrad: "Zurücksetzen"):
    // die An-Stn.-Zeit wird gelöscht.
    if (zeit === "") {
      onUebernehmen(undefined);
      return;
    }
    const [stunden, minuten] = zeit.split(":").map(Number);
    const ergebnis = new Date(basis);
    ergebnis.setHours(stunden, minuten, 0, 0);
    onUebernehmen(ergebnis);
  }

  return (
    <div className="job-form">
      <div className="job-form__row">
        <label className="abtzeit-feld">
          An Stn.:
          <input type="time" value={zeit} onChange={(e) => setZeit(e.target.value)} />
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
