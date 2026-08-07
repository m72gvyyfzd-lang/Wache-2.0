import { useState } from "react";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import {
  SeeSchiffEditModal,
  SeeSchiffNeuModal,
  SeestationLotseAktionModal,
  SeestationLotseNeuModal,
} from "../components/SeestationModals";
import type { SeeSchiff } from "../data/types";
import { formatUhrzeit } from "../lib/format";
import {
  sortiereSeestation,
  zeilenAusAbteilungen,
  zeilenAusSeestationLotsen,
  type SeestationZeile,
} from "../lib/seestation";
import { useData } from "../state/DataContext";
import "./Seestation.css";

/** Anzahl benötigter Lotsen eines See-Schiffs: Standard 1, Doppeldecker 2.
 *  In der Liste wird nur ein Wert > 1 angezeigt. */
function seeLotsenAnzahl(schiff: SeeSchiff): number {
  return schiff.doppeldecker ? 2 : 1;
}

export function Seestation() {
  const {
    seeSchiffe,
    addSeeSchiff,
    updateSeeSchiff,
    abteilungen,
    updateAbteilung,
    seestationLotsen,
    addSeestationLotse,
    updateSeestationLotse,
  } = useData();

  // Schiffe nach ETA (früheste oben)
  const schiffeSortiert = [...seeSchiffe].sort((a, b) => (a.eta?.getTime() ?? 0) - (b.eta?.getTime() ?? 0));
  // Lotsen: Versetzliste ("Lotsen im Revier") + manuell hinzugefügte,
  // einsortiert nach V-Nr. mit Zusatz-Reihenfolge (101 → 101 (A) → 102)
  const lotsenZeilen = sortiereSeestation([
    ...zeilenAusAbteilungen(abteilungen),
    ...zeilenAusSeestationLotsen(seestationLotsen),
  ]);
  const zeilen = Math.max(schiffeSortiert.length, lotsenZeilen.length);

  const [schiffAuswahl, setSchiffAuswahl] = useState<number | null>(null);
  const [lotseAuswahl, setLotseAuswahl] = useState<string | null>(null);
  const [neuesSchiffOffen, setNeuesSchiffOffen] = useState(false);
  const [editSchiff, setEditSchiff] = useState<SeeSchiff | null>(null);
  const [aktionLotse, setAktionLotse] = useState<SeestationZeile | null>(null);
  const [neuerLotseOffen, setNeuerLotseOffen] = useState(false);

  // Vorbelegung fürs Hinzufügen: letzte (höchste) V-Nr. der Revier-Lotsen
  const vNrProfil = zeilenAusAbteilungen(abteilungen).reduce((max, z) => Math.max(max, z.vNr), 0);

  function handleSchiffOk(schiff: SeeSchiff) {
    updateSeeSchiff(schiff.id, schiff);
    setSchiffAuswahl(null);
    setEditSchiff(null);
  }

  function handleEtaStnUebernehmen(wert: Date | undefined) {
    if (!aktionLotse) return;
    if (aktionLotse.quelle === "abteilung") {
      updateAbteilung(aktionLotse.id, { etaStnManuell: wert });
    } else {
      updateSeestationLotse(aktionLotse.id, { etaStn: wert });
    }
    setLotseAuswahl(null);
    setAktionLotse(null);
  }

  function handleAufStation() {
    if (!aktionLotse) return;
    if (aktionLotse.quelle === "abteilung") {
      updateAbteilung(aktionLotse.id, { aufSeestation: true });
    } else {
      updateSeestationLotse(aktionLotse.id, { aufStation: true });
    }
    setLotseAuswahl(null);
    setAktionLotse(null);
  }

  return (
    <div>
      <PageHeader title="Seestation" />
      <Panel
        title="Übersicht"
        count={`${zeilen} Zeilen`}
        action={
          <div className="seestation-aktionen">
            <button type="button" className="btn btn--small btn--accent" onClick={() => setNeuesSchiffOffen(true)}>
              + Neues Schiff
            </button>
            <button type="button" className="btn btn--small btn--accent" onClick={() => setNeuerLotseOffen(true)}>
              + Lotse hinzufügen
            </button>
          </div>
        }
      >
        <table className="seestation-table">
          <thead>
            <tr className="seestation-table__gruppen">
              <th colSpan={5}>ETAs Seestation</th>
              <th className="seestation-table__divider" aria-hidden="true" />
              <th colSpan={5}>Auf Seestation</th>
            </tr>
            <tr>
              <th className="num">#</th>
              <th className="num zentriert">ETA</th>
              <th>Schiffsname</th>
              <th className="num zentriert">Kat.</th>
              <th className="num zentriert">Lots.</th>
              <th className="seestation-table__divider" aria-hidden="true" />
              <th className="num zentriert">V-Nr.</th>
              <th>Lotsenname</th>
              <th className="num zentriert">Kat.</th>
              <th className="num zentriert">EH</th>
              <th className="num zentriert kopf-umbruch">ETA Stn</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: zeilen }).map((_, i) => {
              const schiff = schiffeSortiert[i];
              const lotse = lotsenZeilen[i];
              const schiffKlasse =
                "seestation-table__seite" +
                (schiff && schiffAuswahl === schiff.id ? " ist-ausgewaehlt" : "") +
                (schiff?.angemeldet ? " fett" : "");
              const lotseKlasse =
                "seestation-table__seite" +
                (lotse && lotseAuswahl === lotse.key ? " ist-ausgewaehlt" : "") +
                (lotse?.aufStation ? " fett" : " gedimmt");
              const schiffKlick = schiff
                ? () => setSchiffAuswahl((aktiv) => (aktiv === schiff.id ? null : schiff.id))
                : undefined;
              const schiffDoppelklick = schiff
                ? () => {
                    setSchiffAuswahl(schiff.id);
                    setEditSchiff(schiff);
                  }
                : undefined;
              const lotseKlick = lotse
                ? () => setLotseAuswahl((aktiv) => (aktiv === lotse.key ? null : lotse.key))
                : undefined;
              const lotseDoppelklick = lotse
                ? () => {
                    setLotseAuswahl(lotse.key);
                    setAktionLotse(lotse);
                  }
                : undefined;
              return (
                <tr key={i}>
                  {schiff ? (
                    <>
                      <td className={`${schiffKlasse} num muted`} onClick={schiffKlick} onDoubleClick={schiffDoppelklick}>
                        {i + 1}
                      </td>
                      <td
                        className={`${schiffKlasse} num zentriert${schiff.e3st ? " eta-rot" : ""}`}
                        onClick={schiffKlick}
                        onDoubleClick={schiffDoppelklick}
                      >
                        {formatUhrzeit(schiff.eta)}
                      </td>
                      <td className={`${schiffKlasse} cell-name`} onClick={schiffKlick} onDoubleClick={schiffDoppelklick}>
                        {schiff.schiffsname}
                      </td>
                      <td className={`${schiffKlasse} num zentriert`} onClick={schiffKlick} onDoubleClick={schiffDoppelklick}>
                        {schiff.kategorie ?? "·"}
                        {schiff.ehfLotseBenoetigt && <span className="planung-hinweis"> (EH)</span>}
                      </td>
                      <td className={`${schiffKlasse} num zentriert`} onClick={schiffKlick} onDoubleClick={schiffDoppelklick}>
                        {seeLotsenAnzahl(schiff) > 1 ? seeLotsenAnzahl(schiff) : ""}
                      </td>
                    </>
                  ) : (
                    <td colSpan={5} className="muted">
                      –
                    </td>
                  )}
                  <td className="seestation-table__divider" aria-hidden="true" />
                  {lotse ? (
                    <>
                      <td className={`${lotseKlasse} num zentriert`} onClick={lotseKlick} onDoubleClick={lotseDoppelklick}>
                        {lotse.vNr}
                        {lotse.zusatz && <span className="planung-hinweis"> ({lotse.zusatz})</span>}
                      </td>
                      <td className={`${lotseKlasse} cell-name`} onClick={lotseKlick} onDoubleClick={lotseDoppelklick}>
                        {lotse.name}
                      </td>
                      <td className={`${lotseKlasse} num zentriert`} onClick={lotseKlick} onDoubleClick={lotseDoppelklick}>
                        {lotse.kategorie}
                      </td>
                      <td className={`${lotseKlasse} num zentriert`} onClick={lotseKlick} onDoubleClick={lotseDoppelklick}>
                        {lotse.elbehafen ? "✓" : ""}
                      </td>
                      <td className={`${lotseKlasse} num zentriert`} onClick={lotseKlick} onDoubleClick={lotseDoppelklick}>
                        {lotse.aufStation ? "–" : formatUhrzeit(lotse.etaStn)}
                      </td>
                    </>
                  ) : (
                    <td colSpan={5} className="muted">
                      –
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      {neuesSchiffOffen && (
        <Modal title="Neues Schiff" onClose={() => setNeuesSchiffOffen(false)} maxWidth="420px">
          <SeeSchiffNeuModal
            onEinfuegen={(schiff) => {
              addSeeSchiff(schiff);
              setNeuesSchiffOffen(false);
            }}
            onAbbrechen={() => setNeuesSchiffOffen(false)}
          />
        </Modal>
      )}

      {editSchiff && (
        <Modal title={editSchiff.schiffsname} onClose={() => setEditSchiff(null)} maxWidth="340px">
          <SeeSchiffEditModal schiff={editSchiff} onOk={handleSchiffOk} onAbbrechen={() => setEditSchiff(null)} />
        </Modal>
      )}

      {aktionLotse && (
        <Modal title={aktionLotse.name} onClose={() => setAktionLotse(null)} maxWidth="360px">
          <SeestationLotseAktionModal
            initialEtaStn={aktionLotse.etaStn}
            onUebernehmen={handleEtaStnUebernehmen}
            onAufStation={handleAufStation}
            onAbbrechen={() => setAktionLotse(null)}
          />
        </Modal>
      )}

      {neuerLotseOffen && (
        <Modal title="Lotse hinzufügen" onClose={() => setNeuerLotseOffen(false)} maxWidth="440px">
          <SeestationLotseNeuModal
            vNrProfil={vNrProfil}
            onEinfuegen={(lotse) => {
              addSeestationLotse(lotse);
              setNeuerLotseOffen(false);
            }}
            onAbbrechen={() => setNeuerLotseOffen(false)}
          />
        </Modal>
      )}
    </div>
  );
}
