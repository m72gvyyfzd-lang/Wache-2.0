import { useState } from "react";
import { FrageModal } from "../components/FrageModal";
import { LotsenAnzahlModal } from "../components/LotsenAnzahlModal";
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
import { eignungsWarnungSeestation, planeSeestation, seeLotsenAnzahl } from "../lib/seestationAbteilen";
import { useData } from "../state/DataContext";
import "./Seestation.css";

/** "Vorausberechnung": voraussichtlich zugewiesene Lotsen dezent hinter dem
 *  Schiffsnamen — analog zu PlanungHinweis in der Einsatzplanung. */
function SeestationHinweis({ namen }: { namen: string[] }) {
  if (namen.length === 0) return null;
  return <span className="planung-hinweis"> ({namen.join(", ")})</span>;
}

export function Seestation() {
  const {
    seeSchiffe,
    addSeeSchiff,
    updateSeeSchiff,
    deleteSeeSchiff,
    abteilungen,
    updateAbteilung,
    seestationLotsen,
    addSeestationLotse,
    updateSeestationLotse,
    seeAbteilungen,
    teileSeeAb,
  } = useData();

  // Bereits abgeteilte Lotsen je See-Schiff: voll abgeteilte Schiffe
  // verschwinden aus "ETA Seestation" (analog zu Tafel Brb/Einsatzplanung).
  const abgeteiltProSchiff = new Map<number, number>();
  for (const sa of seeAbteilungen) abgeteiltProSchiff.set(sa.seeSchiffId, (abgeteiltProSchiff.get(sa.seeSchiffId) ?? 0) + 1);

  // Schiffe: angemeldete zuerst, danach nach ETA (früheste oben)
  const schiffeSortiert = [...seeSchiffe]
    .filter((s) => seeLotsenAnzahl(s) - (abgeteiltProSchiff.get(s.id) ?? 0) > 0)
    .sort((a, b) => {
      const angemeldetA = a.angemeldet ? 0 : 1;
      const angemeldetB = b.angemeldet ? 0 : 1;
      if (angemeldetA !== angemeldetB) return angemeldetA - angemeldetB;
      return (a.eta?.getTime() ?? 0) - (b.eta?.getTime() ?? 0);
    });
  // Lotsen: Versetzliste ("Lotsen im Revier") + manuell hinzugefügte,
  // einsortiert nach V-Nr. mit Zusatz-Reihenfolge (101 → 101 (A) → 102)
  const lotsenZeilen = sortiereSeestation([
    ...zeilenAusAbteilungen(abteilungen),
    ...zeilenAusSeestationLotsen(seestationLotsen),
  ]);
  const zeilen = Math.max(schiffeSortiert.length, lotsenZeilen.length);
  // "Vorausberechnung" — wird bei jeder Änderung neu berechnet
  const zuweisungenSee = planeSeestation(schiffeSortiert, lotsenZeilen);

  const [schiffAuswahl, setSchiffAuswahl] = useState<number | null>(null);
  const [lotseAuswahl, setLotseAuswahl] = useState<string | null>(null);
  const [neuesSchiffOffen, setNeuesSchiffOffen] = useState(false);
  const [editSchiff, setEditSchiff] = useState<SeeSchiff | null>(null);
  const [loeschenSchiff, setLoeschenSchiff] = useState<SeeSchiff | null>(null);
  const [aktionLotse, setAktionLotse] = useState<SeestationZeile | null>(null);
  const [abschoepfenLotse, setAbschoepfenLotse] = useState<SeestationZeile | null>(null);
  const [neuerLotseOffen, setNeuerLotseOffen] = useState(false);
  // "Abteilen": Rückfrage vor dem Verbinden von Schiff + Lotse
  const [abteilenFrage, setAbteilenFrage] = useState(false);
  // Doppelklick auf "Lots." öffnet das Bearbeitungsfenster (analog AG-Job
  // in der Einsatzplanung)
  const [lotsenAnzahlSchiff, setLotsenAnzahlSchiff] = useState<SeeSchiff | null>(null);

  function handleLotsenAnzahlUebernehmen(wert: number) {
    if (!lotsenAnzahlSchiff) return;
    updateSeeSchiff(lotsenAnzahlSchiff.id, { ...lotsenAnzahlSchiff, lotsenAnzahl: wert });
    setSchiffAuswahl(null);
    setLotsenAnzahlSchiff(null);
  }

  // Vorbelegung fürs Hinzufügen: letzte (höchste) V-Nr. der Revier-Lotsen
  const vNrProfil = zeilenAusAbteilungen(abteilungen).reduce((max, z) => Math.max(max, z.vNr), 0);

  // Aktuelle Auswahl für das Seestation-Abteilen — Button erscheint, sobald
  // ein Schiff UND ein Lotse markiert sind. Aktiv wird er erst, wenn das
  // Schiff angemeldet und der Lotse bereits vor Ort ("Auf Seestation") ist.
  const abteilenSchiff = schiffAuswahl !== null ? (schiffeSortiert.find((s) => s.id === schiffAuswahl) ?? null) : null;
  const abteilenLotseZeile = lotseAuswahl !== null ? (lotsenZeilen.find((z) => z.key === lotseAuswahl) ?? null) : null;
  const abteilenMoeglich = (abteilenSchiff?.angemeldet ?? false) && (abteilenLotseZeile?.aufStation ?? false);
  const abteilenWarnung =
    abteilenSchiff && abteilenLotseZeile
      ? eignungsWarnungSeestation(abteilenSchiff, abteilenLotseZeile, (abgeteiltProSchiff.get(abteilenSchiff.id) ?? 0) === 0)
      : undefined;

  function handleAbteilenJa() {
    if (!abteilenSchiff || !abteilenLotseZeile) return;
    teileSeeAb(
      {
        seeSchiffId: abteilenSchiff.id,
        schiffsname: abteilenSchiff.schiffsname,
        lotsenQuelle: abteilenLotseZeile.quelle,
        lotsenId: abteilenLotseZeile.id,
        lotsenName: abteilenLotseZeile.name,
        lotsenKategorie: abteilenLotseZeile.kategorie,
        elbehafen: abteilenLotseZeile.elbehafen,
        abteilZeit: new Date(),
      },
      abteilenLotseZeile.quelle,
      abteilenLotseZeile.id,
    );
    setSchiffAuswahl(null);
    setLotseAuswahl(null);
    setAbteilenFrage(false);
  }

  const dennoch = abteilenWarnung ? "dennoch " : "";
  const abteilenFrageText =
    abteilenSchiff && abteilenLotseZeile
      ? `Soll ${abteilenLotseZeile.name} zu ${abteilenSchiff.schiffsname} ${dennoch}abgeteilt werden?`
      : "";

  function handleSchiffOk(schiff: SeeSchiff) {
    updateSeeSchiff(schiff.id, schiff);
    setSchiffAuswahl(null);
    setEditSchiff(null);
  }

  function handleSchiffLoeschenJa() {
    if (!loeschenSchiff) return;
    deleteSeeSchiff(loeschenSchiff.id);
    setSchiffAuswahl(null);
    setLoeschenSchiff(null);
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

  function handleAufSeestation() {
    if (!aktionLotse) return;
    if (aktionLotse.quelle === "abteilung") {
      updateAbteilung(aktionLotse.id, { aufSeestation: true });
    } else {
      updateSeestationLotse(aktionLotse.id, { aufStation: true });
    }
    setLotseAuswahl(null);
    setAktionLotse(null);
  }

  // Verschieben (nur Versetzliste-Lotsen, quelle "abteilung"): der Lotse
  // verliert seine V-Nr. und bekommt die des Ziels mit Dezimal-Zusatz
  // (.1, .2, …) — mehrere Verschiebungen hinter dieselbe Basis-Nr. zählen
  // fortlaufend hoch (105 → 105.1 → 105.2 …).
  const verschiebenZiele =
    aktionLotse && aktionLotse.quelle === "abteilung"
      ? lotsenZeilen
          .filter((z) => z.quelle === "abteilung" && z.aufStation && z.id !== aktionLotse.id)
          .map((z) => ({ id: z.id, label: `${z.name} (${z.vNr})` }))
      : [];

  function handleVerschieben(zielAbteilungId: number) {
    if (!aktionLotse || aktionLotse.quelle !== "abteilung") return;
    const ziel = abteilungen.find((a) => a.id === zielAbteilungId);
    if (!ziel || ziel.vNr === undefined) return;
    const basis = Math.floor(ziel.vNr);
    const vorhandeneKinder = abteilungen.filter(
      (a) => a.vNr !== undefined && Math.floor(a.vNr) === basis && a.vNr !== basis,
    ).length;
    const neueVNr = Number(`${basis}.${vorhandeneKinder + 1}`);
    updateAbteilung(aktionLotse.id, { vNr: neueVNr });
    setLotseAuswahl(null);
    setAktionLotse(null);
  }

  function handleAbschoepfenJa() {
    if (!abschoepfenLotse) return;
    if (abschoepfenLotse.quelle === "abteilung") {
      updateAbteilung(abschoepfenLotse.id, { abgeschoepft: true });
    } else {
      updateSeestationLotse(abschoepfenLotse.id, { abgeschoepft: true });
    }
    setLotseAuswahl(null);
    setAbschoepfenLotse(null);
  }

  return (
    <div>
      <PageHeader title="Seestation" centered />
      <Panel
        actionLeft={
          <button type="button" className="btn btn--small btn--accent" onClick={() => setNeuesSchiffOffen(true)}>
            + Neues Schiff
          </button>
        }
        action={
          <div className="seestation-aktionen">
            {abteilenSchiff && abteilenLotseZeile && (
              <button
                type="button"
                className="btn btn--small btn--accent"
                disabled={!abteilenMoeglich}
                onClick={() => setAbteilenFrage(true)}
              >
                Abteilen
              </button>
            )}
            <button type="button" className="btn btn--small btn--accent" onClick={() => setNeuerLotseOffen(true)}>
              + Lotse hinzufügen
            </button>
          </div>
        }
      >
        <table className="seestation-table">
          <thead>
            <tr className="seestation-table__gruppen">
              <th colSpan={5}>ETA Seestation</th>
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
                        <SeestationHinweis namen={(zuweisungenSee.get(schiff.id) ?? []).map((z) => z.name)} />
                      </td>
                      <td className={`${schiffKlasse} num zentriert`} onClick={schiffKlick} onDoubleClick={schiffDoppelklick}>
                        {schiff.kategorie ?? "·"}
                        {schiff.ehfLotseBenoetigt && <span className="planung-hinweis"> (EH)</span>}
                      </td>
                      <td
                        className={`${schiffKlasse} num zentriert`}
                        onClick={schiffKlick}
                        onDoubleClick={() => {
                          setSchiffAuswahl(schiff.id);
                          setLotsenAnzahlSchiff(schiff);
                        }}
                      >
                        {seeLotsenAnzahl(schiff)}
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
        <Modal title={editSchiff.schiffsname} onClose={() => setEditSchiff(null)} maxWidth="360px" titelZentriert>
          <SeeSchiffEditModal
            schiff={editSchiff}
            onOk={handleSchiffOk}
            onLoeschen={() => {
              setLoeschenSchiff(editSchiff);
              setEditSchiff(null);
            }}
            onAbbrechen={() => setEditSchiff(null)}
          />
        </Modal>
      )}

      {loeschenSchiff && (
        <Modal title="Schiff löschen" onClose={() => setLoeschenSchiff(null)} maxWidth="380px" titelZentriert>
          <FrageModal
            frage={`Soll ${loeschenSchiff.schiffsname} wirklich gelöscht werden?`}
            zentriert
            onJa={handleSchiffLoeschenJa}
            onNein={() => setLoeschenSchiff(null)}
          />
        </Modal>
      )}

      {aktionLotse && (
        <Modal title={aktionLotse.name} onClose={() => setAktionLotse(null)} maxWidth="440px">
          <SeestationLotseAktionModal
            initialEtaStn={aktionLotse.etaStn}
            aufStation={aktionLotse.aufStation}
            zeigeVerschieben={aktionLotse.quelle === "abteilung"}
            verschiebenZiele={verschiebenZiele}
            onUebernehmen={handleEtaStnUebernehmen}
            onAufStation={handleAufSeestation}
            onVerschieben={handleVerschieben}
            onAbschoepfen={() => {
              setAbschoepfenLotse(aktionLotse);
              setAktionLotse(null);
            }}
            onAbbrechen={() => setAktionLotse(null)}
          />
        </Modal>
      )}

      {abschoepfenLotse && (
        <Modal title="Lotse abschöpfen" onClose={() => setAbschoepfenLotse(null)} maxWidth="380px" titelZentriert>
          <FrageModal
            frage={`Lotsen ${abschoepfenLotse.name} wirklich abschöpfen?`}
            zentriert
            onJa={handleAbschoepfenJa}
            onNein={() => setAbschoepfenLotse(null)}
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

      {abteilenFrage && abteilenSchiff && abteilenLotseZeile && (
        <Modal title="Abteilen" onClose={() => setAbteilenFrage(false)} maxWidth="380px" titelZentriert>
          <FrageModal
            frage={abteilenFrageText}
            warnung={abteilenWarnung}
            zentriert
            onJa={handleAbteilenJa}
            onNein={() => setAbteilenFrage(false)}
          />
        </Modal>
      )}

      {lotsenAnzahlSchiff && (
        <Modal title={lotsenAnzahlSchiff.schiffsname} onClose={() => setLotsenAnzahlSchiff(null)} maxWidth="300px">
          <LotsenAnzahlModal
            initial={seeLotsenAnzahl(lotsenAnzahlSchiff)}
            onUebernehmen={handleLotsenAnzahlUebernehmen}
            onAbbrechen={() => setLotsenAnzahlSchiff(null)}
          />
        </Modal>
      )}
    </div>
  );
}
