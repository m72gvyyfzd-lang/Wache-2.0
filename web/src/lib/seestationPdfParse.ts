/** Parser für den PDF-Export der "BZ2 Tendertafel" (Seestation) von
 *  elbe-pilot.de.
 *
 *  Das PDF hat KEINE gedruckten Spaltenüberschriften, an denen sich die
 *  Spalten ausrichten ließen (anders als Tafel Brb und Törnliste). Die
 *  x-Positionen sind dabei NICHT template-fest: die Tabelle wächst mit
 *  ihrem Inhalt, ein Export mit langen, ungebrochenen Schiffsnamen
 *  verschiebt alle rechten Spalten um mehrere Punkte. Feste x-Bänder
 *  würden dann reihenweise danebengreifen (V-Nr. landet beim Lotsen, das
 *  Tender-"T" in der V-Nr.-Spalte).
 *
 *  Deshalb wird jede Zelle über ihren INHALT erkannt (Datum, Uhrzeit,
 *  Bestimmung H/K/EH, Tender-"T", V-Nr., Kategorie) und nur die Trennung
 *  zwischen Schiffs- und Lotsennamen — die beide beliebiger Text sind —
 *  über eine Position entschieden, die aus dem Dokument selbst kalibriert
 *  wird (Lücke zwischen der V-Nr.-Spalte und der Lotsen-Spalte).
 *
 *  Jeder Schiffseintrag ist ein Block aus bis zu drei dicht untereinander
 *  liegenden Textzeilen (Datum / Schiff+Kat+Best+V-Nr / Uhrzeit), lange
 *  Schiffs- und Lotsennamen laufen über mehrere dieser Zeilen; Blöcke
 *  entstehen über den vertikalen Abstand (innerhalb ~8-9 Einheiten,
 *  zwischen Einträgen ~24). */

import { istDruckzeile } from "./pdfExtrakt";
import type { PdfFlaeche, PdfSeite, PdfZeile } from "./pdfExtrakt";

export interface TenderEintrag {
  datum: string;
  zeit: string;
  schiff: string;
  kat: string;
  /** Bestimmung: H (Hamburg), K (Kanal/NOK), EH (Elbehafen), BÜTZ, STADE … */
  best: string;
  /** "T"-Markierung (Tender) vorhanden */
  tender: boolean;
  vNr: string;
  lotse: string;
  /** Schiffsname fett = Schiff ist angemeldet */
  schiffFett: boolean;
  /** Lotsenname fett = Lotse ist bereits auf der Seestation */
  lotseFett: boolean;
  /** Datum/Zeit-Zelle rot hinterlegt = E3/St */
  e3st: boolean;
}

export interface SeestationPdfErgebnis {
  /** Kopfbereich (Tender-Name, letztes Update, Besetzungs-Infos) — roh */
  kopfdaten: string[][];
  eintraege: TenderEintrag[];
}

/** Zeilen, deren y-Abstand kleiner ist, gehören zum selben Schiffsblock. */
const BLOCK_ABSTAND = 14;

const DATUM_RE = /^\d{1,2}\.\d{1,2}\.$/;
const ZEIT_RE = /^\d{1,2}:\d{2}$/;
/** Einzeilige Einträge setzen Datum und Uhrzeit GEMEINSAM in eine Zelle
 *  ("15.08. 21:00"): nur bei dreizeiligen Blöcken (umbrechender Schiffs-/
 *  Lotsenname oder Versetzmittel-Kürzel) stehen Datum und Zeit getrennt
 *  übereinander. Ohne dieses Muster fiele jeder einzeilige Eintrag durch
 *  die Datums-Erkennung und landete fälschlich in den Kopfdaten.
 *
 *  Es zählt aber NUR als erste Zelle einer Zeile: in der Tendertafel ist
 *  Datum/Zeit immer die linke Randspalte. Andere Tafeln (z.B. Tafel Brb)
 *  führen dasselbe Muster in einer rechten Spalte — eine falsch
 *  hochgeladene Datei würde sonst als gültige Tendertafel durchgehen. */
const DATUM_ZEIT_RE = /^(\d{1,2}\.\d{1,2}\.)\s+(\d{1,2}:\d{2})$/;
/** V-Nrn sind zwei- bis dreistellig (mit optionalem Zusatz A–D). Einstellige
 *  Zahlen bleiben bewusst außen vor — das sind die Kategorien. */
