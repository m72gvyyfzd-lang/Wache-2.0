import {
  BRB_MATRIX,
  MATRIX_SCHRITT_MIN,
  type Geschwindigkeitsklasse,
  type MatrixTabelle,
} from "./brbMatrixDaten";
import type { Job } from "./types";

/** Abteilung liegt fest 20 min vor der voraussichtlichen Ankunft an der Brücke Brb. */
export const ABTEILUNG_VOR_ANKUNFT_MIN = 20;

/** Betriebs-Korrektur der HH-/FkW-MELDEZEITEN: die eingetragenen Zeiten
 *  liegen in der Praxis rund 15 min NACH dem tatsächlichen Abgang — die
 *  Rechnung startet deshalb bei Meldung − 15 min. Früher wurde stattdessen
 *  die Ankunft um 15 min vorgezogen; für die Abteilzeit ist das nahezu
 *  gleichwertig, aber erst die Start-Korrektur bringt die Stade-Prognose
 *  auf den richtigen Durchgangspunkt. Stade-/Kuden-Meldungen sind echte
 *  Passagezeiten und bleiben unkorrigiert; die Brb→SEE-Tabelle ebenso. */
export const MELDE_ABGANG_KORREKTUR_MIN = 15;

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

  // FkW-Meldungen sind späte Abgangszeiten → Start = Meldung − 15 min;
  // Stade-Meldungen sind echte Passagen und starten unkorrigiert.
  const start =
    basis === "stade"
      ? job.stadeKuden!
      : new Date(job.fkwTickerAbgang!.getTime() - MELDE_ABGANG_KORREKTUR_MIN * 60_000);
  const tabelle = basis === "stade" ? BRB_MATRIX.stade : BRB_MATRIX.halo;

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

/**
 * Voraussichtliche Stade-Passage (Tonne_101) eines HH-Jobs, der bisher nur
 * eine FkW-Meldung hat — reine Info-Anzeige für die Tafel Brb, solange der
 * User die echte Stade-Zeit noch nicht eingetragen hat.
 *
 * Rechnung rückwärts von der Ankunft Tn_59 aus der FkW-Tabelle (Start =
 * Meldung − 15 min, siehe MELDE_ABGANG_KORREKTUR_MIN): gesucht ist t mit
 * t + Stade-Fahrzeit(t) = Ankunft. Die Stade-Fahrzeit hängt vom
 * Tidenoffset der Passage selbst ab — zwei Fixpunkt-Iterationen genügen
 * (die Tabellen ändern sich je 15 min nur wenig). Trüge der User genau
 * diesen Wert als Stade-Zeit ein, ergäbe die Stade-Rechnung dieselbe
 * Abteilzeit wie die FkW-Rechnung.
 */
export function berechneStadePrognose(job: Job, hwBrb: HwBrb): Date | undefined {
  if (job.routentyp !== "HH" || !job.fkwTickerAbgang || job.stadeKuden) return undefined;
  const klasse = job.geschwindigkeitsklasse ?? "normal";
  const start = new Date(job.fkwTickerAbgang.getTime() - MELDE_ABGANG_KORREKTUR_MIN * 60_000);
  const offsetFkw = minutenVorNaechstemHw(hwBrb, start);
  const ankunftMs = start.getTime() + interpoliere(BRB_MATRIX.halo, klasse, offsetFkw) * 60_000;
  let t = ankunftMs;
  for (let i = 0; i < 2; i++) {
    const offset = minutenVorNaechstemHw(hwBrb, new Date(t));
    t = ankunftMs - interpoliere(BRB_MATRIX.stade, klasse, offset) * 60_000;
  }
  return new Date(t);
}

// ---------------------------------------------------------------------------
// Brb >> SEE: Anreise eines abgeteilten Lotsen zur Seestation

/** Woher der abgeteilte Lotse kommt — bestimmt den Vorlauf von der
 *  Abteilung bis zur Abfahrt an der Brücke (Tonne_59). "VNR" = EHF
 *  (UI-Beschriftung "von EHF"), "SONST" = Sonstige-/Anmeldungs-Jobs mit
 *  V-Nr.; BHF läuft über den NOK-Offset. Tender-AG bleibt bewusst außen
 *  vor (pauschal). */
export type SeeHerkunft = "HH" | "NOK" | "VNR" | "SONST";

/** Abteilung → Abfahrt Tonne_59 in Minuten, je Herkunft. */
export const SEE_ABFAHRT_OFFSET_MIN: Record<SeeHerkunft, number> = {
  HH: 30,
  NOK: 45,
  VNR: 40,
  SONST: 40,
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
