/**
 * Settings-Kachel "Zeitrechnung": macht sichtbar (und im manuellen Modus
 * einstellbar), mit welchen Fahrzeiten die App die Abteilzeiten rechnet.
 *
 * Oben der Umschalter manuell/automatisch: automatisch = Matrix-Rechnung
 * über das HW-Paar Brunsbüttel, manuell = die festen Fallback-Offsets.
 * Ohne eingetragene HW-Zeiten ist die Matrix nicht rechenbar — der
 * wirksame Modus ist dann zwingend "manuell" (siehe DataContext).
 *
 * Darunter ein Zeitstrahl FkW … Stade … Abt.Brb … Brb … SeeStn. Die
 * Strecken-Knöpfe ("FkW-Brb", "Stade-Brb") spannen sich räumlich über
 * ihren Abschnitt und zeigen die aktuell wirksame Dauer bis zur
 * Abteilzeit: im manuellen Modus den Fallback-Offset (bzw. den
 * Session-Override), im automatischen den Matrix-Wert für eine Abfahrt
 * JETZT — der wandert mit der Tide.
 *
 * Ein Klick auf einen Strecken-Knopf öffnet im manuellen Modus das
 * Override-Fenster: Dropdown in 15-Minuten-Schritten, "Übernehmen" setzt
 * den Wert für die laufende Sitzung, "Reset" stellt den Standard wieder
 * her. Die Fallback-Konstanten im Code bleiben unverändert.
 */
import { useEffect, useMemo, useState } from "react";
import { berechneBrbPrognose, getAbteilzeitSettings } from "@wache/core";
import type { HwBrb } from "@wache/core";
import { Modal } from "./Modal";
import { useData } from "../state/DataContext";
import "./Zeitrechnung.css";

const settings = getAbteilzeitSettings("Wechsel Tide");

/** Standard-Fallback-Offsets in Minuten (aus dem Settings-Blatt). */
const STANDARD_MIN = {
  fkw: settings.fkwAbteilung.stunden * 60 + settings.fkwAbteilung.minuten,
  stade: settings.stadeAbteilung.stunden * 60 + settings.stadeAbteilung.minuten,
};

/** Wählbare Override-Werte: 15-Minuten-Raster über die vorgegebene
 *  Spanne. Liegt der Standardwert nicht im Raster (Stade: 1:05), wird er
 *  als eigene Option einsortiert — sonst ließe sich der Standard im
 *  Dropdown gar nicht auswählen. */
function optionen(vonMin: number, bisMin: number, standard: number): number[] {
  const werte: number[] = [];
  for (let m = vonMin; m <= bisMin; m += 15) werte.push(m);
  if (!werte.includes(standard)) werte.push(standard);
  return werte.sort((a, b) => a - b);
}

const OPTIONEN = {
  fkw: optionen(165, 285, STANDARD_MIN.fkw), // 02:45 … 04:45
  stade: optionen(45, 120, STANDARD_MIN.stade), // 00:45 … 02:00
};

