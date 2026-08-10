import { useMemo, useRef, useState } from "react";
import { LOTSEN_KATEGORIEN } from "@wache/core";
import { FrageModal } from "../components/FrageModal";
import { LotseForm } from "../components/LotseForm";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { QuickEditPopover } from "../components/QuickEditPopover";
import { VerschiebenModal } from "../components/VerschiebenModal";
import type { AktuelleFahrt, Fahrt, LotsenEintrag } from "../data/types";
import {
  ABRUF_OPTIONEN,
  FAHRT_OPTIONEN,
  FAHRT_ZEILE_KLASSE,
  formatAbrufOption,
  formatAbrufzeit,
  sortiereUndNummeriere,
} from "../lib/lotsenOrdnung";
import { useData } from "../state/DataContext";
import "./Einsatzstation.css";

function zaehlerZelle(wert: number): string {
  return wert > 0 ? String(wert) : "·";
}

/** Per Doppelklick bearbeitbare Spalten. "BB" fehlt bewusst: die Nummer
 *  hängt an der Listenposition, nicht am Lotsen (siehe lotsenOrdnung.ts). */
type QuickSpalte = "fahrt" | "name" | "kategorie" | "abrufStunden" | "elbehafen" | "toern2Plus2" | "toernWb" | "toernWr" | "toernHulo" | "bemerkung";

const QUICK_TITEL: Record<QuickSpalte, string> = {
  fahrt: "Fahrt",
  name: "Name",
  kategorie: "Kat.",
  abrufStunden: "Abrufzeit",
  elbehafen: "Elbehafen",
  toern2Plus2: "2+2",
  toernWb: "WB",
  toernWr: "WR",
  toernHulo: "HuLo",
  bemerkung: "Bemerkungen",
};

/** Farbklasse des Fahrt-Auswahlfeldes im Quick-Edit — dieselbe Tönung wie
 *  die Zeilen der Liste. */
const QUICK_FAHRT_KLASSE: Record<string, string> = {
  MoFa: "quick-edit__fahrt--mofa",
  MiFa: "quick-edit__fahrt--mifa",
  AFA: "quick-edit__fahrt--afa",
};

interface QuickEdit {
  spalte: QuickSpalte;
  /** Original-Index des Lotsen in der ungefilterten Liste */
  index: number;
  /** linke Kante der Spalte (Viewport) — das Fenster richtet sich daran aus */
  left: number;
}

