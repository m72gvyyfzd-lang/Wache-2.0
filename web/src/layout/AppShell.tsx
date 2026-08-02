import { NavLink, Outlet } from "react-router-dom";
import "./AppShell.css";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/einsatzplanung", label: "Einsatzplanung" },
  { to: "/lotsenliste", label: "Lotsenliste" },
];

export function AppShell() {
  return (
    <div className="app-shell">
      <nav className="app-nav" aria-label="Hauptnavigation">
        <div className="app-nav__brand">
          <span className="app-nav__brand-mark">⚓</span>
          <span className="app-nav__brand-name">Wache 2.0</span>
        </div>
        <ul className="app-nav__list">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) => "app-nav__link" + (isActive ? " app-nav__link--active" : "")}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
