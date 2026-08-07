/**
 * Alarm-Ton über Web Audio (ohne Audio-Dateien). Browser — insbesondere
 * Safari auf dem iPad — erlauben Ton erst nach einer Nutzer-Interaktion:
 * tonEntsperren() muss daher aus einem Klick/Touch heraus aufgerufen
 * werden; danach kann spieleAlarmTon() jederzeit klingen.
 */

let ctx: AudioContext | null = null;

function holeContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/** Entsperrt den AudioContext — nur aus einer Nutzer-Interaktion heraus
 *  wirksam (Autoplay-Sperre der Browser). */
export function tonEntsperren(): void {
  const c = holeContext();
  if (c.state === "suspended") void c.resume();
}

/** Kurze, deutliche Zweiklang-Sequenz (einmalig pro neuem Alarm). */
export function spieleAlarmTon(): void {
  const c = holeContext();
  if (c.state !== "running") return;
  const t0 = c.currentTime;
  [880, 660, 880, 660].forEach((frequenz, i) => {
    const oszillator = c.createOscillator();
    const lautstaerke = c.createGain();
    oszillator.type = "square";
    oszillator.frequency.value = frequenz;
    const start = t0 + i * 0.22;
    lautstaerke.gain.setValueAtTime(0.0001, start);
    lautstaerke.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
    lautstaerke.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
    oszillator.connect(lautstaerke).connect(c.destination);
    oszillator.start(start);
    oszillator.stop(start + 0.21);
  });
}
