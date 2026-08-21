/** Wachbeginn: "Neue Wache erstellen" — kompletter Ablauf aus PDF-Upload
 *  (Tafel Brb + Seestation Pflicht, Törnstände optional), Analyse mit
 *  Plausibilitäts-Meldungen und finaler Übernahme in die App-Daten. Der
 *  Reset der bestehenden Wache passiert bewusst erst bei der Übernahme —
 *  bis dahin bleibt die laufende Wache unangetastet. Die Analyse läuft
 *  komplett im Browser, die Dateien verlassen das Gerät nicht. */
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

/** Ampel eines Reiters: orange = noch keine Datei, grün = brauchbar
 *  analysiert, rot = Alarm (unlesbar oder nichts erkannt — typischerweise
 *  die falsche PDF). */
type Ampel = "offen" | "laedt" | "ok" | "alarm";

function ampelFuer<T>(zustand: UploadZustand<T>, brauchbar: (daten: T) => boolean): Ampel {
  if (zustand.status === "leer") return "offen";
  if (zustand.status === "laedt") return "laedt";
  if (zustand.status === "fehler") return "alarm";
  return brauchbar(zustand.daten) ? "ok" : "alarm";
}

function dateinameVon<T>(zustand: UploadZustand<T>): string | null {
  return zustand.status === "leer" ? null : zustand.dateiname;
}

/** Karteireiter der Wachbeginn-Kachel — mit Ampelpunkt und, sobald eine
 *  Datei gewählt ist, deren Namen anstelle des Pflicht-/Optional-Hinweises. */
function TabKnopf({
  id,
  label,
  hinweis,
  dateiname,
  ampel,
  aktiv,
  onWahl,
}: {
  id: string;
  label: string;
  hinweis: string;
  dateiname: string | null;
  ampel: Ampel;
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
      <span className="wachbeginn__tab-kopf">
        <span className={`wachbeginn__tab-status wachbeginn__tab-status--${ampel}`} aria-hidden="true" />
        {label}
      </span>
      {dateiname !== null ? (
        <span className="wachbeginn__tab-datei" title={dateiname} data-testid={`tab-${id}-datei`}>
          verwendete Datei: {dateiname}
        </span>
      ) : (
        hinweis !== "" && <span className="wachbeginn__tab-hinweis">{hinweis}</span>
      )}
    </button>
  );
}

