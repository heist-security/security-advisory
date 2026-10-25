"use client";
import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { severities, severityLabel, type Severity } from "@/lib/priority";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export function SeverityFilter({
  selected: values,
  onChange,
}: {
  selected: Severity[];
  onChange: (values: Severity[]) => void;
}) {
  const id = useId();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="severity-filter">
          Severity{values.length ? ` (${values.length})` : ""}
          <ChevronDown aria-hidden="true" className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <input
        type="hidden"
        name="severity"
        value={values.join(",")}
        disabled={!values.length}
      />
      <PopoverContent
        align="start"
        collisionPadding={16}
        aria-label="Filter by severity"
        className="max-w-[calc(100vw-2rem)]"
      >
        <fieldset className="space-y-1">
          <legend className="mb-2 text-xs text-muted-foreground">
            Severity (publisher or linked CVE)
          </legend>
          {severities.map((s) => (
            <label
              key={s}
              htmlFor={`${id}-${s}`}
              className="flex cursor-pointer items-center gap-2 rounded-sm py-2 text-sm"
            >
              <Checkbox
                id={`${id}-${s}`}
                checked={values.includes(s)}
                onCheckedChange={(checked) =>
                  onChange(
                    severities.filter((v) =>
                      v === s ? checked === true : values.includes(v),
                    ),
                  )
                }
              />
              {severityLabel(s)}
            </label>
          ))}
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}
