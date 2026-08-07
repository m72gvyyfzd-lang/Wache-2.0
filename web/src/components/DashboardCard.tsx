import { useEffect, useMemo, useState } from "react";
import { getAbteilzeitSettings } from "@wache/core";
import { sortiereEintraege } from "../lib/coreJob";
import { berechneMeldungen } from "../lib/meldungen";
import { useData } from "../state/DataContext";
import { formatUhrzeit } from "../lib/format";
import { MeldungsListe, MeldungsTile } from "./Meldungen";
import { StatTile } from "./StatTile";
import "./DashboardCard.css";

const settings = getAbteilzeitSettings("Wechsel Tide");

export function DashboardCard() {
  const { jobs, lotsen, aktuelleFahrt, abteilungen } = useData();

  // Zeit-Tick: die Meldungen hängen an der Uhrzeit (gepl. Abruf etc.) und
  // werden daher regelmäßig neu berechnet, auch ohne Datenänderung.
  const [jetzt, setJetzt] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setJetzt(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  const meldungen = useMemo(
    () => berechneMeldungen({ jobs, lotsen, aktuelleFahrt, abteilungen }, jetzt, settings),
    [jobs, lotsen, aktuelleFahrt, abteilungen, jetzt],
  );
  const [listeOffen, setListeOffen] = useState(false);

  const jobsSortiert = sortiereEintraege(jobs, settings);
  const naechster = jobsSortiert[0];
  const anzahlHH = jobs.filter((j) => j.liste === "hamburg").length;
  const anzahlNOK = jobs.filter((j) => j.liste === "nok").length;
  const anzahlAnmeldungen = jobs.filter((j) => j.liste === "andere").length;

  return (
    <div className="dashboard-card">
      <div className="dashboard-card__scroll">
        <div className="dashboard-card__stats">
          <MeldungsTile meldungen={meldungen} offen={listeOffen} onToggle={() => setListeOffen((o) => !o)} />
          <StatTile label="Anstehende Jobs" value={jobs.length} accent />
          <StatTile label="Nächste Abteilzeit" value={naechster ? formatUhrzeit(naechster.abteilzeit) : "–"} />
          <StatTile label="HH / NOK / Anmeldungen" value={`${anzahlHH} / ${anzahlNOK} / ${anzahlAnmeldungen}`} />
          <StatTile label="Verfügbare Lotsen" value={lotsen.filter((l) => l.fahrt === "" && !l.abgeteilt).length} />
        </div>
      </div>
      {listeOffen && <MeldungsListe meldungen={meldungen} />}
    </div>
  );
}
