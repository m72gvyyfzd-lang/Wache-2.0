/**
 * Frei erfundene Platzhalterdaten für das Grundgerüst — keine echten Namen,
 * Schiffe oder Zeiten. Wird ersetzt, sobald die App an eine echte
 * Datenquelle (PDF-Extraktion / Live-Anbindung) angeschlossen wird.
 */

import type { JobEintrag, LotsenEintrag } from "./types";

export const mockJobs: JobEintrag[] = [
  // Liste Hamburg (Elbe): HH -> FkW -> Stade
  { jobNr: 1, liste: "hamburg", schiffsname: "MS BEISPIEL", kategorie: "3", fkw: new Date("2026-08-02T09:00:00") },
  { jobNr: 2, liste: "hamburg", schiffsname: "MS SEEBRISE", kategorie: "1", bemerkung: "eilt", hh: new Date("2026-08-02T06:00:00") },
  {
    jobNr: 3,
    liste: "hamburg",
    schiffsname: "MS NORDLICHT",
    kategorie: "AGF 3/7",
    bemerkung: "Bütz",
    buetzfleth: true,
    geplAbgang: new Date("2026-08-02T10:00:00"),
  },

  // Liste NOK (Kanal): Holt. -> Ticker -> Kuden
  { jobNr: 4, liste: "nok", schiffsname: "MS KANALFAHRT", kategorie: "1", kuden: new Date("2026-08-02T08:00:00") },
  { jobNr: 5, liste: "nok", schiffsname: "MS PROBEFAHRT", kategorie: "1", bemerkung: "ca.-Zeit", holt: new Date("2026-08-02T05:00:00") },

  // Liste Andere Jobs: Anmeldungen, Abteilzeit als direkte Eingabe
  { jobNr: 6, liste: "andere", typ: "Sonderradar", schiffsname: "MS RADARBILD", kategorie: "3", abtZeitManuell: new Date("2026-08-02T10:30:00") },
  {
    jobNr: 7,
    liste: "andere",
    typ: "EHF",
    schiffsname: "MS GASWOLKE",
    kategorie: "4",
    ehfBestAbgang: new Date("2026-08-02T13:10:00"),
    ehfLotseBenoetigt: true,
    abtZeitManuell: new Date("2026-08-02T12:10:00"),
  },
  { jobNr: 8, liste: "andere", typ: "WB", schiffsname: "MS WELLENGANG", kategorie: "1", abtZeitManuell: new Date("2026-08-03T23:00:00") },
];

/**
 * Verfügbare Lotsen, in Wartelisten-Reihenfolge (Brunsbüttel Bört — die für
 * diese Wache relevante Liste). Kategorie "" = Volllotse.
 */
export const mockLotsenliste: LotsenEintrag[] = [
  { positionHaupt: "1", positionCuxhavenBoert: "", name: "Mustermann, Max", positionBrunsbuettelBoert: "1", kategorie: "", bem: "" },
  { positionHaupt: "2", positionCuxhavenBoert: "", name: "Beispiel, Erika", positionBrunsbuettelBoert: "2", kategorie: "", bem: "" },
  { positionHaupt: "3", positionCuxhavenBoert: "", name: "Schmidt, Peter", positionBrunsbuettelBoert: "3", kategorie: "7", bem: "" },
  { positionHaupt: "", positionCuxhavenBoert: "1", name: "Fischer, Anna", positionBrunsbuettelBoert: "4", kategorie: "3+", bem: "1,5h" },
  { positionHaupt: "", positionCuxhavenBoert: "2", name: "Weber, Tom", positionBrunsbuettelBoert: "5", kategorie: "4", bem: "" },
  { positionHaupt: "", positionCuxhavenBoert: "", name: "Koch, Julia", positionBrunsbuettelBoert: "6", kategorie: "3", bem: "" },
  { positionHaupt: "", positionCuxhavenBoert: "", name: "Richter, Jan", positionBrunsbuettelBoert: "7", kategorie: "6", bem: "2,0h" },
];
