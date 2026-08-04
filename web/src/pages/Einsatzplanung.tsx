import { useState } from "react";
import { getAbteilzeitSettings } from "@wache/core";
import { Badge } from "../components/Badge";
import { LotsenAnzahlModal } from "../components/LotsenAnzahlModal";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import type { JobEintrag, LotsenEintrag } from "../data/types";
import { benoetigteLotsenAnzahl, sortiereEintraege, vonTypeLabel } from "../lib/coreJob";
import { formatUhrzeit } from "../lib/format";
import { sortiereUndNummeriere } from "../lib/lotsenOrdnung";
import { planeEinsatzstation } from "../lib/planungEinsatzstation";
import { useData } from "../state/DataContext";
import "./Einsatzplanung.css";

const settings = getAbteilzeitSettings("Wechsel Tide");

/** "Planung Einsatzstation": zugewiesene Lotsen dezent hinter dem
 *  Schiffsnamen, mehrere durch ", " getrennt. */
function PlanungHinweis({ namen }: { namen: string[] }) {
  if (namen.length === 0) return null;
  return <span className="planung-hinweis"> ({namen.join(", ")})</span>;
}

/** Anmeldungs-Typen, für die zugewiesene Lotsen keine V-Nr. bekommen — die
 *  V-Nr. rutscht dann zum nächsten Lotsen ohne diese Restriktion weiter. */
const OHNE_V_NR_TYPEN = new Set(["Sonderradar", "Nebelradar", "2+2", "1+1", "WB", "WR"]);

export function Einsatzplanung() {
  const { jobs, lotsen, aktuelleFahrt, updateJob, vNrStart } = useData();
  const jobsSortiert = sortiereEintraege(jobs, settings);
  // Komplette Lotsenliste der Einsatzstation: 1. Prio Fahrt ≠ leer (in der
  // dort geltenden Fahrt-Rotationsreihenfolge), 2. Prio Fahrt = leer — genau
  // die Reihenfolge, die sortiereUndNummeriere bereits liefert.
  const lotsenSortiert = sortiereUndNummeriere(lotsen, aktuelleFahrt);
  const zeilen = Math.max(jobsSortiert.length, lotsenSortiert.length);
  // "Planung Einsatzstation" — wird bei jeder Änderung neu berechnet
  const zuweisungen = planeEinsatzstation(jobs, lotsen, aktuelleFahrt, settings);
  const zugewieseneLotsen = new Set(Array.from(zuweisungen.values()).flat());

  // V-Nr.: fortlaufend ab vNrStart, aber Lotsen mit einer Zuweisung aus
  // OHNE_V_NR_TYPEN bekommen keine — der Zähler bleibt für sie stehen und
  // geht an den nächsten Lotsen ohne diese Restriktion.
  const ohneVNr = new Set<LotsenEintrag>();
  for (const { eintrag: job } of jobsSortiert) {
    if (job.liste === "andere" && job.typ && OHNE_V_NR_TYPEN.has(job.typ)) {
      for (const l of zuweisungen.get(job.id) ?? []) ohneVNr.add(l);
    }
  }
  const vNrProLotse = new Map<LotsenEintrag, number>();
  let naechsteVNr = vNrStart;
  for (const { eintrag } of lotsenSortiert) {
    if (ohneVNr.has(eintrag)) continue;
    vNrProLotse.set(eintrag, naechsteVNr);
    naechsteVNr += 1;
  }

  // Unabhängige Auswahl je Seite: ein Job UND ein Lotse können gleichzeitig
  // markiert sein (z.B. Job 1 + Lotse 2). Erneuter Klick wählt wieder ab.
  const [jobAuswahl, setJobAuswahl] = useState<number | null>(null);
  const [lotseAuswahl, setLotseAuswahl] = useState<number | null>(null);
  // Doppelklick auf "Lots." öffnet das Bearbeitungsfenster für die Anzahl
  const [lotsenAnzahlJob, setLotsenAnzahlJob] = useState<JobEintrag | null>(null);

  function handleLotsenAnzahlUebernehmen(wert: number) {
    if (!lotsenAnzahlJob) return;
    updateJob(lotsenAnzahlJob.id, { ...lotsenAnzahlJob, lotsenAnzahl: wert });
    setJobAuswahl(null);
    setLotsenAnzahlJob(null);
  }

  return (
    <div>
      <PageHeader title="Einsatzplanung" />
      <Panel title="Zuordnung" count={`${zeilen} Zeilen`}>
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
              <th className="num">V-Nr.</th>
              <th>Name</th>
              <th className="num">Kat.</th>
              <th>EH</th>
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
                      <td className={`${jobKlasse} num zentriert`} onClick={jobKlick}>
                        {formatUhrzeit(paar.abteilzeit)}
                      </td>
                      <td
                        className={`${jobKlasse} num zentriert`}
                        onClick={jobKlick}
                        onDoubleClick={() => {
                          setJobAuswahl(paar.eintrag.id);
                          setLotsenAnzahlJob(paar.eintrag);
                        }}
                      >
                        {benoetigteLotsenAnzahl(paar.eintrag)}
                      </td>
                    </>
                  ) : (
                    <td colSpan={6} className="muted">
                      –
                    </td>
                  )}
                  <td className="einsatz-table__divider" aria-hidden="true">
                    <span className="einsatz-table__arrow">→</span>
                  </td>
                  {lotse ? (
                    <>
                      <td
                        className={`${lotseKlasse} num ${zugewieseneLotsen.has(lotse.eintrag) ? "fett" : "muted"}`}
                        onClick={lotseKlick}
                      >
                        {vNrProLotse.get(lotse.eintrag) ?? ""}
                      </td>
                      <td className={`${lotseKlasse} cell-name`} onClick={lotseKlick}>
                        {lotse.eintrag.name}
                      </td>
                      <td className={`${lotseKlasse} num`} onClick={lotseKlick}>
                        {lotse.eintrag.kategorie}
                      </td>
                      <td className={lotseKlasse} onClick={lotseKlick}>
                        {lotse.eintrag.elbehafen ? "✓" : ""}
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
    </div>
  );
}
