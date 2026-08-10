import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getAbteilzeitSettings } from "@wache/core";
import { mockJobs, mockLotsenliste, mockSeeSchiffe } from "../data/mockData";
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
import { abteilzeitVon, setHwBrbAktuell } from "../lib/coreJob";
import { tauschePositionen, verschiebeHinter } from "../lib/lotsenOrdnung";
import {
  ladeAbteilungen,
  ladeAktuelleFahrt,
  ladeANrZaehler,
  ladeHwBrb,
  ladeJobIdZaehler,
  ladeJobs,
  ladeLetzteVNr,
  ladeLotsen,
  ladeSeeAbteilungen,
  ladeSeeSchiffe,
  ladeSeestationLotsen,
  ladeVerbrauchteVNrn,
  ladeVNrStart,
  speichereAbteilungen,
  speichereAktuelleFahrt,
  speichereANrZaehler,
  speichereHwBrb,
  speichereJobIdZaehler,
  speichereJobs,
  speichereLetzteVNr,
  speichereLotsen,
  speichereSeeAbteilungen,
  speichereSeeSchiffe,
  speichereSeestationLotsen,
  speichereVerbrauchteVNrn,
  speichereVNrStart,
} from "./storage";

interface DataContextValue {
  jobs: JobEintrag[];
  lotsen: LotsenEintrag[];
  /** vergibt die interne Job-ID selbst — eine im Eintrag gesetzte id wird ignoriert */
  addJob: (job: JobEintrag) => void;
  updateJob: (id: number, job: JobEintrag) => void;
  deleteJob: (id: number) => void;
  addLotse: (lotse: LotsenEintrag) => void;
  updateLotse: (index: number, lotse: LotsenEintrag) => void;
  deleteLotse: (index: number) => void;
  /** Tauscht die Positionen zweier Lotsen (inkl. gegenseitiger Fahrt-Übernahme) */
  tauscheLotsen: (indexA: number, indexB: number) => void;
  /** Verschiebt den Lotsen an quellIndex hinter den an zielIndex (inkl. Fahrt-Übernahme) */
  verschiebeLotse: (quellIndex: number, zielIndex: number) => void;
  aktuelleFahrt: AktuelleFahrt;
  setAktuelleFahrt: (fahrt: AktuelleFahrt) => void;
  /** letzte vergebene V-Nr. (0–999), Settings-Tab */
  letzteVNr: number;
  setLetzteVNr: (wert: number) => void;
  /** Start-V-Nr. der Lotsen-Liste in der Einsatzplanung — einmalig aus
   *  letzteVNr+1 gebildet, bleibt danach fest bis zu einem künftigen Reset. */
  vNrStart: number;
  /** Versetzliste: alle Abteilungen (Job-Lotse-Verbindungen) */
  abteilungen: Abteilung[];
  /** Teilt den Lotsen (Index in der Lotsenliste) dem Job ab: legt den
   *  Abteilungs-Datensatz an und blendet den Lotsen aus. */
  teileAb: (abteilung: Omit<Abteilung, "id">, lotsenIndex: number) => void;
  /** Macht eine Abteilung rückgängig: entfernt den Datensatz und blendet
   *  den Lotsen wieder ein. */
  macheAbteilungRueckgaengig: (id: number) => void;
  /** Ändert einzelne Felder einer Abteilung (z.B. aufSeestation, ETA Stn) */
  updateAbteilung: (id: number, aenderung: Partial<Abteilung>) => void;
  /** Persistente Liste bereits per teileAb vergebener V-Nrn — bleibt auch
   *  nach Verschieben (Seestation) oder Rückgängig verbraucht, bis zu einem
   *  künftigen Reset. */
  verbrauchteVNrn: number[];
  /** Seestation: Schiffe von See (Liste "ETAs Seestation") */
  seeSchiffe: SeeSchiff[];
  addSeeSchiff: (schiff: Omit<SeeSchiff, "id">) => void;
  updateSeeSchiff: (id: number, schiff: SeeSchiff) => void;
  deleteSeeSchiff: (id: number) => void;
  /** Seestation: manuell hinzugefügte Lotsen (nur auf dieser Liste) */
  seestationLotsen: SeestationLotse[];
  addSeestationLotse: (lotse: Omit<SeestationLotse, "id">) => void;
  updateSeestationLotse: (id: number, aenderung: Partial<SeestationLotse>) => void;
  deleteSeestationLotse: (id: number) => void;
  /** Versetzliste Seestation: alle SeeAbteilungen (Schiff-Lotse-Verbindungen) */
  seeAbteilungen: SeeAbteilung[];
  /** Teilt den Lotsen (Abteilung oder SeestationLotse) dem See-Schiff ab:
   *  legt den SeeAbteilung-Datensatz mit neuer A-Nr. an und blendet den
   *  Quell-Lotsen aus "Auf Seestation" aus. */
  teileSeeAb: (
    seeAbteilung: Omit<SeeAbteilung, "id" | "aNr">,
    lotsenQuelle: "abteilung" | "manuell",
    lotsenId: number,
  ) => void;
  /** Macht eine SeeAbteilung rückgängig: entfernt den Datensatz und blendet
   *  den Quell-Lotsen wieder in "Auf Seestation" ein. */
  macheSeeAbteilungRueckgaengig: (id: number) => void;
  /** Reset (Settings): leert ALLE Listen (Jobs, Lotsen, Abteilungen,
   *  See-Schiffe, Seestation-Lotsen, SeeAbteilungen, verbrauchte V-Nrn)
   *  und setzt die Zähler zurück — die V-Nr.-Zählung beginnt wieder bei
   *  "letzte V-Nr." + 1. Die Einstellungen selbst (letzte V-Nr., aktuelle
   *  Fahrt, Alarm-Ton) bleiben erhalten. */
  resetAlles: () => void;
  /** HW-Paar Brunsbüttel (Settings) für die matrixbasierte Brb-Prognose der
   *  HH-Jobs. Ohne HW_1 rechnen alle HH-Jobs mit den festen Offsets. */
  hwBrb: HwBrbEingabe;
  setHwBrb: (hwBrb: HwBrbEingabe) => void;
}

