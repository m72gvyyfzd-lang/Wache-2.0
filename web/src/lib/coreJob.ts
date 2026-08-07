/** Übersetzt den UI-Datentyp JobEintrag in den Berechnungstyp Job aus
 *  @wache/core und bündelt die darauf aufbauenden Helfer. */
import { berechneAbteilzeit } from "@wache/core";
import type { AbteilzeitSettings, Job } from "@wache/core";
import type { JobEintrag } from "../data/types";

export function zuCoreJob(eintrag: JobEintrag): Job {
  if (eintrag.liste === "hamburg") {
    return {
      jobNr: eintrag.id,
      // Bützfleth nutzt die BÜTZ-Formel: gepl. Abgang + 29 min + Stade-Offset
      // (der Abgang läuft dafür über das FkW/Ticker-Feld des core-Jobs).
      routentyp: eintrag.buetzfleth ? "BÜTZ" : "HH",
      hhHoltenau: eintrag.hh,
      fkwTickerAbgang: eintrag.buetzfleth ? eintrag.geplAbgang : eintrag.fkw,
      stadeKuden: eintrag.stade,
      abteilungManuell: eintrag.abtZeitManuell,
    };
  }
  if (eintrag.liste === "nok") {
    return {
      jobNr: eintrag.id,
      routentyp: "NOK",
      hhHoltenau: eintrag.holt,
      fkwTickerAbgang: eintrag.ticker,
      stadeKuden: eintrag.kuden,
      abteilungManuell: eintrag.abtZeitManuell,
    };
  }
  return {
    jobNr: eintrag.id,
    routentyp: eintrag.typ ?? "Anmeldung",
    abteilungManuell: eintrag.abtZeitManuell,
  };
}

export function abteilzeitVon(eintrag: JobEintrag, settings: AbteilzeitSettings): Date | undefined {
  return berechneAbteilzeit(zuCoreJob(eintrag), settings);
}

/** Anzeige für die Spalte "Von / Type": Herkunftsliste bzw. Anmeldungs-Typ.
 *  Sonderradar/Nebelradar werden abgekürzt, damit die Spalte schmal bleibt. */
export function vonTypeLabel(eintrag: JobEintrag): string {
  if (eintrag.liste === "hamburg") return eintrag.buetzfleth ? "Bütz" : "HH";
  if (eintrag.liste === "nok") return "NOK";
  if (eintrag.typ === "Sonderradar") return "SoRa";
  if (eintrag.typ === "Nebelradar") return "NeRa";
  return eintrag.typ ?? "?";
}

/** Anzahl benötigter Lotsen (Einsatzplanung, Spalte "Lots."). Jeder Job
 *  braucht standardmäßig genau einen Lotsen — Ausnahme AG, dort zählt
 *  agLotsenAnzahl (einstellbar im Job-Formular oder per Quick-Edit in der
 *  Einsatzplanung — beide schreiben dasselbe Feld). */
export function benoetigteLotsenAnzahl(eintrag: JobEintrag): number {
  if (eintrag.liste === "andere" && eintrag.typ === "AG") return eintrag.agLotsenAnzahl ?? 1;
  return 1;
}

/** Anmeldungs-Typen, für die zugewiesene Lotsen keine V-Nr. bekommen — sie
 *  landen beim Abteilen auf der Vergabe-Liste und fahren NICHT zur
 *  Seestation. */
export const OHNE_V_NR_TYPEN = new Set(["Sonderradar", "Nebelradar", "2+2", "1+1", "WB", "WR"]);

export function istOhneVNrJob(job: JobEintrag): boolean {
  return job.liste === "andere" && job.typ !== undefined && OHNE_V_NR_TYPEN.has(job.typ);
}

/** True, wenn ein AG-Job auf einen inzwischen gelöschten Hamburg/NOK-Job
 *  verweist — seine Abteilzeit wird dann nicht mehr über die
 *  updateJob-Kaskade aktualisiert (siehe DataContext). */
export function istVerwaisterAgJob(eintrag: JobEintrag, alleJobs: JobEintrag[]): boolean {
  if (eintrag.liste !== "andere" || eintrag.typ !== "AG" || eintrag.agJobId === undefined) return false;
  return !alleJobs.some((j) => j.id === eintrag.agJobId);
}

export interface EintragMitAbteilzeit {
  eintrag: JobEintrag;
  abteilzeit: Date | undefined;
}

/** Einheitliche Warteschlange: alle Einträge nach Abteilzeit aufsteigend,
 *  Einträge ohne berechenbare Abteilzeit ans Ende. */
export function sortiereEintraege(eintraege: JobEintrag[], settings: AbteilzeitSettings): EintragMitAbteilzeit[] {
  return eintraege
    .map((eintrag) => ({ eintrag, abteilzeit: abteilzeitVon(eintrag, settings) }))
    .sort((a, b) => {
      if (!a.abteilzeit && !b.abteilzeit) return 0;
      if (!a.abteilzeit) return 1;
      if (!b.abteilzeit) return -1;
      return a.abteilzeit.getTime() - b.abteilzeit.getTime();
    });
}
