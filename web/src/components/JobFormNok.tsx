import { useState, type FormEvent } from "react";
import { getAbteilzeitSettings } from "@wache/core";
import type { JobEintrag } from "../data/types";
import { fromLocalInput, toLocalInput } from "../lib/datetime";
import { abteilzeitVon } from "../lib/coreJob";
import { AbtZeitAnzeige, FormActions, SchiffKatSelect } from "./formShared";
import "./JobForm.css";

const settings = getAbteilzeitSettings("Wechsel Tide");

interface JobFormNokProps {
  initial?: JobEintrag;
  onSubmit: (job: JobEintrag) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

export function JobFormNok({ initial, onSubmit, onDelete, onCancel }: JobFormNokProps) {
  const [schiffsname, setSchiffsname] = useState(initial?.schiffsname ?? "");
  const [kategorie, setKategorie] = useState(initial?.kategorie ?? "");
  const [bemerkung, setBemerkung] = useState(initial?.bemerkung ?? "");
  const [holt, setHolt] = useState(toLocalInput(initial?.holt));
  const [ticker, setTicker] = useState(toLocalInput(initial?.ticker));
  const [kuden, setKuden] = useState(toLocalInput(initial?.kuden));
  const [manuell, setManuell] = useState(toLocalInput(initial?.abtZeitManuell));

  function entwurf(): JobEintrag {
    return {
      jobNr: initial?.jobNr ?? 0,
      liste: "nok",
      schiffsname: schiffsname.trim() || undefined,
      kategorie: kategorie || undefined,
      bemerkung: bemerkung.trim() || undefined,
      holt: fromLocalInput(holt),
      ticker: fromLocalInput(ticker),
      kuden: fromLocalInput(kuden),
      abtZeitManuell: fromLocalInput(manuell),
    };
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(entwurf());
  }

  const abteilzeit = abteilzeitVon(entwurf(), settings);

  return (
    <form className="job-form" onSubmit={handleSubmit}>
      <div className="job-form__row">
        <label className="job-form__grow3">
          Schiffsname
          <input value={schiffsname} onChange={(e) => setSchiffsname(e.target.value.toUpperCase())} autoFocus />
        </label>
        <SchiffKatSelect value={kategorie} onChange={setKategorie} />
      </div>

      <div className="job-form__row">
        <label className="job-form__half">
          Bemerkung
          <input value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} />
        </label>
      </div>

      <div className="job-form__row job-form__row--3">
        <label>
          Holt.
          <input type="datetime-local" value={holt} onChange={(e) => setHolt(e.target.value)} />
        </label>
        <label>
          Ticker
          <input type="datetime-local" value={ticker} onChange={(e) => setTicker(e.target.value)} />
        </label>
        <label>
          Kuden
          <input type="datetime-local" value={kuden} onChange={(e) => setKuden(e.target.value)} />
        </label>
      </div>

      <div className="job-form__row">
        <AbtZeitAnzeige wert={abteilzeit} manuellAktiv={manuell !== ""} />
        <label>
          man. Abt.Zeit
          <input type="datetime-local" value={manuell} onChange={(e) => setManuell(e.target.value)} />
        </label>
      </div>

      <FormActions onDelete={onDelete} onCancel={onCancel} />
    </form>
  );
}
