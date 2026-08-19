import { useState } from "react";
import { getAbteilzeitSettings } from "@wache/core";
import { JobFormAndere } from "../components/JobFormAndere";
import { JobFormHamburg } from "../components/JobFormHamburg";
import { JobFormNok } from "../components/JobFormNok";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { ZeitFeldModal } from "../components/ZeitFeldModal";
import type { JobEintrag, JobListe } from "../data/types";
import { benoetigteLotsenAnzahl, istAgJob, istBunkernPausiert, istCuxVergabe, istVerwaisterAgJob, sortiereEintraege, type EintragMitAbteilzeit } from "../lib/coreJob";
import { formatUhrzeit } from "../lib/format";
import { useData } from "../state/DataContext";
import "./Jobs.css";

const settings = getAbteilzeitSettings("Wechsel Tide");

function formatCheckpoint(datum: Date | undefined): string {
  return datum ? formatUhrzeit(datum) : "·";
}

/** "Lots.": nur bei mehr als 1 verbleibendem Lotsen (bzw. bei AG/AG (Tender)
 *  immer, auch bei genau 1) einen Wert anzeigen — bei Hamburg/NOK (nie AG)
 *  bleibt die Spalte damit praktisch immer leer, da dort ohnehin je Job nur
 *  ein Lotse vorgesehen ist. */
function lotsAnzeige(eintrag: JobEintrag, rest: number): string {
  if (rest === 1 && !istAgJob(eintrag)) return "";
  return String(rest);
}

/** Ein per Doppelklick bearbeitbares Datumsfeld eines Jobs — Wert +
 *  Zielfeld, das beim Übernehmen geschrieben wird ("FkW" zeigt bei
 *  Bützfleth-Jobs den geplanten Abgang, schreibt dann auch geplAbgang statt
 *  fkw). */
interface ZeitFeld {
  wert: Date | undefined;
  feld: keyof JobEintrag;
}

interface CheckpointListeProps {
  titel: string;
  zeilen: EintragMitAbteilzeit[];
  checkpointLabels: [string, string, string];
  checkpoints: (job: JobEintrag) => [ZeitFeld, ZeitFeld, ZeitFeld];
  onNeu: () => void;
  onZeile: (job: JobEintrag) => void;
  onZeitBearbeiten: (job: JobEintrag, feld: keyof JobEintrag, label: string, wert: Date | undefined) => void;
}

/** Hamburg- und NOK-Liste haben identische Spalten, nur die drei
 *  Checkpoint-Bezeichnungen und -Felder unterscheiden sich. Ist der
 *  LETZTE Checkpoint gesetzt (Hamburg: Stade, NOK: Kuden), steht das
 *  Schiff kurz vor der Übergabe — die Zeile wird dann fett gesetzt. Feste
 *  Spaltenbreiten (colgroup) statt inhaltsbasierter Breite, damit beide
 *  Listen exakt symmetrisch untereinanderstehen (bei gleicher Panel-Breite
 *  ergeben identische Prozentwerte identische Pixelbreiten). */
