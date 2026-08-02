import "./StatTile.css";

interface StatTileProps {
  label: string;
  value: string | number;
  accent?: boolean;
}

export function StatTile({ label, value, accent }: StatTileProps) {
  return (
    <div className={"stat-tile" + (accent ? " stat-tile--accent" : "")}>
      <div className="stat-tile__label">{label}</div>
      <div className="stat-tile__value">{value}</div>
    </div>
  );
}