const VNR_RE = /^\d{2,3}\s*[A-D]?$/i;
/** Neben H (Hamburg), K (Kanal/NOK) und EH (Elbehafen) schreibt die Tafel
 *  auch ausgeschriebene Kurzziele in die Bestimmungs-Spalte ("BÜTZ" =
 *  Bützfleth, "STADE") — ohne Erkennung würden sie dem Schiffsnamen
 *  zugeschlagen ("CORELLI BÜTZ"). */
const BEST_RE = /^(H|K|EH|BÜTZ|STADE)$/i;
/** Kategorie: einstellige Zahl oder AGF-Form ("AGF 3/7", "Agf3+"). */
const KAT_RE = /^(\d|agf\s*\d(\s*\/\s*\d)?\+?)$/i;

/** Fallback-Trenner Schiff|Lotse, falls im Dokument keine einzige V-Nr.
 *  steht (dann lässt sich nichts kalibrieren) — der Wert des früheren
 *  festen Rasters. */
const TRENNER_FALLBACK = 427;

/** Ermittelt aus dem Dokument, ab welcher x-Position (linke Zellkante) der
 *  Lotsenname beginnt: mittig zwischen dem rechten Rand der V-Nr.-Spalte
 *  und dem linken Rand der Lotsen-Spalte. Beide Ränder kommen aus den
 *  erkannten V-Nr.-Zellen bzw. aus allem, was rechts davon steht — damit
 *  wandert der Trenner automatisch mit, wenn die Tabelle breiter wird. */
function kalibriereTrenner(zeilen: PdfZeile[]): number {
  const vNrEnden: number[] = [];
  for (const zeile of zeilen) {
    for (const zelle of zeile.zellen) {
      if (VNR_RE.test(zelle.text)) vNrEnden.push(zelle.xEnde);
    }
  }
  if (vNrEnden.length === 0) return TRENNER_FALLBACK;
  vNrEnden.sort((a, b) => a - b);
  const vNrRechts = vNrEnden[Math.floor(vNrEnden.length / 2)]; // Median
  let lotseLinks = Infinity;
  for (const zeile of zeilen) {
    for (const zelle of zeile.zellen) {
      if (zelle.x > vNrRechts && zelle.x < lotseLinks) lotseLinks = zelle.x;
    }
  }
  return lotseLinks === Infinity ? vNrRechts + 5 : (vNrRechts + lotseLinks) / 2;
}

interface Block {
  zeilen: PdfZeile[];
  /** Datums-/Uhrzeit-Zelle rot hinterlegt (= E3/St) */
  rot: boolean;
}

/** Liegt eine Zelle links des Trenners auf einer roten Fläche? Die roten
 *  Rechtecke der Tendertafel liegen über genau der Datums-/Uhrzeit-Spalte.
 *  Geprüft wird immer nur gegen die Flächen DERSELBEN Seite — y-Werte sind
 *  seitenlokal, ein Vergleich über die Seitengrenze hinweg trifft zufällig. */
function istRotHinterlegt(zeilen: PdfZeile[], roteFlaechen: PdfFlaeche[], trenner: number): boolean {
  return zeilen.some((zeile) =>
    zeile.zellen.some(
      (zelle) =>
        zelle.x < trenner &&
        roteFlaechen.some(
          (f) => zeile.y >= f.y && zeile.y <= f.yEnde && zelle.x >= f.x - 2 && zelle.x <= f.xEnde + 2,
        ),
    ),
  );
}

function zuBloecke(zeilen: PdfZeile[], roteFlaechen: PdfFlaeche[], trenner: number): Block[] {
  const bloecke: Block[] = [];
  let letzteY: number | null = null;
  for (const zeile of zeilen) {
    if (letzteY !== null && letzteY - zeile.y <= BLOCK_ABSTAND && bloecke.length > 0) {
      bloecke[bloecke.length - 1].zeilen.push(zeile);
    } else {
      bloecke.push({ zeilen: [zeile], rot: false });
    }
    letzteY = zeile.y;
  }
  for (const block of bloecke) block.rot = istRotHinterlegt(block.zeilen, roteFlaechen, trenner);
  return bloecke;
}

