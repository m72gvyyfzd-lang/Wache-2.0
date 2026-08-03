/** Übersetzt den UI-Datentyp JobEintrag in den Berechnungstyp Job aus
 *  @wache/core und bündelt die darauf aufbauenden Helfer. */
import { berechneAbteilzeit } from "@wache/core";
import type { AbteilzeitSettings, Job } from "@wache/core";
import type { JobEintrag } from "../data/types";

export function zuCoreJob(eintrag: JobEintrag): Job {
  if (eintrag.liste === "hamburg") {
    return {
      jobNr: eintrag.jobNr,
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
      jobNr: eintrag.jobNr,
      routentyp: "NOK",
      hhHoltenau: eintrag.holt,
      fkwTickerAbgang: eintrag.ticker,
      stadeKuden: eintrag.kuden,
      abteilungManuell: eintrag.abtZeitManuell,
    };
  }
  return {
    jobNr: eintrag.jobNr,
    routentyp: eintrag.typ ?? "Anmeldung",
    abteilungManuell: eintrag.abtZeitManuell,
  };
}

export function abteilzeitVon(eintrag: JobEintrag, settings: AbteilzeitSettings): Date | undefined {
  return berechneAbteilzeit(zuCoreJob(eintrag), settings);
}

/** Anzeige für die Spalte "Von / Type": Herkunftsliste bzw. Anmeldungs-Typ. */
export function vonTypeLabel(eintrag: JobEintrag): string {
  if (eintrag.liste === "hamburg") return eintrag.buetzfleth ? "Bütz" : "HH";
  if (eintrag.liste === "nok") return "NOK";
  return eintrag.typ ?? "?";
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
