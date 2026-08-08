/**
 * Kategorien-Regelwerk: Schiffs- und Lotsenkategorien und die Prüfung,
 * welcher Lotse welchen Job fahren darf.
 *
 * Kategorien werden als Text gespeichert und angezeigt (z.B. "AGF 3/7",
 * "3+"); nur für den Vergleich wird intern ein Zahlenrang gebildet.
 */

/** Schiffskategorien nach Größe (Länge, Breite, Tiefgang).
 *  AGF = Außergewöhnlich Großes Fahrzeug. */
export const SCHIFFS_KATEGORIEN = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "AGF 1",
  "AGF 1/7",
  "AGF 2",
  "AGF 2/7",
  "AGF 3",
  "AGF 3/7",
  "AGF 3+",
] as const;

export type SchiffsKategorie = (typeof SCHIFFS_KATEGORIEN)[number];

/** Lotsenkategorien nach Erfahrungsstand. "" = Volllotse (keine Zahl hinter
 *  dem Namen), darf jeden Job machen. "3+" = Kat. 3 mit Zusatzrechten:
 *  Sonderradar, Nebelradar und 2. Lotse einkommend. */
export const LOTSEN_KATEGORIEN = ["1", "2", "3", "3+", "4", "5", "6", "7", ""] as const;

export type LotsenKategorie = (typeof LOTSEN_KATEGORIEN)[number];

/** Anmeldungs-Typen der Liste "Andere Jobs". "AG (Tender)" ist eine AG
 *  ohne Trägerjob-Bindung: eigener Tender, Abteilzeit direkt eingetragen —
 *  das planbare Gegenstück zum Tender-AG-Vorschlag des Dashboards. */
export const ANMELDUNGS_TYPEN = [
  "AG",
  "AG (Tender)",
  "Sonderradar",
  "Nebelradar",
  "1+1",
  "2+2",
  "EHF",
  "BHF",
  "WB",
  "WR",
] as const;

export type AnmeldungsTyp = (typeof ANMELDUNGS_TYPEN)[number];

/** Rang eines Lotsen für den Vergleich mit der Schiffskategorie.
 *  Volllotse ("") = 8 (darf alles), "3+" zählt hier wie Kat. 3 —
 *  die Zusatzrechte von 3+ greifen nur über hatDreiPlus(). */
export function lotsenRang(kat: LotsenKategorie | string | undefined): number {
  if (kat === undefined || kat === "") return 8;
  if (kat === "3+") return 3;
  const zahl = Number(kat);
  return Number.isNaN(zahl) ? 0 : zahl;
}

/** Rang eines Schiffs: "1"–"7" als Zahl, jede AGF-Kategorie = 8. */
export function schiffsRang(kat: SchiffsKategorie | string): number {
  if (istAgf(kat)) return 8;
  const zahl = Number(kat);
  return Number.isNaN(zahl) ? 0 : zahl;
}

export function istAgf(schiffsKat: string): boolean {
  return schiffsKat.startsWith("AGF");
}

/** Erfüllt der Lotse "min. Kat. 3+"? Ja für 3+ selbst und alles darüber
 *  (4–7, Volllotse) — Annahme: höhere Kategorien schließen die
 *  3+-Zusatzrechte mit ein. Kat. 3 (ohne +) erfüllt es nicht. */
export function hatDreiPlus(lotsenKat: LotsenKategorie | string | undefined): boolean {
  return lotsenKat === "3+" || lotsenRang(lotsenKat) >= 4;
}

/**
 * Darf der (erste) Lotse das Schiff fahren?
 * Regel: Lotsen-Kat. >= Schiffs-Kat. Volllotsen dürfen alles.
 * AGF entspricht Kat. 8 — nur Volllotsen, außer die AGF trägt den
 * Zusatz "/7": dann darf auch ein Kat.-7-Lotse fahren.
 */
export function darfFahren(schiffsKat: SchiffsKategorie | string, lotsenKat: LotsenKategorie | string | undefined): boolean {
  const rangLotse = lotsenRang(lotsenKat);
  if (istAgf(schiffsKat)) {
    if (rangLotse >= 8) return true;
    return schiffsKat.endsWith("/7") && rangLotse >= 7;
  }
  return rangLotse >= schiffsRang(schiffsKat);
}

/**
 * Darf der Lotse als ZWEITER Lotse auf das Schiff (einkommend)? Der erste
 * Lotse muss stets die volle Schiffs-Kat. erfüllen (darfFahren); der zweite
 * darf schon ab eigener Kat. 3+ mitfahren — unabhängig von der Schiffs-Kat.
 * Ausnahme AGF 3+: der zweite Lotse muss min. Kat. 6 haben. Gilt nur für
 * echte Zweitlotsen-Schiffe (z.B. Doppeldecker); bei AG-Jobs braucht jeder
 * zusätzliche Lotse weiterhin die volle Kat. (siehe eignungsWarnung).
 */
export function darfZweiterLotse(
  schiffsKat: SchiffsKategorie | string,
  lotsenKat: LotsenKategorie | string | undefined,
): boolean {
  if (schiffsKat === "AGF 3+") return lotsenRang(lotsenKat) >= 6;
  return hatDreiPlus(lotsenKat);
}

/**
 * Mindest-Lotsenkategorie je Anmeldungs-Typ:
 * - 1+1, 2+2, WB, WR: wie ein Kat.-4-Schiff.
 * - Sonderradar, Nebelradar: min. Kat. 3+.
 * - alle übrigen Typen (AG, EHF, BHF): keine Kategorie-Anforderung.
 */
export function darfJobTyp(typ: AnmeldungsTyp | string, lotsenKat: LotsenKategorie | string | undefined): boolean {
  if (typ === "1+1" || typ === "2+2" || typ === "WB" || typ === "WR") return lotsenRang(lotsenKat) >= 4;
  if (typ === "Sonderradar" || typ === "Nebelradar") return hatDreiPlus(lotsenKat);
  return true;
}
