/** Meldungszentrale des Dashboards: Kachel mit der dringendsten Meldung
 *  (farbig nach Stufe) plus aufklappbare Liste aller Meldungen. */
import type { Meldung, MeldungsStufe } from "../lib/meldungen";
import { formatUhrzeit } from "../lib/format";
import "./Meldungen.css";

const STUFEN_LABEL: Record<MeldungsStufe, string> = {
  alarm: "Alarm",
  warnung: "Warnung",
  vorschlag: "Vorschlag",
  info: "Info",
};

function zaehlung(meldungen: Meldung[]): Partial<Record<MeldungsStufe, number>> {
  const anzahl: Partial<Record<MeldungsStufe, number>> = {};
  for (const m of meldungen) anzahl[m.stufe] = (anzahl[m.stufe] ?? 0) + 1;
  return anzahl;
}

interface MeldungsTileProps {
  meldungen: Meldung[];
  offen: boolean;
  onToggle: () => void;
}

export function MeldungsTile({ meldungen, offen, onToggle }: MeldungsTileProps) {
  const top = meldungen[0];
  const stufe = top?.stufe ?? "leer";
  const anzahl = zaehlung(meldungen);
  return (
    <button
      type="button"
      className={`meldungs-tile meldungs-tile--${stufe}` + (offen ? " meldungs-tile--offen" : "")}
      onClick={onToggle}
      aria-expanded={offen}
    >
      <div className="meldungs-tile__kopf">
        <span className="meldungs-tile__label">Meldungen</span>
        {(["alarm", "warnung", "vorschlag", "info"] as const).map(
          (s) =>
            (anzahl[s] ?? 0) > 0 && (
              <span key={s} className={`meldungs-badge meldungs-badge--${s}`} title={STUFEN_LABEL[s]}>
                {anzahl[s]}
              </span>
            ),
        )}
      </div>
      <div className="meldungs-tile__text">{top ? top.text : "keine Meldungen"}</div>
    </button>
  );
}

interface MeldungsListeProps {
  meldungen: Meldung[];
}

export function MeldungsListe({ meldungen }: MeldungsListeProps) {
  return (
    <div className="meldungs-liste">
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
