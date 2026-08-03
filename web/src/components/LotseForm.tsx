import { useState, type FormEvent } from "react";
import { LOTSEN_KATEGORIEN } from "@wache/core";
import type { LotsenEintrag } from "../data/types";
import { FormActions } from "./formShared";
import "./JobForm.css";

interface LotseFormProps {
  initial?: LotsenEintrag;
  onSubmit: (lotse: LotsenEintrag) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

export function LotseForm({ initial, onSubmit, onDelete, onCancel }: LotseFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kategorie, setKategorie] = useState(initial?.kategorie ?? "");
  const [positionHaupt, setPositionHaupt] = useState(initial?.positionHaupt ?? "");
  const [positionCuxhavenBoert, setPositionCuxhavenBoert] = useState(initial?.positionCuxhavenBoert ?? "");
  const [positionBrunsbuettelBoert, setPositionBrunsbuettelBoert] = useState(initial?.positionBrunsbuettelBoert ?? "");
  const [bem, setBem] = useState(initial?.bem ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      kategorie,
      positionHaupt: positionHaupt.trim(),
      positionCuxhavenBoert: positionCuxhavenBoert.trim(),
      positionBrunsbuettelBoert: positionBrunsbuettelBoert.trim(),
      bem: bem.trim(),
    });
  }

  return (
    <form className="job-form" onSubmit={handleSubmit}>
      <div className="job-form__row">
        <label className="job-form__grow3">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>
        <label>
          Kat.
          <select value={kategorie} onChange={(e) => setKategorie(e.target.value)}>
            {LOTSEN_KATEGORIEN.map((kat) => (
              <option key={kat} value={kat}>
                {kat === "" ? "Volllotse" : kat}
              </option>
            ))}
          </select>
        </label>
      </div>

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

      <FormActions onDelete={onDelete} onCancel={onCancel} />
    </form>
  );
}
