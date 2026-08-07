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
 *  Warnungstext (für das Abteilen-Fragefenster). undefined = alles passt. */
export function eignungsWarnungSeestation(
  schiff: SeeSchiff,
  lotse: Pick<SeestationZeile, "kategorie" | "elbehafen">,
  istErster: boolean,
): string | undefined {
  const schiffsKat = schiff.kategorie ?? "";
  const passtKat = istErster ? darfFahren(schiffsKat, lotse.kategorie) : darfZweiterLotse(schiffsKat, lotse.kategorie);
  if (!passtKat) return "Kat. des Lotsen zu klein";
  if (schiff.ehfLotseBenoetigt && schiffsRang(schiffsKat) >= 4 && !lotse.elbehafen) return "Lotse nicht in EH-Liste";
  return undefined;
}

/** schiffId -> voraussichtlich zugewiesene Lotsen (FIFO nach Seestation-
 *  Reihenfolge), nur für angemeldete Schiffe — Basis für die
 *  Vorausberechnung (Hinweis hinter dem Schiffsnamen). Bereits per
 *  Seestation-Abteilen verbundene Lotsen sind aus lotsenZeilen schon
 *  ausgeblendet (seeAbgeteilt), tauchen also nicht doppelt auf. */
export function planeSeestation(
  schiffeSortiert: SeeSchiff[],
  lotsenZeilen: SeestationZeile[],
): Map<number, SeestationZeile[]> {
  const angemeldet = schiffeSortiert.filter((s) => s.angemeldet);
  let kandidaten = lotsenZeilen.filter((z) => z.aufStation);
  const zuweisungen = new Map<number, SeestationZeile[]>();

  for (const schiff of angemeldet) {
    const benoetigt = seeLotsenAnzahl(schiff);
    const zugewiesen: SeestationZeile[] = [];
    const uebrig: SeestationZeile[] = [];
    for (const kandidat of kandidaten) {
      if (zugewiesen.length < benoetigt && eignungsWarnungSeestation(schiff, kandidat, zugewiesen.length === 0) === undefined) {
        zugewiesen.push(kandidat);
      } else {
        uebrig.push(kandidat);
      }
    }
    kandidaten = uebrig;
    zuweisungen.set(schiff.id, zugewiesen);
  }

  return zuweisungen;
}
