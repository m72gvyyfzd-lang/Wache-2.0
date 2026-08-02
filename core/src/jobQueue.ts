import { berechneAbteilzeit } from "./abteilzeit";
import type { AbteilzeitSettings, Job } from "./types";

export interface JobMitAbteilzeit {
  job: Job;
  abteilzeit: Date | undefined;
}

/**
 * Liefert alle anstehenden Jobs (unabhängig von der Herkunft — HH, NOK,
 * Anmeldungen, ...) sortiert nach berechneter Abteilzeit, aufsteigend.
 *
 * Das ist die "eine" Jobs-Warteschlange aus dem Grundprinzip: HH- und
 * NOK-Checkpoints sowie manuell angemeldete Jobs laufen hier zusammen und
 * werden einheitlich nach Abteilzeit geordnet — im Normalfall entspricht
 * die Position in dieser Liste direkt der Position in der Lotsen-Warteschlange,
 * mit der sie Zeile für Zeile abgeglichen wird.
 *
 * Jobs ohne berechenbare Abteilzeit (z.B. fehlende Checkpoints und kein
 * manueller Wert) werden ans Ende sortiert, nicht verworfen — sie bleiben
 * sichtbar, aber unten in der Liste.
 */
export function sortiereJobsNachAbteilzeit(jobs: Job[], settings: AbteilzeitSettings): JobMitAbteilzeit[] {
  return jobs
    .map((job) => ({ job, abteilzeit: berechneAbteilzeit(job, settings) }))
    .sort((a, b) => {
      if (!a.abteilzeit && !b.abteilzeit) return 0;
      if (!a.abteilzeit) return 1;
      if (!b.abteilzeit) return -1;
      return a.abteilzeit.getTime() - b.abteilzeit.getTime();
    });
}
