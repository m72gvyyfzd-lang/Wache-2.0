import { NavLink, Outlet } from "react-router-dom";
import { TopBar } from "./TopBar";
import "./AppShell.css";

const NAV_ITEMS = [
  { to: "/jobs", label: "Tafel Brb" },
  { to: "/einsatzplanung", label: "Einsatzplanung" },
  { to: "/versetzliste", label: "Versetzliste" },
  { to: "/seestation", label: "Seestation" },
  { to: "/versetzliste-seestation", label: "Versetzliste Seestation" },
  { to: "/einsatzstation", label: "Einsatzstation" },
  { to: "/wachbeginn", label: "Wachbeginn" },
  { to: "/settings", label: "Settings" },
];

export function AppShell() {
  return (
    <div className="app-root">
      <TopBar />
      <div className="app-shell">
        <nav className="app-nav" aria-label="Hauptnavigation">
          <div className="app-nav__karte">
            <ul className="app-nav__list">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) => "app-nav__link" + (isActive ? " app-nav__link--active" : "")}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </nav>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
