/**
 * ETA-Update: gleicht einen erneuten Tendertafel-Upload mit der bestehenden
 * ETA-Seestation-Liste ab — mitten in der Wache, ohne die übrigen Daten
 * anzufassen (Lotsen bleiben unberührt).
 *
 * Abgleich über den Schiffsnamen (normalisiert). Je PDF-Schiff entsteht
 * eine Vorschau-Zeile:
 * - "neu"          — noch nicht in der Liste, wird angehängt
 * - "geaendert"    — vorhanden, mindestens ein Feld weicht ab (die Felder
 *                    werden benannt und in der Vorschau hervorgehoben)
 * - "unveraendert" — vorhanden und identisch
 * - "abgeteilt"    — das Schiff hat auf der Seestation bereits alle Lotsen
 *                    erhalten, steht aber noch im PDF → ALARM; es wird beim
 *                    Übernehmen nicht angefasst.
 * Bestehende Schiffe, die im PDF fehlen, bleiben erhalten (nur ein Hinweis).
 */
import type { SeeAbteilung, SeeSchiff } from "../data/types";
import { formatUhrzeit } from "./format";
import type { SeestationPdfErgebnis } from "./seestationPdfParse";
import { seeLotsenAnzahl } from "./seestationAbteilen";
import { seeSchiffeAusTender, type ImportMeldung } from "./wachbeginnImport";

export type EtaUpdateTyp = "neu" | "geaendert" | "unveraendert" | "abgeteilt";

/** Felder, die das Update vergleichen und übernehmen darf. */
export type EtaUpdateFeld = "eta" | "kategorie" | "angemeldet" | "e3st" | "ehfLotseBenoetigt" | "doppeldecker";

export interface EtaUpdateZeile {
  typ: EtaUpdateTyp;
  /** Stand aus dem PDF */
  neu: Omit<SeeSchiff, "id">;
  /** bestehender Eintrag (bei "neu" undefined) */
  alt?: SeeSchiff;
  /** abweichende Felder (nur bei "geaendert" gefüllt) */
  felder: EtaUpdateFeld[];
}

export interface EtaUpdateErgebnis {
  zeilen: EtaUpdateZeile[];
  /** Ergebnisliste fürs Übernehmen: bestehende aktualisiert (IDs bleiben),
   *  neue mit frischen IDs angehängt, nicht im PDF enthaltene unverändert. */
  seeSchiffe: SeeSchiff[];
  meldungen: ImportMeldung[];
}

const VERGLEICHSFELDER: EtaUpdateFeld[] = [
  "eta",
  "kategorie",
  "angemeldet",
  "e3st",
  "ehfLotseBenoetigt",
  "doppeldecker",
];

function schluessel(name: string): string {
  // Ein angehängtes Versetzmittel-Kürzel ("HAVSTRAUM B"/"HAVSTRAUM T", von
  // älteren Importen fälschlich in den Namen übernommen) zählt beim
  // Abgleich nicht — so heilt ein erneutes Update solche Einträge, statt
  // Duplikate anzulegen.
  return name.replace(/\s+/g, " ").trim().toUpperCase().replace(/ [BT]$/, "");
}

function feldWert(schiff: Omit<SeeSchiff, "id">, feld: EtaUpdateFeld): string | number | boolean {
  if (feld === "eta") return schiff.eta.getTime();
  if (feld === "kategorie") return schiff.kategorie ?? "";
  // die optionalen Flags speichern "aus" mal als undefined, mal als false
  return schiff[feld] ?? false;
}

export function formatEtaFeld(feld: EtaUpdateFeld, schiff: Omit<SeeSchiff, "id">): string {
  if (feld === "eta") return formatUhrzeit(schiff.eta);
  if (feld === "kategorie") return schiff.kategorie ?? "–";
  return feldWert(schiff, feld) ? "✓" : "–";
}