export function Einsatzstation() {
  const { lotsen, addLotse, updateLotse, deleteLotse, tauscheLotsen, verschiebeLotse, aktuelleFahrt, setAktuelleFahrt } =
    useData();
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<{ index?: number; lotse?: LotsenEintrag } | null>(null);
  // Markierung wie in den übrigen Listen: Klick wählt aus, max. zwei
  // Lotsen (mehr braucht keine der Aktionen), ein weiterer Klick beginnt
  // eine neue Auswahl. Gehalten werden Original-Indizes.
  const [auswahl, setAuswahl] = useState<number[]>([]);
  const [tauschenFrage, setTauschenFrage] = useState(false);
  const [verschiebenOffen, setVerschiebenOffen] = useState(false);
  const [quickEdit, setQuickEdit] = useState<QuickEdit | null>(null);
  // Die Quick-Edit-Fenster liegen knapp unter der Seitenüberschrift statt
  // über der Zeile — daher wird deren Unterkante gemessen.
  const kopf = useRef<HTMLDivElement>(null);

  const geordnet = useMemo(() => sortiereUndNummeriere(lotsen, aktuelleFahrt), [lotsen, aktuelleFahrt]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return geordnet;
    return geordnet.filter(({ eintrag }) => eintrag.name.toLowerCase().includes(q));
  }, [geordnet, query]);

  const einzelAuswahl = auswahl.length === 1 ? auswahl[0] : null;
  const quickLotse = quickEdit ? lotsen[quickEdit.index] : undefined;

  function handleZeileKlick(index: number) {
    setAuswahl((aktuell) => {
      if (aktuell.includes(index)) return aktuell.filter((x) => x !== index);
      if (aktuell.length >= 2) return [index];
      return [...aktuell, index];
    });
  }

  function handleSubmit(lotse: LotsenEintrag) {
    if (dialog?.index !== undefined) {
      updateLotse(dialog.index, lotse);
    } else {
      addLotse(lotse);
    }
    setAuswahl([]);
    setDialog(null);
  }

  function handleDelete() {
    if (dialog?.index !== undefined) deleteLotse(dialog.index);
    setAuswahl([]);
    setDialog(null);
  }

  function handleBearbeiten() {
    if (einzelAuswahl === null) return;
    setDialog({ index: einzelAuswahl, lotse: lotsen[einzelAuswahl] });
  }

  function handleTauschenJa() {
    if (auswahl.length !== 2) return;
    tauscheLotsen(auswahl[0], auswahl[1]);
    setAuswahl([]);
    setTauschenFrage(false);
  }

  function handleVerschieben(zielIndex: number) {
    if (einzelAuswahl === null) return;
    verschiebeLotse(einzelAuswahl, zielIndex);
    setAuswahl([]);
    setVerschiebenOffen(false);
  }

  /** Doppelklick auf eine Zelle: Quick-Edit für deren Spalte öffnen. Die
   *  Zelle gibt nur die waagerechte Ausrichtung vor. */
  function oeffneQuickEdit(spalte: QuickSpalte, index: number, ziel: HTMLElement) {
    setAuswahl([index]);
    setQuickEdit({ spalte, index, left: ziel.getBoundingClientRect().left });
  }

  /** Quick-Edit schreibt sofort und ohne Rückfrage — danach schließt das
   *  Fenster. Ein Klick daneben (siehe QuickEditPopover) kommt hier nie an
   *  und ändert daher nichts. */
  function uebernehmeQuickEdit(feld: Partial<LotsenEintrag>) {
    if (!quickEdit || !quickLotse) return;
    updateLotse(quickEdit.index, { ...quickLotse, ...feld });
    setQuickEdit(null);
  }

  /** Zahlen-/Textfelder übernehmen mit Enter (Auswahlfelder direkt bei der
   *  Auswahl) — ein OK-Knopf würde dem "ohne Bestätigung" widersprechen. */
  function handleTextTaste(e: React.KeyboardEvent<HTMLInputElement>, feld: keyof LotsenEintrag, alsZahl: boolean) {
    if (e.key !== "Enter") return;
    const roh = e.currentTarget.value;
    uebernehmeQuickEdit({ [feld]: alsZahl ? Number(roh) || 0 : roh.trim() } as Partial<LotsenEintrag>);
  }

  const tauschenText =
    auswahl.length === 2 ? `${lotsen[auswahl[0]]?.name} mit ${lotsen[auswahl[1]]?.name} tauschen?` : "";
  const quickTop = (kopf.current?.getBoundingClientRect().bottom ?? 0) + 6;

  return (
    <div>
      <div ref={kopf}>
        <PageHeader
          title="Einsatzstation Brunsbüttel"
          centered
          action={
            <button type="button" className="btn btn--small btn--accent" onClick={() => setDialog({})}>
              + Neuer Lotse
            </button>
          }
        />
      </div>

      <Panel>
        <div className="lotsen-toolbar">
          <div className="lotsen-toolbar__suche">
            <input
              type="search"
              placeholder="Name suchen…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="lotsen-aktionen">
            <button type="button" className="btn btn--small" disabled={einzelAuswahl === null} onClick={handleBearbeiten}>
              Bearbeiten
            </button>
            <button
              type="button"
              className="btn btn--small"
              disabled={auswahl.length !== 2}
              onClick={() => setTauschenFrage(true)}
            >
              Tauschen
            </button>
            <button
              type="button"
              className="btn btn--small"
              disabled={einzelAuswahl === null}
              onClick={() => setVerschiebenOffen(true)}
            >
              Verschieben
            </button>
          </div>
          <label className="fahrt-auswahl">
            aktuelle Fahrt:
            <select value={aktuelleFahrt} onChange={(e) => setAktuelleFahrt(e.target.value as AktuelleFahrt)}>
              <option value="MoFa">MoFa</option>
              <option value="MiFa">MiFa</option>
              <option value="AFA">AFA</option>
            </select>
          </label>
        </div>
        <div className="tabelle-scroll">
          <table className="lotsen-table">
            <thead>
              <tr>
                <th className="num">Fahrt #</th>
                <th>Name</th>
                <th className="num">Kat.</th>
                <th className="num">Abr.</th>
                <th className="num">EH</th>
                <th className="num">2+2</th>
                <th className="num">WB</th>
                <th className="num">WR</th>
                <th className="num">HuLo</th>
                <th className="num">BB</th>
                <th>Bemerkungen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ eintrag, index, fahrtNr, bb }) => {
                const klick = () => handleZeileKlick(index);
                // Jede Zelle trägt ihren eigenen Doppelklick, damit das
                // Quick-Edit-Fenster weiß, welche Spalte gemeint ist.
                const quick = (spalte: QuickSpalte) => (e: React.MouseEvent<HTMLTableCellElement>) =>
                  oeffneQuickEdit(spalte, index, e.currentTarget);
                return (
                  <tr
                    key={index}
                    className={
                      `row-click ${FAHRT_ZEILE_KLASSE[eintrag.fahrt] ?? ""}` +
                      (auswahl.includes(index) ? " ist-ausgewaehlt" : "")
                    }
                    onClick={klick}
                  >
                    <td className="num" onDoubleClick={quick("fahrt")}>
                      {fahrtNr ?? "·"}
                    </td>
                    <td className="cell-name" onDoubleClick={quick("name")}>
                      {eintrag.name}
                    </td>
                    <td className="num" onDoubleClick={quick("kategorie")}>
                      {eintrag.kategorie}
                    </td>
                    <td className="num muted" onDoubleClick={quick("abrufStunden")}>
                      {formatAbrufzeit(eintrag.abrufStunden) || "·"}
                    </td>
                    <td className="num" onDoubleClick={quick("elbehafen")}>
                      {eintrag.elbehafen ? "✓" : ""}
                    </td>
                    <td className="num muted" onDoubleClick={quick("toern2Plus2")}>
                      {zaehlerZelle(eintrag.toern2Plus2)}
                    </td>
                    <td className="num muted" onDoubleClick={quick("toernWb")}>
                      {zaehlerZelle(eintrag.toernWb)}
                    </td>
                    <td className="num muted" onDoubleClick={quick("toernWr")}>
                      {zaehlerZelle(eintrag.toernWr)}
                    </td>
                    <td className="num muted" onDoubleClick={quick("toernHulo")}>
                      {zaehlerZelle(eintrag.toernHulo)}
                    </td>
                    <td className="num muted">{bb ?? "·"}</td>
                    <td className="muted" onDoubleClick={quick("bemerkung")}>
                      {eintrag.bemerkung}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ textAlign: "center", padding: 20 }} className="muted">
                    keine Treffer
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {quickEdit && quickLotse && (
        <QuickEditPopover
          titel={QUICK_TITEL[quickEdit.spalte]}
          top={quickTop}
          left={quickEdit.left}
          onClose={() => setQuickEdit(null)}
        >
          {quickEdit.spalte === "fahrt" && (
            <select
              className={QUICK_FAHRT_KLASSE[quickLotse.fahrt] ?? ""}
              value={quickLotse.fahrt}
              onChange={(e) => uebernehmeQuickEdit({ fahrt: e.target.value as Fahrt })}
            >
              {FAHRT_OPTIONEN.map((f) => (
                <option key={f} value={f}>
                  {f === "" ? "– (Bereitschaft)" : f}
                </option>
              ))}
            </select>
          )}
          {quickEdit.spalte === "kategorie" && (
            <select value={quickLotse.kategorie} onChange={(e) => uebernehmeQuickEdit({ kategorie: e.target.value })}>
              {LOTSEN_KATEGORIEN.map((kat) => (
                <option key={kat} value={kat}>
                  {kat === "" ? "Volllotse" : kat}
                </option>
              ))}
            </select>
          )}
          {quickEdit.spalte === "abrufStunden" && (
            <select
              value={quickLotse.abrufStunden ?? ""}
              onChange={(e) => uebernehmeQuickEdit({ abrufStunden: e.target.value === "" ? undefined : Number(e.target.value) })}
            >
              {ABRUF_OPTIONEN.map((wert) => (
                <option key={wert ?? "leer"} value={wert ?? ""}>
                  {formatAbrufOption(wert)}
                </option>
              ))}
            </select>
          )}
          {quickEdit.spalte === "elbehafen" && (
            <select
              value={quickLotse.elbehafen ? "ja" : "nein"}
              onChange={(e) => uebernehmeQuickEdit({ elbehafen: e.target.value === "ja" })}
            >
              <option value="ja">✓ in EH-Liste</option>
              <option value="nein">– nicht in EH-Liste</option>
            </select>
          )}
          {(quickEdit.spalte === "name" || quickEdit.spalte === "bemerkung") && (
            <input
              defaultValue={quickEdit.spalte === "name" ? quickLotse.name : quickLotse.bemerkung}
              onKeyDown={(e) => handleTextTaste(e, quickEdit.spalte === "name" ? "name" : "bemerkung", false)}
            />
          )}
          {(quickEdit.spalte === "toern2Plus2" ||
            quickEdit.spalte === "toernWb" ||
            quickEdit.spalte === "toernWr" ||
            quickEdit.spalte === "toernHulo") && (
            <input
              type="number"
              min={0}
              max={999}
              step={1}
              defaultValue={quickLotse[quickEdit.spalte]}
              onKeyDown={(e) => handleTextTaste(e, quickEdit.spalte as keyof LotsenEintrag, true)}
            />
          )}
        </QuickEditPopover>
      )}

      {tauschenFrage && auswahl.length === 2 && (
        <Modal title="Tauschen" onClose={() => setTauschenFrage(false)} maxWidth="380px" titelZentriert>
          <FrageModal frage={tauschenText} zentriert onJa={handleTauschenJa} onNein={() => setTauschenFrage(false)} />
        </Modal>
      )}

      {verschiebenOffen && einzelAuswahl !== null && (
        <Modal
          title={lotsen[einzelAuswahl].name}
          onClose={() => setVerschiebenOffen(false)}
          maxWidth="380px"
          titelZentriert
        >
          <VerschiebenModal
            ziele={geordnet
              .filter(({ index }) => index !== einzelAuswahl)
              .map(({ eintrag, index }) => ({ index, name: eintrag.name }))}
            onVerschieben={handleVerschieben}
            onAbbrechen={() => setVerschiebenOffen(false)}
          />
        </Modal>
      )}

      {dialog && (
        <Modal title={dialog.lotse ? "Lotse bearbeiten" : "Neuer Lotse"} onClose={() => setDialog(null)} maxWidth="420px">
          <LotseForm
            initial={dialog.lotse}
            onSubmit={handleSubmit}
            onDelete={dialog.index !== undefined ? handleDelete : undefined}
            onCancel={() => setDialog(null)}
          />
        </Modal>
      )}
    </div>
  );
}
