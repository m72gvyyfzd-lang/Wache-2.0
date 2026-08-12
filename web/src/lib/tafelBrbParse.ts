/** Parser für den PDF-Export der "BZ2 Tafel" von elbe-pilot.de (Tafel Brb).
 *
 *  Port des validierten Python-Prototyps (tools/pdf-extraction): die
 *  Abschnitte werden anhand ihrer festen deutschen Spaltenüberschriften
 *  erkannt, nicht anhand fester Positionen — robust gegenüber wechselndem
 *  Inhalt (Anzahl Jobs/Lotsen pro Wache), nicht gegenüber Änderungen am
 *  Seiten-Template selbst. Nicht zuordenbare Zeilen landen in `unparsed`
 *  und werden in der Vorschau als Warnung gezeigt statt still zu
 *  verschwinden.
 *
 *  Anders als pdfplumber (Rasterlinien) arbeitet pdf.js nur mit
 *  Text-Positionen. Die Spaltenzuordnung läuft deshalb über Anker: die
 *  x-Mittelpunkte der Überschriften-Zellen definieren die Spalten, jede
 *  Datenzelle wird der nächstgelegenen Überschrift zugeordnet — damit
 *  verrutschen Werte auch bei leeren Zellen nicht. */

import type { PdfSeite, PdfZeile } from "./pdfExtrakt";

export type TafelSektionId =
  | "ft_zurueck"
  | "ausgehend_hamburg"
  | "ausgehend_nok"
  | "anmeldungen"
  | "lotsenliste"
  | "eingehende_schiffe";

export interface TafelSektion {
  id: TafelSektionId;
  titel: string;
  /** Überschriften-Zellen, wie im PDF gefunden */
  spalten: string[];
  /** Datenzeilen, per Anker exakt auf die Spalten verteilt */
  zeilen: string[][];
}

export interface TafelBrbErgebnis {
  meta: {
    station?: string;
    datum?: string;
    zeit?: string;
    fahrt?: { typ: string; von: string; nach: string };
    tiden: Record<string, string>;
    kopfdaten: string[][];
  };
  sektionen: TafelSektion[];
  unparsed: string[][];
}

/** Safari/Chrome setzen beim PDF-Export Kopf-/Fußzeilen auf jede Seite:
 *  URL, "Seite X von Y", Titel und Zeitstempel ("12.8.26, 22:39"). */
const FOOTER_RE = /:\/\/|^tps:|Seite \d+ von|^\d{1,2}\.\d{1,2}\.\d{2,4}, \d{1,2}:\d{2}$/i;

/** Randbereich oben/unten (PDF-Einheiten), in dem nur Druck-Kopf-/Fußzeilen
 *  liegen — Inhalt beginnt bei Browser-Exporten deutlich weiter innen. */
const SEITENRAND = 30;

const SEKTIONS_TITEL: Record<TafelSektionId, string> = {
  ft_zurueck: "FT zurück",
  ausgehend_hamburg: "Ausgehend Hamburg",
  ausgehend_nok: "Ausgehend NOK",
  anmeldungen: "Anmeldungen",
  lotsenliste: "Lotsenliste",
  eingehende_schiffe: "Eingehende Schiffe",
};

/** Kopf-/Infozeilen, die zu keiner Sektion gehören (aus dem Prototyp). */
const KOPFDATEN_ERSTE_ZELLE = new Set([
  "in der Fahrt",
  "Freie Tage",
  "Urlauber",
  "Radar bis:",
  "Bem. 1",
  "1 + 1",
  "lose HH",
  "Zulauf",
  "Seestation",
  "weitere",
]);

function erkenneSektion(texte: string[]): TafelSektionId | null {
  if (texte[0] === "FT zurück") return "ft_zurueck";
  if (texte.includes("HH") && texte.includes("FKW")) return "ausgehend_hamburg";
  if (texte.includes("Holt.") && texte.includes("Kuden")) return "ausgehend_nok";
  if (texte[0] === "Nr" && texte.includes("Typ") && texte.includes("Lotse")) return "anmeldungen";
  if (texte.includes("Tafel") && texte.includes("Name") && (texte.includes("BB") || texte.includes("CB"))) {
    return "lotsenliste";
  }
  if (texte[0] === "Nr." && texte.includes("ETA") && texte.includes("Best.")) return "eingehende_schiffe";
  return null;
}

