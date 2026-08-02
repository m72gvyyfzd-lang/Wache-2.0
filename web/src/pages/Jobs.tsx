import { useState } from "react";
import { berechneAbteilzeit, getAbteilzeitSettings } from "@wache/core";
import type { Job } from "@wache/core";
import { JobForm } from "../components/JobForm";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { useData } from "../state/DataContext";
import { formatUhrzeit } from "../lib/format";

const settings = getAbteilzeitSettings("Wechsel Tide");

type Art = "HH" | "NOK" | "Andere";

function formatCheckpoint(datum: Date | undefined): string {
  return datum ? formatUhrzeit(datum) : "·";
}

interface CheckpointListeProps {
  titel: string;
  beschreibung: string;
  jobs: Job[];
  checkpointLabels: [string, string, string];
  onNeu: () => void;
  onBearbeiten: (job: Job) => void;
  onLoeschen: (jobNr: number) => void;
}

/** Hamburg- und NOK-Liste haben identische Spalten, nur die drei
 *  Checkpoint-Bezeichnungen unterscheiden sich (HH/FkW/Stade vs.
 *  Holt./Ticker/Kuden) — beide greifen auf dieselben Job-Felder zu. */
function CheckpointListe({ titel, beschreibung, jobs, checkpointLabels, onNeu, onBearbeiten, onLoeschen }: CheckpointListeProps) {
  const [label1, label2, label3] = checkpointLabels;
  return (
    <Panel
      title={titel}
      description={beschreibung}
      count={`${jobs.length} Einträge`}
      action={
        <button type="button" className="btn btn--small btn--accent" onClick={onNeu}>
          + Neuer Job
        </button>
      }
    >
      <table>
        <thead>
          <tr>
            <th className="num">Nr</th>
            <th>Schiff</th>
            <th>Bemerkung</th>
            <th className="num">Kat.</th>
            <th className="num">{label1}</th>
            <th className="num">{label2}</th>
            <th className="num">{label3}</th>
            <th className="num">Abt. Zeit</th>
            <th aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.jobNr}>
              <td className="num muted">{job.jobNr}</td>
              <td className="cell-name">{job.bezeichnung ?? "–"}</td>
              <td className="muted">{job.bemerkung}</td>
              <td className="num muted">{job.kategorie ?? "·"}</td>
              <td className="num">{formatCheckpoint(job.hhHoltenau)}</td>
              <td className="num">{formatCheckpoint(job.fkwTickerAbgang)}</td>
              <td className="num">{formatCheckpoint(job.stadeKuden)}</td>
              <td className="num">{formatUhrzeit(berechneAbteilzeit(job, settings))}</td>
              <td className="cell-actions">
                <button type="button" className="btn btn--small btn--icon" onClick={() => onBearbeiten(job)} aria-label="Bearbeiten">
                  ✎
                </button>
                <button
                  type="button"
                  className="btn btn--small btn--icon btn--danger"
                  onClick={() => onLoeschen(job.jobNr)}
                  aria-label="Löschen"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
          {jobs.length === 0 && (
            <tr>
              <td colSpan={9} className="muted" style={{ textAlign: "center", padding: 20 }}>
                keine Jobs
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Panel>
  );
}

interface AndereListeProps {
  jobs: Job[];
  onNeu: () => void;
  onBearbeiten: (job: Job) => void;
  onLoeschen: (jobNr: number) => void;
}

function AndereListe({ jobs, onNeu, onBearbeiten, onLoeschen }: AndereListeProps) {
  return (
    <Panel
      title="Andere Jobs"
      description="Anmeldungen ohne Checkpoint-Berechnung"
      count={`${jobs.length} Einträge`}
      action={
        <button type="button" className="btn btn--small btn--accent" onClick={onNeu}>
          + Neuer Job
        </button>
      }
    >
      <table>
        <thead>
          <tr>
            <th className="num">Nr</th>
            <th>Typ</th>
            <th>Schiff</th>
            <th className="num">Kat.</th>
            <th className="num">Abt. Zeit</th>
            <th aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.jobNr}>
              <td className="num muted">{job.jobNr}</td>
              <td>{job.routentyp}</td>
              <td className="cell-name">{job.bezeichnung ?? "–"}</td>
              <td className="num muted">{job.kategorie ?? "·"}</td>
              <td className="num">{formatUhrzeit(berechneAbteilzeit(job, settings))}</td>
              <td className="cell-actions">
                <button type="button" className="btn btn--small btn--icon" onClick={() => onBearbeiten(job)} aria-label="Bearbeiten">
                  ✎
                </button>
                <button
                  type="button"
                  className="btn btn--small btn--icon btn--danger"
                  onClick={() => onLoeschen(job.jobNr)}
                  aria-label="Löschen"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
          {jobs.length === 0 && (
            <tr>
              <td colSpan={6} className="muted" style={{ textAlign: "center", padding: 20 }}>
                keine Jobs
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Panel>
  );
}

export function Jobs() {
  const { jobs, naechsteJobNr, addJob, updateJob, deleteJob } = useData();
  const [dialog, setDialog] = useState<{ art: Art; job?: Job } | null>(null);

  const hamburg = jobs.filter((j) => j.routentyp === "HH");
  const nok = jobs.filter((j) => j.routentyp === "NOK");
  const andere = jobs.filter((j) => j.routentyp !== "HH" && j.routentyp !== "NOK");

  function handleSubmit(job: Job) {
    if (dialog?.job) {
      updateJob(dialog.job.jobNr, { ...job, jobNr: dialog.job.jobNr });
    } else {
      addJob({ ...job, jobNr: naechsteJobNr() });
    }
    setDialog(null);
  }

  return (
    <div>
      <PageHeader title="Jobs" description="Alle anstehenden Jobs, aufgeteilt nach Herkunft" />
      <CheckpointListe
        titel="Hamburg"
        beschreibung="Elbe-Route: HH → FkW → Stade"
        jobs={hamburg}
        checkpointLabels={["HH", "FkW", "Stade"]}
        onNeu={() => setDialog({ art: "HH" })}
        onBearbeiten={(job) => setDialog({ art: "HH", job })}
        onLoeschen={deleteJob}
      />
      <CheckpointListe
        titel="NOK"
        beschreibung="Kanal-Route: Holt. → Ticker → Kuden"
        jobs={nok}
        checkpointLabels={["Holt.", "Ticker", "Kuden"]}
        onNeu={() => setDialog({ art: "NOK" })}
        onBearbeiten={(job) => setDialog({ art: "NOK", job })}
        onLoeschen={deleteJob}
      />
      <AndereListe
        jobs={andere}
        onNeu={() => setDialog({ art: "Andere" })}
        onBearbeiten={(job) => setDialog({ art: "Andere", job })}
        onLoeschen={deleteJob}
      />

      {dialog && (
        <Modal title={dialog.job ? "Job bearbeiten" : "Neuer Job"} onClose={() => setDialog(null)}>
          <JobForm initial={dialog.job} vorgabeArt={dialog.art} onSubmit={handleSubmit} onCancel={() => setDialog(null)} />
        </Modal>
      )}
    </div>
  );
}
