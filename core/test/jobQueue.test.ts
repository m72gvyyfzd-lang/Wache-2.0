import { describe, expect, it } from "vitest";
import { sortiereJobsNachAbteilzeit } from "../src/jobQueue";
import { getAbteilzeitSettings } from "../src/settings";
import type { Job } from "../src/types";

const settings = getAbteilzeitSettings("Wechsel Tide");
const d = (iso: string) => new Date(iso);

describe("sortiereJobsNachAbteilzeit", () => {
  it("führt HH-, NOK- und Anmeldungs-Jobs in einer gemeinsamen, nach Abteilzeit sortierten Warteschlange zusammen", () => {
    const jobs: Job[] = [
      // HH-Job über FkW-Checkpoint: Abteilzeit 09:00 + 2:45 = 11:45
      { jobNr: 1, routentyp: "HH", fkwTickerAbgang: d("2026-08-02T09:00:00Z") },
      // NOK-Job über Kuden-Checkpoint: Abteilzeit 08:00 + 1:00 = 09:00
      { jobNr: 2, routentyp: "NOK", stadeKuden: d("2026-08-02T08:00:00Z") },
      // Anmeldung (Radar): Abteilzeit = direkt der angemeldete Zeitpunkt
      { jobNr: 3, routentyp: "Radar", bezeichnung: "Radar", abteilungManuell: d("2026-08-02T10:00:00Z") },
    ];

    const sortiert = sortiereJobsNachAbteilzeit(jobs, settings);

    expect(sortiert.map((s) => s.job.jobNr)).toEqual([2, 3, 1]);
    expect(sortiert[0].abteilzeit).toEqual(d("2026-08-02T09:00:00Z"));
    expect(sortiert[1].abteilzeit).toEqual(d("2026-08-02T10:00:00Z"));
    expect(sortiert[2].abteilzeit).toEqual(d("2026-08-02T11:45:00Z"));
  });

  it("sortiert Jobs ohne berechenbare Abteilzeit ans Ende, statt sie zu verwerfen", () => {
    const jobs: Job[] = [
      { jobNr: 1, routentyp: "HH" }, // kein Checkpoint -> keine Abteilzeit
      { jobNr: 2, routentyp: "NOK", stadeKuden: d("2026-08-02T08:00:00Z") },
    ];

    const sortiert = sortiereJobsNachAbteilzeit(jobs, settings);

    expect(sortiert.map((s) => s.job.jobNr)).toEqual([2, 1]);
    expect(sortiert[1].abteilzeit).toBeUndefined();
  });
});
