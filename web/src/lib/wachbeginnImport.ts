/** Wachbeginn-Import (Stufe 2): übersetzt die geparsten PDF-Exporte
 *  (Tafel Brb, Tendertafel/Seestation, optional Törnliste) in die
 *  App-Datenstrukturen — das "Grundgerüst" der neuen Wache.
 *
 *  Regeln laut Einsatzleiter-Spezifikation:
 *  - Tafel ausgehend HH/NOK → Hamburg-/NOK-Liste (Zeiten, Kat. bzw. Ticker
 *    aus Bem.; Platzhalter-Schiffsnamen "HH-n"/"NOK-n", Rest arbeitet der
 *    User nach). Leer-Slots (nur Nr.) werden übersprungen.
 *  - Tafel Anmeldungen → Andere Jobs (Typ-Übersetzung, Datum/Zeit →
 *    Abt.Zeit, Lotsenanzahl nur bei AG-Typen).
 *  - Tafel Lotsenliste → Einsatzstation: Tafel-Nr. = aktuelle Fahrt,
 *    BB-Nr. = Bereitschafts-Reihenfolge, BB "A" = abgerufen (+ Zeit aus
 *    Bem. als "An Stn."), Abrufzeit "x,xh" aus Bem., Zahl hinter dem Namen
 *    = Kat. CB-Lotsen und Lotsen ohne Tafel-/BB-Eintrag bleiben draußen.
 *  - Tendertafel → ETA Seestation (Doppeldecker-Zusammenfassung, EH,
 *    fett = angemeldet) und über den Marker-Abgleich mit dem ersten
 *    Einsatzstations-Lotsen: "letzte V-Nr." + Liste "Auf Seestation"
 *    (fett = bereits auf Station).
 *  - Törnliste → Törnstände der Einsatzstations-Lotsen per Namensabgleich
 *    ("1+1"→2+2, Weser Blau→WB, Weser Rot→WR, Hulo→HuLo).
 *
 *  Alles, was nicht eindeutig auswertbar ist, landet sichtbar in
 *  Bemerkungen bzw. als Warnung in `meldungen` — nichts geht still
 *  verloren. */

import { SCHIFFS_KATEGORIEN } from "@wache/core";
import type { AnmeldungsTyp } from "@wache/core";
import type {
  Abteilung,
  AktuelleFahrt,
  EhEintrag,
  JobEintrag,
  LotsenEintrag,
  SeeSchiff,
  SeestationLotse,
} from "../data/types";
import type { SeestationPdfErgebnis } from "./seestationPdfParse";
import type { TafelBrbErgebnis, TafelSektion } from "./tafelBrbParse";
import type { ToernstaendeErgebnis } from "./toernstaendeParse";

export interface ImportMeldung {
  stufe: "info" | "warnung" | "alarm";
  text: string;
}

export interface WachImport {
  aktuelleFahrt?: AktuelleFahrt;
  letzteVNr?: number;
  jobs: Omit<JobEintrag, "id">[];
  lotsen: LotsenEintrag[];
  seeSchiffe: Omit<SeeSchiff, "id">[];
  seestationLotsen: Omit<SeestationLotse, "id">[];
  /** die als "im Fahrwasser" erkannten Tendertafel-Lotsen (nicht fett) als
   *  reguläre Abteilungen (Schiff "WACHBEGINN", Typ DIV, Herkunft Sonstige,
   *  Abt.Zeit = Beginn der aktuellen Fahrt) — sie laufen damit den normalen
   *  Weg Versetzliste → Seestation. */
  abteilungen: Omit<Abteilung, "id">[];
  meldungen: ImportMeldung[];
  /** verwendeter Marker-Eintrag (Index in tender.eintraege) — automatisch
   *  erkannt oder manuell gewählt; undefined = kein Marker gefunden */
  markerIndex?: number;
}

/**
 * ETA Stn für die im Fahrwasser erkannten Lotsen (Tendertafel, nicht
 * fett): feste Mitte der aktuellen Fahrt — MoFa (06–12) → 09:00, MiFa
 * (12–18) → 15:00, AFA (18–06) → 00:00 des Folgetags. Läuft der Import
 * nach Mitternacht (die AFA hat ihre Mitte schon passiert), ist das die
 * bereits erreichte Mitternacht (heute 00:00). Erspart dem User das
 * Nachtragen der fehlenden ETAs von Hand — die Zeiten bleiben danach
 * normal editierbar.
 */
export function fahrtMitteEta(fahrt: AktuelleFahrt, jetzt: Date): Date {
  const eta = new Date(jetzt);
  eta.setSeconds(0, 0);
  if (fahrt === "MoFa") {
    eta.setHours(9, 0);
  } else if (fahrt === "MiFa") {
    eta.setHours(15, 0);
  } else {
    eta.setHours(0, 0);
    if (jetzt.getHours() >= 12) eta.setDate(eta.getDate() + 1);
  }
  return eta;
}

