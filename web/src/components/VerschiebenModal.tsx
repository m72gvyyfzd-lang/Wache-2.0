/**
 * "Verschieben" (Einsatzstation): der markierte Lotse wird hinter einen
 * anderen einsortiert und übernimmt dessen Fahrt-Zuweisung (siehe
 * lib/lotsenOrdnung.ts::verschiebeHinter). Die Überschrift des Fensters
 * trägt der Aufrufer bei — dort steht der Name des gewählten Lotsen.
 */
import { useState } from "react";
import "./JobForm.css";

interface VerschiebenModalProps {
  /** alle übrigen Lotsen als mögliche Einfüge-Ziele (Listenreihenfolge) */
  ziele: { index: number; name: string }[];
  onVerschieben: (zielIndex: number) => void;
  onAbbrechen: () => void;
}

export function VerschiebenModal({ ziele, onVerschieben, onAbbrechen }: VerschiebenModalProps) {
  const [ziel, setZiel] = useState("");

  return (
    <div className="job-form">
      <div className="job-form__row">
        <label className="job-form__grow2">
          Einfügen hinter…
          <select value={ziel} onChange={(e) => setZiel(e.target.value)}>
            <option value="">–</option>
            {ziele.map((eintrag) => (
              <option key={eintrag.index} value={eintrag.index}>
                {eintrag.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="job-form__actions">
        <button type="button" className="btn btn--ghost" onClick={onAbbrechen}>
          Abbrechen
        </button>
        <span className="job-form__spacer" />
        <button type="button" className="btn btn--accent" disabled={ziel === ""} onClick={() => onVerschieben(Number(ziel))}>
          OK
        </button>
      </div>
    </div>
  );
}
