import { useState, type FormEvent } from "react";
import { LOTSEN_KATEGORIEN } from "@wache/core";
import type { SeeSchiff, SeestationLotse } from "../data/types";
import { fromLocalInput, toLocalInput, toLocalTimeInput } from "../lib/datetime";
import { SchiffKatSelect } from "./formShared";
import "./JobForm.css";
import "./SeestationModals.css";

/** Schiebeschalter im iOS-Stil (Checkbox mit Switch-Optik). */
function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (wert: boolean) => void }) {
  return (
    <label className="seestation-switch">
      <span className="seestation-switch__label">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="seestation-switch__slider" aria-hidden="true" />
    </label>
  );
}

interface SeeSchiffNeuModalProps {
  onEinfuegen: (schiff: Omit<SeeSchiff, "id">) => void;
  onAbbrechen: () => void;
}

/** "+ Neues Schiff": nur die Grunddaten — die Switches kommen erst im
 *  Bearbeitungsfenster. */
export function SeeSchiffNeuModal({ onEinfuegen, onAbbrechen }: SeeSchiffNeuModalProps) {
  const [schiffsname, setSchiffsname] = useState("");
  const [eta, setEta] = useState("");
  const [kategorie, setKategorie] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const etaDatum = fromLocalInput(eta);
    if (!etaDatum) return;
    onEinfuegen({ schiffsname: schiffsname.trim().toUpperCase(), eta: etaDatum, kategorie: kategorie || undefined });
  }

  return (
    <form className="job-form" onSubmit={handleSubmit}>
      <div className="job-form__row">
        <label className="job-form__grow3">
          Schiffsname
          <input value={schiffsname} onChange={(e) => setSchiffsname(e.target.value.toUpperCase())} required />
        </label>
      </div>
      <div className="job-form__row">
        <label>
          ETA
          <input type="datetime-local" value={eta} onChange={(e) => setEta(e.target.value)} required />
        </label>
        <SchiffKatSelect value={kategorie} onChange={setKategorie} />
      </div>
      <div className="job-form__actions">
        <button type="button" className="btn btn--ghost" onClick={onAbbrechen}>
          Abbrechen
        </button>
        <span className="job-form__spacer" />
        <button type="submit" className="btn btn--accent">
          Einfügen
        </button>
      </div>
    </form>
  );
}

interface SeeSchiffEditModalProps {
  schiff: SeeSchiff;
  onOk: (schiff: SeeSchiff) => void;
  onAbbrechen: () => void;
}