interface AktiveSektion {
  sektion: TafelSektion;
  /** x-Mittelpunkte der Überschriften-Zellen (Spalten-Anker) */
  anker: number[];
  /** y-Position der zuletzt übernommenen Datenzeile */
  letzteY: number | null;
  /** Zwischengeparkte Zeilen ohne Wert in Spalte 1: erst wenn die nächste
   *  echte Zeile bekannt ist, entscheidet die y-Distanz, ob es der
   *  Überhang einer umgebrochenen Zelle der VORIGEN/NÄCHSTEN Zeile ist
   *  (dicht dran, je nach Zell-Ausrichtung darüber oder darunter) — oder
   *  eine EIGENSTÄNDIGE Zeile mit leerer erster Spalte (normaler
   *  Zeilenabstand; in der Lotsenliste hat die Mehrheit der Zeilen keine
   *  Tafel-Position). */
  fragmente: { werte: string[]; y: number }[];
}

/** Maximaler y-Abstand (PDF-Einheiten), bis zu dem eine Zeile ohne
 *  Spalte-1-Wert als Umbruch-Überhang ihrer Nachbarzeile gilt — knapp über
 *  einer Textzeilenhöhe, deutlich unter dem Abstand zweier Tabellenzeilen. */
const UMBRUCH_MAX_ABSTAND = 13;

function fuegeAn(ziel: string[], werte: string[], voranstellen: boolean) {
  for (let i = 0; i < werte.length; i++) {
    if (werte[i] === "") continue;
    if (ziel[i] === "") ziel[i] = werte[i];
    else ziel[i] = voranstellen ? `${werte[i]} ${ziel[i]}` : `${ziel[i]} ${werte[i]}`;
  }
}

/** Offene Fragmente auflösen, wenn keine Folgezeile mehr kommt (Sektions-/
 *  Seitenwechsel, Parse-Ende): dicht an der Vorzeile → anhängen, sonst
 *  eigenständige Zeile. */
function schliesseFragmente(aktiv: AktiveSektion | null) {
  if (!aktiv) return;
  let ziel = aktiv.sektion.zeilen[aktiv.sektion.zeilen.length - 1];
  let zielY = aktiv.letzteY;
  for (const frag of aktiv.fragmente) {
    if (ziel !== undefined && zielY !== null && Math.abs(frag.y - zielY) <= UMBRUCH_MAX_ABSTAND) {
      fuegeAn(ziel, frag.werte, false);
    } else {
      aktiv.sektion.zeilen.push(frag.werte);
      ziel = frag.werte;
    }
    zielY = frag.y;
  }
  aktiv.fragmente = [];
}

function ordneZellenZu(zeile: PdfZeile, anker: number[]): string[] {
  const ergebnis: string[] = anker.map(() => "");
  for (const zelle of zeile.zellen) {
    const mitte = (zelle.x + zelle.xEnde) / 2;
    let beste = 0;
    let besteDistanz = Infinity;
    for (let i = 0; i < anker.length; i++) {
      const distanz = Math.abs(anker[i] - mitte);
      if (distanz < besteDistanz) {
        besteDistanz = distanz;
        beste = i;
      }
    }
    ergebnis[beste] = ergebnis[beste] === "" ? zelle.text : `${ergebnis[beste]} ${zelle.text}`;
  }
  return ergebnis;
}

