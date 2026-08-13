/** Berechnungen rund um die Seestation. */
import type { Abteilung, SeestationLotse } from "../data/types";
import { etaSeestationMatrix } from "./coreJob";

/** Pauschale Anfahrtszeit von der Abteilung bis zur Seestation — Fallback,
 *  wenn die Brb>>SEE-Matrix nicht greift (kein HW-Paar, Tender-AG, alte
 *  Datensätze) — auch Grundlage der AG-Fahrt-Vorschläge im Dashboard. */
export const ANFAHRT_SEESTATION_MS = 3.5 * 3_600_000;

/** Harte Grenze der Zuteilung: unter 15 Min. Vorlauf vor dem Schiffs-ETA
 *  gilt ein Lotse nicht mehr als pünktlich und wird nur noch im zweiten
 *  Durchgang (mit Verspätungs-Kennzeichnung) vergeben. */
export const VORLAUF_AUF_STATION_MS = 15 * 60_000;

/** Angestrebter Vorlauf: eine Stunde vor dem Schiffs-ETA. Wird er
 *  unterschritten, bleibt die Zuteilung bestehen — es gibt aber eine
 *  Warnung (kein Alarm) und die Ankunftszeit wird orange hervorgehoben. */
export const VORLAUF_WARNUNG_MS = 3_600_000;

/** Anmeldung eines See-Schiffs: ab 30 Min. vor dem ETA wird gewarnt, ab
 *  15 Min. NACH dem ETA gilt sie als überfällig (Alarm). */
export const ANMELDUNG_VORWARNUNG_MS = 30 * 60_000;
export const ANMELDUNG_ESKALATION_MS = 15 * 60_000;

/** Tender-AG: braucht min. 3 Std. Vorlauf, bis der Tender an der
 *  Einsatzstation abfahren kann — die Anfahrt zur Seestation (siehe
 *  ANFAHRT_SEESTATION_MS) kommt danach noch obendrauf.
 *
 *  Diese drei Konstanten liegen bewusst hier (statt in lib/meldungen.ts,
 *  wo sie ursprünglich standen): lib/vorschau.ts braucht TENDER_VORLAUF_MS
 *  und lib/meldungen.ts braucht künftig lib/vorschau.ts (für die
 *  verplanten Lotsen in der Dashboard-Bilanz) — ein gemeinsames,
 *  neutrales Modul ohne Rückimport vermeidet einen Zirkelbezug. */
export const TENDER_VORLAUF_MS = 3 * 3_600_000;

/** "Ankunft S-Stn"/"ETA Stn" eines Lotsen im Revier: Brb>>SEE-Matrix
 *  (Abfahrt Tn_59 = Abteilzeit + Herkunfts-Offset, dann Fahrzeit je
 *  Tidenlage), sonst Abteilzeit + pauschale Anfahrt; ein manueller Wert
 *  sticht beides aus. */
export function etaSeestation(abteilung: Abteilung): Date {
  return (
    abteilung.etaStnManuell ??
    etaSeestationMatrix(abteilung.abteilZeit, abteilung.seeHerkunft, abteilung.geschwindigkeitsklasse) ??
    new Date(abteilung.abteilZeit.getTime() + ANFAHRT_SEESTATION_MS)
  );
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
  /** gesetzt = reine Vorschau-Projektion (Lotse noch an der Einsatzstation)
   *  — nicht anklickbar, mit potentieller V-Nr. "verplant" = hat schon
   *  einen Job, Ankunft aus geplanter Abteilzeit hochgerechnet (orange);
   *  "frei" = noch ohne Job, per AG holbar (orange/blaue Details siehe
   *  lib/vorschau.ts). */
  projiziert?: "verplant" | "frei";
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
