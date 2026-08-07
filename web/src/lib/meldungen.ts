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
import type { Abteilung, AktuelleFahrt, JobEintrag, LotsenEintrag } from "../data/types";
import { benoetigteLotsenAnzahl, sortiereEintraege, vonTypeLabel } from "./coreJob";
import { formatUhrzeit } from "./format";
import { geplanterAbruf, planeEinsatzstation } from "./planungEinsatzstation";

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

export interface MeldungsDaten {
  jobs: JobEintrag[];
  lotsen: LotsenEintrag[];
  aktuelleFahrt: AktuelleFahrt;
  abteilungen: Abteilung[];
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

export function berechneMeldungen(daten: MeldungsDaten, jetzt: Date, settings: AbteilzeitSettings): Meldung[] {
  return sortiereMeldungen([...abrufMeldungen(daten, jetzt, settings)]);
}
