import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getAbteilzeitSettings } from "@wache/core";
import { mockJobs, mockLotsenliste } from "../data/mockData";
import type { AktuelleFahrt, JobEintrag, LotsenEintrag } from "../data/types";
import { abteilzeitVon } from "../lib/coreJob";
import { tauschePositionen, verschiebeHinter } from "../lib/lotsenOrdnung";
import {
  ladeAktuelleFahrt,
  ladeJobIdZaehler,
  ladeJobs,
  ladeLetzteVNr,
  ladeLotsen,
  speichereAktuelleFahrt,
  speichereJobIdZaehler,
  speichereJobs,
  speichereLetzteVNr,
  speichereLotsen,
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
}

const DataContext = createContext<DataContextValue | null>(null);
const settings = getAbteilzeitSettings("Wechsel Tide");

export function DataProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<JobEintrag[]>(() => ladeJobs(mockJobs));
  const [lotsen, setLotsen] = useState<LotsenEintrag[]>(() => ladeLotsen(mockLotsenliste));
  const [aktuelleFahrt, setAktuelleFahrtState] = useState<AktuelleFahrt>(() => ladeAktuelleFahrt("MoFa"));
  const [letzteVNr, setLetzteVNrState] = useState<number>(() => ladeLetzteVNr(0));

  // Persistenter ID-Zähler: einmal vergebene IDs werden nie wiederverwendet,
  // damit spätere Verweise (z.B. AG-Verknüpfung) eindeutig bleiben.
  const naechsteJobId = useRef<number | null>(null);
  if (naechsteJobId.current === null) naechsteJobId.current = ladeJobIdZaehler(jobs);

  useEffect(() => speichereJobs(jobs), [jobs]);
  useEffect(() => speichereLotsen(lotsen), [lotsen]);

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

  const setAktuelleFahrt = useCallback((fahrt: AktuelleFahrt) => {
    setAktuelleFahrtState(fahrt);
    speichereAktuelleFahrt(fahrt);
  }, []);

  const setLetzteVNr = useCallback((wert: number) => {
    setLetzteVNrState(wert);
    speichereLetzteVNr(wert);
  }, []);

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
