/** Kennzahlen-Kachel des Dashboards (Einsatzstation, Seestation): gleiche
 *  Größe, Form und Kopfzeile wie die Meldungs-/AG-Planungs-Kachel (deshalb
 *  deren Klassen), zeigt darunter aber Zahlengruppen statt einer Liste.
 *  Ohne Gruppen bleibt nur der Rahmen stehen — als Platzhalter für noch
 *  nicht befüllte Kacheln. */
import "./Meldungen.css";
import "./ZahlenTile.css";

export interface ZahlenGruppe {
  /** Überschrift der Gruppe, z.B. "Jobs" oder "Lotsen" */
  titel: string;
  werte: { kuerzel: string; wert: number | string }[];
}

export function ZahlenTile({
  label,
  gruppen,
  testId,
}: {
  label: string;
  gruppen: ZahlenGruppe[];
  testId?: string;
}) {
  return (
    <div className="meldungs-tile zahlen-tile" data-testid={testId}>
      <div className="meldungs-tile__kopf">
        <span className="meldungs-tile__label">{label}</span>
      </div>
      <div className="zahlen-tile__body">
        {gruppen.map((gruppe) => (
          <div key={gruppe.titel} className="zahlen-tile__gruppe">
            <div className="zahlen-tile__titel">{gruppe.titel}</div>
            <div className="zahlen-tile__werte">
              {gruppe.werte.map((w) => (
                <div key={w.kuerzel} className="zahlen-tile__spalte">
                  <span className="zahlen-tile__kuerzel">{w.kuerzel}</span>
                  <span className="zahlen-tile__zahl">{w.wert}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
