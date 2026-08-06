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
import { darfFahren, darfJobTyp, darfZweiterLotse, schiffsRang, type AbteilzeitSettings } from "@wache/core";
import type { AktuelleFahrt, JobEintrag, LotsenEintrag } from "../data/types";
import { benoetigteLotsenAnzahl, sortiereEintraege, type EintragMitAbteilzeit } from "./coreJob";
import { sortiereUndNummeriere } from "./lotsenOrdnung";

function istGeeignet(job: JobEintrag, lotse: LotsenEintrag, istErster: boolean): boolean {
  const schiffsKat = job.kategorie ?? "";
  const passtKat = istErster ? darfFahren(schiffsKat, lotse.kategorie) : darfZweiterLotse(schiffsKat, lotse.kategorie);
  if (!passtKat) return false;
  if (job.typ !== undefined && !darfJobTyp(job.typ, lotse.kategorie)) return false;
  // Ab Kat. 4 braucht ein Job mit "EHF-Lotse benötigt" zusätzlich einen
  // Lotsen mit aktivem Zusatz "EH" (Elbehafen).
  if (job.ehfLotseBenoetigt && schiffsRang(schiffsKat) >= 4 && !lotse.elbehafen) return false;
  return true;
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
  const jobsSortiert = sortiereEintraege(jobs, settings);
  let kandidaten = sortiereUndNummeriere(lotsen, aktuelleFahrt).map(({ eintrag }) => eintrag);
  const zuweisungen = new Map<number, LotsenEintrag[]>();

  for (const { eintrag: job } of jobsSortiert) {
    const benoetigt = benoetigteLotsenAnzahl(job) - (abgeteiltProJob?.get(job.id) ?? 0);
    const zugewiesen: LotsenEintrag[] = [];
    const uebrig: LotsenEintrag[] = [];
    for (const kandidat of kandidaten) {
      if (zugewiesen.length < benoetigt && istGeeignet(job, kandidat, zugewiesen.length === 0)) {
        zugewiesen.push(kandidat);
      } else {
        uebrig.push(kandidat);
      }
    }
    kandidaten = uebrig;
    zuweisungen.set(job.id, zugewiesen);
  }

  return zuweisungen;
}

/** Ordnet jedem zugewiesenen Lotsen die Abteilzeit seines Jobs zu — Basis für
 *  die Berechnung des geplanten Abrufs (siehe geplanterAbruf). */
export function abteilzeitProLotse(
  jobsSortiert: EintragMitAbteilzeit[],
  zuweisungen: Map<number, LotsenEintrag[]>,
): Map<LotsenEintrag, Date> {
  const ergebnis = new Map<LotsenEintrag, Date>();
  for (const { eintrag: job, abteilzeit } of jobsSortiert) {
    if (!abteilzeit) continue;
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
