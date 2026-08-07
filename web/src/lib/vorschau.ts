/**
 * Vorschau-Kandidaten: die FREIEN Lotsen der Einsatzstation — also die, die
 * von der "Planung Einsatzstation" noch KEINEM Job zugewiesen wurden (wer
 * einen Job hat, kommt ohnehin mit seinem Schiff nach draußen und taucht
 * dann regulär in der Versetzliste auf). Diese freien Lotsen könnten per
 * AG-Fahrt zur Seestation gebracht werden; ihre früheste Ankunft ist
 * jetzt + Anfahrt. Ob ein Kandidat wirklich gebraucht wird, entscheidet
 * die Vorausberechnung (simuliereSeestation) — nur die dort tatsächlich
 * eingeplanten Kandidaten werden als blaue Zeilen angezeigt.
 */
import type { AbteilzeitSettings } from "@wache/core";
import type { Abteilung, AktuelleFahrt, JobEintrag, LotsenEintrag } from "../data/types";
import { sortiereUndNummeriere } from "./lotsenOrdnung";
import { planeEinsatzstation } from "./planungEinsatzstation";
import { ANFAHRT_SEESTATION_MS, type SeestationZeile } from "./seestation";

export function vorschauKandidaten(
  jobs: JobEintrag[],
  lotsen: LotsenEintrag[],
  aktuelleFahrt: AktuelleFahrt,
  abteilungen: Abteilung[],
  settings: AbteilzeitSettings,
): SeestationZeile[] {
  const abgeteiltProJob = new Map<number, number>();
  for (const a of abteilungen) abgeteiltProJob.set(a.jobId, (abgeteiltProJob.get(a.jobId) ?? 0) + 1);
  const zuweisungen = planeEinsatzstation(jobs, lotsen, aktuelleFahrt, settings, abgeteiltProJob);
  const verplant = new Set<LotsenEintrag>();
  for (const liste of zuweisungen.values()) for (const lotse of liste) verplant.add(lotse);

  // FIFO-Reihenfolge der Lotsenliste; bereits Abgeteilte sind dort schon
  // ausgeblendet, Verplante fallen hier raus.
  const frei = sortiereUndNummeriere(lotsen, aktuelleFahrt)
    .map(({ eintrag }) => eintrag)
    .filter((lotse) => !verplant.has(lotse));

  const fruehesteAnkunft = new Date(Date.now() + ANFAHRT_SEESTATION_MS);
  return frei.map((lotse, i) => ({
    key: `vorschau-${i + 1}`,
    quelle: "abteilung",
    // negative Kunst-ID: kollidiert nie mit echten Datensätzen und die
    // Zeile ist ohnehin nicht anklickbar
    id: -(i + 1),
    // ohne echte V-Nr. — Infinity sortiert die Projektion ans Listenende
    vNr: Number.POSITIVE_INFINITY,
    name: lotse.name,
    kategorie: lotse.kategorie,
    elbehafen: lotse.elbehafen,
    etaStn: fruehesteAnkunft,
    aufStation: false,
    projiziert: true,
  }));
}