function formatMin(minuten: number): string {
  const h = Math.floor(minuten / 60);
  const m = Math.round(minuten % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type Strecke = "fkw" | "stade";

const STRECKEN_LABEL: Record<Strecke, string> = { fkw: "FkW-Brb", stade: "Stade-Brb" };

/** Punkte des Zeitstrahls: Position in % der Linienbreite; "voll" =
 *  ausgefüllter Punkt, sonst nur Rahmen. Brb liegt auf 1/4 der Distanz
 *  zwischen Abt.Brb (50 %) und SeeStn (100 %). */
const PUNKTE: { label: string; pos: number; voll: boolean }[] = [
  { label: "FkW", pos: 0, voll: true },
  { label: "Stade", pos: 25, voll: false },
  { label: "Abt.Brb", pos: 50, voll: false },
  { label: "Brb", pos: 62.5, voll: true },
  { label: "SeeStn", pos: 100, voll: true },
];

export function Zeitrechnung() {
  const { hwBrb, zeitModus, zeitAutomatikMoeglich, setZeitModus, zeitOverrides, setZeitOverrides } = useData();

  // Minuten-Tick: der Matrix-Wert gilt für eine Abfahrt JETZT und wandert
  // mit der Tide — ohne Tick bliebe die Anzeige stehen.
  const [jetzt, setJetzt] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setJetzt(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const [dialog, setDialog] = useState<Strecke | null>(null);
  const [auswahl, setAuswahl] = useState<number>(STANDARD_MIN.fkw);

  /** Aktuell wirksame Dauer Meldepunkt → Abteilzeit in Minuten. */
  const dauerMin = useMemo(() => {
    if (zeitModus === "automatisch" && hwBrb.hw1) {
      const hw: HwBrb = { hw1: hwBrb.hw1, hw2: hwBrb.hw2 };
      // Synthetischer HH-Job mit Meldung JETZT — exakt die echte
      // Rechenkette inkl. Betriebs-Korrektur, je Meldepunkt.
      const rechne = (job: Parameters<typeof berechneBrbPrognose>[0]) => {
        const p = berechneBrbPrognose(job, hw);
        return p ? Math.round((p.abteilzeit.getTime() - jetzt.getTime()) / 60_000) : undefined;
      };
      return {
        fkw: rechne({ jobNr: 0, routentyp: "HH", fkwTickerAbgang: jetzt }) ?? STANDARD_MIN.fkw,
        stade: rechne({ jobNr: 0, routentyp: "HH", stadeKuden: jetzt }) ?? STANDARD_MIN.stade,
      };
    }
    return {
      fkw: zeitOverrides.fkwMin ?? STANDARD_MIN.fkw,
      stade: zeitOverrides.stadeMin ?? STANDARD_MIN.stade,
    };
  }, [zeitModus, hwBrb, zeitOverrides, jetzt]);

  function oeffneDialog(strecke: Strecke) {
    if (zeitModus !== "manuell") return;
    setAuswahl((strecke === "fkw" ? zeitOverrides.fkwMin : zeitOverrides.stadeMin) ?? STANDARD_MIN[strecke]);
    setDialog(strecke);
  }

  function uebernehmen() {
    if (!dialog) return;
    const feld = dialog === "fkw" ? "fkwMin" : "stadeMin";
    // Der Standardwert braucht keinen Override — dann bleibt die Anzeige
    // auch ohne Sternchen sauber auf Standard.
    setZeitOverrides({ ...zeitOverrides, [feld]: auswahl === STANDARD_MIN[dialog] ? undefined : auswahl });
    setDialog(null);
  }

  function zuruecksetzen() {
    if (!dialog) return;
    const feld = dialog === "fkw" ? "fkwMin" : "stadeMin";
    setZeitOverrides({ ...zeitOverrides, [feld]: undefined });
    setDialog(null);
  }

  const istOverride = (strecke: Strecke) =>
    zeitModus === "manuell" &&
    (strecke === "fkw" ? zeitOverrides.fkwMin : zeitOverrides.stadeMin) !== undefined;

  function streckenKnopf(strecke: Strecke, klasse: string) {
    return (
      <button
        type="button"
        className={`zeitrechnung__strecke ${klasse}` + (zeitModus === "manuell" ? " zeitrechnung__strecke--editierbar" : "")}
        onClick={() => oeffneDialog(strecke)}
        title={
          zeitModus === "manuell"
            ? "manuellen Wert für diese Strecke setzen"
            : "Matrix-Wert für eine Abfahrt jetzt (wandert mit der Tide)"
        }
      >
        <span className="zeitrechnung__strecke-name">{STRECKEN_LABEL[strecke]}</span>
        <span className="zeitrechnung__strecke-wert">
          {formatMin(dauerMin[strecke])}
          {istOverride(strecke) && <span className="zeitrechnung__override-stern">*</span>}
        </span>
      </button>
    );
  }

  return (
    <section className="zeitrechnung" data-testid="kachel-zeitrechnung">
      <div className="zeitrechnung__kopf">
        <h3 className="zeitrechnung__titel">Zeitrechnung</h3>
        <div className="zeitrechnung__modus" role="group" aria-label="Berechnungsmodus">
          <button
            type="button"
            className={"zeitrechnung__modus-btn" + (zeitModus === "manuell" ? " zeitrechnung__modus-btn--aktiv" : "")}
            onClick={() => setZeitModus("manuell")}
          >
            manuell
          </button>
          <button
            type="button"
            className={
              "zeitrechnung__modus-btn" + (zeitModus === "automatisch" ? " zeitrechnung__modus-btn--aktiv" : "")
            }
            disabled={!zeitAutomatikMoeglich}
            title={zeitAutomatikMoeglich ? undefined : "erst HW Brunsbüttel eintragen"}
            onClick={() => setZeitModus("automatisch")}
          >
            automatisch
          </button>
        </div>
        {!zeitAutomatikMoeglich && (
          <span className="zeitrechnung__hinweis">ohne HW-Zeiten nur manuell möglich</span>
        )}
      </div>

      <div className="zeitrechnung__strahl">
        {/* Ebene 1: FkW → Abt.Brb */}
        <div className="zeitrechnung__ebene">{streckenKnopf("fkw", "zeitrechnung__strecke--fkw")}</div>
        {/* Ebene 2: Stade → Abt.Brb */}
        <div className="zeitrechnung__ebene">{streckenKnopf("stade", "zeitrechnung__strecke--stade")}</div>
        {/* Ebene 3: Linie mit Wegpunkten */}
        <div className="zeitrechnung__linie-zeile">
          <div className="zeitrechnung__linie" />
          {PUNKTE.map((p) => (
            <div key={p.label} className="zeitrechnung__punkt-halter" style={{ left: `${p.pos}%` }}>
              <span className={"zeitrechnung__punkt-label" + (p.voll ? " zeitrechnung__punkt-label--fett" : "")}>
                {p.label}
              </span>
              <span className={"zeitrechnung__punkt" + (p.voll ? " zeitrechnung__punkt--voll" : "")} />
            </div>
          ))}
        </div>
      </div>

      {dialog && (
        <Modal title="Manueller Wert" onClose={() => setDialog(null)} maxWidth="300px" titelZentriert>
          <div className="job-form zeitrechnung__dialog">
            <p className="zeitrechnung__dialog-strecke">{STRECKEN_LABEL[dialog]}</p>
            <select value={auswahl} onChange={(e) => setAuswahl(Number(e.target.value))}>
              {OPTIONEN[dialog].map((m) => (
                <option key={m} value={m}>
                  {formatMin(m)}
                </option>
              ))}
            </select>
            <div className="job-form__actions">
              <button type="button" className="btn" onClick={zuruecksetzen}>
                Reset
              </button>
              <span className="job-form__spacer" />
              <button type="button" className="btn btn--accent" onClick={uebernehmen}>
                Übernehmen
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
