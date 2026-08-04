import { useState } from "react";
import { getAbteilzeitSettings } from "@wache/core";
import { JobFormAndere } from "../components/JobFormAndere";
import { JobFormHamburg } from "../components/JobFormHamburg";
import { JobFormNok } from "../components/JobFormNok";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import type { JobEintrag, JobListe, LotsenEintrag } from "../data/types";
import { sortiereEintraege, type EintragMitAbteilzeit } from "../lib/coreJob";
import { formatUhrzeit } from "../lib/format";
import { planeEinsatzstation } from "../lib/planungEinsatzstation";
import { useData } from "../state/DataContext";
import "./Jobs.css";

const settings = getAbteilzeitSettings("Wechsel Tide");

function formatCheckpoint(datum: Date | undefined): string {
  return datum ? formatUhrzeit(datum) : "·";
}

/** "Planung Einsatzstation": zugewiesene Lotsen dezent hinter dem
 *  Schiffsnamen, mehrere durch ", " getrennt. */
function PlanungHinweis({ lotsen }: { lotsen: LotsenEintrag[] }) {
  if (lotsen.length === 0) return null;
  return <span className="planung-hinweis"> ({lotsen.map((l) => l.name).join(", ")})</span>;
}

interface CheckpointListeProps {
  titel: string;
  beschreibung: string;
  zeilen: EintragMitAbteilzeit[];
  checkpointLabels: [string, string, string];
  checkpoints: (job: JobEintrag) => [Date | undefined, Date | undefined, Date | undefined];
  zuweisungen: Map<number, LotsenEintrag[]>;
  onNeu: () => void;
  onZeile: (job: JobEintrag) => void;
}

/** Hamburg- und NOK-Liste haben identische Spalten, nur die drei
 *  Checkpoint-Bezeichnungen und -Felder unterscheiden sich. */
function CheckpointListe({ titel, beschreibung, zeilen, checkpointLabels, checkpoints, zuweisungen, onNeu, onZeile }: CheckpointListeProps) {
  const [label1, label2, label3] = checkpointLabels;
  return (
    <Panel
      title={titel}
      description={beschreibung}
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
          </tr>
        </thead>
        <tbody>
          {zeilen.map(({ eintrag, abteilzeit }, i) => {
            const [zeit1, zeit2, zeit3] = checkpoints(eintrag);
            return (
              <tr key={eintrag.id} className="row-click" onClick={() => onZeile(eintrag)}>
                <td className="num muted">{i + 1}</td>
                <td className="cell-name">
                  {eintrag.schiffsname ?? "–"}
                  <PlanungHinweis lotsen={zuweisungen.get(eintrag.id) ?? []} />
                </td>
                <td className="muted">{eintrag.bemerkung}</td>
                <td className="num muted">{eintrag.kategorie ?? "·"}</td>
                <td className="num">{formatCheckpoint(zeit1)}</td>
                <td className="num">{formatCheckpoint(zeit2)}</td>
                <td className="num">{formatCheckpoint(zeit3)}</td>
                <td className="num">{formatUhrzeit(abteilzeit)}</td>
              </tr>
            );
          })}
          {zeilen.length === 0 && (
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
  zeilen: EintragMitAbteilzeit[];
  zuweisungen: Map<number, LotsenEintrag[]>;
  onNeu: () => void;
  onZeile: (job: JobEintrag) => void;
}

function AndereListe({ zeilen, zuweisungen, onNeu, onZeile }: AndereListeProps) {
  return (
    <Panel
      title="Andere Jobs"
      description="Anmeldungen ohne Checkpoint-Berechnung"
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
          </tr>
        </thead>
        <tbody>
          {zeilen.map(({ eintrag, abteilzeit }, i) => (
            <tr key={eintrag.id} className="row-click" onClick={() => onZeile(eintrag)}>
              <td className="num muted">{i + 1}</td>
              <td>{eintrag.typ}</td>
              <td className="cell-name">
                {eintrag.schiffsname ?? "–"}
                <PlanungHinweis lotsen={zuweisungen.get(eintrag.id) ?? []} />
              </td>
              <td className="num muted">{eintrag.kategorie ?? "·"}</td>
              <td className="num">{formatUhrzeit(abteilzeit)}</td>
            </tr>
          ))}
          {zeilen.length === 0 && (
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
  const { jobs, lotsen, aktuelleFahrt, addJob, updateJob, deleteJob } = useData();
  const [dialog, setDialog] = useState<{ liste: JobListe; eintrag?: JobEintrag } | null>(null);

  // jede Liste eigenständig nach Abteilzeit sortiert (früheste oben);
  // sortiert sich nach jedem Speichern automatisch neu
  const hamburg = sortiereEintraege(jobs.filter((j) => j.liste === "hamburg"), settings);
  const nok = sortiereEintraege(jobs.filter((j) => j.liste === "nok"), settings);
  const andere = sortiereEintraege(jobs.filter((j) => j.liste === "andere"), settings);
  const verknuepfbar = jobs.filter((j) => j.liste !== "andere");
  // "Planung Einsatzstation" — wird bei jeder Änderung neu berechnet
  const zuweisungen = planeEinsatzstation(jobs, lotsen, aktuelleFahrt, settings);

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

  return (
    <div>
      <PageHeader title="ausgehender Schiffsverkehr / Anmeldungen" centered />
      <CheckpointListe
        titel="Hamburg"
        beschreibung="Elbe-Route: HH → FkW → Stade"
        zeilen={hamburg}
        checkpointLabels={["HH", "FkW", "Stade"]}
        checkpoints={(job) => [job.hh, job.buetzfleth ? job.geplAbgang : job.fkw, job.stade]}
        zuweisungen={zuweisungen}
        onNeu={() => setDialog({ liste: "hamburg" })}
        onZeile={(eintrag) => setDialog({ liste: "hamburg", eintrag })}
      />
      <CheckpointListe
        titel="NOK"
        beschreibung="Kanal-Route: Holt. → Ticker → Kuden"
        zeilen={nok}
        checkpointLabels={["Holt.", "Ticker", "Kuden"]}
        checkpoints={(job) => [job.holt, job.ticker, job.kuden]}
        zuweisungen={zuweisungen}
        onNeu={() => setDialog({ liste: "nok" })}
        onZeile={(eintrag) => setDialog({ liste: "nok", eintrag })}
      />
      <AndereListe
        zeilen={andere}
        zuweisungen={zuweisungen}
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