/** Doppelklick auf ein Schiff: ETA + Switches bearbeiten. */
export function SeeSchiffEditModal({ schiff, onOk, onAbbrechen }: SeeSchiffEditModalProps) {
  const [eta, setEta] = useState(toLocalInput(schiff.eta));
  const [angemeldet, setAngemeldet] = useState(schiff.angemeldet ?? false);
  const [e3st, setE3st] = useState(schiff.e3st ?? false);
  const [doppeldecker, setDoppeldecker] = useState(schiff.doppeldecker ?? false);
  const [ehf, setEhf] = useState(schiff.ehfLotseBenoetigt ?? false);

  function handleOk() {
    onOk({
      ...schiff,
      eta: fromLocalInput(eta) ?? schiff.eta,
      angemeldet,
      e3st,
      doppeldecker,
      ehfLotseBenoetigt: ehf,
    });
  }

  return (
    <div className="job-form">
      <div className="job-form__row">
        <label>
          ETA
          <input type="datetime-local" value={eta} onChange={(e) => setEta(e.target.value)} />
        </label>
      </div>
      <Switch label="angemeldet" checked={angemeldet} onChange={setAngemeldet} />
      <Switch label="E3/ST" checked={e3st} onChange={setE3st} />
      <Switch label="Doppeldecker" checked={doppeldecker} onChange={setDoppeldecker} />
      <label className="job-form__check seestation-ehf">
        <span>
          <input type="checkbox" checked={ehf} onChange={(e) => setEhf(e.target.checked)} /> EHF
        </span>
      </label>
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

interface SeestationLotseAktionModalProps {
  initialEtaStn: Date | undefined;
  onUebernehmen: (etaStn: Date | undefined) => void;
  onAufStation: () => void;
  onAbbrechen: () => void;
}

/** Doppelklick auf einen Lotsen der Liste "Auf Seestation": ETA Stn
 *  korrigieren oder den Lotsen als angekommen ("Auf Station") markieren. */
export function SeestationLotseAktionModal({
  initialEtaStn,
  onUebernehmen,
  onAufStation,
  onAbbrechen,
}: SeestationLotseAktionModalProps) {
  const [basis] = useState(() => initialEtaStn ?? new Date());
  const [zeit, setZeit] = useState(toLocalTimeInput(initialEtaStn));

  function neueEta(): Date | undefined {
    if (zeit === "") return initialEtaStn;
    const [stunden, minuten] = zeit.split(":").map(Number);
    const ergebnis = new Date(basis);
    ergebnis.setHours(stunden, minuten, 0, 0);
    return ergebnis;
  }

  return (
    <div className="job-form">
      <div className="job-form__row">
        <label className="abtzeit-feld">
          ETA Stn:
          <input type="time" value={zeit} onChange={(e) => setZeit(e.target.value)} />
        </label>
      </div>
      <div className="job-form__actions">
        <button type="button" className="btn btn--ghost" onClick={onAbbrechen}>
          Abbrechen
        </button>
        <span className="job-form__spacer" />
        <button type="button" className="btn" onClick={() => onUebernehmen(neueEta())}>
          Übernehmen
        </button>
        <button type="button" className="btn btn--accent" onClick={onAufStation}>
          Auf Station
        </button>
      </div>
    </div>
  );
}

const ZUSAETZE = ["A", "B", "C", "D"] as const;

interface SeestationLotseNeuModalProps {
  /** Vorbelegung: letzte (höchste) V-Nr. der Liste */
  vNrProfil: number;
  onEinfuegen: (lotse: Omit<SeestationLotse, "id">) => void;
  onAbbrechen: () => void;
}

/** "+ Lotse hinzufügen": manueller Lotse nur für die Seestation-Liste. */
export function SeestationLotseNeuModal({ vNrProfil, onEinfuegen, onAbbrechen }: SeestationLotseNeuModalProps) {
  const [vNr, setVNr] = useState(String(vNrProfil).padStart(3, "0"));
  const [zusatz, setZusatz] = useState("");
  const [name, setName] = useState("");
  const [kategorie, setKategorie] = useState("");
  const [elbehafen, setElbehafen] = useState(false);
  const [etaStn, setEtaStn] = useState("");

  function handleVNr(wert: string) {
    setVNr(wert.replace(/\D/g, "").slice(0, 3));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const etaDatum = fromLocalInput(etaStn);
    if (vNr === "" || zusatz === "" || name.trim() === "" || kategorie === "" || !etaDatum) return;
    onEinfuegen({
      vNr: Number(vNr),
      zusatz: zusatz as SeestationLotse["zusatz"],
      name: name.trim(),
      // "voll" ist nur der Dropdown-Wert — gespeichert wird die leere
      // Kategorie, wie überall sonst für Volllotsen
      kategorie: kategorie === "voll" ? "" : kategorie,
      elbehafen,
      etaStn: etaDatum,
    });
  }

  return (
    <form className="job-form" onSubmit={handleSubmit}>
      <div className="job-form__row">
        <label>
          V-Nr.
          <input
            type="text"
            inputMode="numeric"
            className="seestation-vnr"
            value={vNr}
            onChange={(e) => handleVNr(e.target.value)}
            required
          />
        </label>
        <label>
          Zusatz
          <select value={zusatz} onChange={(e) => setZusatz(e.target.value)} required>
            <option value="">–</option>
            {ZUSAETZE.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="job-form__row">
        <label className="job-form__lotse-name">
          Lotsenname
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
      </div>
      <div className="job-form__row">
        <label>
          Kat.
          <select value={kategorie} onChange={(e) => setKategorie(e.target.value)} required>
            <option value="">–</option>
            {LOTSEN_KATEGORIEN.filter((k) => k !== "").map((kat) => (
              <option key={kat} value={kat}>
                {kat}
              </option>
            ))}
            <option value="voll">Volllotse</option>
          </select>
        </label>
        <label>
          ETA Stn
          <input type="datetime-local" value={etaStn} onChange={(e) => setEtaStn(e.target.value)} required />
        </label>
        <label className="job-form__check job-form__eh-minimal">
          <span>
            <input type="checkbox" checked={elbehafen} onChange={(e) => setElbehafen(e.target.checked)} /> EH
          </span>
        </label>
      </div>
      <div className="job-form__actions">
        <button type="button" className="btn btn--ghost" onClick={onAbbrechen}>
          Abbrechen
        </button>
        <span className="job-form__spacer" />
        <button type="submit" className="btn btn--accent">
          Einfügen
        </button>
      </div>
    </form>
  );
}
