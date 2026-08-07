/**
 * Vorschau-Projektion: rechnet die Versorgungskette eine Stufe weiter
 * voraus als die IST-Daten. Lotsen, die in der Einsatzplanung einem Job
 * zugewiesen sind, werden zu ihrer geplanten Abteilzeit abfahren und
 * Abteilzeit + Anfahrt später auf der Seestation ankommen — die Vorschau
 * blendet sie dort als projizierte (blaue) Zeilen ein und rechnet sie in
 * die Schiffszuordnung ein. Jobs der Vergabe-Typen (SoRa/NeRa/2+2/1+1/
 * WB/WR) führen nicht zur Seestation und bleiben außen vor.
 */
import type { AbteilzeitSettings } from "@wache/core";
import type { Abteilung, AktuelleFahrt, JobEintrag, LotsenEintrag } from "../data/types";
import { benoetigteLotsenAnzahl, istOhneVNrJob, sortiereEintraege } from "./coreJob";
import { planeEinsatzstation } from "./planungEinsatzstation";
import { ANFAHRT_SEESTATION_MS, type SeestationZeile } from "./seestation";

export function projizierteSeestationZeilen(
  jobs: JobEintrag[],
  lotsen: LotsenEintrag[],
  aktuelleFahrt: AktuelleFahrt,
  abteilungen: Abteilung[],
  settings: AbteilzeitSettings,
): SeestationZeile[] {
  const abgeteiltProJob = new Map<number, number>();
  for (const a of abteilungen) abgeteiltProJob.set(a.jobId, (abgeteiltProJob.get(a.jobId) ?? 0) + 1);
  const jobsSortiert = sortiereEintraege(jobs, settings).filter(
    ({ eintrag }) => benoetigteLotsenAnzahl(eintrag) - (abgeteiltProJob.get(eintrag.id) ?? 0) > 0,
  );
  const zuweisungen = planeEinsatzstation(jobs, lotsen, aktuelleFahrt, settings, abgeteiltProJob);

  const zeilen: SeestationZeile[] = [];
  let laufNr = 0;
  for (const { eintrag: job, abteilzeit } of jobsSortiert) {
    if (!abteilzeit || istOhneVNrJob(job)) continue;
    for (const lotse of zuweisungen.get(job.id) ?? []) {
      laufNr += 1;
      zeilen.push({
        key: `vorschau-${laufNr}`,
        quelle: "abteilung",
        // negative Kunst-ID: kollidiert nie mit echten Datensätzen und die
        // Zeile ist ohnehin nicht anklickbar
        id: -laufNr,
        // ohne echte V-Nr. — Infinity sortiert die Projektion ans Listenende
        vNr: Number.POSITIVE_INFINITY,
        name: lotse.name,
        kategorie: lotse.kategorie,
        elbehafen: lotse.elbehafen,
        etaStn: new Date(abteilzeit.getTime() + ANFAHRT_SEESTATION_MS),
        aufStation: false,
        projiziert: true,
      });
    }
  }
  // innerhalb der Projektion nach Ankunftszeit sortieren
  return zeilen.sort((a, b) => (a.etaStn?.getTime() ?? 0) - (b.etaStn?.getTime() ?? 0));
}
