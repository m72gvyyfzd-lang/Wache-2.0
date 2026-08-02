/**
 * UI-Datentyp für die rohe Lotsenliste (was der Dispatcher auf der Tafel
 * sieht). Bewusst an das Schema aus tools/pdf-extraction angelehnt.
 *
 * Nicht zu verwechseln mit dem Berechnungstyp `Lotse` aus @wache/core, der
 * für die Anruf-Algorithmen verwendet wird.
 */
export interface LotsenEintrag {
  positionHaupt: string;
  positionCuxhavenBoert: string;
  name: string;
  positionBrunsbuettelBoert: string;
  bem: string;
}
