import { useEffect, useMemo, useRef, useState } from "react";
import { getAbteilzeitSettings } from "@wache/core";
import { spieleAlarmTon, tonEntsperren } from "../lib/alarmTon";
import { berechneAgPlanung } from "../lib/agPlanung";
import { benoetigteLotsenAnzahl } from "../lib/coreJob";
import { berechneMeldungen, gruppiereMeldungen } from "../lib/meldungen";
import { ladeAlarmTonAktiv, speichereAlarmTonAktiv } from "../state/storage";
import { useData } from "../state/DataContext";
import { AgPlanungTile } from "./AgPlanung";
import { MeldungsTile } from "./Meldungen";
import { StatTile } from "./StatTile";
import "./DashboardCard.css";

/** Welches der beiden Kachel-Panels gerade seine Detailliste zeigt — nur
 *  eins gleichzeitig (beide Listen ragen absolut positioniert über andere
 *  Kacheln und würden sich sonst überlagern). Die Meldungs-Kachel merkt sich
 *  zusätzlich, ob "alle" oder nur eine Gruppen-Art aufgeklappt ist. */
type OffenesPanel = { typ: "meldungen"; art: string } | { typ: "ag-planung" } | null;

const settings = getAbteilzeitSettings("Wechsel Tide");

export function DashboardCard() {
  const {
    jobs,
    lotsen,
    aktuelleFahrt,
    abteilungen,
    seeSchiffe,
    seestationLotsen,
    seeAbteilungen,
    vNrStart,
    verbrauchteVNrn,
  } = useData();

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
  const meldungsGruppen = useMemo(() => gruppiereMeldungen(meldungen), [meldungen]);

  const [offenesPanel, setOffenesPanel] = useState<OffenesPanel>(null);
  const meldungenRef = useRef<HTMLDivElement>(null);
  const agPlanungRef = useRef<HTMLDivElement>(null);

  // Klick außerhalb der offenen Kachel (bzw. ihrer Detailliste, die als
  // DOM-Kind darin liegt) schließt sie wieder.
  useEffect(() => {
    if (!offenesPanel) return;
    const ref = offenesPanel.typ === "meldungen" ? meldungenRef : agPlanungRef;
    function schliessenBeiAussenklick(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOffenesPanel(null);
    }
    document.addEventListener("pointerdown", schliessenBeiAussenklick);
    return () => document.removeEventListener("pointerdown", schliessenBeiAussenklick);
  }, [offenesPanel]);

  function toggleAlleMeldungen() {
    setOffenesPanel((p) => (p?.typ === "meldungen" && p.art === "" ? null : { typ: "meldungen", art: "" }));
  }
  function toggleMeldungsGruppe(art: string) {
    setOffenesPanel((p) => (p?.typ === "meldungen" && p.art === art ? null : { typ: "meldungen", art }));
  }
  function toggleAgPlanung() {
    setOffenesPanel((p) => (p?.typ === "ag-planung" ? null : { typ: "ag-planung" }));
  }
  const meldungenAktiv = offenesPanel?.typ === "meldungen" ? offenesPanel.art : null;

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

  // Nur noch nicht (vollständig) abgeteilte Jobs zählen — dieselbe
  // Sichtbarkeits-Regel wie auf Tafel Brb selbst (siehe Jobs.tsx::sichtbar).
  const abgeteiltProJobZaehlung = new Map<number, number>();
  for (const a of abteilungen) abgeteiltProJobZaehlung.set(a.jobId, (abgeteiltProJobZaehlung.get(a.jobId) ?? 0) + 1);
  const offeneJobs = jobs.filter(
    (j) => benoetigteLotsenAnzahl(j) - (abgeteiltProJobZaehlung.get(j.id) ?? 0) > 0,
  );
  const anzahlHH = offeneJobs.filter((j) => j.liste === "hamburg").length;
  const anzahlNOK = offeneJobs.filter((j) => j.liste === "nok").length;
  const anzahlAnmeldungen = offeneJobs.filter((j) => j.liste === "andere").length;

  return (
    <div className="dashboard-card">
      <div className="dashboard-card__scroll">
        <div className="dashboard-card__stats">
          <MeldungsTile
            gruppen={meldungsGruppen}
            aktiv={meldungenAktiv}
            onAlle={toggleAlleMeldungen}
            onGruppe={toggleMeldungsGruppe}
            containerRef={meldungenRef}
          />
          <AgPlanungTile
            gruppen={agGruppen}
            offen={offenesPanel?.typ === "ag-planung"}
            onToggle={toggleAgPlanung}
            containerRef={agPlanungRef}
          />
          <StatTile label="HH / NOK / Sonstige" value={`${anzahlHH} / ${anzahlNOK} / ${anzahlAnmeldungen}`} />
          <span className="dashboard-card__spacer" />
          <button
            type="button"
            className={"ton-tile" + (tonAn ? " ton-tile--an" : "")}
            onClick={handleTonToggle}
            title="Alarm-Ton ein-/ausschalten"
          >
            <div className="ton-tile__label">Alarm-Ton</div>
            <div className="ton-tile__wert">{tonAn ? "an" : "aus"}</div>
          </button>
        </div>
      </div>
    </div>
  );
}
