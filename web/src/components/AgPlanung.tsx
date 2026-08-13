/** AG-Planungs-Karte: fasst offene AG-Fahrt-Empfehlungen nach Träger
 *  gruppiert zusammen (siehe lib/agPlanung.ts) — vermeidet, dass derselbe
 *  Trägervorschlag für jedes betroffene Schiff einzeln auftaucht. Gleiche
 *  Größe/Position wie die Meldungs-Kachel (siehe Meldungen.tsx) — bleibt
 *  daher auch ohne offene Gruppen sichtbar (leerer Zustand), damit das
 *  Dashboard-Raster nicht springt. */
import type { RefObject } from "react";
import type { AgPlanungsGruppe } from "../lib/agPlanung";
import "./Meldungen.css";

interface AgPlanungTileProps {
  gruppen: AgPlanungsGruppe[];
  offen: boolean;
  onToggle: () => void;
  containerRef: RefObject<HTMLDivElement | null>;
}

export function AgPlanungTile({ gruppen, offen, onToggle, containerRef }: AgPlanungTileProps) {
  const stufe = gruppen.length === 0 ? "leer" : gruppen.some((g) => g.stufe === "warnung") ? "warnung" : "vorschlag";
  return (
    <div
      ref={containerRef}
      className={`meldungs-tile meldungs-tile--${stufe}` + (offen ? " meldungs-tile--offen" : "")}
      onClick={onToggle}
    >
      <div className="meldungs-tile__kopf">
        <span className="meldungs-tile__label">AG-Planung</span>
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
    </div>
  );
}
