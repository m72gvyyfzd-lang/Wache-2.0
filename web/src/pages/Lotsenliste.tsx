import { useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { mockLotsenliste } from "../data/mockData";

export function Lotsenliste() {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mockLotsenliste;
    return mockLotsenliste.filter((r) => r.name.toLowerCase().includes(q));
  }, [query]);

  return (
    <div>
      <PageHeader title="Lotsenliste" description="Hauptreihenfolge · Cuxhaven Bört (nicht relevant) · Brunsbüttel Bört (relevant)" />
      <Panel
        title="Lotsenliste"
        count={query ? `${rows.length} / ${mockLotsenliste.length}` : `${mockLotsenliste.length} Einträge`}
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
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "var(--surface-2)",
              color: "var(--ink)",
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
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="num muted">{r.positionHaupt || "·"}</td>
                <td className="num muted">{r.positionCuxhavenBoert || "·"}</td>
                <td>{r.name}</td>
                <td className="num">{r.positionBrunsbuettelBoert || <span className="muted">·</span>}</td>
                <td className="muted">{r.bem}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 20 }} className="muted">
                  keine Treffer
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
