/** EH-Liste: dauerhaft gemerkte Elbehafen-Zugehörigkeiten (Untermenü von
 *  Einsatzstation). Die Liste lebt in einem eigenen Speicherschlüssel, den
 *  weder "Neue Wache" noch der Settings-Reset anfasst — sie überlebt also
 *  jeden Import und belegt dort das EH-Häkchen der Einsatzstations-Lotsen
 *  per Namensabgleich vor (nur Vorbelegung, danach frei änderbar).
 *
 *  Arbeitsablauf: EH wie gehabt in der Einsatzstation pflegen →
 *  "Check Update" listet alle EH-markierten Lotsen, die noch fehlen →
 *  Häkchen setzen → "Übertragen" ergänzt die EH-Liste und stempelt
 *  "letzter Stand". Einträge sind löschbar; bei doppelten Namen (können
 *  z.B. durch Bearbeiten entstehen) warnt die Seite und gibt NUR dann
 *  das Bearbeiten des Namens frei.
 *
 *  Export/Import: die App hat keine eigene zentrale Datenhaltung (rein
 *  lokal je Gerät) — Export/Import ist deshalb der Weg, die EH-Liste
 *  zwischen Geräten abzugleichen, ohne sie auf jedem Gerät neu aus der
 *  Einsatzstation aufzubauen. Export zeigt die Liste als Text zum
 *  Kopieren, Import ersetzt die komplette lokale Liste durch den
 *  eingefügten Text (mit Vorschau vor dem Übernehmen). */
import { useState } from "react";
import { FrageModal } from "../components/FrageModal";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import type { EhListe as EhListeDaten } from "../data/types";
import { passtNameGenau } from "../lib/wachbeginnImport";
import { useData } from "../state/DataContext";
import "./Versetzliste.css";
import "./EhListe.css";

interface UpdateZeile {
  name: string;
  kategorie: string;
  gewaehlt: boolean;
}

function formatStand(stand: Date | undefined): string {
  if (!stand) return "–";
  const t = (n: number) => String(n).padStart(2, "0");
  return `${t(stand.getDate())}.${t(stand.getMonth() + 1)}.${stand.getFullYear()}`;
}

/** Wandelt die EH-Liste in einen kopierbaren Text (JSON). */
function exportText(ehListe: EhListeDaten): string {
  return JSON.stringify(ehListe);
}

/** Liest den Export-Text eines anderen Geräts zurück ein. null = Text ist
 *  kein gültiger EH-Listen-Export. */
function parseImport(text: string): EhListeDaten | null {
  try {
    const roh = JSON.parse(text) as { eintraege?: unknown; stand?: unknown };
    if (!Array.isArray(roh.eintraege)) return null;
    const eintraege = roh.eintraege.map((e) => {
      if (typeof e !== "object" || e === null) throw new Error("ungültiger Eintrag");
      const { name, kategorie } = e as Record<string, unknown>;
      if (typeof name !== "string" || name.trim() === "") throw new Error("ungültiger Eintrag");
      return { name, kategorie: typeof kategorie === "string" ? kategorie : "" };
    });
    const stand = typeof roh.stand === "string" ? new Date(roh.stand) : undefined;
    return { eintraege, stand: stand && !Number.isNaN(stand.getTime()) ? stand : undefined };
  } catch {
    return null;
  }
}

