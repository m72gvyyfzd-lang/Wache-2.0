import { useState } from "react";
import "../components/JobForm.css";
import "./LotsenAnzahlModal.css";

interface LotsenAnzahlModalProps {
  initial: number;
  onUebernehmen: (wert: number) => void;
  onAbbrechen: () => void;
}

export function LotsenAnzahlModal({ initial, onUebernehmen, onAbbrechen }: LotsenAnzahlModalProps) {
  const [eingabe, setEingabe] = useState(String(initial));

  function handleChange(wert: string) {
    setEingabe(wert.replace(/\D/g, "").slice(0, 2));
  }

  function handleUebernehmen() {
    const zahl = eingabe === "" ? initial : Number(eingabe);
    onUebernehmen(Math.max(1, zahl));
  }

  return (
    <div className="job-form">
      <div className="job-form__row">
        <label className="lotsen-anzahl-feld">
          Anzahl Lotsen:
          <input type="text" inputMode="numeric" value={eingabe} onChange={(e) => handleChange(e.target.value)} />
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
