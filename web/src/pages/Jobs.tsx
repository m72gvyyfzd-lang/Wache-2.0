import { useState } from "react";
import { getAbteilzeitSettings } from "@wache/core";
import { JobFormAndere } from "../components/JobFormAndere";
import { JobFormHamburg } from "../components/JobFormHamburg";
import { JobFormNok } from "../components/JobFormNok";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import type { JobEintrag, JobListe } from "../data/types";
import { benoetigteLotsenAnzahl, istVerwaisterAgJob, sortiereEintraege, type EintragMitAbteilzeit } from "../lib/coreJob";
import { formatUhrzeit } from "../lib/format";
import { useData } from "../state/DataContext";
import "./Jobs.css";

const settings = getAbteilzeitSettings("Wechsel Tide");

function formatCheckpoint(datum: Date | undefined): string {
  return datum ? formatUhrzeit(datum) : "·";
}

interface CheckpointListeProps {
  titel: string;
  zeilen: EintragMitAbteilzeit[];
  abgeteiltProJob: Map<number, number>;
  checkpointLabels: [string, string, string];
  checkpoints: (job: JobEintrag) => [Date | undefined, Date | undefined, Date | undefined];
  onNeu: () => void;
  onZeile: (job: JobEintrag) => void;
}

/** Hamburg- und NOK-Liste haben identische Spalten, nur die drei
 *  Checkpoint-Bezeichnungen und -Felder unterscheiden sich. */
