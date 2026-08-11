/**
 * "Planung Einsatzstation": weist die Lotsen den Jobs zu.
 *
 * Grundprinzip: FIFO — der erste Lotse in der Reihenfolge (siehe
 * lib/lotsenOrdnung.ts::sortiereUndNummeriere) bekommt den ersten Job (nach
 * Abteilzeit sortiert), usw. Passt die Kat. eines Lotsen nicht zum Job,
 * wird er übersprungen und bleibt für den nächsten Job in der Warteschlange
 * — er wird also nicht verbraucht, nur vertagt. Braucht ein Job mehrere
 * Lotsen (z.B. AGF einkommend), gilt für den ersten darfFahren() und für
 * alle weiteren darfZweiterLotse().
 *
 * Muss bei jeder Änderung (Jobs, Lotsen, aktuelle Fahrt) neu berechnet
 * werden — daher rein funktional, kein eigener State.
 */
import { darfFahren, darfJobTyp, istListenvergabeTyp, schiffsRang, type AbteilzeitSettings } from "@wache/core";
import type { AktuelleFahrt, JobEintrag, LotsenEintrag } from "../data/types";
import { benoetigteLotsenAnzahl, sortiereEintraege, type EintragMitAbteilzeit } from "./coreJob";
import { istListenvergabeJob, planeListenvergabe, toernStand, type VergabePlanung } from "./listenvergabe";
import { sortiereUndNummeriere } from "./lotsenOrdnung";

/** Prüft dieselben Bedingungen wie die Planung, liefert aber den Grund als
 *  Warnungstext (für das Abteilen-Fragefenster). undefined = alles passt.
 *  Jeder Lotse (auch weitere AG-Lotsen) braucht die volle Kat. — die
 *  Zweitlotsen-Regel (ab Kat. 3+) gilt nur für echte Schiffe mit 2 Lotsen
 *  (siehe lib/seestationAbteilen.ts), nicht für AG-Jobs. */
export function eignungsWarnung(job: JobEintrag, lotse: LotsenEintrag): string | undefined {
  const schiffsKat = job.kategorie ?? "";
  // Sonderradar/Nebelradar sind Lotsen-Dienste ohne festes Schiff — die
  // eingegebene Kat. (Schiff) ist reine Zusatzinfo und darf die Zuweisung
  // nicht einschränken. Maßgeblich ist allein darfJobTyp (min. Kat. 3+).
  const istRadar = job.typ === "Sonderradar" || job.typ === "Nebelradar";
  if (!istRadar && !darfFahren(schiffsKat, lotse.kategorie)) return "Kat. des Lotsen zu klein";
  if (job.typ !== undefined && !darfJobTyp(job.typ, lotse.kategorie)) return `Kat. des Lotsen reicht nicht für ${job.typ}`;
  if (job.ehfLotseBenoetigt && schiffsRang(schiffsKat) >= 4 && !lotse.elbehafen) return "Lotse nicht in EH-Liste";
  if (job.liste === "andere" && istListenvergabeTyp(job.typ) && toernStand(lotse, job.typ) <= 0)
    return `Lotse nimmt nicht am ${job.typ}-Dienst teil (Törn 0)`;
  return undefined;
}

function istGeeignet(job: JobEintrag, lotse: LotsenEintrag): boolean {
  return eignungsWarnung(job, lotse) === undefined;
}

export interface EinsatzstationPlanung {
  /** jobId -> zugewiesene Lotsen (in Zuweisungsreihenfolge) */
  zuweisungen: Map<number, LotsenEintrag[]>;
  /** jobId -> Gruppe + Gewinner je Listenvergabe (für die "in der
   *  Zählung"-Anzeige der Einsatzplanung) */
  vergaben: Map<number, VergabePlanung>;
}

/**
 * Vollständige Planung: ZUERST die Listenvergaben (in Abteilzeit-
 * Reihenfolge, jede auf dem aktuellen Reststand — "erste Vergabe berechnet
 * und abgeteilt, dann neu berechnet"), DANACH die übrigen Jobs per FIFO
 * auf der Restliste. Die Listenvergabe bindet ihren Gewinner also auch
 * dann, wenn er nach FIFO eigentlich ein früheres Schiff bekäme — die
 * Schiffs-Warteschlange fließt um ihn herum.
 */
