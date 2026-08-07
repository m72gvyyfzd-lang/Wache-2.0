/**
 * "Seestation-Abteilen": weist Lotsen der Seestation den angemeldeten
 * See-Schiffen zu — das Gegenstück zu lib/planungEinsatzstation.ts, nur für
 * die Seestation. Gleiche Regeln wie dort (Kat. Schiff↔Lotse inkl. EH), aber
 * ohne Job-Typ-Prüfung (See-Schiffe haben keinen AnmeldungsTyp).
 */
import { darfFahren, darfZweiterLotse, schiffsRang } from "@wache/core";
import type { SeeSchiff } from "../data/types";
import type { SeestationZeile } from "./seestation";

/** Anzahl benötigter Lotsen eines See-Schiffs: Standard 1, Doppeldecker 2. */
export function seeLotsenAnzahl(schiff: SeeSchiff): number {
  return schiff.doppeldecker ? 2 : 1;
}

/** Prüft dieselben Bedingungen wie die Zuweisung, liefert aber den Grund als
 *  Warnungstext (für das Abteilen-Fragefenster). undefined = alles passt.
 *  Der erste Lotse braucht immer die volle Schiffs-Kat.; der zweite darf
 *  schon ab eigener Kat. 3+ mitfahren (siehe darfZweiterLotse) — außer bei
 *  EHF-Schiffen: dort brauchen BEIDE Lotsen die volle Kat. und EH. */
export function eignungsWarnungSeestation(
  schiff: SeeSchiff,
  lotse: Pick<SeestationZeile, "kategorie" | "elbehafen">,
  istErster: boolean,
): string | undefined {
  const schiffsKat = schiff.kategorie ?? "";
  const brauchtVolleKat = istErster || schiff.ehfLotseBenoetigt;
  const passtKat = brauchtVolleKat ? darfFahren(schiffsKat, lotse.kategorie) : darfZweiterLotse(schiffsKat, lotse.kategorie);
  if (!passtKat) return "Kat. des Lotsen zu klein";
  if (schiff.ehfLotseBenoetigt && schiffsRang(schiffsKat) >= 4 && !lotse.elbehafen) return "Lotse nicht in EH-Liste";
  return undefined;
}

/** schiffId -> voraussichtlich zugewiesene Lotsen (FIFO nach Seestation-
 *  Reihenfolge), nur für angemeldete Schiffe — Basis für die
 *  Vorausberechnung (Hinweis hinter dem Schiffsnamen). Bereits per
 *  Seestation-Abteilen verbundene Lotsen sind aus lotsenZeilen schon
 *  ausgeblendet (seeAbgeteilt), tauchen also nicht doppelt auf.
 *  abgeteiltProSchiff: bereits abgeteilte Lotsen je Schiff — die
 *  Vorausberechnung besetzt nur noch den Rest (wie planeEinsatzstation),
 *  sonst würde bei einem Doppeldecker mit bereits einem Lotsen an Bord
 *  fälschlich noch einmal für 2 statt für 1 verbleibenden Platz geplant.
 *
 *  Pro benötigtem Platz eines Schiffs wird die verbleibende Kandidatenliste
 *  frisch von vorn durchsucht (statt in einem einzigen Durchlauf). Sonst
 *  könnte z.B. der einzige für den ERSTEN (strengen) Platz geeignete Lotse
 *  weit hinten in der Liste stehen: alle davor stehenden Lotsen würden dann
 *  fälschlich unter der strengen Regel geprüft und verworfen, obwohl sie
 *  für einen ZWEITEN (gelockerten) Platz gereicht hätten — der aber, weil
 *  bereits verworfen, nie erneut geprüft würde. */
export function planeSeestation(
  schiffeSortiert: SeeSchiff[],
  lotsenZeilen: SeestationZeile[],
  abgeteiltProSchiff?: Map<number, number>,
): Map<number, SeestationZeile[]> {
  const angemeldet = schiffeSortiert.filter((s) => s.angemeldet);
  let kandidaten = lotsenZeilen.filter((z) => z.aufStation);
  const zuweisungen = new Map<number, SeestationZeile[]>();

  for (const schiff of angemeldet) {
    const bereits = abgeteiltProSchiff?.get(schiff.id) ?? 0;
    const benoetigt = seeLotsenAnzahl(schiff) - bereits;
    const zugewiesen: SeestationZeile[] = [];
    for (let platz = 0; platz < benoetigt; platz++) {
      const istErster = bereits + platz === 0;
      const index = kandidaten.findIndex((k) => eignungsWarnungSeestation(schiff, k, istErster) === undefined);
      if (index === -1) break;
      zugewiesen.push(kandidaten[index]);
      kandidaten = [...kandidaten.slice(0, index), ...kandidaten.slice(index + 1)];
    }
    zuweisungen.set(schiff.id, zugewiesen);
  }

  return zuweisungen;
}

export interface SeestationProjektion {
  /** projizierte Lotsen (auf Station oder rechtzeitig ankommend) */
  zugewiesen: SeestationZeile[];
  /** unbesetzbare Plätze zum Ankunftszeitpunkt */
  fehlt: number;
}

/**
 * Zukunfts-Simulation der Seestation (Grundlage der Dashboard-Bilanz und
 * der Vorschau): ALLE Schiffe der ETA-Liste, nach ETA sortiert. Ein Lotse
 * zählt für ein Schiff, wenn er auf Station ist oder seine ETA Stn
 * spätestens vorlaufMs vor dem Schiffs-ETA liegt; jeder Lotse wird nur
 * einmal vergeben. Anders als planeSeestation wird ein unbesetzbarer Platz
 * übersprungen statt abgebrochen — so zählt z.B. bei fehlendem 1. Lotsen
 * ein noch möglicher 2. Lotse trotzdem, und fehlt bleibt exakt.
 */
export function simuliereSeestation(
  seeSchiffe: SeeSchiff[],
  lotsenZeilen: SeestationZeile[],
  abgeteiltProSchiff: Map<number, number>,
  vorlaufMs: number,
): Map<number, SeestationProjektion> {
  const schiffe = [...seeSchiffe]
    .filter((s) => seeLotsenAnzahl(s) - (abgeteiltProSchiff.get(s.id) ?? 0) > 0)
    .sort((a, b) => a.eta.getTime() - b.eta.getTime());
  let pool = lotsenZeilen;
  const ergebnis = new Map<number, SeestationProjektion>();

  for (const schiff of schiffe) {
    const ankunftsFrist = schiff.eta.getTime() - vorlaufMs;
    const bereits = abgeteiltProSchiff.get(schiff.id) ?? 0;
    const benoetigt = seeLotsenAnzahl(schiff) - bereits;
    const zugewiesen: SeestationZeile[] = [];
    let fehlt = 0;
    for (let platz = 0; platz < benoetigt; platz++) {
      const istErster = bereits + platz === 0;
      const index = pool.findIndex(
        (k) =>
          (k.aufStation || (k.etaStn !== undefined && k.etaStn.getTime() <= ankunftsFrist)) &&
          eignungsWarnungSeestation(schiff, k, istErster) === undefined,
      );
      if (index === -1) {
        fehlt += 1;
        continue;
      }
      zugewiesen.push(pool[index]);
      pool = [...pool.slice(0, index), ...pool.slice(index + 1)];
    }
    ergebnis.set(schiff.id, { zugewiesen, fehlt });
  }

  return ergebnis;
}
