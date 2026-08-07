/**
 * Meldungs-Engine des Dashboards: berechnet aus dem aktuellen Datenstand
 * die Meldungen, die der Einsatzleiter sehen muss — reine Funktion ohne
 * eigenen State, wird vom Dashboard bei jedem Zeit-Tick neu aufgerufen.
 *
 * Stufen: alarm (rot, sofort handeln) > warnung (orange, bald handeln) >
 * vorschlag (Planungsempfehlung, z.B. AG-Fahrt) > info.
 *
 * Die id einer Meldung ist stabil, solange ihre Ursache besteht — darüber
 * erkennt der Ton-Layer später, ob eine Meldung NEU ist (einmaliger Ton).
 */
import type { AbteilzeitSettings } from "@wache/core";
import type {
  Abteilung,
  AktuelleFahrt,
  JobEintrag,
  LotsenEintrag,
  SeeAbteilung,
  SeeSchiff,
  SeestationLotse,
} from "../data/types";
import { benoetigteLotsenAnzahl, sortiereEintraege, vonTypeLabel } from "./coreJob";
import { formatUhrzeit } from "./format";
import { geplanterAbruf, planeEinsatzstation } from "./planungEinsatzstation";
import { ANFAHRT_SEESTATION_MS, sortiereSeestation, zeilenAusAbteilungen, zeilenAusSeestationLotsen } from "./seestation";
import { simuliereSeestation } from "./seestationAbteilen";

export type MeldungsStufe = "alarm" | "warnung" | "vorschlag" | "info";

export interface Meldung {
  /** stabiler Schlüssel, solange die Ursache besteht (Ton-Erkennung, React-Key) */
  id: string;
  stufe: MeldungsStufe;
  text: string;
  /** Zeitbezug der Meldung (für die Sortierung innerhalb einer Stufe) */
  zeit?: Date;
}

/** Vorwarnzeit vor dem geplanten Abruf (Warnung orange). */
export const ABRUF_VORWARNUNG_MS = 15 * 60_000;

/** Ein Lotse muss min. 1 Std. vor dem Schiffs-ETA auf der Seestation sein. */
export const VORLAUF_AUF_STATION_MS = 3_600_000;

/** Tender-AG: braucht min. 3 Std. Vorlauf bis zur Ankunft auf Station. */
export const TENDER_VORLAUF_MS = 3 * 3_600_000;

/** Wird die letzte Handlungsmöglichkeit knapper als das, eskaliert ein
 *  AG-Vorschlag zur Warnung. */
const AG_ESKALATION_MS = 30 * 60_000;

export interface MeldungsDaten {
  jobs: JobEintrag[];
  lotsen: LotsenEintrag[];
  aktuelleFahrt: AktuelleFahrt;
  abteilungen: Abteilung[];
  seeSchiffe: SeeSchiff[];
  seestationLotsen: SeestationLotse[];
  seeAbteilungen: SeeAbteilung[];
}

const STUFEN_RANG: Record<MeldungsStufe, number> = { alarm: 0, warnung: 1, vorschlag: 2, info: 3 };

export function sortiereMeldungen(meldungen: Meldung[]): Meldung[] {
  return [...meldungen].sort((a, b) => {
    if (STUFEN_RANG[a.stufe] !== STUFEN_RANG[b.stufe]) return STUFEN_RANG[a.stufe] - STUFEN_RANG[b.stufe];
    return (a.zeit?.getTime() ?? 0) - (b.zeit?.getTime() ?? 0);
  });
}

/** Kurzbezeichnung eines Jobs für Meldungstexte. */
function jobLabel(job: JobEintrag): string {
  return job.schiffsname ?? vonTypeLabel(job);
}

/**
 * Abruf-Überwachung (Einsatzplanung): für jeden geplanten Lotsen gilt
 * gepl. Abruf = Abteilzeit − Abrufzeit. Ist der Lotse dann noch nicht
 * abgerufen: Warnung ab 15 Min. davor, Alarm ab Überschreitung — der Alarm
 * bleibt bestehen, bis der Lotse tatsächlich abgerufen wurde.
 */
function abrufMeldungen(daten: MeldungsDaten, jetzt: Date, settings: AbteilzeitSettings): Meldung[] {
  const meldungen: Meldung[] = [];
  const abgeteiltProJob = new Map<number, number>();
  for (const a of daten.abteilungen) abgeteiltProJob.set(a.jobId, (abgeteiltProJob.get(a.jobId) ?? 0) + 1);
  const jobsSortiert = sortiereEintraege(daten.jobs, settings).filter(
    ({ eintrag }) => benoetigteLotsenAnzahl(eintrag) - (abgeteiltProJob.get(eintrag.id) ?? 0) > 0,
  );
  const zuweisungen = planeEinsatzstation(daten.jobs, daten.lotsen, daten.aktuelleFahrt, settings, abgeteiltProJob);

  for (const { eintrag: job, abteilzeit } of jobsSortiert) {
    if (!abteilzeit) continue;
    for (const lotse of zuweisungen.get(job.id) ?? []) {
      if (lotse.abgerufen) continue;
      const abruf = geplanterAbruf(abteilzeit, lotse.abrufStunden);
      if (!abruf) continue;
      const rest = abruf.getTime() - jetzt.getTime();
      if (rest <= 0) {
        meldungen.push({
          id: `abruf-alarm-${lotse.name}`,
          stufe: "alarm",
          zeit: abruf,
          text: `Abruf überfällig: ${lotse.name} sofort abrufen — gepl. Abruf ${formatUhrzeit(abruf)} (${jobLabel(job)}, Abt. ${formatUhrzeit(abteilzeit)})`,
        });
      } else if (rest <= ABRUF_VORWARNUNG_MS) {
        meldungen.push({
          id: `abruf-warnung-${lotse.name}`,
          stufe: "warnung",
          zeit: abruf,
          text: `${lotse.name} um ${formatUhrzeit(abruf)} abrufen (${jobLabel(job)}, Abt. ${formatUhrzeit(abteilzeit)})`,
        });
      }
    }
  }
  return meldungen;
}

