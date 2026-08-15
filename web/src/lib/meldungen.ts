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
import { abteilzeitVon, benoetigteLotsenAnzahl, sortiereEintraege, vonTypeLabel } from "./coreJob";
import { formatUhrzeit } from "./format";
import { istListenvergabeJob, VERGABE_GRUPPE } from "./listenvergabe";
import { geplanterAbruf, planeEinsatzstation, planeEinsatzstationMitVergaben } from "./planungEinsatzstation";
import { ANMELDUNG_ESKALATION_MS, ANMELDUNG_VORWARNUNG_MS, etaSeestation, planungsEta } from "./seestation";
import { seeLotsenAnzahl } from "./seestationAbteilen";
import { berechneSeestationsDefizite, knappeVorlaeufe } from "./seestationBedarf";

export type MeldungsStufe = "alarm" | "warnung" | "vorschlag" | "info";

export interface Meldung {
  /** stabiler Schlüssel, solange die Ursache besteht (Ton-Erkennung, React-Key) */
  id: string;
  stufe: MeldungsStufe;
  /** Kategorie für die gruppierte Kachel-Anzeige (z.B. "Abruf überfällig") —
   *  mehrere Meldungen derselben Art werden dort zu einer Zeile "N× Art"
   *  zusammengefasst (siehe gruppiereMeldungen). */
  art: string;
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
  seeSchiffe: SeeSchiff[];
  seestationLotsen: SeestationLotse[];
  seeAbteilungen: SeeAbteilung[];
  /** echte V-Nr.-Zählung (Settings + verbrauchte Nummern): die potentiellen
   *  V-Nrn der Vorschau-Lotsen bestimmen ihre Position im Seestations-Pool —
   *  und damit, wer bei knappen Lotsen welches Schiff bekommt. Die Bilanz
   *  muss hier exakt wie die Seestation-Seite rechnen (siehe
   *  lib/seestationBedarf.ts). */
  vNrStart: number;
  verbrauchteVNrn: number[];
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
    // Listenvergaben haben keinen Abruf-Vorlauf — die Abteilung erfolgt
    // direkt mit dem Anruf. Vorwarnung/Alarm hängen deshalb an der
    // ABTEILZEIT selbst (und erlöschen mit dem Abteilen, weil der Job dann
    // aus der Planung fällt).
    if (istListenvergabeJob(job)) {
      const gewinner = (zuweisungen.get(job.id) ?? [])[0];
      const wer = gewinner ? `${gewinner.name} anrufen und abteilen` : "kein geeigneter Lotse in der Zählung";
      const rest = abteilzeit.getTime() - jetzt.getTime();
      if (rest <= 0) {
        meldungen.push({
          id: `vergabe-abteilung-alarm-${job.id}`,
          stufe: "alarm",
          art: "Listenvergabe überfällig",
          zeit: abteilzeit,
          text: `Listenvergabe ${job.typ} überfällig: Abteilung ${formatUhrzeit(abteilzeit)} — ${wer}`,
        });
      } else if (rest <= ABRUF_VORWARNUNG_MS) {
        meldungen.push({
          id: `vergabe-abteilung-warnung-${job.id}`,
          stufe: "warnung",
          art: "Listenvergabe bald abteilen",
          zeit: abteilzeit,
          text: `Listenvergabe ${job.typ} um ${formatUhrzeit(abteilzeit)} abteilen — ${wer}`,
        });
      }
      continue;
    }
    for (const lotse of zuweisungen.get(job.id) ?? []) {
      if (lotse.abgerufen) continue;
      const abruf = geplanterAbruf(abteilzeit, lotse.abrufStunden);
      if (!abruf) continue;
      const rest = abruf.getTime() - jetzt.getTime();
      if (rest <= 0) {
        meldungen.push({
          id: `abruf-alarm-${lotse.name}`,
          stufe: "alarm",
          art: "Abruf überfällig",
          zeit: abruf,
          text: `Abruf überfällig: ${lotse.name} sofort abrufen — gepl. Abruf ${formatUhrzeit(abruf)} (${jobLabel(job)}, Abt. ${formatUhrzeit(abteilzeit)})`,
        });
      } else if (rest <= ABRUF_VORWARNUNG_MS) {
        meldungen.push({
          id: `abruf-warnung-${lotse.name}`,
          stufe: "warnung",
          art: "Abruf bald fällig",
          zeit: abruf,
          text: `${lotse.name} um ${formatUhrzeit(abruf)} abrufen (${jobLabel(job)}, Abt. ${formatUhrzeit(abteilzeit)})`,
        });
      }
    }
  }
  return meldungen;
}