export function planeEinsatzstationMitVergaben(
  jobs: JobEintrag[],
  lotsen: LotsenEintrag[],
  aktuelleFahrt: AktuelleFahrt,
  settings: AbteilzeitSettings,
  abgeteiltProJob?: Map<number, number>,
): EinsatzstationPlanung {
  const jobsSortiert = sortiereEintraege(jobs, settings);
  let kandidaten = sortiereUndNummeriere(lotsen, aktuelleFahrt).map(({ eintrag }) => eintrag);
  const zuweisungen = new Map<number, LotsenEintrag[]>();
  const vergaben = new Map<number, VergabePlanung>();

  // Phase 1: Listenvergaben
  for (const { eintrag: job } of jobsSortiert) {
    if (!istListenvergabeJob(job)) continue;
    const benoetigt = benoetigteLotsenAnzahl(job) - (abgeteiltProJob?.get(job.id) ?? 0);
    if (benoetigt <= 0) {
      zuweisungen.set(job.id, []);
      continue;
    }
    const planung = planeListenvergabe(job, kandidaten, jobs, settings, aktuelleFahrt, abgeteiltProJob);
    vergaben.set(job.id, planung);
    zuweisungen.set(job.id, planung.gewinner ? [planung.gewinner] : []);
    if (planung.gewinner) kandidaten = kandidaten.filter((l) => l !== planung.gewinner);
  }

  // Phase 2: alle übrigen Jobs per FIFO
  for (const { eintrag: job } of jobsSortiert) {
    if (istListenvergabeJob(job)) continue;
    const benoetigt = benoetigteLotsenAnzahl(job) - (abgeteiltProJob?.get(job.id) ?? 0);
    const zugewiesen: LotsenEintrag[] = [];
    const uebrig: LotsenEintrag[] = [];
    for (const kandidat of kandidaten) {
      if (zugewiesen.length < benoetigt && istGeeignet(job, kandidat)) {
        zugewiesen.push(kandidat);
      } else {
        uebrig.push(kandidat);
      }
    }
    kandidaten = uebrig;
    zuweisungen.set(job.id, zugewiesen);
  }

  return { zuweisungen, vergaben };
}

/** jobId -> zugewiesene Lotsen (in Zuweisungsreihenfolge).
 *  abgeteiltProJob: bereits abgeteilte Lotsen je Job — die Planung besetzt
 *  nur noch den Rest (voll abgeteilte Jobs bekommen niemanden mehr). */
export function planeEinsatzstation(
  jobs: JobEintrag[],
  lotsen: LotsenEintrag[],
  aktuelleFahrt: AktuelleFahrt,
  settings: AbteilzeitSettings,
  abgeteiltProJob?: Map<number, number>,
): Map<number, LotsenEintrag[]> {
  return planeEinsatzstationMitVergaben(jobs, lotsen, aktuelleFahrt, settings, abgeteiltProJob).zuweisungen;
}

/** Ordnet jedem zugewiesenen Lotsen die Abteilzeit seines Jobs zu — Basis für
 *  die Berechnung des geplanten Abrufs (siehe geplanterAbruf).
 *  Listenvergaben bleiben außen vor: sie haben keinen Abruf-Vorlauf, die
 *  Abteilung erfolgt direkt mit dem Anruf ("gepl. Abruf" zeigt "–"). */
export function abteilzeitProLotse(
  jobsSortiert: EintragMitAbteilzeit[],
  zuweisungen: Map<number, LotsenEintrag[]>,
): Map<LotsenEintrag, Date> {
  const ergebnis = new Map<LotsenEintrag, Date>();
  for (const { eintrag: job, abteilzeit } of jobsSortiert) {
    if (!abteilzeit || istListenvergabeJob(job)) continue;
    for (const lotse of zuweisungen.get(job.id) ?? []) {
      ergebnis.set(lotse, abteilzeit);
    }
  }
  return ergebnis;
}

/** "gepl. Abruf" = Abt.Zeit des zugewiesenen Jobs minus die individuelle
 *  Abrufzeit des Lotsen (Standard 1,0 Std., wenn nicht gesetzt) — der
 *  Zeitpunkt, zu dem der Lotse alarmiert werden muss. */
export function geplanterAbruf(abteilzeit: Date | undefined, abrufStunden: number | undefined): Date | undefined {
  if (!abteilzeit) return undefined;
  return new Date(abteilzeit.getTime() - (abrufStunden ?? 1) * 3_600_000);
}
