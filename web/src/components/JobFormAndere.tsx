import { useState, type FormEvent } from "react";
import { ANMELDUNGS_TYPEN, getAbteilzeitSettings } from "@wache/core";
import type { AnmeldungsTyp, Geschwindigkeitsklasse } from "@wache/core";
import type { JobEintrag } from "../data/types";
import { abteilzeitVon } from "../lib/coreJob";
import { ausDatumUndZeit, fromLocalInput, toLocalDateInput, toLocalInput, toLocalTimeInput } from "../lib/datetime";
import { FormActions, handleZeitMitPrefill, SchiffKatSelect, SpeedSelect } from "./formShared";
import "./JobForm.css";

const settings = getAbteilzeitSettings("Wechsel Tide");

/** Typen ohne eigenen Schiffsnamen/Kategorie: AG leitet den Namen aus der
 *  Verknüpfung ab, AG (Tender) heißt fest "Tender", Nebelradar braucht
 *  beides schlicht nicht. */
function ohneSchiffsfelder(typ: AnmeldungsTyp | ""): boolean {
  return typ === "AG" || typ === "AG (Tender)" || typ === "Nebelradar";
}

interface JobFormAndereProps {
  initial?: JobEintrag;
  /** Alle Jobs aus Hamburg/NOK für die AG-Verknüpfung */
  verknuepfbareJobs: JobEintrag[];
  onSubmit: (job: JobEintrag) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

/** Typen mit V-Nr. und eigenem Schiff: die Lotsen fahren nach der Abteilung
 *  mit dem eigenen Schiff zur Seestation → Speed-Auswahl für die
 *  Brb>>SEE-Matrix. (AG erbt vom Trägerjob, Tender-AG bleibt pauschal.) */
function mitSpeedAuswahl(typ: AnmeldungsTyp | ""): boolean {
  return typ === "EHF" || typ === "BHF";
}

export function JobFormAndere({ initial, verknuepfbareJobs, onSubmit, onDelete, onCancel }: JobFormAndereProps) {
  const [typ, setTyp] = useState<AnmeldungsTyp | "">(initial?.typ ?? "");
  const [schiffsname, setSchiffsname] = useState(initial?.schiffsname ?? "");
  const [kategorie, setKategorie] = useState(initial?.kategorie ?? "");
  const [geschwindigkeit, setGeschwindigkeit] = useState<Geschwindigkeitsklasse>(
    initial?.geschwindigkeitsklasse ?? "normal",
  );
  const [bemerkung, setBemerkung] = useState(initial?.bemerkung ?? "");
  const [agJobId, setAgJobId] = useState(initial?.agJobId !== undefined ? String(initial.agJobId) : "");
  const [agLotsen, setAgLotsen] = useState(initial?.agLotsenAnzahl !== undefined ? String(initial.agLotsenAnzahl) : "");
  const [ehfBestAbgang, setEhfBestAbgang] = useState(toLocalInput(initial?.ehfBestAbgang));
  const [ehfLotse, setEhfLotse] = useState(initial?.ehfLotseBenoetigt ?? false);
  const [bhfBesetzZeit, setBhfBesetzZeit] = useState(toLocalInput(initial?.bhfBesetzZeit));
  const [abtZeitDatum, setAbtZeitDatum] = useState(toLocalDateInput(initial?.abtZeitManuell));
  const [abtZeitZeit, setAbtZeitZeit] = useState(toLocalTimeInput(initial?.abtZeitManuell));

  // Setzt Datum+Zeit der Abt. Zeit gemeinsam — für die Kaskaden (AG-
  // Verknüpfung, EHF/BHF), die einen fertigen Zeitpunkt berechnen.
  function setzeAbtZeit(wert: Date | undefined) {
    setAbtZeitDatum(toLocalDateInput(wert));
    setAbtZeitZeit(toLocalTimeInput(wert));
  }

  /** Beim Wechsel auf AG/Nebelradar Schiffsname+Kat. leeren — beide Felder
   *  sind dort ausgeblendet und sollen keine Altwerte mit einreichen. */
  function handleTypChange(wert: AnmeldungsTyp | "") {
    setTyp(wert);
    if (ohneSchiffsfelder(wert)) {
      setSchiffsname("");
      setKategorie("");
    }
    // AG (Tender): keine Trägerjob-Bindung — eine evtl. vorher gewählte
    // Verknüpfung fällt weg, die Abteilzeit wird direkt eingetragen.
    if (wert === "AG (Tender)") setAgJobId("");
  }

  /** AG-Regel: Schiffsname wird aus der Verknüpfung abgeleitet — Name des
   *  gewählten Schiffs + "(x AG)" (x = Anzahl Lotsen); die Abt. Zeit wird
   *  vom verknüpften Schiff übernommen. Bei Abwahl werden beide wieder
   *  geleert. */
  function aktualisiereAgVerknuepfung(jobIdText: string, lotsenText: string) {
    if (jobIdText === "") {
      setSchiffsname("");
      return;
    }
    const job = verknuepfbareJobs.find((j) => String(j.id) === jobIdText);
    const basis = job?.schiffsname ?? "";
    setSchiffsname(basis && lotsenText !== "" ? `${basis} (${lotsenText} AG)` : basis);
  }

  function handleAgJobId(wert: string) {
    setAgJobId(wert);
    aktualisiereAgVerknuepfung(wert, agLotsen);
    if (wert === "") {
      setzeAbtZeit(undefined);
      return;
    }
    const job = verknuepfbareJobs.find((j) => String(j.id) === wert);
    if (job) setzeAbtZeit(abteilzeitVon(job, settings));
  }

  function handleAgLotsen(wert: string) {
    setAgLotsen(wert);
    aktualisiereAgVerknuepfung(agJobId, wert);
  }

  /** EHF-Regel: nach Eingabe des best. Abgangs wird die Abteilzeit
   *  automatisch auf Abgang − 1 Std. gesetzt (bleibt danach editierbar). */
  function handleBestAbgang(wert: string) {
    setEhfBestAbgang(wert);
    const abgang = fromLocalInput(wert);
    if (abgang) setzeAbtZeit(new Date(abgang.getTime() - 3_600_000));
  }

  /** BHF-Regel: nach Eingabe der Besetz-Zeit wird die Abteilzeit
   *  automatisch auf Besetz-Zeit + 30 min gesetzt (bleibt danach editierbar). */
  function handleBesetzZeit(wert: string) {
    setBhfBesetzZeit(wert);
    const besetzt = fromLocalInput(wert);
    if (besetzt) setzeAbtZeit(new Date(besetzt.getTime() + 1_800_000));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (typ === "") return;
    onSubmit({
      id: initial?.id ?? 0,
      liste: "andere",
      typ,
      schiffsname:
        typ === "AG (Tender)" ? "Tender" : typ === "Nebelradar" ? undefined : schiffsname.trim() || undefined,
      kategorie: ohneSchiffsfelder(typ) ? undefined : kategorie || undefined,
      bemerkung: bemerkung.trim() || undefined,
      agJobId: typ === "AG" && agJobId !== "" ? Number(agJobId) : undefined,
      agLotsenAnzahl: (typ === "AG" || typ === "AG (Tender)") && agLotsen !== "" ? Number(agLotsen) : undefined,
      ehfBestAbgang: typ === "EHF" ? fromLocalInput(ehfBestAbgang) : undefined,
      ehfLotseBenoetigt: typ === "EHF" ? ehfLotse : undefined,
      bhfBesetzZeit: typ === "BHF" ? fromLocalInput(bhfBesetzZeit) : undefined,
      abtZeitManuell: ausDatumUndZeit(abtZeitDatum, abtZeitZeit),
      geschwindigkeitsklasse:
        mitSpeedAuswahl(typ) && geschwindigkeit !== "normal" ? geschwindigkeit : undefined,
    });
  }

  return (
    <form className="job-form" onSubmit={handleSubmit}>
      <div className="job-form__row">
        <label className="job-form__grow3">
          Type
          <select value={typ} onChange={(e) => handleTypChange(e.target.value as AnmeldungsTyp | "")} required>
            <option value="">–</option>
            {ANMELDUNGS_TYPEN.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Bei Type "AG"/"Nebelradar" ausgeblendet — bleibt aber im Layout,
          damit Ebene 3/4 nicht rutschen. */}
      <div className={ohneSchiffsfelder(typ) ? "job-form__row job-form__verborgen" : "job-form__row"}>
        <label className="job-form__grow3">
          Schiffsname
          <input value={schiffsname} onChange={(e) => setSchiffsname(e.target.value.toUpperCase())} />
        </label>
        <SchiffKatSelect value={kategorie} onChange={setKategorie} />
        {mitSpeedAuswahl(typ) && <SpeedSelect value={geschwindigkeit} onChange={setGeschwindigkeit} />}
      </div>

      <div className="job-form__row job-form__typfelder">
        {typ === "AG" && (
          <>
            <label className="job-form__grow2">
              Schiff (aus Hamburg/NOK)
              <select value={agJobId} onChange={(e) => handleAgJobId(e.target.value)}>
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
              <input type="number" min={1} value={agLotsen} onChange={(e) => handleAgLotsen(e.target.value)} />
            </label>
          </>
        )}
        {typ === "AG (Tender)" && (
          <>
            <span className="job-form__grow2" aria-hidden="true" />
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
          <>
            <span className="job-form__grow2" aria-hidden="true" />
            <label className="job-form__abtzeit-eingabe">
              Besetz-Zeit
              <input type="datetime-local" value={bhfBesetzZeit} onChange={(e) => handleBesetzZeit(e.target.value)} />
            </label>
          </>
        )}
      </div>

      <div className="job-form__row">
        <label className="job-form__half">
          Bemerkungen
          <input value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} />
        </label>
        <label>
          Datum
          <input type="date" value={abtZeitDatum} onChange={(e) => setAbtZeitDatum(e.target.value)} />
        </label>
        <label>
          Abt. Zeit
          <input
            type="time"
            value={abtZeitZeit}
            onChange={(e) => handleZeitMitPrefill(e.target.value, abtZeitDatum, setAbtZeitZeit, setAbtZeitDatum)}
          />
        </label>
      </div>

      <FormActions onDelete={onDelete} onCancel={onCancel} />
    </form>
  );
}
