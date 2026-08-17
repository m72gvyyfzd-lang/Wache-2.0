/**
 * Alarm-Ton über Web Audio (ohne Audio-Dateien). Browser — insbesondere
 * Safari auf dem iPad — erlauben Ton erst nach einer Nutzer-Interaktion:
 * tonEntsperren() muss daher aus einem Klick/Touch heraus aufgerufen
 * werden; danach kann spieleAlarmTon() jederzeit klingen.
 *
 * Es stehen mehrere synthetisierte Töne zur Wahl (Settings > Allgemein);
 * die Auswahl liegt im localStorage und wird beim Abspielen frisch
 * gelesen — so klingt jeder Aufrufer (Dashboard-Alarm, Ton-Test) ohne
 * Context-Verdrahtung automatisch mit dem gewählten Ton.
 */

export type AlarmTonName = "zweiklang" | "uhoh" | "dreiklang" | "glocke";

export const ALARM_TOENE: { name: AlarmTonName; label: string }[] = [
  { name: "zweiklang", label: "Zweiklang (Standard)" },
  { name: "uhoh", label: "Uh-Oh (Messenger-Stil)" },
  { name: "dreiklang", label: "Dreiklang (aufsteigend)" },
  { name: "glocke", label: "Glocke" },
];

const WAHL_KEY = "wache.alarmTonWahl.v1";

export function ladeAlarmTonWahl(): AlarmTonName {
  const wert = localStorage.getItem(WAHL_KEY);
  return ALARM_TOENE.some((t) => t.name === wert) ? (wert as AlarmTonName) : "zweiklang";
}

export function speichereAlarmTonWahl(name: AlarmTonName): void {
  localStorage.setItem(WAHL_KEY, name);
}

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

/** Kurze, deutliche Zweiklang-Sequenz (der bisherige Standardton). */
function spieleZweiklang(c: AudioContext, t0: number): void {
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

/** Eine vokalartige Silbe: Sägezahn-Grundton (obertonreich wie eine
 *  Stimme) durch zwei parallele Bandpässe, deren Mittenfrequenzen den
 *  Formanten des Vokals entsprechen — daraus entsteht der "gesprochene"
 *  Klangeindruck. Leichter Tonhöhenfall innerhalb der Silbe. */
function spieleSilbe(
  c: AudioContext,
  start: number,
  dauer: number,
  tonhoeheVon: number,
  tonhoeheBis: number,
  formanten: [number, number],
  pegel: number,
): void {
  const quelle = c.createOscillator();
  quelle.type = "sawtooth";
  quelle.frequency.setValueAtTime(tonhoeheVon, start);
  quelle.frequency.exponentialRampToValueAtTime(tonhoeheBis, start + dauer);

  const huellkurve = c.createGain();
  huellkurve.gain.setValueAtTime(0.0001, start);
  huellkurve.gain.exponentialRampToValueAtTime(pegel, start + 0.02);
  huellkurve.gain.setValueAtTime(pegel, start + dauer * 0.6);
  huellkurve.gain.exponentialRampToValueAtTime(0.0001, start + dauer);

  for (const formant of formanten) {
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = formant;
    filter.Q.value = 6;
    quelle.connect(filter).connect(huellkurve);
  }
  huellkurve.connect(c.destination);
  quelle.start(start);
  quelle.stop(start + dauer + 0.02);
}

/** Nachbildung des klassischen Messenger-"Uh-Oh"s der 2000er: zwei kurze,
 *  vokalartige Silben mit fallendem Intervall — "uh" (offen, höher),
 *  kleine Pause, "oh" (dunkler, tiefer, länger). Bewusst eine Synthese-
 *  Annäherung, kein Sample. */
function spieleUhOh(c: AudioContext, t0: number): void {
  // "uh": offener Zentralvokal, Formanten ~650/1100 Hz
  spieleSilbe(c, t0, 0.16, 330, 300, [650, 1100], 0.85);
  // "oh": dunkles o, Formanten ~430/800 Hz, deutlich tiefer und länger
  spieleSilbe(c, t0 + 0.24, 0.3, 262, 220, [430, 800], 0.95);
}

/** Freundlicher, aufsteigender Dreiklang (weiche Sinustöne). */
function spieleDreiklang(c: AudioContext, t0: number): void {
  [523, 659, 784].forEach((frequenz, i) => {
    const oszillator = c.createOscillator();
    const lautstaerke = c.createGain();
    oszillator.type = "sine";
    oszillator.frequency.value = frequenz;
    const start = t0 + i * 0.16;
    const dauer = i === 2 ? 0.4 : 0.18;
    lautstaerke.gain.setValueAtTime(0.0001, start);
    lautstaerke.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
    lautstaerke.gain.exponentialRampToValueAtTime(0.0001, start + dauer);
    oszillator.connect(lautstaerke).connect(c.destination);
    oszillator.start(start);
    oszillator.stop(start + dauer + 0.02);
  });
}

/** Einzelner Glockenschlag: unharmonische Teiltöne (typisch Glocke) mit
 *  langsam ausklingender Hüllkurve. */
function spieleGlocke(c: AudioContext, t0: number): void {
  const grundton = 660;
  const teiltoene: [number, number][] = [
    [1, 0.3],
    [2.0, 0.18],
    [2.92, 0.1],
    [4.15, 0.05],
  ];
  for (const [verhaeltnis, pegel] of teiltoene) {
    const oszillator = c.createOscillator();
    const lautstaerke = c.createGain();
    oszillator.type = "sine";
    oszillator.frequency.value = grundton * verhaeltnis;
    lautstaerke.gain.setValueAtTime(0.0001, t0);
    lautstaerke.gain.exponentialRampToValueAtTime(pegel, t0 + 0.01);
    lautstaerke.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);
    oszillator.connect(lautstaerke).connect(c.destination);
    oszillator.start(t0);
    oszillator.stop(t0 + 1.25);
  }
}

/** Spielt den gewählten Alarmton (einmalig pro neuem Alarm). Ohne
 *  Argument klingt die in den Settings gespeicherte Auswahl. */
export function spieleAlarmTon(name: AlarmTonName = ladeAlarmTonWahl()): void {
  const c = holeContext();
  if (c.state !== "running") return;
  const t0 = c.currentTime;
  if (name === "uhoh") spieleUhOh(c, t0);
  else if (name === "dreiklang") spieleDreiklang(c, t0);
  else if (name === "glocke") spieleGlocke(c, t0);
  else spieleZweiklang(c, t0);
}
