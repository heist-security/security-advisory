import { createHash } from "node:crypto";
import type { Item } from "rss-parser";
import type { SourceReader } from "../../application/ports";
import {
  sourceSchema,
  parseFeed,
  itemUrl,
  documentText,
  NoReleaseNotesError,
} from "./publisher";
import { fetchResource } from "../http";
import { isStructured } from "./structured/config";
import { discover } from "./structured/discover";
import {
  structuredDocument,
  readStructuredDocument,
} from "./structured/documents";
import { extract } from "../openai/extractor";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const sourceReader: SourceReader = {
  async discover(job) {
    if (isStructured(job.id)) {
      const result = await discover(job.id, job.checkpoint);
      return {
        entries: result.items.map((item) => ({
          url: item.link,
          fingerprint: hash(JSON.stringify(item)),
          item,
          feed_title: job.id,
        })),
        checkpoint: result.state,
        not_modified: false,
      };
    }
    const source = sourceSchema.parse(job.definition);
    const resource = await fetchResource(
      source.feed_url,
      source.allowed_origins,
      {
        ...(source.adapter === "feed-content"
          ? { etag: job.etag, last_modified: job.last_modified }
          : {}),
        max_bytes: source.max_feed_bytes,
      },
    );
    if (resource.text === null)
      return {
        entries: [],
        etag: resource.etag,
        last_modified: resource.last_modified,
        not_modified: true,
      };
    const feed = await parseFeed(resource.text);
    if (!feed.items.length || feed.items.length > 20000)
      throw new Error("Invalid feed entry count");
    const entries = new Map<
      string,
      { url: string; fingerprint: string; item: Item; feed_title: string }
    >();
    let rejected_entries = 0;
    for (const item of feed.items) {
      let url: string;
      try {
        url = itemUrl(source, item);
      } catch {
        rejected_entries++;
        continue;
      }
      const title = feed.title ?? source.name;
      if (!entries.has(url))
        entries.set(url, {
          url,
          fingerprint: hash(JSON.stringify([item, title])),
          item,
          feed_title: title,
        });
    }
    return {
      entries: [...entries.values()],
      rejected_entries,
      etag: rejected_entries ? null : resource.etag,
      last_modified: rejected_entries ? null : resource.last_modified,
      not_modified: false,
    };
  },
  async collect(job) {
    let body = "",
      published: string | null = null,
      skipped = false;
    if (isStructured(job.source_id)) {
      const result = await structuredDocument(job.source_id, job.item);
      body = result.body;
      published = result.published;
    } else {
      try {
        body = (
          await documentText(
            sourceSchema.parse(job.definition),
            job.item as Item,
            job.feed_title,
          )
        ).body;
      } catch (error) {
        if (error instanceof NoReleaseNotesError) skipped = true;
        else throw error;
      }
      const date = (job.item as Item).isoDate;
      if (date && Number.isFinite(Date.parse(date)))
        published = new Date(date).toISOString();
    }
    return { body, hash: hash(body), published_at: published, skipped };
  },
  async normalize(job) {
    if (isStructured(job.source_id))
      return {
        payload: readStructuredDocument(job).payload,
        method: "structured",
        model: `structured:${job.source_id.slice(5)}:1`,
      };
    return {
      payload: await extract(job.body),
      method: "llm",
      model: process.env.OPENAI_MODEL!,
    };
  },
};
