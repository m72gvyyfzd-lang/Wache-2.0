import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { Einsatzplanung } from "./pages/Einsatzplanung";
import { Jobs } from "./pages/Jobs";
import { Lotsenliste } from "./pages/Lotsenliste";

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/einsatzplanung" replace />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/einsatzplanung" element={<Einsatzplanung />} />
        <Route path="/lotsenliste" element={<Lotsenliste />} />
      </Route>
    </Routes>
  );
}

export default App;
