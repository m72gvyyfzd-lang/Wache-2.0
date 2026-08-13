/** ETA-Update: aktualisiert die Liste "ETA Seestation" mitten in der Wache
 *  durch einen erneuten Tendertafel-Upload. Bestehende Schiffe werden über
 *  den Namen erkannt und aktualisiert, neue angehängt; bereits abgeteilte
 *  Schiffe, die noch im PDF stehen, lösen einen Alarm aus und bleiben
 *  unangetastet. Die Lotsen-Spalten des PDFs spielen hier keine Rolle.
 *  Gleicher Aufbau wie der Wachbeginn-Tab (deshalb dessen CSS-Klassen). */
import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { FrageModal } from "../components/FrageModal";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { berechneEtaUpdate, formatEtaFeld, type EtaUpdateFeld, type EtaUpdateZeile } from "../lib/etaUpdate";
import { formatUhrzeit } from "../lib/format";
import type { SeestationPdfErgebnis } from "../lib/seestationPdfParse";
import { useData } from "../state/DataContext";
import "./Wachbeginn.css";
import "./EtaUpdate.css";

type UploadZustand =
  | { status: "leer" }
  | { status: "laedt"; dateiname: string }
  | { status: "fertig"; dateiname: string; daten: SeestationPdfErgebnis }
  | { status: "fehler"; dateiname: string; meldung: string };

const TYP_LABEL: Record<EtaUpdateZeile["typ"], string> = {
  neu: "neu",
  geaendert: "aktualisiert",
  unveraendert: "unverändert",
  abgeteilt: "bereits abgeteilt!",
};

const FELDER: { feld: EtaUpdateFeld; titel: string }[] = [
  { feld: "eta", titel: "ETA" },
  { feld: "kategorie", titel: "Kat." },
  { feld: "angemeldet", titel: "Anm." },
  { feld: "e3st", titel: "E3/St" },
  { feld: "ehfLotseBenoetigt", titel: "EHF" },
  { feld: "doppeldecker", titel: "2 Lots." },
];

