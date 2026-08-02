import { useEffect, useState } from "react";
import "./ClockCard.css";

export function ClockCard() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const zeit = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const datum = now.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });

  return (
    <div className="clock-card">
      <div className="clock-card__time">{zeit}</div>
      <div className="clock-card__date">{datum}</div>
    </div>
  );
}
