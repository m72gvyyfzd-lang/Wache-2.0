import {
  BRB_MATRIX,
  MATRIX_SCHRITT_MIN,
  type Geschwindigkeitsklasse,
  type MatrixTabelle,
} from "./brbMatrixDaten";
import type { Job } from "./types";

/** Abteilung liegt fest 20 min vor der voraussichtlichen Ankunft an der Brücke Brb. */
export const ABTEILUNG_VOR_ANKUNFT_MIN = 20;

/** Betriebs-Korrektur auf die HH→Brb-Matrix: die Schiffe kommen in der
 *  Praxis rund 15 min FRÜHER an der Brücke an, als die generierten
 *  Fahrzeiten sagen. Die Korrektur wirkt auf die Ankunft Tonne_59 und
 *  damit auch auf die Abteilzeit (Ankunft − 20 min); die Brb→SEE-Tabelle
 *  bleibt unberührt. */
export const BRB_ANKUNFT_KORREKTUR_MIN = -15;

/** Mittlere Tidenperiode als Fallback, wenn nur ein HW eingegeben ist. */
const TIDENPERIODE_MIN = 745;

/** Vom Dispatcher eingegebenes HW-Paar Brunsbüttel. */
export interface HwBrb {
  hw1: Date;
  hw2?: Date;
}

export interface BrbPrognose {
  /** voraussichtliche Ankunft an der Brücke Brunsbüttel (Tonne_59) */
  ankunftBrb: Date;
  /** Abteilzeit = Ankunft − 20 min */
  abteilzeit: Date;
  /** reine Fahrzeit ab Meldepunkt in Minuten */
  fahrzeitMin: number;
  /** welcher Meldepunkt der Rechnung zugrunde liegt */
  basis: "fkw" | "stade";
  /** verwendeter Abfahrts-Offset: Minuten vor dem nächsten HW Brb */
  offsetVorHwMin: number;
}

/**
 * Minuten bis zum nächsten HW Brunsbüttel ab `zeit`, periodisch fortgesetzt.
 *
 * Der Dispatcher gibt ein konkretes HW-Paar ein; liegt `zeit` außerhalb
 * dieses Paars (z.B. spät abends nach HW_2), wird das HW mit der Periode
 * HW_2−HW_1 (bzw. ~12h25 bei nur einem HW) weitergezählt — die Matrix ist
 * ohnehin eine Näherung, der Fehler durch die Fortschreibung bleibt klein.
 */
export function minutenVorNaechstemHw(hw: HwBrb, zeit: Date): number {
  const periodeMin =
    hw.hw2 && hw.hw2.getTime() > hw.hw1.getTime()
      ? (hw.hw2.getTime() - hw.hw1.getTime()) / 60_000
      : TIDENPERIODE_MIN;
  const diffMin = (hw.hw1.getTime() - zeit.getTime()) / 60_000;
  // In [0, periode) bringen: 0 = genau bei HW, knapp darunter = kurz vor HW.
  return ((diffMin % periodeMin) + periodeMin) % periodeMin;
}

/** Fahrzeit [min] per linearer Interpolation zwischen den 15-min-Stützstellen. */
function interpoliere(
  tabelle: MatrixTabelle,
  klasse: Geschwindigkeitsklasse,
  offsetMin: number
): number {
  const offsets = Object.keys(tabelle)
    .map(Number)
    .sort((a, b) => a - b);
  const maxOffset = offsets[offsets.length - 1];
  const geklemmt = Math.min(Math.max(offsetMin, 0), maxOffset);

  const unten = Math.floor(geklemmt / MATRIX_SCHRITT_MIN) * MATRIX_SCHRITT_MIN;
  const oben = Math.min(unten + MATRIX_SCHRITT_MIN, maxOffset);
  const a = tabelle[unten][klasse];
  const b = tabelle[oben][klasse];
  if (oben === unten) return a;
  const t = (geklemmt - unten) / (oben - unten);
  return a + (b - a) * t;
}

/**
 * Matrixbasierte Brunsbüttel-Prognose für einen HH-Job.
 *
 * Nimmt den genauesten verfügbaren Meldepunkt (Stade vor FkW, wie in
 * `berechneAbteilzeit`) und schlägt die Fahrzeit aus der EPP-Referenzmatrix
 * nach. Liefert `undefined`, wenn kein Meldepunkt vorliegt oder der Job kein
 * HH-Job ist — der Aufrufer fällt dann auf die festen Offsets zurück.
 */
