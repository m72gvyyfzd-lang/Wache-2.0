import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { Einsatzplanung } from "./pages/Einsatzplanung";
import { Einsatzstation } from "./pages/Einsatzstation";
import { Jobs } from "./pages/Jobs";
import { Seestation } from "./pages/Seestation";
import { Settings } from "./pages/Settings";
import { Versetzliste } from "./pages/Versetzliste";
import { VersetzlisteSeestation } from "./pages/VersetzlisteSeestation";
import { Wachbeginn } from "./pages/Wachbeginn";

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/einsatzplanung" replace />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/einsatzplanung" element={<Einsatzplanung />} />
        <Route path="/versetzliste" element={<Versetzliste />} />
        <Route path="/seestation" element={<Seestation />} />
        <Route path="/versetzliste-seestation" element={<VersetzlisteSeestation />} />
        <Route path="/einsatzstation" element={<Einsatzstation />} />
        <Route path="/wachbeginn" element={<Wachbeginn />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
