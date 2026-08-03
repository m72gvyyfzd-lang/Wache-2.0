import { useState } from "react";
import { getAbteilzeitSettings } from "@wache/core";
import { Badge } from "../components/Badge";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { sortiereEintraege, vonTypeLabel } from "../lib/coreJob";
import { formatUhrzeit } from "../lib/format";
import { sortiereUndNummeriere } from "../lib/lotsenOrdnung";
import { useData } from "../state/DataContext";
import "./Einsatzplanung.css";

const settings = getAbteilzeitSettings("Wechsel Tide");

export function Einsatzplanung() {
  const { jobs, lotsen, aktuelleFahrt } = useData();
  const jobsSortiert = sortiereEintraege(jobs, settings);
  // nur Bereitschafts-Lotsen (fahrt === "") stehen an der Einsatzstation zur
  // Verfügung — nach BB (Laufnummer innerhalb dieser Gruppe) sortiert; die
  // aktuelle Fahrt beeinflusst nur die Reihenfolge der MoFa/MiFa/AFA-Gruppen,
  // nicht die BB-Nummerierung selbst
  const lotsenSortiert = sortiereUndNummeriere(lotsen, aktuelleFahrt)
    .filter((eintrag) => eintrag.bb !== undefined)
    .sort((a, b) => a.bb! - b.bb!);
  const zeilen = Math.max(jobsSortiert.length, lotsenSortiert.length);

  // Unabhängige Auswahl je Seite: ein Job UND ein Lotse können gleichzeitig
  // markiert sein (z.B. Job 1 + Lotse 2). Erneuter Klick wählt wieder ab.
  const [jobAuswahl, setJobAuswahl] = useState<number | null>(null);
  const [lotseAuswahl, setLotseAuswahl] = useState<number | null>(null);

  return (
    <div>
      <PageHeader title="Einsatzplanung" />
      <Panel title="Zuordnung" count={`${zeilen} Zeilen`}>
        <table className="einsatz-table">
          <thead>
            <tr className="einsatz-table__gruppen">
              <th colSpan={5}>Jobs</th>
              <th className="einsatz-table__divider" aria-hidden="true" />
              <th colSpan={4}>Lotsen</th>
            </tr>
            <tr>
              <th className="num">#</th>
              <th>Von / Type</th>
              <th>Schiffsname</th>
              <th className="num">Kat.</th>
              <th className="num">Abt. Zeit</th>
              <th className="einsatz-table__divider" aria-hidden="true" />
              <th className="num">#</th>
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
                      <td className={jobKlasse} onClick={jobKlick}>
                        <Badge>{vonTypeLabel(paar.eintrag)}</Badge>
                      </td>
                      <td className={`${jobKlasse} cell-name`} onClick={jobKlick}>
                        {paar.eintrag.schiffsname ?? "–"}
                      </td>
                      <td className={`${jobKlasse} num muted`} onClick={jobKlick}>
                        {paar.eintrag.kategorie ?? "·"}
                      </td>
                      <td className={`${jobKlasse} num`} onClick={jobKlick}>
                        {formatUhrzeit(paar.abteilzeit)}
                      </td>
                    </>
                  ) : (
                    <td colSpan={5} className="muted">
                      –
                    </td>
                  )}
                  <td className="einsatz-table__divider" aria-hidden="true">
                    <span className="einsatz-table__arrow">→</span>
                  </td>
                  {lotse ? (
                    <>
                      <td className={`${lotseKlasse} num muted`} onClick={lotseKlick}>
                        {lotse.bb}
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
    </div>
  );
}