function parseBlock(block: Block, trenner: number): TenderEintrag {
  const eintrag: TenderEintrag = {
    datum: "",
    zeit: "",
    schiff: "",
    kat: "",
    best: "",
    tender: false,
    vNr: "",
    lotse: "",
    schiffFett: false,
    lotseFett: false,
    e3st: block.rot,
  };
  const anhaengen = (feld: "schiff" | "lotse" | "kat" | "best" | "vNr", text: string) => {
    eintrag[feld] = eintrag[feld] === "" ? text : `${eintrag[feld]} ${text}`;
  };
  for (const zeile of block.zeilen) {
    for (const zelle of zeile.zellen) {
      const text = zelle.text;
      // Rechts der V-Nr.-Spalte steht ausschließlich der Lotsenname —
      // inklusive Fortsetzungszeilen und der angehängten Kat.-Ziffer, die
      // sonst als Schiffskategorie missdeutet würde.
      if (zelle.x >= trenner) {
        anhaengen("lotse", text);
        if (zelle.fett) eintrag.lotseFett = true;
        continue;
      }
      const datumZeit = zelle === zeile.zellen[0] ? DATUM_ZEIT_RE.exec(text) : null;
      if (datumZeit) {
        eintrag.datum = datumZeit[1];
        eintrag.zeit = datumZeit[2];
      } else if (DATUM_RE.test(text)) {
        eintrag.datum = text;
      } else if (ZEIT_RE.test(text)) {
        eintrag.zeit = text;
      } else if (text.toUpperCase() === "T") {
        eintrag.tender = true;
      } else if (text.toUpperCase() === "B") {
        // Versetzmittel "Boot" (Gegenstück zum Tender-"T") — für die Wache
        // ohne Bedeutung. Wichtig ist nur, dass das freistehende "B" NICHT
        // an den Schiffsnamen wandert: sonst matcht "HAVSTRAUM B" beim
        // ETA-Update nicht mehr auf das bestehende Schiff "HAVSTRAUM".
      } else if (BEST_RE.test(text)) {
        anhaengen("best", text);
      } else if (VNR_RE.test(text)) {
        anhaengen("vNr", text);
      } else if (KAT_RE.test(text)) {
        anhaengen("kat", text);
      } else {
        // Alles Übrige links des Trenners ist Schiffsname (auch mehrzeilig).
        anhaengen("schiff", text);
        if (zelle.fett) eintrag.schiffFett = true;
      }
    }
  }
  return eintrag;
}

export function parseSeestationPdf(seiten: PdfSeite[]): SeestationPdfErgebnis {
  const ergebnis: SeestationPdfErgebnis = { kopfdaten: [], eintraege: [] };

  // Erst kalibrieren (über ALLE Seiten), dann parsen: die Spaltenposition
  // ist je Export unterschiedlich, innerhalb eines Exports aber konstant.
  const inhaltProSeite = seiten.map((seite) => seite.zeilen.filter((z) => !istDruckzeile(z, seite.hoehe)));
  const trenner = kalibriereTrenner(inhaltProSeite.flat());

  const hatDatum = (block: Block) =>
    block.zeilen.some(
      (zeile) =>
        zeile.zellen.some((zelle) => DATUM_RE.test(zelle.text) && zelle.x < trenner) ||
        (zeile.zellen.length > 0 && DATUM_ZEIT_RE.test(zeile.zellen[0].text) && zeile.zellen[0].x < trenner),
    );

  // Blöcke aller Seiten in EINER Liste: ein Schiffseintrag beginnt immer mit
  // seiner Datumszeile, deshalb gehört ein Block ohne Datum am Seitenanfang
  // zum letzten Block der Vorseite — Einträge dürfen über den Seitenumbruch
  // laufen (Datum unten auf Seite 1, Rest oben auf Seite 2). Die y-Werte
  // sind seitenlokal, ein Abstandsvergleich wäre über die Grenze hinweg
  // bedeutungslos.
  const bloecke: Block[] = [];
  inhaltProSeite.forEach((inhalt, seitenNr) => {
    zuBloecke(inhalt, seiten[seitenNr].roteFlaechen, trenner).forEach((block, i) => {
      const letzter = bloecke[bloecke.length - 1];
      if (i === 0 && !hatDatum(block) && letzter && hatDatum(letzter)) {
        letzter.zeilen.push(...block.zeilen);
        letzter.rot = letzter.rot || block.rot;
        return;
      }
      bloecke.push(block);
    });
  });

  for (const block of bloecke) {
    if (hatDatum(block)) {
      ergebnis.eintraege.push(parseBlock(block, trenner));
    } else {
      for (const zeile of block.zeilen) {
        ergebnis.kopfdaten.push(zeile.zellen.map((z) => z.text));
      }
    }
  }

  return ergebnis;
}
