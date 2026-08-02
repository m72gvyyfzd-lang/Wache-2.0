import { useState, type FormEvent } from "react";
import type { LotsenEintrag } from "../data/types";
import "./JobForm.css";

interface LotseFormProps {
  initial?: LotsenEintrag;
  onSubmit: (lotse: LotsenEintrag) => void;
  onCancel: () => void;
}

export function LotseForm({ initial, onSubmit, onCancel }: LotseFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [positionHaupt, setPositionHaupt] = useState(initial?.positionHaupt ?? "");
  const [positionCuxhavenBoert, setPositionCuxhavenBoert] = useState(initial?.positionCuxhavenBoert ?? "");
  const [positionBrunsbuettelBoert, setPositionBrunsbuettelBoert] = useState(initial?.positionBrunsbuettelBoert ?? "");
  const [bem, setBem] = useState(initial?.bem ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      positionHaupt: positionHaupt.trim(),
      positionCuxhavenBoert: positionCuxhavenBoert.trim(),
      positionBrunsbuettelBoert: positionBrunsbuettelBoert.trim(),
      bem: bem.trim(),
    });
  }

  return (
    <form className="job-form" onSubmit={handleSubmit}>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </label>

      <div className="job-form__row job-form__row--3">
        <label>
          Tafel (Haupt)
          <input value={positionHaupt} onChange={(e) => setPositionHaupt(e.target.value)} />
        </label>
        <label>
          Cuxhaven Bört
          <input value={positionCuxhavenBoert} onChange={(e) => setPositionCuxhavenBoert(e.target.value)} />
        </label>
        <label>
          Brunsbüttel Bört
          <input value={positionBrunsbuettelBoert} onChange={(e) => setPositionBrunsbuettelBoert(e.target.value)} />
        </label>
      </div>

      <label>
        Bemerkung
        <input value={bem} onChange={(e) => setBem(e.target.value)} />
      </label>

      <div className="job-form__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Abbrechen
        </button>
        <button type="submit" className="btn btn--accent">
          Speichern
        </button>
      </div>
    </form>
  );
}