/**
 * Beginn der aktuellen Fahrt — Abt.Zeit der als Abteilung übernommenen
 * Fahrwasser-Lotsen: MoFa → 06:00, MiFa → 12:00, AFA → 18:00. Läuft der
 * Import nach Mitternacht (die AFA läuft seit dem Vorabend), ist das
 * 18:00 des Vortags.
 */
export function fahrtBeginn(fahrt: AktuelleFahrt, jetzt: Date): Date {
  const beginn = new Date(jetzt);
  beginn.setSeconds(0, 0);
  if (fahrt === "MoFa") {
    beginn.setHours(6, 0);
  } else if (fahrt === "MiFa") {
    beginn.setHours(12, 0);
  } else {
    beginn.setHours(18, 0);
    if (jetzt.getHours() < 12) beginn.setDate(beginn.getDate() - 1);
  }
  return beginn;
}

/** Auswählbare Marker-Kandidaten für den manuellen Fallback: alle
 *  Tendertafel-Einträge mit Lotsenname und lesbarer V-Nr. */
export interface MarkerKandidat {
  index: number;
  vNr: string;
  lotse: string;
}

export function markerKandidaten(tender: SeestationPdfErgebnis): MarkerKandidat[] {
  return tender.eintraege
    .map((e, index) => ({ index, vNr: e.vNr, lotse: trenneNameUndKat(e.lotse).name }))
    .filter((k) => k.lotse !== "" && /^\d+\s*[A-D]?$/i.test(k.vNr));
}

// ---------------------------------------------------------------- Helfer

/** "12:30", "1230" → Stunden/Minuten; sonst null. */
function parseZeit(text: string): { h: number; m: number } | null {
  const m = text.trim().match(/^([01]?\d|2[0-3]):?([0-5]\d)$/);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

/** Uhrzeit ohne Datum: nimmt den Kalendertag (gestern/heute/morgen), der
 *  am dichtesten an "jetzt" liegt — eine 23:50-Zeit kurz nach Mitternacht
 *  gehört z.B. zum Vortag. */
function zeitAmNaechstenTag(h: number, m: number, jetzt: Date): Date {
  let beste: Date | null = null;
  for (const tagesOffset of [-1, 0, 1]) {
    const kandidat = new Date(jetzt);
    kandidat.setDate(kandidat.getDate() + tagesOffset);
    kandidat.setHours(h, m, 0, 0);
    if (!beste || Math.abs(kandidat.getTime() - jetzt.getTime()) < Math.abs(beste.getTime() - jetzt.getTime())) {
      beste = kandidat;
    }
  }
  return beste!;
}

function parseZeitMitTag(text: string, jetzt: Date): Date | undefined {
  const zeit = parseZeit(text);
  return zeit ? zeitAmNaechstenTag(zeit.h, zeit.m, jetzt) : undefined;
}

/** "12.08." + "22:30" → Datum; das Jahr wird so gewählt, dass das Ergebnis
 *  in der Nähe von "jetzt" liegt (Jahreswechsel-sicher). */
function parseDatumZeit(tagMonat: string, zeitText: string, jetzt: Date): Date | undefined {
  const dm = tagMonat.trim().match(/^(\d{1,2})\.(\d{1,2})\.$/);
  const zeit = parseZeit(zeitText) ?? { h: 0, m: 0 };
  if (!dm) return undefined;
  const ergebnis = new Date(jetzt.getFullYear(), Number(dm[2]) - 1, Number(dm[1]), zeit.h, zeit.m);
  const halbesJahr = 182 * 24 * 3_600_000;
  if (ergebnis.getTime() - jetzt.getTime() > halbesJahr) ergebnis.setFullYear(ergebnis.getFullYear() - 1);
  else if (jetzt.getTime() - ergebnis.getTime() > halbesJahr) ergebnis.setFullYear(ergebnis.getFullYear() + 1);
  return ergebnis;
}

/** Schiffskategorie-Text auf die App-Schreibweise normalisieren
 *  ("Agf3+" → "AGF 3+", "AGF3/7" → "AGF 3/7"); unbekannte Texte bleiben
 *  unverändert erhalten. */
function normalisiereSchiffsKat(text: string): string {
  const kompakt = text.replace(/\s+/g, "").toUpperCase();
  for (const kat of SCHIFFS_KATEGORIEN) {
    if (kat.replace(/\s+/g, "").toUpperCase() === kompakt) return kat;
  }
  return text.trim();
}

function istSchiffsKat(text: string): boolean {
  const kompakt = text.replace(/\s+/g, "").toUpperCase();
  return SCHIFFS_KATEGORIEN.some((kat) => kat.replace(/\s+/g, "").toUpperCase() === kompakt);
}

/** Zahl (bzw. "3+") hinter dem Namen = Lotsenkategorie. */
function trenneNameUndKat(roh: string): { name: string; kategorie: string } {
  const m = roh.trim().match(/^(.*?)\s+(3\+|[1-7])$/);
  if (m) return { name: m[1].trim(), kategorie: m[2] };
  return { name: roh.trim(), kategorie: "" };
}

/** Namensabgleich zwischen den drei PDF-Formaten. Die Formate schreiben
 *  Namen unterschiedlich: die Tafel nur den Nachnamen (Vornamens-Kürzel
 *  NUR bei mehrfach vorkommenden Nachnamen, z.B. "Behnke J.H."), die
 *  Törnliste immer Nachname + Kürzel ("Behnke, J"), die Tendertafel
 *  ausgeschriebene Vornamen ("Behnke, Jan-Hinrich"). Deshalb: Nachnamen
 *  müssen übereinstimmen; die Initiale wird NUR verglichen, wenn beide
 *  Seiten eine haben. Punkte/Mehrfach-Leerzeichen stören nicht. */
function zerlegeName(roh: string): { nachname: string; initiale: string } {
  const klein = roh.trim().toLowerCase().replace(/\./g, " ").replace(/\s+/g, " ").trim();
  const m = klein.match(/^([a-zäöüß-]+)(?:[,\s]+([a-zäöüß]))?/);
  return { nachname: m?.[1] ?? klein, initiale: m?.[2] ?? "" };
}

export function passtName(a: string, b: string): boolean {
  const za = zerlegeName(a);
  const zb = zerlegeName(b);
  if (za.nachname !== zb.nachname) return false;
  if (za.initiale === "" || zb.initiale === "") return true;
  return za.initiale === zb.initiale;
}

/** Strenger Namensvergleich für die EH-Liste: der VOLLE Name muss
 *  übereinstimmen — toleriert werden nur Groß-/Kleinschreibung, Punkte
 *  und Leerzeichen-Varianten (z.B. "Thormählen , Björn"). passtName wäre
 *  hier zu locker: es vergleicht nur Nachname + erste Initiale, womit
 *  "Behnke, J-M" und "Behnke, J-H" fälschlich als dieselbe Person
 *  gälten. Die EH-Namen stammen aus demselben Tafel-Export wie die
 *  Einsatzstations-Lotsen, exakte Gleichheit ist daher der richtige
 *  Maßstab. */
export function passtNameGenau(a: string, b: string): boolean {
  const norm = (roh: string) =>
    roh
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/\s*,\s*/g, ", ")
      .replace(/\s+/g, " ")
      .trim();
  return norm(a) === norm(b);
}

