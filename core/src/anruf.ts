import { berechneAbteilzeit } from "./abteilzeit";
import type { AbteilzeitSettings, Ampelstatus, Job, Katstatus, Lotse } from "./types";

const STANDARD_VORLAUF_MINUTEN = 60;

/** Routentypen, die keinen automatischen Anruf auslösen (Sonder-Wachblöcke). */
const KEIN_ANRUF_ROUTEN = new Set(["2+2", "1+1"]);

/**
 * Berechnet die Anrufzeit eines Lotsen: Abteilzeit des zugeordneten Jobs
 * minus individueller Vorlauf (Standard 1h, überschreibbar pro Lotse).
 *
 * Destilliert aus Lotsen::H (Formel-Spalte "Abruf um…").
 */
export function berechneAnrufzeit(
  lotse: Lotse,
  job: Job | undefined,
  settings: AbteilzeitSettings,
): Date | undefined {
  if (!job || lotse.jobNr == null) return undefined;
  if (KEIN_ANRUF_ROUTEN.has(job.routentyp)) return undefined;

  const abteilzeit = berechneAbteilzeit(job, settings);
  if (!abteilzeit) return undefined;

  const vorlaufMinuten =
    lotse.vorlaufStunden != null ? Math.round(lotse.vorlaufStunden * 60) : STANDARD_VORLAUF_MINUTEN;

  return new Date(abteilzeit.getTime() - vorlaufMinuten * 60_000);
}

/**
 * Ampel-Status für die Anruf-Übersicht.
 *
 * Destilliert aus Lotsen::J (Formel-Spalte "Time Check").
 */
export function berechneAmpelstatus(lotse: Lotse, anrufzeit: Date | undefined, jetzt: Date): Ampelstatus {
  if (!anrufzeit) return "";
  if (lotse.abgerufen) return "✅";
  if (anrufzeit <= jetzt) return "! abrufen !";
  return "";
}

/**
 * Eignungsprüfung: passt die Job-Kategorie zur Lotsenkategorie, und ist der
 * Lotse für EHF/LNG-Jobs qualifiziert?
 *
 * Zahlenskala 1–8, höhere Zahl = anspruchsvoller. Ein leeres Kategoriefeld
 * beim Lotsen gilt als voll qualifiziert (Default 8) — genau wie ein
 * fehlendes Job-Kategoriefeld. Text-Job-Kategorien (z.B. "AGF3/7") werden
 * wie Kategorie 8 (höchste Stufe) behandelt: das löst die Warnung nur bei
 * Lotsen mit einer *explizit* niedrigeren eigenen Kategorie aus, nicht bei
 * Lotsen mit leerem (= Default 8) Feld.
 *
 * Destilliert aus Lotsen::I (Formel-Spalte "Kat. Check").
 */
export function berechneKatCheck(lotse: Lotse, job: Job | undefined): Katstatus {
  if (!job || lotse.jobNr == null) return "";

  const jobKatEffektiv = typeof job.kategorie === "number" ? job.kategorie : 8;
  const eigeneKat = lotse.eigeneKategorie ?? 8;

  if (jobKatEffektiv > eigeneKat) return "! ! !";
  if (job.routentyp === "EHF (LNG)" && !lotse.ehfQualifiziert) return "EHF!";
  return "";
}

/**
 * Nächste laufende Aufrufnummer (A-Nr.), fortgeschrieben ab der Nummer der
 * Vorzeile/des Vortages. Kein Nummernsprung für nicht-relevante Lotsen.
 *
 * Destilliert aus Lotsen::Q (Formel-Spalte "A-Nr.").
 *
 * Hinweis: im Original sprang die Formel an einer Stelle inkonsistent auf
 * spätere statt frühere Zeilen (vermutlich ein beim Kopieren verrutschter
 * Bezug) — hier bewusst vereinheitlicht auf die konsistente Variante, die
 * nur den Zustand des eigenen Lotsen prüft.
 */
export function naechsteAufrufnummer(
  lotse: Pick<Lotse, "abgerufen">,
  preview: boolean,
  vorherigeNummer: number,
): number | undefined {
  if (lotse.abgerufen || preview) return vorherigeNummer + 1;
  return undefined;
}