export function EtaUpdate() {
  const { seeSchiffe, seeAbteilungen, ersetzeSeeSchiffe } = useData();
  const [upload, setUpload] = useState<UploadZustand>({ status: "leer" });
  const [frageOffen, setFrageOffen] = useState(false);
  const [fertig, setFertig] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleDatei(e: ChangeEvent<HTMLInputElement>) {
    const datei = e.target.files?.[0];
    e.target.value = "";
    if (!datei) return;
    setFertig(false);
    setUpload({ status: "laedt", dateiname: datei.name });
    try {
      const puffer = await datei.arrayBuffer();
      const { extrahierePdfZeilen } = await import("../lib/pdfExtrakt");
      const { parseSeestationPdf } = await import("../lib/seestationPdfParse");
      setUpload({ status: "fertig", dateiname: datei.name, daten: parseSeestationPdf(await extrahierePdfZeilen(puffer)) });
    } catch (fehler) {
      setUpload({
        status: "fehler",
        dateiname: datei.name,
        meldung: fehler instanceof Error ? fehler.message : "PDF konnte nicht gelesen werden",
      });
    }
  }

  // Abgleich gegen den LIVE-Stand: ändert sich die Liste (z.B. Abteilen in
  // einem anderen Tab), rechnet die Vorschau automatisch neu.
  const ergebnis = useMemo(
    () => (upload.status === "fertig" ? berechneEtaUpdate(upload.daten, seeSchiffe, seeAbteilungen, new Date()) : null),
    [upload, seeSchiffe, seeAbteilungen],
  );
  const brauchbar = ergebnis !== null && ergebnis.zeilen.length > 0;
  const ampel =
    upload.status === "leer"
      ? "offen"
      : upload.status === "laedt"
        ? "laedt"
        : upload.status === "fehler" || !brauchbar
          ? "alarm"
          : "ok";

  function handleUebernehmen() {
    if (!ergebnis) return;
    ersetzeSeeSchiffe(ergebnis.seeSchiffe);
    setFrageOffen(false);
    setFertig(true);
    setUpload({ status: "leer" });
  }

  return (
    <div>
      <PageHeader
        title="ETA Update"
        centered
        description="ETA-Seestation-Liste per erneutem Tendertafel-Upload aktualisieren — bestehende Schiffe werden erkannt, neue ergänzt. Die Lotsen bleiben unberührt."
      />

      <Panel>
        <div className="wachbeginn__kachel">
          <div className="wachbeginn__aktionen">
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleDatei}
              data-testid="etaupdate-datei"
              className="wachbeginn__datei-input"
            />
            <button type="button" className="btn btn--accent" onClick={() => inputRef.current?.click()} data-testid="etaupdate-waehlen">
              Tendertafel-PDF auswählen
            </button>
            <button
              type="button"
              className="btn btn--accent"
              disabled={!brauchbar}
              onClick={() => setFrageOffen(true)}
              data-testid="etaupdate-uebernehmen"
            >
              Update übernehmen
            </button>
          </div>

          <div className="etaupdate__status">
            <span className={`wachbeginn__tab-status wachbeginn__tab-status--${ampel}`} aria-hidden="true" />
            {upload.status === "leer" && !fertig && <span className="wachbeginn__tab-hinweis">keine Datei gewählt</span>}
            {upload.status === "leer" && fertig && (
              <span className="wachbeginn__tab-datei" data-testid="etaupdate-fertig">
                Update übernommen — die ETA-Liste ist aktualisiert
              </span>
            )}
            {upload.status !== "leer" && (
              <span className="wachbeginn__tab-datei">verwendete Datei: {upload.dateiname}</span>
            )}
          </div>

          {upload.status === "fehler" && <div className="wachbeginn__warnung">{upload.meldung}</div>}
          {upload.status === "fertig" && !brauchbar && (
            <div className="wachbeginn__warnung">Keine Schiffseinträge erkannt — ist das wirklich ein Tendertafel-Export?</div>
          )}

          {ergebnis && brauchbar && (
            <div className="wachbeginn__vorschau" data-testid="etaupdate-vorschau">
              <ul className="wachbeginn__meldungen">
                {ergebnis.meldungen.map((m, i) => (
                  <li key={i} className={`wachbeginn__meldung wachbeginn__meldung--${m.stufe}`}>
                    {m.text}
                  </li>
                ))}
              </ul>

              <div className="wachbeginn__tabelle-wrap">
                <table className="wachbeginn__tabelle" data-testid="etaupdate-tabelle">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Schiff</th>
                      {FELDER.map((f) => (
                        <th key={f.feld}>{f.titel}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ergebnis.zeilen.map((z, i) => (
                      <tr key={i} className={`etaupdate__zeile--${z.typ}`}>
                        <td className="etaupdate__typ">{TYP_LABEL[z.typ]}</td>
                        <td>{z.neu.schiffsname}</td>
                        {FELDER.map((f) => {
                          const geaendert = z.felder.includes(f.feld);
                          return (
                            <td key={f.feld} className={geaendert ? "etaupdate__wert--neu" : undefined}>
                              {geaendert && z.alt && (
                                <>
                                  <span className="etaupdate__wert--alt">{formatEtaFeld(f.feld, z.alt)}</span>
                                  {" → "}
                                </>
                              )}
                              {formatEtaFeld(f.feld, z.neu)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Panel>

      {frageOffen && ergebnis && (
        <Modal title="Update übernehmen" onClose={() => setFrageOffen(false)} titelZentriert>
          <FrageModal
            zentriert
            frage={`Soll die ETA-Liste jetzt aktualisiert werden (Stand ${formatUhrzeit(new Date())})?`}
            onJa={handleUebernehmen}
            onNein={() => setFrageOffen(false)}
          />
        </Modal>
      )}
    </div>
  );
}
