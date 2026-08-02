import { ClockCard } from "../components/ClockCard";
import { DashboardCard } from "../components/DashboardCard";
import "./TopBar.css";

export function TopBar() {
  return (
    <div className="top-bar">
      <ClockCard />
      <DashboardCard />
    </div>
  );
}
