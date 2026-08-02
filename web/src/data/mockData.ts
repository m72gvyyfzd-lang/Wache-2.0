/**
 * Frei erfundene Platzhalterdaten für das Grundgerüst — keine echten Namen,
 * Schiffe oder Zeiten. Wird ersetzt, sobald die App an eine echte
 * Datenquelle (PDF-Extraktion / Live-Anbindung) angeschlossen wird.
 */

import type { Job } from "@wache/core";
import type { LotsenEintrag } from "./types";

/**
 * Die eine Jobs-Warteschlange aus dem Grundprinzip: HH- und NOK-Checkpoints
 * sowie manuell angemeldete Jobs (Radar/EHF/...) laufen hier zusammen und
 * werden von core::sortiereJobsNachAbteilzeit einheitlich nach Abteilzeit
 * geordnet.
 */
export const mockJobs: Job[] = [
  // HH-Route (Elbe): Hamburg Hafen -> Finkenwerder -> Stade
  { jobNr: 1, routentyp: "HH", bezeichnung: "MS BEISPIEL", kategorie: 3, fkwTickerAbgang: new Date("2026-08-02T09:00:00") },
  { jobNr: 2, routentyp: "HH", bezeichnung: "MS SEEBRISE", kategorie: 1, bemerkung: "eilt", hhHoltenau: new Date("2026-08-02T06:00:00") },
  { jobNr: 3, routentyp: "HH", bezeichnung: "MS NORDLICHT", kategorie: 4, stadeKuden: new Date("2026-08-02T10:00:00") },

  // NOK-Route (Kanal): Holtenau -> Kuden
  { jobNr: 4, routentyp: "NOK", bezeichnung: "MS KANALFAHRT", kategorie: 1, stadeKuden: new Date("2026-08-02T08:00:00") },
  { jobNr: 5, routentyp: "NOK", bezeichnung: "MS PROBEFAHRT", kategorie: 1, bemerkung: "ca.-Zeit", hhHoltenau: new Date("2026-08-02T05:00:00") },

  // Anmeldungen: eigene Jobtypen ohne Checkpoint-Berechnung, Abteilzeit wird
  // direkt aus dem angemeldeten Zeitpunkt übernommen.
  { jobNr: 6, routentyp: "Radar", bezeichnung: "Radar", kategorie: "Agf3", abteilungManuell: new Date("2026-08-02T10:30:00") },
  { jobNr: 7, routentyp: "EHF", bezeichnung: "EHF", kategorie: 4, abteilungManuell: new Date("2026-08-02T12:10:00") },
  { jobNr: 8, routentyp: "W-Blau", bezeichnung: "W-Blau", kategorie: 1, abteilungManuell: new Date("2026-08-03T23:00:00") },
];

/**
 * Verfügbare Lotsen, in Wartelisten-Reihenfolge (Brunsbüttel Bört — die für
 * diese Wache relevante Liste). Wird Zeile für Zeile mit der Jobs-Warteschlange
 * abgeglichen.
 */
export const mockLotsenliste: LotsenEintrag[] = [
  { positionHaupt: "1", positionCuxhavenBoert: "", name: "Mustermann, Max", positionBrunsbuettelBoert: "1", bem: "" },
  { positionHaupt: "2", positionCuxhavenBoert: "", name: "Beispiel, Erika", positionBrunsbuettelBoert: "2", bem: "" },
  { positionHaupt: "3", positionCuxhavenBoert: "", name: "Schmidt, Peter", positionBrunsbuettelBoert: "3", bem: "" },
  { positionHaupt: "", positionCuxhavenBoert: "1", name: "Fischer, Anna", positionBrunsbuettelBoert: "4", bem: "1,5h" },
  { positionHaupt: "", positionCuxhavenBoert: "2", name: "Weber, Tom", positionBrunsbuettelBoert: "5", bem: "" },
  { positionHaupt: "", positionCuxhavenBoert: "", name: "Koch, Julia", positionBrunsbuettelBoert: "6", bem: "" },
  { positionHaupt: "", positionCuxhavenBoert: "", name: "Richter, Jan", positionBrunsbuettelBoert: "7", bem: "2,0h" },
];
