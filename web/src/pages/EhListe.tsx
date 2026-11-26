/** EH-Liste: dauerhaft gemerkte Elbehafen-Zugehörigkeiten (Untermenü von
 *  Einsatzstation). Die Liste lebt in einem eigenen Speicherschlüssel, den
 *  weder "Neue Wache" noch der Settings-Reset anfasst — sie überlebt also
 *  jeden Import und belegt dort das EH-Häkchen der Einsatzstations-Lotsen
 *  per Namensabgleich vor (nur Vorbelegung, danach frei änderbar).
 *
 *  Arbeitsablauf: EH wie gehabt in der Einsatzstation pflegen →
 *  "Check Update" listet alle EH-markierten Lotsen, die noch fehlen (grün,
 *  angehakt). Einträge sind löschbar; bei doppelten Namen (können z.B.
 *  durch Bearbeiten entstehen) warnt die Seite und gibt NUR dann das
 *  Bearbeiten des Namens frei.
 *
 *  Export/Import: die App hat keine eigene zentrale Datenhaltung (rein
 *  lokal je Gerät) — Export/Import ist deshalb der Weg, die EH-Liste
 *  zwischen Geräten abzugleichen. "Export" lädt die Liste als Text-Datei
 *  herunter (mit Speicherort-Wahl, siehe handleExportDatei); "Import" liest
 *  eine solche Datei wieder ein und ERSETZT die Update-Tabelle durch den
 *  vollständigen Abgleich: neu (nur in der Datei) grün und angehakt,
 *  vorhanden (in beiden) grau und gesperrt. Lotsen, die nur noch lokal
 *  stehen, erscheinen rot in der EH-Lotsen-Tabelle (Austritt). Solange diese
 *  Update-Tabelle vom Import stammt und noch nicht übertragen ist, ist
 *  "Check Update" gesperrt (würde sie sonst überschreiben).
 *
 *  "Übertragen" prüft vorab per Namensabgleich, welche Einsatzstations-
 *  Lotsen betroffen wären, und zeigt das Ergebnis (Aufnahme/Austritt/
 *  Konflikte bei doppelten Namen) im Bestätigen-Fenster — je Austritt-Zeile
 *  mit Schalter "Austritt ignorieren" (z.B. für manuell schon aufgenommene
 *  Lotsen, die der Export nicht kennt). Erst bei Bestätigung wird die
 *  EH-Liste geändert, das EH-Häkchen in der Einsatzstation mitgezogen und
 *  die Update-Tabelle komplett geleert — Konflikte bleiben unangetastet. */
import { useRef, useState } from "react";
import { FrageModal } from "../components/FrageModal";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { Switch } from "../components/SeestationModals";
import type { EhListe as EhListeDaten } from "../data/types";
import { passtNameGenau } from "../lib/wachbeginnImport";
import { useData } from "../state/DataContext";
import "./Versetzliste.css";
import "./EhListe.css";

interface UpdateZeile {
  name: string;
  kategorie: string;
  gewaehlt: boolean;
  // "neu" = noch nicht in der EH-Liste (ankreuzbar); "vorhanden" = steht
  // bereits in der EH-Liste (gesperrt, nur zur Übersicht beim Import-Abgleich).
  typ: "neu" | "vorhanden";
}

interface Vorschau {
  aufnahme: { name: string; kategorie: string }[];
  austritt: { name: string; kategorie: string }[];
  konflikte: string[];
}

function formatStand(stand: Date | undefined): string {
  if (!stand) return "–";
  const t = (n: number) => String(n).padStart(2, "0");
  return `${t(stand.getDate())}.${t(stand.getMonth() + 1)}.${stand.getFullYear()}`;
}

/** Wandelt die EH-Liste in den Datei-Inhalt (JSON) um. */
function exportText(ehListe: EhListeDaten): string {
  return JSON.stringify(ehListe);
}

