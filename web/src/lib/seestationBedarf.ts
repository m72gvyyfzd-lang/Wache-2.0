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

export interface SeestationDefizit {
  schiff: SeeSchiff;
  fehlt: number;
  /** "alarm" = kein Trägerjob und Tender-AG nicht mehr rechtzeitig möglich */
  stufe: MeldungsStufe;
  /** bester (spätester noch passender) Trägerjob-Kandidat */
  primaerTraeger?: { eintrag: JobEintrag; abteilzeit: Date };
  /** zweitbester Kandidat, für die "oder"-Empfehlung im Einzelfall */
  sekundaerTraeger?: { eintrag: JobEintrag; abteilzeit: Date };
  tenderMoeglich: boolean;
  tenderFrist: number;
}

export function berechneSeestationsDefizite(
  daten: MeldungsDaten,
  jetzt: Date,
  settings: AbteilzeitSettings,
): SeestationDefizit[] {
  const abgeteiltProSchiff = new Map<number, number>();
  for (const sa of daten.seeAbteilungen)
    abgeteiltProSchiff.set(sa.seeSchiffId, (abgeteiltProSchiff.get(sa.seeSchiffId) ?? 0) + 1);

  // vNrStart/verbrauchteVNrn sind hier irrelevant (nur für die V-Nr.-
  // Anzeige gebraucht, die diese Bilanz nicht darstellt).
  const { verplante } = vorschauZeilen(daten.jobs, daten.lotsen, daten.aktuelleFahrt, daten.abteilungen, settings, 0, [], jetzt);
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
      defizite.push({ schiff, fehlt, stufe: "alarm", tenderMoeglich, tenderFrist });
      continue;
    }

    const letzte = kandidaten.slice(-2).reverse();
    const traegerFrist = kandidaten.length > 0 ? kandidaten[kandidaten.length - 1].abteilzeit.getTime() : -Infinity;
    const handlungsFrist = Math.max(traegerFrist, tenderMoeglich ? tenderFrist : -Infinity);
    const stufe: MeldungsStufe = handlungsFrist - jetzt.getTime() <= AG_ESKALATION_MS ? "warnung" : "vorschlag";

    defizite.push({
      schiff,
      fehlt,
      stufe,
      primaerTraeger: letzte[0],
      sekundaerTraeger: letzte[1],
      tenderMoeglich,
      tenderFrist,
    });
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
