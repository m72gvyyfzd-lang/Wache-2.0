/** localStorage-Persistenz für die manuell gepflegten Jobs/Lotsen-Daten.
 *  Date-Felder werden bei JSON.stringify automatisch zu ISO-Strings und
 *  müssen beim Laden wieder in Date-Objekte zurückverwandelt werden. */
import type { JobEintrag, LotsenEintrag } from "../data/types";

// v2: listenfestes JobEintrag-Schema + Lotsen-Kategorie (altes v1-Schema
// wird nicht migriert — bewusst, es enthielt nur Demo-Daten).
const JOBS_KEY = "wache.jobs.v2";
const LOTSEN_KEY = "wache.lotsen.v2";

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

export function ladeJobs(fallback: JobEintrag[]): JobEintrag[] {
  const raw = localStorage.getItem(JOBS_KEY);
  if (!raw) return fallback;
  try {
    const eintraege = JSON.parse(raw) as Record<string, unknown>[];
    return eintraege.map((eintrag) => {
      const job: Record<string, unknown> = { ...eintrag };
      for (const feld of JOB_DATUM_FELDER) {
        const wert = eintrag[feld];
        job[feld] = typeof wert === "string" ? new Date(wert) : undefined;
      }
      return job as unknown as JobEintrag;
    });
  } catch {
    return fallback;
  }
}

export function speichereJobs(jobs: JobEintrag[]): void {
  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
}

export function ladeLotsen(fallback: LotsenEintrag[]): LotsenEintrag[] {
  const raw = localStorage.getItem(LOTSEN_KEY);
  if (!raw) return fallback;
  try {
    const eintraege = JSON.parse(raw) as (Omit<LotsenEintrag, "kategorie"> & { kategorie?: string })[];
    return eintraege.map((eintrag) => ({ ...eintrag, kategorie: eintrag.kategorie ?? "" }));
  } catch {
    return fallback;
  }
}

export function speichereLotsen(lotsen: LotsenEintrag[]): void {
  localStorage.setItem(LOTSEN_KEY, JSON.stringify(lotsen));
}
