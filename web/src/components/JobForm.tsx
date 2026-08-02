import { useState, type FormEvent } from "react";
import type { Job } from "@wache/core";
import { fromLocalInput, toLocalInput } from "../lib/datetime";
import "./JobForm.css";

type Art = "HH" | "NOK" | "Andere";

function artVon(routentyp: string): Art {
  if (routentyp === "HH") return "HH";
  if (routentyp === "NOK") return "NOK";
  return "Andere";
}

function kategorieAusText(text: string): number | string | undefined {
  const wert = text.trim();
  if (wert === "") return undefined;
  return /^\d+$/.test(wert) ? Number(wert) : wert;
}

interface JobFormProps {
  initial?: Job;
  vorgabeArt?: Art;
  onSubmit: (job: Job) => void;
  onCancel: () => void;
}

export function JobForm({ initial, vorgabeArt, onSubmit, onCancel }: JobFormProps) {
  const [art, setArt] = useState<Art>(initial ? artVon(initial.routentyp) : (vorgabeArt ?? "HH"));
  const [andererTyp, setAndererTyp] = useState(initial && artVon(initial.routentyp) === "Andere" ? initial.routentyp : "");
  const [bezeichnung, setBezeichnung] = useState(initial?.bezeichnung ?? "");
  const [bemerkung, setBemerkung] = useState(initial?.bemerkung ?? "");
  const [kategorie, setKategorie] = useState(initial?.kategorie !== undefined ? String(initial.kategorie) : "");
  const [feld1, setFeld1] = useState(toLocalInput(initial?.hhHoltenau));
  const [feld2, setFeld2] = useState(toLocalInput(initial?.fkwTickerAbgang));
  const [feld3, setFeld3] = useState(toLocalInput(initial?.stadeKuden));
  const [manuell, setManuell] = useState(toLocalInput(initial?.abteilungManuell));

  const labels: [string, string, string] = art === "NOK" ? ["Holt.", "Ticker", "Kuden"] : ["HH", "FkW", "Stade"];

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const job: Job = {
      jobNr: initial?.jobNr ?? 0,
      routentyp: art === "Andere" ? andererTyp.trim() || "Andere" : art,
      bezeichnung: bezeichnung.trim() || undefined,
      bemerkung: bemerkung.trim() || undefined,
      kategorie: kategorieAusText(kategorie),
      hhHoltenau: art !== "Andere" ? fromLocalInput(feld1) : undefined,
      fkwTickerAbgang: art !== "Andere" ? fromLocalInput(feld2) : undefined,
      stadeKuden: art !== "Andere" ? fromLocalInput(feld3) : undefined,
      abteilungManuell: art === "Andere" ? fromLocalInput(manuell) : undefined,
    };
    onSubmit(job);
  }

  return (
    <form className="job-form" onSubmit={handleSubmit}>
      <div className="job-form__row">
        <label>
          Art
          <select value={art} onChange={(e) => setArt(e.target.value as Art)}>
            <option value="HH">Hamburg</option>
            <option value="NOK">NOK</option>
            <option value="Andere">Andere (Anmeldung)</option>
          </select>
        </label>
        {art === "Andere" && (
          <label>
            Typ
            <input
              value={andererTyp}
              onChange={(e) => setAndererTyp(e.target.value)}
              placeholder="z.B. Radar, EHF"
              required
            />
          </label>
        )}
      </div>

      <div className="job-form__row">
        <label>
          Schiff / Bezeichnung
          <input value={bezeichnung} onChange={(e) => setBezeichnung(e.target.value)} />
        </label>
        <label>
          Kat.
          <input value={kategorie} onChange={(e) => setKategorie(e.target.value)} placeholder="1–8 oder Text" />
        </label>
      </div>

      <label>
        Bemerkung
        <input value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} />
      </label>

      {art !== "Andere" ? (
        <div className="job-form__row job-form__row--3">
          <label>
            {labels[0]}
            <input type="datetime-local" value={feld1} onChange={(e) => setFeld1(e.target.value)} />
          </label>
          <label>
            {labels[1]}
            <input type="datetime-local" value={feld2} onChange={(e) => setFeld2(e.target.value)} />
          </label>
          <label>
            {labels[2]}
            <input type="datetime-local" value={feld3} onChange={(e) => setFeld3(e.target.value)} />
          </label>
        </div>
      ) : (
        <label>
          Abteilzeit (manuell)
          <input type="datetime-local" value={manuell} onChange={(e) => setManuell(e.target.value)} required />
        </label>
      )}

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
