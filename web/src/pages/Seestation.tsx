import { Fragment, useEffect, useState } from "react";
import { getAbteilzeitSettings } from "@wache/core";
import { FrageModal } from "../components/FrageModal";
import { SchiffKatSelect } from "../components/formShared";
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
import { VORLAUF_AUF_STATION_MS } from "../lib/meldungen";
import {
  eignungsWarnungSeestation,
  planeSeestation,
  seeLotsenAnzahl,
  simuliereSeestation,
  type SeestationProjektion,
} from "../lib/seestationAbteilen";
import { vorschauZeilen } from "../lib/vorschau";
import { useData } from "../state/DataContext";
import "./Seestation.css";

const settings = getAbteilzeitSettings("Wechsel Tide");

/** "Vorausberechnung": voraussichtlich zugewiesene Lotsen dezent hinter dem
 *  Schiffsnamen — analog zu PlanungHinweis in der Einsatzplanung. */
function SeestationHinweis({ namen }: { namen: string[] }) {
  if (namen.length === 0) return null;
  return <span className="planung-hinweis"> ({namen.join(", ")})</span>;
}

/** Vorschau-Modus: projizierte Versorgungslage zum Ankunftszeitpunkt des
 *  Schiffs — Lotsen, die noch unterwegs sind, mit ihrer Ankunftszeit;
 *  verplante Lotsen der Einsatzstation (kommen mit ihrem Job-Schiff raus)
 *  orange, freie (noch ohne Job, per AG holbar) dezent blau; danach noch
 *  unbesetzbare Plätze rot markiert. */
