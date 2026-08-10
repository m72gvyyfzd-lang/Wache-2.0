import { useState, type FormEvent } from "react";
import { LOTSEN_KATEGORIEN } from "@wache/core";
import type { Fahrt, LotsenEintrag } from "../data/types";
import { ABRUF_OPTIONEN, formatAbrufOption } from "../lib/lotsenOrdnung";
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
  const [fahrt, setFahrt] = useState<Fahrt>(initial?.fahrt ?? "");
  const [abrufStunden, setAbrufStunden] = useState(initial?.abrufStunden !== undefined ? String(initial.abrufStunden) : "");
  const [elbehafen, setElbehafen] = useState(initial?.elbehafen ?? false);
  const [toern2Plus2, setToern2Plus2] = useState(String(initial?.toern2Plus2 ?? 0));
  const [toernWb, setToernWb] = useState(String(initial?.toernWb ?? 0));
  const [toernWr, setToernWr] = useState(String(initial?.toernWr ?? 0));
  const [toernHulo, setToernHulo] = useState(String(initial?.toernHulo ?? 0));
  const [bemerkung, setBemerkung] = useState(initial?.bemerkung ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      kategorie,
      fahrt,
      abrufStunden: abrufStunden === "" ? undefined : Number(abrufStunden),
      elbehafen,
      toern2Plus2: Number(toern2Plus2) || 0,
      toernWb: Number(toernWb) || 0,
      toernWr: Number(toernWr) || 0,
      toernHulo: Number(toernHulo) || 0,
      bemerkung: bemerkung.trim(),
    });
  }

  return (
    <form className="job-form" onSubmit={handleSubmit}>
      <div className="job-form__row">
        <label className="job-form__lotse-name">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="job-form__check job-form__eh-minimal">
          <span>
            <input type="checkbox" checked={elbehafen} onChange={(e) => setElbehafen(e.target.checked)} /> EH
          </span>
        </label>
      </div>

      <div className="job-form__row">
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
        <label>
          Fahrt
          <select value={fahrt} onChange={(e) => setFahrt(e.target.value as Fahrt)}>
            <option value="">–</option>
            <option value="MoFa">MoFa</option>
            <option value="MiFa">MiFa</option>
            <option value="AFA">AFA</option>
          </select>
        </label>
        <label>
          Abr.
          <select value={abrufStunden} onChange={(e) => setAbrufStunden(e.target.value)}>
            {ABRUF_OPTIONEN.map((wert) => (
              <option key={wert ?? "leer"} value={wert ?? ""}>
                {formatAbrufOption(wert)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="job-form__row">
        <label>
          2+2
          <input type="number" min={0} max={999} step={1} value={toern2Plus2} onChange={(e) => setToern2Plus2(e.target.value)} />
        </label>
        <label>
          WB
          <input type="number" min={0} max={99} step={1} value={toernWb} onChange={(e) => setToernWb(e.target.value)} />
        </label>
        <label>
          WR
          <input type="number" min={0} max={99} step={1} value={toernWr} onChange={(e) => setToernWr(e.target.value)} />
        </label>
        <label>
          HuLo
          <input type="number" min={0} max={99} step={1} value={toernHulo} onChange={(e) => setToernHulo(e.target.value)} />
        </label>
      </div>

      <label>
        Bemerkungen
        <input value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} />
      </label>

      <FormActions onDelete={onDelete} onCancel={onCancel} />
    </form>
  );
}