export function EhListe() {
  const { lotsen, ehListe, setEhListe } = useData();
  // null = noch kein "Check Update" in dieser Sitzung ausgeführt
  const [updateListe, setUpdateListe] = useState<UpdateZeile[] | null>(null);
  const [auswahl, setAuswahl] = useState<number | null>(null);
  const [loeschFrage, setLoeschFrage] = useState(false);
  const [bearbeiteName, setBearbeiteName] = useState<string | null>(null);
  const [exportOffen, setExportOffen] = useState(false);
  const [exportKopiert, setExportKopiert] = useState(false);
  const [importOffen, setImportOffen] = useState(false);
  const [importText, setImportText] = useState("");

  const eintraege = ehListe.eintraege;
  // Streng verglichen (voller Name): "Behnke, J-M" und "Behnke, J-H" sind
  // zwei verschiedene Personen, kein Duplikat.
  const istDuplikat = (index: number) =>
    eintraege.some((e, j) => j !== index && passtNameGenau(e.name, eintraege[index].name));
  const hatDuplikate = eintraege.some((_, i) => istDuplikat(i));

  const ausgewaehlt = auswahl !== null ? (eintraege[auswahl] ?? null) : null;
  const gewaehlteUpdates = updateListe?.filter((u) => u.gewaehlt) ?? [];

  function handleCheckUpdate() {
    // Kandidaten: alle EH-markierten Einsatzstations-Lotsen (inkl. bereits
    // abgeteilter — die Zugehörigkeit ist personenbezogen), die noch nicht
    // in der EH-Liste stehen.
    const neue: UpdateZeile[] = [];
    for (const l of lotsen) {
      if (!l.elbehafen) continue;
      if (eintraege.some((e) => passtNameGenau(e.name, l.name))) continue;
      if (neue.some((n) => passtNameGenau(n.name, l.name))) continue;
      neue.push({ name: l.name, kategorie: l.kategorie, gewaehlt: false });
    }
    setUpdateListe(neue);
  }

  function handleUebertragen() {
    if (!updateListe || gewaehlteUpdates.length === 0) return;
    const erweitert = [...eintraege, ...gewaehlteUpdates.map(({ name, kategorie }) => ({ name, kategorie }))].sort(
      (a, b) => a.name.localeCompare(b.name, "de"),
    );
    setEhListe({ eintraege: erweitert, stand: new Date() });
    setUpdateListe(updateListe.filter((u) => !u.gewaehlt));
    setAuswahl(null);
  }

  function handleLoeschen() {
    if (auswahl === null) return;
    setEhListe({ ...ehListe, eintraege: eintraege.filter((_, i) => i !== auswahl) });
    setAuswahl(null);
    setLoeschFrage(false);
  }

  function handleUmbenennen() {
    if (auswahl === null || bearbeiteName === null || bearbeiteName.trim() === "") return;
    const neu = eintraege
      .map((e, i) => (i === auswahl ? { ...e, name: bearbeiteName.trim() } : e))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
    setEhListe({ ...ehListe, eintraege: neu });
    setAuswahl(null);
    setBearbeiteName(null);
  }

  function toggleUpdate(index: number) {
    setUpdateListe((prev) => prev?.map((u, i) => (i === index ? { ...u, gewaehlt: !u.gewaehlt } : u)) ?? prev);
  }

  async function handleExportKopieren() {
    try {
      await navigator.clipboard.writeText(exportText(ehListe));
      setExportKopiert(true);
    } catch {
      // Clipboard-Zugriff kann blockiert sein (z.B. kein sicherer Kontext) —
      // der Text steht trotzdem sichtbar im Feld zum manuellen Kopieren.
      setExportKopiert(false);
    }
  }

  const importVorschau = importText.trim() === "" ? null : parseImport(importText);

  function handleImportUebernehmen() {
    if (!importVorschau) return;
    setEhListe(importVorschau);
    setImportOffen(false);
    setImportText("");
    setAuswahl(null);
  }

  return (
    <div>
      <PageHeader title="EH-Liste" centered />

      <Panel className="eh-panel">
        <div className="ehliste">
          <div className="ehliste__aktionen">
            <button type="button" className="btn btn--accent" onClick={handleCheckUpdate} data-testid="eh-check-update">
              Check Update
            </button>
            <button
              type="button"
              className="btn btn--accent"
              disabled={gewaehlteUpdates.length === 0}
              onClick={handleUebertragen}
              data-testid="eh-uebertragen"
            >
              Übertragen
            </button>
            <span className="ehliste__spacer" />
            <button
              type="button"
              className="btn"
              disabled={ausgewaehlt === null || !istDuplikat(auswahl!)}
              onClick={() => setBearbeiteName(ausgewaehlt?.name ?? "")}
              data-testid="eh-bearbeiten"
              title="Namen bearbeiten — nur für doppelt vorhandene Namen freigegeben"
            >
              Bearbeiten
            </button>
            <button
              type="button"
              className="btn"
              disabled={ausgewaehlt === null}
              onClick={() => setLoeschFrage(true)}
              data-testid="eh-loeschen"
            >
              Löschen
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setExportKopiert(false);
                setExportOffen(true);
              }}
              data-testid="eh-export"
              title="EH-Liste als Text zum Kopieren auf ein anderes Gerät"
            >
              Export
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setImportText("");
                setImportOffen(true);
              }}
              data-testid="eh-import"
              title="EH-Liste von einem anderen Gerät übernehmen (ersetzt die lokale Liste)"
            >
              Import
            </button>
            <span className="ehliste__stand" data-testid="eh-stand">
              letzter Stand: {formatStand(ehListe.stand)}
            </span>
          </div>

          {hatDuplikate && (
            <div className="ehliste__warnung" data-testid="eh-duplikat-warnung">
              Doppelte Namen in der EH-Liste — bitte die markierten Einträge bearbeiten oder löschen, sonst ist der
              Import-Abgleich mehrdeutig.
            </div>
          )}

          <div className="ehliste__spalten">
            <div className="ehliste__spalte">
              <h3 className="ehliste__titel">EH-Lotsen</h3>
              <table className="versetz-table" data-testid="eh-liste-tabelle">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th className="zentriert schmal">Kat.</th>
                    <th className="zentriert schmal">EH</th>
                  </tr>
                </thead>
                <tbody>
                  {eintraege.map((e, i) => (
                    <tr
                      key={`${e.name}-${i}`}
                      onClick={() => setAuswahl((aktiv) => (aktiv === i ? null : i))}
                      className={
                        (auswahl === i ? "ist-ausgewaehlt " : "") + (istDuplikat(i) ? "ehliste__zeile--duplikat" : "")
                      }
                    >
                      <td>{e.name}</td>
                      <td className="zentriert">{e.kategorie === "" ? "–" : e.kategorie}</td>
                      <td className="zentriert">EH</td>
                    </tr>
                  ))}
                  {eintraege.length === 0 && (
                    <tr className="ehliste__leer">
                      <td colSpan={3}>noch keine Einträge — über Check Update / Übertragen füllen</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="ehliste__spalte">
              <h3 className="ehliste__titel">Update</h3>
              <table className="versetz-table" data-testid="eh-update-tabelle">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th className="zentriert schmal">Kat.</th>
                    <th className="zentriert schmal">✓</th>
                  </tr>
                </thead>
                <tbody>
                  {(updateListe ?? []).map((u, i) => (
                    <tr key={`${u.name}-${i}`} onClick={() => toggleUpdate(i)}>
                      <td>{u.name}</td>
                      <td className="zentriert">{u.kategorie === "" ? "–" : u.kategorie}</td>
                      <td className="zentriert">
                        <input type="checkbox" checked={u.gewaehlt} onChange={() => toggleUpdate(i)} onClick={(e) => e.stopPropagation()} />
                      </td>
                    </tr>
                  ))}
                  {updateListe === null && (
                    <tr className="ehliste__leer">
                      <td colSpan={3}>Check Update listet hier die EH-Lotsen der Einsatzstation, die noch fehlen</td>
                    </tr>
                  )}
                  {updateListe !== null && updateListe.length === 0 && (
                    <tr className="ehliste__leer">
                      <td colSpan={3}>keine neuen EH-Lotsen in der Einsatzstation</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Panel>

      {loeschFrage && ausgewaehlt && (
        <Modal title="Eintrag löschen" onClose={() => setLoeschFrage(false)} maxWidth="380px">
          <FrageModal
            frage={`Soll ${ausgewaehlt.name} aus der EH-Liste gelöscht werden?`}
            onJa={handleLoeschen}
            onNein={() => setLoeschFrage(false)}
          />
        </Modal>
      )}

      {bearbeiteName !== null && ausgewaehlt && (
        <Modal title="Namen bearbeiten" onClose={() => setBearbeiteName(null)} maxWidth="380px">
          <div className="ehliste__bearbeiten">
            <label>
              Name
              <input
                type="text"
                value={bearbeiteName}
                onChange={(e) => setBearbeiteName(e.target.value)}
                data-testid="eh-name-eingabe"
                autoFocus
              />
            </label>
            <div className="ehliste__bearbeiten-aktionen">
              <button type="button" className="btn btn--ghost" onClick={() => setBearbeiteName(null)}>
                Abbrechen
              </button>
              <button
                type="button"
                className="btn btn--accent"
                disabled={bearbeiteName.trim() === ""}
                onClick={handleUmbenennen}
                data-testid="eh-name-ok"
              >
                Übernehmen
              </button>
            </div>
          </div>
        </Modal>
      )}

      {exportOffen && (
        <Modal title="EH-Liste exportieren" onClose={() => setExportOffen(false)} maxWidth="480px">
          <div className="ehliste__bearbeiten">
            <p className="ehliste__export-hinweis">
              Text kopieren und auf dem anderen Gerät über "Import" wieder einfügen.
            </p>
            <textarea
              className="ehliste__export-feld"
              value={exportText(ehListe)}
              readOnly
              rows={6}
              onFocus={(e) => e.currentTarget.select()}
              data-testid="eh-export-feld"
            />
            <div className="ehliste__bearbeiten-aktionen">
              {exportKopiert && <span className="ehliste__export-kopiert">kopiert ✓</span>}
              <button type="button" className="btn btn--ghost" onClick={() => setExportOffen(false)}>
                Schließen
              </button>
              <button type="button" className="btn btn--accent" onClick={handleExportKopieren} data-testid="eh-export-kopieren">
                Kopieren
              </button>
            </div>
          </div>
        </Modal>
      )}

      {importOffen && (
        <Modal title="EH-Liste importieren" onClose={() => setImportOffen(false)} maxWidth="480px">
          <div className="ehliste__bearbeiten">
            <p className="ehliste__export-hinweis">
              Export-Text von einem anderen Gerät einfügen — ersetzt die komplette lokale EH-Liste.
            </p>
            <textarea
              className="ehliste__export-feld"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={6}
              placeholder="Hier den kopierten Export-Text einfügen …"
              autoFocus
              data-testid="eh-import-feld"
            />
            {importText.trim() !== "" && !importVorschau && (
              <p className="ehliste__export-fehler" data-testid="eh-import-fehler">
                Text ist kein gültiger EH-Listen-Export.
              </p>
            )}
            {importVorschau && (
              <p className="ehliste__export-vorschau" data-testid="eh-import-vorschau">
                {importVorschau.eintraege.length} Einträge, Stand: {formatStand(importVorschau.stand)} — ersetzt die
                aktuelle Liste ({eintraege.length} Einträge).
              </p>
            )}
            <div className="ehliste__bearbeiten-aktionen">
              <button type="button" className="btn btn--ghost" onClick={() => setImportOffen(false)}>
                Abbrechen
              </button>
              <button
                type="button"
                className="btn btn--accent"
                disabled={!importVorschau}
                onClick={handleImportUebernehmen}
                data-testid="eh-import-uebernehmen"
              >
                Übernehmen
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
