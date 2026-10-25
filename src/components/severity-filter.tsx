"use client";
import { useState } from "react";
import { severities, severityLabel, type Severity } from "@/lib/priority";

export function SeverityFilter({ selected = [] }: { selected?: Severity[] }) {
  const [values, setValues] = useState(selected);
  return (
    <details className="severity-filter">
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
                setValues((current) =>
                  severities.filter((v) =>
                    v === s ? event.target.checked : current.includes(v),
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