/**
 * Abteilung Einsatzplanung überfällig: die berechnete Abt.Zeit eines Jobs
 * ist bereits verstrichen, der Job aber noch nicht vollständig abgeteilt.
 * Listenvergaben haben dafür schon eine eigene Meldung (siehe
 * listenvergabeMeldungen weiter unten, Abteilung erfolgt dort direkt mit
 * dem Anruf) — hier ausgeschlossen, um nicht doppelt zu melden.
 */
function abteilungEinsatzplanungMeldungen(daten: MeldungsDaten, jetzt: Date, settings: AbteilzeitSettings): Meldung[] {
  const meldungen: Meldung[] = [];
  const abgeteiltProJob = new Map<number, number>();
  for (const a of daten.abteilungen) abgeteiltProJob.set(a.jobId, (abgeteiltProJob.get(a.jobId) ?? 0) + 1);
  const jobsSortiert = sortiereEintraege(daten.jobs, settings).filter(
    ({ eintrag }) => benoetigteLotsenAnzahl(eintrag) - (abgeteiltProJob.get(eintrag.id) ?? 0) > 0,
  );
  for (const { eintrag: job, abteilzeit } of jobsSortiert) {
    if (!abteilzeit || istListenvergabeJob(job) || abteilzeit.getTime() > jetzt.getTime()) continue;
    meldungen.push({
      id: `abteilung-ep-alarm-${job.id}`,
      stufe: "alarm",
      art: "Abteilung überfällig",
      zeit: abteilzeit,
      text: `Abteilung überfällig: ${jobLabel(job)} sollte bereits um ${formatUhrzeit(abteilzeit)} abgeteilt sein`,
    });
  }
  return meldungen;
}

/**
 * Ankunft Seestation überfällig: ein bereits abgeteilter Lotse (Versetzliste
 * "Lotsen im Revier") ist noch nicht "Auf Seestation" markiert, obwohl seine
 * berechnete/manuelle ETA Stn (siehe lib/seestation.ts::etaSeestation)
 * schon verstrichen ist.
 */
function seestationAnkunftMeldungen(daten: MeldungsDaten, jetzt: Date): Meldung[] {
  const meldungen: Meldung[] = [];
  for (const a of daten.abteilungen) {
    if (a.vNr === undefined || a.abgeschoepft || a.ankert || a.seeAbgeteilt || a.aufSeestation) continue;
    const eta = etaSeestation(a);
    if (eta.getTime() > jetzt.getTime()) continue;
    meldungen.push({
      id: `seestation-ankunft-alarm-${a.id}`,
      stufe: "alarm",
      art: "Ankunft Seestation überfällig",
      zeit: eta,
      text: `Ankunft Seestation überfällig: ${a.lotsenName} sollte bereits um ${formatUhrzeit(eta)} auf der Seestation sein`,
    });
  }
  return meldungen;
}

/** Vorwarnzeit/Eskalation der "Anmeldung Seestation" (siehe
 *  seestationSchiffMeldungen): Warnung ab 30 Min. vor ETA, Alarm ab 15 Min.
 *  danach — bewusst andere Schwellen als ABRUF_VORWARNUNG_MS, da es hier
 *  nicht um einen Handlungszeitpunkt, sondern eine reine Registrierung geht. */

/**
 * Zwei Meldungen je See-Schiff (Liste "ETA Seestation"):
 * - Abteilung Seestation überfällig: die ETA ist verstrichen, es fehlen
 *   aber noch Lotsen (siehe lib/seestationAbteilen.ts::seeLotsenAnzahl
 *   abzüglich bereits vorhandener SeeAbteilungen) — unabhängig davon, ob
 *   überhaupt ein Lotse dafür verfügbar wäre (das deckt bereits die
 *   Seestations-Bilanz oben ab); hier geht es um die reine Fälligkeit.
 * - Anmeldung überfällig/bald fällig: das Schiff ist noch nicht
 *   "angemeldet" (SeeSchiff.angemeldet).
 * Beide entfallen, sobald das Schiff vollständig abgeteilt ist.
 */