const DataContext = createContext<DataContextValue | null>(null);
const settings = getAbteilzeitSettings("Wechsel Tide");

export function DataProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<JobEintrag[]>(() => ladeJobs(mockJobs));
  const [lotsen, setLotsen] = useState<LotsenEintrag[]>(() => ladeLotsen(mockLotsenliste));
  const [aktuelleFahrt, setAktuelleFahrtState] = useState<AktuelleFahrt>(() => ladeAktuelleFahrt("MoFa"));
  const [letzteVNr, setLetzteVNrState] = useState<number>(() => ladeLetzteVNr(0));
  const [vNrStart, setVNrStartState] = useState<number>(() => ladeVNrStart(letzteVNr));
  const [abteilungen, setAbteilungen] = useState<Abteilung[]>(() => ladeAbteilungen());
  const [seeSchiffe, setSeeSchiffe] = useState<SeeSchiff[]>(() => ladeSeeSchiffe(mockSeeSchiffe));
  const [seestationLotsen, setSeestationLotsen] = useState<SeestationLotse[]>(() => ladeSeestationLotsen());
  const [seeAbteilungen, setSeeAbteilungen] = useState<SeeAbteilung[]>(() => ladeSeeAbteilungen());
  const [verbrauchteVNrn, setVerbrauchteVNrn] = useState<number[]>(() => ladeVerbrauchteVNrn());
  const [hwBrb, setHwBrbState] = useState<HwBrbEingabe>(() => ladeHwBrb());

  // Das HW-Paar fließt über ein Modul-Singleton in alle abteilzeitVon-
  // Aufrufstellen (siehe coreJob.ts). Direkt im Render gesetzt (idempotent),
  // damit es garantiert VOR dem Rendern der Kinder aktuell ist — ein
  // useEffect liefe erst NACH deren Render, die Kinder würden also einmal
  // mit dem veralteten Wert rechnen.
  setHwBrbAktuell(hwBrb);

  // Persistenter ID-Zähler: einmal vergebene IDs werden nie wiederverwendet,
  // damit spätere Verweise (z.B. AG-Verknüpfung) eindeutig bleiben.
  const naechsteJobId = useRef<number | null>(null);
  if (naechsteJobId.current === null) naechsteJobId.current = ladeJobIdZaehler(jobs);
  // Persistenter A-Nr.-Zähler (Versetzliste Seestation) — analog zur Job-ID,
  // startet bei 1000, wird nie wiederverwendet.
  const naechsteANr = useRef<number | null>(null);
  if (naechsteANr.current === null) naechsteANr.current = ladeANrZaehler(seeAbteilungen);

  useEffect(() => speichereJobs(jobs), [jobs]);
  useEffect(() => speichereLotsen(lotsen), [lotsen]);
  useEffect(() => speichereAbteilungen(abteilungen), [abteilungen]);
  useEffect(() => speichereSeeSchiffe(seeSchiffe), [seeSchiffe]);
  useEffect(() => speichereSeestationLotsen(seestationLotsen), [seestationLotsen]);
  useEffect(() => speichereSeeAbteilungen(seeAbteilungen), [seeAbteilungen]);
  useEffect(() => speichereVerbrauchteVNrn(verbrauchteVNrn), [verbrauchteVNrn]);

  const addJob = useCallback((job: JobEintrag) => {
    const id = naechsteJobId.current!;
    naechsteJobId.current = id + 1;
    speichereJobIdZaehler(naechsteJobId.current);
    setJobs((prev) => [...prev, { ...job, id }]);
  }, []);
  const updateJob = useCallback((id: number, job: JobEintrag) => {
    setJobs((prev) => {
      const aktualisiert = prev.map((j) => (j.id === id ? { ...job, id } : j));
      // Kaskade: AG-Jobs, die mit diesem Job verknüpft sind, übernehmen dessen
      // (neu berechnete) Abteilzeit — Hamburg/NOK-Jobs können selbst nicht
      // AG-verknüpft sein, daher keine Rekursionsgefahr.
      if (job.liste === "andere") return aktualisiert;
      const neueAbteilzeit = abteilzeitVon({ ...job, id }, settings);
      return aktualisiert.map((j) =>
        j.liste === "andere" && j.typ === "AG" && j.agJobId === id ? { ...j, abtZeitManuell: neueAbteilzeit } : j,
      );
    });
  }, []);
  const deleteJob = useCallback((id: number) => setJobs((prev) => prev.filter((j) => j.id !== id)), []);

  const addLotse = useCallback((lotse: LotsenEintrag) => setLotsen((prev) => [...prev, lotse]), []);
  const updateLotse = useCallback(
    (index: number, lotse: LotsenEintrag) => setLotsen((prev) => prev.map((l, i) => (i === index ? lotse : l))),
    [],
  );
  const deleteLotse = useCallback((index: number) => setLotsen((prev) => prev.filter((_, i) => i !== index)), []);
  const tauscheLotsen = useCallback(
    (indexA: number, indexB: number) => setLotsen((prev) => tauschePositionen(prev, indexA, indexB)),
    [],
  );
  const verschiebeLotse = useCallback(
    (quellIndex: number, zielIndex: number) => setLotsen((prev) => verschiebeHinter(prev, quellIndex, zielIndex)),
    [],
  );

  const teileAb = useCallback((abteilung: Omit<Abteilung, "id">, lotsenIndex: number) => {
    setAbteilungen((prev) => {
      const id = prev.reduce((max, a) => Math.max(max, a.id), 0) + 1;
      return [...prev, { ...abteilung, id }];
    });
    setLotsen((prev) => prev.map((l, i) => (i === lotsenIndex ? { ...l, abgeteilt: true } : l)));
    // V-Nr. dauerhaft als verbraucht markieren — bleibt es auch, wenn die
    // Abteilung später rückgängig gemacht oder ihre vNr durch Verschieben
    // (Seestation) geändert wird.
    if (abteilung.vNr !== undefined) {
      const vNr = abteilung.vNr;
      setVerbrauchteVNrn((prev) => (prev.includes(vNr) ? prev : [...prev, vNr]));
    }
  }, []);

  const macheAbteilungRueckgaengig = useCallback(
    (id: number) => {
      const abteilung = abteilungen.find((a) => a.id === id);
      setAbteilungen((prev) => prev.filter((a) => a.id !== id));
      if (!abteilung) return;
      // Lotse über den Namen wiederfinden — Indizes können sich seit dem
      // Abteilen verschoben haben (z.B. durch Löschen anderer Lotsen).
      setLotsen((prev) => {
        const index = prev.findIndex((l) => l.name === abteilung.lotsenName && l.abgeteilt);
        return index === -1 ? prev : prev.map((l, i) => (i === index ? { ...l, abgeteilt: false } : l));
      });
    },
    [abteilungen],
  );

  const updateAbteilung = useCallback((id: number, aenderung: Partial<Abteilung>) => {
    setAbteilungen((prev) => prev.map((a) => (a.id === id ? { ...a, ...aenderung, id } : a)));
  }, []);

  const addSeeSchiff = useCallback((schiff: Omit<SeeSchiff, "id">) => {
    setSeeSchiffe((prev) => {
      const id = prev.reduce((max, s) => Math.max(max, s.id), 0) + 1;
      return [...prev, { ...schiff, id }];
    });
  }, []);
  const updateSeeSchiff = useCallback((id: number, schiff: SeeSchiff) => {
    setSeeSchiffe((prev) => prev.map((s) => (s.id === id ? { ...schiff, id } : s)));
  }, []);
  const deleteSeeSchiff = useCallback((id: number) => setSeeSchiffe((prev) => prev.filter((s) => s.id !== id)), []);

  const addSeestationLotse = useCallback((lotse: Omit<SeestationLotse, "id">) => {
    setSeestationLotsen((prev) => {
      const id = prev.reduce((max, l) => Math.max(max, l.id), 0) + 1;
      return [...prev, { ...lotse, id }];
    });
  }, []);
  const updateSeestationLotse = useCallback((id: number, aenderung: Partial<SeestationLotse>) => {
    setSeestationLotsen((prev) => prev.map((l) => (l.id === id ? { ...l, ...aenderung, id } : l)));
  }, []);
  const deleteSeestationLotse = useCallback(
    (id: number) => setSeestationLotsen((prev) => prev.filter((l) => l.id !== id)),
    [],
  );

  const teileSeeAb = useCallback(
    (seeAbteilung: Omit<SeeAbteilung, "id" | "aNr">, lotsenQuelle: "abteilung" | "manuell", lotsenId: number) => {
      const aNr = naechsteANr.current!;
      naechsteANr.current = aNr + 1;
      speichereANrZaehler(naechsteANr.current);
      setSeeAbteilungen((prev) => {
        const id = prev.reduce((max, a) => Math.max(max, a.id), 0) + 1;
        return [...prev, { ...seeAbteilung, id, aNr }];
      });
      if (lotsenQuelle === "abteilung") {
        setAbteilungen((prev) => prev.map((a) => (a.id === lotsenId ? { ...a, seeAbgeteilt: true } : a)));
      } else {
        setSeestationLotsen((prev) => prev.map((l) => (l.id === lotsenId ? { ...l, seeAbgeteilt: true } : l)));
      }
    },
    [],
  );

  const macheSeeAbteilungRueckgaengig = useCallback(
    (id: number) => {
      const seeAbteilung = seeAbteilungen.find((a) => a.id === id);
      setSeeAbteilungen((prev) => prev.filter((a) => a.id !== id));
      if (!seeAbteilung) return;
      if (seeAbteilung.lotsenQuelle === "abteilung") {
        setAbteilungen((prev) =>
          prev.map((a) => (a.id === seeAbteilung.lotsenId ? { ...a, seeAbgeteilt: false } : a)),
        );
      } else {
        setSeestationLotsen((prev) =>
          prev.map((l) => (l.id === seeAbteilung.lotsenId ? { ...l, seeAbgeteilt: false } : l)),
        );
      }
    },
    [seeAbteilungen],
  );

  const setAktuelleFahrt = useCallback((fahrt: AktuelleFahrt) => {
    setAktuelleFahrtState(fahrt);
    speichereAktuelleFahrt(fahrt);
  }, []);

  const setLetzteVNr = useCallback((wert: number) => {
    setLetzteVNrState(wert);
    speichereLetzteVNr(wert);
  }, []);

  const setHwBrb = useCallback((wert: HwBrbEingabe) => {
    setHwBrbState(wert);
    speichereHwBrb(wert);
  }, []);

  // Reset: alle Listen leeren, Zähler zurücksetzen. Die ID-/A-Nr.-Zähler
  // dürfen NUR deshalb neu starten, weil alle Listen, die auf sie
  // verweisen (Jobs, Abteilungen, SeeAbteilungen), im selben Schritt
  // geleert werden. Die Einstellungen (letzte V-Nr., aktuelle Fahrt,
  // Alarm-Ton) bleiben unangetastet.
  const resetAlles = useCallback(() => {
    setJobs([]);
    setLotsen([]);
    setAbteilungen([]);
    setSeeSchiffe([]);
    setSeestationLotsen([]);
    setSeeAbteilungen([]);
    setVerbrauchteVNrn([]);
    const neuerStart = letzteVNr + 1;
    setVNrStartState(neuerStart);
    speichereVNrStart(neuerStart);
    naechsteJobId.current = 1;
    speichereJobIdZaehler(1);
    naechsteANr.current = 1000;
    speichereANrZaehler(1000);
  }, [letzteVNr]);

  return (
    <DataContext.Provider
      value={{
        jobs,
        lotsen,
        addJob,
        updateJob,
        deleteJob,
        addLotse,
        updateLotse,
        deleteLotse,
        tauscheLotsen,
        verschiebeLotse,
        aktuelleFahrt,
        setAktuelleFahrt,
        letzteVNr,
        setLetzteVNr,
        hwBrb,
        setHwBrb,
        vNrStart,
        abteilungen,
        teileAb,
        macheAbteilungRueckgaengig,
        updateAbteilung,
        verbrauchteVNrn,
        seeSchiffe,
        addSeeSchiff,
        updateSeeSchiff,
        deleteSeeSchiff,
        seestationLotsen,
        addSeestationLotse,
        updateSeestationLotse,
        deleteSeestationLotse,
        seeAbteilungen,
        teileSeeAb,
        macheSeeAbteilungRueckgaengig,
        resetAlles,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData() muss innerhalb von <DataProvider> aufgerufen werden");
  return ctx;
}
