/** localStorage-Persistenz für die manuell gepflegten Jobs/Lotsen-Daten.
 *  Date-Felder werden bei JSON.stringify automatisch zu ISO-Strings und
 *  müssen beim Laden wieder in Date-Objekte zurückverwandelt werden. */
import type {
  Abteilung,
  AktuelleFahrt,
  HwBrbEingabe,
  JobEintrag,
  LotsenEintrag,
  SeeAbteilung,
  SeeSchiff,
  SeestationLotse,
} from "../data/types";

// v3: interne Job-ID (id) statt jobNr, AG-Verknüpfung über agJobId.
const JOBS_KEY = "wache.jobs.v3";
const JOBS_KEY_V2 = "wache.jobs.v2";
// v3: Fahrt/Abrufzeit/Törn-Zähler statt manueller Tafel/CB/BB-Textfelder.
const LOTSEN_KEY = "wache.lotsen.v3";
const LOTSEN_KEY_V2 = "wache.lotsen.v2";
const JOB_ID_ZAEHLER_KEY = "wache.jobid.v1";
const AKTUELLE_FAHRT_KEY = "wache.aktuelleFahrt.v1";
const LETZTE_V_NR_KEY = "wache.letzteVNr.v1";
const V_NR_START_KEY = "wache.vNrStart.v1";
const ABTEILUNGEN_KEY = "wache.abteilungen.v1";
const SEE_SCHIFFE_KEY = "wache.seeschiffe.v1";
const SEESTATION_LOTSEN_KEY = "wache.seestationLotsen.v1";
const SEE_ABTEILUNGEN_KEY = "wache.seeAbteilungen.v1";
const A_NR_ZAEHLER_KEY = "wache.aNrZaehler.v1";
const VERBRAUCHTE_V_NR_KEY = "wache.verbrauchteVNrn.v1";
const VORSCHAU_KEY = "wache.vorschau.v1";
const ALARM_TON_KEY = "wache.alarmTon.v1";
const HW_BRB_KEY = "wache.hwBrb.v1";
const THEME_KEY = "wache.theme.v1";

const JOB_DATUM_FELDER = [
  "hh",
  "fkw",
  "stade",
  "geplAbgang",
  "holt",
  "ticker",
  "kuden",
  "ehfBestAbgang",
  "bhfBesetzZeit",
  "abtZeitManuell",
] as const;

function jobsAusJson(raw: string): JobEintrag[] {
  const eintraege = JSON.parse(raw) as Record<string, unknown>[];
  return eintraege.map((eintrag) => {
    const job: Record<string, unknown> = { ...eintrag };
    // Migration v2 -> v3: jobNr/agJobNr hießen früher anders
    if (job.id === undefined) job.id = job.jobNr;
    if (job.agJobId === undefined && job.agJobNr !== undefined) job.agJobId = job.agJobNr;
    delete job.jobNr;
    delete job.agJobNr;
    for (const feld of JOB_DATUM_FELDER) {
      const wert = eintrag[feld];
      job[feld] = typeof wert === "string" ? new Date(wert) : undefined;
    }
    return job as unknown as JobEintrag;
  });
}

export function ladeJobs(fallback: JobEintrag[]): JobEintrag[] {
  const raw = localStorage.getItem(JOBS_KEY) ?? localStorage.getItem(JOBS_KEY_V2);
  if (!raw) return fallback;
  try {
    return jobsAusJson(raw);
  } catch {
    return fallback;
  }
}

export function speichereJobs(jobs: JobEintrag[]): void {
  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
}

/** Nächste zu vergebende Job-ID: gespeicherter Zähler, sonst max(id)+1 der
 *  geladenen Jobs — so bleiben IDs auch nach Löschungen eindeutig. */
export function ladeJobIdZaehler(jobs: JobEintrag[]): number {
  const raw = localStorage.getItem(JOB_ID_ZAEHLER_KEY);
  const gespeichert = raw ? Number(raw) : Number.NaN;
  const mindestens = jobs.reduce((max, j) => Math.max(max, j.id), 0) + 1;
  return Number.isInteger(gespeichert) ? Math.max(gespeichert, mindestens) : mindestens;
}

