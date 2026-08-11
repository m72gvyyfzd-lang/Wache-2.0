/** Meldungszentrale des Dashboards: Kachel mit nach Art gruppierten Zeilen
 *  ("3× Abruf überfällig") plus aufklappbare Detailliste. Klick auf die
 *  Kachel (außerhalb einer Gruppenzeile) zeigt alle Meldungen, Klick auf
 *  eine Gruppenzeile nur deren Details. */
import type { RefObject } from "react";
import type { Meldung, MeldungsGruppe } from "../lib/meldungen";
import { formatUhrzeit } from "../lib/format";
import "./Meldungen.css";

interface MeldungsTileProps {
  gruppen: MeldungsGruppe[];
  /** null = Kachel zu; "" = alle Meldungen offen; sonst die offene Art */
  aktiv: string | null;
  onAlle: () => void;
  onGruppe: (art: string) => void;
  /** Wurzel-Element — dient dem Dashboard zur Erkennung von Klicks
   *  außerhalb (schließt die Detailliste, siehe DashboardCard.tsx). */
  containerRef: RefObject<HTMLDivElement | null>;
}

export function MeldungsTile({ gruppen, aktiv, onAlle, onGruppe, containerRef }: MeldungsTileProps) {
  const stufe = gruppen[0]?.stufe ?? "leer";
  return (
    <div
      ref={containerRef}
      className={`meldungs-tile meldungs-tile--${stufe}` + (aktiv !== null ? " meldungs-tile--offen" : "")}
      onClick={onAlle}
    >
      <div className="meldungs-tile__kopf">
        <span className="meldungs-tile__label">Meldungen</span>
        {gruppen.length > 0 && <span className={`meldungs-badge meldungs-badge--${stufe}`}>{gruppen.length}</span>}
      </div>
      <div className="meldungs-tile__gruppen">
        {gruppen.map((g) => (
          <button
            key={g.art}
            type="button"
            className={"meldungs-tile__gruppe" + (aktiv === g.art ? " meldungs-tile__gruppe--aktiv" : "")}
            onClick={(e) => {
              e.stopPropagation();
              onGruppe(g.art);
            }}
          >
            <span className={`meldungs-punkt meldungs-punkt--${g.stufe}`} aria-hidden="true" />
            <span className="meldungs-tile__gruppe-text">
              {g.anzahl}× {g.art}
            </span>
          </button>
        ))}
        {gruppen.length === 0 && <div className="meldungs-tile__leer">keine Meldungen</div>}
      </div>
      {aktiv !== null && <MeldungsListe gruppen={gruppen} art={aktiv} />}
    </div>
  );
}

interface MeldungsListeProps {
  gruppen: MeldungsGruppe[];
  /** "" = alle Gruppen, sonst nur die Meldungen dieser Art */
  art: string;
}

function MeldungsListe({ gruppen, art }: MeldungsListeProps) {
  const meldungen: Meldung[] = art === "" ? gruppen.flatMap((g) => g.meldungen) : (gruppen.find((g) => g.art === art)?.meldungen ?? []);
  return (
    <div className="meldungs-liste" onClick={(e) => e.stopPropagation()}>
      {meldungen.map((m) => (
        <div key={m.id} className="meldungs-liste__eintrag">
          <span className={`meldungs-punkt meldungs-punkt--${m.stufe}`} aria-hidden="true" />
          <span className="meldungs-liste__text">{m.text}</span>
          {m.zeit && <span className="meldungs-liste__zeit">{formatUhrzeit(m.zeit)}</span>}
        </div>
      ))}
      {meldungen.length === 0 && <div className="meldungs-liste__leer">keine Meldungen</div>}
    </div>
  );
}
