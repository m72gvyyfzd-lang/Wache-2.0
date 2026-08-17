import { useState, type FormEvent } from "react";
import { getAbteilzeitSettings, type Geschwindigkeitsklasse } from "@wache/core";
import type { JobEintrag } from "../data/types";
import { abteilzeitVon } from "../lib/coreJob";
import { ausDatumUndZeit, toLocalDateInput, toLocalTimeInput } from "../lib/datetime";
import {
  AbtZeitAnzeige,
  DatumToggleButton,
  FormActions,
  handleZeitMitPrefill,
  mitToken,
  ohneToken,
  SchiffKatSelect,
  SpeedSelect,
} from "./formShared";
import "./JobForm.css";

const settings = getAbteilzeitSettings("Wechsel Tide");

interface JobFormHamburgProps {
  initial?: JobEintrag;
  onSubmit: (job: JobEintrag) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

export function JobFormHamburg({ initial, onSubmit, onDelete, onCancel }: JobFormHamburgProps) {
  const [schiffsname, setSchiffsname] = useState(initial?.schiffsname ?? "");
  const [kategorie, setKategorie] = useState(initial?.kategorie ?? "");
  const [bemerkung, setBemerkung] = useState(initial?.bemerkung ?? "");
  const [buetz, setBuetz] = useState(initial?.buetzfleth ?? false);
  const [bunkern, setBunkern] = useState(initial?.geplBunkern ?? false);
  const [geschwindigkeit, setGeschwindigkeit] = useState<Geschwindigkeitsklasse>(
    initial?.geschwindigkeitsklasse ?? "normal",
  );
  const [hhDatum, setHhDatum] = useState(toLocalDateInput(initial?.hh));
  const [hhZeit, setHhZeit] = useState(toLocalTimeInput(initial?.hh));
  const [fkwDatum, setFkwDatum] = useState(toLocalDateInput(initial?.fkw));
  const [fkwZeit, setFkwZeit] = useState(toLocalTimeInput(initial?.fkw));
  const [stadeDatum, setStadeDatum] = useState(toLocalDateInput(initial?.stade));
  const [stadeZeit, setStadeZeit] = useState(toLocalTimeInput(initial?.stade));
  const [geplAbgangDatum, setGeplAbgangDatum] = useState(toLocalDateInput(initial?.geplAbgang));
  const [geplAbgangZeit, setGeplAbgangZeit] = useState(toLocalTimeInput(initial?.geplAbgang));
  const [manDatum, setManDatum] = useState(toLocalDateInput(initial?.abtZeitManuell));
  const [manZeit, setManZeit] = useState(toLocalTimeInput(initial?.abtZeitManuell));
  // Ebene 3 (Datumsfelder): beim Öffnen immer zu — die meisten Jobs
  // betreffen den aktuellen Tag, das Datum tritt erst bei Bedarf per
  // Kalender-Knopf hinzu.
  const [zeigeDatum, setZeigeDatum] = useState(false);

  function toggleBuetz(gesetzt: boolean) {
    setBuetz(gesetzt);
    if (gesetzt) {
      setHhDatum("");
      setHhZeit("");
      setFkwDatum("");
      setFkwZeit("");
      setBemerkung((b) => mitToken(b, "Bütz"));
    } else {
      setGeplAbgangDatum("");
      setGeplAbgangZeit("");
      // Bunkern gibt es nur für Bütz — beim Abwählen mit zurücksetzen.
      setBunkern(false);
      setBemerkung((b) => ohneToken(ohneToken(b, "Bütz"), "Bunkert"));
    }
  }

  function toggleBunkern(gesetzt: boolean) {
    setBunkern(gesetzt);
    setBemerkung((b) => (gesetzt ? mitToken(b, "Bunkert") : ohneToken(b, "Bunkert")));
  }

  function entwurf(): JobEintrag {
    return {
      id: initial?.id ?? 0,
      liste: "hamburg",
      schiffsname: schiffsname.trim() || undefined,
      kategorie: kategorie || undefined,
      bemerkung: bemerkung.trim() || undefined,
      buetzfleth: buetz || undefined,
      hh: buetz ? undefined : ausDatumUndZeit(hhDatum, hhZeit),
      fkw: buetz ? undefined : ausDatumUndZeit(fkwDatum, fkwZeit),
      stade: ausDatumUndZeit(stadeDatum, stadeZeit),
      geplAbgang: buetz ? ausDatumUndZeit(geplAbgangDatum, geplAbgangZeit) : undefined,
      abtZeitManuell: ausDatumUndZeit(manDatum, manZeit),
      // auch für Bütz relevant: die Brb>>SEE-Prognose nutzt die Klasse
      geschwindigkeitsklasse: geschwindigkeit === "normal" ? undefined : geschwindigkeit,
      geplBunkern: buetz && bunkern ? true : undefined,
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
          <input value={schiffsname} onChange={(e) => setSchiffsname(e.target.value.toUpperCase())} required />
        </label>
        <SchiffKatSelect value={kategorie} onChange={setKategorie} className="job-form__zg-kat" required />
        <SpeedSelect value={geschwindigkeit} onChange={setGeschwindigkeit} className="job-form__zg-speed" />
        <label className="job-form__zg-extra">
          Bütz
          <input
            type="checkbox"
            className="job-form__checkbox-solo"
            checked={buetz}
            onChange={(e) => toggleBuetz(e.target.checked)}
          />
        </label>
      </div>

      <div className="job-form__row job-form__zeitgitter">
        <label>
          HH
          {/* Pflicht — außer bei Bütz: dort ist das Feld gesperrt und die
              Pflicht wandert auf den gepl. Abgang. */}
          <input
            type="time"
            value={hhZeit}
            onChange={(e) => handleZeitMitPrefill(e.target.value, hhDatum, setHhZeit, setHhDatum)}
            disabled={buetz}
            required={!buetz}
          />
        </label>
        {buetz ? (
          <label>
            gepl. Abgang
            <input
              type="time"
              value={geplAbgangZeit}
              onChange={(e) => handleZeitMitPrefill(e.target.value, geplAbgangDatum, setGeplAbgangZeit, setGeplAbgangDatum)}
              required
            />
          </label>
        ) : (
          <label>
            FkW
            <input
              type="time"
              value={fkwZeit}
              onChange={(e) => handleZeitMitPrefill(e.target.value, fkwDatum, setFkwZeit, setFkwDatum)}
            />
          </label>
        )}
        <label>
          Stade
          <input
            type="time"
            value={stadeZeit}
            onChange={(e) => handleZeitMitPrefill(e.target.value, stadeDatum, setStadeZeit, setStadeDatum)}
          />
        </label>
        {buetz && (
          <label>
            gepl. Bunkern
            <input
              type="checkbox"
              className="job-form__checkbox-solo"
              checked={bunkern}
              onChange={(e) => toggleBunkern(e.target.checked)}
            />
          </label>
        )}
        <span className="job-form__zg-extra">
          <DatumToggleButton offen={zeigeDatum} onClick={() => setZeigeDatum((v) => !v)} />
        </span>
      </div>

      {zeigeDatum && (
        <div className="job-form__row job-form__zeitgitter">
          <label>
            Datum HH
            <input type="date" value={hhDatum} onChange={(e) => setHhDatum(e.target.value)} disabled={buetz} />
          </label>
          {buetz ? (
            <label>
              Datum gepl. Abgang
              <input type="date" value={geplAbgangDatum} onChange={(e) => setGeplAbgangDatum(e.target.value)} />
            </label>
          ) : (
            <label>
              Datum FkW
              <input type="date" value={fkwDatum} onChange={(e) => setFkwDatum(e.target.value)} />
            </label>
          )}
          <label>
            Datum Stade
            <input type="date" value={stadeDatum} onChange={(e) => setStadeDatum(e.target.value)} />
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
