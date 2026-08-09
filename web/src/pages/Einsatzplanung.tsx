import { useEffect, useState } from "react";
import { getAbteilzeitSettings } from "@wache/core";
import { AbrufenModal } from "../components/AbrufenModal";
import { AbtZeitModal } from "../components/AbtZeitModal";
import { AnStationModal } from "../components/AnStationModal";
import { Badge } from "../components/Badge";
import { FrageModal } from "../components/FrageModal";
import { LotsenAnzahlModal } from "../components/LotsenAnzahlModal";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import type { JobEintrag } from "../data/types";
import { benoetigteLotsenAnzahl, istAgJob, istOhneVNrJob, sortiereEintraege, vonTypeLabel } from "../lib/coreJob";
import { formatUhrzeit } from "../lib/format";
import { sortiereUndNummeriere, type LotseMitOrdnung } from "../lib/lotsenOrdnung";
import { abteilzeitProLotse, eignungsWarnung, geplanterAbruf, planeEinsatzstation } from "../lib/planungEinsatzstation";
import { berechnePotentielleVNrn } from "../lib/vNrPlanung";
import { useData } from "../state/DataContext";
import "./Einsatzplanung.css";

const settings = getAbteilzeitSettings("Wechsel Tide");

/** "Planung Einsatzstation": zugewiesene Lotsen dezent hinter dem
 *  Schiffsnamen, mehrere durch ", " getrennt. */
function PlanungHinweis({ namen }: { namen: string[] }) {
  if (namen.length === 0) return null;
  return <span className="planung-hinweis"> ({namen.join(", ")})</span>;
}

/** Kat. und EH dezent hinter dem Lotsennamen, im selben Stil wie
 *  PlanungHinweis. Volllotsen (kategorie === "") ohne EH zeigen nichts. */
function LotseHinweis({ kategorie, eh }: { kategorie: string; eh: boolean }) {
  const teile = [kategorie, eh ? "EH" : ""].filter((t) => t !== "");
  if (teile.length === 0) return null;
  return <span className="planung-hinweis"> ({teile.join(", ")})</span>;
}