function spaltenIndex(sektion: TafelSektion, name: string): number {
  return sektion.spalten.findIndex((s) => s.toLowerCase().replace(/[^a-zäöü+]/g, "").startsWith(name));
}

const FAHRT_MAP: Record<string, AktuelleFahrt> = { mofa: "MoFa", mifa: "MiFa", afa: "AFA" };

const TYP_MAP: Record<string, AnmeldungsTyp> = {
  radar: "Sonderradar",
  sonderradar: "Sonderradar",
  sora: "Sonderradar",
  nebelradar: "Nebelradar",
  nera: "Nebelradar",
  wblau: "WB",
  weserblau: "WB",
  wb: "WB",
  wrot: "WR",
  weserrot: "WR",
  wr: "WR",
  ehf: "EHF",
  bhf: "BHF",
  hulo: "HuLo",
  "1+1": "1+1",
  "2+2": "2+2",
  ag: "AG",
  agtender: "AG (Tender)",
};

// ------------------------------------------------------------ Tafel Brb

function baueHamburgJobs(sektion: TafelSektion | undefined, jetzt: Date, jobs: Omit<JobEintrag, "id">[]) {
  if (!sektion) return;
  const iHh = spaltenIndex(sektion, "hh");
  const iFkw = spaltenIndex(sektion, "fkw");
  const iStade = spaltenIndex(sektion, "stade");
  const iBem = spaltenIndex(sektion, "bem");
  let lfd = 0;
  for (const zeile of sektion.zeilen) {
    const hh = zeile[iHh] ?? "";
    const fkw = zeile[iFkw] ?? "";
    const stade = zeile[iStade] ?? "";
    const bem = zeile[iBem] ?? "";
    if (hh === "" && fkw === "" && stade === "" && bem === "") continue; // Leer-Slot
    lfd += 1;
    const job: Omit<JobEintrag, "id"> = {
      liste: "hamburg",
      schiffsname: `HH-${lfd}`,
      hh: parseZeitMitTag(hh, jetzt),
      fkw: parseZeitMitTag(fkw, jetzt),
      stade: parseZeitMitTag(stade, jetzt),
    };
    if (bem !== "") {
      if (istSchiffsKat(bem)) job.kategorie = normalisiereSchiffsKat(bem);
      else job.bemerkung = bem;
    }
    jobs.push(job);
  }
}

