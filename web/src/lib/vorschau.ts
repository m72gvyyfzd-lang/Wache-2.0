/**
 * Vorschau-Projektion: rechnet die Versorgungskette eine Stufe weiter
 * voraus als die IST-Daten, in zwei Gruppen:
 *
 * - VERPLANTE Lotsen (orange): von der "Planung Einsatzstation" bereits
 *   einem Job zugewiesen — sie fahren zur geplanten Abteilzeit ab und
 *   kommen Abteilzeit + Anfahrt später auf der Seestation an. Jobs der
 *   Vergabe-Typen (SoRa/NeRa/2+2/1+1/WB/WR) führen nicht zur Seestation
 *   und bleiben außen vor.
 * - FREIE Lotsen (blau): noch keinem Job zugewiesen — Kandidaten, die per
 *   AG-Fahrt geholt werden könnten; früheste Ankunft jetzt + Anfahrt. Ob
 *   ein Kandidat wirklich gebraucht wird, entscheidet die Vorausberechnung
 *   (simuliereSeestation) — nur die dort tatsächlich eingeplanten
 *   Kandidaten werden angezeigt.
 */
import type { AbteilzeitSettings } from "@wache/core";
import type { Abteilung, AktuelleFahrt, JobEintrag, LotsenEintrag } from "../data/types";
import { benoetigteLotsenAnzahl, istOhneVNrJob, sortiereEintraege } from "./coreJob";
import { sortiereUndNummeriere } from "./lotsenOrdnung";
import { planeEinsatzstation } from "./planungEinsatzstation";
import { ANFAHRT_SEESTATION_MS, type SeestationZeile } from "./seestation";

export interface VorschauZeilen {
  /** Lotsen mit Job: Ankunft = Abteilzeit + Anfahrt (orange, immer sichtbar) */
  verplante: SeestationZeile[];
  /** Lotsen ohne Job: Ankunft = jetzt + Anfahrt (blau, nur wenn benötigt) */
  freie: SeestationZeile[];
}

export function vorschauZeilen(
  jobs: JobEintrag[],
  lotsen: LotsenEintrag[],
  aktuelleFahrt: AktuelleFahrt,
  abteilungen: Abteilung[],
  settings: AbteilzeitSettings,
): VorschauZeilen {
  const abgeteiltProJob = new Map<number, number>();
  for (const a of abteilungen) abgeteiltProJob.set(a.jobId, (abgeteiltProJob.get(a.jobId) ?? 0) + 1);
  const zuweisungen = planeEinsatzstation(jobs, lotsen, aktuelleFahrt, settings, abgeteiltProJob);
  const verplantSet = new Set<LotsenEintrag>();
  for (const liste of zuweisungen.values()) for (const lotse of liste) verplantSet.add(lotse);

  // Gemeinsame Zeilen-Fabrik: negative Kunst-IDs kollidieren nie mit echten
  // Datensätzen (die Zeilen sind ohnehin nicht anklickbar); ohne echte
  // V-Nr. — Infinity sortiert die Projektion ans Listenende.
  let laufNr = 0;
  function zeile(lotse: LotsenEintrag, etaStn: Date, art: "verplant" | "frei"): SeestationZeile {
    laufNr += 1;
    return {
      key: `vorschau-${laufNr}`,
      quelle: "abteilung",
      id: -laufNr,
      vNr: Number.POSITIVE_INFINITY,
      name: lotse.name,
      kategorie: lotse.kategorie,
      elbehafen: lotse.elbehafen,
      etaStn,
      aufStation: false,
      projiziert: art,
    };
  }

  const jobsSortiert = sortiereEintraege(jobs, settings).filter(
    ({ eintrag }) => benoetigteLotsenAnzahl(eintrag) - (abgeteiltProJob.get(eintrag.id) ?? 0) > 0,
  );
  const verplante: SeestationZeile[] = [];
  for (const { eintrag: job, abteilzeit } of jobsSortiert) {
    if (!abteilzeit || istOhneVNrJob(job)) continue;
    for (const lotse of zuweisungen.get(job.id) ?? []) {
      verplante.push(zeile(lotse, new Date(abteilzeit.getTime() + ANFAHRT_SEESTATION_MS), "verplant"));
    }
  }
  verplante.sort((a, b) => (a.etaStn?.getTime() ?? 0) - (b.etaStn?.getTime() ?? 0));

  // FIFO-Reihenfolge der Lotsenliste; bereits Abgeteilte sind dort schon
  // ausgeblendet, Verplante fallen hier raus.
  const fruehesteAnkunft = new Date(Date.now() + ANFAHRT_SEESTATION_MS);
  const freie = sortiereUndNummeriere(lotsen, aktuelleFahrt)
    .map(({ eintrag }) => eintrag)
    .filter((lotse) => !verplantSet.has(lotse))
    .map((lotse) => zeile(lotse, fruehesteAnkunft, "frei"));

  return { verplante, freie };
}
