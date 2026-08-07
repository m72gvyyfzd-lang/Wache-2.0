/** Berechnungen rund um die Seestation. */
import type { Abteilung, SeestationLotse } from "../data/types";

/** Anfahrtszeit von der Abteilung bis zur Seestation (wird später
 *  verfeinert) — auch Grundlage der AG-Fahrt-Vorschläge im Dashboard. */
export const ANFAHRT_SEESTATION_MS = 3.5 * 3_600_000;

/** "Ankunft S-Stn"/"ETA Stn" eines Lotsen im Revier: Abteilzeit + Anfahrt;
 *  ein manueller Wert sticht die Berechnung aus. */
export function etaSeestation(abteilung: Abteilung): Date {
  return abteilung.etaStnManuell ?? new Date(abteilung.abteilZeit.getTime() + ANFAHRT_SEESTATION_MS);
}

/** Einheitliche Zeile der Liste "Auf Seestation": Lotsen aus der
 *  Versetzliste (Abteilung mit V-Nr.) und manuell hinzugefügte Lotsen. */
export interface SeestationZeile {
  /** eindeutiger Schlüssel über beide Quellen hinweg */
  key: string;
  quelle: "abteilung" | "manuell";
  id: number;
  vNr: number;
  /** V-Nr.-Zusatz manuell hinzugefügter Lotsen (A–D) */
  zusatz?: string;
  name: string;
  kategorie: string;
  elbehafen: boolean;
  etaStn: Date | undefined;
  aufStation: boolean;
}

/** Sortierung: V-Nr. aufsteigend; bei gleicher Nummer zuerst der Lotse ohne
 *  Zusatz, danach die Zusätze alphabetisch (101 → 101 (A) → 101 (B) → 102). */
export function sortiereSeestation(zeilen: SeestationZeile[]): SeestationZeile[] {
  return [...zeilen].sort((a, b) => {
    if (a.vNr !== b.vNr) return a.vNr - b.vNr;
    const zusatzA = a.zusatz ?? "";
    const zusatzB = b.zusatz ?? "";
    return zusatzA.localeCompare(zusatzB);
  });
}

export function zeilenAusAbteilungen(abteilungen: Abteilung[]): SeestationZeile[] {
  return abteilungen
    .filter((a) => a.vNr !== undefined && !a.abgeschoepft && !a.ankert && !a.seeAbgeteilt)
    .map((a) => ({
      key: `abteilung-${a.id}`,
      quelle: "abteilung" as const,
      id: a.id,
      vNr: a.vNr!,
      name: a.lotsenName,
      kategorie: a.lotsenKategorie,
      elbehafen: a.elbehafen,
      etaStn: etaSeestation(a),
      aufStation: a.aufSeestation ?? false,
    }));
}

export function zeilenAusSeestationLotsen(lotsen: SeestationLotse[]): SeestationZeile[] {
  return lotsen
    .filter((l) => !l.abgeschoepft && !l.seeAbgeteilt)
    .map((l) => ({
      key: `manuell-${l.id}`,
      quelle: "manuell" as const,
      id: l.id,
      vNr: l.vNr,
      zusatz: l.zusatz,
      name: l.name,
      kategorie: l.kategorie,
      elbehafen: l.elbehafen,
      etaStn: l.etaStn,
      aufStation: l.aufStation ?? false,
    }));
}
