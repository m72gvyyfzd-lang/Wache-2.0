import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Job } from "@wache/core";
import { mockJobs, mockLotsenliste } from "../data/mockData";
import type { LotsenEintrag } from "../data/types";
import { ladeJobs, ladeLotsen, speichereJobs, speichereLotsen } from "./storage";

interface DataContextValue {
  jobs: Job[];
  lotsen: LotsenEintrag[];
  naechsteJobNr: () => number;
  addJob: (job: Job) => void;
  updateJob: (jobNr: number, job: Job) => void;
  deleteJob: (jobNr: number) => void;
  addLotse: (lotse: LotsenEintrag) => void;
  updateLotse: (index: number, lotse: LotsenEintrag) => void;
  deleteLotse: (index: number) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>(() => ladeJobs(mockJobs));
  const [lotsen, setLotsen] = useState<LotsenEintrag[]>(() => ladeLotsen(mockLotsenliste));

  useEffect(() => speichereJobs(jobs), [jobs]);
  useEffect(() => speichereLotsen(lotsen), [lotsen]);

  const naechsteJobNr = useCallback(() => jobs.reduce((max, j) => Math.max(max, j.jobNr), 0) + 1, [jobs]);
  const addJob = useCallback((job: Job) => setJobs((prev) => [...prev, job]), []);
  const updateJob = useCallback(
    (jobNr: number, job: Job) => setJobs((prev) => prev.map((j) => (j.jobNr === jobNr ? job : j))),
    [],
  );
  const deleteJob = useCallback((jobNr: number) => setJobs((prev) => prev.filter((j) => j.jobNr !== jobNr)), []);

  const addLotse = useCallback((lotse: LotsenEintrag) => setLotsen((prev) => [...prev, lotse]), []);
  const updateLotse = useCallback(
    (index: number, lotse: LotsenEintrag) => setLotsen((prev) => prev.map((l, i) => (i === index ? lotse : l))),
    [],
  );
  const deleteLotse = useCallback((index: number) => setLotsen((prev) => prev.filter((_, i) => i !== index)), []);

  return (
    <DataContext.Provider
      value={{ jobs, lotsen, naechsteJobNr, addJob, updateJob, deleteJob, addLotse, updateLotse, deleteLotse }}
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
