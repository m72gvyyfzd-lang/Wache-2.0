import { berechneAbteilzeit, getAbteilzeitSettings } from "@wache/core";
import type { Job } from "@wache/core";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { mockJobs } from "../data/mockData";
import { formatUhrzeit } from "../lib/format";

const settings = getAbteilzeitSettings("Wechsel Tide");

function formatCheckpoint(datum: Date | undefined): string {
  return datum ? formatUhrzeit(datum) : "·";
}

interface CheckpointListeProps {
  titel: string;
  beschreibung: string;
  jobs: Job[];
  checkpointLabels: [string, string, string];
}

/** Hamburg- und NOK-Liste haben identische Spalten, nur die drei
 *  Checkpoint-Bezeichnungen unterscheiden sich (HH/FkW/Stade vs.
 *  Holt./Ticker/Kuden) — beide greifen auf dieselben Job-Felder zu. */
function CheckpointListe({ titel, beschreibung, jobs, checkpointLabels }: CheckpointListeProps) {
  const [label1, label2, label3] = checkpointLabels;
  return (
    <Panel title={titel} description={beschreibung} count={`${jobs.length} Einträge`}>
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
            </tr>
          ))}
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

function AndereListe({ jobs }: { jobs: Job[] }) {
  return (
    <Panel title="Andere Jobs" description="Anmeldungen ohne Checkpoint-Berechnung" count={`${jobs.length} Einträge`}>
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
            <tr key={job.jobNr}>
              <td className="num muted">{job.jobNr}</td>
              <td>{job.routentyp}</td>
              <td className="cell-name">{job.bezeichnung ?? "–"}</td>
              <td className="num muted">{job.kategorie ?? "·"}</td>
              <td className="num">{formatUhrzeit(berechneAbteilzeit(job, settings))}</td>
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
  const hamburg = mockJobs.filter((j) => j.routentyp === "HH");
  const nok = mockJobs.filter((j) => j.routentyp === "NOK");
  const andere = mockJobs.filter((j) => j.routentyp !== "HH" && j.routentyp !== "NOK");

  return (
    <div>
      <PageHeader title="Jobs" description="Alle anstehenden Jobs, aufgeteilt nach Herkunft" />
      <CheckpointListe
        titel="Hamburg"
        beschreibung="Elbe-Route: HH → FkW → Stade"
        jobs={hamburg}
        checkpointLabels={["HH", "FkW", "Stade"]}
      />
      <CheckpointListe
        titel="NOK"
        beschreibung="Kanal-Route: Holt. → Ticker → Kuden"
        jobs={nok}
        checkpointLabels={["Holt.", "Ticker", "Kuden"]}
      />
      <AndereListe jobs={andere} />
    </div>
  );
}
