import { useState } from "react";
import { Badge } from "../components/Badge";
import { FrageModal } from "../components/FrageModal";
import { Modal } from "../components/Modal";
import { Panel } from "../components/Panel";
import type { Abteilung } from "../data/types";
import { formatUhrzeit } from "../lib/format";
import { etaSeestation } from "../lib/seestation";
import { useData } from "../state/DataContext";
import "./Versetzliste.css";

/** Bezeichnung eines Eintrags für die Rückfrage: mit V-Nr. der Schiffsname,
 *  ohne V-Nr. Type + Schiffsname. */
function eintragLabel(abteilung: Abteilung): string {
  if (abteilung.vNr !== undefined) return abteilung.schiffsname ?? "?";
  return [abteilung.typLabel, abteilung.schiffsname].filter(Boolean).join(" ");
}

export function Versetzliste() {
  const { abteilungen, macheAbteilungRueckgaengig } = useData();
  // Auswahl gilt über beide Listen hinweg — erneuter Klick wählt wieder ab
  const [auswahl, setAuswahl] = useState<number | null>(null);
  const [frageOffen, setFrageOffen] = useState(false);

  // Lotsen, die schon auf der Seestation angekommen sind ("Auf Station"),
  // verschwinden aus dieser Liste — sie stehen dann nur noch im Tab
  // Seestation.
  const revier = abteilungen
    .filter((a) => a.vNr !== undefined && !a.aufSeestation)
    .sort((a, b) => a.vNr! - b.vNr!);
  const vergabe = abteilungen
    .filter((a) => a.vNr === undefined)
    .sort((a, b) => a.abteilZeit.getTime() - b.abteilZeit.getTime());

  const ausgewaehlt = auswahl !== null ? (abteilungen.find((a) => a.id === auswahl) ?? null) : null;

  function zeilenKlick(id: number) {
    setAuswahl((aktiv) => (aktiv === id ? null : id));
  }

  function handleRueckgaengigJa() {
    if (!ausgewaehlt) return;
    macheAbteilungRueckgaengig(ausgewaehlt.id);
    setAuswahl(null);
    setFrageOffen(false);
  }

  return (
    <div>
      {/* Kopfzeile auf Ebene der (entfallenen) Seitenüberschrift: nur der
          rechtsbündige Rückgängig-Button, ohne eigene Karte */}
      <div className="versetz-kopf">
        <button type="button" className="btn btn--accent" disabled={!ausgewaehlt} onClick={() => setFrageOffen(true)}>
          Abteilung rückgängig machen
        </button>
      </div>

      <Panel
        title="Lotsen im Revier"
        description="Abgeteilte Jobs mit V-Nr. — unterwegs zur Seestation"
        count={`${revier.length} Einträge`}
      >
        <table className="versetz-table">
          <thead>
            <tr>
              <th className="num zentriert">V-Nr.</th>
              <th>Schiffsname</th>
              <th>Lotsenname</th>
              <th className="num zentriert">Kat.</th>
              <th className="num zentriert">EH</th>
              <th className="num zentriert">Abteilzeit</th>
              <th className="num zentriert kopf-umbruch">Ankunft S-Stn</th>
              <th className="num zentriert">Ankert</th>
            </tr>
          </thead>
          <tbody>
            {revier.map((a) => (
              <tr
                key={a.id}
                className={"row-click" + (auswahl === a.id ? " ist-ausgewaehlt" : "")}
                onClick={() => zeilenKlick(a.id)}
              >
                <td className="num zentriert fett">{a.vNr}</td>
                <td className="cell-name">{a.schiffsname ?? "–"}</td>
                <td>{a.lotsenName}</td>
                <td className="num muted zentriert">{a.lotsenKategorie}</td>
                <td className="num zentriert">{a.elbehafen ? "✓" : ""}</td>
                <td className="num zentriert">{formatUhrzeit(a.abteilZeit)}</td>
                <td className="num muted zentriert">{formatUhrzeit(etaSeestation(a))}</td>
                <td className="num muted zentriert">–</td>
              </tr>
            ))}
            {revier.length === 0 && (
              <tr>
                <td colSpan={8} className="muted" style={{ textAlign: "center", padding: 20 }}>
                  keine Einträge
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>

      <Panel
        title="Vergabe-Liste"
        description="Abgeteilte Jobs ohne V-Nr. — ohne Ziel Seestation"
        count={`${vergabe.length} Einträge`}
      >
        <table className="versetz-table">
          <thead>
            <tr>
              <th className="zentriert schmal">Type</th>
              <th>Schiffsname</th>
              <th>Lotsenname</th>
              <th className="num zentriert">Abteilzeit</th>
            </tr>
          </thead>
          <tbody>
            {vergabe.map((a) => (
              <tr
                key={a.id}
                className={"row-click" + (auswahl === a.id ? " ist-ausgewaehlt" : "")}
                onClick={() => zeilenKlick(a.id)}
              >
                <td className="zentriert schmal">
                  <Badge>{a.typLabel}</Badge>
                </td>
                <td className="cell-name">{a.schiffsname ?? "–"}</td>
                <td>{a.lotsenName}</td>
                <td className="num zentriert">{formatUhrzeit(a.abteilZeit)}</td>
              </tr>
            ))}
            {vergabe.length === 0 && (
              <tr>
                <td colSpan={4} className="muted" style={{ textAlign: "center", padding: 20 }}>
                  keine Einträge
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>

      {frageOffen && ausgewaehlt && (
        <Modal title="Abteilung rückgängig" onClose={() => setFrageOffen(false)} maxWidth="380px">
          <FrageModal
            frage={`Soll die Abteilung von ${ausgewaehlt.lotsenName} zu ${eintragLabel(ausgewaehlt)} rückgängig gemacht werden?`}
            onJa={handleRueckgaengigJa}
            onNein={() => setFrageOffen(false)}
          />
        </Modal>
      )}
    </div>
  );
}
