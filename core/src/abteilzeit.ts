import type { AbteilzeitSettings, Job, Zeitoffset } from "./types";

function addOffset(datum: Date, offset: Zeitoffset): Date {
  const ms = (offset.stunden * 60 + offset.minuten) * 60_000;
  return new Date(datum.getTime() + ms);
}

/**
 * Berechnet die voraussichtliche Abteilzeit eines Jobs in Brunsbüttel.
 *
 * Kernprinzip: nimm den genauesten verfügbaren Meldepunkt (spätester zuerst:
 * H vor G vor F) und rechne von dort mit einem festen Offset hoch — die
 * Schätzung wird also automatisch präziser, je weiter das Schiff fortschreitet.
 * Ein manueller Wert (`abteilungManuell`) sticht in jedem Routentyp alles aus.
 *
 * Destilliert aus Job-Liste::J (Formel-Spalte "ETA (Abteilung)").
 */
export function berechneAbteilzeit(job: Job, settings: AbteilzeitSettings): Date | undefined {
  const { routentyp, hhHoltenau, fkwTickerAbgang, stadeKuden, abteilungManuell } = job;

  if (routentyp === "NOK") {
    if (abteilungManuell) return abteilungManuell;
    if (stadeKuden) return addOffset(stadeKuden, settings.kudenAbteilung);
    // Kein Offset: G gilt bei NOK bereits als (grob) geschätzte Abteilzeit.
    return fkwTickerAbgang;
  }

  if (routentyp === "HH") {
    if (abteilungManuell) return abteilungManuell;
    if (stadeKuden) return addOffset(stadeKuden, settings.stadeAbteilung);
    if (fkwTickerAbgang) return addOffset(fkwTickerAbgang, settings.fkwAbteilung);
    if (hhHoltenau) return addOffset(hhHoltenau, settings.hhAbteilung);
    return undefined;
  }

  if (routentyp === "BÜTZ") {
    if (abteilungManuell) return abteilungManuell;
    if (stadeKuden) return addOffset(stadeKuden, settings.stadeAbteilung);
    if (fkwTickerAbgang) {
      const mitZuschlag = addOffset(fkwTickerAbgang, settings.buetzZuschlag);
      return addOffset(mitZuschlag, settings.stadeAbteilung);
    }
    return undefined;
  }

  // Sonstige Routentypen (z.B. "AG", "2+2", "1+1", "EHF (LNG)"): keine
  // Checkpoint-Berechnung, rein manuell.
  return routentyp ? abteilungManuell : undefined;
}