export function berechneEtaUpdate(
  tender: SeestationPdfErgebnis,
  bestehende: SeeSchiff[],
  seeAbteilungen: SeeAbteilung[],
  jetzt: Date,
): EtaUpdateErgebnis {
  const meldungen: ImportMeldung[] = [];
  const ausPdf = seeSchiffeAusTender(tender, jetzt, meldungen);

  const abgeteiltProSchiff = new Map<number, number>();
  for (const sa of seeAbteilungen) {
    abgeteiltProSchiff.set(sa.seeSchiffId, (abgeteiltProSchiff.get(sa.seeSchiffId) ?? 0) + 1);
  }
  const istVollAbgeteilt = (schiff: SeeSchiff) =>
    seeLotsenAnzahl(schiff) - (abgeteiltProSchiff.get(schiff.id) ?? 0) <= 0;

  // Kandidaten je Namensschlüssel — gleiche Namen der Reihe nach verbrauchen,
  // damit zwei gleichnamige Schiffe nicht beide auf denselben Eintrag matchen.
  const frei = new Map<string, SeeSchiff[]>();
  for (const s of bestehende) {
    const k = schluessel(s.schiffsname);
    frei.set(k, [...(frei.get(k) ?? []), s]);
  }

  const zeilen: EtaUpdateZeile[] = [];
  const ersetzungen = new Map<number, SeeSchiff>();
  const neue: Omit<SeeSchiff, "id">[] = [];

  for (const neu of ausPdf) {
    const kandidaten = frei.get(schluessel(neu.schiffsname)) ?? [];
    const alt = kandidaten.shift();
    if (!alt) {
      zeilen.push({ typ: "neu", neu, felder: [] });
      neue.push(neu);
      continue;
    }
    if (istVollAbgeteilt(alt)) {
      zeilen.push({ typ: "abgeteilt", neu, alt, felder: [] });
      continue;
    }
    const felder = VERGLEICHSFELDER.filter((f) => feldWert(neu, f) !== feldWert(alt, f));
    // Namensabweichung trotz Match (z.B. gespeichertes "HAVSTRAUM B" gegen
    // "HAVSTRAUM" aus dem PDF): der PDF-Name ist die Quelle — der Eintrag
    // wird beim Übernehmen mit bereinigt.
    const nameNeu = neu.schiffsname.replace(/\s+/g, " ").trim();
    const nameWeichtAb = nameNeu !== alt.schiffsname.replace(/\s+/g, " ").trim();
    if (felder.length === 0 && !nameWeichtAb) {
      zeilen.push({ typ: "unveraendert", neu, alt, felder: [] });
      continue;
    }
    zeilen.push({ typ: "geaendert", neu, alt, felder });
    // Die Vergleichsfelder (und ggf. der bereinigte Name) kommen aus dem
    // PDF, alles Übrige bleibt unangetastet.
    ersetzungen.set(alt.id, {
      ...alt,
      schiffsname: nameNeu,
      eta: neu.eta,
      kategorie: neu.kategorie,
      angemeldet: neu.angemeldet,
      e3st: neu.e3st,
      ehfLotseBenoetigt: neu.ehfLotseBenoetigt,
      doppeldecker: neu.doppeldecker,
    });
  }

  let naechsteId = bestehende.reduce((max, s) => Math.max(max, s.id), 0) + 1;
  const seeSchiffe: SeeSchiff[] = [
    ...bestehende.map((s) => ersetzungen.get(s.id) ?? s),
    ...neue.map((s) => ({ ...s, id: naechsteId++ })),
  ];

  const anzahl = (typ: EtaUpdateTyp) => zeilen.filter((z) => z.typ === typ).length;
  const abgeteilte = zeilen.filter((z) => z.typ === "abgeteilt");
  if (abgeteilte.length > 0) {
    meldungen.push({
      stufe: "alarm",
      text:
        `${abgeteilte.length} Schiff${abgeteilte.length === 1 ? " ist" : "e sind"} auf der Seestation bereits ` +
        `abgeteilt, steh${abgeteilte.length === 1 ? "t" : "en"} aber noch im PDF: ` +
        `${abgeteilte.map((z) => z.alt!.schiffsname).join(", ")} — wird beim Übernehmen nicht verändert`,
    });
  }
  const fehlend = bestehende.filter(
    (s) => !istVollAbgeteilt(s) && !ausPdf.some((n) => schluessel(n.schiffsname) === schluessel(s.schiffsname)),
  );
  if (fehlend.length > 0) {
    meldungen.push({
      stufe: "info",
      text: `${fehlend.length} bestehende${fehlend.length === 1 ? "s" : ""} Schiff${fehlend.length === 1 ? "" : "e"} nicht im PDF (bleib${fehlend.length === 1 ? "t" : "en"} erhalten): ${fehlend.map((s) => s.schiffsname).join(", ")}`,
    });
  }
  meldungen.push({
    stufe: "info",
    text: `Abgleich: ${anzahl("neu")} neu, ${anzahl("geaendert")} aktualisiert, ${anzahl("unveraendert")} unverändert`,
  });

  return { zeilen, seeSchiffe, meldungen };
}
