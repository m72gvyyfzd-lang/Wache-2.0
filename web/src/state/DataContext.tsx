import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { mockJobs, mockLotsenliste } from "../data/mockData";
import type { AktuelleFahrt, JobEintrag, LotsenEintrag } from "../data/types";
import {
  ladeAktuelleFahrt,
  ladeJobIdZaehler,
  ladeJobs,
  ladeLotsen,
  speichereAktuelleFahrt,
  speichereJobIdZaehler,
  speichereJobs,
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
  aktuelleFahrt: AktuelleFahrt;
  setAktuelleFahrt: (fahrt: AktuelleFahrt) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<JobEintrag[]>(() => ladeJobs(mockJobs));
  const [lotsen, setLotsen] = useState<LotsenEintrag[]>(() => ladeLotsen(mockLotsenliste));
  const [aktuelleFahrt, setAktuelleFahrtState] = useState<AktuelleFahrt>(() => ladeAktuelleFahrt("MoFa"));

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
  const updateJob = useCallback(
    (id: number, job: JobEintrag) => setJobs((prev) => prev.map((j) => (j.id === id ? { ...job, id } : j))),
    [],
  );
  const deleteJob = useCallback((id: number) => setJobs((prev) => prev.filter((j) => j.id !== id)), []);

  const addLotse = useCallback((lotse: LotsenEintrag) => setLotsen((prev) => [...prev, lotse]), []);
  const updateLotse = useCallback(
    (index: number, lotse: LotsenEintrag) => setLotsen((prev) => prev.map((l, i) => (i === index ? lotse : l))),
    [],
  );
  const deleteLotse = useCallback((index: number) => setLotsen((prev) => prev.filter((_, i) => i !== index)), []);

  const setAktuelleFahrt = useCallback((fahrt: AktuelleFahrt) => {
    setAktuelleFahrtState(fahrt);
    speichereAktuelleFahrt(fahrt);
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
        aktuelleFahrt,
        setAktuelleFahrt,
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
