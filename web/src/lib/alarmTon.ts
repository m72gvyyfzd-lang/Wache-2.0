/**
 * Alarm-Ton (ohne Audio-Dateien). Die Töne werden synthetisiert, aber
 * NICHT live über einen laufenden AudioContext ausgegeben, sondern einmal
 * in ein WAV gerendert (OfflineAudioContext) und über ein <audio>-Element
 * abgespielt. Grund sind drei Eigenheiten von Safari auf dem iPad, an
 * denen der bisherige Web-Audio-Weg im Betrieb scheiterte:
 *
 *  1. iOS suspendiert einen AudioContext, sobald die Seite in den
 *     Hintergrund geht oder der Bildschirm sperrt. Ein Wach-Dashboard
 *     läuft stundenlang — der einmal entsperrte Context war danach still,
 *     und der alte Code stieg bei nicht laufendem Context wortlos aus.
 *  2. Der Hardware-Stummschalter des Geräts stummt Web Audio; ein
 *     <audio>-Element ist davon nicht betroffen.
 *  3. Ein <audio>-Element, das EINMAL aus einer Nutzer-Interaktion heraus
 *     abgespielt wurde, darf danach jederzeit ohne Geste spielen — genau
 *     das braucht ein Alarm, der irgendwann von selbst losgeht.
 *
 * tonEntsperren() erledigt diese Freischaltung (aus einem Klick/Touch
 * heraus aufrufen), spieleAlarmTon() spielt danach jederzeit. Als
 * Rückfallebene bleibt der direkte Web-Audio-Weg erhalten.
 *
 * Es stehen mehrere Töne zur Wahl (Settings > Allgemein); die Auswahl
 * liegt im localStorage und wird beim Abspielen frisch gelesen.
 */

export type AlarmTonName = "zweiklang" | "uhoh" | "dreiklang" | "glocke";

