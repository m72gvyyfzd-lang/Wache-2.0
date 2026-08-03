import { useState } from "react";
import { getAbteilzeitSettings } from "@wache/core";
import { JobFormAndere } from "../components/JobFormAndere";
import { JobFormHamburg } from "../components/JobFormHamburg";
import { JobFormNok } from "../components/JobFormNok";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import type { JobEintrag, JobListe } from "../data/types";
import { abteilzeitVon } from "../lib/coreJob";
import { formatUhrzeit } from "../lib/format";
import { useData } from "../state/DataContext";

const settings = getAbteilzeitSettings("Wechsel Tide");

function formatCheckpoint(datum: Date | undefined): string {
  return datum ? formatUhrzeit(datum) : "·";
}

interface CheckpointListeProps {
  titel: string;
  beschreibung: string;
  jobs: JobEintrag[];
  checkpointLabels: [string, string, string];
  checkpoints: (job: JobEintrag) => [Date | undefined, Date | undefined, Date | undefined];
  onNeu: () => void;
  onZeile: (job: JobEintrag) => void;
}

/** Hamburg- und NOK-Liste haben identische Spalten, nur die drei
 *  Checkpoint-Bezeichnungen und -Felder unterscheiden sich. */
function CheckpointListe({ titel, beschreibung, jobs, checkpointLabels, checkpoints, onNeu, onZeile }: CheckpointListeProps) {
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
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const [zeit1, zeit2, zeit3] = checkpoints(job);
            return (
              <tr key={job.jobNr} className="row-click" onClick={() => onZeile(job)}>
                <td className="num muted">{job.jobNr}</td>
                <td className="cell-name">{job.schiffsname ?? "–"}</td>
                <td className="muted">{job.bemerkung}</td>
                <td className="num muted">{job.kategorie ?? "·"}</td>
                <td className="num">{formatCheckpoint(zeit1)}</td>
                <td className="num">{formatCheckpoint(zeit2)}</td>
                <td className="num">{formatCheckpoint(zeit3)}</td>
                <td className="num">{formatUhrzeit(abteilzeitVon(job, settings))}</td>
              </tr>
            );
          })}
          {jobs.length === 0 && (
            <tr>
              <td colSpan={8} className="muted" style={{ textAlign: "center", padding: 20 }}>
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
  jobs: JobEintrag[];
  onNeu: () => void;
  onZeile: (job: JobEintrag) => void;
}

function AndereListe({ jobs, onNeu, onZeile }: AndereListeProps) {
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
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.jobNr} className="row-click" onClick={() => onZeile(job)}>
              <td className="num muted">{job.jobNr}</td>
              <td>{job.typ}</td>
              <td className="cell-name">{job.schiffsname ?? "–"}</td>
              <td className="num muted">{job.kategorie ?? "·"}</td>
              <td className="num">{formatUhrzeit(job.abtZeitManuell)}</td>
            </tr>
          ))}
          {jobs.length === 0 && (
            <tr>
              <td colSpan={5} className="muted" style={{ textAlign: "center", padding: 20 }}>
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
  const [dialog, setDialog] = useState<{ liste: JobListe; eintrag?: JobEintrag } | null>(null);

  const hamburg = jobs.filter((j) => j.liste === "hamburg");
  const nok = jobs.filter((j) => j.liste === "nok");
  const andere = jobs.filter((j) => j.liste === "andere");
  const verknuepfbar = jobs.filter((j) => j.liste !== "andere");

  function handleSubmit(job: JobEintrag) {
    if (dialog?.eintrag) {
      updateJob(dialog.eintrag.jobNr, { ...job, jobNr: dialog.eintrag.jobNr });
    } else {
      addJob({ ...job, jobNr: naechsteJobNr() });
    }
    setDialog(null);
  }

  function handleDelete() {
    if (dialog?.eintrag) deleteJob(dialog.eintrag.jobNr);
    setDialog(null);
  }

  const formProps = {
    initial: dialog?.eintrag,
    onSubmit: handleSubmit,
    onDelete: dialog?.eintrag ? handleDelete : undefined,
    onCancel: () => setDialog(null),
  };

  return (
    <div>
      <PageHeader title="ausgehender Schiffsverkehr / Anmeldungen" centered />
      <CheckpointListe
        titel="Hamburg"
        beschreibung="Elbe-Route: HH → FkW → Stade"
        jobs={hamburg}
        checkpointLabels={["HH", "FkW", "Stade"]}
        checkpoints={(job) => [job.hh, job.buetzfleth ? job.geplAbgang : job.fkw, job.stade]}
        onNeu={() => setDialog({ liste: "hamburg" })}
        onZeile={(eintrag) => setDialog({ liste: "hamburg", eintrag })}
      />
      <CheckpointListe
        titel="NOK"
        beschreibung="Kanal-Route: Holt. → Ticker → Kuden"
        jobs={nok}
        checkpointLabels={["Holt.", "Ticker", "Kuden"]}
        checkpoints={(job) => [job.holt, job.ticker, job.kuden]}
        onNeu={() => setDialog({ liste: "nok" })}
        onZeile={(eintrag) => setDialog({ liste: "nok", eintrag })}
      />
      <AndereListe
        jobs={andere}
        onNeu={() => setDialog({ liste: "andere" })}
        onZeile={(eintrag) => setDialog({ liste: "andere", eintrag })}
      />

      {dialog && (
        <Modal title={dialog.eintrag ? "Job bearbeiten" : "Neuer Job"} onClose={() => setDialog(null)}>
          {dialog.liste === "hamburg" && <JobFormHamburg {...formProps} />}
          {dialog.liste === "nok" && <JobFormNok {...formProps} />}
          {dialog.liste === "andere" && <JobFormAndere {...formProps} verknuepfbareJobs={verknuepfbar} />}
        </Modal>
      )}
    </div>
  );
}
