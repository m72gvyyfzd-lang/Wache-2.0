import { useEffect, useMemo, useRef, useState } from "react";
import { getAbteilzeitSettings } from "@wache/core";
import { spieleAlarmTon } from "../lib/alarmTon";
import { berechneAgPlanung } from "../lib/agPlanung";
import { benoetigteLotsenAnzahl } from "../lib/coreJob";
import { berechneMeldungen, gruppiereMeldungen } from "../lib/meldungen";
import { useData } from "../state/DataContext";
import { AgPlanungTile } from "./AgPlanung";
import { MeldungsTile } from "./Meldungen";
import { MatrixTile, ZahlenTile } from "./ZahlenTile";
import { zeilenAusAbteilungen, zeilenAusSeestationLotsen } from "../lib/seestation";
import "./DashboardCard.css";

/** Welches der beiden Kachel-Panels gerade seine Detailliste zeigt — nur
 *  eins gleichzeitig (beide Listen ragen absolut positioniert über andere
 *  Kacheln und würden sich sonst überlagern). Die Meldungs-Kachel merkt sich
 *  zusätzlich, ob "alle" oder nur eine Gruppen-Art aufgeklappt ist. */
type OffenesPanel = { typ: "meldungen"; art: string } | { typ: "ag-planung" } | null;

const settings = getAbteilzeitSettings("Wechsel Tide");

interface DashboardCardProps {
  /** Ob der Alarm-Ton aktiv ist — Schalter dafür sitzt jetzt in der
   *  Uhrzeit-Kachel (ClockCard), der gemeinsame Zustand lebt in TopBar. */
  tonAn: boolean;
}

export function DashboardCard({ tonAn }: DashboardCardProps) {
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

  // Alarm-Ton: einmaliger Ton pro NEUEM Alarm (stabile Meldungs-IDs). Das
  // Entsperren des AudioContext geschieht zentral in TopBar; hier nur noch
  // das Abspielen bei neuen Alarmen.
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

  // Lotsen-Kennzahlen der Einsatzstation:
  // Abger. — abgerufene Lotsen, die noch an der Station stehen (abgeteilte
  //   sind aus der Einsatzstations-Liste verschwunden, siehe lotsenOrdnung).
  // Fahrw. — Lotsen im Revier (Versetzliste), ohne die ankernden.
  // SeeStn — Lotsen, die auf der Seestation angekommen sind (beide Quellen
  //   der Liste "Auf Seestation").
  const anzahlAbgerufen = lotsen.filter((l) => !l.abgeteilt && l.abgerufen).length;
  const anzahlFahrwasser = abteilungen.filter(
    (a) => a.vNr !== undefined && !a.aufSeestation && !a.ankert,
  ).length;
  const seeZeilen = [...zeilenAusAbteilungen(abteilungen), ...zeilenAusSeestationLotsen(seestationLotsen)];
  const anzahlAufSeestation = seeZeilen.filter((z) => z.aufStation).length;

  // Seestations-Kachel: ETAs in Zeitfenstern gegen die Lotsen, die bis dahin
  // auf Station sind. Die ETA-Fenster sind disjunkt (alles Fällige und
  // Überfällige fällt ins erste), die Lotsenzahlen dagegen kumulativ — wer
  // einmal auf Station ist, bleibt es auch in den späteren Fenstern.
  const STUNDE_MS = 3_600_000;
  const [grenze3, grenze6, grenze12] = [3, 6, 12].map((h) => jetzt.getTime() + h * STUNDE_MS);
  const etaZeiten = seeSchiffe.map((s) => s.eta.getTime());
  const etaFenster = [
    etaZeiten.filter((t) => t <= grenze3).length,
    etaZeiten.filter((t) => t > grenze3 && t <= grenze6).length,
    etaZeiten.filter((t) => t > grenze6 && t <= grenze12).length,
    etaZeiten.filter((t) => t > grenze12).length,
  ];
  const lotsenBis = (grenze: number) =>
    seeZeilen.filter((z) => z.aufStation || (z.etaStn !== undefined && z.etaStn.getTime() <= grenze)).length;
  // Letzte Spalte (">12h"): alle, die auf Station sind oder noch kommen.
  const lotsenFenster = [lotsenBis(grenze3), lotsenBis(grenze6), lotsenBis(grenze12), seeZeilen.length];

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
          <ZahlenTile
            label="Einsatzstation"
            testId="kachel-einsatzstation"
            breite="schmal"
            gruppen={[
              {
                titel: "Jobs",
                werte: [
                  { kuerzel: "HH", wert: anzahlHH },
                  { kuerzel: "NOK", wert: anzahlNOK },
                  { kuerzel: "Sonst.", wert: anzahlAnmeldungen },
                ],
              },
              {
                titel: "Lotsen",
                werte: [
                  { kuerzel: "Abger.", wert: anzahlAbgerufen },
                  { kuerzel: "Fahrw.", wert: anzahlFahrwasser },
                  { kuerzel: "SeeStn", wert: anzahlAufSeestation },
                ],
              },
            ]}
          />
          <MatrixTile
            label="Seestation"
            testId="kachel-seestation"
            breite="breit"
            spalten={["ges.", "+3h", "+6h", "+12h", "> 12h"]}
            zeilen={[
              { titel: "ETAs", werte: [seeSchiffe.length, ...etaFenster] },
              { titel: "ank. Lots.", werte: [null, ...lotsenFenster] },
              {
                titel: "Sauber",
                delta: true,
                werte: [null, ...lotsenFenster.map((l, i) => l - etaFenster[i])],
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