export function parseTafelBrb(seiten: PdfSeite[]): TafelBrbErgebnis {
  const ergebnis: TafelBrbErgebnis = {
    meta: { tiden: {}, kopfdaten: [] },
    sektionen: [],
    unparsed: [],
  };
  const sektionNachId = new Map<TafelSektionId, AktiveSektion>();
  let aktiv: AktiveSektion | null = null;

  for (const seite of seiten) {
    for (const zeile of seite.zeilen) {
      // Druck-Kopf-/Fußzeilen: am Blattrand positioniert oder an typischen
      // Mustern (URL, Seitenzahl, Zeitstempel) erkennbar — überspringen,
      // bevor sie in einer Sektion oder in `unparsed` landen.
      if (zeile.y <= SEITENRAND || zeile.y >= seite.hoehe - SEITENRAND) continue;
      const texte = zeile.zellen.map((z) => z.text);
      if (texte.some((t) => FOOTER_RE.test(t))) continue;

      // --- Meta-Zeilen -------------------------------------------------
      if (texte[0] === "Wache") {
        ergebnis.meta.station = texte[1] ?? "";
        ergebnis.meta.datum = texte[2] ?? "";
        ergebnis.meta.zeit = texte[4] ?? texte[3] ?? "";
        continue;
      }
      if (texte[0] === "Fahrt") {
        ergebnis.meta.fahrt = { typ: texte[1] ?? "", von: texte[2] ?? "", nach: texte[3] ?? "" };
        continue;
      }
      if (texte[0]?.startsWith("Tide ")) {
        ergebnis.meta.tiden[texte[0]] = texte[1] ?? "";
        continue;
      }

      // --- Sektions-Überschrift erkannt --------------------------------
      const neueSektionId = erkenneSektion(texte);
      if (neueSektionId) {
        schliesseFragmente(aktiv);
        // Seitenumbrüche wiederholen die Überschrift: bestehende Sektion
        // fortsetzen (Anker auffrischen), statt sie zu duplizieren.
        const bestehend = sektionNachId.get(neueSektionId);
        const anker = zeile.zellen.map((z) => (z.x + z.xEnde) / 2);
        if (bestehend) {
          bestehend.anker = anker;
          bestehend.letzteY = null;
          aktiv = bestehend;
        } else {
          const sektion: TafelSektion = {
            id: neueSektionId,
            titel: SEKTIONS_TITEL[neueSektionId],
            spalten: texte,
            zeilen: [],
          };
          aktiv = { sektion, anker, letzteY: null, fragmente: [] };
          sektionNachId.set(neueSektionId, aktiv);
          ergebnis.sektionen.push(sektion);
        }
        continue;
      }

      // --- Info-/Kopfzeilen, die keine neue Sektion einleiten -----------
      if (
        KOPFDATEN_ERSTE_ZELLE.has(texte[0]) ||
        texte.includes("Anmeldungen") ||
        texte.slice(0, 3).includes("ETA")
      ) {
        ergebnis.meta.kopfdaten.push(texte);
        continue;
      }

      // --- Datenzeile der aktuellen Sektion ------------------------------
      if (aktiv) {
        const zugeordnet = ordneZellenZu(zeile, aktiv.anker);
        if (zugeordnet[0] === "") {
          // Fortsetzung einer umgebrochenen Zelle (kein Wert in der
          // Nr-/Tafel-Spalte) — parken, bis die nächste echte Zeile die
          // Zuordnung per y-Distanz entscheidet. Zeilen NUR mit Nr.
          // bleiben eigenständig (Leer-Slots der Tabellen).
          aktiv.fragmente.push({ werte: zugeordnet, y: zeile.y });
        } else {
          let anhaengeZiel = aktiv.sektion.zeilen[aktiv.sektion.zeilen.length - 1];
          let anhaengeY = aktiv.letzteY;
          for (const frag of aktiv.fragmente) {
            const abstandVor =
              anhaengeZiel !== undefined && anhaengeY !== null ? Math.abs(frag.y - anhaengeY) : Infinity;
            const abstandNach = Math.abs(frag.y - zeile.y);
            if (abstandVor <= UMBRUCH_MAX_ABSTAND && abstandVor <= abstandNach) {
              fuegeAn(anhaengeZiel!, frag.werte, false);
            } else if (abstandNach <= UMBRUCH_MAX_ABSTAND) {
              fuegeAn(zugeordnet, frag.werte, true);
            } else {
              // Normaler Zeilenabstand zu beiden Nachbarn: eigenständige
              // Zeile mit leerer erster Spalte, in Originalreihenfolge.
              aktiv.sektion.zeilen.push(frag.werte);
              anhaengeZiel = frag.werte;
            }
            anhaengeY = frag.y;
          }
          aktiv.fragmente = [];
          aktiv.sektion.zeilen.push(zugeordnet);
          aktiv.letzteY = zeile.y;
        }
      } else {
        ergebnis.unparsed.push(texte);
      }
    }

    // Seitenwechsel: offene Fragmente gehören noch zur alten Seite, und
    // y-Werte sind seitenlokal — Distanzvergleiche über die Grenze hinweg
    // wären bedeutungslos.
    schliesseFragmente(aktiv);
    if (aktiv) aktiv.letzteY = null;
  }
  schliesseFragmente(aktiv);

  return ergebnis;
}
