import { NavLink, Outlet } from "react-router-dom";
import { TopBar } from "./TopBar";
import "./AppShell.css";

const NAV_ITEMS = [
  { to: "/jobs", label: "Tafel Brb" },
  { to: "/einsatzplanung", label: "Einsatzplanung" },
  { to: "/versetzlisten", label: "Versetzlisten" },
  { to: "/seestation", label: "Seestation" },
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
          {/* Platzhalter unter der Uhr-Kachel: schiebt die Navi-Karte auf die
              Höhe der ersten Liste im Inhaltsbereich (die Seitenüberschrift
              steht daneben) und trägt unten die Versionskennung. */}
          <div className="app-nav__platzhalter">
            <span className="app-nav__version">
              {__APP_VERSION__} (build {__BUILD_NR__})
            </span>
          </div>
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
