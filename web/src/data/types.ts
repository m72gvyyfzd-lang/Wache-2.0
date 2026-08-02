/**
 * UI-Datentypen für die Board-Ansichten. Bewusst an das Schema aus
 * tools/pdf-extraction angelehnt (gleiche Feldnamen), damit später echte
 * extrahierte/live Daten ohne Umbau eingesetzt werden können.
 *
 * Diese Typen bilden die "rohe Tafel" ab (was der Dispatcher sieht) — nicht
 * zu verwechseln mit den Berechnungstypen in core/src/types.ts (Job, Lotse),
 * die für die Abteilzeit-/Anruf-Algorithmen verwendet werden.
 */

export interface LotsenEintrag {
  positionHaupt: string;
  positionCuxhavenBoert: string;
  name: string;
  positionBrunsbuettelBoert: string;
  bem: string;
}

export interface ZulaufHamburgEintrag {
  nr: string;
  zeitHamburgHafenVerlassen: string;
  zeitFinkenwerderPassage: string;
  zeitStadePassage: string;
  bem: string;
}

export interface ZulaufNokEintrag {
  nr: string;
  zeitHoltenauAusfahrt: string;
  zeitKudenPassage: string;
  kat: string;
  bem: string;
}

export interface AnmeldungEintrag {
  nr: string;
  typ: string;
  kat: string;
  lotse: string;
  datumZeit: string;
}
