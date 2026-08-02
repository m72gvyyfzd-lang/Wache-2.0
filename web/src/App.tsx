import { Route, Routes } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { Anmeldungen } from "./pages/Anmeldungen";
import { Dashboard } from "./pages/Dashboard";
import { Lotsenliste } from "./pages/Lotsenliste";
import { ZulaufHamburg } from "./pages/ZulaufHamburg";
import { ZulaufNok } from "./pages/ZulaufNok";

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/lotsenliste" element={<Lotsenliste />} />
        <Route path="/zulauf-hamburg" element={<ZulaufHamburg />} />
        <Route path="/zulauf-nok" element={<ZulaufNok />} />
        <Route path="/anmeldungen" element={<Anmeldungen />} />
      </Route>
    </Routes>
  );
}

export default App;
