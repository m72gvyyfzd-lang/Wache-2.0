import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { routeFuerMeldungsArt, type MeldungsStufe } from "../lib/meldungen";
import { useMeldungen } from "../state/useMeldungen";
import { TopBar } from "./TopBar";
import "./AppShell.css";

/** Hauptpunkte mit optionalen Unterpunkten. Die Unterpunkte sind per Klick
 *  auf den BEREITS AKTIVEN Hauptpunkt ein-/ausblendbar (erster Klick
 *  navigiert nur); beim Verlassen des Bereichs klappen sie automatisch zu.
 *  Steht man direkt auf einer Unterseite (z.B. /eta-update), bleibt das
 *  Untermenü offen, damit der aktive Knopf sichtbar ist. */
const NAV_ITEMS: { to: string; label: string; unter?: { to: string; label: string }[] }[] = [
  { to: "/jobs", label: "Tafel Brb" },
  { to: "/einsatzplanung", label: "Einsatzplanung" },
  { to: "/versetzlisten", label: "Versetzlisten" },
  { to: "/seestation", label: "Seestation", unter: [{ to: "/eta-update", label: "ETA Update" }] },
  { to: "/einsatzstation", label: "Einsatzstation", unter: [{ to: "/eh-liste", label: "EH-Liste" }] },
  {
    to: "/settings",
    label: "Settings",
    unter: [
      { to: "/wachbeginn", label: "Wachbeginn" },
      { to: "/fahrt-planung", label: "Fahrt-Planung" },
    ],
  },
];

export function AppShell() {
  const { pathname } = useLocation();

  /** Route des Hauptpunkts, dessen Untermenü per Klick aufgeklappt wurde
   *  (null = keins). Unterseiten halten ihr Menü unabhängig davon offen. */
  const [offenesUntermenue, setOffenesUntermenue] = useState<string | null>(null);

  // Beim Verlassen des Bereichs (weder der Hauptpunkt noch eine seiner
  // Unterseiten offen) klappt das Untermenü automatisch wieder zu.
  useEffect(() => {
    setOffenesUntermenue((offen) => {
      if (offen === null) return null;
      const item = NAV_ITEMS.find((i) => i.to === offen);
      const imBereich = pathname === offen || (item?.unter?.some((u) => u.to === pathname) ?? false);
      return imBereich ? offen : null;
    });
  }, [pathname]);

  // Alarm-Ränder: je Nav-Ziel die höchste anliegende Meldungsstufe (alarm
  // sticht warnung; Vorschläge/Infos färben nicht). Der betroffene Knopf
  // bekommt einen dezenten roten bzw. orangen Rand.
  const { gruppen } = useMeldungen();
  const stufeProRoute = new Map<string, MeldungsStufe>();
  for (const g of gruppen) {
    if (g.stufe !== "alarm" && g.stufe !== "warnung") continue;
    const route = routeFuerMeldungsArt(g.art);
    if (!route) continue;
    const bisher = stufeProRoute.get(route);
    if (bisher !== "alarm") stufeProRoute.set(route, bisher === undefined ? g.stufe : g.stufe === "alarm" ? "alarm" : bisher);
  }
  const stufenKlasse = (route: string) => {
    const stufe = stufeProRoute.get(route);
    return stufe ? ` app-nav__link--${stufe}` : "";
  };

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
              {NAV_ITEMS.map((item) => {
                const untermenueOffen =
                  item.unter !== undefined &&
                  (offenesUntermenue === item.to || item.unter.some((u) => u.to === pathname));
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        "app-nav__link" + (isActive ? " app-nav__link--active" : "") + stufenKlasse(item.to)
                      }
                      onClick={() => {
                        // Klick auf den bereits aktiven Hauptpunkt schaltet
                        // sein Untermenü um; Navigations-Klicks lassen den
                        // Zustand in Ruhe (der Effekt oben räumt beim
                        // Bereichswechsel auf).
                        if (item.unter !== undefined && pathname === item.to) {
                          setOffenesUntermenue((offen) => (offen === item.to ? null : item.to));
                        }
                      }}
                    >
                      {item.label}
                    </NavLink>
                    {untermenueOffen && (
                      <ul className="app-nav__unterliste">
                        {item.unter!.map((unter) => (
                          <li key={unter.to} className="app-nav__unterpunkt">
                            <NavLink
                              to={unter.to}
                              className={({ isActive }) =>
                                "app-nav__link app-nav__link--unter" + (isActive ? " app-nav__link--active" : "")
                              }
                            >
                              {unter.label}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
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
