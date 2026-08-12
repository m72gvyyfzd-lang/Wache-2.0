/** Parser für den PDF-Export der "BZ2 Tendertafel" (Seestation) von
 *  elbe-pilot.de.
 *
 *  Das PDF hat KEINE gedruckten Spaltenüberschriften — die Spalten sind
 *  nur über ihre (template-festen) x-Positionen erkennbar. Jeder
 *  Schiffseintrag ist ein Block aus bis zu drei dicht untereinander
 *  liegenden Textzeilen (Datum / Schiff+Kat+Best+V-Nr / Uhrzeit), lange
 *  Schiffs- und Lotsennamen laufen über mehrere dieser Zeilen. Blöcke
 *  werden über den vertikalen Abstand gruppiert (innerhalb ~8-9 Einheiten,
 *  zwischen Einträgen ~24) und die Zellen dann über x-Bänder den Feldern
 *  zugeordnet. */

import { istDruckzeile } from "./pdfExtrakt";
import type { PdfSeite, PdfZeile } from "./pdfExtrakt";

export interface TenderEintrag {
  datum: string;
  zeit: string;
  schiff: string;
  kat: string;
  /** Bestimmung: H (Hamburg), K (Kanal/NOK), EH (Elbehafen) */
  best: string;
  /** "T"-Markierung (Tender) vorhanden */
  tender: boolean;
  vNr: string;
  lotse: string;
}

export interface SeestationPdfErgebnis {
  /** Kopfbereich (Tender-Name, letztes Update, Besetzungs-Infos) — roh */
  kopfdaten: string[][];
  eintraege: TenderEintrag[];
}

/** Zeilen, deren y-Abstand kleiner ist, gehören zum selben Schiffsblock. */
const BLOCK_ABSTAND = 14;

/** Spaltenbänder (x-Mittelpunkt), aus dem echten Template abgelesen —
 *  großzügige Grenzen, damit leichte Verschiebungen nicht kippen. */
const BAND_GRENZEN = [118, 292, 346, 371, 388, 427];
type Feld = "zeitraum" | "schiff" | "kat" | "best" | "tender" | "vNr" | "lotse";
const BAND_FELDER: Feld[] = ["zeitraum", "schiff", "kat", "best", "tender", "vNr", "lotse"];

const DATUM_RE = /^\d{1,2}\.\d{1,2}\.$/;
const ZEIT_RE = /^\d{1,2}:\d{2}$/;

function feldFuer(x: number): Feld {
  for (let i = 0; i < BAND_GRENZEN.length; i++) {
    if (x < BAND_GRENZEN[i]) return BAND_FELDER[i];
  }
  return BAND_FELDER[BAND_FELDER.length - 1];
}

interface Block {
  zeilen: PdfZeile[];
}

function zuBloecke(zeilen: PdfZeile[]): Block[] {
  const bloecke: Block[] = [];
  let letzteY: number | null = null;
  for (const zeile of zeilen) {
    if (letzteY !== null && letzteY - zeile.y <= BLOCK_ABSTAND && bloecke.length > 0) {
      bloecke[bloecke.length - 1].zeilen.push(zeile);
    } else {
      bloecke.push({ zeilen: [zeile] });
    }
    letzteY = zeile.y;
  }
  return bloecke;
}

function parseBlock(block: Block): TenderEintrag {
  const eintrag: TenderEintrag = {
    datum: "",
    zeit: "",
    schiff: "",
    kat: "",
    best: "",
    tender: false,
    vNr: "",
    lotse: "",
  };
  const anhaengen = (feld: "schiff" | "lotse" | "kat" | "best" | "vNr", text: string) => {
    eintrag[feld] = eintrag[feld] === "" ? text : `${eintrag[feld]} ${text}`;
  };
  for (const zeile of block.zeilen) {
    for (const zelle of zeile.zellen) {
      const feld = feldFuer((zelle.x + zelle.xEnde) / 2);
      if (feld === "zeitraum") {
        if (DATUM_RE.test(zelle.text)) eintrag.datum = zelle.text;
        else if (ZEIT_RE.test(zelle.text)) eintrag.zeit = zelle.text;
        else anhaengen("schiff", zelle.text);
      } else if (feld === "tender") {
        if (zelle.text === "T") eintrag.tender = true;
        else anhaengen("best", zelle.text);
      } else {
        anhaengen(feld, zelle.text);
      }
    }
  }
  return eintrag;
}

export function parseSeestationPdf(seiten: PdfSeite[]): SeestationPdfErgebnis {
  const ergebnis: SeestationPdfErgebnis = { kopfdaten: [], eintraege: [] };

  for (const seite of seiten) {
    const inhalt = seite.zeilen.filter((z) => !istDruckzeile(z, seite.hoehe));
    for (const block of zuBloecke(inhalt)) {
      const istSchiff = block.zeilen.some((zeile) =>
        zeile.zellen.some((zelle) => DATUM_RE.test(zelle.text) && zelle.x < BAND_GRENZEN[0]),
      );
      if (istSchiff) {
        ergebnis.eintraege.push(parseBlock(block));
      } else {
        for (const zeile of block.zeilen) {
          ergebnis.kopfdaten.push(zeile.zellen.map((z) => z.text));
        }
      }
    }
  }

  return ergebnis;
}
