import { useState, type FormEvent } from "react";
import { getAbteilzeitSettings } from "@wache/core";
import type { JobEintrag } from "../data/types";
import { abteilzeitVon } from "../lib/coreJob";
import { ausDatumUndZeit, toLocalDateInput, toLocalTimeInput } from "../lib/datetime";
import { AbtZeitAnzeige, DatumToggleButton, FormActions, handleZeitMitPrefill, SchiffKatSelect } from "./formShared";
import "./JobForm.css";

const settings = getAbteilzeitSettings("Wechsel Tide");

interface JobFormHamburgProps {
  initial?: JobEintrag;
  onSubmit: (job: JobEintrag) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

function ohneBuetzToken(text: string): string {
  return text
    .split(/\s+/)
    .filter((token) => token !== "Bütz")
    .join(" ");
}

export function JobFormHamburg({ initial, onSubmit, onDelete, onCancel }: JobFormHamburgProps) {
  const [schiffsname, setSchiffsname] = useState(initial?.schiffsname ?? "");
  const [kategorie, setKategorie] = useState(initial?.kategorie ?? "");
  const [bemerkung, setBemerkung] = useState(initial?.bemerkung ?? "");
  const [buetz, setBuetz] = useState(initial?.buetzfleth ?? false);
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
  // Ebene 3 (Datumsfelder): beim Bearbeiten offen (Termin könnte von heute
  // abweichen), bei einer Neuanlage zu — die meisten Jobs betreffen den
  // aktuellen Tag, das Datum tritt erst bei Bedarf per Knopf hinzu.
  const [zeigeDatum, setZeigeDatum] = useState(() => initial !== undefined);

  function toggleBuetz(gesetzt: boolean) {
    setBuetz(gesetzt);
    if (gesetzt) {
      setHhDatum("");
      setHhZeit("");
      setFkwDatum("");
      setFkwZeit("");
      setBemerkung((b) => (b.split(/\s+/).includes("Bütz") ? b : b ? `${b} Bütz` : "Bütz"));
    } else {
      setGeplAbgangDatum("");
      setGeplAbgangZeit("");
      setBemerkung((b) => ohneBuetzToken(b));
    }
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
        <label className="job-form__half">
          Schiffsname
          <input value={schiffsname} onChange={(e) => setSchiffsname(e.target.value.toUpperCase())} />
        </label>
        <SchiffKatSelect value={kategorie} onChange={setKategorie} />
        <label className="job-form__check">
          <span>
            <input type="checkbox" checked={buetz} onChange={(e) => toggleBuetz(e.target.checked)} /> Bütz
          </span>
        </label>
      </div>

      <div className="job-form__row job-form__row--3">
        <label>
          HH
          <input
            type="time"
            value={hhZeit}
            onChange={(e) => handleZeitMitPrefill(e.target.value, hhDatum, setHhZeit, setHhDatum)}
            disabled={buetz}
          />
        </label>
        {buetz ? (
          <label>
            gepl. Abgang
            <input
              type="time"
              value={geplAbgangZeit}
              onChange={(e) => handleZeitMitPrefill(e.target.value, geplAbgangDatum, setGeplAbgangZeit, setGeplAbgangDatum)}
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
        <DatumToggleButton offen={zeigeDatum} onClick={() => setZeigeDatum((v) => !v)} />
      </div>

      {zeigeDatum && (
        <div className="job-form__row job-form__row--3">
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
          <span aria-hidden="true" />
        </div>
      )}

      <div className="job-form__row">
        <AbtZeitAnzeige wert={abteilzeit} manuellAktiv={manZeit !== ""} />
        <label className="job-form__half">
          Bemerkung
          <input value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} />
        </label>
      </div>
      <div className="job-form__row">
        <label>
          man. Abt.Zeit
          <input
            type="time"
            value={manZeit}
            onChange={(e) => handleZeitMitPrefill(e.target.value, manDatum, setManZeit, setManDatum)}
          />
        </label>
        <label>
          Datum
          <input type="date" value={manDatum} onChange={(e) => setManDatum(e.target.value)} />
        </label>
      </div>

      <FormActions onDelete={onDelete} onCancel={onCancel} />
    </form>
  );
}
