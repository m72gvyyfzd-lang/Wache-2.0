import { useState, type FormEvent } from "react";
import { LOTSEN_KATEGORIEN } from "@wache/core";
import type { AktuelleFahrt, Fahrt, LotsenEintrag } from "../data/types";
import { ausDatum, toLocalDateInput } from "../lib/datetime";
import {
  ABRUF_OPTIONEN,
  formatAbrufOption,
  positionAmEnde,
  positionAusParagraph30,
  positionFuenfterMann,
} from "../lib/lotsenOrdnung";
import { FormActions } from "./formShared";
import { Switch } from "./SeestationModals";
import "./JobForm.css";

/** Nur beim Neuanlegen wählbar (siehe lib/lotsenOrdnung.ts) — "" = noch
 *  keine Wahl getroffen, blockiert per "required" das Speichern. */
type NeuePosition = "" | "ende" | "paragraph30" | "fuenfterMann";

const BEMERKUNG_FEST: Partial<Record<NeuePosition, string>> = {
  paragraph30: "Aus §30",
  fuenfterMann: "5. Mann",
};

interface LotseFormProps {
  initial?: LotsenEintrag;
  /** Nur beim Neuanlegen gebraucht (Position "Aus §30"/"5. Mann" werten die
   *  bestehende Liste aus) — beim Bearbeiten nicht nötig, siehe initial. */
  lotsen?: LotsenEintrag[];
  aktuelleFahrt?: AktuelleFahrt;
  /** nachIndex nur beim Neuanlegen gesetzt (Position), siehe lib/lotsenOrdnung.ts. */
  onSubmit: (lotse: LotsenEintrag, nachIndex?: number) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

export function LotseForm({ initial, lotsen, aktuelleFahrt, onSubmit, onDelete, onCancel }: LotseFormProps) {
  const istNeu = !initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [kategorie, setKategorie] = useState(initial?.kategorie ?? "");
  const [fahrt, setFahrt] = useState<Fahrt>(initial?.fahrt ?? "");
  const [position, setPosition] = useState<NeuePosition>("");
  const [abrufStunden, setAbrufStunden] = useState(initial?.abrufStunden !== undefined ? String(initial.abrufStunden) : "");
  const [elbehafen, setElbehafen] = useState(initial?.elbehafen ?? false);
  const [toern2Plus2, setToern2Plus2] = useState(String(initial?.toern2Plus2 ?? 0));
  const [toernWb, setToernWb] = useState(String(initial?.toernWb ?? 0));
  const [toernWr, setToernWr] = useState(String(initial?.toernWr ?? 0));
  const [toernHulo, setToernHulo] = useState(String(initial?.toernHulo ?? 0));
  const [bemerkung, setBemerkung] = useState(initial?.bemerkung ?? "");
  const [par30, setPar30] = useState(initial?.verhinderungParagraph30 ?? false);
  const [ft, setFt] = useState(initial?.verhinderungFt ?? false);
  const [taFt, setTaFt] = useState(initial?.verhinderungTaFt !== undefined);
  const [taFtDatum, setTaFtDatum] = useState(toLocalDateInput(initial?.verhinderungTaFt?.datum));
  const [taFtFahrt, setTaFtFahrt] = useState<AktuelleFahrt>(initial?.verhinderungTaFt?.fahrt ?? "MoFa");

  // Bei "Aus §30"/"5. Mann" ist die Bemerkung fest vorgegeben und gesperrt —
  // nur bei "Am Ende" (oder beim Bearbeiten) bleibt das Feld frei editierbar.
  const bemerkungFest = istNeu ? BEMERKUNG_FEST[position] : undefined;
  const bemerkungAnzeige = bemerkungFest ?? bemerkung;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    let eintragFahrt = fahrt;
    let eintragBemerkung = bemerkung.trim();
    let nachIndex: number | undefined;
    if (istNeu) {
      const daten = lotsen ?? [];
      const aktuelle = aktuelleFahrt ?? "MoFa";
      const ergebnis =
        position === "paragraph30"
          ? positionAusParagraph30(daten, aktuelle)
          : position === "fuenfterMann"
            ? positionFuenfterMann(daten, aktuelle)
            : positionAmEnde();
      eintragFahrt = ergebnis.fahrt;
      nachIndex = ergebnis.nachIndex;
      eintragBemerkung = bemerkungFest ?? eintragBemerkung;
    }
    onSubmit(
      {
        name: name.trim(),
        kategorie,
        fahrt: eintragFahrt,
        abrufStunden: abrufStunden === "" ? undefined : Number(abrufStunden),
        elbehafen,
        toern2Plus2: Number(toern2Plus2) || 0,
        toernWb: Number(toernWb) || 0,
        toernWr: Number(toernWr) || 0,
        toernHulo: Number(toernHulo) || 0,
        bemerkung: eintragBemerkung,
        verhinderungParagraph30: par30 || undefined,
        verhinderungFt: ft || undefined,
        verhinderungTaFt: taFt ? { datum: ausDatum(taFtDatum) ?? new Date(), fahrt: taFtFahrt } : undefined,
      },
      nachIndex,
    );
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
        {istNeu ? (
          <label>
            Position
            <select value={position} onChange={(e) => setPosition(e.target.value as NeuePosition)} required>
              <option value="" disabled>
                – bitte wählen –
              </option>
              <option value="ende">Am Ende</option>
              <option value="paragraph30">Aus §30</option>
              <option value="fuenfterMann">5. Mann</option>
            </select>
          </label>
        ) : (
          <label>
            Fahrt
            <select value={fahrt} onChange={(e) => setFahrt(e.target.value as Fahrt)}>
              <option value="">–</option>
              <option value="MoFa">MoFa</option>
              <option value="MiFa">MiFa</option>
              <option value="AFA">AFA</option>
            </select>
          </label>
        )}
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

      {/* Verhinderung: §30/FT/TA-FT schalten Listenvergabe, Fahrtaufmachung
          und Abteilung Einsatzstation gemeinsam auf "Nein" (siehe
          lib/verhinderung.ts) — unabhängig vom Bemerkungstext darunter,
          der unverändert erhalten bleibt. */}
      <div className="job-form__row">
        <Switch label="§30" checked={par30} onChange={setPar30} />
        <Switch label="FT" checked={ft} onChange={setFt} />
        <Switch label="TA/FT" checked={taFt} onChange={setTaFt} />
      </div>
      {taFt && (
        <div className="job-form__row">
          <label>
            Datum
            <input type="date" value={taFtDatum} onChange={(e) => setTaFtDatum(e.target.value)} required />
          </label>
          <label>
            Fahrt
            <select value={taFtFahrt} onChange={(e) => setTaFtFahrt(e.target.value as AktuelleFahrt)}>
              <option value="MoFa">MoFa</option>
              <option value="MiFa">MiFa</option>
              <option value="AFA">AFA</option>
            </select>
          </label>
        </div>
      )}

      <label>
        Bemerkungen
        <input
          value={bemerkungAnzeige}
          onChange={(e) => setBemerkung(e.target.value)}
          readOnly={bemerkungFest !== undefined}
          title={bemerkungFest !== undefined ? "durch die gewählte Position vorgegeben" : undefined}
        />
      </label>

      <FormActions onDelete={onDelete} onCancel={onCancel} />
    </form>
  );
}