export function berechneBrbPrognose(job: Job, hwBrb: HwBrb): BrbPrognose | undefined {
  if (job.routentyp !== "HH") return undefined;
  const klasse = job.geschwindigkeitsklasse ?? "normal";

  const basis: BrbPrognose["basis"] | undefined = job.stadeKuden
    ? "stade"
    : job.fkwTickerAbgang
      ? "fkw"
      : undefined;
  if (!basis) return undefined;

  const start = basis === "stade" ? job.stadeKuden! : job.fkwTickerAbgang!;
  const tabelle = basis === "stade" ? BRB_MATRIX.stade : BRB_MATRIX.halo;

  const offsetVorHwMin = minutenVorNaechstemHw(hwBrb, start);
  const fahrzeitMin = interpoliere(tabelle, klasse, offsetVorHwMin) + BRB_ANKUNFT_KORREKTUR_MIN;
  const ankunftBrb = new Date(start.getTime() + fahrzeitMin * 60_000);
  const abteilzeit = new Date(ankunftBrb.getTime() - ABTEILUNG_VOR_ANKUNFT_MIN * 60_000);

  return {
    ankunftBrb,
    abteilzeit,
    fahrzeitMin: Math.round(fahrzeitMin),
    basis,
    offsetVorHwMin: Math.round(offsetVorHwMin),
  };
}

// ---------------------------------------------------------------------------
// Brb >> SEE: Anreise eines abgeteilten Lotsen zur Seestation

/** Woher der abgeteilte Lotse kommt — bestimmt den Vorlauf von der
 *  Abteilung bis zur Abfahrt an der Brücke (Tonne_59). "VNR" = andere Jobs
 *  mit V-Nr. (EHF, BHF); Tender-AG bleibt bewusst außen vor (pauschal). */
export type SeeHerkunft = "HH" | "NOK" | "VNR";

/** Abteilung → Abfahrt Tonne_59 in Minuten, je Herkunft. */
export const SEE_ABFAHRT_OFFSET_MIN: Record<SeeHerkunft, number> = {
  HH: 30,
  NOK: 45,
  VNR: 40,
};

export interface SeePrognose {
  /** Abfahrt an der Brücke Brb (Tonne_59) = Abteilzeit + Herkunfts-Offset */
  abfahrtTn59: Date;
  /** voraussichtliche Ankunft Seestation (Tonne_5) */
  ankunftSee: Date;
  /** reine Fahrzeit Tonne_59 → Tonne_5 in Minuten */
  fahrzeitMin: number;
  /** verwendeter Abfahrts-Offset: Minuten vor dem nächsten HW Brb */
  offsetVorHwMin: number;
}

/**
 * Matrixbasierte ETA Seestation für einen abgeteilten Lotsen:
 * Abfahrt Tn_59 = Abteilzeit + Offset (HH 30 / NOK 45 / V-Nr-Jobs 40 min),
 * dann Fahrzeit Tn_59 → Tonne_5 aus der See-Tabelle.
 *
 * `abfahrtOffsetMin` übersteuert den Standard-Offset der Herkunft — die
 * Settings-Kachel "Zeitrechnung" reicht hier ihre Session-Werte durch
 * (0 liefert die reine Fahrzeit Tn_59 → Tn_5 ab `abteilZeit`).
 */
export function berechneSeePrognose(
  abteilZeit: Date,
  herkunft: SeeHerkunft,
  klasse: Geschwindigkeitsklasse | undefined,
  hwBrb: HwBrb,
  abfahrtOffsetMin?: number
): SeePrognose {
  const offsetMin = abfahrtOffsetMin ?? SEE_ABFAHRT_OFFSET_MIN[herkunft];
  const abfahrtTn59 = new Date(abteilZeit.getTime() + offsetMin * 60_000);
  const offsetVorHwMin = minutenVorNaechstemHw(hwBrb, abfahrtTn59);
  const fahrzeitMin = interpoliere(BRB_MATRIX.see, klasse ?? "normal", offsetVorHwMin);
  const ankunftSee = new Date(abfahrtTn59.getTime() + fahrzeitMin * 60_000);
  return {
    abfahrtTn59,
    ankunftSee,
    fahrzeitMin: Math.round(fahrzeitMin),
    offsetVorHwMin: Math.round(offsetVorHwMin),
  };
}
