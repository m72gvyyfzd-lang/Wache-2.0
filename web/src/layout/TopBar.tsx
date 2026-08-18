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
  // Einschalten des Schalters schaltet ihn direkt frei; war der Ton schon
  // beim Laden aktiv, übernimmt das die erste beliebige Berührung.
  //
  // Bewusst NICHT nur einmalig: iOS entzieht die Freigabe wieder, sobald
  // die Seite länger im Hintergrund war oder der Bildschirm gesperrt hat.
  // Ein Wach-Dashboard läuft stundenlang — deshalb bei jeder Berührung
  // und bei jeder Rückkehr in den Vordergrund neu freischalten. Der
  // Aufruf ist billig und bei bereits freigeschaltetem Ton wirkungslos.
  useEffect(() => {
    if (!tonAn) return;
    const entsperren = () => tonEntsperren();
    const beiSichtbar = () => {
      if (document.visibilityState === "visible") tonEntsperren();
    };
    document.addEventListener("pointerdown", entsperren);
    document.addEventListener("keydown", entsperren);
    document.addEventListener("visibilitychange", beiSichtbar);
    entsperren();
    return () => {
      document.removeEventListener("pointerdown", entsperren);
      document.removeEventListener("keydown", entsperren);
      document.removeEventListener("visibilitychange", beiSichtbar);
    };
  }, [tonAn]);

  // Seiteneffekte bewusst NEBEN dem State-Update, nicht in der
  // Updater-Funktion: React ruft die im Entwicklungsmodus doppelt auf,
  // der Probeton erklang dadurch zweimal.
  function handleTonToggle() {
    const neu = !tonAn;
    setTonAn(neu);
    speichereAlarmTonAktiv(neu);
    if (neu) {
      tonEntsperren();
      spieleAlarmTon();
    }
  }

  return (
    <div className="top-bar">
      <ClockCard tonAn={tonAn} onTonToggle={handleTonToggle} />
      <DashboardCard tonAn={tonAn} />
    </div>
  );
}