function seestationSchiffMeldungen(daten: MeldungsDaten, jetzt: Date): Meldung[] {
  const meldungen: Meldung[] = [];
  const abgeteiltProSchiff = new Map<number, number>();
  for (const sa of daten.seeAbteilungen)
    abgeteiltProSchiff.set(sa.seeSchiffId, (abgeteiltProSchiff.get(sa.seeSchiffId) ?? 0) + 1);

  for (const schiff of daten.seeSchiffe) {
    const verbleibend = seeLotsenAnzahl(schiff) - (abgeteiltProSchiff.get(schiff.id) ?? 0);
    if (verbleibend <= 0) continue;

    // Abt.Zeit statt roher ETA: bei E3/St-Schiffen ist die Fahrt zum Schiff
    // (1,5 Std.) bereits einkalkuliert (siehe seestation.ts::planungsEta) —
    // sonst schlüge die Meldung 1,5 Std. zu spät an.
    const abtZeit = planungsEta(schiff);
    if (abtZeit.getTime() <= jetzt.getTime()) {
      meldungen.push({
        id: `seestation-abteilung-alarm-${schiff.id}`,
        stufe: "alarm",
        art: "Abteilung Seestation überfällig",
        zeit: abtZeit,
        text: `Abteilung Seestation überfällig: ${schiff.schiffsname} sollte bereits um ${formatUhrzeit(abtZeit)} Lotsen erhalten haben${schiff.e3st ? " (E3/St, Abt.Zeit)" : ""}`,
      });
    }

    if (!schiff.angemeldet) {
      const rest = schiff.eta.getTime() - jetzt.getTime();
      if (rest <= -ANMELDUNG_ESKALATION_MS) {
        meldungen.push({
          id: `seestation-anmeldung-alarm-${schiff.id}`,
          stufe: "alarm",
          art: "Anmeldung überfällig",
          zeit: schiff.eta,
          text: `Anmeldung überfällig: ${schiff.schiffsname} (ETA ${formatUhrzeit(schiff.eta)}) noch nicht angemeldet`,
        });
      } else if (rest <= ANMELDUNG_VORWARNUNG_MS) {
        meldungen.push({
          id: `seestation-anmeldung-warnung-${schiff.id}`,
          stufe: "warnung",
          art: "Anmeldung bald fällig",
          zeit: schiff.eta,
          text: `${schiff.schiffsname} (ETA ${formatUhrzeit(schiff.eta)}) noch nicht angemeldet`,
        });
      }
    }
  }
  return meldungen;
}


/**
 * Knapper Vorlauf: die Zuteilung akzeptiert seit der Absenkung auf 15 Min.
 * auch Lotsen, die kurz vor dem Schiff eintreffen (siehe
 * lib/seestation.ts::VORLAUF_AUF_STATION_MS). Angestrebt ist aber eine
 * Stunde — wird die unterschritten, meldet sich das hier als WARNUNG
 * (bewusst kein Alarm: der Lotse ist zugeteilt, es wird nur eng).
 */
function vorlaufMeldungen(daten: MeldungsDaten, jetzt: Date): Meldung[] {
  return knappeVorlaeufe(daten, jetzt).map((k) => ({
    id: `seestation-vorlauf-${k.schiff.id}-${k.lotsenKey}`,
    stufe: "warnung" as const,
    art: "Vorlauf Seestation knapp",
    zeit: k.schiff.eta,
    text:
      `Vorlauf Seestation knapp: ${k.lotsenName} ist erst um ${formatUhrzeit(k.ankunft)} auf Station, ` +
      `${k.schiff.schiffsname} kommt um ${formatUhrzeit(k.schiff.eta)} — nur ${k.vorlaufMinuten} Min. Vorlauf (angestrebt: 60)`,
  }));
}

/**
 * Seestations-Bilanz: nutzt die geteilte Defizit-Berechnung (siehe
 * lib/seestationBedarf.ts, dort auch die ausführliche Erläuterung zu
 * VERPLANTEN/FREIEN Lotsen und dem "verspätet zählt weiterhin als Bedarf"-
 * Prinzip). Nur echte Alarme (kein Trägerjob und Tender-AG nicht mehr
 * rechtzeitig möglich) werden hier je Schiff als eigene, dringende Meldung
 * geführt. Vorschlag/Warnung-Fälle (noch eine AG-Fahrt planbar) erscheinen
 * NICHT in der Meldungs-/Alarm-Kachel — die eigene "AG-Planung"-Karte im
 * Dashboard (siehe lib/agPlanung.ts) ist dafür die alleinige Anzeige, damit
 * dieselbe Information nicht doppelt (und potenziell mit Ton-Alarm)
 * auftaucht.
 */
