import { useState, type FormEvent } from "react";
import { LOTSEN_KATEGORIEN } from "@wache/core";
import type { SeeSchiff, SeestationLotse } from "../data/types";
import { ausDatumUndZeit, fromLocalInput, toLocalDateInput, toLocalTimeInput } from "../lib/datetime";
import { SchiffKatSelect } from "./formShared";
import "./JobForm.css";
import "./SeestationModals.css";

/** Schiebeschalter im iOS-Stil (Checkbox mit Switch-Optik). */
export function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (wert: boolean) => void }) {
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
  onLoeschen: () => void;
  onAbbrechen: () => void;
}

/** Doppelklick auf ein Schiff: ETA (getrennt Datum/Zeit) + Switches
 *  bearbeiten, oder den Eintrag löschen. */
export function SeeSchiffEditModal({ schiff, onOk, onLoeschen, onAbbrechen }: SeeSchiffEditModalProps) {
  const [etaDatum, setEtaDatum] = useState(toLocalDateInput(schiff.eta));
  const [etaZeit, setEtaZeit] = useState(toLocalTimeInput(schiff.eta));
  const [angemeldet, setAngemeldet] = useState(schiff.angemeldet ?? false);
  const [e3st, setE3st] = useState(schiff.e3st ?? false);
  const [doppeldecker, setDoppeldecker] = useState(schiff.doppeldecker ?? false);
  const [ehf, setEhf] = useState(schiff.ehfLotseBenoetigt ?? false);

  function handleOk() {
    onOk({
      ...schiff,
      eta: ausDatumUndZeit(etaDatum, etaZeit) ?? schiff.eta,
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
          ETA-Datum
          <input type="date" value={etaDatum} onChange={(e) => setEtaDatum(e.target.value)} />
        </label>
        <label>
          ETA-Zeit
          <input type="time" value={etaZeit} onChange={(e) => setEtaZeit(e.target.value)} />
        </label>
        <Switch label="angemeldet" checked={angemeldet} onChange={setAngemeldet} />
      </div>
      <div className="job-form__row">
        <Switch label="E3/ST" checked={e3st} onChange={setE3st} />
        <Switch label="Doppeldecker" checked={doppeldecker} onChange={setDoppeldecker} />
        <label className="job-form__check">
          <span>
            <input type="checkbox" checked={ehf} onChange={(e) => setEhf(e.target.checked)} /> EHF
          </span>
        </label>
      </div>
      <div className="job-form__actions">
        <button type="button" className="btn btn--danger" onClick={onLoeschen}>
          Löschen
        </button>
        <span className="job-form__spacer" />
        <button type="button" className="btn btn--ghost" onClick={onAbbrechen}>
          Abbrechen
        </button>
        <button type="button" className="btn btn--accent" onClick={handleOk}>
          OK
        </button>
      </div>
    </div>
  );
}

interface VerschiebenZiel {
  id: number;
  label: string;
}

interface SeestationLotseAktionModalProps {
  initialEtaStn: Date | undefined;
  /** true = Lotse ist bereits vor Ort — dann nur Abbrechen/Verschieben/Abschöpfen */
  aufStation: boolean;
  /** true = "Verschieben" anbieten (nur Lotsen aus der Versetzliste,
   *  quelle === "abteilung" — manuelle Seestation-Lotsen haben ein anderes
   *  V-Nr.-Schema und sind daher ausgenommen) */
  zeigeVerschieben: boolean;
  /** andere Lotsen, hinter die verschoben werden kann (ebenfalls auf der
   *  Seestation, quelle === "abteilung", ohne den Lotsen selbst) */
  verschiebenZiele: VerschiebenZiel[];
  onUebernehmen: (etaStn: Date | undefined) => void;
  onAufStation: () => void;
  onVerschieben: (zielId: number) => void;
  onAbschoepfen: () => void;
  onAbbrechen: () => void;
}

/** Doppelklick auf einen Lotsen der Liste "Auf Seestation". Noch nicht vor
 *  Ort: ETA Stn korrigieren oder als angekommen ("Auf Seestation")
 *  markieren. Bereits vor Ort: Verschieben (Positionstausch mit V-Nr.-Zusatz)
 *  oder "Abschöpfen" (Lotse verlässt die Seestation). */
export function SeestationLotseAktionModal({
  initialEtaStn,
  aufStation,
  zeigeVerschieben,
  verschiebenZiele,
  onUebernehmen,
  onAufStation,
  onVerschieben,
  onAbschoepfen,
  onAbbrechen,
}: SeestationLotseAktionModalProps) {
  const [basis] = useState(() => initialEtaStn ?? new Date());
  const [zeit, setZeit] = useState(toLocalTimeInput(initialEtaStn));
  const [verschiebenOffen, setVerschiebenOffen] = useState(false);
  const [ziel, setZiel] = useState("");

  function neueEta(): Date | undefined {
    if (zeit === "") return initialEtaStn;
    const [stunden, minuten] = zeit.split(":").map(Number);
    const ergebnis = new Date(basis);
    ergebnis.setHours(stunden, minuten, 0, 0);
    return ergebnis;
  }

  function toggleVerschieben() {
    setVerschiebenOffen((offen) => !offen);
    setZiel("");
  }

  if (aufStation) {
    return (
      <div className="job-form">
        {zeigeVerschieben && (
          <div className={"job-form__row" + (!verschiebenOffen ? " job-form__verborgen" : "")}>
            <label className="job-form__grow2">
              Einfügen hinter…
              <select value={ziel} onChange={(e) => setZiel(e.target.value)}>
                <option value="">–</option>
                {verschiebenZiele.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn--accent"
              disabled={ziel === ""}
              onClick={() => onVerschieben(Number(ziel))}
            >
              OK
            </button>
          </div>
        )}
        <div className="job-form__actions">
          <button type="button" className="btn btn--ghost" onClick={onAbbrechen}>
            Abbrechen
          </button>
          <span className="job-form__spacer" />
          {zeigeVerschieben && (
            <button
              type="button"
              className={"btn" + (verschiebenOffen ? " btn--accent" : "")}
              onClick={toggleVerschieben}
            >
              Verschieben
            </button>
          )}
          <button type="button" className="btn btn--danger" onClick={onAbschoepfen}>
            Abgeschöpft
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="job-form">
      <div className="job-form__row">
        <label className="abtzeit-feld">
          ETA Stn:
          <input type="time" value={zeit} onChange={(e) => setZeit(e.target.value)} />
        </label>
        <button type="button" className="btn" onClick={() => onUebernehmen(neueEta())}>
          Übernehmen
        </button>
      </div>
      <div className="job-form__actions">
        <button type="button" className="btn btn--ghost" onClick={onAbbrechen}>
          Abbrechen
        </button>
        <span className="job-form__spacer" />
        <button type="button" className="btn btn--accent" onClick={onAufStation}>
          Auf Seestation
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
