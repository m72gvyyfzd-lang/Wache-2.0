/**
 * "Seestation-Abteilen": weist Lotsen der Seestation den See-Schiffen der
 * ETA-Liste zu — das Gegenstück zu lib/planungEinsatzstation.ts, nur für
 * die Seestation. Gleiche Regeln wie dort (Kat. Schiff↔Lotse inkl. EH), aber
 * ohne Job-Typ-Prüfung (See-Schiffe haben keinen AnmeldungsTyp).
 */
import { darfFahren, darfZweiterLotse, schiffsRang } from "@wache/core";
import type { SeeSchiff } from "../data/types";
import {
  ANMELDUNG_ESKALATION_MS,
  planungsEta,
  vergleicheVorschauAbt,
  type SeestationZeile,
  type VorschauAbtZeit,
} from "./seestation";

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

/** Priorisierte Schiffsreihenfolge für die Lotsen-Zuteilung: angemeldete
 *  Schiffe zuerst — eine Anmeldung "reserviert" faktisch den nächsten
 *  freien Lotsen, auch wenn ein noch nicht angemeldetes Schiff früher ETA
 *  hat (bewusste Praxis-Entscheidung: Anmeldungen sind manchmal ungenau,
 *  aber eine Anmeldung ist die verlässlichere Aussage). Danach nach ETA —
 *  dieselbe Reihenfolge, in der auch die ETA-Liste angezeigt wird. Schiffe
 *  ohne offenen Bedarf (schon voll abgeteilt) fallen raus.
 *
 *  Geteilt zwischen der Seestation-Seite und der Dashboard-Bilanz
 *  (lib/meldungen.ts), damit beide bei knappen Lotsen exakt dieselbe
 *  Zuteilung errechnen. */
/** Ein Schiff verliert seinen Platz in der Zeitreihenfolge erst, wenn seine
 *  Anmeldung überfällig ist (Alarm, siehe ANMELDUNG_ESKALATION_MS) — dann
 *  rutscht es hinter alle übrigen. Der bloße Anmeldestatus zählt nicht: ein
 *  noch nicht angemeldetes Schiff, dessen Frist läuft, bleibt an seiner
 *  zeitlichen Position. */
function anmeldungUeberfaellig(schiff: SeeSchiff, jetzt: Date): boolean {
  return !schiff.angemeldet && schiff.eta.getTime() - jetzt.getTime() <= -ANMELDUNG_ESKALATION_MS;
}

export function schiffePriorisiert(
  seeSchiffe: SeeSchiff[],
  abgeteiltProSchiff: Map<number, number>,
  jetzt: Date,
  /** Vorschau-Zusatzregeln (siehe seestation.ts::vorschauAbtZeiten): mit
   *  Map gelten Verbund-Zusammenlegung und E3/St-Vorrang bei Gleichstand —
   *  ohne (Standard) bleibt es bei der reinen planungsEta-Reihenfolge. */
  vorschauAbt?: Map<number, VorschauAbtZeit>,
): SeeSchiff[] {
  return [...seeSchiffe]
    .filter((s) => seeLotsenAnzahl(s) - (abgeteiltProSchiff.get(s.id) ?? 0) > 0)
    .sort((a, b) => {
      const rangA = anmeldungUeberfaellig(a, jetzt) ? 1 : 0;
      const rangB = anmeldungUeberfaellig(b, jetzt) ? 1 : 0;
      if (rangA !== rangB) return rangA - rangB;
      if (vorschauAbt) return vergleicheVorschauAbt(a, b, vorschauAbt);
      // Priorisierung nach Abt.Zeit (planungsEta), nicht der rohen ETA: ein
      // E3/St-Schiff braucht seinen Lotsen 1,5 Std. früher (siehe
      // planungsEta) und muss deshalb auch bei der Vergabe VOR Schiffen
      // stehen, deren rohe ETA zwar früher liegt, deren tatsächlicher
      // Bedarf aber später einsetzt.
      const diff = planungsEta(a).getTime() - planungsEta(b).getTime();
      if (diff !== 0) return diff;
      // Bei exakt gleicher Abt.Zeit wird IMMER das E3/St-Schiff zuerst
      // abgeteilt (angemeldet oder nicht) — gilt auch ohne Vorschau.
      if (Boolean(a.e3st) !== Boolean(b.e3st)) return a.e3st ? -1 : 1;
      return a.eta.getTime() - b.eta.getTime();
    });
}

