/**
 * "Verhinderung" (Einsatzstation Brunsbüttel): aus wiederkehrenden
 * Bemerkungen erkannte bzw. manuell gesetzte Markierungen, die einen Lotsen
 * für Listenvergabe, Fahrtaufmachung und Abteilung Einsatzstation
 * gleichermaßen auf "Nein" schalten (siehe LotsenEintrag in data/types.ts).
 *
 * Drei unabhängig schaltbare Quellen, jede für sich ausreichend:
 * - §30
 * - "<Zahl>FT" (Freie Tage) — nur die Tatsache zählt, nicht die Anzahl.
 * - "TA/FT" + Datum + Fahrt: der Lotse gilt als zurück, sobald entweder das
 *   hinterlegte Datum der heutige Tag ist ODER die hinterlegte Fahrt die
 *   direkt auf die aktuelle Fahrt folgende ist — bis dahin bleibt er
 *   verhindert.
 *
 * Einziger Ort dieser Regel — Listenvergabe (listenvergabe.ts), Abteilung
 * Einsatzstation (planungEinsatzstation.ts) und Fahrtaufmachung
 * (lib/boertVorschau.ts bzw. pages/FahrtPlanung.tsx) fragen alle hier an,
 * damit sich die drei "Nein" nie auseinanderentwickeln.
 */
import type { AktuelleFahrt, LotsenEintrag } from "../data/types";
import { folgeFahrt } from "./fahrtplanung";

function istGleicherTag(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function istVerhindert(lotse: LotsenEintrag, aktuelleFahrt: AktuelleFahrt, jetzt: Date): boolean {
  if (lotse.verhinderungParagraph30) return true;
  if (lotse.verhinderungFt) return true;
  const taFt = lotse.verhinderungTaFt;
  if (taFt) {
    const istHeute = istGleicherTag(taFt.datum, jetzt);
    const istFolgefahrt = taFt.fahrt === folgeFahrt(aktuelleFahrt);
    if (!istHeute && !istFolgefahrt) return true;
  }
  return false;
}