function CheckpointListe({ titel, zeilen, abgeteiltProJob, checkpointLabels, checkpoints, onNeu, onZeile }: CheckpointListeProps) {
  const [label1, label2, label3] = checkpointLabels;
  return (
    <Panel
      title={titel}
      count={`${zeilen.length} Einträge`}
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
            <th className="num">Lots.</th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map(({ eintrag, abteilzeit }, i) => {
            const [zeit1, zeit2, zeit3] = checkpoints(eintrag);
            const abgeteilt = abgeteiltProJob.get(eintrag.id) ?? 0;
            return (
              <tr key={eintrag.id} className="row-click" onClick={() => onZeile(eintrag)}>
                <td className="num muted">{i + 1}</td>
                <td className="cell-name">{eintrag.schiffsname ?? "–"}</td>
                <td className="muted">{eintrag.bemerkung}</td>
                <td className="num muted">{eintrag.kategorie ?? "·"}</td>
                <td className="num">{formatCheckpoint(zeit1)}</td>
                <td className="num">{formatCheckpoint(zeit2)}</td>
                <td className="num">{formatCheckpoint(zeit3)}</td>
                <td className="num">{formatUhrzeit(abteilzeit)}</td>
                <td className={abgeteilt > 0 ? "num lots-rest" : "num muted"}>
                  {benoetigteLotsenAnzahl(eintrag) - abgeteilt}
                </td>
              </tr>
            );
          })}
          {zeilen.length === 0 && (
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
  zeilen: EintragMitAbteilzeit[];
  alleJobs: JobEintrag[];
  abgeteiltProJob: Map<number, number>;
  onNeu: () => void;
  onZeile: (job: JobEintrag) => void;
  onWarnung: (job: JobEintrag) => void;
}

function AndereListe({ zeilen, alleJobs, abgeteiltProJob, onNeu, onZeile, onWarnung }: AndereListeProps) {
  return (
    <Panel
      title="Andere Jobs"
      count={`${zeilen.length} Einträge`}
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
            <th className="num">Lots.</th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map(({ eintrag, abteilzeit }, i) => {
            const verwaist = istVerwaisterAgJob(eintrag, alleJobs);
            const abgeteilt = abgeteiltProJob.get(eintrag.id) ?? 0;
            return (
              <tr
                key={eintrag.id}
                className={"row-click" + (verwaist ? " zeile-warnung" : "")}
                onClick={() => (verwaist ? onWarnung(eintrag) : onZeile(eintrag))}
              >
                <td className="num muted">{i + 1}</td>
                <td>{eintrag.typ}</td>
                <td className="cell-name">{eintrag.schiffsname ?? "–"}</td>
                <td className="num muted">{eintrag.kategorie ?? "·"}</td>
                <td className="num">{formatUhrzeit(abteilzeit)}</td>
                <td className={abgeteilt > 0 ? "num lots-rest" : "num muted"}>
                  {benoetigteLotsenAnzahl(eintrag) - abgeteilt}
                </td>
              </tr>
            );
          })}
          {zeilen.length === 0 && (
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
  const { jobs, addJob, updateJob, deleteJob, abteilungen } = useData();
  const [dialog, setDialog] = useState<{ liste: JobListe; eintrag?: JobEintrag } | null>(null);
  // Klick auf einen verwaisten AG-Job (verknüpfter Job wurde gelöscht)
  // öffnet zuerst die Alarminfo statt direkt das Bearbeitungsformular
  const [warnJob, setWarnJob] = useState<JobEintrag | null>(null);

  // Voll abgeteilte Jobs sind auch hier ausgeblendet (Rückgängig blendet
  // sie wieder ein); AG-Jobs zeigen bis dahin die Rest-Anzahl in "Lots.".
  const abgeteiltProJob = new Map<number, number>();
  for (const a of abteilungen) abgeteiltProJob.set(a.jobId, (abgeteiltProJob.get(a.jobId) ?? 0) + 1);
  const sichtbar = (j: JobEintrag) => benoetigteLotsenAnzahl(j) - (abgeteiltProJob.get(j.id) ?? 0) > 0;

  // jede Liste eigenständig nach Abteilzeit sortiert (früheste oben);
  // sortiert sich nach jedem Speichern automatisch neu
  const hamburg = sortiereEintraege(jobs.filter((j) => j.liste === "hamburg" && sichtbar(j)), settings);
  const nok = sortiereEintraege(jobs.filter((j) => j.liste === "nok" && sichtbar(j)), settings);
  const andere = sortiereEintraege(jobs.filter((j) => j.liste === "andere" && sichtbar(j)), settings);
  // Nur aktuell verfügbare Trägerjobs zur Auswahl: bereits voll abgeteilte
  // Hamburg/NOK-Jobs (eigener Lotse schon dispatcht) fliegen raus — außer es
  // ist der Job, den der gerade bearbeitete AG-Job selbst referenziert
  // (sonst würde die Auswahl beim Bearbeiten unsichtbar, obwohl sie ja
  // weiterhin gilt).
  const verknuepfbar = jobs.filter(
    (j) => j.liste !== "andere" && (sichtbar(j) || j.id === dialog?.eintrag?.agJobId),
  );

  function handleSubmit(job: JobEintrag) {
    if (dialog?.eintrag) {
      updateJob(dialog.eintrag.id, job);
    } else {
      addJob(job);
    }
    setDialog(null);
  }

  function handleDelete() {
    if (dialog?.eintrag) deleteJob(dialog.eintrag.id);
    setDialog(null);
  }

  const formProps = {
    initial: dialog?.eintrag,
    onSubmit: handleSubmit,
    onDelete: dialog?.eintrag ? handleDelete : undefined,
    onCancel: () => setDialog(null),
  };

  // Feste, listenbezogene Überschrift statt "Job bearbeiten"/"Neuer Job" —
  // die Liste steht ja schon durch die Auswahl fest.
  const DIALOG_TITEL: Record<JobListe, string> = {
    hamburg: "Hamburg / Bützfleth",
    nok: "NOK",
    andere: "Andere Jobs",
  };

  return (
    <div>
      <PageHeader title="ausgehender Schiffsverkehr / Anmeldungen" centered />
      <CheckpointListe
        titel="Hamburg"
        zeilen={hamburg}
        abgeteiltProJob={abgeteiltProJob}
        checkpointLabels={["HH", "FkW", "Stade"]}
        checkpoints={(job) => [job.hh, job.buetzfleth ? job.geplAbgang : job.fkw, job.stade]}
        onNeu={() => setDialog({ liste: "hamburg" })}
        onZeile={(eintrag) => setDialog({ liste: "hamburg", eintrag })}
      />
      <CheckpointListe
        titel="NOK"
        zeilen={nok}
        abgeteiltProJob={abgeteiltProJob}
        checkpointLabels={["Holt.", "Ticker", "Kuden"]}
        checkpoints={(job) => [job.holt, job.ticker, job.kuden]}
        onNeu={() => setDialog({ liste: "nok" })}
        onZeile={(eintrag) => setDialog({ liste: "nok", eintrag })}
      />
      <AndereListe
        zeilen={andere}
        alleJobs={jobs}
        abgeteiltProJob={abgeteiltProJob}
        onNeu={() => setDialog({ liste: "andere" })}
        onZeile={(eintrag) => setDialog({ liste: "andere", eintrag })}
        onWarnung={setWarnJob}
      />

      {dialog && (
        // etwas breiter als der 560px-Standard: Ebene 1 trägt seit dem
        // Speed-Dropdown fünf Spalten (Name/Kat./Speed/Bütz bzw. Kalender)
        <Modal title={DIALOG_TITEL[dialog.liste]} onClose={() => setDialog(null)} maxWidth="640px">
          {dialog.liste === "hamburg" && <JobFormHamburg {...formProps} />}
          {dialog.liste === "nok" && <JobFormNok {...formProps} />}
          {dialog.liste === "andere" && <JobFormAndere {...formProps} verknuepfbareJobs={verknuepfbar} />}
        </Modal>
      )}

      {warnJob && (
        <Modal title={warnJob.schiffsname || "AG-Job"} onClose={() => setWarnJob(null)} maxWidth="360px">
          <div className="job-form">
            <p className="warnung-text">
              Der mit diesem AG-Job verknüpfte Hamburg/NOK-Job wurde gelöscht. Die Abteilzeit wird dadurch nicht mehr
              automatisch aktualisiert.
            </p>
            <div className="job-form__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setWarnJob(null)}>
                Schließen
              </button>
              <span className="job-form__spacer" />
              <button
                type="button"
                className="btn btn--accent"
                onClick={() => {
                  setDialog({ liste: "andere", eintrag: warnJob });
                  setWarnJob(null);
                }}
              >
                Bearbeiten
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
