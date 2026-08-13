/** Build-Zeitstempel, von Vite beim Bauen eingesetzt (siehe vite.config.ts) —
 *  sichtbar auf der Wachbeginn-Seite, um veraltete PWA-Cache-Stände auf dem
 *  iPad sofort erkennen zu können. */
declare const __BUILD_STAND__: string;

/** Versionskennung der App, z.B. "v 01.1" (siehe vite.config.ts). */
declare const __APP_VERSION__: string;

/** Fortlaufende, dreistellige Build-Nummer (Commit-Anzahl auf HEAD). */
declare const __BUILD_NR__: string;