function baueNokJobs(sektion: TafelSektion | undefined, jetzt: Date, jobs: Omit<JobEintrag, "id">[]) {
  if (!sektion) return;
  const iHolt = spaltenIndex(sektion, "holt");
  const iKuden = spaltenIndex(sektion, "kuden");
  const iKat = spaltenIndex(sektion, "kat");
  const iBem = spaltenIndex(sektion, "bem");
  let lfd = 0;
  for (const zeile of sektion.zeilen) {
    const holt = zeile[iHolt] ?? "";
    const kuden = zeile[iKuden] ?? "";
    const kat = zeile[iKat] ?? "";
    const bem = zeile[iBem] ?? "";
    if (holt === "" && kuden === "" && kat === "" && bem === "") continue; // Leer-Slot
    lfd += 1;
    const job: Omit<JobEintrag, "id"> = {
      liste: "nok",
      schiffsname: `NOK-${lfd}`,
      holt: parseZeitMitTag(holt, jetzt),
      kuden: parseZeitMitTag(kuden, jetzt),
    };
    if (kat !== "") job.kategorie = normalisiereSchiffsKat(kat);
    if (bem !== "") {
      const ticker = parseZeitMitTag(bem, jetzt);
      if (ticker) job.ticker = ticker;
      else job.bemerkung = bem;
    }
    jobs.push(job);
  }
}

function baueAndereJobs(
  sektion: TafelSektion | undefined,
  jetzt: Date,
  jobs: Omit<JobEintrag, "id">[],
  meldungen: ImportMeldung[],
) {
  if (!sektion) return;
  const iTyp = spaltenIndex(sektion, "typ");
  const iKat = spaltenIndex(sektion, "kat");
  const iLotse = spaltenIndex(sektion, "lotse");
  const iDatum = spaltenIndex(sektion, "datum");
  for (const zeile of sektion.zeilen) {
    const typText = zeile[iTyp] ?? "";
    const katText = zeile[iKat] ?? "";
    const lotseText = zeile[iLotse] ?? "";
    const datumZeitText = zeile[iDatum] ?? "";
    if (typText === "" && katText === "" && datumZeitText === "") continue;

    const typSchluessel = typText.toLowerCase().replace(/[^a-z0-9+]/g, "");
    const typ = TYP_MAP[typSchluessel];
    const job: Omit<JobEintrag, "id"> = { liste: "andere" };
    if (typ) job.typ = typ;
    else if (typText !== "") job.bemerkung = `Typ: ${typText}`;
    if (katText !== "" && katText !== "-" && katText !== "–") job.kategorie = normalisiereSchiffsKat(katText);

    // "02.08.2026 1659" bzw. "02.08. 16:59" → Abt.Zeit
    const dz = datumZeitText.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})?\s+(\d{1,2}):?(\d{2})$/);
    if (dz) {
      const jahr = dz[3] ? (dz[3].length === 2 ? 2000 + Number(dz[3]) : Number(dz[3])) : jetzt.getFullYear();
      job.abtZeitManuell = new Date(jahr, Number(dz[2]) - 1, Number(dz[1]), Number(dz[4]), Number(dz[5]));
    } else if (datumZeitText !== "") {
      const nurZeit = parseZeitMitTag(datumZeitText, jetzt);
      if (nurZeit) job.abtZeitManuell = nurZeit;
      else meldungen.push({ stufe: "warnung", text: `Anmeldung "${typText}": Zeit "${datumZeitText}" nicht lesbar` });
    }

    // Lotsenanzahl nur bei AG-Typen übernehmen (User-Regel)
    if ((typ === "AG" || typ === "AG (Tender)") && /^\d+$/.test(lotseText)) {
      job.agLotsenAnzahl = Number(lotseText);
    }
    jobs.push(job);
  }
}

interface LotsenImportErgebnis {
  lotsen: LotsenEintrag[];
  uebersprungenCb: number;
  uebersprungenOhne: number;
}