export function speichereJobIdZaehler(wert: number): void {
  localStorage.setItem(JOB_ID_ZAEHLER_KEY, String(wert));
}

function lotsenAusJson(raw: string): LotsenEintrag[] {
  const eintraege = JSON.parse(raw) as Record<string, unknown>[];
  return eintraege.map((eintrag) => {
    const lotse: Record<string, unknown> = { ...eintrag };
    const wert = eintrag.anStationZeit;
    lotse.anStationZeit = typeof wert === "string" ? new Date(wert) : undefined;
    return lotse as unknown as LotsenEintrag;
  });
}

export function ladeLotsen(fallback: LotsenEintrag[]): LotsenEintrag[] {
  const rawV3 = localStorage.getItem(LOTSEN_KEY);
  if (rawV3) {
    try {
      return lotsenAusJson(rawV3);
    } catch {
      return fallback;
    }
  }
  // Migration v2 -> v3: Tafel/CB/BB entfallen (Fahrt#/BB werden jetzt aus
  // der Fahrt-Zuweisung berechnet), bem -> bemerkung, Rest defaultet.
  const rawV2 = localStorage.getItem(LOTSEN_KEY_V2);
  if (!rawV2) return fallback;
  try {
    const eintraege = JSON.parse(rawV2) as { name: string; kategorie?: string; bem?: string }[];
    return eintraege.map((eintrag) => ({
      name: eintrag.name,
      kategorie: eintrag.kategorie ?? "",
      fahrt: "",
      abrufStunden: undefined,
      elbehafen: false,
      toern2Plus2: 0,
      toernWb: 0,
      toernWr: 0,
      toernHulo: 0,
      bemerkung: eintrag.bem ?? "",
    }));
  } catch {
    return fallback;
  }
}

export function speichereLotsen(lotsen: LotsenEintrag[]): void {
  localStorage.setItem(LOTSEN_KEY, JSON.stringify(lotsen));
}

/** Rückgängig-Schnappschuss für "Fahrt erstellen" (Fahrt-Planung): der
 *  komplette Lotsen-Bestand + die aktuelle Fahrt unmittelbar VOR dem
 *  Umbau. Eine Stufe tief — ein neues "Fahrt erstellen" überschreibt den
 *  vorherigen Schnappschuss. */
const FAHRT_RUECKGAENGIG_KEY = "wache.fahrtRueckgaengig.v1";

export interface FahrtRueckgaengig {
  lotsen: LotsenEintrag[];
  aktuelleFahrt: AktuelleFahrt;
  /** der komplette localStorage-Zustand der Fahrt-Planungs-Seite vor dem
   *  Umbau (deren eigenes Gespeichert-Format) — die Seite stellt ihn beim
   *  Rückgängig selbst wieder her. */
  fahrtPlanung?: unknown;
}

export function speichereFahrtRueckgaengig(daten: FahrtRueckgaengig): void {
  localStorage.setItem(FAHRT_RUECKGAENGIG_KEY, JSON.stringify(daten));
}

export function ladeFahrtRueckgaengig(): FahrtRueckgaengig | undefined {
  const raw = localStorage.getItem(FAHRT_RUECKGAENGIG_KEY);
  if (!raw) return undefined;
  try {
    const daten = JSON.parse(raw) as { lotsen: unknown; aktuelleFahrt: AktuelleFahrt; fahrtPlanung?: unknown };
    return {
      lotsen: lotsenAusJson(JSON.stringify(daten.lotsen)),
      aktuelleFahrt: daten.aktuelleFahrt,
      fahrtPlanung: daten.fahrtPlanung,
    };
  } catch {
    return undefined;
  }
}

export function loescheFahrtRueckgaengig(): void {
  localStorage.removeItem(FAHRT_RUECKGAENGIG_KEY);
}

