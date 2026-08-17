import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { Einsatzplanung } from "./pages/Einsatzplanung";
import { EtaUpdate } from "./pages/EtaUpdate";
import { Einsatzstation } from "./pages/Einsatzstation";
import { FahrtPlanung } from "./pages/FahrtPlanung";
import { Jobs } from "./pages/Jobs";
import { Seestation } from "./pages/Seestation";
import { Settings } from "./pages/Settings";
import { Versetzlisten } from "./pages/Versetzlisten";
import { Wachbeginn } from "./pages/Wachbeginn";

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/einsatzplanung" replace />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/einsatzplanung" element={<Einsatzplanung />} />
        <Route path="/versetzlisten" element={<Versetzlisten />} />
        {/* Die beiden Versetzlisten lagen früher auf eigenen Seiten — alte
            Lesezeichen und der PWA-Startpfad landen weiter richtig. */}
        <Route path="/versetzliste" element={<Navigate to="/versetzlisten" replace />} />
        <Route path="/versetzliste-seestation" element={<Navigate to="/versetzlisten" replace />} />
        <Route path="/seestation" element={<Seestation />} />
        <Route path="/einsatzstation" element={<Einsatzstation />} />
        <Route path="/fahrt-planung" element={<FahrtPlanung />} />
        <Route path="/wachbeginn" element={<Wachbeginn />} />
        <Route path="/eta-update" element={<EtaUpdate />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