function seestationsMeldungen(daten: MeldungsDaten, jetzt: Date, settings: AbteilzeitSettings): Meldung[] {
  const meldungen: Meldung[] = [];
  const defizite = berechneSeestationsDefizite(daten, jetzt, settings);

  for (const d of defizite) {
    if (d.stufe !== "alarm") continue;
    const abtZeit = planungsEta(d.schiff);
    const fehltText = `um ${formatUhrzeit(abtZeit)} fehl${d.fehlt === 1 ? "t" : "en"} ${d.fehlt} Lotse${d.fehlt === 1 ? "" : "n"} für ${d.schiff.schiffsname}${d.schiff.e3st ? " (E3/St, Abt.Zeit)" : ""}`;
    meldungen.push({
      id: `seestation-defizit-${d.schiff.id}`,
      stufe: "alarm",
      art: "Seestation: Lotse fehlt",
      zeit: abtZeit,
      text: `Seestation: ${fehltText} — kein Trägerjob und Tender-AG nicht mehr rechtzeitig (3 Std. Vorlauf + 3,5 Std. Anfahrt)`,
    });
  }
  return meldungen;
}

/**
 * Datenqualität: doppelte Lotsennamen in der Einsatzstations-Liste. Der
 * Name ist an einigen Stellen der Schlüssel (Abruf-Meldungen, Abteilung-
 * Rückgängig) — bei Dubletten könnte der falsche Lotse getroffen werden,
 * daher eine Warnung, damit der User einen der Namen abändern kann.
 */
function namensMeldungen(daten: MeldungsDaten): Meldung[] {
  const anzahlProName = new Map<string, number>();
  for (const lotse of daten.lotsen) anzahlProName.set(lotse.name, (anzahlProName.get(lotse.name) ?? 0) + 1);
  const meldungen: Meldung[] = [];
  for (const [name, anzahl] of anzahlProName) {
    if (anzahl < 2) continue;
    meldungen.push({
      id: `doppelname-${name}`,
      stufe: "warnung",
      art: "Doppelter Lotsenname",
      text: `Doppelter Lotsenname: "${name}" ist ${anzahl}× in der Lotsenliste — bitte eindeutig machen (Verwechslungsgefahr)`,
    });
  }
  return meldungen;
}

/**
 * Listenvergabe-Überwachung:
 * - zwei Listenvergaben dürfen nicht zeitgleich abgeteilt werden (bei
 *   mehreren Vergaben gilt 1 Minute Abstand: 12:01, 12:02, …)
 * - WR wird nur um 06:01, 12:01 oder 18:01 abgeteilt.
 * - die 4er-Gruppe muss voll besetzt werden können — stehen weniger als 4
 *   geeignete Lotsen zur Verfügung, ist das ein Alarm.
 */
