"use client";
import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export function MultiSelectFilter<T extends string>({
  name,
  label,
  legend,
  options,
  selected,
  onChange,
}: {
  name: string;
  label: string;
  legend: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (values: T[]) => void;
}) {
  const id = useId();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={`${name}-filter`}>
          {label}
          {selected.length ? ` (${selected.length})` : ""}
          <ChevronDown aria-hidden="true" className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <input
        type="hidden"
        name={name}
        value={selected.join(",")}
        disabled={!selected.length}
      />
      <PopoverContent
        align="start"
        collisionPadding={16}
        aria-label={`Filter by ${name}`}
        className="max-w-[calc(100vw-2rem)]"
      >
        <fieldset className="space-y-1">
          <legend className="mb-2 text-xs text-muted-foreground">
            {legend}
          </legend>
          {options.map((option) => (
            <label
              key={option.value}
              htmlFor={`${id}-${option.value}`}
              className="flex cursor-pointer items-center gap-2 rounded-sm py-2 text-sm"
            >
              <Checkbox
                id={`${id}-${option.value}`}
                checked={selected.includes(option.value)}
                onCheckedChange={(checked) =>
                  onChange(
                    options
                      .filter(({ value }) =>
                        value === option.value
                          ? checked === true
                          : selected.includes(value),
                      )
                      .map(({ value }) => value),
                  )
                }
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        {selected.length ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => onChange([])}
          >
            Clear all
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