/** Ein zugeteilter Platz: der Lotse plus ob er die Ankunftsfrist des
 *  Schiffs (ETA − vorlaufMs) einhält. */
export interface SeestationSlot {
  zeile: SeestationZeile;
  /** true = zugeteilt, aber voraussichtlich zu spät auf Station */
  verspaetet: boolean;
}

export interface SeestationZuteilung {
  zugewiesen: SeestationSlot[];
  /** Plätze, für die im gesamten Pool niemand mehr übrig war — selbst mit
   *  Verspätung nicht. */
  fehlt: number;
}

/**
 * Lotsen-Zuteilung für die ETA-Liste (Basis-Hinweis, Vorschau und
 * Dashboard-Bilanz teilen sich diese eine Funktion — nur der übergebene
 * Lotsen-Pool unterscheidet sich).
 *
 * Warteschlangen-Prinzip (FIFO): die Schiffe werden in ihrer
 * Prioritätsreihenfolge (siehe schiffePriorisiert) bedient, jedes nimmt
 * den jeweils NÄCHSTEN geeigneten Lotsen der Reihe (der Pool ist nach
 * V-Nr. sortiert — das ist die Reihenfolge, in der die Lotsen abgeteilt
 * wurden und auf der Seestation eintreffen). Kommt dieser Lotse knapp zu
 * spät, wird er trotzdem zugeteilt und nur als "verspaetet" markiert — er
 * wird NICHT für ein späteres Schiff aufgespart, bei dem er pünktlich
 * wäre: das früheste Schiff bekommt immer den frühesten verfügbaren
 * Lotsen. Nur wenn im ganzen Pool niemand Geeignetes (Kat./EH) mehr übrig
 * ist, zählt der Platz zu `fehlt`. Jeder Lotse wird nur einmal vergeben.
 */
export function planeSeestation(
  schiffe: SeeSchiff[],
  lotsenZeilen: SeestationZeile[],
  abgeteiltProSchiff: Map<number, number>,
  vorlaufMs: number,
  /** Abt.Zeit-Funktion — Standard planungsEta; die Vorschau reicht hier
   *  ihre Verbund-Rechnung durch (siehe seestation.ts::vorschauAbtZeiten). */
  abtZeitVon: (schiff: SeeSchiff) => Date = planungsEta,
): Map<number, SeestationZuteilung> {
  const ergebnis = new Map<number, SeestationZuteilung>();
  let pool = lotsenZeilen;

  for (const schiff of schiffe) {
    const bereits = abgeteiltProSchiff.get(schiff.id) ?? 0;
    const benoetigt = seeLotsenAnzahl(schiff) - bereits;
    const zuteilung: SeestationZuteilung = { zugewiesen: [], fehlt: 0 };
    ergebnis.set(schiff.id, zuteilung);
    // E3/St-Schiffe brauchen den Lotsen schon 1,5 Std. vor der ETA an Bord
    // des Lotsenboots — die Ankunftsfrist auf der Seestation richtet sich
    // deshalb nach der Abt.Zeit (planungsEta bzw. Vorschau-Verbund), nicht
    // nach der rohen ETA.
    const ankunftsFrist = abtZeitVon(schiff).getTime() - vorlaufMs;
    for (let platz = 0; platz < benoetigt; platz++) {
      const istErster = bereits + platz === 0;
      const index = pool.findIndex((k) => eignungsWarnungSeestation(schiff, k, istErster) === undefined);
      if (index === -1) {
        zuteilung.fehlt += 1;
        continue;
      }
      const zeile = pool[index];
      const verspaetet = !(zeile.aufStation || (zeile.etaStn !== undefined && zeile.etaStn.getTime() <= ankunftsFrist));
      zuteilung.zugewiesen.push({ zeile, verspaetet });
      pool = [...pool.slice(0, index), ...pool.slice(index + 1)];
    }
  }

  return ergebnis;
}
