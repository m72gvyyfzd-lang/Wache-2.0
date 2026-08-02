import { Route, Routes } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Einsatzplanung } from "./pages/Einsatzplanung";
import { Lotsenliste } from "./pages/Lotsenliste";

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/einsatzplanung" element={<Einsatzplanung />} />
        <Route path="/lotsenliste" element={<Lotsenliste />} />
      </Route>
    </Routes>
  );
}

export default App;
