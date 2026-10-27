"use client";
import { useEffect, useId, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { technologyFamily, technologyLabel } from "@/domain/technology";
import type { TechnologyOption } from "@/domain/technology";
import type { TechnologyPage } from "@/application/ports";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export function TechnologyFilter({
  selected: values,
  onChange,
}: {
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const id = useId();
  const [request, setRequest] = useState<{ q: string; after?: string }>({
    q: "",
  });
  const search = request.q;
  const [options, setOptions] = useState<TechnologyOption[]>([]);
  const [optionsSearch, setOptionsSearch] = useState("");
  const [nextAfter, setNextAfter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState(() => new Map<string, string>());
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        setStatus(request.after ? "Loading more…" : "Searching…");
        const params = new URLSearchParams({ q: request.q, limit: "20" });
        if (request.after) params.set("after", request.after);
        try {
          const response = await fetch("/api/v1/technologies?" + params, {
            signal: controller.signal,
          });
          if (!response.ok) throw new Error();
          const result: TechnologyPage = await response.json();
          if (controller.signal.aborted) return;
          setLabels(
            (previous) =>
              new Map([
                ...previous,
                ...result.data.map((o) => [o.value, o.label] as const),
              ]),
          );
          setOptions((previous) =>
            request.after ? [...previous, ...result.data] : result.data,
          );
          setOptionsSearch(request.q);
          setNextAfter(result.next_after ?? null);
          setStatus(
            result.data.length || request.after
              ? ""
              : "No suggestions. Enter a product name to add it.",
          );
        } catch {
          if (!controller.signal.aborted) {
            setFailed(true);
            setStatus(
              "Suggestions unavailable. You can still enter a product name.",
            );
          }
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      request.after ? 0 : 200,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [request, open]);
  const load = (q: string, after?: string) => {
    setRequest({ q, after });
    setLoading(true);
    setFailed(false);
    setStatus("");
    if (!after) setNextAfter(null);
  };
  const key = technologyFamily(search);
  const matches = optionsSearch === search ? options : [];
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
      load("");
    }
  };
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) load(search);
      }}
    >
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
          onChange={(event) => load(event.target.value)}
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
          aria-busy={loading}
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
        {(optionsSearch === search && nextAfter) || failed ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            disabled={loading}
            onClick={() =>
              load(search, failed ? request.after : (nextAfter ?? undefined))
            }
          >
            {loading ? "Loading…" : failed ? "Retry suggestions" : "Load more"}
          </Button>
        ) : null}
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
