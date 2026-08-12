/** Parser für den PDF-Export der "BZ2 Törnliste" (Törnstände für die
 *  Listenvergaben) von elbe-pilot.de.
 *
 *  Aufbau: Titelzeile ("Törnliste Bezirk 2"), Stand-Zeile ("Letze
 *  Aktualisierung …"), eine Überschriftenzeile (Lotse / 1+1 / Weser Blau /
 *  Weser Rot / Hulo — nur auf Seite 1) und dann eine einzeilige Tabelle
 *  über alle Seiten. Die Spaltenzuordnung läuft wie bei der Tafel über die
 *  x-Anker der Überschriften-Zellen; fehlende Werte bleiben leer. */

import { istDruckzeile } from "./pdfExtrakt";
import type { PdfSeite } from "./pdfExtrakt";

export interface ToernstaendeErgebnis {
  /** z.B. "Mittwoch, 12. August 2026" */
  stand?: string;
  /** Überschriften-Zellen, wie im PDF gefunden */
  spalten: string[];
  /** Datenzeilen, per Anker exakt auf die Spalten verteilt */
  eintraege: string[][];
  /** Zeilen vor/neben der Tabelle, die nicht zugeordnet werden konnten */
  unparsed: string[][];
}

export function parseToernstaende(seiten: PdfSeite[]): ToernstaendeErgebnis {
  const ergebnis: ToernstaendeErgebnis = { spalten: [], eintraege: [], unparsed: [] };
  let anker: number[] | null = null;

  for (const seite of seiten) {
    for (const zeile of seite.zeilen) {
      if (istDruckzeile(zeile, seite.hoehe)) continue;
      const texte = zeile.zellen.map((z) => z.text);

      if (texte[0] === "Törnliste") continue;
      if (texte[0]?.startsWith("Letze Aktualisierung") || texte[0]?.startsWith("Letzte Aktualisierung")) {
        ergebnis.stand = texte[1] ?? "";
        continue;
      }

      // Überschriftenzeile (nur Seite 1) — definiert die Spalten-Anker.
      if (texte.includes("Lotse") && (texte.includes("Hulo") || texte.includes("Weser Blau"))) {
        anker = zeile.zellen.map((z) => (z.x + z.xEnde) / 2);
        ergebnis.spalten = texte;
        continue;
      }

      if (!anker) {
        ergebnis.unparsed.push(texte);
        continue;
      }

      const zugeordnet: string[] = anker.map(() => "");
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
        zugeordnet[beste] = zugeordnet[beste] === "" ? zelle.text : `${zugeordnet[beste]} ${zelle.text}`;
      }
      // Ohne Namen (Spalte 1) ist es keine Törn-Zeile — sichtbar sammeln.
      if (zugeordnet[0] === "") ergebnis.unparsed.push(texte);
      else ergebnis.eintraege.push(zugeordnet);
    }
  }

  return ergebnis;
}
