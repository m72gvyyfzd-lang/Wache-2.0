/**
 * Listenvergabe: Zuweisung der Vergabe-Dienste 1+1, 2+2, HuLo, WB und WR.
 *
 * Diese Jobs unterliegen NICHT dem FIFO-Grundsatz ("erster Lotse bekommt
 * ersten Job"), sondern gehen an den Lotsen mit dem GERINGSTEN Törnstand
 * aus einer Gruppe von 4 Kandidaten:
 *
 * - WR: die ersten 4 Lotsen der AKTUELLEN Fahrt-Gruppe.
 * - WB/2+2/1+1/HuLo: die ersten 4 Lotsen, die nicht als "abgerufen" gelten
 *   (siehe istAbgerufen) — für den Start der Zählung wird die Kat. NICHT
 *   berücksichtigt, abgerufene Jobs verbrauchen ihre Lotsen positionsweise
 *   von oben (AG/Tender mit ihrer Lotsenanzahl).
 *
 * Die Gruppe besteht aus den ersten 4 Lotsen (ab dem jeweiligen
 * Zählstart), die den Job auch wirklich übernehmen KÖNNEN: Schiffs-Kat.
 * fahren dürfen (Schiff<>Lotsen-Kat.-Regel), Kat. >= 4 (darfJobTyp) und
 * Törnstand > 0 in der passenden Spalte (0 = keine Teilnahme am Dienst).
 * Wer eine Bedingung nicht erfüllt, wird übersprungen und zählt nicht zur
 * Gruppe — gesucht wird so lange, bis 4 Lotsen gefunden sind (notfalls
 * bleibt die Gruppe kleiner). Der geringste Törnstand gewinnt; bei
 * Gleichstand die frühere Listenposition.
 */
import {
  darfFahren,
  darfJobTyp,
  istListenvergabeTyp,
  TOERN_SPALTE,
  type AbteilzeitSettings,
  type ListenvergabeTyp,
} from "@wache/core";
import type { AktuelleFahrt, JobEintrag, LotsenEintrag } from "../data/types";
import { abteilzeitVon, benoetigteLotsenAnzahl } from "./coreJob";

/** Größe der Kandidaten-Gruppe ("die ersten 4 Lotsen"). */
export const VERGABE_GRUPPE = 4;

export function istListenvergabeJob(job: JobEintrag): boolean {
  return job.liste === "andere" && istListenvergabeTyp(job.typ);
}

/** Törnstand des Lotsen für den Dienst des Jobs (1+1 zählt auf der
 *  2+2-Spalte). 0 bedeutet: nimmt nicht am Dienst teil. */
export function toernStand(lotse: LotsenEintrag, typ: ListenvergabeTyp): number {
  switch (TOERN_SPALTE[typ]) {
    case "2+2":
      return lotse.toern2Plus2;
    case "WB":
      return lotse.toernWb;
    case "WR":
      return lotse.toernWr;
    case "HuLo":
      return lotse.toernHulo;
  }
}

function nimmtTeil(lotse: LotsenEintrag, typ: ListenvergabeTyp): boolean {
  return darfJobTyp(typ, lotse.kategorie) && toernStand(lotse, typ) > 0;
}

function istGeeignet(job: JobEintrag, lotse: LotsenEintrag, typ: ListenvergabeTyp): boolean {
  return nimmtTeil(lotse, typ) && darfFahren(job.kategorie ?? "", lotse.kategorie);
}

/**
 * Gilt der Job zur Vergabezeit als "abgerufen"? Dann sind seine Lotsen
 * für die Gruppenbildung der Listenvergabe bereits gebunden.
 *
 * - HH: sobald eine FkW-Zeit eingetragen ist.
 * - Bütz: sobald eine Stade-Zeit eingetragen ist — außer gepl. Bunkern.
 * - NOK: Holtenau-Zeit + 4 Std. liegt vor der Vergabezeit — außer gepl.
 *   Bunkern.
 * - EHF/Sonderradar/Nebelradar/AG (Tender): 1 Std. vor Abteilzeit liegt
 *   vor der Vergabezeit.
 * - BHF: 1 Std. vor der Besetz-Zeit liegt vor der Vergabezeit.
 * - AG: wie ihr Trägerschiff (die Lotsenanzahl zählt über
 *   benoetigteLotsenAnzahl mehrfach).
 * - Listenvergabe-Jobs selbst zählen nie als abgerufen.
 */
