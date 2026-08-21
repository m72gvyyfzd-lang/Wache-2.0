/**
 * Settings-Kachel "Zeitrechnung": macht sichtbar (und im manuellen Modus
 * einstellbar), mit welchen Fahrzeiten die App die Abteil- und
 * Seestations-Zeiten rechnet.
 *
 * Rechts oben der Umschalter manuell/automatisch: automatisch =
 * Matrix-Rechnung über das HW-Paar Brunsbüttel, manuell = die festen
 * Fallback-Offsets. Ohne eingetragene HW-Zeiten ist die Matrix nicht
 * rechenbar — der wirksame Modus ist dann zwingend "manuell" (siehe
 * DataContext).
 *
 * Darunter ein Zeitstrahl FkW … Stade … Abt.Brb … Brb … SeeStn. Die
 * Strecken-Knöpfe ("FkW-Brb", "Stade-Brb", "Brb-SeeStn") spannen sich
 * räumlich über ihren Abschnitt und zeigen die aktuell wirksame Dauer: im
 * manuellen Modus den Fallback-Offset (bzw. den Session-Override), im
 * automatischen die Matrix-Werte für eine Abfahrt JETZT — aufgeschlüsselt
 * nach den drei Geschwindigkeitsklassen slow/normal/fast, wandernd mit
 * der Tide. Über dem Abschnitt Abt.Brb → Brb sitzt der in BEIDEN Modi
 * aktive Knopf "Abt. > Abf. Brb" mit den Herkunfts-Offsets (HH/NOK/EHF)
 * bis zur Abfahrt Tn_59 — diese Offsets stecken auch in der
 * Matrix-Rechnung, deshalb bleibt der Knopf immer bedienbar.
 *
 * Ein Klick öffnet das jeweilige Override-Fenster: Dropdown(s) in
 * 15-Minuten-Schritten, "Übernehmen" setzt die Werte für die laufende
 * Sitzung, "Reset" stellt die Standards wieder her. Die
 * Fallback-Konstanten im Code bleiben unverändert; Settings-Reset und
 * "Neue Wache" setzen alles zurück (siehe DataContext.resetAlles).
 */
import { useEffect, useMemo, useState } from "react";
import {
  berechneBrbPrognose,
  berechneSeePrognose,
  getAbteilzeitSettings,
  SEE_ABFAHRT_OFFSET_MIN,
} from "@wache/core";
import type { Geschwindigkeitsklasse, HwBrb, SeeHerkunft } from "@wache/core";
import { SEE_PAUSCHALE_STANDARD_MIN } from "../lib/coreJob";
import { Modal } from "./Modal";
import { useData } from "../state/DataContext";
import "./Zeitrechnung.css";

const settings = getAbteilzeitSettings("Wechsel Tide");

/** Standard-Fallback-Offsets in Minuten (aus dem Settings-Blatt bzw. der
 *  Brb→SeeStn-Pauschale). */
const STANDARD_MIN = {
  fkw: settings.fkwAbteilung.stunden * 60 + settings.fkwAbteilung.minuten,
  stade: settings.stadeAbteilung.stunden * 60 + settings.stadeAbteilung.minuten,
  see: SEE_PAUSCHALE_STANDARD_MIN,
};

/** Wählbare Override-Werte: 15-Minuten-Raster über die vorgegebene
 *  Spanne. Liegt der Standardwert nicht im Raster (z.B. der EHF-Offset
 *  0:40), wird er als eigene Option einsortiert — sonst ließe sich der
 *  Standard im Dropdown gar nicht auswählen. */
function optionen(vonMin: number, bisMin: number, standard: number): number[] {
  const werte: number[] = [];
  for (let m = vonMin; m <= bisMin; m += 15) werte.push(m);
  if (!werte.includes(standard)) werte.push(standard);
  return werte.sort((a, b) => a - b);
}

