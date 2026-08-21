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
 *   AG-Fahrt geholt werden könnten. Früheste Ankunft ist das Minimum aus
 *   dem frühesten künftigen Trägerjob (Abteilzeit + Anfahrt) und einer
 *   Tender-AG (jetzt + 3 Std. Vorlauf + Anfahrt) — dieselbe Rechnung wie
 *   die AG-Vorschläge des Dashboards (lib/meldungen.ts). Ob ein Kandidat
 *   wirklich gebraucht wird, entscheidet die Zuteilung
 *   (lib/seestationAbteilen.ts::planeSeestation) — nur die dort tatsächlich
 *   eingeplanten Kandidaten werden angezeigt.
 *
 * Jede Zeile trägt ihre POTENTIELLE V-Nr. (dieselbe Berechnung wie die
 * V-Nr.-Spalte der Einsatzplanung, siehe lib/vNrPlanung.ts) — damit
 * sortieren sich die Vorschau-Lotsen in der "Auf Seestation"-Liste an die
 * Stelle, an der sie später auch wirklich stehen würden.
 */
import type { AbteilzeitSettings } from "@wache/core";
import type { Abteilung, AktuelleFahrt, JobEintrag, LotsenEintrag } from "../data/types";
import { benoetigteLotsenAnzahl, istOhneVNrJob, seeReiseInfoVon, sortiereEintraege } from "./coreJob";
import { sortiereUndNummeriere } from "./lotsenOrdnung";
import { planeEinsatzstation } from "./planungEinsatzstation";
import { ANFAHRT_SEESTATION_MS, seeAnkunftAb, TENDER_VORLAUF_MS, type SeestationZeile } from "./seestation";
import { berechnePotentielleVNrn } from "./vNrPlanung";

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
  vNrStart: number,
  verbrauchteVNrn: number[],
  jetzt: Date,
): VorschauZeilen {
  const abgeteiltProJob = new Map<number, number>();
  for (const a of abteilungen) abgeteiltProJob.set(a.jobId, (abgeteiltProJob.get(a.jobId) ?? 0) + 1);
  const zuweisungen = planeEinsatzstation(jobs, lotsen, aktuelleFahrt, settings, abgeteiltProJob);
  const verplantSet = new Set<LotsenEintrag>();
  for (const liste of zuweisungen.values()) for (const lotse of liste) verplantSet.add(lotse);

  const jobsSortiert = sortiereEintraege(jobs, settings).filter(
    ({ eintrag }) => benoetigteLotsenAnzahl(eintrag) - (abgeteiltProJob.get(eintrag.id) ?? 0) > 0,
  );
  const lotsenSortiert = sortiereUndNummeriere(lotsen, aktuelleFahrt);
  const { vNrProLotse } = berechnePotentielleVNrn(jobsSortiert, lotsenSortiert, zuweisungen, vNrStart, verbrauchteVNrn);

  // Gemeinsame Zeilen-Fabrik: negative Kunst-IDs kollidieren nie mit echten
  // Datensätzen (die Zeilen sind ohnehin nicht anklickbar); ohne potentielle
  // V-Nr. sortiert Infinity ans Listenende.
  let laufNr = 0;
  function zeile(lotse: LotsenEintrag, etaStn: Date, art: "verplant" | "frei"): SeestationZeile {
    laufNr += 1;
    return {
      key: `vorschau-${laufNr}`,
      quelle: "abteilung",
      id: -laufNr,
      vNr: vNrProLotse.get(lotse) ?? Number.POSITIVE_INFINITY,
      name: lotse.name,
      kategorie: lotse.kategorie,
      elbehafen: lotse.elbehafen,
      etaStn,
      aufStation: false,
      projiziert: art,
    };
  }

  const verplante: SeestationZeile[] = [];
  for (const { eintrag: job, abteilzeit } of jobsSortiert) {
    // EHF-Wache: der Lotse wird beim Abteilen direkt "Ankert" gesetzt und
    // fährt gar nicht erst zur Seestation — taucht daher auch in der
    // Vorschau nicht als ankommender Lotse auf.
    if (!abteilzeit || istOhneVNrJob(job) || job.ehfWache) continue;
    // Überfällige Jobs (Abteilzeit schon vorbei) fahren frühestens jetzt ab
    // — sonst gälte der Lotse fälschlich als längst angekommen.
    const abfahrt = new Date(Math.max(abteilzeit.getTime(), jetzt.getTime()));
    const seeReise = seeReiseInfoVon(job, jobs);
    const etaStn = seeAnkunftAb(abfahrt, seeReise?.herkunft, seeReise?.klasse);
    for (const lotse of zuweisungen.get(job.id) ?? []) {
      verplante.push(zeile(lotse, etaStn, "verplant"));
    }
  }

  // Früheste AG-Ankunft eines freien Lotsen: nächster künftiger Trägerjob
  // (Hamburg/NOK, wie die Dashboard-Vorschläge) oder ersatzweise Tender-AG.
  const naechsterTraeger = sortiereEintraege(jobs, settings).find(
    (p) =>
      (p.eintrag.liste === "hamburg" || p.eintrag.liste === "nok") &&
      p.abteilzeit !== undefined &&
      p.abteilzeit.getTime() >= jetzt.getTime(),
  )?.abteilzeit;
  const tenderAnkunft = jetzt.getTime() + TENDER_VORLAUF_MS + ANFAHRT_SEESTATION_MS;
  const fruehesteAnkunft = new Date(
    naechsterTraeger ? Math.min(naechsterTraeger.getTime() + ANFAHRT_SEESTATION_MS, tenderAnkunft) : tenderAnkunft,
  );

  // FIFO-Reihenfolge der Lotsenliste; bereits Abgeteilte sind dort schon
  // ausgeblendet, Verplante fallen hier raus.
  const freie = lotsenSortiert
    .map(({ eintrag }) => eintrag)
    .filter((lotse) => !verplantSet.has(lotse))
    .map((lotse) => zeile(lotse, fruehesteAnkunft, "frei"));

  return { verplante, freie };
}
