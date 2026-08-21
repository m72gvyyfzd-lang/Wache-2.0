import type { AbteilzeitSettings, TideModus, Zeitoffset } from "./types";

/** Kuden → Abteilung ist im Original fest hinterlegt, nicht tideabhängig. */
export const KUDEN_ABTEILUNG: Zeitoffset = { stunden: 1, minuten: 0 };

/** Fester Zuschlag im BÜTZ-Fallback (Original-Formel: `DURATION(,,,29)`). */
export const BUETZ_ZUSCHLAG: Zeitoffset = { stunden: 0, minuten: 29 };

/** Flut-/Ebbe-Werte für die drei tideabhängigen Übergänge, so wie im
 *  Settings-Blatt hinterlegt. */
const TIDE_WERTE: Record<"Flut" | "Ebbe", { hh: Zeitoffset; fkw: Zeitoffset; stade: Zeitoffset }> = {
  Flut: {
    hh: { stunden: 3, minuten: 29 },
    fkw: { stunden: 3, minuten: 0 },
    stade: { stunden: 1, minuten: 20 },
  },
  Ebbe: {
    hh: { stunden: 2, minuten: 59 },
    fkw: { stunden: 2, minuten: 30 },
    stade: { stunden: 0, minuten: 50 },
  },
};

function zuMinuten(o: Zeitoffset): number {
  return o.stunden * 60 + o.minuten;
}

function ausMinuten(minuten: number): Zeitoffset {
  return { stunden: Math.floor(minuten / 60), minuten: minuten % 60 };
}

/**
 * Mittelwert zweier Offsets in ganzen Minuten (Integer-Arithmetik).
 *
 * Das Original berechnet den Mittelwert über Dezimalstunden
 * (`INT(((F3+G3÷60)+(F4+G4÷60))÷2)`), was bei Werten wie 29/60 oder 59/60
 * (keine exakte Binär-Fließkommadarstellung) zu einem Rundungsfehler führt:
 * Flut 3:29 + Ebbe 2:59 sollte im Mittel 3:14 ergeben, das Original zeigt
 * aber 3:13 — INT() rundet dort nicht, sondern schneidet ab, und die
 * Fließkomma-Ungenauigkeit drückt den Wert knapp unter die Minutengrenze.
 * Hier wird bewusst in ganzen Minuten gerechnet, um diesen Fehler nicht zu
 * übernehmen.
 */
function mittelwert(a: Zeitoffset, b: Zeitoffset): Zeitoffset {
  return ausMinuten(Math.floor((zuMinuten(a) + zuMinuten(b)) / 2));
}

/** "Wechsel Tide"-Offsets FkW/Stade → Abteilung: an die HH→Brb-Matrix
 *  angeglichen statt Flut/Ebbe-Mittel. Rechnung: Mittel der normal-Spalte
 *  (halo 194,25 / stade 112,47 min Fahrzeit bis zur Brücke) plus
 *  Betriebs-Korrektur (−15, siehe BRB_ANKUNFT_KORREKTUR_MIN) minus
 *  Abteilvorlauf (20 min vor Ankunft) = 159,25 bzw. 77,47 min, auf das
 *  15-Minuten-Raster gerundet. FkW 2:45 entspricht dabei genau dem alten
 *  Flut/Ebbe-Mittel, Stade steigt von 1:05 auf 1:15. */
const FKW_WECHSEL_TIDE: Zeitoffset = { stunden: 2, minuten: 45 };
const STADE_WECHSEL_TIDE: Zeitoffset = { stunden: 1, minuten: 15 };

/**
 * Liefert die aktuell gültigen Abteilzeit-Offsets für den gewählten Tide-Modus.
 * "Wechsel Tide" ist der Mittelwert aus Flut und Ebbe — außer FkW/Stade,
 * die auf den Matrix-Durchschnitt angeglichen sind (siehe oben).
 */
export function getAbteilzeitSettings(tideModus: TideModus): AbteilzeitSettings {
  const hh =
    tideModus === "Wechsel Tide"
      ? mittelwert(TIDE_WERTE.Flut.hh, TIDE_WERTE.Ebbe.hh)
      : TIDE_WERTE[tideModus].hh;
  const fkw = tideModus === "Wechsel Tide" ? FKW_WECHSEL_TIDE : TIDE_WERTE[tideModus].fkw;
  const stade = tideModus === "Wechsel Tide" ? STADE_WECHSEL_TIDE : TIDE_WERTE[tideModus].stade;

  return {
    kudenAbteilung: KUDEN_ABTEILUNG,
    hhAbteilung: hh,
    fkwAbteilung: fkw,
    stadeAbteilung: stade,
    buetzZuschlag: BUETZ_ZUSCHLAG,
  };
}