function baueLotsen(
  sektion: TafelSektion | undefined,
  aktuelleFahrt: AktuelleFahrt | undefined,
  jetzt: Date,
  meldungen: ImportMeldung[],
): LotsenImportErgebnis {
  const ergebnis: LotsenImportErgebnis = { lotsen: [], uebersprungenCb: 0, uebersprungenOhne: 0 };
  if (!sektion) return ergebnis;
  const iTafel = spaltenIndex(sektion, "tafel");
  const iCb = spaltenIndex(sektion, "cb");
  const iName = spaltenIndex(sektion, "name");
  const iBb = spaltenIndex(sektion, "bb");
  const iBem = spaltenIndex(sektion, "bem");
  if (iName === -1 || iBb === -1) {
    meldungen.push({ stufe: "warnung", text: "Lotsenliste: Spalten Name/BB nicht gefunden — keine Lotsen übernommen" });
    return ergebnis;
  }

  const fahrtLotsen: { nr: number; lotse: LotsenEintrag }[] = [];
  const abgerufene: LotsenEintrag[] = [];
  const bereitschaft: { nr: number; lotse: LotsenEintrag }[] = [];

  for (const zeile of sektion.zeilen) {
    const tafelText = zeile[iTafel] ?? "";
    const cbText = zeile[iCb] ?? "";
    const nameText = zeile[iName] ?? "";
    const bbText = (zeile[iBb] ?? "").trim();
    const bemText = zeile[iBem] ?? "";
    if (nameText === "") continue;
    if (cbText !== "") {
      ergebnis.uebersprungenCb += 1;
      continue;
    }
    const tafelNr = /^\d+$/.test(tafelText) ? Number(tafelText) : undefined;
    const istAbgerufen = /^a$/i.test(bbText);
    const bbNr = /^\d+$/.test(bbText) ? Number(bbText) : undefined;
    if (tafelNr === undefined && !istAbgerufen && bbNr === undefined) {
      ergebnis.uebersprungenOhne += 1;
      continue;
    }

    const { name, kategorie } = trenneNameUndKat(nameText);
    const lotse: LotsenEintrag = {
      name,
      kategorie,
      fahrt: tafelNr !== undefined && aktuelleFahrt ? aktuelleFahrt : "",
      elbehafen: false,
      toern2Plus2: 0,
      toernWb: 0,
      toernWr: 0,
      toernHulo: 0,
      bemerkung: "",
    };

    // Bem.: Abrufzeit ("1,5h"), bei "A" eine Zeit ("An Stn."), Rest wörtlich
    let rest = bemText;
    const abruf = rest.match(/(\d(?:[.,]\d)?)\s*(?:h|std)\b\.?/i);
    if (abruf) {
      lotse.abrufStunden = Number(abruf[1].replace(",", "."));
      rest = rest.replace(abruf[0], " ");
    }
    if (istAbgerufen) {
      lotse.abgerufen = true;
      const zeitMatch = rest.match(/\b(\d{1,2}:\d{2})\b/);
      if (zeitMatch) {
        lotse.anStationZeit = parseZeitMitTag(zeitMatch[1], jetzt);
        rest = rest.replace(zeitMatch[0], " ");
      }
    }
    if (rest.trim() !== "") lotse.bemerkung = bemText;

    if (tafelNr !== undefined) fahrtLotsen.push({ nr: tafelNr, lotse });
    else if (istAbgerufen) abgerufene.push(lotse);
    else bereitschaft.push({ nr: bbNr!, lotse });
  }

  fahrtLotsen.sort((a, b) => a.nr - b.nr);
  bereitschaft.sort((a, b) => a.nr - b.nr);
  // Reihenfolge: aktuelle Fahrt (Tafel-Nr.), dann abgerufene Bereitschafts-
  // Lotsen (stehen als Nächste an), dann Bereitschaft nach BB-Nr.
  ergebnis.lotsen = [...fahrtLotsen.map((f) => f.lotse), ...abgerufene, ...bereitschaft.map((b) => b.lotse)];
  return ergebnis;
}

// ----------------------------------------------------------- Tendertafel

function parseVNr(text: string): { vNr: number; zusatz?: SeestationLotse["zusatz"] } | null {
  const m = text.trim().match(/^(\d+)\s*([A-D])?$/i);
  if (!m) return null;
  return { vNr: Number(m[1]), zusatz: m[2] ? (m[2].toUpperCase() as SeestationLotse["zusatz"]) : undefined };
}

// ------------------------------------------------------------ Hauptlauf

/** Tendertafel-Einträge → ETA-Seestation-Schiffe. Gemeinsame Basis des
 *  Wachbeginn-Imports und des ETA-Updates (lib/etaUpdate.ts) — beide müssen
 *  identisch mappen (Doppeldecker-Erkennung über doppelte Schiffsnamen,
 *  ETA-Parsing, Kategorie-Normalisierung, E3/St). */
