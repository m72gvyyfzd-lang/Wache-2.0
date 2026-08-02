import "./PipelineList.css";

interface Step<T> {
  key: keyof T;
  label: string;
}

interface PipelineListProps<T extends { nr: string; bem: string }> {
  rows: T[];
  steps: Step<T>[];
}

export function PipelineList<T extends { nr: string; bem: string }>({ rows, steps }: PipelineListProps<T>) {
  const active = rows.filter((r) => steps.some((s) => r[s.key]));

  if (active.length === 0) {
    return <div className="pipeline-empty">keine aktiven Meldungen</div>;
  }

  return (
    <div>
      {active.map((r, i) => (
        <div className="pipeline-row" key={i}>
          <div className="pipeline-row__nr">{r.nr}</div>
          <div className="pipeline-row__steps">
            {steps.map((s, si) => {
              const value = r[s.key] as unknown as string;
              const filled = Boolean(value);
              return (
                <div className="pipeline-step" key={String(s.key)}>
                  <div className={"pipeline-dot" + (filled ? " pipeline-dot--filled" : "")} title={s.label} />
                  <div className={"pipeline-time" + (filled ? " pipeline-time--filled" : "")}>
                    {filled ? value : "·"}
                  </div>
                  {si < steps.length - 1 && (
                    <div className={"pipeline-line" + (filled ? " pipeline-line--filled" : "")} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="pipeline-row__bem">{r.bem}</div>
        </div>
      ))}
    </div>
  );
}
