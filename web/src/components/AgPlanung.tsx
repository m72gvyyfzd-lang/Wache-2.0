/** AG-Planungs-Karte: fasst offene AG-Fahrt-Empfehlungen nach Träger
 *  gruppiert zusammen (siehe lib/agPlanung.ts) — vermeidet, dass derselbe
 *  Trägervorschlag für jedes betroffene Schiff einzeln auftaucht. Gleiche
 *  Größe/Position wie die Meldungs-Kachel (siehe Meldungen.tsx) — bleibt
 *  daher auch ohne offene Gruppen sichtbar (leerer Zustand), damit das
 *  Dashboard-Raster nicht springt.
 *
 *  Der dezente "Settings"-Knopf rechts in der Kopfzeile öffnet ein
 *  Bearbeitungsfenster für die drei Stellschrauben der Berechnung
 *  (Planungshorizont, Vorlauf-Ziel, Anfahrt zur Seestation) — siehe
 *  lib/seestation.ts::AgPlanungEinstellungen. Session-Override, wie die
 *  Zeitrechnungs-Kachel: "Reset" stellt sofort die Standardwerte wieder
 *  her, "Übernehmen" setzt die gewählten Werte. */
import { useState } from "react";
import type { RefObject } from "react";
import type { AgPlanungsGruppe } from "../lib/agPlanung";
import type { AgAnfahrtModus, AgPlanungEinstellungen } from "../lib/seestation";
import { Modal } from "./Modal";
import "./Meldungen.css";
import "./AgPlanung.css";

interface AgPlanungTileProps {
  gruppen: AgPlanungsGruppe[];
  offen: boolean;
  onToggle: () => void;
  containerRef: RefObject<HTMLDivElement | null>;
  einstellungen: AgPlanungEinstellungen;
  setEinstellungen: (einstellungen: AgPlanungEinstellungen) => void;
}

const HORIZONT_OPTIONEN: { wert: 9 | 12 | 18; label: string }[] = [
  { wert: 9, label: "9 Std" },
  { wert: 12, label: "12 Std" },
  { wert: 18, label: "18 Std" },
];

const VORLAUF_OPTIONEN: { wert: 1 | 2 | 3 | 4; label: string }[] = [
  { wert: 1, label: "1 Std" },
  { wert: 2, label: "2 Std" },
  { wert: 3, label: "3 Std" },
  { wert: 4, label: "4 Std" },
];

const ANFAHRT_OPTIONEN: { wert: AgAnfahrtModus; label: string }[] = [
  { wert: 3, label: "3 Std" },
  { wert: 3.5, label: "3,5 Std" },
  { wert: 4, label: "4 Std" },
  { wert: 4.5, label: "4,5 Std" },
  { wert: "auto", label: "Auto" },
];

