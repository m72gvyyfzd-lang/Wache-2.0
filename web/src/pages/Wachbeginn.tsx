/** Wachbeginn: "Neue Wache erstellen" — kompletter Ablauf aus Reset,
 *  PDF-Upload (Tafel Brb + Seestation Pflicht, Törnstände optional),
 *  Analyse mit Plausibilitäts-Meldungen und finaler Übernahme in die
 *  App-Daten. Die Analyse läuft komplett im Browser — die Dateien
 *  verlassen das Gerät nicht. */
import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { FrageModal } from "../components/FrageModal";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import type { PdfSeite } from "../lib/pdfExtrakt";
import type { SeestationPdfErgebnis } from "../lib/seestationPdfParse";
import type { TafelBrbErgebnis } from "../lib/tafelBrbParse";
import type { ToernstaendeErgebnis } from "../lib/toernstaendeParse";
import { baueWachImport, markerKandidaten } from "../lib/wachbeginnImport";
import { useData } from "../state/DataContext";
import "./Wachbeginn.css";

type UploadZustand<T> =
  | { status: "leer" }
  | { status: "laedt"; dateiname: string }
  | { status: "fertig"; dateiname: string; daten: T }
  | { status: "fehler"; dateiname: string; meldung: string };

/** Karteireiter der Upload-Kachel — mit Status-Punkt je Reiter (grün =
 *  analysiert, rot = Fehler), damit der Fortschritt ohne Umschalten
 *  sichtbar bleibt. */
function TabKnopf({
  id,
  label,
  hinweis,
  status,
  aktiv,
  onWahl,
}: {
  id: string;
  label: string;
  hinweis: string;
  /** Farbe des Status-Punkts: leer/laedt/fertig/fehler/warnung */
  status: string;
  aktiv: boolean;
  onWahl: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={aktiv}
      className={"wachbeginn__tab" + (aktiv ? " wachbeginn__tab--aktiv" : "")}
      onClick={onWahl}
      data-testid={`tab-${id}`}
    >
      <span className={`wachbeginn__tab-status wachbeginn__tab-status--${status}`} aria-hidden="true" />
      {label}
      {hinweis !== "" && <span className="wachbeginn__tab-hinweis">{hinweis}</span>}
    </button>
  );
}

/** Datei-Auswahl + Statusanzeige — gemeinsames Gerüst beider Werkzeuge. */
function UploadKopf<T>({
  zustand,
  onDatei,
  inputTestId,
}: {
  zustand: UploadZustand<T>;
  onDatei: (datei: File) => void;
  inputTestId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const datei = e.target.files?.[0];
    if (datei) onDatei(datei);
    // Erlaubt, dieselbe Datei erneut zu wählen (z.B. nach Neu-Export).
    e.target.value = "";
  }

  return (
    <div className="wachbeginn__upload">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleChange}
        data-testid={inputTestId}
        className="wachbeginn__datei-input"
      />
      <button type="button" className="btn btn--accent" onClick={() => inputRef.current?.click()}>
        PDF auswählen
      </button>
      {zustand.status === "laedt" && <span className="wachbeginn__status">Analysiere {zustand.dateiname} …</span>}
      {zustand.status === "fertig" && <span className="wachbeginn__status wachbeginn__status--ok">{zustand.dateiname}</span>}
      {zustand.status === "fehler" && (
        <span className="wachbeginn__status wachbeginn__status--fehler">
          {zustand.dateiname}: {zustand.meldung}
        </span>
      )}
    </div>
  );
}

