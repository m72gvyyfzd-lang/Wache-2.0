/**
 * Seestations-Defizit je Schiff: gemeinsame Berechnung für die Dashboard-
 * Bilanz (lib/meldungen.ts) und die AG-Planungs-Übersicht (lib/agPlanung.ts).
 * Ursprünglich reine Extraktion der Schleife aus
 * meldungen.ts::seestationsMeldungen, inzwischen mit einer Korrektur: die
 * Trägerkandidaten schließen bereits abgeteilte Trägerjobs aus (siehe
 * Kommentar bei "traeger" unten).
 *
 * Nur ein Typ-Import aus lib/meldungen.ts (wird beim Kompilieren entfernt,
 * daher kein Zirkelbezug), meldungen.ts importiert von hier den Wert
 * berechneSeestationsDefizite.
 */
import type { AbteilzeitSettings } from "@wache/core";
import type { JobEintrag, SeeSchiff } from "../data/types";
import { benoetigteLotsenAnzahl, sortiereEintraege, vonTypeLabel } from "./coreJob";
import type { MeldungsDaten, MeldungsStufe } from "./meldungen";
import { ANFAHRT_SEESTATION_MS, TENDER_VORLAUF_MS, VORLAUF_AUF_STATION_MS, sortiereSeestation, zeilenAusAbteilungen, zeilenAusSeestationLotsen } from "./seestation";
import { planeSeestation, schiffePriorisiert } from "./seestationAbteilen";
import { vorschauZeilen } from "./vorschau";

/** Ein AG-Lotse soll möglichst nicht länger als 6 Std. auf der Seestation
 *  auf sein Schiff warten (Ankunft über den gewählten Träger bis zum
 *  Schiffs-ETA). Fährt kein Träger spät genug ab, ist das GENAU die
 *  Konstellation für eine geplante Tender-AG: eigener Tender, Abfahrt so,
 *  dass die Lotsen zeitgerecht auf der Seestation sind (siehe
 *  tenderEmpfehlung). Nur wenn auch das nicht mehr geht, bleibt die
 *  Träger-Zuteilung mit Warnung stehen. */
export const WARTE_MAX_AG_MS = 6 * 3_600_000;

export interface AgZuteilung {
  traeger: { eintrag: JobEintrag; abteilzeit: Date };
  /** Anzahl der AG-Lotsen, die über diesen Träger fahren sollen */
  anzahl: number;
  /** Ankunft über den Träger bis zum Schiffs-ETA */
  wartezeitMs: number;
  ueberWarteziel: boolean;
}

export interface SeestationDefizit {
  schiff: SeeSchiff;
  fehlt: number;
  /** "alarm" = kein Trägerjob und Tender-AG nicht mehr rechtzeitig möglich */
  stufe: MeldungsStufe;
  /** Trägerschiff(e), auf die die fehlenden Lotsen aufgeteilt würden — leer,
   *  wenn kein Träger mehr rechtzeitig möglich ist (dann bleibt nur die
   *  Tender-AG). Mehr als ein Eintrag nur ab 4 fehlenden Lotsen und wenn ein
   *  zweiter Träger existiert (siehe planeAgTraeger) — bei weniger Bedarf
   *  würde ein Split nur unnötig eine 1-Lotsen-Gruppe erzeugen. */
  zuteilungen: AgZuteilung[];
  tenderMoeglich: boolean;
  tenderFrist: number;
  /** Empfohlene Tender-AG, wenn kein Träger passt oder jeder Träger die
   *  Lotsen länger als 6 Std. warten ließe: bis `planenBis` einplanen
   *  (Tender braucht 3 Std. Vorlauf), `abfahrt` ist die geplante Abfahrt
   *  und damit die Abteilzeit des Tender-AG-Jobs. */
  tenderEmpfehlung?: { planenBis: Date; abfahrt: Date };
}

/**
 * Verteilt die fehlenden Lotsen eines Schiffs auf Trägerkandidaten
 * (aufsteigend nach Abteilzeit sortiert): der späteste Träger hat die
 * kürzeste Wartezeit und wird bevorzugt. Ab 4 fehlenden Lotsen kommt —
 * sofern vorhanden — ein zweiter (der zweitspäteste) Träger dazu, damit
 * nicht die gesamte Gruppe auf ein einziges Schiff gepackt wird; bei 1–3
 * fehlenden Lotsen bliebe von einem Split nur eine unnötige 1-Lotsen-Gruppe
 * übrig, daher bleibt es dort bei einem Träger für den vollen Bedarf.
 */
