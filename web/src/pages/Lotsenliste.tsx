import { useMemo, useState } from "react";
import { LotseForm } from "../components/LotseForm";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import type { LotsenEintrag } from "../data/types";
import { useData } from "../state/DataContext";

export function Lotsenliste() {
  const { lotsen, addLotse, updateLotse, deleteLotse } = useData();
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<{ index?: number; lotse?: LotsenEintrag } | null>(null);

  const rows = useMemo(() => {
    const indiziert = lotsen.map((eintrag, index) => ({ eintrag, index }));
    const q = query.trim().toLowerCase();
    if (!q) return indiziert;
    return indiziert.filter(({ eintrag }) => eintrag.name.toLowerCase().includes(q));
  }, [lotsen, query]);

  function handleSubmit(lotse: LotsenEintrag) {
    if (dialog?.index !== undefined) {
      updateLotse(dialog.index, lotse);
    } else {
      addLotse(lotse);
    }
    setDialog(null);
  }

  return (
    <div>
      <PageHeader title="Lotsenliste" description="Hauptreihenfolge · Cuxhaven Bört (nicht relevant) · Brunsbüttel Bört (relevant)" />
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
            style={{
              width: "100%",
              maxWidth: 320,
              font: "inherit",
              fontSize: "0.85rem",
              padding: "7px 12px",
            }}
          />
        </div>
        <table>
          <thead>
            <tr>
              <th className="num">Tafel</th>
              <th className="num">CB</th>
              <th>Name</th>
              <th className="num">BB</th>
              <th>Bemerkung</th>
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ eintrag, index }) => (
              <tr key={index}>
                <td className="num muted">{eintrag.positionHaupt || "·"}</td>
                <td className="num muted">{eintrag.positionCuxhavenBoert || "·"}</td>
                <td>{eintrag.name}</td>
                <td className="num">{eintrag.positionBrunsbuettelBoert || <span className="muted">·</span>}</td>
                <td className="muted">{eintrag.bem}</td>
                <td className="cell-actions">
                  <button
                    type="button"
                    className="btn btn--small btn--icon"
                    onClick={() => setDialog({ index, lotse: eintrag })}
                    aria-label="Bearbeiten"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="btn btn--small btn--icon btn--danger"
                    onClick={() => deleteLotse(index)}
                    aria-label="Löschen"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 20 }} className="muted">
                  keine Treffer
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>

      {dialog && (
        <Modal title={dialog.lotse ? "Lotse bearbeiten" : "Neuer Lotse"} onClose={() => setDialog(null)}>
          <LotseForm initial={dialog.lotse} onSubmit={handleSubmit} onCancel={() => setDialog(null)} />
        </Modal>
      )}
    </div>
  );
}
