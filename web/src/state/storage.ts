/** localStorage-Persistenz für die manuell gepflegten Jobs/Lotsen-Daten.
 *  Date-Felder werden bei JSON.stringify automatisch zu ISO-Strings und
 *  müssen beim Laden wieder in Date-Objekte zurückverwandelt werden. */
import type { Job } from "@wache/core";
import type { LotsenEintrag } from "../data/types";

const JOBS_KEY = "wache.jobs.v1";
const LOTSEN_KEY = "wache.lotsen.v1";

const JOB_DATUM_FELDER = ["hhHoltenau", "fkwTickerAbgang", "stadeKuden", "abteilungManuell"] as const;

export function ladeJobs(fallback: Job[]): Job[] {
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
      return job as unknown as Job;
    });
  } catch {
    return fallback;
  }
}

export function speichereJobs(jobs: Job[]): void {
  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
}

export function ladeLotsen(fallback: LotsenEintrag[]): LotsenEintrag[] {
  const raw = localStorage.getItem(LOTSEN_KEY);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as LotsenEintrag[];
  } catch {
    return fallback;
  }
}

export function speichereLotsen(lotsen: LotsenEintrag[]): void {
  localStorage.setItem(LOTSEN_KEY, JSON.stringify(lotsen));
}
