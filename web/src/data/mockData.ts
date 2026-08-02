/**
 * Frei erfundene Platzhalterdaten für das Grundgerüst — keine echten Namen,
 * Schiffe oder Zeiten. Wird ersetzt, sobald die App an eine echte
 * Datenquelle (PDF-Extraktion / Live-Anbindung) angeschlossen wird.
 */

import type {
  AnmeldungEintrag,
  LotsenEintrag,
  ZulaufHamburgEintrag,
  ZulaufNokEintrag,
} from "./types";

export const mockLotsenliste: LotsenEintrag[] = [
  { positionHaupt: "1", positionCuxhavenBoert: "", name: "Mustermann, Max", positionBrunsbuettelBoert: "A", bem: "12:00" },
  { positionHaupt: "2", positionCuxhavenBoert: "", name: "Beispiel, Erika", positionBrunsbuettelBoert: "A", bem: "12:30" },
  { positionHaupt: "3", positionCuxhavenBoert: "", name: "Schmidt, Peter", positionBrunsbuettelBoert: "", bem: "" },
  { positionHaupt: "", positionCuxhavenBoert: "1", name: "Fischer, Anna", positionBrunsbuettelBoert: "", bem: "1,5h" },
  { positionHaupt: "", positionCuxhavenBoert: "2", name: "Weber, Tom", positionBrunsbuettelBoert: "", bem: "" },
  { positionHaupt: "", positionCuxhavenBoert: "", name: "Koch, Julia", positionBrunsbuettelBoert: "1", bem: "" },
  { positionHaupt: "", positionCuxhavenBoert: "", name: "Richter, Jan", positionBrunsbuettelBoert: "2", bem: "2,0h" },
  { positionHaupt: "", positionCuxhavenBoert: "", name: "Neumann, Lisa", positionBrunsbuettelBoert: "3", bem: "TA/FT 4.8." },
];

export const mockZulaufHamburg: ZulaufHamburgEintrag[] = [
  { nr: "1", zeitHamburgHafenVerlassen: "12:00", zeitFinkenwerderPassage: "", zeitStadePassage: "", bem: "" },
  { nr: "2", zeitHamburgHafenVerlassen: "12:30", zeitFinkenwerderPassage: "13:15", zeitStadePassage: "", bem: "" },
  { nr: "3", zeitHamburgHafenVerlassen: "13:30", zeitFinkenwerderPassage: "14:10", zeitStadePassage: "15:20", bem: "" },
  { nr: "4", zeitHamburgHafenVerlassen: "", zeitFinkenwerderPassage: "", zeitStadePassage: "", bem: "" },
];

export const mockZulaufNok: ZulaufNokEintrag[] = [
  { nr: "1", zeitHoltenauAusfahrt: "03:41", zeitKudenPassage: "10:27", kat: "1", bem: "ca11:45" },
  { nr: "2", zeitHoltenauAusfahrt: "05:50", zeitKudenPassage: "", kat: "1", bem: "ca15:30" },
  { nr: "3", zeitHoltenauAusfahrt: "", zeitKudenPassage: "", kat: "", bem: "" },
];

export const mockAnmeldungen: AnmeldungEintrag[] = [
  { nr: "1", typ: "Radar", kat: "Agf3", lotse: "1", datumZeit: "02.08.2026 16:59" },
  { nr: "2", typ: "W-Blau", kat: "1", lotse: "1", datumZeit: "03.08.2026 23:00" },
  { nr: "3", typ: "EHF", kat: "4", lotse: "1", datumZeit: "02.08.2026 12:10" },
];
