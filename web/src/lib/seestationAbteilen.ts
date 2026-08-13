/**
 * "Seestation-Abteilen": weist Lotsen der Seestation den See-Schiffen der
 * ETA-Liste zu — das Gegenstück zu lib/planungEinsatzstation.ts, nur für
 * die Seestation. Gleiche Regeln wie dort (Kat. Schiff↔Lotse inkl. EH), aber
 * ohne Job-Typ-Prüfung (See-Schiffe haben keinen AnmeldungsTyp).
 */
import { darfFahren, darfZweiterLotse, schiffsRang } from "@wache/core";
import type { SeeSchiff } from "../data/types";
import { ANMELDUNG_ESKALATION_MS, type SeestationZeile } from "./seestation";

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
): SeeSchiff[] {
  return [...seeSchiffe]
    .filter((s) => seeLotsenAnzahl(s) - (abgeteiltProSchiff.get(s.id) ?? 0) > 0)
    .sort((a, b) => {
      const rangA = anmeldungUeberfaellig(a, jetzt) ? 1 : 0;
      const rangB = anmeldungUeberfaellig(b, jetzt) ? 1 : 0;
      if (rangA !== rangB) return rangA - rangB;
      return (a.eta?.getTime() ?? 0) - (b.eta?.getTime() ?? 0);
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
 * Zweistufig, damit ein für ein frühes Schiff hoffnungslos verspäteter
 * Lotse nicht vorschnell "verbraucht" wird und einem späteren Schiff, für
 * das er noch rechtzeitig wäre, fehlt:
 *
 * 1. Durchgang: nur pünktliche Kandidaten (auf Station oder ETA Stn
 *    spätestens vorlaufMs vor dem Schiffs-ETA) — ein offener Platz ohne
 *    pünktlichen Kandidaten bleibt offen, es wird NICHTS aus dem Pool
 *    entfernt.
 * 2. Durchgang: die noch offenen Plätze werden — jetzt ohne Zeitprüfung —
 *    aus dem verbliebenen Pool aufgefüllt (verspaetet: true). Was danach
 *    immer noch offen ist, zählt zu `fehlt`.
 *
 * `schiffe` muss bereits priorisiert sein (siehe schiffePriorisiert) — das
 * bestimmt, wer bei knappen Lotsen zuerst bedient wird. Jeder Lotse wird
 * nur einmal vergeben.
 */
export function planeSeestation(
  schiffe: SeeSchiff[],
  lotsenZeilen: SeestationZeile[],
  abgeteiltProSchiff: Map<number, number>,
  vorlaufMs: number,
): Map<number, SeestationZuteilung> {
  interface OffenerPlatz {
    istErster: boolean;
  }
  const offeneProSchiff = new Map<number, OffenerPlatz[]>();
  const ergebnis = new Map<number, SeestationZuteilung>();
  for (const schiff of schiffe) {
    const bereits = abgeteiltProSchiff.get(schiff.id) ?? 0;
    const benoetigt = seeLotsenAnzahl(schiff) - bereits;
    const plaetze: OffenerPlatz[] = [];
    for (let platz = 0; platz < benoetigt; platz++) plaetze.push({ istErster: bereits + platz === 0 });
    offeneProSchiff.set(schiff.id, plaetze);
    ergebnis.set(schiff.id, { zugewiesen: [], fehlt: 0 });
  }

  let pool = lotsenZeilen;

  // 1. Durchgang: nur pünktliche Kandidaten, unpassende bleiben im Pool.
  for (const schiff of schiffe) {
    const ankunftsFrist = schiff.eta.getTime() - vorlaufMs;
    const nochOffen: OffenerPlatz[] = [];
    for (const platz of offeneProSchiff.get(schiff.id)!) {
      const index = pool.findIndex(
        (k) =>
          (k.aufStation || (k.etaStn !== undefined && k.etaStn.getTime() <= ankunftsFrist)) &&
          eignungsWarnungSeestation(schiff, k, platz.istErster) === undefined,
      );
      if (index === -1) {
        nochOffen.push(platz);
        continue;
      }
      ergebnis.get(schiff.id)!.zugewiesen.push({ zeile: pool[index], verspaetet: false });
      pool = [...pool.slice(0, index), ...pool.slice(index + 1)];
    }
    offeneProSchiff.set(schiff.id, nochOffen);
  }

  // 2. Durchgang: Rest-Pool ohne Zeitprüfung auffüllen — wer hier landet,
  // ist zwangsläufig zu spät.
  for (const schiff of schiffe) {
    for (const platz of offeneProSchiff.get(schiff.id)!) {
      const index = pool.findIndex((k) => eignungsWarnungSeestation(schiff, k, platz.istErster) === undefined);
      if (index === -1) {
        ergebnis.get(schiff.id)!.fehlt += 1;
        continue;
      }
      ergebnis.get(schiff.id)!.zugewiesen.push({ zeile: pool[index], verspaetet: true });
      pool = [...pool.slice(0, index), ...pool.slice(index + 1)];
    }
  }

  return ergebnis;
}