export function istAbgerufen(
  job: JobEintrag,
  vergabeZeit: Date,
  alleJobs: JobEintrag[],
  settings: AbteilzeitSettings,
): boolean {
  if (job.liste === "hamburg") {
    if (job.buetzfleth) return job.stade !== undefined && !job.geplBunkern;
    return job.fkw !== undefined;
  }
  if (job.liste === "nok") {
    if (job.geplBunkern || !job.holt) return false;
    return job.holt.getTime() + 4 * 3_600_000 < vergabeZeit.getTime();
  }
  // Liste "Andere"
  if (istListenvergabeTyp(job.typ)) return false;
  if (job.typ === "AG") {
    const traeger = alleJobs.find((j) => j.id === job.agJobId);
    return traeger ? istAbgerufen(traeger, vergabeZeit, alleJobs, settings) : false;
  }
  if (job.typ === "BHF") {
    if (!job.bhfBesetzZeit) return false;
    return job.bhfBesetzZeit.getTime() - 3_600_000 < vergabeZeit.getTime();
  }
  // EHF, Sonderradar, Nebelradar, AG (Tender): 1 Std. vor Abteilzeit
  const abteilzeit = abteilzeitVon(job, settings);
  if (!abteilzeit) return false;
  return abteilzeit.getTime() - 3_600_000 < vergabeZeit.getTime();
}

/** Törn-Zählfeld des Lotsen für ein Abteilungs-typLabel (die Vergabe-Typen
 *  laufen unverkürzt durch vonTypeLabel) — Grundlage der automatischen
 *  ±1-Zählung beim Abteilen bzw. Rückgängigmachen. */
export function toernFeldFuerTypLabel(
  typLabel: string,
): "toern2Plus2" | "toernWb" | "toernWr" | "toernHulo" | undefined {
  if (!istListenvergabeTyp(typLabel)) return undefined;
  switch (TOERN_SPALTE[typLabel]) {
    case "2+2":
      return "toern2Plus2";
    case "WB":
      return "toernWb";
    case "WR":
      return "toernWr";
    case "HuLo":
      return "toernHulo";
  }
}

export interface VergabePlanung {
  typ: ListenvergabeTyp;
  /** die Kandidaten-Gruppe ("in der Zählung") in Listenreihenfolge */
  gruppe: LotsenEintrag[];
  /** der Lotse mit dem geringsten Törnstand (bzw. der erste Nachrücker) */
  gewinner?: LotsenEintrag;
}

/**
 * Ermittelt Gruppe und Gewinner einer einzelnen Listenvergabe.
 *
 * `kandidaten` ist die volle Lotsenliste in Anzeige-Reihenfolge (bereits
 * ohne abgeteilte Lotsen und ohne Gewinner früher geplanter Vergaben).
 */
export function planeListenvergabe(
  job: JobEintrag,
  kandidaten: LotsenEintrag[],
  alleJobs: JobEintrag[],
  settings: AbteilzeitSettings,
  aktuelleFahrt: AktuelleFahrt,
  abgeteiltProJob?: Map<number, number>,
): VergabePlanung {
  const typ = job.typ as ListenvergabeTyp;
  const vergabeZeit = abteilzeitVon(job, settings) ?? new Date();

  let reihe: LotsenEintrag[];
  if (typ === "WR") {
    // NACH der bestehenden Fahrt: die Zählung beginnt hinter dem letzten
    // Lotsen der aktuellen Fahrt-Gruppe (die steht in der Ordnung vorn) —
    // bei aktueller Fahrt AFA also ab dem ersten Nicht-AFA-Lotsen.
    let start = 0;
    while (start < kandidaten.length && kandidaten[start].fahrt === aktuelleFahrt) start += 1;
    reihe = kandidaten.slice(start);
  } else {
    // Abgerufen-Zählung: jeder abgerufene Job bindet seine (noch nicht
    // abgeteilten) Lotsen positionsweise von oben — ohne Kat.-Prüfung.
    let gebunden = 0;
    for (const j of alleJobs) {
      if (j.id === job.id) continue;
      if (!istAbgerufen(j, vergabeZeit, alleJobs, settings)) continue;
      const rest = benoetigteLotsenAnzahl(j) - (abgeteiltProJob?.get(j.id) ?? 0);
      gebunden += Math.max(0, rest);
    }
    reihe = kandidaten.slice(gebunden);
  }

  // Gruppe: die ersten 4 GEEIGNETEN Lotsen ab dem Zählstart — wer das
  // Schiff nicht fahren darf oder nicht am Dienst teilnimmt, wird
  // übersprungen; gesucht wird durch die ganze Liste, bis 4 gefunden sind.
  const gruppe: LotsenEintrag[] = [];
  for (const lotse of reihe) {
    if (gruppe.length >= VERGABE_GRUPPE) break;
    if (istGeeignet(job, lotse, typ)) gruppe.push(lotse);
  }

  // geringster Törnstand gewinnt; bei Gleichstand die frühere Listenposition
  // (reduce ersetzt nur bei echt kleinerem Törn).
  const gewinner =
    gruppe.length > 0
      ? gruppe.reduce((best, l) => (toernStand(l, typ) < toernStand(best, typ) ? l : best))
      : undefined;

  return { typ, gruppe, gewinner };
}
