/** AG-Planungs-Karte: fasst offene AG-Fahrt-Empfehlungen nach Träger
 *  gruppiert zusammen (siehe lib/agPlanung.ts) — vermeidet, dass derselbe
 *  Trägervorschlag für jedes betroffene Schiff einzeln auftaucht. Nur
 *  sichtbar, solange es Gruppen gibt. */
import type { AgPlanungsGruppe } from "../lib/agPlanung";
import "./Meldungen.css";

interface AgPlanungTileProps {
  gruppen: AgPlanungsGruppe[];
  offen: boolean;
  onToggle: () => void;
}

export function AgPlanungTile({ gruppen, offen, onToggle }: AgPlanungTileProps) {
  if (gruppen.length === 0) return null;
  const stufe = gruppen.some((g) => g.stufe === "warnung") ? "warnung" : "vorschlag";
  const top = gruppen[0];
  return (
    <button
      type="button"
      className={`meldungs-tile meldungs-tile--${stufe}` + (offen ? " meldungs-tile--offen" : "")}
      onClick={onToggle}
      aria-expanded={offen}
    >
      <div className="meldungs-tile__kopf">
        <span className="meldungs-tile__label">AG-Planung</span>
        <span className={`meldungs-badge meldungs-badge--${stufe}`}>{gruppen.length}</span>
      </div>
      <div className="meldungs-tile__text">
        {top.schiffsNamen.length}× AG mit {top.empfehlung}
      </div>
    </button>
  );
}

interface AgPlanungListeProps {
  gruppen: AgPlanungsGruppe[];
}

export function AgPlanungListe({ gruppen }: AgPlanungListeProps) {
  return (
    <div className="meldungs-liste">
      {gruppen.map((g) => (
        <div key={g.id} className="meldungs-liste__eintrag">
          <span className={`meldungs-punkt meldungs-punkt--${g.stufe}`} aria-hidden="true" />
          <span className="meldungs-liste__text">
            {g.schiffsNamen.length}× AG mit {g.empfehlung} — für {g.schiffsNamen.join(", ")}
          </span>
        </div>
      ))}
      {gruppen.length === 0 && <div className="meldungs-liste__leer">keine AG-Planung nötig</div>}
    </div>
  );
}