export function planeAgTraeger(
  kandidatenAufsteigend: { eintrag: JobEintrag; abteilzeit: Date }[],
  fehlt: number,
  schiffEta: Date,
): AgZuteilung[] {
  if (kandidatenAufsteigend.length === 0) return [];
  function zuteilung(traeger: { eintrag: JobEintrag; abteilzeit: Date }, anzahl: number): AgZuteilung {
    const wartezeitMs = schiffEta.getTime() - (traeger.abteilzeit.getTime() + ANFAHRT_SEESTATION_MS);
    return { traeger, anzahl, wartezeitMs, ueberWarteziel: wartezeitMs > WARTE_MAX_AG_MS };
  }
  const beste = kandidatenAufsteigend[kandidatenAufsteigend.length - 1];
  const zweitBeste = kandidatenAufsteigend[kandidatenAufsteigend.length - 2];
  // Split nur, wenn auch der zweite Träger das 6-Std.-Warteziel hält —
  // sonst lieber alle auf den späteren Träger statt eine Teilgruppe
  // unnötig lange warten zu lassen.
  if (fehlt >= 4 && zweitBeste && !zuteilung(zweitBeste, 1).ueberWarteziel) {
    const ersteAnzahl = Math.ceil(fehlt / 2);
    return [zuteilung(beste, ersteAnzahl), zuteilung(zweitBeste, fehlt - ersteAnzahl)];
  }
  return [zuteilung(beste, fehlt)];
}

