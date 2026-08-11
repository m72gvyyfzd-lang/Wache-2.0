import { useState, type FormEvent } from "react";
import { getAbteilzeitSettings, type Geschwindigkeitsklasse } from "@wache/core";
import type { JobEintrag } from "../data/types";
import { abteilzeitVon } from "../lib/coreJob";
import { ausDatumUndZeit, toLocalDateInput, toLocalTimeInput } from "../lib/datetime";
import { AbtZeitAnzeige, DatumToggleButton, FormActions, handleZeitMitPrefill, SchiffKatSelect, SpeedSelect } from "./formShared";
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
  const [geschwindigkeit, setGeschwindigkeit] = useState<Geschwindigkeitsklasse>(
    initial?.geschwindigkeitsklasse ?? "normal",
  );
  const [bemerkung, setBemerkung] = useState(initial?.bemerkung ?? "");
  const [holtDatum, setHoltDatum] = useState(toLocalDateInput(initial?.holt));
  const [holtZeit, setHoltZeit] = useState(toLocalTimeInput(initial?.holt));
  const [tickerDatum, setTickerDatum] = useState(toLocalDateInput(initial?.ticker));
  const [tickerZeit, setTickerZeit] = useState(toLocalTimeInput(initial?.ticker));
  const [kudenDatum, setKudenDatum] = useState(toLocalDateInput(initial?.kuden));
  const [kudenZeit, setKudenZeit] = useState(toLocalTimeInput(initial?.kuden));
  const [manDatum, setManDatum] = useState(toLocalDateInput(initial?.abtZeitManuell));
  const [manZeit, setManZeit] = useState(toLocalTimeInput(initial?.abtZeitManuell));
  // Ebene 3 (Datumsfelder): beim Öffnen immer zu — das Datum tritt erst bei
  // Bedarf per Kalender-Knopf hinzu.
  const [zeigeDatum, setZeigeDatum] = useState(false);

  function entwurf(): JobEintrag {
    return {
      id: initial?.id ?? 0,
      liste: "nok",
      schiffsname: schiffsname.trim() || undefined,
      kategorie: kategorie || undefined,
      bemerkung: bemerkung.trim() || undefined,
      holt: ausDatumUndZeit(holtDatum, holtZeit),
      ticker: ausDatumUndZeit(tickerDatum, tickerZeit),
      kuden: ausDatumUndZeit(kudenDatum, kudenZeit),
      abtZeitManuell: ausDatumUndZeit(manDatum, manZeit),
      geschwindigkeitsklasse: geschwindigkeit === "normal" ? undefined : geschwindigkeit,
    };
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(entwurf());
  }

  const abteilzeit = abteilzeitVon(entwurf(), settings);

  return (
    <form className="job-form job-form--zentriert" onSubmit={handleSubmit}>
      <div className="job-form__row job-form__zeitgitter">
        <label className="job-form__zg-name">
          Schiffsname
          <input value={schiffsname} onChange={(e) => setSchiffsname(e.target.value.toUpperCase())} />
        </label>
        <SchiffKatSelect value={kategorie} onChange={setKategorie} className="job-form__zg-kat" />
        <SpeedSelect value={geschwindigkeit} onChange={setGeschwindigkeit} className="job-form__zg-speed" />
      </div>

      <div className="job-form__row job-form__zeitgitter">
        <label>
          Holt.
          <input
            type="time"
            value={holtZeit}
            onChange={(e) => handleZeitMitPrefill(e.target.value, holtDatum, setHoltZeit, setHoltDatum)}
          />
        </label>
        <label>
          Ticker
          <input
            type="time"
            value={tickerZeit}
            onChange={(e) => handleZeitMitPrefill(e.target.value, tickerDatum, setTickerZeit, setTickerDatum)}
          />
        </label>
        <label>
          Kuden
          <input
            type="time"
            value={kudenZeit}
            onChange={(e) => handleZeitMitPrefill(e.target.value, kudenDatum, setKudenZeit, setKudenDatum)}
          />
        </label>
        <span className="job-form__zg-extra">
          <DatumToggleButton offen={zeigeDatum} onClick={() => setZeigeDatum((v) => !v)} />
        </span>
      </div>

      {zeigeDatum && (
        <div className="job-form__row job-form__zeitgitter">
          <label>
            Datum Holt.
            <input type="date" value={holtDatum} onChange={(e) => setHoltDatum(e.target.value)} />
          </label>
          <label>
            Datum Ticker
            <input type="date" value={tickerDatum} onChange={(e) => setTickerDatum(e.target.value)} />
          </label>
          <label>
            Datum Kuden
            <input type="date" value={kudenDatum} onChange={(e) => setKudenDatum(e.target.value)} />
          </label>
          <span className="job-form__zg-extra" aria-hidden="true" />
        </div>
      )}

      <div className="job-form__row">
        <label className="job-form__half">
          Bemerkung
          <input value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} />
        </label>
        <AbtZeitAnzeige wert={abteilzeit} manuellAktiv={manZeit !== ""} />
      </div>
      <div className="job-form__row">
        <label>
          Datum
          <input type="date" value={manDatum} onChange={(e) => setManDatum(e.target.value)} />
        </label>
        <label>
          man. Abt.Zeit
          <input
            type="time"
            value={manZeit}
            onChange={(e) => handleZeitMitPrefill(e.target.value, manDatum, setManZeit, setManDatum)}
          />
        </label>
      </div>

      <FormActions onDelete={onDelete} onCancel={onCancel} />
    </form>
  );
}
