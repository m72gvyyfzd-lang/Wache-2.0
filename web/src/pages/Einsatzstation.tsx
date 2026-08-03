import { useMemo, useState } from "react";
import { LotseForm } from "../components/LotseForm";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import type { AktuelleFahrt, LotsenEintrag } from "../data/types";
import { formatAbrufzeit, sortiereUndNummeriere } from "../lib/lotsenOrdnung";
import { useData } from "../state/DataContext";
import "./Einsatzstation.css";

const FAHRT_ZEILE_KLASSE: Record<string, string> = {
  MoFa: "fahrt-zeile--mofa",
  MiFa: "fahrt-zeile--mifa",
  AFA: "fahrt-zeile--afa",
};

function zaehlerZelle(wert: number): string {
  return wert > 0 ? String(wert) : "·";
}

export function Einsatzstation() {
  const { lotsen, addLotse, updateLotse, deleteLotse, aktuelleFahrt, setAktuelleFahrt } = useData();
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<{ index?: number; lotse?: LotsenEintrag } | null>(null);

  const geordnet = useMemo(() => sortiereUndNummeriere(lotsen, aktuelleFahrt), [lotsen, aktuelleFahrt]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return geordnet;
    return geordnet.filter(({ eintrag }) => eintrag.name.toLowerCase().includes(q));
  }, [geordnet, query]);

  function handleSubmit(lotse: LotsenEintrag) {
    if (dialog?.index !== undefined) {
      updateLotse(dialog.index, lotse);
    } else {
      addLotse(lotse);
    }
    setDialog(null);
  }

  function handleDelete() {
    if (dialog?.index !== undefined) deleteLotse(dialog.index);
    setDialog(null);
  }

  return (
    <div>
      <PageHeader title="Einsatzstation Brunsbüttel" centered />

      <div className="fahrt-auswahl">
        <label>
          aktuelle Fahrt:
          <select value={aktuelleFahrt} onChange={(e) => setAktuelleFahrt(e.target.value as AktuelleFahrt)}>
            <option value="MoFa">MoFa</option>
            <option value="MiFa">MiFa</option>
            <option value="AFA">AFA</option>
          </select>
        </label>
      </div>

      <Panel
        title="Lotsenliste"
        count={query ? `${rows.length} / ${lotsen.length}` : `${lotsen.length} Einträge`}
        action={
          <button type="button" className="btn btn--small btn--accent" onClick={() => setDialog({})}>
            + Neuer Lotse
          </button>
        }
      >
        <div style={{ padding: "0 20px 10px" }}>
          <input
            type="search"
            placeholder="Name suchen…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: "100%", maxWidth: 320, font: "inherit", fontSize: "0.85rem", padding: "7px 12px" }}
          />
        </div>
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
            {rows.map(({ eintrag, index, fahrtNr, bb }) => (
              <tr
                key={index}
                className={`row-click ${FAHRT_ZEILE_KLASSE[eintrag.fahrt] ?? ""}`}
                onClick={() => setDialog({ index, lotse: eintrag })}
              >
                <td className="num">{fahrtNr ?? "·"}</td>
                <td className="cell-name">{eintrag.name}</td>
                <td className="num">{eintrag.kategorie}</td>
                <td className="num muted">{formatAbrufzeit(eintrag.abrufStunden) || "·"}</td>
                <td className="num">{eintrag.elbehafen ? "✓" : ""}</td>
                <td className="num muted">{zaehlerZelle(eintrag.toern2Plus2)}</td>
                <td className="num muted">{zaehlerZelle(eintrag.toernWb)}</td>
                <td className="num muted">{zaehlerZelle(eintrag.toernWr)}</td>
                <td className="num muted">{zaehlerZelle(eintrag.toernHulo)}</td>
                <td className="num muted">{bb ?? "·"}</td>
                <td className="muted">{eintrag.bemerkung}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} style={{ textAlign: "center", padding: 20 }} className="muted">
                  keine Treffer
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>

      {dialog && (
        <Modal title={dialog.lotse ? "Lotse bearbeiten" : "Neuer Lotse"} onClose={() => setDialog(null)}>
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