export const ALARM_TOENE: { name: AlarmTonName; label: string }[] = [
  { name: "zweiklang", label: "Zweiklang" },
  { name: "uhoh", label: "Uh-Oh" },
  { name: "dreiklang", label: "Dreiklang" },
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

/** Kurze, deutliche Zweiklang-Sequenz (der bisherige Standardton). */
function spieleZweiklang(c: BaseAudioContext, t0: number): void {
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
  c: BaseAudioContext,
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
function spieleUhOh(c: BaseAudioContext, t0: number): void {
  // "uh": offener Zentralvokal, Formanten ~650/1100 Hz
  spieleSilbe(c, t0, 0.16, 330, 300, [650, 1100], 0.85);
  // "oh": dunkles o, Formanten ~430/800 Hz, deutlich tiefer und länger
  spieleSilbe(c, t0 + 0.24, 0.3, 262, 220, [430, 800], 0.95);
}

/** Freundlicher, aufsteigender Dreiklang (weiche Sinustöne). */
function spieleDreiklang(c: BaseAudioContext, t0: number): void {
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
function spieleGlocke(c: BaseAudioContext, t0: number): void {
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

/** Baut den gewählten Ton in den übergebenen Context (live oder offline). */
function baueTon(name: AlarmTonName, c: BaseAudioContext, t0: number): void {
  if (name === "uhoh") spieleUhOh(c, t0);
  else if (name === "dreiklang") spieleDreiklang(c, t0);
  else if (name === "glocke") spieleGlocke(c, t0);
  else spieleZweiklang(c, t0);
}

/** Längster Ton (Glocke) klingt gut 1,2 s aus — 2,5 s Puffer reichen für
 *  jede Variante. */
const TON_DAUER_S = 2.5;
const ABTASTRATE = 44100;

/** WAV-Datei (16 Bit PCM, mono) aus einem gerenderten Puffer. */
function wavAus(puffer: AudioBuffer): ArrayBuffer {
  const proben = puffer.getChannelData(0);
  const bytes = new ArrayBuffer(44 + proben.length * 2);
  const sicht = new DataView(bytes);
  const schreibeText = (pos: number, text: string) => {
    for (let i = 0; i < text.length; i++) sicht.setUint8(pos + i, text.charCodeAt(i));
  };
  schreibeText(0, "RIFF");
  sicht.setUint32(4, 36 + proben.length * 2, true);
  schreibeText(8, "WAVE");
  schreibeText(12, "fmt ");
  sicht.setUint32(16, 16, true); // Länge des fmt-Blocks
  sicht.setUint16(20, 1, true); // PCM
  sicht.setUint16(22, 1, true); // mono
  sicht.setUint32(24, puffer.sampleRate, true);
  sicht.setUint32(28, puffer.sampleRate * 2, true); // Bytes pro Sekunde
  sicht.setUint16(32, 2, true); // Bytes pro Rahmen
  sicht.setUint16(34, 16, true); // Bits pro Probe
  schreibeText(36, "data");
  sicht.setUint32(40, proben.length * 2, true);
  for (let i = 0; i < proben.length; i++) {
    const wert = Math.max(-1, Math.min(1, proben[i]));
    sicht.setInt16(44 + i * 2, wert < 0 ? wert * 0x8000 : wert * 0x7fff, true);
  }
  return bytes;
}

/** Gerenderte Töne, je Variante einmal (als Blob-URL). */
const tonUrls = new Map<AlarmTonName, string>();

async function holeTonUrl(name: AlarmTonName): Promise<string> {
  const vorhanden = tonUrls.get(name);
  if (vorhanden !== undefined) return vorhanden;
  const offline = new OfflineAudioContext(1, Math.ceil(TON_DAUER_S * ABTASTRATE), ABTASTRATE);
  baueTon(name, offline, 0);
  const puffer = await offline.startRendering();
  const url = URL.createObjectURL(new Blob([wavAus(puffer)], { type: "audio/wav" }));
  tonUrls.set(name, url);
  return url;
}

/** Ein einziges, wiederverwendetes Element: die Freischaltung durch die
 *  erste Nutzer-Interaktion gilt für das Element, nicht für die Quelle —
 *  jeder spätere Ton läuft darüber. */
let element: HTMLAudioElement | null = null;
let freigeschaltet = false;

function holeElement(): HTMLAudioElement {
  if (!element) {
    element = new Audio();
    element.preload = "auto";
  }
  return element;
}

/** Kürzestes gültiges WAV (0,05 s Stille) für die Freischaltung. */
/* 0,05 s Stille, 44,1 kHz mono — erzeugt mit einem WAV-Kopf + Nullen. */
const STILLE_WAV = "data:audio/wav;base64,UklGRl4RAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YToRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

/** true, sobald der Ton ohne weitere Nutzer-Interaktion spielen darf. */
export function tonFreigeschaltet(): boolean {
  return freigeschaltet;
}

/** Schaltet den Ton frei — MUSS aus einer Nutzer-Interaktion heraus
 *  aufgerufen werden (Autoplay-Sperre). Danach spielt spieleAlarmTon()
 *  jederzeit von selbst. Mehrfachaufrufe sind harmlos und sinnvoll: iOS
 *  entzieht die Freigabe nach Hintergrund-Phasen wieder. */
export function tonEntsperren(): void {
  const a = holeElement();
  if (a.src === "" || !freigeschaltet) a.src = STILLE_WAV;
  const gestartet = a.play();
  if (gestartet !== undefined) {
    gestartet
      .then(() => {
        freigeschaltet = true;
        a.pause();
        a.currentTime = 0;
      })
      .catch(() => {
        /* bleibt gesperrt — die nächste Berührung versucht es erneut */
      });
  } else {
    freigeschaltet = true;
  }
  // Rückfallebene ebenfalls aufwecken (siehe spieleUeberWebAudio).
  const c = holeContext();
  if (c.state === "suspended") void c.resume();
}

/** Rückfallebene: direkte Ausgabe über den AudioContext. Wird nur
 *  gebraucht, wenn das <audio>-Element nicht spielen darf. */
function spieleUeberWebAudio(name: AlarmTonName): void {
  const c = holeContext();
  const ausgeben = () => baueTon(name, c, c.currentTime);
  if (c.state === "running") ausgeben();
  // Nicht wortlos aussteigen: erst aufwecken, dann ausgeben. Klappt das
  // nicht (iOS ohne Nutzer-Interaktion), bleibt es still.
  else void c.resume().then(ausgeben).catch(() => {});
}

/** Spielt den gewählten Alarmton (einmalig pro neuer Meldung). Ohne
 *  Argument klingt die in den Settings gespeicherte Auswahl. Das Promise
 *  meldet, ob der Ton tatsächlich losgelaufen ist — die Settings-Seite
 *  zeigt damit an, ob der Browser den Ton blockiert. */
export function spieleAlarmTonGeprueft(name: AlarmTonName = ladeAlarmTonWahl()): Promise<boolean> {
  return holeTonUrl(name)
    .then((url) => {
      const a = holeElement();
      if (a.src !== url) a.src = url;
      a.currentTime = 0;
      const gestartet = a.play();
      return gestartet === undefined ? true : gestartet.then(() => true);
    })
    .then((ok) => {
      freigeschaltet = freigeschaltet || ok;
      return ok;
    })
    .catch(() => {
      spieleUeberWebAudio(name);
      return false;
    });
}

export function spieleAlarmTon(name: AlarmTonName = ladeAlarmTonWahl()): void {
  void spieleAlarmTonGeprueft(name);
}
