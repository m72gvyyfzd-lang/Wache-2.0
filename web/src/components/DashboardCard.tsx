import { useEffect, useMemo, useRef, useState } from "react";
import { getAbteilzeitSettings } from "@wache/core";
import { spieleAlarmTon, tonEntsperren } from "../lib/alarmTon";
import { berechneAgPlanung } from "../lib/agPlanung";
import { berechneMeldungen } from "../lib/meldungen";
import { ladeAlarmTonAktiv, speichereAlarmTonAktiv } from "../state/storage";
import { useData } from "../state/DataContext";
import { AgPlanungListe, AgPlanungTile } from "./AgPlanung";
import { MeldungsListe, MeldungsTile } from "./Meldungen";
import { StatTile } from "./StatTile";
import "./DashboardCard.css";

const settings = getAbteilzeitSettings("Wechsel Tide");

export function DashboardCard() {
  const { jobs, lotsen, aktuelleFahrt, abteilungen, seeSchiffe, seestationLotsen, seeAbteilungen, vNrStart, verbrauchteVNrn } =
    useData();

  // Zeit-Tick: die Meldungen hängen an der Uhrzeit (gepl. Abruf etc.) und
  // werden daher regelmäßig neu berechnet, auch ohne Datenänderung.
  const [jetzt, setJetzt] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setJetzt(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  const meldungen = useMemo(
    () =>
      berechneMeldungen(
        { jobs, lotsen, aktuelleFahrt, abteilungen, seeSchiffe, seestationLotsen, seeAbteilungen, vNrStart, verbrauchteVNrn },
        jetzt,
        settings,
      ),
    [jobs, lotsen, aktuelleFahrt, abteilungen, seeSchiffe, seestationLotsen, seeAbteilungen, vNrStart, verbrauchteVNrn, jetzt],
  );
  const agGruppen = useMemo(
    () =>
      berechneAgPlanung(
        { jobs, lotsen, aktuelleFahrt, abteilungen, seeSchiffe, seestationLotsen, seeAbteilungen, vNrStart, verbrauchteVNrn },
        jetzt,
        settings,
      ),
    [jobs, lotsen, aktuelleFahrt, abteilungen, seeSchiffe, seestationLotsen, seeAbteilungen, vNrStart, verbrauchteVNrn, jetzt],
  );
  // Nur eine Liste gleichzeitig aufgeklappt (beide sind absolut über die
  // volle Kartenbreite positioniert und würden sich sonst überlagern).
  const [offenesPanel, setOffenesPanel] = useState<"meldungen" | "ag-planung" | null>(null);

  // Alarm-Ton: einmaliger Ton pro NEUEM Alarm (stabile Meldungs-IDs).
  // Browser erlauben Ton erst nach einer Nutzer-Interaktion — das
  // Einschalten des Schalters entsperrt den AudioContext; war der Ton
  // schon beim Laden aktiv, entsperrt die erste beliebige Berührung.
  const [tonAn, setTonAn] = useState(() => ladeAlarmTonAktiv());
  useEffect(() => {
    if (!tonAn) return;
    const entsperren = () => tonEntsperren();
    document.addEventListener("pointerdown", entsperren, { once: true });
    return () => document.removeEventListener("pointerdown", entsperren);
  }, [tonAn]);

  function handleTonToggle() {
    setTonAn((an) => {
      const neu = !an;
      speichereAlarmTonAktiv(neu);
      if (neu) {
        tonEntsperren();
        spieleAlarmTon();
      }
      return neu;
    });
  }

  const alarmSchluessel = meldungen
    .filter((m) => m.stufe === "alarm")
    .map((m) => m.id)
    .join("|");
  const bekannteAlarme = useRef<Set<string>>(new Set());
  useEffect(() => {
    const aktuelle = alarmSchluessel === "" ? [] : alarmSchluessel.split("|");
    const neue = aktuelle.filter((id) => !bekannteAlarme.current.has(id));
    bekannteAlarme.current = new Set(aktuelle);
    if (neue.length > 0 && tonAn) spieleAlarmTon();
  }, [alarmSchluessel, tonAn]);

  const anzahlHH = jobs.filter((j) => j.liste === "hamburg").length;
  const anzahlNOK = jobs.filter((j) => j.liste === "nok").length;
  const anzahlAnmeldungen = jobs.filter((j) => j.liste === "andere").length;

  return (
    <div className="dashboard-card">
      <div className="dashboard-card__scroll">
        <div className="dashboard-card__stats">
          <MeldungsTile
            meldungen={meldungen}
            offen={offenesPanel === "meldungen"}
            onToggle={() => setOffenesPanel((p) => (p === "meldungen" ? null : "meldungen"))}
          />
          <AgPlanungTile
            gruppen={agGruppen}
            offen={offenesPanel === "ag-planung"}
            onToggle={() => setOffenesPanel((p) => (p === "ag-planung" ? null : "ag-planung"))}
          />
          <button
            type="button"
            className={"ton-tile" + (tonAn ? " ton-tile--an" : "")}
            onClick={handleTonToggle}
            title="Alarm-Ton ein-/ausschalten"
          >
            <div className="ton-tile__label">Alarm-Ton</div>
            <div className="ton-tile__wert">{tonAn ? "an" : "aus"}</div>
          </button>
          <StatTile label="HH / NOK / Anmeldungen" value={`${anzahlHH} / ${anzahlNOK} / ${anzahlAnmeldungen}`} />
        </div>
      </div>
      {offenesPanel === "meldungen" && <MeldungsListe meldungen={meldungen} />}
      {offenesPanel === "ag-planung" && <AgPlanungListe gruppen={agGruppen} />}
    </div>
  );
}
