import { useState, type FormEvent } from "react";
import { ANMELDUNGS_TYPEN } from "@wache/core";
import type { AnmeldungsTyp } from "@wache/core";
import type { JobEintrag } from "../data/types";
import { fromLocalInput, toLocalInput } from "../lib/datetime";
import { FormActions, SchiffKatSelect } from "./formShared";
import "./JobForm.css";

interface JobFormAndereProps {
  initial?: JobEintrag;
  /** Alle Jobs aus Hamburg/NOK für die AG-Verknüpfung */
  verknuepfbareJobs: JobEintrag[];
  onSubmit: (job: JobEintrag) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

export function JobFormAndere({ initial, verknuepfbareJobs, onSubmit, onDelete, onCancel }: JobFormAndereProps) {
  const [typ, setTyp] = useState<AnmeldungsTyp>(initial?.typ ?? "AG");
  const [schiffsname, setSchiffsname] = useState(initial?.schiffsname ?? "");
  const [kategorie, setKategorie] = useState(initial?.kategorie ?? "");
  const [bemerkung, setBemerkung] = useState(initial?.bemerkung ?? "");
  const [agJobId, setAgJobId] = useState(initial?.agJobId !== undefined ? String(initial.agJobId) : "");
  const [agLotsen, setAgLotsen] = useState(initial?.agLotsenAnzahl !== undefined ? String(initial.agLotsenAnzahl) : "");
  const [ehfBestAbgang, setEhfBestAbgang] = useState(toLocalInput(initial?.ehfBestAbgang));
  const [ehfLotse, setEhfLotse] = useState(initial?.ehfLotseBenoetigt ?? false);
  const [bhfBesetzZeit, setBhfBesetzZeit] = useState(toLocalInput(initial?.bhfBesetzZeit));
  const [abtZeit, setAbtZeit] = useState(toLocalInput(initial?.abtZeitManuell));

  /** EHF-Regel: nach Eingabe des best. Abgangs wird die Abteilzeit
   *  automatisch auf Abgang − 1 Std. gesetzt (bleibt danach editierbar). */
  function handleBestAbgang(wert: string) {
    setEhfBestAbgang(wert);
    const abgang = fromLocalInput(wert);
    if (abgang) setAbtZeit(toLocalInput(new Date(abgang.getTime() - 3_600_000)));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      id: initial?.id ?? 0,
      liste: "andere",
      typ,
      schiffsname: schiffsname.trim() || undefined,
      kategorie: kategorie || undefined,
      bemerkung: bemerkung.trim() || undefined,
      agJobId: typ === "AG" && agJobId !== "" ? Number(agJobId) : undefined,
      agLotsenAnzahl: typ === "AG" && agLotsen !== "" ? Number(agLotsen) : undefined,
      ehfBestAbgang: typ === "EHF" ? fromLocalInput(ehfBestAbgang) : undefined,
      ehfLotseBenoetigt: typ === "EHF" ? ehfLotse : undefined,
      bhfBesetzZeit: typ === "BHF" ? fromLocalInput(bhfBesetzZeit) : undefined,
      abtZeitManuell: fromLocalInput(abtZeit),
    });
  }

  return (
    <form className="job-form" onSubmit={handleSubmit}>
      <div className="job-form__row">
        <label className="job-form__grow3">
          Type
          <select value={typ} onChange={(e) => setTyp(e.target.value as AnmeldungsTyp)}>
            {ANMELDUNGS_TYPEN.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="job-form__row">
        <label className="job-form__grow3">
          Schiffsname
          <input value={schiffsname} onChange={(e) => setSchiffsname(e.target.value.toUpperCase())} />
        </label>
        <SchiffKatSelect value={kategorie} onChange={setKategorie} />
      </div>

      <div className="job-form__row job-form__typfelder">
        {typ === "AG" && (
          <>
            <label className="job-form__grow2">
              Schiff (aus Hamburg/NOK)
              <select value={agJobId} onChange={(e) => setAgJobId(e.target.value)}>
                <option value="">–</option>
                {verknuepfbareJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.schiffsname ?? `Job ${job.id}`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Lotsen
              <input type="number" min={1} value={agLotsen} onChange={(e) => setAgLotsen(e.target.value)} />
            </label>
          </>
        )}
        {typ === "EHF" && (
          <>
            <label>
              best. Abgang
              <input type="datetime-local" value={ehfBestAbgang} onChange={(e) => handleBestAbgang(e.target.value)} />
            </label>
            <label className="job-form__check">
              <span>
                <input type="checkbox" checked={ehfLotse} onChange={(e) => setEhfLotse(e.target.checked)} /> EHF-Lotse
                benötigt
              </span>
            </label>
          </>
        )}
        {typ === "BHF" && (
          <label>
            Besetz-Zeit
            <input type="datetime-local" value={bhfBesetzZeit} onChange={(e) => setBhfBesetzZeit(e.target.value)} />
          </label>
        )}
      </div>

      <div className="job-form__row">
        <label className="job-form__grow2">
          Bemerkungen
          <input value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} />
        </label>
        <label className="job-form__abtzeit-eingabe">
          Abt. Zeit
          <input type="datetime-local" value={abtZeit} onChange={(e) => setAbtZeit(e.target.value)} />
        </label>
      </div>

      <FormActions onDelete={onDelete} onCancel={onCancel} />
    </form>
  );
}
