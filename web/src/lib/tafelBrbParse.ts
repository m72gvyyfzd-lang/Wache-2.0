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

import type { PdfZeile } from "./pdfExtrakt";

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

const FOOTER_RE = /^tps:\/\/|Seite \d+ von/i;

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

export function parseTafelBrb(seiten: PdfZeile[][]): TafelBrbErgebnis {
  const ergebnis: TafelBrbErgebnis = {
    meta: { tiden: {}, kopfdaten: [] },
    sektionen: [],
    unparsed: [],
  };
  const sektionNachId = new Map<TafelSektionId, AktiveSektion>();
  let aktiv: AktiveSektion | null = null;

  for (const seite of seiten) {
    for (const zeile of seite) {
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
        // Seitenumbrüche wiederholen die Überschrift: bestehende Sektion
        // fortsetzen (Anker auffrischen), statt sie zu duplizieren.
        const bestehend = sektionNachId.get(neueSektionId);
        const anker = zeile.zellen.map((z) => (z.x + z.xEnde) / 2);
        if (bestehend) {
          bestehend.anker = anker;
          aktiv = bestehend;
        } else {
          const sektion: TafelSektion = {
            id: neueSektionId,
            titel: SEKTIONS_TITEL[neueSektionId],
            spalten: texte,
            zeilen: [],
          };
          aktiv = { sektion, anker };
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
      // Einzelne Streu-Zellen (z.B. Fußnoten) gehören zu keiner Tabelle —
      // sichtbar in `unparsed` sammeln statt still einer Sektion zuzuordnen.
      if (aktiv && texte.length >= 2) {
        aktiv.sektion.zeilen.push(ordneZellenZu(zeile, aktiv.anker));
      } else {
        ergebnis.unparsed.push(texte);
      }
    }
  }

  return ergebnis;
}
