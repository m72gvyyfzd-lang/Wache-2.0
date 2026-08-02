import { PageHeader } from "../components/PageHeader";
import { StatTile } from "../components/StatTile";
import { mockAnmeldungen, mockLotsenliste, mockZulaufHamburg, mockZulaufNok } from "../data/mockData";
import "./Dashboard.css";

export function Dashboard() {
  const aktivHamburg = mockZulaufHamburg.filter((r) => r.zeitHamburgHafenVerlassen).length;
  const aktivNok = mockZulaufNok.filter((r) => r.zeitHoltenauAusfahrt).length;

  return (
    <div>
      <PageHeader title="Dashboard" description="Überblick über die aktuelle Wache (Platzhalterdaten)" />
      <div className="dashboard-stats">
        <StatTile label="Lotsenliste" value={mockLotsenliste.length} accent />
        <StatTile label="Zulauf Hamburg aktiv" value={`${aktivHamburg} / ${mockZulaufHamburg.length}`} />
        <StatTile label="Zulauf NOK aktiv" value={`${aktivNok} / ${mockZulaufNok.length}`} />
        <StatTile label="Anmeldungen" value={mockAnmeldungen.length} />
      </div>
    </div>
  );
}
