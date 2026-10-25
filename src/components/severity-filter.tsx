"use client";
import { severities, severityLabel, type Severity } from "@/lib/priority";

export function SeverityFilter({
  selected: values,
  onChange,
}: {
  selected: Severity[];
  onChange: (values: Severity[]) => void;
}) {
  return (
    <details className="severity-filter choice-filter">
      <summary>Severity{values.length ? ` (${values.length})` : ""}</summary>
      <input
        type="hidden"
        name="severity"
        value={values.join(",")}
        disabled={!values.length}
      />
      <fieldset>
        <legend>Severity (publisher or linked CVE)</legend>
        {severities.map((s) => (
          <label key={s}>
            <input
              type="checkbox"
              checked={values.includes(s)}
              onChange={(event) =>
                onChange(
                  severities.filter((v) =>
                    v === s ? event.target.checked : values.includes(v),
                  ),
                )
              }
            />
            {severityLabel(s)}
          </label>
        ))}
      </fieldset>
    </details>
  );
}
