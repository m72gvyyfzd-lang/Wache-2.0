/** Wachbeginn: PDF-Import-Werkzeuge (Stufe 1 — Upload + Vorschau).
 *
 *  Der Einsatzleiter exportiert zu Wachbeginn zwei PDFs (Tafel Brb und
 *  Seestation von elbe-pilot.de) und lädt sie hier hoch. Die Analyse läuft
 *  komplett im Browser — die Datei verlässt das Gerät nicht. In dieser
 *  Stufe wird nur eine Vorschau des Erkannten angezeigt (Validierung des
 *  Parsers gegen echte Exporte); der eigentliche Import in die App-Daten
 *  folgt als Stufe 2. */
import { useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import type { PdfSeite } from "../lib/pdfExtrakt";
import type { TafelBrbErgebnis } from "../lib/tafelBrbParse";
import "./Wachbeginn.css";

type UploadZustand<T> =
  | { status: "leer" }
  | { status: "laedt"; dateiname: string }
  | { status: "fertig"; dateiname: string; daten: T }
  | { status: "fehler"; dateiname: string; meldung: string };

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
  const [tafel, setTafel] = useState<UploadZustand<TafelBrbErgebnis>>({ status: "leer" });
  const [seestation, setSeestation] = useState<UploadZustand<PdfSeite[]>>({ status: "leer" });
  const [toernstaende, setToernstaende] = useState<UploadZustand<PdfSeite[]>>({ status: "leer" });

  async function handleTafelDatei(datei: File) {
    setTafel({ status: "laedt", dateiname: datei.name });
    try {
      const seiten = await liesDatei(datei);
      const { parseTafelBrb } = await import("../lib/tafelBrbParse");
      setTafel({ status: "fertig", dateiname: datei.name, daten: parseTafelBrb(seiten) });
    } catch (fehler) {
      setTafel({
        status: "fehler",
        dateiname: datei.name,
        meldung: fehler instanceof Error ? fehler.message : "PDF konnte nicht gelesen werden",
      });
    }
  }

  function handleRohDatei(setzen: (z: UploadZustand<PdfSeite[]>) => void) {
    return async (datei: File) => {
      setzen({ status: "laedt", dateiname: datei.name });
      try {
        setzen({ status: "fertig", dateiname: datei.name, daten: await liesDatei(datei) });
      } catch (fehler) {
        setzen({
          status: "fehler",
          dateiname: datei.name,
          meldung: fehler instanceof Error ? fehler.message : "PDF konnte nicht gelesen werden",
        });
      }
    };
  }

  return (
    <div>
      <PageHeader
        title="Wachbeginn"
        centered
        description={`PDF-Exporte hochladen und prüfen — die Analyse läuft vollständig auf diesem Gerät. Der Import in die App folgt in einem späteren Schritt. (App-Stand: ${__BUILD_STAND__})`}
      />

      <Panel title="Tafel Brb" description="PDF-Export der BZ2 Tafel (elbe-pilot.de)">
        <UploadKopf zustand={tafel} onDatei={handleTafelDatei} inputTestId="tafel-datei" />
        {tafel.status === "fertig" && <TafelVorschau ergebnis={tafel.daten} />}
      </Panel>

      <Panel title="Seestation" description="PDF-Export der Seestation">
        <UploadKopf zustand={seestation} onDatei={handleRohDatei(setSeestation)} inputTestId="seestation-datei" />
        {seestation.status === "fertig" && <RohVorschau seiten={seestation.daten} testId="seestation-vorschau" />}
      </Panel>

      <Panel title="Törnstände" description="PDF-Export der Törnstände für die Listenvergaben">
        <UploadKopf zustand={toernstaende} onDatei={handleRohDatei(setToernstaende)} inputTestId="toernstaende-datei" />
        {toernstaende.status === "fertig" && <RohVorschau seiten={toernstaende.daten} testId="toernstaende-vorschau" />}
      </Panel>
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

/** Solange für ein PDF noch kein Auswertungsschema hinterlegt ist, zeigt
 *  die Vorschau die extrahierten Roh-Zeilen — damit lässt sich am echten
 *  Export klären, wie der Parser aufgebaut werden muss. */
function RohVorschau({ seiten, testId }: { seiten: PdfSeite[]; testId: string }) {
  return (
    <div className="wachbeginn__vorschau" data-testid={testId}>
      <Warnung>
        Für das Seestation-PDF ist noch kein Auswertungsschema hinterlegt — unten die Roh-Ansicht aller
        erkannten Zeilen zur Prüfung des Formats.
      </Warnung>
      {seiten.map((seite, i) => (
        <details key={i} className="wachbeginn__sektion" open>
          <summary>
            Seite {i + 1}
            <span className="wachbeginn__anzahl">{seite.zeilen.length} Zeilen</span>
          </summary>
          <div className="wachbeginn__tabelle-wrap">
            <table className="wachbeginn__tabelle">
              <tbody>
                {seite.zeilen.map((zeile, j) => (
                  <tr key={j}>
                    {zeile.zellen.map((zelle, k) => (
                      <td key={k}>{zelle.text}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </div>
  );
}