/** Generische Switch-Zeile (Segmented Buttons) für einen der drei Werte. */
function EinstellungsSwitch<T extends string | number>({
  optionen,
  wert,
  onWahl,
}: {
  optionen: { wert: T; label: string }[];
  wert: T;
  onWahl: (wert: T) => void;
}) {
  return (
    <div className="ag-einstellungen__switch" role="group">
      {optionen.map((o) => (
        <button
          key={String(o.wert)}
          type="button"
          className={
            "ag-einstellungen__switch-btn" + (wert === o.wert ? " ag-einstellungen__switch-btn--aktiv" : "")
          }
          onClick={() => onWahl(o.wert)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function AgPlanungTile({ gruppen, offen, onToggle, containerRef, einstellungen, setEinstellungen }: AgPlanungTileProps) {
  const stufe = gruppen.length === 0 ? "leer" : gruppen.some((g) => g.stufe === "warnung") ? "warnung" : "vorschlag";

  const [settingsOffen, setSettingsOffen] = useState(false);
  const [draft, setDraft] = useState<AgPlanungEinstellungen>(einstellungen);

  function oeffneEinstellungen(e: React.MouseEvent) {
    e.stopPropagation();
    setDraft(einstellungen);
    setSettingsOffen(true);
  }

  function uebernehmen() {
    setEinstellungen(draft);
    setSettingsOffen(false);
  }

  function zuruecksetzen() {
    setEinstellungen({});
    setSettingsOffen(false);
  }

  return (
    <div
      ref={containerRef}
      className={`meldungs-tile meldungs-tile--${stufe}` + (offen ? " meldungs-tile--offen" : "")}
      onClick={onToggle}
    >
      <div className="meldungs-tile__kopf">
        <span className="meldungs-tile__label">AG-Planung</span>
        <button
          type="button"
          className="meldungs-tile__settings-btn"
          onClick={oeffneEinstellungen}
          title="Einstellungen der AG-Planung"
        >
          Settings
        </button>
        {gruppen.length > 0 && <span className={`meldungs-badge meldungs-badge--${stufe}`}>{gruppen.length}</span>}
      </div>
      <div className="meldungs-tile__gruppen">
        {gruppen.map((g) => (
          <div key={g.id} className="meldungs-tile__gruppe meldungs-tile__gruppe--statisch meldungs-tile__gruppe--mehrzeilig">
            <span className={`meldungs-punkt meldungs-punkt--${g.stufe}`} aria-hidden="true" />
            <span className="meldungs-tile__gruppe-text">
              {g.anzahl}× AG mit {g.empfehlung}
              {g.ueberWarteziel ? " ⚠️ Wartezeit > 6 Std." : ""}
            </span>
          </div>
        ))}
        {gruppen.length === 0 && <div className="meldungs-tile__leer">keine AG-Planung nötig</div>}
      </div>
      {offen && (
        <div className="meldungs-liste" onClick={(e) => e.stopPropagation()}>
          {gruppen.map((g) => (
            <div key={g.id} className="meldungs-liste__eintrag">
              <span className={`meldungs-punkt meldungs-punkt--${g.stufe}`} aria-hidden="true" />
              <span className="meldungs-liste__text">
                {g.anzahl}× AG mit {g.empfehlung}
                {g.ueberWarteziel ? " ⚠️ Wartezeit > 6 Std." : ""} — für {g.schiffsNamen.join(", ")}
              </span>
            </div>
          ))}
          {gruppen.length === 0 && <div className="meldungs-liste__leer">keine AG-Planung nötig</div>}
        </div>
      )}

      {settingsOffen && (
        <Modal title="AG-Planung: Einstellungen" onClose={() => setSettingsOffen(false)} maxWidth="380px" titelZentriert>
          <div className="job-form ag-einstellungen" onClick={(e) => e.stopPropagation()}>
            <div className="ag-einstellungen__zeile">
              <span className="ag-einstellungen__label">Planungshorizont</span>
              <EinstellungsSwitch
                optionen={HORIZONT_OPTIONEN}
                wert={draft.horizontStd ?? 12}
                onWahl={(wert) => setDraft({ ...draft, horizontStd: wert })}
              />
            </div>
            <div className="ag-einstellungen__zeile">
              <span className="ag-einstellungen__label">Vorlauf-Ziel</span>
              <EinstellungsSwitch
                optionen={VORLAUF_OPTIONEN}
                wert={draft.vorlaufZielStd ?? 1}
                onWahl={(wert) => setDraft({ ...draft, vorlaufZielStd: wert })}
              />
            </div>
            <div className="ag-einstellungen__zeile">
              <span className="ag-einstellungen__label">Anfahrt zur Seestation</span>
              <EinstellungsSwitch
                optionen={ANFAHRT_OPTIONEN}
                wert={draft.anfahrtModus ?? 3.5}
                onWahl={(wert) => setDraft({ ...draft, anfahrtModus: wert })}
              />
              <span className="ag-einstellungen__hinweis">
                Auto übernimmt die Fahrzeit des vorgeschlagenen Trägers aus der Brb-Matrix, sofern HW Brb bekannt ist
                — sonst gilt die 3,5-Std.-Pauschale.
              </span>
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
    </div>
  );
}