export function berechneSeestationsDefizite(
  daten: MeldungsDaten,
  jetzt: Date,
  settings: AbteilzeitSettings,
): SeestationDefizit[] {
  const abgeteiltProSchiff = new Map<number, number>();
  for (const sa of daten.seeAbteilungen)
    abgeteiltProSchiff.set(sa.seeSchiffId, (abgeteiltProSchiff.get(sa.seeSchiffId) ?? 0) + 1);

  // Die echten vNrStart/verbrauchteVNrn sind hier NICHT nur Anzeige: die
  // potentielle V-Nr. bestimmt, wo ein Vorschau-Lotse im sortierten Pool
  // steht — und planeSeestation vergibt reihenfolgesensitiv (greedy mit
  // Kat./EH-Eignung). Mit Kunst-Nummern ab 0 rutschten die verplanten
  // Lotsen an den Pool-Anfang, wurden von früheren Schiffen "verbraucht"
  // und die Bilanz meldete Defizite, die die Seestation-Seite (mit echten
  // Nummern) gar nicht sieht.
  const { verplante } = vorschauZeilen(
    daten.jobs,
    daten.lotsen,
    daten.aktuelleFahrt,
    daten.abteilungen,
    settings,
    daten.vNrStart,
    daten.verbrauchteVNrn,
    jetzt,
  );
  const pool = sortiereSeestation([
    ...zeilenAusAbteilungen(daten.abteilungen),
    ...zeilenAusSeestationLotsen(daten.seestationLotsen),
    ...verplante,
  ]);
  const schiffe = schiffePriorisiert(daten.seeSchiffe, abgeteiltProSchiff);
  const projektion = planeSeestation(schiffe, pool, abgeteiltProSchiff, VORLAUF_AUF_STATION_MS);

  // AG-Trägerjobs: künftige Hamburg/NOK-Abfahrten, an die eine AG-Fahrt
  // gehängt werden kann (aufsteigend nach Abteilzeit) — bereits per AG
  // genutzte Träger werden nicht nochmal vorgeschlagen. Bereits abgeteilte
  // Träger (eigener Lotse schon dispatcht, ohne dass dafür ein AG-Job
  // angelegt wurde) fallen ebenfalls raus: die Fahrt ist schon losgefahren,
  // ein nachträglich angelegter AG-Job könnte nicht mehr mitfahren.
  const traegerGenutzt = new Set(
    daten.jobs
      .filter((j) => j.liste === "andere" && j.typ === "AG" && j.agJobId !== undefined)
      .map((j) => j.agJobId),
  );
  const abgeteiltProJob = new Map<number, number>();
  for (const a of daten.abteilungen) abgeteiltProJob.set(a.jobId, (abgeteiltProJob.get(a.jobId) ?? 0) + 1);
  const traeger = sortiereEintraege(daten.jobs, settings).filter(
    (p): p is { eintrag: JobEintrag; abteilzeit: Date } =>
      (p.eintrag.liste === "hamburg" || p.eintrag.liste === "nok") &&
      p.abteilzeit !== undefined &&
      p.abteilzeit.getTime() >= jetzt.getTime() &&
      !traegerGenutzt.has(p.eintrag.id) &&
      benoetigteLotsenAnzahl(p.eintrag) - (abgeteiltProJob.get(p.eintrag.id) ?? 0) > 0,
  );

  const defizite: SeestationDefizit[] = [];
  for (const schiff of daten.seeSchiffe) {
    const zuteilung = projektion.get(schiff.id);
    const fehlt = (zuteilung?.fehlt ?? 0) + (zuteilung?.zugewiesen.filter((s) => s.verspaetet).length ?? 0);
    if (fehlt <= 0) continue;
    const ankunftsFrist = schiff.eta.getTime() - VORLAUF_AUF_STATION_MS;

    // Handlungsoptionen: späteste AG-Abteilzeit = Ankunftsfrist − Anfahrt;
    // Tender-AG muss bis Ankunftsfrist − (Vorlauf + Anfahrt) eingeplant
    // sein — der Tender fährt frühestens 3 Std. nach Planung ab und braucht
    // dann selbst noch die Anfahrt.
    const abfahrtsFrist = ankunftsFrist - ANFAHRT_SEESTATION_MS;
    const kandidaten = traeger.filter((p) => p.abteilzeit.getTime() <= abfahrtsFrist);
    const tenderFrist = ankunftsFrist - TENDER_VORLAUF_MS - ANFAHRT_SEESTATION_MS;
    const tenderMoeglich = jetzt.getTime() <= tenderFrist;

    if (kandidaten.length === 0 && !tenderMoeglich) {
      defizite.push({ schiff, fehlt, stufe: "alarm", zuteilungen: [], tenderMoeglich, tenderFrist });
      continue;
    }

    let zuteilungen = planeAgTraeger(kandidaten, fehlt, schiff.eta);
    let tenderEmpfehlung: SeestationDefizit["tenderEmpfehlung"];
    // Kein Träger passt oder jeder Träger ließe die Lotsen länger als
    // 6 Std. warten: genau dafür ist die geplante Tender-AG da — Abfahrt
    // so spät, dass die Lotsen zeitgerecht (Ankunftsfrist) auf der
    // Seestation sind; die Abfahrt ist zugleich die Abteilzeit des
    // Tender-AG-Jobs, eingeplant sein muss sie 3 Std. vorher.
    if (tenderMoeglich && (zuteilungen.length === 0 || zuteilungen.some((z) => z.ueberWarteziel))) {
      const abfahrt = new Date(Math.max(abfahrtsFrist, jetzt.getTime() + TENDER_VORLAUF_MS));
      tenderEmpfehlung = { abfahrt, planenBis: new Date(abfahrt.getTime() - TENDER_VORLAUF_MS) };
      zuteilungen = [];
    }
    const traegerFrist = kandidaten.length > 0 ? kandidaten[kandidaten.length - 1].abteilzeit.getTime() : -Infinity;
    const handlungsFrist = Math.max(traegerFrist, tenderMoeglich ? tenderFrist : -Infinity);
    // Neben der üblichen Zeitnot eskaliert auch eine zu lange Wartezeit auf
    // der Seestation zur Warnung — außer die Tender-Empfehlung löst sie auf.
    const ueberWarteziel = zuteilungen.some((z) => z.ueberWarteziel);
    const stufe: MeldungsStufe =
      handlungsFrist - jetzt.getTime() <= AG_ESKALATION_MS || ueberWarteziel ? "warnung" : "vorschlag";

    defizite.push({ schiff, fehlt, stufe, zuteilungen, tenderMoeglich, tenderFrist, tenderEmpfehlung });
  }
  return defizite;
}

/** Wird die letzte Handlungsmöglichkeit knapper als das, eskaliert ein
 *  AG-Vorschlag zur Warnung — dieselbe Schwelle wie meldungen.ts. */
const AG_ESKALATION_MS = 30 * 60_000;

/** Kurzbezeichnung eines Trägerjobs für Empfehlungstexte. */
export function traegerLabel(p: { eintrag: JobEintrag }): string {
  return p.eintrag.schiffsname ?? vonTypeLabel(p.eintrag);
}