/** Auswahl-Button für eine PDF — das native Datei-Feld bleibt versteckt. */
function PdfKnopf({
  label,
  onDatei,
  inputTestId,
}: {
  label: string;
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
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleChange}
        data-testid={inputTestId}
        className="wachbeginn__datei-input"
      />
      <button type="button" className="btn btn--accent wachbeginn__pdf-knopf" onClick={() => inputRef.current?.click()}>
        {label}
      </button>
    </>
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
  const { resetAlles, importiereWache, ehListe } = useData();
  const [phase, setPhase] = useState<"start" | "upload" | "fertig">("start");
  const [frageOffen, setFrageOffen] = useState(false);
  const [tab, setTab] = useState<"tafel" | "seestation" | "toernstaende" | "auswertung">("tafel");
  const [tafel, setTafel] = useState<UploadZustand<TafelBrbErgebnis>>({ status: "leer" });
  const [seestation, setSeestation] = useState<UploadZustand<SeestationPdfErgebnis>>({ status: "leer" });
  const [toernstaende, setToernstaende] = useState<UploadZustand<ToernstaendeErgebnis>>({ status: "leer" });
  // Manuell gewählter Marker-Lotse (Fallback, wenn der Namensabgleich
  // zwischen Tafel und Tendertafel nicht greift) — ein neues Seestation-PDF
  // setzt die Wahl zurück.
  const [markerManuell, setMarkerManuell] = useState<number | null>(null);

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
      ehListe.eintraege,
    );
  }, [tafel, seestation, toernstaende, markerManuell, ehListe]);

  const kandidaten = useMemo(
    () => (seestation.status === "fertig" ? markerKandidaten(seestation.daten) : []),
    [seestation],
  );

  const tafelAmpel = ampelFuer(tafel, (d) => d.sektionen.length > 0);
  const seestationAmpel = ampelFuer(seestation, (d) => d.eintraege.length > 0);
  const toernstaendeAmpel = ampelFuer(toernstaende, (d) => d.eintraege.length > 0);
  const auswertungAmpel: Ampel = !auswertung
    ? "offen"
    : auswertung.meldungen.some((m) => m.stufe === "warnung")
      ? "alarm"
      : "ok";
  // Übernehmen erst, wenn beide Pflicht-PDFs sauber analysiert sind.
  const uebernehmbar = auswertung !== null && tafelAmpel === "ok" && seestationAmpel === "ok";

  function handleNeueWache() {
    setTafel({ status: "leer" });
    setSeestation({ status: "leer" });
    setToernstaende({ status: "leer" });
    setMarkerManuell(null);
    setTab("tafel");
    setPhase("upload");
  }

  function handleUebernehmen() {
    if (!auswertung) return;
    resetAlles();
    importiereWache(auswertung);
    setFrageOffen(false);
    setPhase("fertig");
  }

  return (
    <div>
      <PageHeader
        title="Wachbeginn"
        centered
        description={`Neue Wache aus den PDF-Exporten von elbe-pilot.de aufsetzen — die Analyse läuft vollständig auf diesem Gerät. (App-Stand: ${__BUILD_STAND__})`}
      />

      <Panel>
        <div className="wachbeginn__kachel">
        <div className="wachbeginn__aktionen">
          <button type="button" className="btn btn--accent" onClick={handleNeueWache} data-testid="neue-wache">
            Neue Wache
          </button>
          {phase === "upload" && (
            <button
              type="button"
              className="btn btn--accent"
              disabled={!uebernehmbar}
              onClick={() => setFrageOffen(true)}
              data-testid="uebernehmen"
            >
              Wache übernehmen
            </button>
          )}
        </div>

        {phase === "start" && (
          <p className="wachbeginn__intro wachbeginn__intro--zentriert">
            Startet den Wachbeginn-Ablauf: die PDF-Exporte (Tafel Brb und Seestation, optional
            Törnstände) hochladen und prüfen. Erst beim Übernehmen werden die bestehenden Daten
            gelöscht und durch das neue Grundgerüst ersetzt.
          </p>
        )}

        {phase === "fertig" && (
          <p className="wachbeginn__intro wachbeginn__intro--zentriert" data-testid="fertig-text">
            Die neue Wache ist eingerichtet. Bitte die Daten auf den Seiten Tafel Brb, Einsatzplanung,
            Einsatzstation und Seestation prüfen und Schiffsnamen sowie fehlende Angaben nachtragen.
          </p>
        )}

        {phase === "upload" && (
          <>
            <div className="wachbeginn__leiste">
              <PdfKnopf label="Tafel-PDF auswählen" onDatei={handleTafelDatei} inputTestId="tafel-datei" />
              <PdfKnopf
                label="Tendertafel-PDF auswählen"
                onDatei={handleSeestationDatei}
                inputTestId="seestation-datei"
              />
              <PdfKnopf
                label="Törnliste-PDF auswählen"
                onDatei={handleToernstaendeDatei}
                inputTestId="toernstaende-datei"
              />
              <select
                className="wachbeginn__marker"
                aria-label="Marker-Lotse (nächster Lotse der Einsatzstation in der Tendertafel)"
                title="Marker-Lotse: nächster Lotse der Einsatzstation in der Tendertafel"
                value={auswertung?.markerIndex ?? ""}
                disabled={kandidaten.length === 0}
                onChange={(e) => setMarkerManuell(e.target.value === "" ? null : Number(e.target.value))}
                data-testid="marker-auswahl"
              >
                <option value="">– Marker-Lotse –</option>
                {kandidaten.map((k) => (
                  <option key={k.index} value={k.index}>
                    {k.vNr} – {k.lotse}
                  </option>
                ))}
              </select>
            </div>

            <div className="wachbeginn__tabs" role="tablist">
              <TabKnopf
                id="tafel"
                label="Tafel Brb"
                hinweis="Pflicht"
                dateiname={dateinameVon(tafel)}
                ampel={tafelAmpel}
                aktiv={tab === "tafel"}
                onWahl={() => setTab("tafel")}
              />
              <TabKnopf
                id="seestation"
                label="Seestation"
                hinweis="Pflicht"
                dateiname={dateinameVon(seestation)}
                ampel={seestationAmpel}
                aktiv={tab === "seestation"}
                onWahl={() => setTab("seestation")}
              />
              <TabKnopf
                id="toernstaende"
                label="Törnstände"
                hinweis="optional"
                dateiname={dateinameVon(toernstaende)}
                ampel={toernstaendeAmpel}
                aktiv={tab === "toernstaende"}
                onWahl={() => setTab("toernstaende")}
              />
              <TabKnopf
                id="auswertung"
                label="Auswertung"
                hinweis=""
                dateiname={null}
                ampel={auswertungAmpel}
                aktiv={tab === "auswertung"}
                onWahl={() => setTab("auswertung")}
              />
            </div>

            <div className={tab === "tafel" ? undefined : "wachbeginn__tab-inhalt--versteckt"}>
              <p className="wachbeginn__intro">PDF-Export der BZ2 Tafel (elbe-pilot.de)</p>
              {tafel.status === "fehler" && <Warnung>{tafel.meldung}</Warnung>}
              {tafel.status === "fertig" && <TafelVorschau ergebnis={tafel.daten} />}
            </div>

            <div className={tab === "seestation" ? undefined : "wachbeginn__tab-inhalt--versteckt"}>
              <p className="wachbeginn__intro">PDF-Export der BZ2 Tendertafel (elbe-pilot.de)</p>
              {seestation.status === "fehler" && <Warnung>{seestation.meldung}</Warnung>}
              {seestation.status === "fertig" && <SeestationVorschau ergebnis={seestation.daten} />}
            </div>

            <div className={tab === "toernstaende" ? undefined : "wachbeginn__tab-inhalt--versteckt"}>
              <p className="wachbeginn__intro">
                PDF-Export der BZ2 Törnliste — optional, Törnstände lassen sich auch manuell nachtragen.
              </p>
              {toernstaende.status === "fehler" && <Warnung>{toernstaende.meldung}</Warnung>}
              {toernstaende.status === "fertig" && <ToernstaendeVorschau ergebnis={toernstaende.daten} />}
            </div>

            <div className={tab === "auswertung" ? undefined : "wachbeginn__tab-inhalt--versteckt"}>
              {!auswertung ? (
                <p className="wachbeginn__intro">
                  Bitte Tafel Brb und Seestation hochladen — danach erscheint hier die Auswertung.
                </p>
              ) : (
                <div className="wachbeginn__vorschau" data-testid="auswertung">
                  <ul className="wachbeginn__meldungen">
                    {auswertung.meldungen.map((m, i) => (
                      <li key={i} className={`wachbeginn__meldung wachbeginn__meldung--${m.stufe}`}>
                        {m.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
        </div>
      </Panel>

      {frageOffen && (
        <Modal title="Wache übernehmen" onClose={() => setFrageOffen(false)} titelZentriert>
          <FrageModal
            zentriert
            warnung="Alle bestehenden Daten werden gelöscht und die Wache neu initialisiert."
            frage="Fortfahren?"
            onJa={handleUebernehmen}
            onNein={() => setFrageOffen(false)}
          />
        </Modal>
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
        <Warnung>Keine bekannten Abschnitte erkannt — ist das wirklich ein Tafel-Brb-Export?</Warnung>
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
        <Warnung>Keine Schiffseinträge erkannt — ist das wirklich ein Tendertafel-Export?</Warnung>
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
          spalten={["Datum", "Zeit", "Schiff", "Kat.", "Best.", "T", "E3/St", "V-Nr.", "Lotse"]}
          zeilen={ergebnis.eintraege.map((e) => [
            e.datum,
            e.zeit,
            e.schiff,
            e.kat,
            e.best,
            e.tender ? "T" : "",
            e.e3st ? "E3" : "",
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
        <Warnung>Keine Törn-Zeilen erkannt — ist das wirklich ein Törnlisten-Export?</Warnung>
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
