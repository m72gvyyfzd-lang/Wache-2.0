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
import type { SeestationPdfErgebnis } from "../lib/seestationPdfParse";
import type { TafelBrbErgebnis } from "../lib/tafelBrbParse";
import type { ToernstaendeErgebnis } from "../lib/toernstaendeParse";
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
  const handleSeestationDatei = handleDatei(setSeestation, async (seiten) =>
    (await import("../lib/seestationPdfParse")).parseSeestationPdf(seiten),
  );
  const handleToernstaendeDatei = handleDatei(setToernstaende, async (seiten) =>
    (await import("../lib/toernstaendeParse")).parseToernstaende(seiten),
  );

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

      <Panel title="Seestation" description="PDF-Export der BZ2 Tendertafel (elbe-pilot.de)">
        <UploadKopf zustand={seestation} onDatei={handleSeestationDatei} inputTestId="seestation-datei" />
        {seestation.status === "fertig" && <SeestationVorschau ergebnis={seestation.daten} />}
      </Panel>

      <Panel title="Törnstände" description="PDF-Export der BZ2 Törnliste für die Listenvergaben (elbe-pilot.de)">
        <UploadKopf zustand={toernstaende} onDatei={handleToernstaendeDatei} inputTestId="toernstaende-datei" />
        {toernstaende.status === "fertig" && <ToernstaendeVorschau ergebnis={toernstaende.daten} />}
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
