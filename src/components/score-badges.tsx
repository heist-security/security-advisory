"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { FeedItem } from "@/domain/feed-item";
import { epssPercent, loadEpss, type EpssScores } from "@/presentation/epss";
import { Badge } from "./ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

const EpssContext = createContext<EpssScores>({});
const ActiveTooltipContext = createContext<{
  active: string | null;
  setActive: Dispatch<SetStateAction<string | null>>;
}>({ active: null, setActive: () => {} });

export function ScoreProvider({
  cves,
  children,
}: {
  cves: string[];
  children: ReactNode;
}) {
  const key = cves.join(",");
  const [result, setResult] = useState<{ key: string; scores: EpssScores }>();
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void loadEpss(key ? key.split(",") : [], controller.signal).then(
      (scores) => {
        if (!controller.signal.aborted) setResult({ key, scores });
      },
    );
    return () => controller.abort();
  }, [key]);
  return (
    <EpssContext.Provider value={result?.key === key ? result.scores : {}}>
      <ActiveTooltipContext.Provider value={{ active, setActive }}>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </ActiveTooltipContext.Provider>
    </EpssContext.Provider>
  );
}

function ScoreBadge({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  const { active, setActive } = useContext(ActiveTooltipContext);
  const open = active === id;
  const setOpen = (value: boolean) => {
    setActive((previous) => (value ? id : previous === id ? null : previous));
  };
  const pointerStartedOpen = useRef(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        asChild
        onPointerEnter={(event) => {
          // Adjacent badges must switch explanations even while the pointer is
          // in Radix's grace area for the previous tooltip.
          if (event.pointerType !== "touch") setOpen(true);
        }}
        onPointerDown={() => {
          pointerStartedOpen.current = open;
        }}
        onClick={(event) => {
          event.preventDefault();
          // Touch can focus the trigger before click, opening the tooltip.
          // Toggle from the state before the tap, not that intermediate state.
          setOpen(event.detail === 0 || !pointerStartedOpen.current);
        }}
      >
        <Badge
          asChild
          variant="outline"
          className="cursor-help border-border bg-muted font-normal text-muted-foreground tabular-nums"
        >
          <button type="button">{label}</button>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}

export function ScoreBadges({
  cvss,
  cves,
}: {
  cvss: FeedItem["cvss"];
  cves: string[];
}) {
  const scores = useContext(EpssContext);
  const available = cves.flatMap((id) => (scores[id] ? [scores[id]!] : []));
  const highest = available.reduce<(typeof available)[number] | null>(
    (max, score) => (!max || score.epss > max.epss ? score : max),
    null,
  );
  const loading = cves.some((id) => scores[id] === undefined);
  const epss = loading ? "…" : highest ? epssPercent(highest.epss) : "—";
  return (
    <>
      <ScoreBadge label={"CVSS " + (cvss ? cvss.score.toFixed(1) : "—")}>
        <p>
          CVSS rates technical severity from 0 to 10 based on how a
          vulnerability can be exploited and its potential impact. Higher means
          more severe.
        </p>
        <p className="mt-2 text-muted-foreground">
          {cvss
            ? `Highest available rating: ${cvss.score.toFixed(1)}/10 · CVSS v${cvss.version} · ${cvss.source}.`
            : "No CVSS score is available for this item."}
        </p>
      </ScoreBadge>
      <ScoreBadge label={(cves.length > 1 ? "EPSS max " : "EPSS ") + epss}>
        <p>
          EPSS estimates the chance a vulnerability will be used in real attacks
          in the next 30 days. This global forecast is updated daily; your
          system’s risk also depends on how you use the affected software.
        </p>
        <p className="mt-2 text-muted-foreground">
          {loading
            ? "Loading the latest available score from FIRST."
            : highest
              ? `${highest.cve} · Score date: ${highest.date} · Source: FIRST EPSS.${cves.length > 1 ? ` Highest available score; ${available.length} of ${cves.length} CVEs have scores.` : ""}`
              : cves.length
                ? "No EPSS score is available right now."
                : "EPSS requires a CVE identifier; this item has none."}
        </p>
      </ScoreBadge>
    </>
  );
}
