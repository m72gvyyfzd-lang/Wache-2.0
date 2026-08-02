import { getAbteilzeitSettings, sortiereJobsNachAbteilzeit } from "@wache/core";
import { mockJobs, mockLotsenliste } from "../data/mockData";
import { formatUhrzeit, herkunftVon } from "../lib/format";
import { StatTile } from "./StatTile";
import "./DashboardCard.css";

const settings = getAbteilzeitSettings("Wechsel Tide");

export function DashboardCard() {
  const jobsSortiert = sortiereJobsNachAbteilzeit(mockJobs, settings);
  const naechster = jobsSortiert[0];
  const anzahlHH = mockJobs.filter((j) => herkunftVon(j.routentyp) === "HH").length;
  const anzahlNOK = mockJobs.filter((j) => herkunftVon(j.routentyp) === "NOK").length;
  const anzahlAnmeldungen = mockJobs.filter((j) => herkunftVon(j.routentyp) === "Anmeldung").length;

  return (
    <div className="dashboard-card">
      <div className="dashboard-card__stats">
        <StatTile label="Anstehende Jobs" value={mockJobs.length} accent />
        <StatTile label="Nächste Abteilzeit" value={naechster ? formatUhrzeit(naechster.abteilzeit) : "–"} />
        <StatTile label="HH / NOK / Anmeldungen" value={`${anzahlHH} / ${anzahlNOK} / ${anzahlAnmeldungen}`} />
        <StatTile label="Verfügbare Lotsen" value={mockLotsenliste.length} />
      </div>
    </div>
  );
}
