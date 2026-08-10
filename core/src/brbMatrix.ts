import {
  BRB_MATRIX,
  MATRIX_SCHRITT_MIN,
  type Geschwindigkeitsklasse,
  type MatrixTabelle,
} from "./brbMatrixDaten";
import type { Job } from "./types";

/** Abteilung liegt fest 20 min vor der voraussichtlichen Ankunft an der Brücke Brb. */
export const ABTEILUNG_VOR_ANKUNFT_MIN = 20;

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
  const a = tabelle[unten][klasse].brb;
  const b = tabelle[oben][klasse].brb;
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
  const tabelle = basis === "stade" ? BRB_MATRIX.dow : BRB_MATRIX.halo;

  const offsetVorHwMin = minutenVorNaechstemHw(hwBrb, start);
  const fahrzeitMin = interpoliere(tabelle, klasse, offsetVorHwMin);
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
