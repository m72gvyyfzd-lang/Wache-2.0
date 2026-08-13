/** Kennzahlen-Kachel des Dashboards (Einsatzstation, Seestation): gleiche
 *  Größe, Form und Kopfzeile wie die Meldungs-/AG-Planungs-Kachel (deshalb
 *  deren Klassen), zeigt darunter aber Zahlengruppen statt einer Liste.
 *  Ohne Gruppen bleibt nur der Rahmen stehen — als Platzhalter für noch
 *  nicht befüllte Kacheln. */
import { Fragment } from "react";
import "./Meldungen.css";
import "./ZahlenTile.css";

export interface ZahlenGruppe {
  /** Überschrift der Gruppe, z.B. "Jobs" oder "Lotsen" */
  titel: string;
  werte: { kuerzel: string; wert: number | string }[];
}

/** Abweichende Spaltenbreite in der Kachel-Leiste: "schmal"/"breit"
 *  verschieben nur das Verhältnis, alle Kacheln bleiben in einer Zeile. */
export type Kachelbreite = "schmal" | "breit";

function rahmenKlasse(breite?: Kachelbreite): string {
  return "meldungs-tile zahlen-tile" + (breite ? ` meldungs-tile--${breite}` : "");
}

export function ZahlenTile({
  label,
  gruppen,
  breite,
  testId,
}: {
  label: string;
  gruppen: ZahlenGruppe[];
  breite?: Kachelbreite;
  testId?: string;
}) {
  return (
    <div className={rahmenKlasse(breite)} data-testid={testId}>
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

export interface MatrixZeile {
  /** Zeilenbeschriftung links, z.B. "ETAs" */
  titel: string;
  /** ein Wert je Spalte; null lässt die Zelle frei */
  werte: (number | null)[];
  /** Vorschau-Zuschlag je Spalte — orange in Klammern hinter der Zahl */
  zusaetze?: (number | null)[];
  /** Bilanz-Zeile: Überschuss grün, Fehlbestand rot mit Minuszeichen */
  bilanz?: boolean;
}

/** Kennzahlen-Kachel als Matrix: Spaltenköpfe oben, je Zeile eine
 *  Beschriftung und ihre Werte. Nutzt dieselben Schriftgrößen wie die
 *  Gruppen-Variante darüber. */
export function MatrixTile({
  label,
  spalten,
  zeilen,
  breite,
  testId,
}: {
  label: string;
  spalten: string[];
  zeilen: MatrixZeile[];
  breite?: Kachelbreite;
  testId?: string;
}) {
  const raster = { gridTemplateColumns: `auto repeat(${spalten.length}, minmax(0, 1fr))` };
  return (
    <div className={rahmenKlasse(breite)} data-testid={testId}>
      <div className="meldungs-tile__kopf">
        <span className="meldungs-tile__label">{label}</span>
      </div>
      <div className="zahlen-tile__matrix" style={raster}>
        <span />
        {spalten.map((s) => (
          <span key={s} className="zahlen-tile__kuerzel zahlen-tile__matrix-kopf">
            {s}
          </span>
        ))}
        {zeilen.map((zeile) => (
          <Fragment key={zeile.titel}>
            <span className="zahlen-tile__titel zahlen-tile__matrix-titel">{zeile.titel}</span>
            {zeile.werte.map((wert, i) => {
              const zusatz = zeile.zusaetze?.[i] ?? 0;
              const bilanzKlasse =
                !zeile.bilanz || wert === null || wert === 0
                  ? ""
                  : wert < 0
                    ? " zahlen-tile__zahl--fehlt"
                    : " zahlen-tile__zahl--ueberschuss";
              return (
                <span key={spalten[i]} className={`zahlen-tile__zahl zahlen-tile__matrix-zahl${bilanzKlasse}`}>
                  {wert === null ? "" : zeile.bilanz && wert > 0 ? `+${wert}` : wert}
                  {zusatz > 0 && <span className="zahlen-tile__zusatz"> ({zusatz})</span>}
                </span>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