function CheckpointListe({
  titel,
  zeilen,
  checkpointLabels,
  checkpoints,
  onNeu,
  onZeile,
  onZeitBearbeiten,
}: CheckpointListeProps) {
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
      <table className="jobs-table">
        {/* ohne "Lots."-Spalte: die verbleibende Breite geht an Schiff
            und Bemerkung. */}
        <colgroup>
          <col style={{ width: "6%" }} />
          <col style={{ width: "24%" }} />
          <col style={{ width: "20%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "12%" }} />
        </colgroup>
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
            const [cp1, cp2, cp3] = checkpoints(eintrag);
            const zeilenKlick = () => onZeile(eintrag);
            // NOK-Schiffe mit gepl. Bunkern: aus der Planung genommen (keine
            // Abt.Zeit, kein Lotse) — die Zeile steht dezent am Listenende,
            // bis der Haken wieder raus ist (siehe istBunkernPausiert).
            const pausiert = istBunkernPausiert(eintrag);
            // Letzter Checkpoint gesetzt (Stade bzw. Kuden): das Schiff
            // steht kurz vor der Übergabe — Zeile hervorheben.
            const letzterCheckpoint = cp3.wert !== undefined;
            const zeilenKlasse =
              [pausiert ? "job-bunkert" : "", letzterCheckpoint ? "job-letzter-checkpoint" : ""]
                .filter(Boolean)
                .join(" ") || undefined;
            return (
              <tr key={eintrag.id} className={zeilenKlasse}>
                <td className="num muted row-click" onClick={zeilenKlick}>
                  {i + 1}
                </td>
                <td className="cell-name row-click" onClick={zeilenKlick}>
                  {eintrag.schiffsname ?? "–"}
                </td>
                <td className="muted row-click" onClick={zeilenKlick}>
                  {eintrag.bemerkung}
                </td>
                <td className="num muted row-click" onClick={zeilenKlick}>
                  {eintrag.kategorie ?? "·"}
                </td>
                <td
                  className="num row-click"
                  onDoubleClick={() => onZeitBearbeiten(eintrag, cp1.feld, label1, cp1.wert)}
                >
                  {formatCheckpoint(cp1.wert)}
                </td>
                <td
                  className="num row-click"
                  onDoubleClick={() => onZeitBearbeiten(eintrag, cp2.feld, label2, cp2.wert)}
                >
                  {formatCheckpoint(cp2.wert)}
                </td>
                <td
                  className="num row-click"
                  onDoubleClick={() => onZeitBearbeiten(eintrag, cp3.feld, label3, cp3.wert)}
                >
                  {formatCheckpoint(cp3.wert)}
                </td>
                <td
                  className="num row-click"
                  onDoubleClick={() => onZeitBearbeiten(eintrag, "abtZeitManuell", "Abt. Zeit", abteilzeit)}
                >
                  {formatUhrzeit(abteilzeit)}
                </td>
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
  alleJobs: JobEintrag[];
  abgeteiltProJob: Map<number, number>;
  onNeu: () => void;
  onZeile: (job: JobEintrag) => void;
  onWarnung: (job: JobEintrag) => void;
  onZeitBearbeiten: (job: JobEintrag, feld: keyof JobEintrag, label: string, wert: Date | undefined) => void;
}

function AndereListe({ zeilen, alleJobs, abgeteiltProJob, onNeu, onZeile, onWarnung, onZeitBearbeiten }: AndereListeProps) {
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
          </tr>
        </thead>
        <tbody>
          {zeilen.map(({ eintrag, abteilzeit }, i) => {
            const verwaist = istVerwaisterAgJob(eintrag, alleJobs);
            const abgeteilt = abgeteiltProJob.get(eintrag.id) ?? 0;
            const rest = benoetigteLotsenAnzahl(eintrag) - abgeteilt;
            const zeilenKlick = () => (verwaist ? onWarnung(eintrag) : onZeile(eintrag));
            const klasse = "row-click" + (verwaist ? " zeile-warnung" : "");
            return (
              // Cux-Vergaben laufen in keiner Berechnung mit — die ganze
              // Zeile wird grün dargestellt (siehe istCuxVergabe).
              <tr key={eintrag.id} className={istCuxVergabe(eintrag) ? "zeile-cux" : undefined}>
                <td className={`num muted ${klasse}`} onClick={zeilenKlick}>
                  {i + 1}
                </td>
                <td className={klasse} onClick={zeilenKlick}>
                  {eintrag.typ}
                </td>
                <td className={`cell-name ${klasse}`} onClick={zeilenKlick}>
                  {eintrag.schiffsname ?? "–"}
                </td>
                <td className={`num muted ${klasse}`} onClick={zeilenKlick}>
                  {eintrag.kategorie ?? "·"}
                </td>
                <td
                  className={`num ${klasse}`}
                  onClick={verwaist ? zeilenKlick : undefined}
                  onDoubleClick={
                    verwaist ? undefined : () => onZeitBearbeiten(eintrag, "abtZeitManuell", "Abt. Zeit", abteilzeit)
                  }
                >
                  {formatUhrzeit(abteilzeit)}
                </td>
                <td className={(abgeteilt > 0 ? "num lots-rest" : "num muted") + ` ${klasse}`} onClick={zeilenKlick}>
                  {lotsAnzeige(eintrag, rest)}
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
  // Doppelklick auf eine Zeitspalte (HH/FkW/Stade, Holt./Ticker/Kuden,
  // Abt. Zeit): kleines Quick-Edit-Fenster statt des ganzen Formulars.
  const [zeitEdit, setZeitEdit] = useState<{
    job: JobEintrag;
    feld: keyof JobEintrag;
    label: string;
    wert: Date | undefined;
  } | null>(null);

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

  function handleZeitUebernehmen(wert: Date | undefined) {
    if (!zeitEdit) return;
    updateJob(zeitEdit.job.id, { ...zeitEdit.job, [zeitEdit.feld]: wert });
    setZeitEdit(null);
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
        checkpointLabels={["HH", "FkW", "Stade"]}
        checkpoints={(job) => [
          { wert: job.hh, feld: "hh" },
          { wert: job.buetzfleth ? job.geplAbgang : job.fkw, feld: job.buetzfleth ? "geplAbgang" : "fkw" },
          { wert: job.stade, feld: "stade" },
        ]}
        onNeu={() => setDialog({ liste: "hamburg" })}
        onZeile={(eintrag) => setDialog({ liste: "hamburg", eintrag })}
        onZeitBearbeiten={(job, feld, label, wert) => setZeitEdit({ job, feld, label, wert })}
      />
      <CheckpointListe
        titel="NOK"
        zeilen={nok}
        checkpointLabels={["Holt.", "Ticker", "Kuden"]}
        checkpoints={(job) => [
          { wert: job.holt, feld: "holt" },
          { wert: job.ticker, feld: "ticker" },
          { wert: job.kuden, feld: "kuden" },
        ]}
        onNeu={() => setDialog({ liste: "nok" })}
        onZeile={(eintrag) => setDialog({ liste: "nok", eintrag })}
        onZeitBearbeiten={(job, feld, label, wert) => setZeitEdit({ job, feld, label, wert })}
      />
      <AndereListe
        zeilen={andere}
        alleJobs={jobs}
        abgeteiltProJob={abgeteiltProJob}
        onNeu={() => setDialog({ liste: "andere" })}
        onZeile={(eintrag) => setDialog({ liste: "andere", eintrag })}
        onWarnung={setWarnJob}
        onZeitBearbeiten={(job, feld, label, wert) => setZeitEdit({ job, feld, label, wert })}
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

      {zeitEdit && (
        <Modal title={zeitEdit.job.schiffsname ?? "Job"} onClose={() => setZeitEdit(null)} maxWidth="320px" titelZentriert>
          <ZeitFeldModal
            label={zeitEdit.label}
            initial={zeitEdit.wert}
            onUebernehmen={handleZeitUebernehmen}
            onAbbrechen={() => setZeitEdit(null)}
          />
        </Modal>
      )}
    </div>
  );
}
