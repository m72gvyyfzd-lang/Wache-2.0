import { useState } from "react";
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
import type { JobEintrag, LotsenEintrag } from "../data/types";
import { benoetigteLotsenAnzahl, sortiereEintraege, vonTypeLabel } from "../lib/coreJob";
import { formatUhrzeit } from "../lib/format";
import { sortiereUndNummeriere, type LotseMitOrdnung } from "../lib/lotsenOrdnung";
import { abteilzeitProLotse, geplanterAbruf, planeEinsatzstation } from "../lib/planungEinsatzstation";
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

/** Anmeldungs-Typen, für die zugewiesene Lotsen keine V-Nr. bekommen — die
 *  V-Nr. rutscht dann zum nächsten Lotsen ohne diese Restriktion weiter. */
const OHNE_V_NR_TYPEN = new Set(["Sonderradar", "Nebelradar", "2+2", "1+1", "WB", "WR"]);

/** Jobs dieser Typen landen beim Abteilen ohne V-Nr. auf der Vergabe-Liste. */
function istOhneVNrJob(job: JobEintrag): boolean {
  return job.liste === "andere" && job.typ !== undefined && OHNE_V_NR_TYPEN.has(job.typ);
}

export function Einsatzplanung() {
  const { jobs, lotsen, aktuelleFahrt, updateJob, updateLotse, vNrStart, abteilungen, teileAb } = useData();
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

  // V-Nr.: fortlaufend ab vNrStart, aber Lotsen mit einer Zuweisung aus
  // OHNE_V_NR_TYPEN bekommen keine — der Zähler bleibt für sie stehen und
  // geht an den nächsten Lotsen ohne diese Restriktion. Statt der V-Nr.
  // zeigt die Spalte dann die Kurzform des Job-Typs. Beim Abteilen
  // vergebene Nummern sind fest verbraucht und werden übersprungen.
  const ohneVNr = new Set<LotsenEintrag>();
  const typProLotse = new Map<LotsenEintrag, string>();
  for (const { eintrag: job } of jobsSortiert) {
    if (istOhneVNrJob(job)) {
      for (const l of zuweisungen.get(job.id) ?? []) {
        ohneVNr.add(l);
        typProLotse.set(l, vonTypeLabel(job));
      }
    }
  }
  const vergebeneVNrn = new Set<number>();
  for (const a of abteilungen) if (a.vNr !== undefined) vergebeneVNrn.add(a.vNr);
  const vNrProLotse = new Map<LotsenEintrag, number>();
  let naechsteVNr = vNrStart;
  for (const { eintrag } of lotsenSortiert) {
    if (ohneVNr.has(eintrag)) continue;
    while (vergebeneVNrn.has(naechsteVNr)) naechsteVNr += 1;
    vNrProLotse.set(eintrag, naechsteVNr);
    naechsteVNr += 1;
  }
  while (vergebeneVNrn.has(naechsteVNr)) naechsteVNr += 1;
  const naechsteFreieVNr = naechsteVNr;

  // "gepl. Abruf": Abt.Zeit des zugewiesenen Jobs minus die Abrufzeit des
  // Lotsen — wird bei jeder Änderung neu berechnet.
  const abteilzeitProLotseMap = abteilzeitProLotse(jobsSortiert, zuweisungen);

  // Unabhängige Auswahl je Seite: ein Job UND ein Lotse können gleichzeitig
  // markiert sein (z.B. Job 1 + Lotse 2). Erneuter Klick wählt wieder ab.
  const [jobAuswahl, setJobAuswahl] = useState<number | null>(null);
  const [lotseAuswahl, setLotseAuswahl] = useState<number | null>(null);
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

  // Aktuelle Auswahl für das Abteilen — Button erscheint nur, wenn beides
  // markiert ist.
  const abteilenJob = jobAuswahl !== null ? (jobs.find((j) => j.id === jobAuswahl) ?? null) : null;
  const abteilenLotse = lotseAuswahl !== null ? (lotsenSortiert[lotseAuswahl] ?? null) : null;

  function handleAbteilenJa() {
    if (!abteilenJob || !abteilenLotse) return;
    const ohne = istOhneVNrJob(abteilenJob);
    teileAb(
      {
        jobId: abteilenJob.id,
        vNr: ohne ? undefined : (vNrProLotse.get(abteilenLotse.eintrag) ?? naechsteFreieVNr),
        typLabel: vonTypeLabel(abteilenJob),
        schiffsname: abteilenJob.schiffsname,
        lotsenName: abteilenLotse.eintrag.name,
        lotsenKategorie: abteilenLotse.eintrag.kategorie,
        elbehafen: abteilenLotse.eintrag.elbehafen,
        abteilZeit: new Date(),
      },
      abteilenLotse.index,
    );
    setJobAuswahl(null);
    setLotseAuswahl(null);
    setAbteilenFrage(false);
  }

  const abteilenFrageText =
    abteilenJob && abteilenLotse
      ? istOhneVNrJob(abteilenJob)
        ? `Soll ${abteilenLotse.eintrag.name} zu ${[vonTypeLabel(abteilenJob), abteilenJob.schiffsname].filter(Boolean).join(" ")} abgeteilt werden?`
        : `Soll ${abteilenLotse.eintrag.name} zu ${abteilenJob.schiffsname ?? "?"} mit der V-Nr. ${vNrProLotse.get(abteilenLotse.eintrag) ?? naechsteFreieVNr} abgeteilt werden?`
      : "";

  // Nur AG-Jobs haben eine editierbare Lotsenanzahl — der Override schreibt
  // direkt agLotsenAnzahl (statt eines separaten Feldes), damit das
  // AG-Formular im Jobs-Tab immer den aktuellen Stand zeigt. Der im
  // Schiffsnamen eingebrannte "(X AG)"-Zusatz wird passend mit erneuert.
  function handleLotsenAnzahlUebernehmen(wert: number) {
    if (!lotsenAnzahlJob) return;
    const verknuepft = jobs.find((j) => j.id === lotsenAnzahlJob.agJobId);
    const basis = verknuepft?.schiffsname ?? "";
    updateJob(lotsenAnzahlJob.id, {
      ...lotsenAnzahlJob,
      agLotsenAnzahl: wert,
      schiffsname: basis ? `${basis} (${wert} AG)` : undefined,
    });
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
    setLotseAuswahl(null);
    setAbrufenLotse(null);
  }

  function handleAnStationUebernehmen(wert: Date | undefined) {
    if (!anStationLotse) return;
    updateLotse(anStationLotse.index, { ...anStationLotse.eintrag, anStationZeit: wert });
    setLotseAuswahl(null);
    setAnStationLotse(null);
  }

  return (
    <div>
      <PageHeader title="Einsatzplanung" />
      <Panel
        title="Zuordnung"
        count={`${zeilen} Zeilen`}
        action={
          abteilenJob && abteilenLotse ? (
            <button type="button" className="btn btn--accent einsatz-abteilen" onClick={() => setAbteilenFrage(true)}>
              Abteilen
            </button>
          ) : undefined
        }
      >
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
              const lotseKlasse = "einsatz-table__seite" + (lotse && lotseAuswahl === i ? " ist-ausgewaehlt" : "");
              const jobKlick = paar
                ? () => setJobAuswahl((aktiv) => (aktiv === paar.eintrag.id ? null : paar.eintrag.id))
                : undefined;
              const lotseKlick = lotse ? () => setLotseAuswahl((aktiv) => (aktiv === i ? null : i)) : undefined;
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
                        className={`${jobKlasse} num zentriert`}
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
                          paar.eintrag.liste === "andere" && paar.eintrag.typ === "AG"
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
                          setLotseAuswahl(i);
                          setAbrufenLotse(lotse);
                        }}
                      >
                        {lotse.eintrag.name}
                        <LotseHinweis kategorie={lotse.eintrag.kategorie} eh={lotse.eintrag.elbehafen} />
                      </td>
                      <td className={`${lotseKlasse} num muted zentriert`} onClick={lotseKlick}>
                        {lotse.eintrag.abgerufen
                          ? "–"
                          : formatUhrzeit(geplanterAbruf(abteilzeitProLotseMap.get(lotse.eintrag), lotse.eintrag.abrufStunden))}
                      </td>
                      <td
                        className={`${lotseKlasse} num zentriert anstn-fix ${lotse.eintrag.abgerufen ? "fett" : "muted"}`}
                        onClick={lotseKlick}
                        onDoubleClick={
                          lotse.eintrag.abgerufen
                            ? () => {
                                setLotseAuswahl(i);
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

      {abteilenFrage && abteilenJob && abteilenLotse && (
        <Modal title="Abteilen" onClose={() => setAbteilenFrage(false)} maxWidth="380px">
          <FrageModal frage={abteilenFrageText} onJa={handleAbteilenJa} onNein={() => setAbteilenFrage(false)} />
        </Modal>
      )}
    </div>
  );
}