function VorschauHinweis({ projektion }: { projektion: SeestationProjektion | undefined }) {
  if (!projektion) return null;
  const { zugewiesen, fehlt } = projektion;
  return (
    <span className="planung-hinweis">
      {zugewiesen.length > 0 && (
        <>
          {" ("}
          {zugewiesen.map((z, i) => (
            <Fragment key={z.key}>
              {i > 0 && ", "}
              <span
                className={
                  z.projiziert === "verplant" ? "vorschau-lotse-orange" : z.projiziert ? "vorschau-lotse" : undefined
                }
              >
                {z.aufStation ? z.name : `${z.name} ab ${formatUhrzeit(z.etaStn)}`}
              </span>
            </Fragment>
          ))}
          {")"}
        </>
      )}
      {fehlt > 0 && (
        <span className="vorschau-defizit">
          {" "}
          −{fehlt} Lotse{fehlt === 1 ? "" : "n"}
        </span>
      )}
    </span>
  );
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
    jobs,
    lotsen,
    aktuelleFahrt,
    vNrStart,
    verbrauchteVNrn,
  } = useData();

  // Bereits abgeteilte Lotsen je See-Schiff: voll abgeteilte Schiffe
  // verschwinden aus "ETA Seestation" (analog zu Tafel Brb/Einsatzplanung).
  const abgeteiltProSchiff = new Map<number, number>();
  for (const sa of seeAbteilungen) abgeteiltProSchiff.set(sa.seeSchiffId, (abgeteiltProSchiff.get(sa.seeSchiffId) ?? 0) + 1);
  // "Lots." zeigt wie bei AG-Jobs in der Einsatzplanung die noch
  // verbleibende (nicht die ursprüngliche) Anzahl — sinkt mit jedem
  // Seestation-Abteilen.
  function verbleibendeLotsen(schiff: SeeSchiff): number {
    return seeLotsenAnzahl(schiff) - (abgeteiltProSchiff.get(schiff.id) ?? 0);
  }

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
  // "Vorausberechnung" — wird bei jeder Änderung neu berechnet
  const zuweisungenSee = planeSeestation(schiffeSortiert, lotsenZeilen, abgeteiltProSchiff);
  // Vorschau: zuschaltbare Projektion, die auch noch anreisende Lotsen
  // einrechnet (Ankunft min. 1 Std. vor Schiffs-ETA) sowie die Lotsen der
  // Einsatzstation: VERPLANTE (mit Job, Ankunft = Abteilzeit + Anfahrt,
  // orange) erscheinen immer; FREIE (ohne Job, per AG holbar, blau) nur,
  // wenn die Vorausberechnung sie zum Decken eines Defizits einplant.
  const [vorschau, setVorschau] = useState(false);
  // Zeit-Tick wie im Dashboard: die Vorschau hängt an der Uhrzeit (früheste
  // AG-Ankunft, überfällige Abteilzeiten) und läuft so auch ohne
  // Datenänderung mit.
  const [jetzt, setJetzt] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setJetzt(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  const { verplante, freie } = vorschau
    ? vorschauZeilen(jobs, lotsen, aktuelleFahrt, abteilungen, settings, vNrStart, verbrauchteVNrn, jetzt)
    : { verplante: [], freie: [] };
  const vorschauProjektion = vorschau
    ? simuliereSeestation(seeSchiffe, [...lotsenZeilen, ...verplante, ...freie], abgeteiltProSchiff, VORLAUF_AUF_STATION_MS)
    : null;
  const benoetigteFreie = new Set<string>();
  if (vorschauProjektion) {
    for (const projektion of vorschauProjektion.values()) {
      for (const z of projektion.zugewiesen) if (z.projiziert === "frei") benoetigteFreie.add(z.key);
    }
  }
  // Vorschau-Lotsen anhand ihrer potentiellen V-Nr. zwischen die echten
  // Zeilen einsortieren — dort stünden sie später auch wirklich.
  const projizierte = [...verplante, ...freie.filter((k) => benoetigteFreie.has(k.key))];
  const anzeigeLotsen = sortiereSeestation([...lotsenZeilen, ...projizierte]);
  const zeilen = Math.max(schiffeSortiert.length, anzeigeLotsen.length);

  const [schiffAuswahl, setSchiffAuswahl] = useState<number | null>(null);
  // Mehrere Lotsen wählbar, wenn das gewählte Schiff mehr als einen
  // benötigt (Doppeldecker) — sonst wie bisher eine einzelne Auswahl.
  const [lotseAuswahl, setLotseAuswahl] = useState<string[]>([]);
  const [neuesSchiffOffen, setNeuesSchiffOffen] = useState(false);
  const [editSchiff, setEditSchiff] = useState<SeeSchiff | null>(null);
  const [loeschenSchiff, setLoeschenSchiff] = useState<SeeSchiff | null>(null);
  const [aktionLotse, setAktionLotse] = useState<SeestationZeile | null>(null);
  const [abschoepfenLotse, setAbschoepfenLotse] = useState<SeestationZeile | null>(null);
  const [neuerLotseOffen, setNeuerLotseOffen] = useState(false);
  // "Abteilen": Rückfrage vor dem Verbinden von Schiff + Lotse
  const [abteilenFrage, setAbteilenFrage] = useState(false);

  // Vorbelegung fürs Hinzufügen: letzte (höchste) V-Nr. der Revier-Lotsen
  const vNrProfil = zeilenAusAbteilungen(abteilungen).reduce((max, z) => Math.max(max, z.vNr), 0);

  // Aktuelle Auswahl für das Seestation-Abteilen — Button erscheint, sobald
  // ein Schiff und mindestens ein Lotse markiert sind. Aktiv wird er erst,
  // wenn das Schiff angemeldet ist und genau so viele Lotsen ausgewählt
  // sind, wie noch benötigt werden (bei Doppeldeckern also zwei, die
  // bereits vor Ort ("Auf Seestation") sein müssen).
  const abteilenSchiff = schiffAuswahl !== null ? (schiffeSortiert.find((s) => s.id === schiffAuswahl) ?? null) : null;
  const abteilenLotseZeilen = lotseAuswahl
    .map((key) => lotsenZeilen.find((z) => z.key === key))
    .filter((z): z is SeestationZeile => z !== undefined);
  const abteilenBenoetigt = abteilenSchiff ? verbleibendeLotsen(abteilenSchiff) : 0;
  const abteilenMoeglich =
    (abteilenSchiff?.angemeldet ?? false) &&
    abteilenLotseZeilen.length === abteilenBenoetigt &&
    abteilenLotseZeilen.every((z) => z.aufStation);
  const abteilenWarnungen = abteilenSchiff
    ? abteilenLotseZeilen
        .map((z, i) =>
          eignungsWarnungSeestation(abteilenSchiff, z, (abgeteiltProSchiff.get(abteilenSchiff.id) ?? 0) + i === 0),
        )
        .filter((w): w is string => w !== undefined)
    : [];
  const abteilenWarnung =
    abteilenWarnungen.length > 0 ? Array.from(new Set(abteilenWarnungen)).join(" / ") : undefined;

  function handleAbteilenJa() {
    if (!abteilenSchiff || abteilenLotseZeilen.length === 0) return;
    for (const lotse of abteilenLotseZeilen) {
      teileSeeAb(
        {
          seeSchiffId: abteilenSchiff.id,
          schiffsname: abteilenSchiff.schiffsname,
          lotsenQuelle: lotse.quelle,
          lotsenId: lotse.id,
          lotsenName: lotse.name,
          lotsenKategorie: lotse.kategorie,
          elbehafen: lotse.elbehafen,
          abteilZeit: new Date(),
        },
        lotse.quelle,
        lotse.id,
      );
    }
    setSchiffAuswahl(null);
    setLotseAuswahl([]);
    setAbteilenFrage(false);
  }

  const dennoch = abteilenWarnung ? "dennoch " : "";
  const abteilenFrageText =
    abteilenSchiff && abteilenLotseZeilen.length > 0
      ? `Soll${abteilenLotseZeilen.length > 1 ? "en" : ""} ${abteilenLotseZeilen.map((z) => z.name).join(" und ")} zu ${abteilenSchiff.schiffsname} ${dennoch}abgeteilt werden?`
      : "";

  function handleSchiffOk(schiff: SeeSchiff) {
    updateSeeSchiff(schiff.id, schiff);
    setSchiffAuswahl(null);
    setEditSchiff(null);
  }

  // Kat.-Dropdown auf Ebene der Modal-Überschrift: speichert sofort (wie
  // "aktuelle Fahrt" in der Einsatzstation), kein eigener OK-Button nötig.
  // editSchiff wird als lokale Kopie mitgeführt, damit ein anschließendes
  // "OK" des restlichen Formulars die neue Kat. nicht wieder überschreibt.
  function handleKategorieChange(wert: string) {
    if (!editSchiff) return;
    const aktualisiert = { ...editSchiff, kategorie: wert || undefined };
    updateSeeSchiff(editSchiff.id, aktualisiert);
    setEditSchiff(aktualisiert);
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
    setLotseAuswahl([]);
    setAktionLotse(null);
  }

  function handleAufSeestation() {
    if (!aktionLotse) return;
    if (aktionLotse.quelle === "abteilung") {
      updateAbteilung(aktionLotse.id, { aufSeestation: true });
    } else {
      updateSeestationLotse(aktionLotse.id, { aufStation: true });
    }
    setLotseAuswahl([]);
    setAktionLotse(null);
  }

  // Verschieben (nur Versetzliste-Lotsen, quelle "abteilung"): der Lotse
  // verliert seine V-Nr. und bekommt die des Ziels mit Dezimal-Zusatz
  // (.1, .2, …) — mehrere Verschiebungen hinter dieselbe Basis-Nr. zählen
  // fortlaufend hoch (105 → 105.1 → 105.2 …). Maximal 9 Verschiebungen je
  // Basis: ein zehntes Kind ergäbe "105.10", was numerisch mit 105.1
  // kollidiert — volle Basen tauchen daher nicht mehr als Ziel auf.
  function anzahlKinder(basis: number): number {
    return abteilungen.filter((a) => a.vNr !== undefined && Math.floor(a.vNr) === basis && a.vNr !== basis).length;
  }
  const verschiebenZiele =
    aktionLotse && aktionLotse.quelle === "abteilung"
      ? lotsenZeilen
          .filter(
            (z) =>
              z.quelle === "abteilung" &&
              z.aufStation &&
              z.id !== aktionLotse.id &&
              anzahlKinder(Math.floor(z.vNr)) < 9,
          )
          .map((z) => ({ id: z.id, label: `${z.name} (${z.vNr})` }))
      : [];

  function handleVerschieben(zielAbteilungId: number) {
    if (!aktionLotse || aktionLotse.quelle !== "abteilung") return;
    const ziel = abteilungen.find((a) => a.id === zielAbteilungId);
    if (!ziel || ziel.vNr === undefined) return;
    const basis = Math.floor(ziel.vNr);
    const vorhandeneKinder = anzahlKinder(basis);
    if (vorhandeneKinder >= 9) return;
    const neueVNr = Number(`${basis}.${vorhandeneKinder + 1}`);
    updateAbteilung(aktionLotse.id, { vNr: neueVNr });
    setLotseAuswahl([]);
    setAktionLotse(null);
  }

  function handleAbschoepfenJa() {
    if (!abschoepfenLotse) return;
    if (abschoepfenLotse.quelle === "abteilung") {
      updateAbteilung(abschoepfenLotse.id, { abgeschoepft: true });
    } else {
      updateSeestationLotse(abschoepfenLotse.id, { abgeschoepft: true });
    }
    setLotseAuswahl([]);
    setAbschoepfenLotse(null);
  }

  return (
    <div>
      <PageHeader title="Seestation" centered />
      <Panel
        actionLeft={
          <div className="seestation-kopf-links">
            <button type="button" className="btn btn--small btn--accent" onClick={() => setNeuesSchiffOffen(true)}>
              + Neues Schiff
            </button>
            <button
              type="button"
              className={"btn btn--small" + (vorschau ? " btn--accent" : "")}
              onClick={() => setVorschau((v) => !v)}
            >
              Vorschau
            </button>
          </div>
        }
        action={
          <>
            {abteilenSchiff && abteilenLotseZeilen.length > 0 && (
              <button
                type="button"
                className="btn btn--accent seestation-abteilen"
                disabled={!abteilenMoeglich}
                onClick={() => setAbteilenFrage(true)}
              >
                Abteilen
              </button>
            )}
            <button type="button" className="btn btn--small btn--accent" onClick={() => setNeuerLotseOffen(true)}>
              + Lotse hinzufügen
            </button>
          </>
        }
      >
        <div className="tabelle-scroll">
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
              const lotse = anzeigeLotsen[i];
              const schiffKlasse =
                "seestation-table__seite" +
                (schiff && schiffAuswahl === schiff.id ? " ist-ausgewaehlt" : "") +
                (schiff?.angemeldet ? " fett" : "");
              const lotseKlasse =
                "seestation-table__seite" +
                (lotse && lotseAuswahl.includes(lotse.key) ? " ist-ausgewaehlt" : "") +
                (lotse?.aufStation ? " fett" : " gedimmt") +
                (lotse?.projiziert === "verplant" ? " vorschau-orange" : lotse?.projiziert ? " vorschau-blau" : "");
              const schiffKlick = schiff
                ? () => setSchiffAuswahl((aktiv) => (aktiv === schiff.id ? null : schiff.id))
                : undefined;
              const schiffDoppelklick = schiff
                ? () => {
                    setSchiffAuswahl(schiff.id);
                    setEditSchiff(schiff);
                  }
                : undefined;
              // Einfachauswahl, außer das gewählte Schiff braucht noch mehr
              // als einen Lotsen (Doppeldecker) — dann bis zu dessen
              // verbleibendem Bedarf mehrere gleichzeitig wählbar.
              // Projizierte Vorschau-Zeilen sind nicht anklickbar.
              const lotseKlick =
                lotse && !lotse.projiziert
                  ? () =>
                      setLotseAuswahl((aktuell) => {
                        if (aktuell.includes(lotse.key)) return aktuell.filter((k) => k !== lotse.key);
                        const kapazitaet = abteilenSchiff ? Math.max(verbleibendeLotsen(abteilenSchiff), 1) : 1;
                        if (aktuell.length >= kapazitaet) return [lotse.key];
                        return [...aktuell, lotse.key];
                      })
                  : undefined;
              const lotseDoppelklick =
                lotse && !lotse.projiziert
                  ? () => {
                      setLotseAuswahl([lotse.key]);
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
                        {vorschauProjektion ? (
                          <VorschauHinweis projektion={vorschauProjektion.get(schiff.id)} />
                        ) : (
                          <SeestationHinweis namen={(zuweisungenSee.get(schiff.id) ?? []).map((z) => z.name)} />
                        )}
                      </td>
                      <td className={`${schiffKlasse} num zentriert`} onClick={schiffKlick} onDoubleClick={schiffDoppelklick}>
                        {schiff.kategorie ?? "·"}
                        {schiff.ehfLotseBenoetigt && <span className="planung-hinweis"> (EH)</span>}
                      </td>
                      <td className={`${schiffKlasse} num zentriert`} onClick={schiffKlick} onDoubleClick={schiffDoppelklick}>
                        {verbleibendeLotsen(schiff) > 1 ? verbleibendeLotsen(schiff) : ""}
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
                        {Number.isFinite(lotse.vNr) ? lotse.vNr : "–"}
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
        </div>
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
        <Modal
          title={editSchiff.schiffsname}
          onClose={() => setEditSchiff(null)}
          maxWidth="360px"
          titelZentriert
          headerExtra={
            <SchiffKatSelect
              value={editSchiff.kategorie ?? ""}
              onChange={handleKategorieChange}
              className="modal__head-select"
            />
          }
        >
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
            // Prüfung über ALLE manuellen Datensätze (auch abgeschöpfte/
            // see-abgeteilte) — die können per Rückgängig zurückkehren.
            istVergeben={(vNr, zusatz) => seestationLotsen.some((l) => l.vNr === vNr && l.zusatz === zusatz)}
            onEinfuegen={(lotse) => {
              addSeestationLotse(lotse);
              setNeuerLotseOffen(false);
            }}
            onAbbrechen={() => setNeuerLotseOffen(false)}
          />
        </Modal>
      )}

      {abteilenFrage && abteilenSchiff && abteilenLotseZeilen.length > 0 && (
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
    </div>
  );
}
