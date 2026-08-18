/**
 * Fahrt-Planung (Phase 1): Zahlenwerk für die Vorausplanung der nächsten
 * Fahrt — wie viele Jobs liegen im Fenster aus aktueller + nächster Fahrt
 * an, wie viele Lotsen sind gerade im Einsatz, wie sieht die ETA-Lage auf
 * der Seestation aus.
 *
 * Die Fahrten sind feste Tagesabschnitte:
 *   MoFa 06:00–12:00, MiFa 12:00–18:00, AFA 18:00–06:00 (Folgetag).
 */
import type { AbteilzeitSettings } from "@wache/core";
import type { Abteilung, AktuelleFahrt, JobEintrag, LotsenEintrag, SeeAbteilung, SeeSchiff, SeestationLotse } from "../data/types";
import { abteilzeitVon, benoetigteLotsenAnzahl, istAgJob, istBunkernPausiert, istCuxVergabe } from "./coreJob";
import { planungsEta, zeilenAusAbteilungen, zeilenAusSeestationLotsen } from "./seestation";
import { seeLotsenAnzahl } from "./seestationAbteilen";

/** Wählbare Fahrten der Planung — ohne "Bereitschaft". */
export const PLANBARE_FAHRTEN: AktuelleFahrt[] = ["MoFa", "MiFa", "AFA"];

/** Die im Schema folgende Fahrt: MoFa → MiFa → AFA → MoFa. */
export function folgeFahrt(fahrt: AktuelleFahrt): AktuelleFahrt {
  const i = PLANBARE_FAHRTEN.indexOf(fahrt);
  return PLANBARE_FAHRTEN[(i + 1) % PLANBARE_FAHRTEN.length];
}

/** Endstunde der Fahrt (lokale Uhrzeit). */
const FAHRT_ENDE_STUNDE: Record<AktuelleFahrt, number> = { MoFa: 12, MiFa: 18, AFA: 6 };

/** Ende der NÄCHSTEN Fahrt: das nächste Vorkommen ihrer Endstunde nach
 *  "jetzt". Beispiel um 23:10 (AFA läuft, nächste MoFa): morgen 12:00;
 *  um 02:00 (AFA läuft): heute 12:00. */
export function endeNaechsterFahrt(naechste: AktuelleFahrt, jetzt: Date): Date {
  const ende = new Date(jetzt);
  ende.setHours(FAHRT_ENDE_STUNDE[naechste], 0, 0, 0);
  if (ende.getTime() <= jetzt.getTime()) ende.setDate(ende.getDate() + 1);
  return ende;
}

export interface JobsBrbZaehlung {
  hamburg: number;
  nok: number;
  liegend: number;
  radar: number;
  vergaben: number;
  /** Summe der noch offenen AG-Lotsen bereits angelegter AG-Jobs
   *  (AG + AG (Tender)) — nicht die Vorschläge der automatischen
   *  AG-Planung. */
  ag: number;
}

/**
 * Zählt die aktuell anliegenden Jobs bis zum Ende der nächsten Fahrt.
 * "Anliegend" heißt: noch nicht (voll) abgeteilt und Abt.Zeit bis
 * `bisEnde` — auch überfällige Jobs zählen mit, sie brauchen ihre Lotsen
 * ja weiterhin. NOK-Schiffe mit gepl. Bunkern haben keine Abt.Zeit,
 * zählen aber ausdrücklich mit (sie fahren irgendwann in diesem Fenster
 * weiter).
 */
export function zaehleJobsBrb(
  jobs: JobEintrag[],
  abteilungen: Abteilung[],
  settings: AbteilzeitSettings,
  bisEnde: Date,
): JobsBrbZaehlung {
  const abgeteiltProJob = new Map<number, number>();
  for (const a of abteilungen) abgeteiltProJob.set(a.jobId, (abgeteiltProJob.get(a.jobId) ?? 0) + 1);

  // Cux-Vergaben (Brb/Cux-Schalter) zählen nicht mit — sie werden von
  // Cuxhaven-Seite bedient und binden hier keine Lotsen.
  const offen = jobs.filter(
    (j) => !istCuxVergabe(j) && benoetigteLotsenAnzahl(j) - (abgeteiltProJob.get(j.id) ?? 0) > 0,
  );
  const imFenster = (j: JobEintrag) => {
    if (istBunkernPausiert(j)) return true;
    const abteilzeit = abteilzeitVon(j, settings);
    return abteilzeit !== undefined && abteilzeit.getTime() <= bisEnde.getTime();
  };
  const relevante = offen.filter(imFenster);

  const istTyp = (j: JobEintrag, ...typen: string[]) =>
    j.liste === "andere" && j.typ !== undefined && typen.includes(j.typ);

  return {
    hamburg: relevante.filter((j) => j.liste === "hamburg").length,
    nok: relevante.filter((j) => j.liste === "nok").length,
    liegend: relevante.filter((j) => istTyp(j, "BHF", "EHF")).length,
    radar: relevante.filter((j) => istTyp(j, "Sonderradar", "Nebelradar")).length,
    // WR bleibt bewusst außen vor: die Abteilung liegt immer erst NACH der
    // bestehenden Fahrt.
    vergaben: relevante.filter((j) => istTyp(j, "2+2", "1+1", "HuLo", "WB")).length,
    ag: relevante
      .filter((j) => istAgJob(j))
      .reduce((summe, j) => summe + benoetigteLotsenAnzahl(j) - (abgeteiltProJob.get(j.id) ?? 0), 0),
  };
}

