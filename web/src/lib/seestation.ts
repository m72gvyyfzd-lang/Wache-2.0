/** Berechnungen rund um die Seestation. */
import type { Abteilung, SeeSchiff, SeestationLotse } from "../data/types";
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

/** E3/St-Schiffe: die eingetragene ETA ist die Zeit, zu der der Lotse an
 *  Bord sein soll — nicht die Ankunft an der Seestation. Das Lotsenboot
 *  braucht 1,5 Std., um den Lotsen von der Seestation zum Schiff zu
 *  bringen; diese Abfahrtszeit (ETA − 1,5 Std.) ist die eigentliche
 *  Abt.Zeit, an der sich die gesamte Planung ausrichten muss — unabhängig
 *  vom Anmeldestatus (siehe planungsEta). */
export const E3ST_VORLAUF_MS = 1.5 * 3_600_000;

/** Der Zeitpunkt, an dem ein Schiff tatsächlich einen Lotsen auf der
 *  Seestation braucht: bei NICHT angemeldeten E3/St-Schiffen die Abt.Zeit
 *  (ETA − 1,5 Std., siehe E3ST_VORLAUF_MS), sonst die ETA selbst. Mit der
 *  Anmeldung wird die Abfahrtszeit des Lotsenboots zur neuen, eingetragenen
 *  Zeit — die 1,5 Std. stecken dann bereits im Wert, ein weiterer Abzug
 *  würde doppelt rechnen. Einzige Stelle für diese Umrechnung — jede
 *  Fristen-/Vorlauf-Berechnung der Seestation nutzt diesen Wert statt
 *  schiff.eta direkt, die ETA-Liste zeigt weiterhin die unveränderte,
 *  eingetragene Zeit an. */
export function planungsEta(schiff: Pick<SeeSchiff, "eta" | "e3st" | "angemeldet">): Date {
  return schiff.e3st && !schiff.angemeldet ? new Date(schiff.eta.getTime() - E3ST_VORLAUF_MS) : schiff.eta;
}

/** E3/St-Verbund (nur Vorschau-Rechnung): Liegen die ETAs mehrerer
 *  E3/St-Schiffe höchstens 2,5 Std. nach dem FRÜHESTEN Schiff der Gruppe,
 *  teilen sie sich eine Lotsenboot-Tour. */
export const E3ST_VERBUND_FENSTER_MS = 2.5 * 3_600_000;

/** Planungshorizont der Projektionen (Vorschau + AG-Planung): geplant wird
 *  höchstens 12 Std. im Voraus — weiter entfernte Schiffe ändern sich
 *  erfahrungsgemäß noch zu stark, als dass sich eine Vorplanung lohnte. */
export const PLANUNGS_HORIZONT_MS = 12 * 3_600_000;

export interface VorschauAbtZeit {
  /** wirksame Abt.Zeit der Vorschau-Rechnung (bei Verbund-Folgeschiffen
   *  die Zeit des führenden Schiffs + 1 Min. je Position) */
  abtZeit: Date;
  /** Sortier-/Prioritätszeit: bei Verbund-Folgeschiffen die Zeit des
   *  FÜHRENDEN Schiffs (ohne Minuten-Aufschlag) — der Verbund gewinnt
   *  gemeinsam vor anderen Schiffen mit derselben Zeit, die +1 Minute
   *  ordnet nur innerhalb des Verbunds. */
  prioZeit: Date;
  /** Anzahl Schiffe im Verbund — 1 = kein Verbund */
  verbundGroesse: number;
  /** Position im Verbund (0 = führendes Schiff) */
  verbundIndex: number;
}

/** Wirksame Abt.Zeiten für die VORSCHAU-Zuteilung: E3/St-Schiffe im
 *  2,5-Std.-Fenster (siehe E3ST_VERBUND_FENSTER_MS) bilden einen Verbund und
 *  übernehmen gemeinsam die Abt.Zeit des führenden Schiffs — jedes weitere
 *  reiht sich mit +1 Minute ein (dieselbe Bootstour, die Minute hält nur
 *  die Reihenfolge eindeutig). Alle übrigen Schiffe behalten ihre
 *  planungsEta. Ohne Vorschau wird diese Rechnung nirgends verwendet. */
export function vorschauAbtZeiten(seeSchiffe: SeeSchiff[]): Map<number, VorschauAbtZeit> {
  const ergebnis = new Map<number, VorschauAbtZeit>();
  for (const s of seeSchiffe) {
    const abt = planungsEta(s);
    ergebnis.set(s.id, { abtZeit: abt, prioZeit: abt, verbundGroesse: 1, verbundIndex: 0 });
  }
  // Gruppiert wird über die WIRKSAME Abt.Zeit (planungsEta): bei einem
  // angemeldeten E3/St-Schiff ist das die eingetragene Zeit, bei einem
  // nicht angemeldeten die um 1,5 Std. vorgezogene — so landen beide
  // Zustände vergleichbar auf der Bootstour-Achse.
  const e3st = seeSchiffe
    .filter((s) => s.e3st)
    .sort((a, b) => planungsEta(a).getTime() - planungsEta(b).getTime());
  let i = 0;
  while (i < e3st.length) {
    const erster = e3st[i];
    let j = i + 1;
    while (j < e3st.length && planungsEta(e3st[j]).getTime() - planungsEta(erster).getTime() <= E3ST_VERBUND_FENSTER_MS)
      j++;
    const verbund = e3st.slice(i, j);
    if (verbund.length > 1) {
      const basis = planungsEta(erster).getTime();
      verbund.forEach((s, index) => {
        ergebnis.set(s.id, {
          abtZeit: new Date(basis + index * 60_000),
          prioZeit: new Date(basis),
          verbundGroesse: verbund.length,
          verbundIndex: index,
        });
      });
    }
    i = j;
  }
  return ergebnis;
}

/** Vergleich zweier Schiffe nach den Vorschau-Zusatzregeln:
 *  1. Prioritätszeit (Verbünde gemeinsam über die Zeit des führenden
 *     Schiffs), 2. bei Gleichstand E3/St vor normalem Schiff, 3. innerhalb
 *     eines Verbunds die +1-Minuten-Reihenfolge, 4. rohe ETA. */
export function vergleicheVorschauAbt(
  a: SeeSchiff,
  b: SeeSchiff,
  vorschauAbt: Map<number, VorschauAbtZeit>,
): number {
  const infoA = vorschauAbt.get(a.id);
  const infoB = vorschauAbt.get(b.id);
  const prioDiff = (infoA?.prioZeit ?? planungsEta(a)).getTime() - (infoB?.prioZeit ?? planungsEta(b)).getTime();
  if (prioDiff !== 0) return prioDiff;
  if (Boolean(a.e3st) !== Boolean(b.e3st)) return a.e3st ? -1 : 1;
  const abtDiff = (infoA?.abtZeit ?? planungsEta(a)).getTime() - (infoB?.abtZeit ?? planungsEta(b)).getTime();
  if (abtDiff !== 0) return abtDiff;
  return a.eta.getTime() - b.eta.getTime();
}

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
