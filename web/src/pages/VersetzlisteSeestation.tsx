import { useState } from "react";
import { FrageModal } from "../components/FrageModal";
import { Modal } from "../components/Modal";
import { Panel } from "../components/Panel";
import { formatUhrzeit } from "../lib/format";
import { useData } from "../state/DataContext";
import "./Versetzliste.css";

type Auswahl =
  | { typ: "seeAbteilung"; id: number }
  | { typ: "abgeschoepft"; quelle: "abteilung" | "manuell"; id: number };

interface AbgeschoepfterLotse {
  key: string;
  quelle: "abteilung" | "manuell";
  id: number;
  vNr: number;
  name: string;
  kategorie: string;
  elbehafen: boolean;
}

export function VersetzlisteSeestation() {
  const {
    seeAbteilungen,
    macheSeeAbteilungRueckgaengig,
    abteilungen,
    updateAbteilung,
    seestationLotsen,
    updateSeestationLotse,
  } = useData();

  // "Versetz auf Seestation": Ausgabe des Seestation-Abteilens, fortlaufend
  // nach A-Nr. (unabhängig von der V-Nr.-Zählung der Einsatzplanung).
  const versetzt = [...seeAbteilungen].sort((a, b) => a.aNr - b.aNr);

  // "Abgeschöpfte Lotsen": alle auf der Seestation ("Auf Seestation")
  // abgeschöpften Lotsen beider Quellen — die Abschöpfen-Aktion dort blendet
  // sie nur aus, statt sie zu löschen.
  const abgeschoepft: AbgeschoepfterLotse[] = [
    ...abteilungen
      .filter((a) => a.abgeschoepft && a.vNr !== undefined)
      .map((a) => ({
        key: `abteilung-${a.id}`,
        quelle: "abteilung" as const,
        id: a.id,
        vNr: a.vNr!,
        name: a.lotsenName,
        kategorie: a.lotsenKategorie,
        elbehafen: a.elbehafen,
      })),
    ...seestationLotsen
      .filter((l) => l.abgeschoepft)
      .map((l) => ({
        key: `manuell-${l.id}`,
        quelle: "manuell" as const,
        id: l.id,
        vNr: l.vNr,
        name: l.name,
        kategorie: l.kategorie,
        elbehafen: l.elbehafen,
      })),
  ].sort((a, b) => a.vNr - b.vNr);

  // Auswahl gilt über beide Listen hinweg — erneuter Klick wählt wieder ab
  const [auswahl, setAuswahl] = useState<Auswahl | null>(null);
  const [frageOffen, setFrageOffen] = useState(false);

  function seeKlick(id: number) {
    setAuswahl((aktiv) => (aktiv?.typ === "seeAbteilung" && aktiv.id === id ? null : { typ: "seeAbteilung", id }));
  }

  function abgeschoepftKlick(eintrag: AbgeschoepfterLotse) {
    setAuswahl((aktiv) =>
      aktiv?.typ === "abgeschoepft" && aktiv.quelle === eintrag.quelle && aktiv.id === eintrag.id
        ? null
        : { typ: "abgeschoepft", quelle: eintrag.quelle, id: eintrag.id },
    );
  }

  const ausgewaehlteSeeAbteilung =
    auswahl?.typ === "seeAbteilung" ? (seeAbteilungen.find((a) => a.id === auswahl.id) ?? null) : null;
  const ausgewaehlterAbgeschoepfte =
    auswahl?.typ === "abgeschoepft"
      ? (abgeschoepft.find((e) => e.quelle === auswahl.quelle && e.id === auswahl.id) ?? null)
      : null;

  function handleRueckgaengigJa() {
    if (auswahl?.typ === "seeAbteilung") {
      macheSeeAbteilungRueckgaengig(auswahl.id);
    } else if (auswahl?.typ === "abgeschoepft") {
      if (auswahl.quelle === "abteilung") updateAbteilung(auswahl.id, { abgeschoepft: false });
      else updateSeestationLotse(auswahl.id, { abgeschoepft: false });
    }
    setAuswahl(null);
    setFrageOffen(false);
  }

  const rueckgaengigText = ausgewaehlteSeeAbteilung
    ? `Soll die Versetzung von ${ausgewaehlteSeeAbteilung.lotsenName} zu ${ausgewaehlteSeeAbteilung.schiffsname} rückgängig gemacht werden?`
    : ausgewaehlterAbgeschoepfte
      ? `Soll das Abschöpfen von ${ausgewaehlterAbgeschoepfte.name} rückgängig gemacht werden?`
      : "";

  return (
    <div>
      {/* Kopfzeile auf Ebene der (entfallenen) Seitenüberschrift, analog zur
          Versetzliste: nur der rechtsbündige Rückgängig-Button. */}
      <div className="versetz-kopf">
        <button type="button" className="btn btn--accent" disabled={!auswahl} onClick={() => setFrageOffen(true)}>
          Rückgängig machen
        </button>
      </div>

      <Panel title="Versetz auf Seestation">
        <table className="versetz-table">
          <thead>
            <tr>
              <th className="num zentriert">A-Nr.</th>
              <th>Schiffsname</th>
              <th>Lotsenname</th>
              <th className="num zentriert">Kat.</th>
              <th className="num zentriert">EH</th>
              <th className="num zentriert">Abteilzeit</th>
            </tr>
          </thead>
          <tbody>
            {versetzt.map((a) => (
              <tr
                key={a.id}
                className={
                  "row-click" + (auswahl?.typ === "seeAbteilung" && auswahl.id === a.id ? " ist-ausgewaehlt" : "")
                }
                onClick={() => seeKlick(a.id)}
              >
                <td className="num zentriert fett">{a.aNr}</td>
                <td className="cell-name">{a.schiffsname}</td>
                <td>{a.lotsenName}</td>
                <td className="num muted zentriert">{a.lotsenKategorie}</td>
                <td className="num zentriert">{a.elbehafen ? "✓" : ""}</td>
                <td className="num zentriert">{formatUhrzeit(a.abteilZeit)}</td>
              </tr>
            ))}
            {versetzt.length === 0 && (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: "center", padding: 20 }}>
                  keine Einträge
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>

      <Panel title="Abgeschöpfte Lotsen">
        <table className="versetz-table">
          <thead>
            <tr>
              <th className="num zentriert">V-Nr.</th>
              <th>Lotsenname</th>
              <th className="num zentriert">Kat.</th>
              <th className="num zentriert">EH</th>
            </tr>
          </thead>
          <tbody>
            {abgeschoepft.map((e) => (
              <tr
                key={e.key}
                className={
                  "row-click" +
                  (auswahl?.typ === "abgeschoepft" && auswahl.quelle === e.quelle && auswahl.id === e.id
                    ? " ist-ausgewaehlt"
                    : "")
                }
                onClick={() => abgeschoepftKlick(e)}
              >
                <td className="num zentriert fett">{e.vNr}</td>
                <td>{e.name}</td>
                <td className="num muted zentriert">{e.kategorie}</td>
                <td className="num zentriert">{e.elbehafen ? "✓" : ""}</td>
              </tr>
            ))}
            {abgeschoepft.length === 0 && (
              <tr>
                <td colSpan={4} className="muted" style={{ textAlign: "center", padding: 20 }}>
                  keine Einträge
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>

      {frageOffen && (ausgewaehlteSeeAbteilung || ausgewaehlterAbgeschoepfte) && (
        <Modal title="Rückgängig" onClose={() => setFrageOffen(false)} maxWidth="380px">
          <FrageModal frage={rueckgaengigText} onJa={handleRueckgaengigJa} onNein={() => setFrageOffen(false)} />
        </Modal>
      )}
    </div>
  );
}