export function Einsatzplanung() {
  const { jobs, lotsen, aktuelleFahrt, updateJob, updateLotse, vNrStart, abteilungen, teileAb, verbrauchteVNrn } =
    useData();
  // Zeit-Tick für die Überfällig-Hervorhebungen (Abt. Zeit / gepl. Abruf),
  // damit sie auch ohne Datenänderung umspringen — wie im Dashboard.
  const [jetzt, setJetzt] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setJetzt(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  // Bereits abgeteilte Lotsen je Job: voll abgeteilte Jobs verschwinden aus
  // der Liste, AG-Jobs zeigen bis dahin die Rest-Anzahl.
  const abgeteiltProJob = new Map<number, number>();
  for (const a of abteilungen) abgeteiltProJob.set(a.jobId, (abgeteiltProJob.get(a.jobId) ?? 0) + 1);
  const jobsSortiert = sortiereEintraege(jobs, settings).filter(
    ({ eintrag }) => benoetigteLotsenAnzahl(eintrag) - (abgeteiltProJob.get(eintrag.id) ?? 0) > 0,
  );
  // Komplette Lotsenliste der Einsatzstation: 1. Prio Fahrt ≠ leer (in der
  // dort geltenden Fahrt-Rotationsreihenfolge), 2. Prio Fahrt = leer — genau
  // die Reihenfolge, die sortiereUndNummeriere bereits liefert (abgeteilte
  // Lotsen sind dort schon ausgeblendet).
  const lotsenSortiert = sortiereUndNummeriere(lotsen, aktuelleFahrt);
  const zeilen = Math.max(jobsSortiert.length, lotsenSortiert.length);
  // "Planung Einsatzstation" — wird bei jeder Änderung neu berechnet
  const zuweisungen = planeEinsatzstation(jobs, lotsen, aktuelleFahrt, settings, abgeteiltProJob);
  const zugewieseneLotsen = new Set(Array.from(zuweisungen.values()).flat());

  // Potentielle V-Nrn — gemeinsame Logik mit der Seestation-Vorschau,
  // siehe lib/vNrPlanung.ts.
  const { vNrProLotse, typProLotse, naechsteFreieVNr } = berechnePotentielleVNrn(
    jobsSortiert,
    lotsenSortiert,
    zuweisungen,
    vNrStart,
    verbrauchteVNrn,
  );

  // "gepl. Abruf": Abt.Zeit des zugewiesenen Jobs minus die Abrufzeit des
  // Lotsen — wird bei jeder Änderung neu berechnet.
  const abteilzeitProLotseMap = abteilzeitProLotse(jobsSortiert, zuweisungen);

  // Unabhängige Auswahl je Seite: ein Job UND Lotsen können gleichzeitig
  // markiert sein. Mehrere Lotsen wählbar, wenn der gewählte Job mehr als
  // einen braucht (AG/AG (Tender)) — wie das Doppeldecker-Abteilen der
  // Seestation. Erneuter Klick wählt wieder ab.
  const [jobAuswahl, setJobAuswahl] = useState<number | null>(null);
  const [lotseAuswahl, setLotseAuswahl] = useState<number[]>([]);
  // Doppelklick auf "Lots." (nur bei AG-Jobs) öffnet das Bearbeitungsfenster
  const [lotsenAnzahlJob, setLotsenAnzahlJob] = useState<JobEintrag | null>(null);
  // Doppelklick auf "Abt. Zeit" öffnet das Bearbeitungsfenster für die Zeit
  const [abtZeitJob, setAbtZeitJob] = useState<JobEintrag | null>(null);
  // Doppelklick auf den Lotsen-Namen öffnet das Abrufen-Fenster
  const [abrufenLotse, setAbrufenLotse] = useState<LotseMitOrdnung | null>(null);
  // Doppelklick auf "An Stn." öffnet das Bearbeitungsfenster (nur wenn
  // bereits abgerufen)
  const [anStationLotse, setAnStationLotse] = useState<LotseMitOrdnung | null>(null);
  // "Abteilen": Rückfrage vor dem Verbinden von Job + Lotse
  const [abteilenFrage, setAbteilenFrage] = useState(false);

  // Aktuelle Auswahl für das Abteilen — Button erscheint, sobald ein Job
  // und mindestens ein Lotse markiert sind. Aktiv wird er erst, wenn genau
  // so viele Lotsen ausgewählt sind, wie der Job noch braucht (AG-Jobs:
  // Rest-Anzahl, sonst 1), und ALLE abgerufen (also an der Einsatzstation)
  // sind.
  const abteilenJob = jobAuswahl !== null ? (jobs.find((j) => j.id === jobAuswahl) ?? null) : null;
  const abteilenBenoetigt = abteilenJob
    ? benoetigteLotsenAnzahl(abteilenJob) - (abgeteiltProJob.get(abteilenJob.id) ?? 0)
    : 0;
  const abteilenLotsen = lotseAuswahl
    .map((i) => lotsenSortiert[i])
    .filter((l): l is LotseMitOrdnung => l !== undefined);
  const abteilenMoeglich =
    abteilenLotsen.length === abteilenBenoetigt && abteilenLotsen.every((l) => l.eintrag.abgerufen);
  // Warnung, wenn gewählte Lotsen die Anforderungen des Jobs nicht
  // erfüllen (Kat., Job-Typ, EH) — abteilen bleibt trotzdem möglich.
  const abteilenWarnungen = abteilenJob
    ? abteilenLotsen.map((l) => eignungsWarnung(abteilenJob, l.eintrag)).filter((w): w is string => w !== undefined)
    : [];
  const abteilenWarnung =
    abteilenWarnungen.length > 0 ? Array.from(new Set(abteilenWarnungen)).join(" / ") : undefined;

  // V-Nrn der Auswahl (Anzeige + Abteilen, Index-gleich zu abteilenLotsen).
  // Der Fallback zählt selbst weiter, damit zwei Lotsen ohne potentielle
  // Nummer nicht dieselbe Fallback-Nummer bekommen.
  const abteilenVNrn = (() => {
    const verbraucht = new Set(verbrauchteVNrn);
    let fallback = naechsteFreieVNr;
    return abteilenLotsen.map((l) => {
      const vNr = vNrProLotse.get(l.eintrag);
      if (vNr !== undefined) return vNr;
      while (verbraucht.has(fallback)) fallback += 1;
      return fallback++;
    });
  })();

  function handleAbteilenJa() {
    if (!abteilenJob || abteilenLotsen.length === 0) return;
    const ohne = istOhneVNrJob(abteilenJob);
    abteilenLotsen.forEach((lotse, i) => {
      teileAb(
        {
          jobId: abteilenJob.id,
          vNr: ohne ? undefined : abteilenVNrn[i],
          typLabel: vonTypeLabel(abteilenJob),
          schiffsname: abteilenJob.schiffsname,
          lotsenName: lotse.eintrag.name,
          lotsenKategorie: lotse.eintrag.kategorie,
          elbehafen: lotse.eintrag.elbehafen,
          abteilZeit: new Date(),
        },
        lotse.index,
      );
    });
    setJobAuswahl(null);
    setLotseAuswahl([]);
    setAbteilenFrage(false);
  }

  const dennoch = abteilenWarnung ? "dennoch " : "";
  const abteilenNamen = abteilenLotsen.map((l) => l.eintrag.name);
  const sollen = abteilenNamen.length > 1 ? "Sollen" : "Soll";
  const abteilenFrageText =
    abteilenJob && abteilenLotsen.length > 0
      ? istOhneVNrJob(abteilenJob)
        ? `${sollen} ${abteilenNamen.join(" und ")} zu ${[vonTypeLabel(abteilenJob), abteilenJob.schiffsname].filter(Boolean).join(" ")} ${dennoch}abgeteilt werden?`
        : `${sollen} ${abteilenNamen.join(" und ")} zu ${abteilenJob.schiffsname ?? "?"} mit ${abteilenVNrn.length > 1 ? `den V-Nrn. ${abteilenVNrn.join(" und ")}` : `der V-Nr. ${abteilenVNrn[0]}`} ${dennoch}abgeteilt werden?`
      : "";

  // Nur AG-Jobs haben eine editierbare Lotsenanzahl — der Override schreibt
  // direkt agLotsenAnzahl (statt eines separaten Feldes), damit das
  // AG-Formular im Jobs-Tab immer den aktuellen Stand zeigt. Der im
  // Schiffsnamen eingebrannte "(X AG)"-Zusatz wird passend mit erneuert.
  function handleLotsenAnzahlUebernehmen(wert: number) {
    if (!lotsenAnzahlJob) return;
    if (lotsenAnzahlJob.typ === "AG (Tender)") {
      // kein Trägerjob, der Name bleibt fest "Tender"
      updateJob(lotsenAnzahlJob.id, { ...lotsenAnzahlJob, agLotsenAnzahl: wert });
    } else {
      const verknuepft = jobs.find((j) => j.id === lotsenAnzahlJob.agJobId);
      const basis = verknuepft?.schiffsname ?? "";
      updateJob(lotsenAnzahlJob.id, {
        ...lotsenAnzahlJob,
        agLotsenAnzahl: wert,
        schiffsname: basis ? `${basis} (${wert} AG)` : undefined,
      });
    }
    setJobAuswahl(null);
    setLotsenAnzahlJob(null);
  }

  // Bei HH/NOK entspricht das genau dem Feld "man. Abt.Zeit" des
  // Formulars, bei Andere Jobs der direkten Abt.Zeit-Eingabe — beides ist
  // dasselbe Datenfeld abtZeitManuell, daher hier keine Fallunterscheidung
  // nötig.
  function handleAbtZeitUebernehmen(wert: Date | undefined) {
    if (!abtZeitJob) return;
    updateJob(abtZeitJob.id, { ...abtZeitJob, abtZeitManuell: wert });
    setJobAuswahl(null);
    setAbtZeitJob(null);
  }

  // "Lotsen abrufen": An Stn. = jetzt + Abrufzeit, gepl. Abruf zeigt danach
  // "–". "Abruf zurück": beide Felder zurücksetzen — das entspricht wieder
  // dem berechneten Ausgangszustand.
  function handleAbrufenToggle() {
    if (!abrufenLotse) return;
    const { eintrag, index } = abrufenLotse;
    if (eintrag.abgerufen) {
      updateLotse(index, { ...eintrag, abgerufen: false, anStationZeit: undefined });
    } else {
      const abrufStunden = eintrag.abrufStunden ?? 1;
      updateLotse(index, { ...eintrag, abgerufen: true, anStationZeit: new Date(Date.now() + abrufStunden * 3_600_000) });
    }
    setLotseAuswahl([]);
    setAbrufenLotse(null);
  }

  function handleAnStationUebernehmen(wert: Date | undefined) {
    if (!anStationLotse) return;
    updateLotse(anStationLotse.index, { ...anStationLotse.eintrag, anStationZeit: wert });
    setLotseAuswahl([]);
    setAnStationLotse(null);
  }

  return (
    <div className="einsatzplanung-seite">
      <PageHeader title="Einsatzplanung" />
      <Panel
        // leeres Fragment statt Titel/Counter: der Kopf bleibt als
        // Platzhalter erhalten, damit der Abteilen-Button beim Erscheinen
        // das Layout nicht verschiebt
        action={
          <>
            {abteilenJob && abteilenLotsen.length > 0 && (
              <button
                type="button"
                className="btn btn--accent einsatz-abteilen"
                disabled={!abteilenMoeglich}
                onClick={() => setAbteilenFrage(true)}
              >
                Abteilen
              </button>
            )}
          </>
        }
      >
        <div className="tabelle-scroll">
        <table className="einsatz-table">
          <thead>
            <tr className="einsatz-table__gruppen">
              <th colSpan={6}>Jobs</th>
              <th className="einsatz-table__divider" aria-hidden="true" />
              <th colSpan={4}>Lotsen</th>
            </tr>
            <tr>
              <th className="num">#</th>
              <th className="zentriert schmal">Von / Type</th>
              <th>Schiffsname</th>
              <th className="num zentriert">Kat.</th>
              <th className="num zentriert">Abt. Zeit</th>
              <th className="num zentriert">Lots.</th>
              <th className="einsatz-table__divider" aria-hidden="true" />
              <th className="num zentriert vnr-schmal">V-Nr.</th>
              <th>Name</th>
              <th className="num zentriert kopf-umbruch">gepl. Abruf</th>
              <th className="num zentriert kopf-umbruch anstn-fix">An Stn.</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: zeilen }).map((_, i) => {
              const paar = jobsSortiert[i];
              const lotse = lotsenSortiert[i];
              const jobKlasse =
                "einsatz-table__seite" + (paar && jobAuswahl === paar.eintrag.id ? " ist-ausgewaehlt" : "");
              const lotseKlasse =
                "einsatz-table__seite" + (lotse && lotseAuswahl.includes(i) ? " ist-ausgewaehlt" : "");
              const jobKlick = paar
                ? () => setJobAuswahl((aktiv) => (aktiv === paar.eintrag.id ? null : paar.eintrag.id))
                : undefined;
              // Einfachauswahl, außer der gewählte Job braucht noch mehr als
              // einen Lotsen (AG/AG (Tender)) — dann bis zu dessen
              // verbleibendem Bedarf mehrere gleichzeitig wählbar.
              const lotseKlick = lotse
                ? () =>
                    setLotseAuswahl((aktuell) => {
                      if (aktuell.includes(i)) return aktuell.filter((x) => x !== i);
                      const kapazitaet = Math.max(abteilenBenoetigt, 1);
                      if (aktuell.length >= kapazitaet) return [i];
                      return [...aktuell, i];
                    })
                : undefined;
              return (
                <tr key={i}>
                  {paar ? (
                    <>
                      <td className={`${jobKlasse} num muted`} onClick={jobKlick}>
                        {i + 1}
                      </td>
                      <td className={`${jobKlasse} zentriert schmal`} onClick={jobKlick}>
                        <Badge>{vonTypeLabel(paar.eintrag)}</Badge>
                      </td>
                      <td className={`${jobKlasse} cell-name`} onClick={jobKlick}>
                        {paar.eintrag.schiffsname ?? "–"}
                        <PlanungHinweis namen={(zuweisungen.get(paar.eintrag.id) ?? []).map((l) => l.name)} />
                      </td>
                      <td className={`${jobKlasse} num muted zentriert`} onClick={jobKlick}>
                        {paar.eintrag.kategorie ?? "·"}
                      </td>
                      <td
                        className={
                          `${jobKlasse} num zentriert` +
                          (paar.abteilzeit && paar.abteilzeit.getTime() <= jetzt.getTime() ? " zeit-ueberfaellig" : "")
                        }
                        onClick={jobKlick}
                        onDoubleClick={() => {
                          setJobAuswahl(paar.eintrag.id);
                          setAbtZeitJob(paar.eintrag);
                        }}
                      >
                        {formatUhrzeit(paar.abteilzeit)}
                      </td>
                      <td
                        className={
                          `${jobKlasse} num zentriert` +
                          ((abgeteiltProJob.get(paar.eintrag.id) ?? 0) > 0 ? " lots-rest" : "")
                        }
                        onClick={jobKlick}
                        onDoubleClick={
                          istAgJob(paar.eintrag)
                            ? () => {
                                setJobAuswahl(paar.eintrag.id);
                                setLotsenAnzahlJob(paar.eintrag);
                              }
                            : undefined
                        }
                      >
                        {benoetigteLotsenAnzahl(paar.eintrag) - (abgeteiltProJob.get(paar.eintrag.id) ?? 0)}
                      </td>
                    </>
                  ) : (
                    <td colSpan={6} className="muted">
                      –
                    </td>
                  )}
                  <td className="einsatz-table__divider" aria-hidden="true" />
                  {lotse ? (
                    <>
                      <td
                        className={`${lotseKlasse} num vnr-schmal ${zugewieseneLotsen.has(lotse.eintrag) || lotse.eintrag.abgerufen ? "fett" : "muted"}`}
                        onClick={lotseKlick}
                      >
                        {vNrProLotse.get(lotse.eintrag) ?? typProLotse.get(lotse.eintrag) ?? ""}
                      </td>
                      <td
                        className={`${lotseKlasse} cell-name ${lotse.eintrag.abgerufen ? "fett" : "muted"}`}
                        onClick={lotseKlick}
                        onDoubleClick={() => {
                          setLotseAuswahl([i]);
                          setAbrufenLotse(lotse);
                        }}
                      >
                        {lotse.eintrag.name}
                        <LotseHinweis kategorie={lotse.eintrag.kategorie} eh={lotse.eintrag.elbehafen} />
                      </td>
                      {(() => {
                        const abruf = lotse.eintrag.abgerufen
                          ? undefined
                          : geplanterAbruf(abteilzeitProLotseMap.get(lotse.eintrag), lotse.eintrag.abrufStunden);
                        const ueberfaellig = abruf !== undefined && abruf.getTime() <= jetzt.getTime();
                        return (
                          <td
                            className={`${lotseKlasse} num zentriert` + (ueberfaellig ? " zeit-ueberfaellig" : " muted")}
                            onClick={lotseKlick}
                          >
                            {lotse.eintrag.abgerufen ? "–" : formatUhrzeit(abruf)}
                          </td>
                        );
                      })()}
                      <td
                        className={`${lotseKlasse} num zentriert anstn-fix ${lotse.eintrag.abgerufen ? "fett" : "muted"}`}
                        onClick={lotseKlick}
                        onDoubleClick={
                          lotse.eintrag.abgerufen
                            ? () => {
                                setLotseAuswahl([i]);
                                setAnStationLotse(lotse);
                              }
                            : undefined
                        }
                      >
                        {formatUhrzeit(lotse.eintrag.anStationZeit)}
                      </td>
                    </>
                  ) : (
                    <td colSpan={4} className="muted">
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

      {lotsenAnzahlJob && (
        <Modal
          title={lotsenAnzahlJob.schiffsname ?? "Job"}
          onClose={() => setLotsenAnzahlJob(null)}
          maxWidth="300px"
        >
          <LotsenAnzahlModal
            initial={benoetigteLotsenAnzahl(lotsenAnzahlJob)}
            onUebernehmen={handleLotsenAnzahlUebernehmen}
            onAbbrechen={() => setLotsenAnzahlJob(null)}
          />
        </Modal>
      )}

      {abtZeitJob && (
        <Modal title={abtZeitJob.schiffsname ?? "Job"} onClose={() => setAbtZeitJob(null)} maxWidth="320px">
          <AbtZeitModal
            initial={jobsSortiert.find((p) => p.eintrag.id === abtZeitJob.id)?.abteilzeit}
            onUebernehmen={handleAbtZeitUebernehmen}
            onAbbrechen={() => setAbtZeitJob(null)}
          />
        </Modal>
      )}

      {abrufenLotse && (
        <Modal title={abrufenLotse.eintrag.name} onClose={() => setAbrufenLotse(null)} maxWidth="280px">
          <AbrufenModal
            abgerufen={abrufenLotse.eintrag.abgerufen ?? false}
            onToggle={handleAbrufenToggle}
            onAbbrechen={() => setAbrufenLotse(null)}
          />
        </Modal>
      )}

      {anStationLotse && (
        <Modal title={anStationLotse.eintrag.name} onClose={() => setAnStationLotse(null)} maxWidth="240px">
          <AnStationModal
            initial={anStationLotse.eintrag.anStationZeit}
            onUebernehmen={handleAnStationUebernehmen}
            onAbbrechen={() => setAnStationLotse(null)}
          />
        </Modal>
      )}

      {abteilenFrage && abteilenJob && abteilenLotsen.length > 0 && (
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
