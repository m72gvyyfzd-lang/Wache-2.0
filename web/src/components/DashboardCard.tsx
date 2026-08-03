import { getAbteilzeitSettings } from "@wache/core";
import { sortiereEintraege } from "../lib/coreJob";
import { useData } from "../state/DataContext";
import { formatUhrzeit } from "../lib/format";
import { StatTile } from "./StatTile";
import "./DashboardCard.css";

const settings = getAbteilzeitSettings("Wechsel Tide");

export function DashboardCard() {
  const { jobs, lotsen } = useData();
  const jobsSortiert = sortiereEintraege(jobs, settings);
  const naechster = jobsSortiert[0];
  const anzahlHH = jobs.filter((j) => j.liste === "hamburg").length;
  const anzahlNOK = jobs.filter((j) => j.liste === "nok").length;
  const anzahlAnmeldungen = jobs.filter((j) => j.liste === "andere").length;

  return (
    <div className="dashboard-card">
      <div className="dashboard-card__stats">
        <StatTile label="Anstehende Jobs" value={jobs.length} accent />
        <StatTile label="Nächste Abteilzeit" value={naechster ? formatUhrzeit(naechster.abteilzeit) : "–"} />
        <StatTile label="HH / NOK / Anmeldungen" value={`${anzahlHH} / ${anzahlNOK} / ${anzahlAnmeldungen}`} />
        <StatTile label="Verfügbare Lotsen" value={lotsen.filter((l) => l.fahrt === "").length} />
      </div>
    </div>
  );
}