export function seeSchiffeAusTender(
  tender: SeestationPdfErgebnis,
  jetzt: Date,
  meldungen: ImportMeldung[],
): Omit<SeeSchiff, "id">[] {
  const seeSchiffe: Omit<SeeSchiff, "id">[] = [];
  for (let i = 0; i < tender.eintraege.length; i++) {
    const e = tender.eintraege[i];
    const vorheriges = seeSchiffe[seeSchiffe.length - 1];
    if (vorheriges && i > 0 && tender.eintraege[i - 1].schiff === e.schiff && e.schiff !== "") {
      // doppelter Schiffsname = Doppeldecker (2 Lotsen, 1 Schiff)
      vorheriges.doppeldecker = true;
      continue;
    }
    const eta = parseDatumZeit(e.datum, e.zeit, jetzt);
    if (!eta) {
      meldungen.push({ stufe: "warnung", text: `Tendertafel: ETA von "${e.schiff}" nicht lesbar — übersprungen` });
      continue;
    }
    seeSchiffe.push({
      schiffsname: e.schiff,
      eta,
      kategorie: e.kat !== "" ? normalisiereSchiffsKat(e.kat) : undefined,
      angemeldet: e.schiffFett || undefined,
      ehfLotseBenoetigt: e.best === "EH" || undefined,
      // rot hinterlegte Datums-/Zeitzelle in der Tendertafel = E3/St
      e3st: e.e3st || undefined,
    });
  }
  return seeSchiffe;
}

