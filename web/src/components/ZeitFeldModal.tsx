/** Quick-Edit für eine einzelne Zeitspalte (Tafel Brb: HH/FkW/Stade,
 *  Holt./Ticker/Kuden, man. Abt.Zeit/Abt. Zeit) — Datum+Uhrzeit getrennt,
 *  wie in den übrigen Formularen der App, mit dem aktuellen Wert vorbelegt. */
import { useState } from "react";
import { ausDatumUndZeit, toLocalDateInput, toLocalTimeInput } from "../lib/datetime";
import { handleZeitMitPrefill } from "./formShared";
import "./JobForm.css";

interface ZeitFeldModalProps {
  label: string;
  initial: Date | undefined;
  onUebernehmen: (wert: Date | undefined) => void;
  onAbbrechen: () => void;
}

export function ZeitFeldModal({ label, initial, onUebernehmen, onAbbrechen }: ZeitFeldModalProps) {
  const [datum, setDatum] = useState(toLocalDateInput(initial));
  const [zeit, setZeit] = useState(toLocalTimeInput(initial));

  return (
    <div className="job-form">
      <div className="job-form__row">
        <label>
          Datum
          <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
        </label>
        <label>
          {label}
          <input
            type="time"
            value={zeit}
            onChange={(e) => handleZeitMitPrefill(e.target.value, datum, setZeit, setDatum)}
          />
        </label>
      </div>
      <div className="job-form__actions">
        <button type="button" className="btn btn--ghost" onClick={onAbbrechen}>
          Abbrechen
        </button>
        <span className="job-form__spacer" />
        <button type="button" className="btn btn--accent" onClick={() => onUebernehmen(ausDatumUndZeit(datum, zeit))}>
          Übernehmen
        </button>
      </div>
    </div>
  );
}
