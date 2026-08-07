/** Erzeugt zufällige Testdaten (Lotsen/Schiffe) für manuelle Tests — über
 *  die Settings-Seite einfügbar, damit nicht viele Einträge von Hand
 *  angelegt werden müssen. */
import { LOTSEN_KATEGORIEN, SCHIFFS_KATEGORIEN } from "@wache/core";
import type { Fahrt, LotsenEintrag, SeeSchiff } from "../data/types";

const VORNAMEN = [
  "Max", "Erika", "Peter", "Anna", "Tom", "Julia", "Jan", "Lena", "Paul", "Mia",
  "Finn", "Nora", "Karl", "Sophie", "Lukas", "Emma", "Felix", "Laura", "Jonas", "Marie",
];
const NACHNAMEN = [
  "Mustermann", "Beispiel", "Schmidt", "Fischer", "Weber", "Koch", "Richter", "Meyer", "Wagner", "Becker",
  "Hofmann", "Schulz", "Neumann", "Schwarz", "Zimmermann", "Braun", "Krüger", "Hartmann", "Lange", "Werner",
];

function zufall<T>(liste: readonly T[]): T {
  return liste[Math.floor(Math.random() * liste.length)];
}

function eindeutigerName(vergeben: Set<string>): string {
  let name = "";
  do {
    name = `${zufall(NACHNAMEN)}, ${zufall(VORNAMEN)}`;
  } while (vergeben.has(name));
  vergeben.add(name);
  return name;
}

const FAHRTEN: Fahrt[] = ["", "", "", "MoFa", "MiFa", "AFA"];
const ABRUFSTUNDEN = [0.5, 1, 1.5, 2] as const;

export function zufaelligeLotsen(anzahl: number): LotsenEintrag[] {
  const vergeben = new Set<string>();
  return Array.from({ length: anzahl }, () => ({
    name: eindeutigerName(vergeben),
    kategorie: zufall(LOTSEN_KATEGORIEN),
    fahrt: zufall(FAHRTEN),
    abrufStunden: Math.random() < 0.5 ? undefined : zufall(ABRUFSTUNDEN),
    elbehafen: Math.random() < 0.35,
    toern2Plus2: Math.floor(Math.random() * 25),
    toernWb: Math.floor(Math.random() * 6),
    toernWr: Math.floor(Math.random() * 6),
    toernHulo: Math.floor(Math.random() * 4),
    bemerkung: "",
  }));
}

const SCHIFF_PRAEFIXE = ["MS", "MSC", "MV", "COSCO", "CMA CGM", "MAERSK"];
const SCHIFF_NAMEN = [
  "ATLANTIC", "PACIFIC", "NORDSTERN", "SEEFALKE", "HANSEKOGGE", "ELBQUEEN", "BALTIC TRADER", "NORDWIND",
  "MEERESBRISE", "KAPITÄN", "SEEFAHRER", "HAFENSTADT", "NORDLICHT", "STURMVOGEL", "WELLENREITER", "HORIZONT",
  "FREIHEIT", "BRUNSBÜTTEL", "CUXHAVEN", "HAMBURG EXPRESS",
];

function eindeutigerSchiffsname(vergeben: Set<string>): string {
  let name = "";
  do {
    name = `${zufall(SCHIFF_PRAEFIXE)} ${zufall(SCHIFF_NAMEN)}`;
  } while (vergeben.has(name));
  vergeben.add(name);
  return name;
}

/** ETAs über die kommenden ~15 Std. verteilt, ausgehend von jetzt (auf die
 *  Minute gerundet). */
export function zufaelligeSeeSchiffe(anzahl: number): Omit<SeeSchiff, "id">[] {
  const vergeben = new Set<string>();
  const start = new Date();
  start.setSeconds(0, 0);
  return Array.from({ length: anzahl }, (_, i) => ({
    schiffsname: eindeutigerSchiffsname(vergeben),
    eta: new Date(start.getTime() + (i * 45 + Math.floor(Math.random() * 40)) * 60_000),
    kategorie: zufall(SCHIFFS_KATEGORIEN),
    angemeldet: Math.random() < 0.5,
    e3st: Math.random() < 0.15,
    doppeldecker: Math.random() < 0.25,
    ehfLotseBenoetigt: Math.random() < 0.2,
  }));
}