/**
 * Seestations-Bilanz: simuliert Schiff für Schiff (alle Schiffe der
 * ETA-Liste, nach ETA sortiert), ob genügend geeignete Lotsen rechtzeitig —
 * d.h. min. 1 Std. vor dem Schiffs-ETA — auf der Station sind. Ein Lotse
 * zählt, wenn er bereits vor Ort ist oder seine ETA Stn früh genug liegt;
 * jeder Lotse wird nur einmal vergeben. Bei Unterdeckung entsteht ein
 * AG-Fahrt-Vorschlag mit konkreten Trägerjobs (Hamburg/NOK), ersatzweise
 * eine Tender-AG (min. 3 Std. Vorlauf); ist auch das nicht mehr möglich,
 * wird die Unterdeckung zum Alarm.
 */
function seestationsMeldungen(daten: MeldungsDaten, jetzt: Date, settings: AbteilzeitSettings): Meldung[] {
  const meldungen: Meldung[] = [];
  const abgeteiltProSchiff = new Map<number, number>();
  for (const sa of daten.seeAbteilungen)
    abgeteiltProSchiff.set(sa.seeSchiffId, (abgeteiltProSchiff.get(sa.seeSchiffId) ?? 0) + 1);

  const pool = sortiereSeestation([
    ...zeilenAusAbteilungen(daten.abteilungen),
    ...zeilenAusSeestationLotsen(daten.seestationLotsen),
  ]);
  const projektion = simuliereSeestation(daten.seeSchiffe, pool, abgeteiltProSchiff, VORLAUF_AUF_STATION_MS);

  // AG-Trägerjobs: künftige Hamburg/NOK-Abfahrten, an die eine AG-Fahrt
  // gehängt werden kann (aufsteigend nach Abteilzeit).
  const traeger = sortiereEintraege(daten.jobs, settings).filter(
    (p): p is { eintrag: JobEintrag; abteilzeit: Date } =>
      (p.eintrag.liste === "hamburg" || p.eintrag.liste === "nok") &&
      p.abteilzeit !== undefined &&
      p.abteilzeit.getTime() >= jetzt.getTime(),
  );

  for (const schiff of daten.seeSchiffe) {
    const fehlt = projektion.get(schiff.id)?.fehlt ?? 0;
    if (fehlt <= 0) continue;
    const ankunftsFrist = schiff.eta.getTime() - VORLAUF_AUF_STATION_MS;

    // Handlungsoptionen: späteste AG-Abteilzeit = Ankunftsfrist − Anfahrt;
    // Tender-AG muss bis Ankunftsfrist − 3 Std. eingeplant sein.
    const abfahrtsFrist = ankunftsFrist - ANFAHRT_SEESTATION_MS;
    const kandidaten = traeger.filter((p) => p.abteilzeit.getTime() <= abfahrtsFrist);
    const tenderFrist = ankunftsFrist - TENDER_VORLAUF_MS;
    const tenderMoeglich = jetzt.getTime() <= tenderFrist;

    const fehltText = `um ${formatUhrzeit(schiff.eta)} fehl${fehlt === 1 ? "t" : "en"} ${fehlt} Lotse${fehlt === 1 ? "" : "n"} für ${schiff.schiffsname}`;

    if (kandidaten.length === 0 && !tenderMoeglich) {
      meldungen.push({
        id: `seestation-defizit-${schiff.id}`,
        stufe: "alarm",
        zeit: schiff.eta,
        text: `Seestation: ${fehltText} — kein Trägerjob und Tender-Vorlauf (3 Std.) überschritten`,
      });
      continue;
    }

    let empfehlung: string;
    if (kandidaten.length > 0) {
      const letzte = kandidaten.slice(-2).reverse();
      empfehlung = `AG-Fahrt planen: ${letzte
        .map((p) => `${p.eintrag.schiffsname ?? vonTypeLabel(p.eintrag)} (Abt. ${formatUhrzeit(p.abteilzeit)})`)
        .join(" oder ")}`;
    } else {
      empfehlung = `kein Trägerjob passt — Tender-AG bis ${formatUhrzeit(new Date(tenderFrist))} einplanen`;
    }

    const traegerFrist = kandidaten.length > 0 ? kandidaten[kandidaten.length - 1].abteilzeit.getTime() : -Infinity;
    const handlungsFrist = Math.max(traegerFrist, tenderMoeglich ? tenderFrist : -Infinity);
    const stufe: MeldungsStufe = handlungsFrist - jetzt.getTime() <= AG_ESKALATION_MS ? "warnung" : "vorschlag";

    meldungen.push({
      id: `seestation-defizit-${schiff.id}`,
      stufe,
      zeit: schiff.eta,
      text: `Seestation: ${fehltText} — ${empfehlung}`,
    });
  }
  return meldungen;
}

export function berechneMeldungen(daten: MeldungsDaten, jetzt: Date, settings: AbteilzeitSettings): Meldung[] {
  return sortiereMeldungen([...abrufMeldungen(daten, jetzt, settings), ...seestationsMeldungen(daten, jetzt, settings)]);
}
