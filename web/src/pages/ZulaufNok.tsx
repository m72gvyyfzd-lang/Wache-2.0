import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { PipelineList } from "../components/PipelineList";
import { mockZulaufNok } from "../data/mockData";

export function ZulaufNok() {
  return (
    <div>
      <PageHeader title="Zulauf NOK" description="Kanal-Route: Kiel-Holtenau → Kuden, ~1h bis Brunsbüttel" />
      <Panel title="Zulauf NOK" count={`${mockZulaufNok.length} Slots`}>
        <PipelineList
          rows={mockZulaufNok}
          steps={[
            { key: "zeitHoltenauAusfahrt", label: "Holtenau Ausfahrt" },
            { key: "zeitKudenPassage", label: "Kuden Passage" },
          ]}
        />
      </Panel>
    </div>
  );
}
