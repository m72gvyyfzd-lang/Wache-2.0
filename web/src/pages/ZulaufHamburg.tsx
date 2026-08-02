import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { PipelineList } from "../components/PipelineList";
import { mockZulaufHamburg } from "../data/mockData";

export function ZulaufHamburg() {
  return (
    <div>
      <PageHeader
        title="Zulauf Hamburg"
        description="Elbe-Route: Hamburg Hafen → Finkenwerder → Stade, ~1h bis Brunsbüttel"
      />
      <Panel title="Zulauf Hamburg" count={`${mockZulaufHamburg.length} Slots`}>
        <PipelineList
          rows={mockZulaufHamburg}
          steps={[
            { key: "zeitHamburgHafenVerlassen", label: "Hamburg Hafen verlassen" },
            { key: "zeitFinkenwerderPassage", label: "Finkenwerder Passage" },
            { key: "zeitStadePassage", label: "Stade Passage" },
          ]}
        />
      </Panel>
    </div>
  );
}