const OPTIONEN = {
  fkw: optionen(165, 285, STANDARD_MIN.fkw), // 02:45 … 04:45
  stade: optionen(45, 120, STANDARD_MIN.stade), // 00:45 … 02:00
  see: optionen(150, 270, STANDARD_MIN.see), // 02:30 … 04:30
};

/** Herkunfts-Offset-Dropdowns: 00:15 … 01:30. */
const OFFSET_OPTIONEN: Record<SeeHerkunft, number[]> = {
  HH: optionen(15, 90, SEE_ABFAHRT_OFFSET_MIN.HH),
  NOK: optionen(15, 90, SEE_ABFAHRT_OFFSET_MIN.NOK),
  VNR: optionen(15, 90, SEE_ABFAHRT_OFFSET_MIN.VNR),
};

function formatMin(minuten: number): string {
  const h = Math.floor(minuten / 60);
  const m = Math.round(minuten % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type Strecke = "fkw" | "stade" | "see";
type DialogArt = Strecke | "offsets";

const STRECKEN_LABEL: Record<Strecke, string> = {
  fkw: "FkW-Brb",
  stade: "Stade-Brb",
  see: "Brb-SeeStn",
};

const OVERRIDE_FELD: Record<Strecke, "fkwMin" | "stadeMin" | "seeMin"> = {
  fkw: "fkwMin",
  stade: "stadeMin",
  see: "seeMin",
};

/** Anzeige-Reihenfolge und Beschriftung der Herkunfts-Offsets. */
const OFFSET_ZEILEN: { herkunft: SeeHerkunft; label: string }[] = [
  { herkunft: "HH", label: "von HH" },
  { herkunft: "NOK", label: "aus NOK" },
  { herkunft: "VNR", label: "von EHF" },
];

/** Geschwindigkeitsklassen mit den UI-Kurzlabels (wie im Speed-Dropdown). */
const KLASSEN: { klasse: Geschwindigkeitsklasse; label: string }[] = [
  { klasse: "langsam", label: "slow" },
  { klasse: "normal", label: "normal" },
  { klasse: "schnell", label: "fast" },
];

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

  // Minuten-Tick: die Matrix-Werte gelten für eine Abfahrt JETZT und
  // wandern mit der Tide — ohne Tick bliebe die Anzeige stehen.
  const [jetzt, setJetzt] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setJetzt(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const [dialog, setDialog] = useState<DialogArt | null>(null);
  const [auswahl, setAuswahl] = useState<number>(STANDARD_MIN.fkw);
  const [offsetAuswahl, setOffsetAuswahl] = useState<Record<SeeHerkunft, number>>({ ...SEE_ABFAHRT_OFFSET_MIN });

  const hw: HwBrb | undefined = useMemo(
    () => (zeitModus === "automatisch" && hwBrb.hw1 ? { hw1: hwBrb.hw1, hw2: hwBrb.hw2 } : undefined),
    [zeitModus, hwBrb],
  );

  /** Wirksamer Herkunfts-Offset (Session-Override vor Standard). */
  const offsetWert = (herkunft: SeeHerkunft) => zeitOverrides.offsetMin?.[herkunft] ?? SEE_ABFAHRT_OFFSET_MIN[herkunft];

  /** Matrix-Aufschlüsselung slow/normal/fast je Strecke für eine Abfahrt
   *  JETZT — nur im automatischen Modus. FkW/Stade laufen über die echte
   *  Prognose-Kette (inkl. Betriebs-Korrektur), die See-Strecke über die
   *  See-Tabelle mit Offset 0 (reine Fahrzeit Tn_59 → Tn_5). */
  const matrixWerte = useMemo(() => {
    if (!hw) return undefined;
    const jeKlasse = (rechne: (klasse: Geschwindigkeitsklasse) => number | undefined) =>
      KLASSEN.map(({ klasse, label }) => ({ label, min: rechne(klasse) }));
    const brb = (job: Parameters<typeof berechneBrbPrognose>[0]) => (klasse: Geschwindigkeitsklasse) => {
      const p = berechneBrbPrognose({ ...job, geschwindigkeitsklasse: klasse }, hw);
      return p ? Math.round((p.abteilzeit.getTime() - jetzt.getTime()) / 60_000) : undefined;
    };
    return {
      fkw: jeKlasse(brb({ jobNr: 0, routentyp: "HH", fkwTickerAbgang: jetzt })),
      stade: jeKlasse(brb({ jobNr: 0, routentyp: "HH", stadeKuden: jetzt })),
      see: jeKlasse((klasse) => berechneSeePrognose(jetzt, "HH", klasse, hw, 0).fahrzeitMin),
    };
  }, [hw, jetzt]);

  /** Manuell wirksame Dauer je Strecke in Minuten. */
  const manuellMin = (strecke: Strecke) => zeitOverrides[OVERRIDE_FELD[strecke]] ?? STANDARD_MIN[strecke];

  function oeffneDialog(strecke: Strecke) {
    if (zeitModus !== "manuell") return;
    setAuswahl(manuellMin(strecke));
    setDialog(strecke);
  }

  function oeffneOffsetDialog() {
    setOffsetAuswahl({ HH: offsetWert("HH"), NOK: offsetWert("NOK"), VNR: offsetWert("VNR") });
    setDialog("offsets");
  }

  function uebernehmen() {
    if (!dialog) return;
    if (dialog === "offsets") {
      // Nur Abweichungen vom Standard werden als Override gespeichert.
      const eintraege = (Object.keys(offsetAuswahl) as SeeHerkunft[]).filter(
        (h) => offsetAuswahl[h] !== SEE_ABFAHRT_OFFSET_MIN[h],
      );
      setZeitOverrides({
        ...zeitOverrides,
        offsetMin: eintraege.length
          ? Object.fromEntries(eintraege.map((h) => [h, offsetAuswahl[h]]))
          : undefined,
      });
    } else {
      // Der Standardwert braucht keinen Override — dann bleibt die Anzeige
      // auch ohne Sternchen sauber auf Standard.
      setZeitOverrides({
        ...zeitOverrides,
        [OVERRIDE_FELD[dialog]]: auswahl === STANDARD_MIN[dialog] ? undefined : auswahl,
      });
    }
    setDialog(null);
  }

  function zuruecksetzen() {
    if (!dialog) return;
    if (dialog === "offsets") {
      setZeitOverrides({ ...zeitOverrides, offsetMin: undefined });
    } else {
      setZeitOverrides({ ...zeitOverrides, [OVERRIDE_FELD[dialog]]: undefined });
    }
    setDialog(null);
  }

  const istOverride = (strecke: Strecke) =>
    zeitModus === "manuell" && zeitOverrides[OVERRIDE_FELD[strecke]] !== undefined;

  function streckenKnopf(strecke: Strecke, klasse: string) {
    const werte = matrixWerte?.[strecke];
    return (
      <button
        type="button"
        className={`zeitrechnung__strecke ${klasse}` + (zeitModus === "manuell" ? " zeitrechnung__strecke--editierbar" : "")}
        onClick={() => oeffneDialog(strecke)}
        title={
          zeitModus === "manuell"
            ? "manuellen Wert für diese Strecke setzen"
            : "Matrix-Werte für eine Abfahrt jetzt (wandern mit der Tide)"
        }
      >
        <span className="zeitrechnung__strecke-name">{STRECKEN_LABEL[strecke]}</span>
        {werte ? (
          <span className="zeitrechnung__strecke-klassen">
            {werte.map(({ label, min }) => (
              <span key={label} className="zeitrechnung__klasse">
                <span className="zeitrechnung__klasse-label">{label}</span>{" "}
                {min !== undefined ? formatMin(min) : "–"}
              </span>
            ))}
          </span>
        ) : (
          <span className="zeitrechnung__strecke-wert">
            {formatMin(manuellMin(strecke))}
            {istOverride(strecke) && <span className="zeitrechnung__override-stern">*</span>}
          </span>
        )}
      </button>
    );
  }

  return (
    <section className="zeitrechnung" data-testid="kachel-zeitrechnung">
      <div className="zeitrechnung__kopf">
        <h3 className="zeitrechnung__titel">Zeitrechnung</h3>
        <div className="zeitrechnung__modus-box">
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
      </div>

      <div className="zeitrechnung__strahl">
        <div className="zeitrechnung__ebenen">
          {/* Ebene 1: FkW → Abt.Brb und Brb → SeeStn */}
          <div className="zeitrechnung__ebene">
            {streckenKnopf("fkw", "zeitrechnung__strecke--fkw")}
            {streckenKnopf("see", "zeitrechnung__strecke--see")}
          </div>
          {/* Ebene 2: Stade → Abt.Brb */}
          <div className="zeitrechnung__ebene">{streckenKnopf("stade", "zeitrechnung__strecke--stade")}</div>
          {/* Herkunfts-Offsets (immer aktiv): spannt sich über beide Ebenen
              und schließt unten bündig mit den Strecken-Knöpfen ab. */}
          <button
            type="button"
            className="zeitrechnung__strecke zeitrechnung__strecke--offsets zeitrechnung__strecke--editierbar"
            onClick={oeffneOffsetDialog}
            title="Herkunfts-Offsets Abteilung → Abfahrt Brb setzen"
          >
            <span className="zeitrechnung__offsets-titel">Abt. &gt; Abf. Brb</span>
            <span className="zeitrechnung__offsets-grid">
              {OFFSET_ZEILEN.map(({ herkunft, label }) => (
                <span key={herkunft} className="zeitrechnung__offsets-reihe">
                  <span className="zeitrechnung__offsets-label">{label}</span>
                  <span className="zeitrechnung__offsets-wert">
                    : {formatMin(offsetWert(herkunft))}
                    {zeitOverrides.offsetMin?.[herkunft] !== undefined && (
                      <span className="zeitrechnung__override-stern">*</span>
                    )}
                  </span>
                </span>
              ))}
              <span className="zeitrechnung__offsets-reihe">
                <span className="zeitrechnung__offsets-label">Sonstige</span>
                <span className="zeitrechnung__offsets-wert">: –</span>
              </span>
            </span>
          </button>
        </div>
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

      {dialog && dialog !== "offsets" && (
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

      {dialog === "offsets" && (
        <Modal title="Manueller Wert" onClose={() => setDialog(null)} maxWidth="440px" titelZentriert>
          <div className="job-form zeitrechnung__dialog">
            <p className="zeitrechnung__dialog-strecke">Abt. &gt; Abf. Brb</p>
            {/* 2x2: von HH neben von EHF, darunter aus NOK neben Sonstige */}
            <div className="zeitrechnung__offset-raster">
              {(["HH", "VNR"] as const).map((herkunft) => (
                <label key={herkunft} className="zeitrechnung__offset-feld">
                  <span>{OFFSET_ZEILEN.find((z) => z.herkunft === herkunft)!.label}</span>
                  <select
                    value={offsetAuswahl[herkunft]}
                    onChange={(e) => setOffsetAuswahl({ ...offsetAuswahl, [herkunft]: Number(e.target.value) })}
                  >
                    {OFFSET_OPTIONEN[herkunft].map((m) => (
                      <option key={m} value={m}>
                        {formatMin(m)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label className="zeitrechnung__offset-feld">
                <span>aus NOK</span>
                <select
                  value={offsetAuswahl.NOK}
                  onChange={(e) => setOffsetAuswahl({ ...offsetAuswahl, NOK: Number(e.target.value) })}
                >
                  {OFFSET_OPTIONEN.NOK.map((m) => (
                    <option key={m} value={m}>
                      {formatMin(m)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="zeitrechnung__offset-feld zeitrechnung__offset-feld--inaktiv">
                <span>Sonstige</span>
                <select disabled value="">
                  <option value="">–</option>
                </select>
              </label>
            </div>
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
