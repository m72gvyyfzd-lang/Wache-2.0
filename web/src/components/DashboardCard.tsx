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
import { seeLotsenAnzahl } from "../lib/seestationAbteilen";
import { vorschauZeilen } from "../lib/vorschau";
import { formatUhrzeit } from "../lib/format";
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
    vorschau,
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
  // Fahrw. — unterwegs zur Seestation, ohne die ankernden.
  // SeeStn — bereits auf der Seestation angekommen.
  // Fahrw. und SeeStn teilen dieselbe Quelle (die Liste "Auf Seestation",
  // gespeist aus Versetzliste UND manuell/importiert angelegten Lotsen) und
  // unterscheiden sich nur darin, ob der Lotse schon da ist. Der Import
  // legt die Lotsen vor dem Marker genau so an: fett = auf Station, sonst
  // noch auf dem Weg.
  const anzahlAbgerufen = lotsen.filter((l) => !l.abgeteilt && l.abgerufen).length;
  const seeZeilen = [...zeilenAusAbteilungen(abteilungen), ...zeilenAusSeestationLotsen(seestationLotsen)];
  const anzahlFahrwasser = seeZeilen.filter((z) => !z.aufStation).length;
  const anzahlAufSeestation = seeZeilen.filter((z) => z.aufStation).length;

  // Seestations-Kachel: die Lage zu drei Zeitpunkten (in 3, 6 und 12 Std.)
  // plus Gesamtstand. Alle Zeilen sind kumulativ — sie beantworten "wie
  // steht es BIS zu dieser Uhrzeit", nicht "was passiert in diesem Fenster".
  // Die Zeitpunkte liegen auf halben Stunden: die laufende Zeit wird auf die
  // letzte halbe Stunde abgerundet, dann der Abstand addiert (13:14 → 16:00,
  // 13:30 → 16:30).
  const HALBE_STUNDE_MS = 1_800_000;
  const basis = Math.floor(jetzt.getTime() / HALBE_STUNDE_MS) * HALBE_STUNDE_MS;
  const zeitpunkte = [3, 6, 12].map((h) => basis + h * 2 * HALBE_STUNDE_MS);
  // Letzte Spalte "ges." = ohne Zeitgrenze.
  const grenzen = [...zeitpunkte, Number.POSITIVE_INFINITY];

  // Schiffe, die noch Lotsen brauchen — vollständig abgeteilte zählen nicht
  // mehr mit (dieselbe Regel wie die ETA-Liste der Seestations-Seite).
  const abgeteiltProSchiff = new Map<number, number>();
  for (const sa of seeAbteilungen) {
    abgeteiltProSchiff.set(sa.seeSchiffId, (abgeteiltProSchiff.get(sa.seeSchiffId) ?? 0) + 1);
  }
  const offeneSchiffe = seeSchiffe
    .map((s) => ({ eta: s.eta.getTime(), fehlt: seeLotsenAnzahl(s) - (abgeteiltProSchiff.get(s.id) ?? 0) }))
    .filter((s) => s.fehlt > 0);
  const etaZeile = grenzen.map((t) => offeneSchiffe.filter((s) => s.eta <= t).length);
  const bedarfZeile = grenzen.map((t) =>
    offeneSchiffe.filter((s) => s.eta <= t).reduce((summe, s) => summe + s.fehlt, 0),
  );

  // Verfügbar = auf Station oder bis dahin dort. seeZeilen enthält bereits
  // nur die zählenden Lotsen (abgeschöpfte, see-abgeteilte und ankernde
  // sind ausgefiltert, siehe lib/seestation.ts).
  const verfuegbarBis = (zeilen: typeof seeZeilen, t: number) =>
    zeilen.filter((z) => z.aufStation || (z.etaStn !== undefined && z.etaStn.getTime() <= t)).length;
  const verfuegbarZeile = grenzen.map((t) => verfuegbarBis(seeZeilen, t));

  // Vorschau: zusätzlich die Lotsen der Einsatzstation, die mit ihrem Job
  // ohnehin zur Seestation kommen. Sie werden in der Bilanz mitgerechnet
  // und in der Verfügbar-Zeile orange in Klammern ausgewiesen.
  const projizierte = vorschau
    ? vorschauZeilen(jobs, lotsen, aktuelleFahrt, abteilungen, settings, vNrStart, verbrauchteVNrn, jetzt).verplante
    : [];
  const projiziertZeile = grenzen.map((t) => verfuegbarBis(projizierte, t));
  const bilanzZeile = grenzen.map((_, i) => verfuegbarZeile[i] + projiziertZeile[i] - bedarfZeile[i]);

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
            spalten={[...zeitpunkte.map((t) => formatUhrzeit(new Date(t))), "ges."]}
            zeilen={[
              { titel: "ETAs", werte: etaZeile },
              { titel: "Lots. bedarf", werte: bedarfZeile },
              { titel: "Lots. verf.", werte: verfuegbarZeile, zusaetze: projiziertZeile },
              { titel: "Bilanz", werte: bilanzZeile, bilanz: true },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