/** Liest den Datei-Inhalt eines Exports von einem anderen Gerät ein. null =
 *  Inhalt ist kein gültiger EH-Listen-Export. */
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
  const { lotsen, setLotsenListe, ehListe, setEhListe } = useData();
  // null = noch kein "Check Update" in dieser Sitzung ausgeführt
  const [updateListe, setUpdateListe] = useState<UpdateZeile[] | null>(null);
  // Einträge, die in der EH-Liste stehen, aber im zuletzt importierten
  // Stand eines anderen Geräts fehlen — in der EH-Lotsen-Tabelle rot markiert.
  const [austritt, setAustritt] = useState<{ name: string; kategorie: string }[]>([]);
  const [auswahl, setAuswahl] = useState<number | null>(null);
  const [loeschFrage, setLoeschFrage] = useState(false);
  const [bearbeiteName, setBearbeiteName] = useState<string | null>(null);
  const [importFehler, setImportFehler] = useState<string | null>(null);
  // true, solange die Update-Tabelle vom letzten Import stammt und noch
  // nicht übertragen wurde — "Check Update" würde sie sonst überschreiben.
  const [importAktiv, setImportAktiv] = useState(false);
  const [vorschau, setVorschau] = useState<Vorschau | null>(null);
  // Im Bestätigen-Fenster per Schalter als "Austritt ignorieren" markierte
  // Namen — bleiben bei "Bestätigen" unangetastet in der EH-Liste.
  const [austrittIgnoriert, setAustrittIgnoriert] = useState<Set<string>>(new Set());
  const importDateiRef = useRef<HTMLInputElement>(null);

  const eintraege = ehListe.eintraege;
  // Streng verglichen (voller Name): "Behnke, J-M" und "Behnke, J-H" sind
  // zwei verschiedene Personen, kein Duplikat.
  const istDuplikat = (index: number) =>
    eintraege.some((e, j) => j !== index && passtNameGenau(e.name, eintraege[index].name));
  const hatDuplikate = eintraege.some((_, i) => istDuplikat(i));
  const istAustritt = (name: string) => austritt.some((a) => passtNameGenau(a.name, name));

  const ausgewaehlt = auswahl !== null ? (eintraege[auswahl] ?? null) : null;
  const gewaehlteUpdates = updateListe?.filter((u) => u.gewaehlt) ?? [];
  // Wie oft ein Name in der Einsatzstation vorkommt — 2+ Treffer sind ein
  // Konflikt (doppelte Namen dort), dann bleibt der Lotse für diese Runde
  // unangetastet (weder EH-Liste noch Einsatzstation).
  const zaehleTreffer = (name: string) => lotsen.filter((l) => passtNameGenau(l.name, name)).length;

  function handleCheckUpdate() {
    if (importAktiv) return; // Update-Tabelle stammt vom Import, nicht überschreiben
    // Kandidaten: alle EH-markierten Einsatzstations-Lotsen (inkl. bereits
    // abgeteilter — die Zugehörigkeit ist personenbezogen), die noch nicht
    // in der EH-Liste stehen.
    const neue: UpdateZeile[] = [];
    for (const l of lotsen) {
      if (!l.elbehafen) continue;
      if (eintraege.some((e) => passtNameGenau(e.name, l.name))) continue;
      if (neue.some((n) => passtNameGenau(n.name, l.name))) continue;
      neue.push({ name: l.name, kategorie: l.kategorie, gewaehlt: false, typ: "neu" });
    }
    setUpdateListe(neue);
  }

  /** Prüft vorab, was "Übertragen" bewirken würde (inkl. Einsatzstations-
   *  Konflikte durch doppelte Namen), und öffnet dafür das Bestätigen-Fenster. */
  function handleUebertragenKlick() {
    if (gewaehlteUpdates.length === 0 && austritt.length === 0) return;
    const aufnahme: { name: string; kategorie: string }[] = [];
    const austrittOk: { name: string; kategorie: string }[] = [];
    const konflikte: string[] = [];

    for (const u of gewaehlteUpdates) {
      if (zaehleTreffer(u.name) >= 2) konflikte.push(u.name);
      else aufnahme.push({ name: u.name, kategorie: u.kategorie });
    }
    for (const a of austritt) {
      if (zaehleTreffer(a.name) >= 2) konflikte.push(a.name);
      else austrittOk.push(a);
    }

    setAustrittIgnoriert(new Set());
    setVorschau({ aufnahme, austritt: austrittOk, konflikte });
  }

  /** Wendet die im Vorschau-Fenster angezeigten Änderungen an: EH-Liste
   *  ergänzen/bereinigen und das EH-Häkchen in der Einsatzstation mitziehen
   *  (nur bei eindeutigem Namenstreffer — Konflikte bleiben offen, per
   *  Schalter "Austritt ignorieren" markierte Namen bleiben unangetastet). */
  function handleBestaetigen() {
    if (!vorschau) return;
    const { aufnahme, austritt: austrittKandidaten, konflikte } = vorschau;
    const austrittOk = austrittKandidaten.filter((a) => !austrittIgnoriert.has(a.name));

    const bereinigt = eintraege.filter((e) => !austrittOk.some((a) => passtNameGenau(a.name, e.name)));
    const erweitert = [...bereinigt, ...aufnahme].sort((a, b) => a.name.localeCompare(b.name, "de"));
    setEhListe({ eintraege: erweitert, stand: new Date() });

    setLotsenListe(
      lotsen.map((l) => {
        if (aufnahme.some((a) => passtNameGenau(a.name, l.name))) return { ...l, elbehafen: true };
        if (austrittOk.some((a) => passtNameGenau(a.name, l.name))) return { ...l, elbehafen: false };
        return l;
      }),
    );

    // Nur noch ungeklärte Konflikte bleiben als Austritt-Kandidat offen (rot
    // markiert) — übertragene und ignorierte Namen verschwinden aus der
    // Markierung, die Update-Tabelle wird komplett geleert.
    setAustritt((prev) => prev.filter((a) => konflikte.some((k) => passtNameGenau(k, a.name))));
    setUpdateListe(null);
    setImportAktiv(false);

    setVorschau(null);
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
    setUpdateListe(
      (prev) => prev?.map((u, i) => (i === index && u.typ !== "vorhanden" ? { ...u, gewaehlt: !u.gewaehlt } : u)) ?? prev,
    );
  }

  /** Lädt die EH-Liste als Text-Datei herunter — möglichst mit Wahl des
   *  Speicherorts statt eines stillen Downloads in den Standardordner:
   *  Desktop (Chrome/Edge) bekommt einen echten "Speichern unter"-Dialog;
   *  iPad/iPhone (kein showSaveFilePicker) stattdessen das native
   *  Teilen-Menü, worüber sich z.B. "In Dateien sichern" wählen lässt.
   *  Nur wenn beides fehlt (alte Browser): stiller Direkt-Download wie bisher. */
  async function handleExportDatei() {
    const inhalt = exportText(ehListe);
    const heute = new Date();
    const datum = `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, "0")}-${String(heute.getDate()).padStart(2, "0")}`;
    const dateiname = `eh-liste-${datum}.txt`;

    type SpeicherHandle = { createWritable: () => Promise<{ write: (daten: string) => Promise<void>; close: () => Promise<void> }> };
    const saveFilePicker = (window as unknown as { showSaveFilePicker?: (opts: unknown) => Promise<SpeicherHandle> })
      .showSaveFilePicker;
    if (saveFilePicker) {
      try {
        const handle = await saveFilePicker({
          suggestedName: dateiname,
          types: [{ description: "Text-Datei", accept: { "text/plain": [".txt"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(inhalt);
        await writable.close();
        return;
      } catch (fehler) {
        if (fehler instanceof DOMException && fehler.name === "AbortError") return; // Nutzer hat abgebrochen
        // sonst: unten weiter mit dem nächsten Weg versuchen
      }
    }

    const datei = new File([inhalt], dateiname, { type: "text/plain" });
    if (navigator.canShare?.({ files: [datei] })) {
      try {
        await navigator.share({ files: [datei] });
        return;
      } catch (fehler) {
        if (fehler instanceof DOMException && fehler.name === "AbortError") return;
      }
    }

    const blob = new Blob([inhalt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = dateiname;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleImportKlick() {
    importDateiRef.current?.click();
  }

  /** Datei einlesen und die Update-Tabelle durch den vollständigen Abgleich
   *  mit der eigenen EH-Liste ERSETZEN (nicht nur ergänzen): neue Einträge
   *  (nur in der Datei) angehakt und grün, bereits vorhandene (in beiden)
   *  gesperrt und grau. Einträge, die nur noch lokal stehen (in der Datei
   *  fehlen), erscheinen nicht hier, sondern rot in der EH-Lotsen-Tabelle. */
  async function handleImportDatei(event: React.ChangeEvent<HTMLInputElement>) {
    const datei = event.target.files?.[0];
    event.target.value = ""; // dieselbe Datei danach erneut wählbar machen
    if (!datei) return;
    setImportFehler(null);
    let geparst: EhListeDaten | null = null;
    try {
      geparst = parseImport(await datei.text());
    } catch {
      geparst = null;
    }
    if (!geparst) {
      setImportFehler(`"${datei.name}" ist kein gültiger EH-Listen-Export.`);
      return;
    }

    const importiert = geparst.eintraege;
    const neu: UpdateZeile[] = [];
    for (const kandidat of importiert) {
      if (eintraege.some((e) => passtNameGenau(e.name, kandidat.name))) continue;
      if (neu.some((n) => passtNameGenau(n.name, kandidat.name))) continue;
      neu.push({ name: kandidat.name, kategorie: kandidat.kategorie, gewaehlt: true, typ: "neu" });
    }
    const vorhanden: UpdateZeile[] = eintraege
      .filter((e) => importiert.some((k) => passtNameGenau(k.name, e.name)))
      .map((e) => ({ name: e.name, kategorie: e.kategorie, gewaehlt: false, typ: "vorhanden" }));
    const ausgetreten = eintraege
      .filter((e) => !importiert.some((k) => passtNameGenau(k.name, e.name)))
      .map(({ name, kategorie }) => ({ name, kategorie }));

    setUpdateListe([...vorhanden, ...neu]);
    setAustritt(ausgetreten);
    setImportAktiv(true);
  }

  return (
    <div>
      <PageHeader title="EH-Liste" centered />

      <Panel className="eh-panel">
        <div className="ehliste">
          <div className="ehliste__aktionen">
            <button
              type="button"
              className="btn btn--accent"
              disabled={importAktiv}
              onClick={handleCheckUpdate}
              data-testid="eh-check-update"
              title={importAktiv ? "Gesperrt, solange die Update-Tabelle vom Import stammt — erst übertragen" : undefined}
            >
              Check Update
            </button>
            <button
              type="button"
              className="btn btn--accent"
              disabled={gewaehlteUpdates.length === 0 && austritt.length === 0}
              onClick={handleUebertragenKlick}
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
              onClick={handleExportDatei}
              data-testid="eh-export"
              title="EH-Liste als Text-Datei herunterladen, zum Übertragen auf ein anderes Gerät"
            >
              Export
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleImportKlick}
              data-testid="eh-import"
              title="EH-Listen-Datei von einem anderen Gerät einlesen — neue Einträge landen in der Update-Tabelle"
            >
              Import
            </button>
            <input
              ref={importDateiRef}
              type="file"
              accept=".txt,.json,text/plain,application/json"
              style={{ display: "none" }}
              onChange={handleImportDatei}
              data-testid="eh-import-datei"
            />
            <span className="ehliste__stand" data-testid="eh-stand">
              letzter Stand: {formatStand(ehListe.stand)}
            </span>
          </div>

          {importFehler && (
            <div className="ehliste__warnung" data-testid="eh-import-fehler">
              {importFehler}
            </div>
          )}

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
                        (auswahl === i ? "ist-ausgewaehlt " : "") +
                        (istDuplikat(i)
                          ? "ehliste__zeile--duplikat"
                          : istAustritt(e.name)
                            ? "ehliste__zeile--austritt"
                            : "")
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
                    <tr key={`${u.name}-${i}`} onClick={() => toggleUpdate(i)} className={`ehliste__zeile--${u.typ}`}>
                      <td>{u.name}</td>
                      <td className="zentriert">{u.kategorie === "" ? "–" : u.kategorie}</td>
                      <td className="zentriert">
                        <input
                          type="checkbox"
                          checked={u.gewaehlt}
                          disabled={u.typ === "vorhanden"}
                          onChange={() => toggleUpdate(i)}
                          onClick={(e) => e.stopPropagation()}
                        />
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

      {vorschau && (
        <Modal title="EH-Listen Update" onClose={() => setVorschau(null)} maxWidth="440px" titelZentriert>
          <div className="ehliste__vorschau" data-testid="eh-vorschau">
            <div className="ehliste__vorschau-gruppe">
              <h4 className="ehliste__vorschau-titel ehliste__vorschau-titel--neu">
                Aufnahme in EH-Liste: {vorschau.aufnahme.length} {vorschau.aufnahme.length === 1 ? "Lotse" : "Lotsen"}
              </h4>
              {vorschau.aufnahme.length > 0 && (
                <ul>
                  {vorschau.aufnahme.map((a) => (
                    <li key={a.name}>{a.name}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="ehliste__vorschau-gruppe">
              <h4 className="ehliste__vorschau-titel ehliste__vorschau-titel--austritt">
                Austritt aus der EH-Liste: {vorschau.austritt.length} {vorschau.austritt.length === 1 ? "Lotse" : "Lotsen"}
              </h4>
              {vorschau.austritt.length > 0 && (
                <ul className="ehliste__austritt-liste">
                  {vorschau.austritt.map((a) => (
                    <li key={a.name} className="ehliste__austritt-zeile">
                      <span>{a.name}</span>
                      <Switch
                        label="Austritt ignorieren"
                        checked={austrittIgnoriert.has(a.name)}
                        onChange={(wert) =>
                          setAustrittIgnoriert((prev) => {
                            const next = new Set(prev);
                            if (wert) next.add(a.name);
                            else next.delete(a.name);
                            return next;
                          })
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="ehliste__vorschau-gruppe">
              <h4 className="ehliste__vorschau-titel ehliste__vorschau-titel--konflikt">
                Konflikte: {vorschau.konflikte.length} {vorschau.konflikte.length === 1 ? "Lotse" : "Lotsen"}
              </h4>
              {vorschau.konflikte.length > 0 && (
                <>
                  <ul>
                    {vorschau.konflikte.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                  <p className="ehliste__vorschau-hinweis">
                    Name kommt mehrfach in der Einsatzstation vor — bitte dort klären, bleibt bis dahin unangetastet.
                  </p>
                </>
              )}
            </div>
            <div className="ehliste__bearbeiten-aktionen">
              <button type="button" className="btn btn--ghost" onClick={() => setVorschau(null)} data-testid="eh-vorschau-abbrechen">
                Abbrechen
              </button>
              <button type="button" className="btn btn--accent" onClick={handleBestaetigen} data-testid="eh-vorschau-bestaetigen">
                Bestätigen
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