export interface LotsenAktuell {
  inFahrt: number;
  fahrwasser: number;
  aufSeestation: number;
}

/**
 * Lotsen-Lage — dieselben Quellen wie die Einsatzstations-Kachel des
 * Dashboards. "Im Fahrwasser" und "Auf Seestation" speisen sich aus der
 * Versetzliste UND den manuell/per Wachbeginn importierten
 * Seestation-Lotsen: nach einer "neuen Wache" existieren die noch nicht
 * angekommenen Lotsen nur dort (nicht in "Lotsen im Revier") und zählen
 * über zeilenAusSeestationLotsen trotzdem mit.
 */
export function zaehleLotsenAktuell(
  lotsen: LotsenEintrag[],
  abteilungen: Abteilung[],
  seestationLotsen: SeestationLotse[],
  fahrt: AktuelleFahrt,
): LotsenAktuell {
  const seeZeilen = [...zeilenAusAbteilungen(abteilungen), ...zeilenAusSeestationLotsen(seestationLotsen)];
  return {
    inFahrt: lotsen.filter((l) => l.fahrt === fahrt && !l.abgeteilt).length,
    fahrwasser: seeZeilen.filter((z) => !z.aufStation).length,
    aufSeestation: seeZeilen.filter((z) => z.aufStation).length,
  };
}

export interface SeestationLage {
  /** offene ETAs (Schiffe mit Restbedarf) bis Ende nächste Fahrt + 6 Std. */
  etasBis: number;
  /** alle offenen ETAs, ohne Zeitgrenze */
  etasGesamt: number;
  /** Summe der noch fehlenden Lotsen der `etasBis`-Schiffe */
  lotsenBedarf: number;
  /** Summe der fehlenden Lotsen ALLER offenen Schiffe, ohne Zeitgrenze */
  lotsenBedarfGesamt: number;
}

/** Puffer hinter dem Ende der nächsten Fahrt: Schiffe kurz danach müssen
 *  von dieser Fahrt noch mit bedient werden. */
export const SEESTATION_PUFFER_MS = 6 * 3_600_000;

export function zaehleSeestation(
  seeSchiffe: SeeSchiff[],
  seeAbteilungen: SeeAbteilung[],
  endeNaechste: Date,
): SeestationLage {
  const abgeteiltProSchiff = new Map<number, number>();
  for (const sa of seeAbteilungen)
    abgeteiltProSchiff.set(sa.seeSchiffId, (abgeteiltProSchiff.get(sa.seeSchiffId) ?? 0) + 1);
  // Abt.Zeit-Basis wie überall: planungsEta (E3/St 1,5 Std. vor der ETA).
  const offene = seeSchiffe
    .map((s) => ({ eta: planungsEta(s).getTime(), fehlt: seeLotsenAnzahl(s) - (abgeteiltProSchiff.get(s.id) ?? 0) }))
    .filter((s) => s.fehlt > 0);
  const grenze = endeNaechste.getTime() + SEESTATION_PUFFER_MS;
  const imFenster = offene.filter((s) => s.eta <= grenze);
  return {
    etasBis: imFenster.length,
    etasGesamt: offene.length,
    lotsenBedarf: imFenster.reduce((summe, s) => summe + s.fehlt, 0),
    lotsenBedarfGesamt: offene.reduce((summe, s) => summe + s.fehlt, 0),
  };
}

/**
 * Lotsen, die bis zum Planungsende auf der Seestation zur Verfügung
 * stehen: die bereits dort sind plus die, die im Revier unterwegs sind
 * und rechtzeitig ankommen (geplante Ankunft ≤ Planungsende). Quellen
 * wie überall — Versetzliste (Abteilungen) UND die manuell/per
 * Wachbeginn angelegten Seestation-Lotsen.
 *
 * Maßgeblich ist dieselbe Grenze wie beim Bedarf (siehe
 * zaehleSeestation: Ende der nächsten Fahrt + Puffer) — sonst stünde ein
 * Bedarf bis kurz nach Fahrtende einer Verfügbarkeit nur bis Fahrtende
 * gegenüber, und die Anforderung fiele systematisch zu hoch aus.
 */
export function zaehleVerfuegbareSeeLotsen(
  abteilungen: Abteilung[],
  seestationLotsen: SeestationLotse[],
  endeNaechste: Date,
): number {
  const grenze = endeNaechste.getTime() + SEESTATION_PUFFER_MS;
  const zeilen = [...zeilenAusAbteilungen(abteilungen), ...zeilenAusSeestationLotsen(seestationLotsen)];
  return zeilen.filter((z) => z.aufStation || (z.etaStn !== undefined && z.etaStn.getTime() <= grenze)).length;
}
