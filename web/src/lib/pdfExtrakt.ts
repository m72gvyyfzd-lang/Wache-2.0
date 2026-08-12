/** Liest ein PDF komplett im Browser aus (pdf.js) und rekonstruiert aus den
 *  Text-Positionen eine Zeilen-/Zellen-Struktur — die Grundlage für die
 *  Wachbeginn-Parser (Tafel Brb / Seestation).
 *
 *  Die BZ2-Exporte sind maschinell erzeugte Text-PDFs (kein Scan, keine
 *  OCR nötig): jedes Textstück kommt mit exakter x/y-Position. Zeilen
 *  entstehen durch Gruppieren ähnlicher y-Werte, Zellen durch Zusammenfassen
 *  direkt aneinander anschließender Textstücke. pdf.js wird erst beim ersten
 *  Aufruf nachgeladen, damit der normale App-Start unbelastet bleibt. */

export interface PdfZelle {
  text: string;
  /** linke Kante in PDF-Einheiten (Ursprung links unten) */
  x: number;
  /** rechte Kante */
  xEnde: number;
}

export interface PdfZeile {
  zellen: PdfZelle[];
  y: number;
}

export interface PdfSeite {
  zeilen: PdfZeile[];
  /** Seitenhöhe in PDF-Einheiten — erlaubt den Parsern, Druck-Kopf-/
   *  Fußzeilen (Safari-PDF-Export) über ihre Randposition auszusortieren. */
  hoehe: number;
}

/** Safari/Chrome setzen beim PDF-Export Druck-Kopf-/Fußzeilen auf jede
 *  Seite: URL, "Seite X von Y", Titel und Zeitstempel. Erkennung doppelt:
 *  über die Position am Blattrand und über typische Muster. */
const DRUCKZEILEN_RE = /:\/\/|^tps:|Seite \d+ von|^\d{1,2}\.\d{1,2}\.\d{2,4}, \d{1,2} ?: ?\d{2}$/i;
const SEITENRAND = 30;

export function istDruckzeile(zeile: PdfZeile, seitenHoehe: number): boolean {
  if (zeile.y <= SEITENRAND || zeile.y >= seitenHoehe - SEITENRAND) return true;
  return zeile.zellen.some((z) => DRUCKZEILEN_RE.test(z.text));
}

/** Zwei Textstücke, deren Lücke kleiner ist, gehören zur selben Zelle
 *  (pdf.js zerlegt zusammenhängenden Text oft in mehrere Stücke). */
const ZELLEN_LUECKE = 4;

/** y-Toleranz, innerhalb derer Textstücke als eine Zeile gelten. */
const ZEILEN_TOLERANZ = 3;

/* pdf.js in Version 3 (Legacy-Build) statt der aktuellen 6er: die neueren
   Builds (auch deren "legacy"-Variante) setzen JS-Funktionen voraus, die
   ältere Safari-Versionen (iPad!) nicht kennen — dort schlug das Parsen
   mit "undefined is not a function" fehl. Der 3er-Legacy-Build ist weit
   zurück kompatibel und nutzt einen klassischen (nicht-Modul-)Worker. */
type PdfjsModul = typeof import("pdfjs-dist/legacy/build/pdf");

let pdfjsPromise: Promise<PdfjsModul> | null = null;

function ladePdfjs(): Promise<PdfjsModul> {
  pdfjsPromise ??= (async () => {
    const [pdfjs, worker] = await Promise.all([
      import("pdfjs-dist/legacy/build/pdf"),
      import("pdfjs-dist/legacy/build/pdf.worker.min.js?url"),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  })();
  return pdfjsPromise;
}

interface RohStueck {
  text: string;
  x: number;
  breite: number;
  y: number;
}

function zuZeilen(stuecke: RohStueck[]): PdfZeile[] {
  const sortiert = [...stuecke].sort((a, b) => b.y - a.y || a.x - b.x);
  const zeilen: { y: number; stuecke: RohStueck[] }[] = [];
  for (const s of sortiert) {
    const letzte = zeilen[zeilen.length - 1];
    if (letzte && Math.abs(letzte.y - s.y) <= ZEILEN_TOLERANZ) {
      letzte.stuecke.push(s);
    } else {
      zeilen.push({ y: s.y, stuecke: [s] });
    }
  }

  return zeilen.map((zeile) => {
    const inReihenfolge = [...zeile.stuecke].sort((a, b) => a.x - b.x);
    const zellen: PdfZelle[] = [];
    for (const s of inReihenfolge) {
      const letzte = zellen[zellen.length - 1];
      if (letzte && s.x - letzte.xEnde <= ZELLEN_LUECKE) {
        letzte.text = `${letzte.text} ${s.text}`.replace(/\s+/g, " ").trim();
        letzte.xEnde = Math.max(letzte.xEnde, s.x + s.breite);
      } else {
        zellen.push({ text: s.text.replace(/\s+/g, " ").trim(), x: s.x, xEnde: s.x + s.breite });
      }
    }
    return { y: zeile.y, zellen: zellen.filter((z) => z.text !== "") };
  }).filter((z) => z.zellen.length > 0);
}

/** Liest alle Seiten des PDFs und liefert pro Seite die Zeilenstruktur. */
export async function extrahierePdfZeilen(daten: ArrayBuffer): Promise<PdfSeite[]> {
  const pdfjs = await ladePdfjs();
  const ladeTask = pdfjs.getDocument({ data: daten });
  try {
    const doc = await ladeTask.promise;
    const seiten: PdfSeite[] = [];
    for (let nr = 1; nr <= doc.numPages; nr++) {
      const seite = await doc.getPage(nr);
      const inhalt = await seite.getTextContent();
      const stuecke: RohStueck[] = [];
      for (const item of inhalt.items) {
        if (!("str" in item) || item.str.trim() === "") continue;
        stuecke.push({
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
          breite: item.width,
        });
      }
      seiten.push({ zeilen: zuZeilen(stuecke), hoehe: seite.getViewport({ scale: 1 }).height });
    }
    return seiten;
  } finally {
    await ladeTask.destroy();
  }
}