export function ladeAbteilungen(): Abteilung[] {
  const raw = localStorage.getItem(ABTEILUNGEN_KEY);
  if (!raw) return [];
  try {
    const eintraege = JSON.parse(raw) as Record<string, unknown>[];
    return eintraege.map((eintrag) => {
      const abteilung: Record<string, unknown> = { ...eintrag };
      const wert = eintrag.abteilZeit;
      abteilung.abteilZeit = typeof wert === "string" ? new Date(wert) : new Date(0);
      const eta = eintrag.etaStnManuell;
      abteilung.etaStnManuell = typeof eta === "string" ? new Date(eta) : undefined;
      return abteilung as unknown as Abteilung;
    });
  } catch {
    return [];
  }
}

export function speichereAbteilungen(abteilungen: Abteilung[]): void {
  localStorage.setItem(ABTEILUNGEN_KEY, JSON.stringify(abteilungen));
}

/** Generischer Lader für Listen mit genau einem Date-Feld. */
function ladeListeMitDatum<T>(key: string, datumsFeld: string, fallback: T[]): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    const eintraege = JSON.parse(raw) as Record<string, unknown>[];
    return eintraege.map((eintrag) => {
      const kopie: Record<string, unknown> = { ...eintrag };
      const wert = eintrag[datumsFeld];
      kopie[datumsFeld] = typeof wert === "string" ? new Date(wert) : undefined;
      return kopie as unknown as T;
    });
  } catch {
    return fallback;
  }
}

export function ladeSeeSchiffe(fallback: SeeSchiff[]): SeeSchiff[] {
  return ladeListeMitDatum(SEE_SCHIFFE_KEY, "eta", fallback);
}

export function speichereSeeSchiffe(schiffe: SeeSchiff[]): void {
  localStorage.setItem(SEE_SCHIFFE_KEY, JSON.stringify(schiffe));
}

export function ladeSeestationLotsen(): SeestationLotse[] {
  return ladeListeMitDatum(SEESTATION_LOTSEN_KEY, "etaStn", []);
}

export function speichereSeestationLotsen(lotsen: SeestationLotse[]): void {
  localStorage.setItem(SEESTATION_LOTSEN_KEY, JSON.stringify(lotsen));
}

export function ladeAktuelleFahrt(fallback: AktuelleFahrt): AktuelleFahrt {
  const raw = localStorage.getItem(AKTUELLE_FAHRT_KEY);
  return raw === "MoFa" || raw === "MiFa" || raw === "AFA" ? raw : fallback;
}

export function speichereAktuelleFahrt(fahrt: AktuelleFahrt): void {
  localStorage.setItem(AKTUELLE_FAHRT_KEY, fahrt);
}

export function ladeLetzteVNr(fallback: number): number {
  const raw = localStorage.getItem(LETZTE_V_NR_KEY);
  const wert = raw !== null ? Number(raw) : Number.NaN;
  return Number.isInteger(wert) && wert >= 0 && wert <= 999 ? wert : fallback;
}

export function speichereLetzteVNr(wert: number): void {
  localStorage.setItem(LETZTE_V_NR_KEY, String(wert));
}

/** Start-V-Nr. der Lotsen-Liste in der Einsatzplanung: wird beim ersten
 *  Aufruf einmalig aus "letzte V-Nr." + 1 gebildet und danach fest
 *  gespeichert — ändert sich nicht mehr automatisch mit, auch wenn die
 *  Settings-Wert später geändert wird. Erst ein Reset (noch nicht gebaut)
 *  soll ihn neu setzen. */
export function ladeVNrStart(letzteVNr: number): number {
  const raw = localStorage.getItem(V_NR_START_KEY);
  const gespeichert = raw !== null ? Number(raw) : Number.NaN;
  if (Number.isInteger(gespeichert)) return gespeichert;
  const start = letzteVNr + 1;
  localStorage.setItem(V_NR_START_KEY, String(start));
  return start;
}

/** Setzt die Start-V-Nr. neu — Teil des Resets (Settings): danach beginnt
 *  die Zählung wieder bei "letzte V-Nr." + 1. */
export function speichereVNrStart(wert: number): void {
  localStorage.setItem(V_NR_START_KEY, String(wert));
}

export function ladeSeeAbteilungen(): SeeAbteilung[] {
  return ladeListeMitDatum(SEE_ABTEILUNGEN_KEY, "abteilZeit", []);
}

