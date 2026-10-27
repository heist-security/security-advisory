"use client";
import { useEffect, useId, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import {
  technologyFamily,
  technologyLabel,
  technologyMatches,
} from "@/domain/technology";
import type { TechnologyOption } from "@/domain/technology";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export function TechnologyFilter({
  selected: values,
  initialOptions,
  onChange,
}: {
  selected: string[];
  initialOptions: TechnologyOption[];
  onChange: (values: string[]) => void;
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState(initialOptions);
  const [optionsSearch, setOptionsSearch] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState(
    () => new Map(initialOptions.map((o) => [o.value, o.label])),
  );
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("Searching…");
      try {
        const response = await fetch(
          "/api/v1/technologies?q=" + encodeURIComponent(search),
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error();
        const result: { data: TechnologyOption[] } = await response.json();
        if (controller.signal.aborted) return;
        setLabels(
          (previous) =>
            new Map([
              ...previous,
              ...result.data.map((o) => [o.value, o.label] as const),
            ]),
        );
        setOptions(result.data);
        setOptionsSearch(search);
        setStatus(
          result.data.length
            ? ""
            : "No suggestions. Enter a product name to add it.",
        );
      } catch {
        if (!controller.signal.aborted)
          setStatus(
            "Suggestions unavailable. You can still enter a product name.",
          );
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, open]);
  const key = technologyFamily(search);
  const matches =
    optionsSearch === search
      ? options
      : options.filter((o) => technologyMatches(o.value, search));
  const custom =
    key &&
    key.length <= 100 &&
    !values.includes(key) &&
    !matches.some((o) => o.value === key);
  const add = () => {
    if (custom && values.length < 10) {
      setLabels((previous) =>
        new Map(previous).set(key, technologyLabel(key) ?? search.trim()),
      );
      onChange([...values, key]);
      setSearch("");
    }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="technology-filter">
          Technology{values.length ? ` (${values.length})` : ""}
          <ChevronDown aria-hidden="true" className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <input
        type="hidden"
        name="technology"
        value={values.join(",")}
        disabled={!values.length}
      />
      <PopoverContent
        align="start"
        collisionPadding={16}
        aria-label="Filter by technology"
        className="w-80 max-w-[calc(100vw-2rem)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto"
      >
        <Input
          type="search"
          aria-label="Search technologies"
          placeholder="Search technologies…"
          maxLength={100}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        {values.length ? (
          <div
            className="flex flex-wrap gap-1.5 pt-3"
            aria-label="Selected technologies"
          >
            {values.map((value) => (
              <Button
                key={value}
                type="button"
                variant="secondary"
                size="xs"
                className="h-auto max-w-full whitespace-normal py-1 text-left [overflow-wrap:anywhere]"
                aria-label={
                  "Remove " +
                  (technologyLabel(value) ?? labels.get(value) ?? value)
                }
                onClick={() => onChange(values.filter((v) => v !== value))}
              >
                {technologyLabel(value) ?? labels.get(value) ?? value}{" "}
                <X aria-hidden="true" />
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => onChange([])}
            >
              Clear all
            </Button>
          </div>
        ) : null}
        <div
          className="mt-2 max-h-56 overflow-y-auto"
          role="group"
          aria-label="Technologies"
        >
          {matches.map((o) => (
            <label
              key={o.value}
              htmlFor={`${id}-${o.value}`}
              className="flex cursor-pointer items-center gap-2 rounded-sm py-2 text-sm break-words has-disabled:cursor-not-allowed has-disabled:opacity-50"
            >
              <Checkbox
                id={`${id}-${o.value}`}
                checked={values.includes(o.value)}
                disabled={values.length >= 10 && !values.includes(o.value)}
                onCheckedChange={(checked) =>
                  onChange(
                    checked === true
                      ? [...values, o.value]
                      : values.filter((v) => v !== o.value),
                  )
                }
              />
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {o.label}
              </span>
            </label>
          ))}
        </div>
        {custom ? (
          <Button
            variant="secondary"
            size="sm"
            className="mt-2 h-auto max-w-full whitespace-normal py-2 text-left [overflow-wrap:anywhere]"
            type="button"
            disabled={values.length >= 10}
            onClick={add}
          >
            <Plus aria-hidden="true" />
            Add “{search.trim()}”
          </Button>
        ) : null}
        <p className="mt-3 text-xs text-muted-foreground" role="status">
          {values.length >= 10
            ? "10 technologies selected (maximum)."
            : status || "Matches any selected technology."}
        </p>
      </PopoverContent>
    </Popover>
  );
}
