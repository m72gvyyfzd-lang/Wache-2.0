import { useEffect, useState } from "react";
import { spieleAlarmTon, tonEntsperren } from "../lib/alarmTon";
import { ladeAlarmTonAktiv, speichereAlarmTonAktiv } from "../state/storage";
import { ClockCard } from "../components/ClockCard";
import { DashboardCard } from "../components/DashboardCard";
import "./TopBar.css";

export function TopBar() {
  // Alarm-Ton-Zustand lebt hier gemeinsam, da sowohl der Umschalter
  // (ClockCard) als auch die alarmauslösende Auto-Play-Logik
  // (DashboardCard, kennt die berechneten Meldungen) ihn brauchen.
  const [tonAn, setTonAn] = useState(() => ladeAlarmTonAktiv());

  // Browser erlauben Ton erst nach einer Nutzer-Interaktion — das
  // Einschalten des Schalters entsperrt den AudioContext direkt; war der
  // Ton schon beim Laden aktiv, entsperrt die erste beliebige Berührung.
  useEffect(() => {
    if (!tonAn) return;
    const entsperren = () => tonEntsperren();
    document.addEventListener("pointerdown", entsperren, { once: true });
    return () => document.removeEventListener("pointerdown", entsperren);
  }, [tonAn]);

  function handleTonToggle() {
    setTonAn((an) => {
      const neu = !an;
      speichereAlarmTonAktiv(neu);
      if (neu) {
        tonEntsperren();
        spieleAlarmTon();
      }
      return neu;
    });
  }

  return (
    <div className="top-bar">
      <ClockCard tonAn={tonAn} onTonToggle={handleTonToggle} />
      <DashboardCard tonAn={tonAn} />
    </div>
  );
}