function VorschauTabelle({ spalten, zeilen }: { spalten: string[]; zeilen: string[][] }) {
  return (
    <div className="wachbeginn__tabelle-wrap">
      <table className="wachbeginn__tabelle">
        <thead>
          <tr>
            {spalten.map((s, i) => (
              <th key={i}>{s}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {zeilen.map((zeile, i) => (
            <tr key={i}>
              {zeile.map((zelle, j) => (
                <td key={j}>{zelle === "" ? "–" : zelle}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Warnung({ children }: { children: ReactNode }) {
  return <div className="wachbeginn__warnung">{children}</div>;
}

async function liesDatei(datei: File): Promise<PdfSeite[]> {
  const puffer = await datei.arrayBuffer();
  const { extrahierePdfZeilen } = await import("../lib/pdfExtrakt");
  return extrahierePdfZeilen(puffer);
}

export function Wachbeginn() {
  const { resetAlles, importiereWache } = useData();
  const [phase, setPhase] = useState<"start" | "upload" | "fertig">("start");
  const [frageOffen, setFrageOffen] = useState(false);
  const [tab, setTab] = useState<"tafel" | "seestation" | "toernstaende" | "auswertung">("tafel");
  const [tafel, setTafel] = useState<UploadZustand<TafelBrbErgebnis>>({ status: "leer" });
  const [seestation, setSeestation] = useState<UploadZustand<SeestationPdfErgebnis>>({ status: "leer" });
  const [toernstaende, setToernstaende] = useState<UploadZustand<ToernstaendeErgebnis>>({ status: "leer" });

  function handleDatei<T>(
    setzen: (z: UploadZustand<T>) => void,
    parse: (seiten: PdfSeite[]) => Promise<T>,
  ) {
    return async (datei: File) => {
      setzen({ status: "laedt", dateiname: datei.name });
      try {
        setzen({ status: "fertig", dateiname: datei.name, daten: await parse(await liesDatei(datei)) });
      } catch (fehler) {
        setzen({
          status: "fehler",
          dateiname: datei.name,
          meldung: fehler instanceof Error ? fehler.message : "PDF konnte nicht gelesen werden",
        });
      }
    };
  }

  const handleTafelDatei = handleDatei(setTafel, async (seiten) =>
    (await import("../lib/tafelBrbParse")).parseTafelBrb(seiten),
  );
  // Manuell gewählter Marker-Lotse (Fallback, wenn der Namensabgleich
  // zwischen Tafel und Tendertafel nicht greift) — ein neues Seestation-PDF
  // setzt die Wahl zurück.
  const [markerManuell, setMarkerManuell] = useState<number | null>(null);
  const handleSeestationDatei = handleDatei(setSeestation, async (seiten) => {
    setMarkerManuell(null);
    return (await import("../lib/seestationPdfParse")).parseSeestationPdf(seiten);
  });
  const handleToernstaendeDatei = handleDatei(setToernstaende, async (seiten) =>
    (await import("../lib/toernstaendeParse")).parseToernstaende(seiten),
  );

  // Auswertung, sobald die beiden Pflicht-PDFs analysiert sind — liefert
  // die Import-Daten samt Plausibilitäts-Meldungen für die Anzeige.
  const auswertung = useMemo(() => {
    if (tafel.status !== "fertig" || seestation.status !== "fertig") return null;
    return baueWachImport(
      tafel.daten,
      seestation.daten,
      toernstaende.status === "fertig" ? toernstaende.daten : null,
      new Date(),
      markerManuell ?? undefined,
    );
  }, [tafel, seestation, toernstaende, markerManuell]);

  const kandidaten = useMemo(
    () => (seestation.status === "fertig" ? markerKandidaten(seestation.daten) : []),
    [seestation],
  );

  function handleUebernehmen() {
    if (!auswertung) return;
    importiereWache(auswertung);
    setPhase("fertig");
  }

  return (
    <div>
      <PageHeader
        title="Wachbeginn"
        centered
        description={`Neue Wache aus den PDF-Exporten von elbe-pilot.de aufsetzen — die Analyse läuft vollständig auf diesem Gerät. (App-Stand: ${__BUILD_STAND__})`}
      />

      {phase === "start" && (
        <Panel title="Neue Wache">
          <p className="wachbeginn__intro">
            Startet den Wachbeginn-Ablauf: Alle bestehenden Daten werden gelöscht, danach werden die
            PDF-Exporte (Tafel Brb und Seestation, optional Törnstände) hochgeladen, geprüft und als
            Grundgerüst der neuen Wache übernommen.
          </p>
          <button type="button" className="btn btn--accent" onClick={() => setFrageOffen(true)} data-testid="neue-wache">
            Neue Wache erstellen
          </button>
        </Panel>
      )}

      {frageOffen && (
        <Modal title="Neue Wache erstellen" onClose={() => setFrageOffen(false)} titelZentriert>
          <FrageModal
            zentriert
            warnung="Alle bestehenden Daten werden gelöscht und die Wache neu initialisiert."
            frage="Fortfahren?"
            onJa={() => {
              resetAlles();
              setFrageOffen(false);
              setPhase("upload");
            }}
            onNein={() => setFrageOffen(false)}
          />
        </Modal>
      )}

      {phase === "upload" && (
        <>
          <Panel>
            <div className="wachbeginn__tabs" role="tablist">
              <TabKnopf id="tafel" label="Tafel Brb" hinweis="Pflicht" status={tafel.status} aktiv={tab === "tafel"} onWahl={() => setTab("tafel")} />
              <TabKnopf id="seestation" label="Seestation" hinweis="Pflicht" status={seestation.status} aktiv={tab === "seestation"} onWahl={() => setTab("seestation")} />
              <TabKnopf id="toernstaende" label="Törnstände" hinweis="optional" status={toernstaende.status} aktiv={tab === "toernstaende"} onWahl={() => setTab("toernstaende")} />
              <TabKnopf
                id="auswertung"
                label="Auswertung"
                hinweis=""
                status={
                  !auswertung ? "leer" : auswertung.meldungen.some((m) => m.stufe === "warnung") ? "warnung" : "fertig"
                }
                aktiv={tab === "auswertung"}
                onWahl={() => setTab("auswertung")}
              />
            </div>

            <div className={tab === "tafel" ? undefined : "wachbeginn__tab-inhalt--versteckt"}>
              <p className="wachbeginn__intro">PDF-Export der BZ2 Tafel (elbe-pilot.de)</p>
              <UploadKopf zustand={tafel} onDatei={handleTafelDatei} inputTestId="tafel-datei" />
              {tafel.status === "fertig" && <TafelVorschau ergebnis={tafel.daten} />}
            </div>

            <div className={tab === "seestation" ? undefined : "wachbeginn__tab-inhalt--versteckt"}>
              <p className="wachbeginn__intro">PDF-Export der BZ2 Tendertafel (elbe-pilot.de)</p>
              <UploadKopf zustand={seestation} onDatei={handleSeestationDatei} inputTestId="seestation-datei" />
              {seestation.status === "fertig" && <SeestationVorschau ergebnis={seestation.daten} />}
            </div>

            <div className={tab === "toernstaende" ? undefined : "wachbeginn__tab-inhalt--versteckt"}>
              <p className="wachbeginn__intro">
                PDF-Export der BZ2 Törnliste — optional, Törnstände lassen sich auch manuell nachtragen.
              </p>
              <UploadKopf zustand={toernstaende} onDatei={handleToernstaendeDatei} inputTestId="toernstaende-datei" />
              {toernstaende.status === "fertig" && <ToernstaendeVorschau ergebnis={toernstaende.daten} />}
            </div>

            <div className={tab === "auswertung" ? undefined : "wachbeginn__tab-inhalt--versteckt"}>
            {!auswertung ? (
              <p className="wachbeginn__intro">
                Bitte Tafel Brb und Seestation hochladen — danach erscheinen hier die Auswertung und die
                Übernahme.
              </p>
            ) : (
              <div className="wachbeginn__vorschau" data-testid="auswertung">
                {kandidaten.length > 0 && (
                  <label className="wachbeginn__marker">
                    Marker-Lotse (nächster Lotse der Einsatzstation in der Tendertafel)
                    <select
                      value={auswertung.markerIndex ?? ""}
                      onChange={(e) => setMarkerManuell(e.target.value === "" ? null : Number(e.target.value))}
                      data-testid="marker-auswahl"
                    >
                      <option value="">– bitte wählen –</option>
                      {kandidaten.map((k) => (
                        <option key={k.index} value={k.index}>
                          {k.vNr} – {k.lotse}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <ul className="wachbeginn__meldungen">
                  {auswertung.meldungen.map((m, i) => (
                    <li key={i} className={`wachbeginn__meldung wachbeginn__meldung--${m.stufe}`}>
                      {m.text}
                    </li>
                  ))}
                </ul>
                <div>
                  <button type="button" className="btn btn--accent" onClick={handleUebernehmen} data-testid="uebernehmen">
                    Wache übernehmen
                  </button>
                </div>
              </div>
            )}
            </div>
          </Panel>
        </>
      )}

      {phase === "fertig" && (
        <Panel title="Wache übernommen">
          <p className="wachbeginn__intro" data-testid="fertig-text">
            Die neue Wache ist eingerichtet. Bitte die Daten auf den Seiten Tafel Brb, Einsatzplanung,
            Einsatzstation und Seestation prüfen und Schiffsnamen sowie fehlende Angaben nachtragen.
          </p>
        </Panel>
      )}
    </div>
  );
}

function TafelVorschau({ ergebnis }: { ergebnis: TafelBrbErgebnis }) {
  const meta = ergebnis.meta;
  const metaTeile: string[] = [];
  if (meta.station) metaTeile.push(`Wache ${meta.station}`);
  if (meta.datum) metaTeile.push(meta.datum);
  if (meta.zeit) metaTeile.push(meta.zeit);
  if (meta.fahrt) metaTeile.push(`Fahrt: ${meta.fahrt.typ} ${meta.fahrt.von} → ${meta.fahrt.nach}`);

  return (
    <div className="wachbeginn__vorschau" data-testid="tafel-vorschau">
      {metaTeile.length > 0 && <div className="wachbeginn__meta">{metaTeile.join("  ·  ")}</div>}

      {ergebnis.sektionen.length === 0 && (
        <Warnung>
          Keine bekannten Abschnitte erkannt — ist das wirklich ein Tafel-Brb-Export? Falls ja, hat sich
          vermutlich das Seiten-Template geändert.
        </Warnung>
      )}

      {ergebnis.sektionen.map((sektion) => (
        <details key={sektion.id} className="wachbeginn__sektion" open data-testid={`sektion-${sektion.id}`}>
          <summary>
            {sektion.titel}
            <span className="wachbeginn__anzahl">{sektion.zeilen.length} Zeilen</span>
          </summary>
          <VorschauTabelle spalten={sektion.spalten} zeilen={sektion.zeilen} />
        </details>
      ))}

      {ergebnis.unparsed.length > 0 && (
        <Warnung>
          {ergebnis.unparsed.length} Zeile(n) konnten keinem Abschnitt zugeordnet werden:
          <ul>
            {ergebnis.unparsed.map((zeile, i) => (
              <li key={i}>{zeile.join(" | ")}</li>
            ))}
          </ul>
        </Warnung>
      )}
    </div>
  );
}

function SeestationVorschau({ ergebnis }: { ergebnis: SeestationPdfErgebnis }) {
  return (
    <div className="wachbeginn__vorschau" data-testid="seestation-vorschau">
      {ergebnis.eintraege.length === 0 && (
        <Warnung>
          Keine Schiffseinträge erkannt — ist das wirklich ein Tendertafel-Export? Falls ja, hat sich
          vermutlich das Seiten-Template geändert.
        </Warnung>
      )}

      {ergebnis.kopfdaten.length > 0 && (
        <details className="wachbeginn__sektion">
          <summary>
            Kopfdaten
            <span className="wachbeginn__anzahl">{ergebnis.kopfdaten.length} Zeilen</span>
          </summary>
          <div className="wachbeginn__tabelle-wrap">
            <table className="wachbeginn__tabelle">
              <tbody>
                {ergebnis.kopfdaten.map((zeile, i) => (
                  <tr key={i}>
                    {zeile.map((zelle, j) => (
                      <td key={j}>{zelle}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <details className="wachbeginn__sektion" open data-testid="sektion-tender">
        <summary>
          Schiffe
          <span className="wachbeginn__anzahl">{ergebnis.eintraege.length} Zeilen</span>
        </summary>
        <VorschauTabelle
          spalten={["Datum", "Zeit", "Schiff", "Kat.", "Best.", "T", "V-Nr.", "Lotse"]}
          zeilen={ergebnis.eintraege.map((e) => [
            e.datum,
            e.zeit,
            e.schiff,
            e.kat,
            e.best,
            e.tender ? "T" : "",
            e.vNr,
            e.lotse,
          ])}
        />
      </details>
    </div>
  );
}

function ToernstaendeVorschau({ ergebnis }: { ergebnis: ToernstaendeErgebnis }) {
  return (
    <div className="wachbeginn__vorschau" data-testid="toernstaende-vorschau">
      {ergebnis.eintraege.length === 0 && (
        <Warnung>
          Keine Törn-Zeilen erkannt — ist das wirklich ein Törnlisten-Export? Falls ja, hat sich
          vermutlich das Seiten-Template geändert.
        </Warnung>
      )}

      {ergebnis.stand && <div className="wachbeginn__meta">Stand: {ergebnis.stand}</div>}

      {ergebnis.eintraege.length > 0 && (
        <details className="wachbeginn__sektion" open data-testid="sektion-toerns">
          <summary>
            Törnstände
            <span className="wachbeginn__anzahl">{ergebnis.eintraege.length} Zeilen</span>
          </summary>
          <VorschauTabelle spalten={ergebnis.spalten} zeilen={ergebnis.eintraege} />
        </details>
      )}

      {ergebnis.unparsed.length > 0 && (
        <Warnung>
          {ergebnis.unparsed.length} Zeile(n) konnten nicht zugeordnet werden:
          <ul>
            {ergebnis.unparsed.map((zeile, i) => (
              <li key={i}>{zeile.join(" | ")}</li>
            ))}
          </ul>
        </Warnung>
      )}
    </div>
  );
}
