import { useState, type FormEvent } from "react";
import { getAbteilzeitSettings } from "@wache/core";
import type { JobEintrag } from "../data/types";
import { fromLocalInput, toLocalInput } from "../lib/datetime";
import { abteilzeitVon } from "../lib/coreJob";
import { AbtZeitAnzeige, FormActions, SchiffKatSelect } from "./formShared";
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
  const [hh, setHh] = useState(toLocalInput(initial?.hh));
  const [fkw, setFkw] = useState(toLocalInput(initial?.fkw));
  const [stade, setStade] = useState(toLocalInput(initial?.stade));
  const [geplAbgang, setGeplAbgang] = useState(toLocalInput(initial?.geplAbgang));
  const [manuell, setManuell] = useState(toLocalInput(initial?.abtZeitManuell));

  function toggleBuetz(gesetzt: boolean) {
    setBuetz(gesetzt);
    if (gesetzt) {
      setHh("");
      setFkw("");
      setBemerkung((b) => (b.split(/\s+/).includes("Bütz") ? b : b ? `${b} Bütz` : "Bütz"));
    } else {
      setGeplAbgang("");
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
      hh: buetz ? undefined : fromLocalInput(hh),
      fkw: buetz ? undefined : fromLocalInput(fkw),
      stade: fromLocalInput(stade),
      geplAbgang: buetz ? fromLocalInput(geplAbgang) : undefined,
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
          <input value={schiffsname} onChange={(e) => setSchiffsname(e.target.value.toUpperCase())} />
        </label>
        <SchiffKatSelect value={kategorie} onChange={setKategorie} />
      </div>

      <div className="job-form__row">
        <label className="job-form__half">
          Bemerkung
          <input value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} />
        </label>
        <label className="job-form__check">
          <span>
            <input type="checkbox" checked={buetz} onChange={(e) => toggleBuetz(e.target.checked)} /> Bützfleth
          </span>
        </label>
      </div>

      <div className="job-form__row job-form__row--3">
        <label>
          HH
          <input type="datetime-local" value={hh} onChange={(e) => setHh(e.target.value)} disabled={buetz} />
        </label>
        {buetz ? (
          <label>
            gepl. Abgang
            <input type="datetime-local" value={geplAbgang} onChange={(e) => setGeplAbgang(e.target.value)} />
          </label>
        ) : (
          <label>
            FkW
            <input type="datetime-local" value={fkw} onChange={(e) => setFkw(e.target.value)} />
          </label>
        )}
        <label>
          Stade
          <input type="datetime-local" value={stade} onChange={(e) => setStade(e.target.value)} />
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
