"use client";
import { useEffect, useRef, useState } from "react";
import { technologyKey } from "@/lib/filters";
import type { TechnologyOption } from "@/lib/technology-options";

export function TechnologyFilter({
  selected = [],
  initialOptions,
}: {
  selected?: string[];
  initialOptions: TechnologyOption[];
}) {
  const [values, setValues] = useState(selected);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState(initialOptions);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const details = useRef<HTMLDetailsElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const labels = useRef(new Map(initialOptions.map((o) => [o.value, o.label])));
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (details.current && !details.current.contains(event.target as Node))
        details.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
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
        for (const o of result.data) labels.current.set(o.value, o.label);
        setOptions(result.data);
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
  const key = technologyKey(search);
  const matches = options.filter((o) => !key || o.value.includes(key));
  const custom =
    key &&
    key.length <= 100 &&
    !values.includes(key) &&
    !matches.some((o) => o.value === key);
  const add = () => {
    if (custom && values.length < 10) {
      labels.current.set(key, search.trim());
      setValues([...values, key]);
      setSearch("");
    }
  };
  return (
    <details
      className="technology-filter choice-filter"
      ref={details}
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
        if (event.currentTarget.open) input.current?.focus();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          details.current!.open = false;
          details.current?.querySelector("summary")?.focus();
        }
      }}
    >
      <summary>Technology{values.length ? ` (${values.length})` : ""}</summary>
      <input
        type="hidden"
        name="technology"
        value={values.join(",")}
        disabled={!values.length}
      />
      <div className="technology-menu">
        <input
          ref={input}
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
            className="selected-technologies"
            aria-label="Selected technologies"
          >
            {values.map((value) => (
              <button
                key={value}
                type="button"
                aria-label={"Remove " + (labels.current.get(value) ?? value)}
                onClick={() => setValues(values.filter((v) => v !== value))}
              >
                {labels.current.get(value) ?? value}{" "}
                <span aria-hidden="true">×</span>
              </button>
            ))}
            <button type="button" onClick={() => setValues([])}>
              Clear all
            </button>
          </div>
        ) : null}
        <div
          className="technology-options"
          role="group"
          aria-label="Technologies"
        >
          {matches.map((o) => (
            <label key={o.value}>
              <input
                type="checkbox"
                checked={values.includes(o.value)}
                disabled={values.length >= 10 && !values.includes(o.value)}
                onChange={(event) =>
                  setValues(
                    event.target.checked
                      ? [...values, o.value]
                      : values.filter((v) => v !== o.value),
                  )
                }
              />
              {o.label}
            </label>
          ))}
        </div>
        {custom ? (
          <button
            className="add-technology"
            type="button"
            disabled={values.length >= 10}
            onClick={add}
          >
            Add “{search.trim()}”
          </button>
        ) : null}
        <p className="technology-status" role="status">
          {values.length >= 10
            ? "10 technologies selected (maximum)."
            : status || "Matches any selected technology."}
        </p>
      </div>
    </details>
  );
}