function listenvergabeMeldungen(daten: MeldungsDaten, settings: AbteilzeitSettings): Meldung[] {
  const meldungen: Meldung[] = [];
  const vergaben = daten.jobs
    .map((job) => ({ job, abteilzeit: abteilzeitVon(job, settings) }))
    .filter(({ job }) => istListenvergabeJob(job));

  // Unterbesetzte Zählgruppen: dieselbe Planung wie die Einsatzplanung —
  // die Meldung erlischt, sobald die Vergabe abgeteilt ist (kein
  // Restbedarf) oder wieder genug geeignete Lotsen in der Liste stehen.
  const abgeteiltProJob = new Map<number, number>();
  for (const a of daten.abteilungen) abgeteiltProJob.set(a.jobId, (abgeteiltProJob.get(a.jobId) ?? 0) + 1);
  const planung = planeEinsatzstationMitVergaben(
    daten.jobs,
    daten.lotsen,
    daten.aktuelleFahrt,
    settings,
    abgeteiltProJob,
  );
  for (const { job, abteilzeit } of vergaben) {
    if (benoetigteLotsenAnzahl(job) - (abgeteiltProJob.get(job.id) ?? 0) <= 0) continue;
    const gruppe = planung.vergaben.get(job.id)?.gruppe ?? [];
    if (gruppe.length >= VERGABE_GRUPPE) continue;
    meldungen.push({
      id: `vergabe-unterbesetzt-${job.id}`,
      stufe: "alarm",
      art: "Listenvergabe unterbesetzt",
      zeit: abteilzeit,
      text:
        gruppe.length === 0
          ? `Listenvergabe ${job.typ}: kein geeigneter Lotse für die Zählung verfügbar`
          : `Listenvergabe ${job.typ}: nur ${gruppe.length} von ${VERGABE_GRUPPE} Lotsen für die Zählung verfügbar`,
    });
  }

  const proMinute = new Map<number, JobEintrag[]>();
  for (const { job, abteilzeit } of vergaben) {
    if (!abteilzeit) continue;
    const minute = Math.floor(abteilzeit.getTime() / 60_000);
    proMinute.set(minute, [...(proMinute.get(minute) ?? []), job]);
  }
  for (const [minute, jobs] of proMinute) {
    if (jobs.length < 2) continue;
    const zeit = new Date(minute * 60_000);
    meldungen.push({
      id: `vergabe-zeitgleich-${jobs.map((j) => j.id).join("-")}`,
      stufe: "alarm",
      art: "Listenvergaben zeitgleich",
      text: `Listenvergaben ${jobs.map((j) => j.typ).join(" und ")} zeitgleich um ${formatUhrzeit(zeit)} — bitte im Minutenabstand abteilen (z.B. ${formatUhrzeit(zeit)}, ${formatUhrzeit(new Date(zeit.getTime() + 60_000))}, …)`,
      zeit,
    });
  }

  for (const { job, abteilzeit } of vergaben) {
    if (job.typ !== "WR" || !abteilzeit) continue;
    const stunden = abteilzeit.getHours();
    const minuten = abteilzeit.getMinutes();
    if ((stunden === 6 || stunden === 12 || stunden === 18) && minuten === 1) continue;
    meldungen.push({
      id: `vergabe-wr-zeit-${job.id}`,
      stufe: "alarm",
      art: "WR-Zeit falsch eingetragen",
      text: `WR-Vergabe um ${formatUhrzeit(abteilzeit)} eingetragen — WR wird um 06:01, 12:01 oder 18:01 abgeteilt`,
      zeit: abteilzeit,
    });
  }

  return meldungen;
}

export function berechneMeldungen(daten: MeldungsDaten, jetzt: Date, settings: AbteilzeitSettings): Meldung[] {
  return sortiereMeldungen([
    ...abrufMeldungen(daten, jetzt, settings),
    ...abteilungEinsatzplanungMeldungen(daten, jetzt, settings),
    ...seestationAnkunftMeldungen(daten, jetzt),
    ...seestationSchiffMeldungen(daten, jetzt),
    ...seestationsMeldungen(daten, jetzt, settings),
    ...vorlaufMeldungen(daten, jetzt),
    ...namensMeldungen(daten),
    ...listenvergabeMeldungen(daten, settings),
  ]);
}

/** Eine Zeile der Alarm-Kachel: alle Meldungen derselben Art gebündelt zu
 *  "N× Art" (dieselbe Kurzform wie die AG-Planungs-Karte). Stufe = höchste
 *  Einzelstufe der Gruppe (alarm sticht warnung usw.), Sortierung wie
 *  sortiereMeldungen (Stufe, dann früheste Zeit). */
export interface MeldungsGruppe {
  art: string;
  stufe: MeldungsStufe;
  anzahl: number;
  meldungen: Meldung[];
  frueheste?: Date;
}

export function gruppiereMeldungen(meldungen: Meldung[]): MeldungsGruppe[] {
  const gruppen = new Map<string, MeldungsGruppe>();
  for (const m of meldungen) {
    const bestehend = gruppen.get(m.art);
    if (bestehend) {
      bestehend.anzahl += 1;
      bestehend.meldungen.push(m);
      if (STUFEN_RANG[m.stufe] < STUFEN_RANG[bestehend.stufe]) bestehend.stufe = m.stufe;
      if (m.zeit && (!bestehend.frueheste || m.zeit.getTime() < bestehend.frueheste.getTime())) {
        bestehend.frueheste = m.zeit;
      }
    } else {
      gruppen.set(m.art, { art: m.art, stufe: m.stufe, anzahl: 1, meldungen: [m], frueheste: m.zeit });
    }
  }
  return [...gruppen.values()].sort((a, b) => {
    if (STUFEN_RANG[a.stufe] !== STUFEN_RANG[b.stufe]) return STUFEN_RANG[a.stufe] - STUFEN_RANG[b.stufe];
    return (a.frueheste?.getTime() ?? 0) - (b.frueheste?.getTime() ?? 0);
  });
}
