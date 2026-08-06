/** localStorage-Persistenz für die manuell gepflegten Jobs/Lotsen-Daten.
 *  Date-Felder werden bei JSON.stringify automatisch zu ISO-Strings und
 *  müssen beim Laden wieder in Date-Objekte zurückverwandelt werden. */
import type { Abteilung, AktuelleFahrt, JobEintrag, LotsenEintrag } from "../data/types";

// v3: interne Job-ID (id) statt jobNr, AG-Verknüpfung über agJobId.
const JOBS_KEY = "wache.jobs.v3";
const JOBS_KEY_V2 = "wache.jobs.v2";
// v3: Fahrt/Abrufzeit/Törn-Zähler statt manueller Tafel/CB/BB-Textfelder.
const LOTSEN_KEY = "wache.lotsen.v3";
const LOTSEN_KEY_V2 = "wache.lotsen.v2";
const JOB_ID_ZAEHLER_KEY = "wache.jobid.v1";
const AKTUELLE_FAHRT_KEY = "wache.aktuelleFahrt.v1";
const LETZTE_V_NR_KEY = "wache.letzteVNr.v1";
const V_NR_START_KEY = "wache.vNrStart.v1";
const ABTEILUNGEN_KEY = "wache.abteilungen.v1";

const JOB_DATUM_FELDER = [
  "hh",
  "fkw",
  "stade",
  "geplAbgang",
  "holt",
  "ticker",
  "kuden",
  "ehfBestAbgang",
  "bhfBesetzZeit",
  "abtZeitManuell",
] as const;

function jobsAusJson(raw: string): JobEintrag[] {
  const eintraege = JSON.parse(raw) as Record<string, unknown>[];
  return eintraege.map((eintrag) => {
    const job: Record<string, unknown> = { ...eintrag };
    // Migration v2 -> v3: jobNr/agJobNr hießen früher anders
    if (job.id === undefined) job.id = job.jobNr;
    if (job.agJobId === undefined && job.agJobNr !== undefined) job.agJobId = job.agJobNr;
    delete job.jobNr;
    delete job.agJobNr;
    for (const feld of JOB_DATUM_FELDER) {
      const wert = eintrag[feld];
      job[feld] = typeof wert === "string" ? new Date(wert) : undefined;
    }
    return job as unknown as JobEintrag;
  });
}

export function ladeJobs(fallback: JobEintrag[]): JobEintrag[] {
  const raw = localStorage.getItem(JOBS_KEY) ?? localStorage.getItem(JOBS_KEY_V2);
  if (!raw) return fallback;
  try {
    return jobsAusJson(raw);
  } catch {
    return fallback;
  }
}

export function speichereJobs(jobs: JobEintrag[]): void {
  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
}

/** Nächste zu vergebende Job-ID: gespeicherter Zähler, sonst max(id)+1 der
 *  geladenen Jobs — so bleiben IDs auch nach Löschungen eindeutig. */
export function ladeJobIdZaehler(jobs: JobEintrag[]): number {
  const raw = localStorage.getItem(JOB_ID_ZAEHLER_KEY);
  const gespeichert = raw ? Number(raw) : Number.NaN;
  const mindestens = jobs.reduce((max, j) => Math.max(max, j.id), 0) + 1;
  return Number.isInteger(gespeichert) ? Math.max(gespeichert, mindestens) : mindestens;
}

export function speichereJobIdZaehler(wert: number): void {
  localStorage.setItem(JOB_ID_ZAEHLER_KEY, String(wert));
}

function lotsenAusJson(raw: string): LotsenEintrag[] {
  const eintraege = JSON.parse(raw) as Record<string, unknown>[];
  return eintraege.map((eintrag) => {
    const lotse: Record<string, unknown> = { ...eintrag };
    const wert = eintrag.anStationZeit;
    lotse.anStationZeit = typeof wert === "string" ? new Date(wert) : undefined;
    return lotse as unknown as LotsenEintrag;
  });
}

