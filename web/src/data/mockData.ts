/**
 * Frei erfundene Platzhalterdaten für das Grundgerüst — keine echten Namen,
 * Schiffe oder Zeiten. Wird ersetzt, sobald die App an eine echte
 * Datenquelle (PDF-Extraktion / Live-Anbindung) angeschlossen wird.
 */

import type { JobEintrag, LotsenEintrag } from "./types";

export const mockJobs: JobEintrag[] = [
  // Liste Hamburg (Elbe): HH -> FkW -> Stade
  { id: 1, liste: "hamburg", schiffsname: "MS BEISPIEL", kategorie: "3", fkw: new Date("2026-08-02T09:00:00") },
  { id: 2, liste: "hamburg", schiffsname: "MS SEEBRISE", kategorie: "1", bemerkung: "eilt", hh: new Date("2026-08-02T06:00:00") },
  {
    id: 3,
    liste: "hamburg",
    schiffsname: "MS NORDLICHT",
    kategorie: "AGF 3/7",
    bemerkung: "Bütz",
    buetzfleth: true,
    geplAbgang: new Date("2026-08-02T10:00:00"),
  },

  // Liste NOK (Kanal): Holt. -> Ticker -> Kuden
  { id: 4, liste: "nok", schiffsname: "MS KANALFAHRT", kategorie: "1", kuden: new Date("2026-08-02T08:00:00") },
  { id: 5, liste: "nok", schiffsname: "MS PROBEFAHRT", kategorie: "1", bemerkung: "ca.-Zeit", holt: new Date("2026-08-02T05:00:00") },

  // Liste Andere Jobs: Anmeldungen, Abteilzeit als direkte Eingabe
  { id: 6, liste: "andere", typ: "Sonderradar", schiffsname: "MS RADARBILD", kategorie: "3", abtZeitManuell: new Date("2026-08-02T10:30:00") },
  {
    id: 7,
    liste: "andere",
    typ: "EHF",
    schiffsname: "MS GASWOLKE",
    kategorie: "4",
    ehfBestAbgang: new Date("2026-08-02T13:10:00"),
    ehfLotseBenoetigt: true,
    abtZeitManuell: new Date("2026-08-02T12:10:00"),
  },
  { id: 8, liste: "andere", typ: "WB", schiffsname: "MS WELLENGANG", kategorie: "1", abtZeitManuell: new Date("2026-08-03T23:00:00") },
];

/**
 * Lotsenliste der Einsatzstation Brunsbüttel. Kategorie "" = Volllotse.
 * "leer" bei fahrt = Bereitschaft an der Einsatzstation (BB-Gruppe);
 * MoFa/MiFa/AFA = in dieser Fahrt unterwegs, nicht an der Station verfügbar.
 */
export const mockLotsenliste: LotsenEintrag[] = [
  {
    name: "Mustermann, Max",
    kategorie: "",
    fahrt: "",
    abrufStunden: undefined,
    elbehafen: true,
    toern2Plus2: 12,
    toernWb: 3,
    toernWr: 0,
    toernHulo: 1,
    bemerkung: "",
  },
  {
    name: "Beispiel, Erika",
    kategorie: "",
    fahrt: "",
    abrufStunden: 0.5,
    elbehafen: false,
    toern2Plus2: 8,
    toernWb: 0,
    toernWr: 2,
    toernHulo: 0,
    bemerkung: "",
  },
  {
    name: "Schmidt, Peter",
    kategorie: "7",
    fahrt: "MoFa",
    abrufStunden: undefined,
    elbehafen: false,
    toern2Plus2: 5,
    toernWb: 1,
    toernWr: 0,
    toernHulo: 0,
    bemerkung: "",
  },
  {
    name: "Fischer, Anna",
    kategorie: "3+",
    fahrt: "",
    abrufStunden: 1.5,
    elbehafen: true,
    toern2Plus2: 20,
    toernWb: 4,
    toernWr: 1,
    toernHulo: 3,
    bemerkung: "1,5h Vorlauf",
  },
  {
    name: "Weber, Tom",
    kategorie: "4",
    fahrt: "MiFa",
    abrufStunden: undefined,
    elbehafen: false,
    toern2Plus2: 0,
    toernWb: 0,
    toernWr: 0,
    toernHulo: 0,
    bemerkung: "",
  },
  {
    name: "Koch, Julia",
    kategorie: "3",
    fahrt: "",
    abrufStunden: undefined,
    elbehafen: false,
    toern2Plus2: 6,
    toernWb: 2,
    toernWr: 0,
    toernHulo: 0,
    bemerkung: "",
  },
  {
    name: "Richter, Jan",
    kategorie: "6",
    fahrt: "AFA",
    abrufStunden: 2,
    elbehafen: false,
    toern2Plus2: 15,
    toernWb: 0,
    toernWr: 5,
    toernHulo: 2,
    bemerkung: "2,0h Vorlauf",
  },
];
