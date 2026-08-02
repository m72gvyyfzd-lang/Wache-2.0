import { getAbteilzeitSettings, sortiereJobsNachAbteilzeit } from "@wache/core";
import { useData } from "../state/DataContext";
import { formatUhrzeit, herkunftVon } from "../lib/format";
import { StatTile } from "./StatTile";
import "./DashboardCard.css";

const settings = getAbteilzeitSettings("Wechsel Tide");

export function DashboardCard() {
  const { jobs, lotsen } = useData();
  const jobsSortiert = sortiereJobsNachAbteilzeit(jobs, settings);
  const naechster = jobsSortiert[0];
  const anzahlHH = jobs.filter((j) => herkunftVon(j.routentyp) === "HH").length;
  const anzahlNOK = jobs.filter((j) => herkunftVon(j.routentyp) === "NOK").length;
  const anzahlAnmeldungen = jobs.filter((j) => herkunftVon(j.routentyp) === "Anmeldung").length;

  return (
    <div className="dashboard-card">
      <div className="dashboard-card__stats">
        <StatTile label="Anstehende Jobs" value={jobs.length} accent />
        <StatTile label="Nächste Abteilzeit" value={naechster ? formatUhrzeit(naechster.abteilzeit) : "–"} />
        <StatTile label="HH / NOK / Anmeldungen" value={`${anzahlHH} / ${anzahlNOK} / ${anzahlAnmeldungen}`} />
        <StatTile label="Verfügbare Lotsen" value={lotsen.length} />
      </div>
    </div>
  );
}