export function baueWachImport(
  tafel: TafelBrbErgebnis,
  tender: SeestationPdfErgebnis,
  toerns: ToernstaendeErgebnis | null,
  jetzt: Date,
  /** manuell gewählter Marker (Index in tender.eintraege) — Fallback, wenn
   *  der automatische Namensabgleich nicht greift oder korrigiert werden
   *  soll */
  markerManuell?: number,
  /** EH-Liste (Seite "EH-Liste"): dauerhaft gemerkte EH-Zugehörigkeiten.
   *  Belegt das EH-Häkchen der Einsatzstations-Lotsen per Namensabgleich
   *  vor — nur die Einsatzstation, und nur als Vorbelegung. */
  ehListe?: EhEintrag[],
): WachImport {
  const meldungen: ImportMeldung[] = [];
  const importDaten: WachImport = {
    jobs: [],
    lotsen: [],
    seeSchiffe: [],
    seestationLotsen: [],
    abteilungen: [],
    meldungen,
  };

  // --- aktuelle Fahrt aus dem Tafel-Kopf --------------------------------
  const fahrtTyp = tafel.meta.fahrt?.typ ?? "";
  const aktuelleFahrt = FAHRT_MAP[fahrtTyp.toLowerCase()];
  if (aktuelleFahrt) {
    importDaten.aktuelleFahrt = aktuelleFahrt;
    meldungen.push({ stufe: "info", text: `Aktuelle Fahrt: ${aktuelleFahrt} (aus Tafel-Kopf "${fahrtTyp}")` });
  } else {
    meldungen.push({
      stufe: "warnung",
      text: `Fahrt "${fahrtTyp}" aus dem Tafel-Kopf nicht zuordenbar — aktuelle Fahrt bleibt unverändert`,
    });
  }

  // --- Jobs -------------------------------------------------------------
  const sektion = (id: string) => tafel.sektionen.find((s) => s.id === id);
  baueHamburgJobs(sektion("ausgehend_hamburg"), jetzt, importDaten.jobs);
  baueNokJobs(sektion("ausgehend_nok"), jetzt, importDaten.jobs);
  baueAndereJobs(sektion("anmeldungen"), jetzt, importDaten.jobs, meldungen);
  const anzahlHh = importDaten.jobs.filter((j) => j.liste === "hamburg").length;
  const anzahlNok = importDaten.jobs.filter((j) => j.liste === "nok").length;
  const anzahlAndere = importDaten.jobs.filter((j) => j.liste === "andere").length;
  meldungen.push({
    stufe: "info",
    text: `Jobs: ${anzahlHh} Hamburg, ${anzahlNok} NOK, ${anzahlAndere} Anmeldungen (Leer-Slots übersprungen)`,
  });

  // --- Lotsenliste → Einsatzstation ------------------------------------
  const lotsenErgebnis = baueLotsen(sektion("lotsenliste"), aktuelleFahrt, jetzt, meldungen);
  importDaten.lotsen = lotsenErgebnis.lotsen;
  const anzahlFahrt = importDaten.lotsen.filter((l) => l.fahrt !== "").length;
  meldungen.push({
    stufe: "info",
    text:
      `Einsatzstation: ${importDaten.lotsen.length} Lotsen übernommen ` +
      `(${anzahlFahrt} aktuelle Fahrt, ${importDaten.lotsen.length - anzahlFahrt} Bereitschaft; ` +
      `übersprungen: ${lotsenErgebnis.uebersprungenCb} CB, ${lotsenErgebnis.uebersprungenOhne} ohne Tafel/BB)`,
  });

  // --- EH-Vorbelegung aus der EH-Liste ---------------------------------
  // Strenger Voll-Namensvergleich: bei Geschwistern wie "Behnke, J-M" /
  // "Behnke, J-H" darf nur der tatsächlich gelistete EH bekommen.
  if (ehListe && ehListe.length > 0) {
    let ehGesetzt = 0;
    for (const lotse of importDaten.lotsen) {
      if (ehListe.some((e) => passtNameGenau(e.name, lotse.name))) {
        lotse.elbehafen = true;
        ehGesetzt += 1;
      }
    }
    if (ehGesetzt > 0) {
      meldungen.push({ stufe: "info", text: `EH-Liste: ${ehGesetzt} Lotsen als EH vorbelegt` });
    }
  }

  // --- Tendertafel → ETA Seestation ------------------------------------
  importDaten.seeSchiffe = seeSchiffeAusTender(tender, jetzt, meldungen);
  const anzahlDoppel = importDaten.seeSchiffe.filter((s) => s.doppeldecker).length;
  const anzahlE3st = importDaten.seeSchiffe.filter((s) => s.e3st).length;
  meldungen.push({
    stufe: "info",
    text:
      `ETA Seestation: ${importDaten.seeSchiffe.length} Schiffe ` +
      `(${anzahlDoppel} Doppeldecker, ${anzahlE3st}× E3/St)`,
  });

  // --- Marker-Abgleich: letzte V-Nr. + "Auf Seestation" -----------------
  // Automatisch: der erste Einsatzstations-Lotse wird per Namensabgleich
  // in der Tendertafel gesucht. Fallback: der User wählt den Marker in der
  // Auswertung manuell aus (markerManuell überstimmt den Abgleich).
  const ersterLotse = importDaten.lotsen[0];
  let markerIndex = markerManuell ?? -1;
  if (markerIndex >= 0) {
    meldungen.push({
      stufe: "info",
      text: `Marker manuell gewählt: ${trenneNameUndKat(tender.eintraege[markerIndex]?.lotse ?? "").name}`,
    });
  } else if (!ersterLotse) {
    meldungen.push({ stufe: "warnung", text: "Keine Einsatzstations-Lotsen — Marker-Abgleich nicht möglich" });
  } else {
    const treffer = tender.eintraege
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.lotse !== "" && passtName(ersterLotse.name, trenneNameUndKat(e.lotse).name));
    if (treffer.length === 1) {
      markerIndex = treffer[0].i;
    } else if (treffer.length > 1) {
      meldungen.push({
        stufe: "warnung",
        text: `Marker-Lotse "${ersterLotse.name}" ist in der Tendertafel mehrdeutig (${treffer.length} Treffer) — bitte den Marker oben in der Auswahlliste manuell wählen`,
      });
    } else {
      meldungen.push({
        stufe: "warnung",
        text: `Marker-Lotse "${ersterLotse.name}" nicht in der Tendertafel gefunden — bitte den Marker oben in der Auswahlliste manuell wählen`,
      });
    }
  }
  {
    if (markerIndex !== -1) {
      importDaten.markerIndex = markerIndex;
      const markerEintrag = tender.eintraege[markerIndex];
      const markerName = trenneNameUndKat(markerEintrag.lotse).name;
      const markerVNr = parseVNr(markerEintrag.vNr);
      if (!markerVNr) {
        meldungen.push({
          stufe: "warnung",
          text: `Marker-Lotse "${markerName}" hat keine lesbare V-Nr. ("${markerEintrag.vNr}")`,
        });
      } else {
        importDaten.letzteVNr = markerVNr.vNr - 1;
        meldungen.push({
          stufe: "info",
          text: `Marker: ${markerName} → V-Nr. ${markerVNr.vNr} — letzte V-Nr. wird ${importDaten.letzteVNr}`,
        });
      }
      for (let i = 0; i < markerIndex; i++) {
        const e = tender.eintraege[i];
        if (e.lotse === "") {
          meldungen.push({
            stufe: "warnung",
            text: `Tendertafel: Eintrag "${e.schiff}" vor dem Marker ohne Lotsen — nicht auf "Auf Seestation" übernommen`,
          });
          continue;
        }
        const { name, kategorie } = trenneNameUndKat(e.lotse);
        const vNr = parseVNr(e.vNr);
        if (!vNr) {
          meldungen.push({
            stufe: "warnung",
            text: `Tendertafel: Lotse "${name}" ohne lesbare V-Nr. ("${e.vNr}") — nicht übernommen`,
          });
          continue;
        }
        // Fahrwasser-Lotsen (nicht fett) werden als reguläre Abteilung
        // angelegt (Schiff "WACHBEGINN", Typ DIV, Herkunft Sonstige,
        // Abt.Zeit = Fahrtbeginn): sie stehen dann in der Versetzliste
        // "Lotsen im Revier", die Ankunft S-Stn rechnet der normale Weg
        // (Sonstige-Offset + Matrix bzw. Pauschale). Ohne erkannte Fahrt
        // (keine Abt.Zeit herleitbar) oder mit Zusatz-V-Nr. ("1234 A" —
        // Abteilungen kennen keinen Zusatz) bleibt es beim bisherigen
        // Seestations-Lotsen mit Fahrt-Mitte als ETA (siehe fahrtMitteEta).
        const aufDemWeg = !e.lotseFett;
        if (aufDemWeg && aktuelleFahrt && vNr.zusatz === undefined) {
          importDaten.abteilungen.push({
            jobId: 0,
            vNr: vNr.vNr,
            typLabel: "DIV",
            schiffsname: "WACHBEGINN",
            lotsenName: name,
            lotsenKategorie: kategorie,
            elbehafen: false,
            abteilZeit: fahrtBeginn(aktuelleFahrt, jetzt),
            seeHerkunft: "SONST",
            wachbeginn: true,
          });
        } else {
          importDaten.seestationLotsen.push({
            vNr: vNr.vNr,
            zusatz: vNr.zusatz,
            name,
            kategorie,
            elbehafen: false,
            aufStation: e.lotseFett || undefined,
            etaStn: aufDemWeg && aktuelleFahrt ? fahrtMitteEta(aktuelleFahrt, jetzt) : undefined,
          });
        }
      }
      const aufStation = importDaten.seestationLotsen.filter((l) => l.aufStation).length;
      const unterwegs = importDaten.seestationLotsen.length - aufStation + importDaten.abteilungen.length;
      meldungen.push({
        stufe: "info",
        text:
          `Auf Seestation: ${aufStation + unterwegs} Lotsen übernommen ` +
          `(${aufStation} bereits auf Station, ${unterwegs} auf dem Weg)`,
      });
      if (importDaten.abteilungen.length > 0 && aktuelleFahrt) {
        const beginn = fahrtBeginn(aktuelleFahrt, jetzt);
        meldungen.push({
          stufe: "info",
          text:
            `${importDaten.abteilungen.length} Lotsen im Fahrwasser als Abteilung "WACHBEGINN" übernommen ` +
            `(Abt.Zeit ${String(beginn.getHours()).padStart(2, "0")}:${String(beginn.getMinutes()).padStart(2, "0")} = Beginn ${aktuelleFahrt}) — Abt.Zeiten bitte in der Versetzliste nachpflegen`,
        });
      }
      const ohneFahrt = importDaten.seestationLotsen.filter((l) => !l.aufStation && l.etaStn === undefined).length;
      if (ohneFahrt > 0) {
        meldungen.push({
          stufe: "warnung",
          text: `Keine aktuelle Fahrt erkannt — ETA Stn der ${ohneFahrt} Lotsen im Fahrwasser bitte von Hand eintragen`,
        });
      }
    }
  }

  // --- Törnstände per Namensabgleich ------------------------------------
  if (toerns && toerns.eintraege.length > 0) {
    const iName = toerns.spalten.findIndex((s) => s.toLowerCase().startsWith("lotse"));
    const i11 = toerns.spalten.findIndex((s) => s.replace(/\s+/g, "") === "1+1");
    const iWb = toerns.spalten.findIndex((s) => s.toLowerCase().includes("blau"));
    const iWr = toerns.spalten.findIndex((s) => s.toLowerCase().includes("rot"));
    const iHulo = toerns.spalten.findIndex((s) => s.toLowerCase().includes("hulo"));
    let gefunden = 0;
    const ohneToern: string[] = [];
    const mehrdeutig: string[] = [];
    for (const lotse of importDaten.lotsen) {
      const treffer = toerns.eintraege.filter((zeile) => passtName(lotse.name, zeile[iName] ?? ""));
      if (treffer.length === 1) {
        const zeile = treffer[0];
        const wert = (i: number) => (i >= 0 && /^\d+$/.test(zeile[i] ?? "") ? Number(zeile[i]) : 0);
        lotse.toern2Plus2 = wert(i11);
        lotse.toernWb = wert(iWb);
        lotse.toernWr = wert(iWr);
        lotse.toernHulo = wert(iHulo);
        gefunden += 1;
      } else if (treffer.length === 0) {
        ohneToern.push(lotse.name);
      } else {
        mehrdeutig.push(lotse.name);
      }
    }
    meldungen.push({
      stufe: "info",
      text: `Törnstände: ${gefunden} von ${importDaten.lotsen.length} Lotsen zugeordnet`,
    });
    if (ohneToern.length > 0) {
      meldungen.push({ stufe: "warnung", text: `Kein Törn-Eintrag gefunden für: ${ohneToern.join(", ")}` });
    }
    if (mehrdeutig.length > 0) {
      meldungen.push({
        stufe: "warnung",
        text: `Törn-Zuordnung mehrdeutig (Name mehrfach in der Törnliste, nicht übernommen): ${mehrdeutig.join(", ")}`,
      });
    }
  } else {
    meldungen.push({ stufe: "info", text: "Keine Törnliste hochgeladen — Törnstände bleiben leer (manuell nachtragen)" });
  }

  return importDaten;
}
