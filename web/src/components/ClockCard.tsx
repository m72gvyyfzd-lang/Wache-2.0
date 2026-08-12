import { useEffect, useState } from "react";
import { formatUhrzeit } from "../lib/format";
import { ladeTheme, speichereTheme } from "../state/storage";
import { useData } from "../state/DataContext";
import "./ClockCard.css";

/** Sonne (hell aktiv) bzw. Mond (dunkel aktiv) — zeigt den AKTUELLEN
 *  Zustand, ein Klick wechselt zum jeweils anderen. */
function SonneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 0.8v1.6M8 13.6v1.6M15.2 8h-1.6M2.4 8H0.8M13.06 2.94l-1.13 1.13M4.07 11.93l-1.13 1.13M13.06 13.06l-1.13-1.13M4.07 4.07 2.94 2.94"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MondIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M14 9.8A6.2 6.2 0 1 1 6.2 2a5 5 0 0 0 7.8 7.8Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Lautsprecher mit Schallwellen (Ton an) bzw. mit Kreuz (Ton aus) — zeigt
 *  den AKTUELLEN Zustand, ein Klick schaltet um. */
function LautsprecherIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M1.4 6.2h2.1L6.8 3v10L3.5 9.8H1.4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path
        d="M9.8 5.4a4 4 0 0 1 0 5.2M11.7 3.5a7 7 0 0 1 0 9"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LautsprecherAusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M1.4 6.2h2.1L6.8 3v10L3.5 9.8H1.4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M10.2 6.1 13.8 9.9M13.8 6.1l-3.6 3.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

interface ClockCardProps {
  /** Zustand + Umschalter für den Alarm-Ton — lebt gemeinsam mit
   *  DashboardCard in TopBar, da beide Kacheln ihn brauchen. */
  tonAn: boolean;
  onTonToggle: () => void;
}

export function ClockCard({ tonAn, onTonToggle }: ClockCardProps) {
  const { hwBrb } = useData();
  const [now, setNow] = useState(() => new Date());
  // Ohne gespeicherte manuelle Wahl folgt der Schalter der Systemeinstellung
  // (dieselbe Quelle, die index.css per prefers-color-scheme ohnehin schon
  // anwendet) — erst ein Klick legt eine feste Wahl an.
  const [theme, setTheme] = useState<"hell" | "dunkel">(
    () => ladeTheme() ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dunkel" : "hell"),
  );

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  function toggleTheme() {
    setTheme((aktuell) => {
      const neu = aktuell === "hell" ? "dunkel" : "hell";
      speichereTheme(neu);
      document.documentElement.dataset.theme = neu;
      return neu;
    });
  }

  const zeit = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const datum = now.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
  const hwBrbText = hwBrb.hw1 ? `${formatUhrzeit(hwBrb.hw1)} / ${formatUhrzeit(hwBrb.hw2)}` : "–";

  return (
    <div className="clock-card">
      <div className="clock-card__karte">
        <div className="clock-card__time">{zeit}</div>
        <div className="clock-card__date">{datum}</div>
        <div className="clock-card__hw">
          <div className="clock-card__hw-label">HW Brb</div>
          <div className="clock-card__hw-wert">{hwBrbText}</div>
        </div>
        <div className="clock-card__schalter-reihe">
          <button
            type="button"
            className="clock-card__theme-schalter"
            onClick={toggleTheme}
            title={theme === "hell" ? "Nachtmodus aktivieren" : "Tagmodus aktivieren"}
          >
            {theme === "hell" ? <SonneIcon /> : <MondIcon />}
          </button>
          <button
            type="button"
            className={"clock-card__theme-schalter" + (tonAn ? " clock-card__theme-schalter--aktiv" : "")}
            onClick={onTonToggle}
            title={tonAn ? "Alarm-Ton ausschalten" : "Alarm-Ton einschalten"}
          >
            {tonAn ? <LautsprecherIcon /> : <LautsprecherAusIcon />}
          </button>
        </div>
      </div>
    </div>
  );
}
