import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { Einsatzplanung } from "./pages/Einsatzplanung";
import { Einsatzstation } from "./pages/Einsatzstation";
import { Jobs } from "./pages/Jobs";
import { Settings } from "./pages/Settings";
import { Versetzliste } from "./pages/Versetzliste";

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/einsatzplanung" replace />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/einsatzplanung" element={<Einsatzplanung />} />
        <Route path="/versetzliste" element={<Versetzliste />} />
        <Route path="/einsatzstation" element={<Einsatzstation />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