export function ladeLotsen(fallback: LotsenEintrag[]): LotsenEintrag[] {
  const rawV3 = localStorage.getItem(LOTSEN_KEY);
  if (rawV3) {
    try {
      return lotsenAusJson(rawV3);
    } catch {
      return fallback;
    }
  }
  // Migration v2 -> v3: Tafel/CB/BB entfallen (Fahrt#/BB werden jetzt aus
  // der Fahrt-Zuweisung berechnet), bem -> bemerkung, Rest defaultet.
  const rawV2 = localStorage.getItem(LOTSEN_KEY_V2);
  if (!rawV2) return fallback;
  try {
    const eintraege = JSON.parse(rawV2) as { name: string; kategorie?: string; bem?: string }[];
    return eintraege.map((eintrag) => ({
      name: eintrag.name,
      kategorie: eintrag.kategorie ?? "",
      fahrt: "",
      abrufStunden: undefined,
      elbehafen: false,
      toern2Plus2: 0,
      toernWb: 0,
      toernWr: 0,
      toernHulo: 0,
      bemerkung: eintrag.bem ?? "",
    }));
  } catch {
    return fallback;
  }
}

export function speichereLotsen(lotsen: LotsenEintrag[]): void {
  localStorage.setItem(LOTSEN_KEY, JSON.stringify(lotsen));
}

export function ladeAbteilungen(): Abteilung[] {
  const raw = localStorage.getItem(ABTEILUNGEN_KEY);
  if (!raw) return [];
  try {
    const eintraege = JSON.parse(raw) as Record<string, unknown>[];
    return eintraege.map((eintrag) => {
      const abteilung: Record<string, unknown> = { ...eintrag };
      const wert = eintrag.abteilZeit;
      abteilung.abteilZeit = typeof wert === "string" ? new Date(wert) : new Date(0);
      return abteilung as unknown as Abteilung;
    });
  } catch {
    return [];
  }
}

export function speichereAbteilungen(abteilungen: Abteilung[]): void {
  localStorage.setItem(ABTEILUNGEN_KEY, JSON.stringify(abteilungen));
}

export function ladeAktuelleFahrt(fallback: AktuelleFahrt): AktuelleFahrt {
  const raw = localStorage.getItem(AKTUELLE_FAHRT_KEY);
  return raw === "MoFa" || raw === "MiFa" || raw === "AFA" ? raw : fallback;
}

export function speichereAktuelleFahrt(fahrt: AktuelleFahrt): void {
  localStorage.setItem(AKTUELLE_FAHRT_KEY, fahrt);
}

export function ladeLetzteVNr(fallback: number): number {
  const raw = localStorage.getItem(LETZTE_V_NR_KEY);
  const wert = raw !== null ? Number(raw) : Number.NaN;
  return Number.isInteger(wert) && wert >= 0 && wert <= 999 ? wert : fallback;
}

export function speichereLetzteVNr(wert: number): void {
  localStorage.setItem(LETZTE_V_NR_KEY, String(wert));
}

/** Start-V-Nr. der Lotsen-Liste in der Einsatzplanung: wird beim ersten
 *  Aufruf einmalig aus "letzte V-Nr." + 1 gebildet und danach fest
 *  gespeichert — ändert sich nicht mehr automatisch mit, auch wenn die
 *  Settings-Wert später geändert wird. Erst ein Reset (noch nicht gebaut)
 *  soll ihn neu setzen. */
export function ladeVNrStart(letzteVNr: number): number {
  const raw = localStorage.getItem(V_NR_START_KEY);
  const gespeichert = raw !== null ? Number(raw) : Number.NaN;
  if (Number.isInteger(gespeichert)) return gespeichert;
  const start = letzteVNr + 1;
  localStorage.setItem(V_NR_START_KEY, String(start));
  return start;
}