export function speichereSeeAbteilungen(seeAbteilungen: SeeAbteilung[]): void {
  localStorage.setItem(SEE_ABTEILUNGEN_KEY, JSON.stringify(seeAbteilungen));
}

/** Nächste zu vergebende A-Nr.: gespeicherter Zähler, sonst max(aNr)+1 der
 *  geladenen SeeAbteilungen bzw. 1000 als Start — bleibt wie die Job-ID
 *  auch nach Rückgängig/Löschungen eindeutig und wird nie wiederverwendet. */
export function ladeANrZaehler(seeAbteilungen: SeeAbteilung[]): number {
  const raw = localStorage.getItem(A_NR_ZAEHLER_KEY);
  const gespeichert = raw ? Number(raw) : Number.NaN;
  const mindestens = seeAbteilungen.reduce((max, a) => Math.max(max, a.aNr), 999) + 1;
  return Number.isInteger(gespeichert) ? Math.max(gespeichert, mindestens) : mindestens;
}

export function speichereANrZaehler(wert: number): void {
  localStorage.setItem(A_NR_ZAEHLER_KEY, String(wert));
}

/** Persistente Liste bereits per Einsatzplanung-Abteilen vergebener V-Nrn.
 *  Append-only: eine V-Nr. bleibt hier auch dann verbraucht, wenn sich das
 *  vNr-Feld der zugehörigen Abteilung später ändert (z.B. durch Verschieben
 *  auf der Seestation) oder die Abteilung rückgängig gemacht wird. Erst ein
 *  künftiges Reset setzt diese Liste wieder auf leer zurück. */
export function ladeVerbrauchteVNrn(): number[] {
  const raw = localStorage.getItem(VERBRAUCHTE_V_NR_KEY);
  if (!raw) return [];
  try {
    const werte = JSON.parse(raw) as unknown[];
    return werte.filter((w): w is number => typeof w === "number");
  } catch {
    return [];
  }
}

export function speichereVerbrauchteVNrn(vNrn: number[]): void {
  localStorage.setItem(VERBRAUCHTE_V_NR_KEY, JSON.stringify(vNrn));
}

export function ladeHwBrb(): HwBrbEingabe {
  const raw = localStorage.getItem(HW_BRB_KEY);
  if (!raw) return {};
  try {
    const wert = JSON.parse(raw) as Record<string, unknown>;
    return {
      hw1: typeof wert.hw1 === "string" ? new Date(wert.hw1) : undefined,
      hw2: typeof wert.hw2 === "string" ? new Date(wert.hw2) : undefined,
    };
  } catch {
    return {};
  }
}

export function speichereHwBrb(hwBrb: HwBrbEingabe): void {
  localStorage.setItem(HW_BRB_KEY, JSON.stringify(hwBrb));
}

/** Vorschau-Schalter (Seestation + Dashboard) — geteilt, damit beide
 *  dieselbe Projektion zeigen, und über einen Neuladen hinweg stabil. */
export function ladeVorschauAktiv(): boolean {
  return localStorage.getItem(VORSCHAU_KEY) === "1";
}

export function speichereVorschauAktiv(aktiv: boolean): void {
  localStorage.setItem(VORSCHAU_KEY, aktiv ? "1" : "0");
}

export function ladeAlarmTonAktiv(): boolean {
  return localStorage.getItem(ALARM_TON_KEY) === "1";
}

export function speichereAlarmTonAktiv(aktiv: boolean): void {
  localStorage.setItem(ALARM_TON_KEY, aktiv ? "1" : "0");
}

/** Tag/Nacht-Umschalter (Uhr-Kachel): undefined = noch nicht manuell
 *  gewählt, dann gilt weiterhin die Systemeinstellung (prefers-color-scheme,
 *  siehe index.html/index.css). Erst ein Klick legt sich fest. */
export function ladeTheme(): "hell" | "dunkel" | undefined {
  const wert = localStorage.getItem(THEME_KEY);
  return wert === "hell" || wert === "dunkel" ? wert : undefined;
}

export function speichereTheme(wert: "hell" | "dunkel"): void {
  localStorage.setItem(THEME_KEY, wert);
}
