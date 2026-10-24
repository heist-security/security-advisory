-- Bootstrap the structured-only production feed through the existing release workflow.
-- Fixed operator-approved start: one calendar month before 24 October 2026 (UTC).
-- CVE snapshot: CVEProject/cvelistV5 commit c21430318b4b48252dd6ba344df26d60e6354f12.
-- Keep hosting cron paused until replacement credentials and hosted checks are complete.
-- Existing cursors, leases, queues and publications must survive an upgrade/retry.
insert into public.sources (
  id, name, feed_url, allowed_origins, category, channel, adapter,
  homepage, discovery_url, rationale, limitations, item_url_prefix,
  poll_interval_minutes, max_feed_bytes, verification, enabled
)
select r.id, r.name, r.feed_url,
  array(select jsonb_array_elements_text(r.allowed_origins)),
  r.category, r.channel, r.adapter, r.homepage, r.discovery_url,
  r.rationale, r.limitations, r.item_url_prefix,
  r.poll_interval_minutes, r.max_feed_bytes, r.verification, true
from jsonb_to_recordset($bootstrap$[
  {
    "category": "vulnerability-databases",
    "channel": "security-advisories",
    "adapter": "feed-content",
    "item_url_prefix": null,
    "poll_interval_minutes": 15,
    "max_feed_bytes": 10000000,
    "id": "core-osv",
    "name": "OSV",
    "feed_url": "https://storage.googleapis.com/osv-vulnerabilities/modified_id.csv",
    "homepage": "https://osv.dev",
    "discovery_url": "https://google.github.io/osv.dev/data/",
    "allowed_origins": [
      "https://storage.googleapis.com",
      "https://api.osv.dev",
      "https://osv.dev"
    ],
    "rationale": "Structured package advisories aggregated from ecosystem databases, including GitHub Advisory Database.",
    "limitations": "Incremental OSV changes since the configured start time; package ecosystems are not universal product coverage. Upstream licenses and attribution apply.",
    "verification": {
      "status": "configured",
      "sync": {
        "since": "2026-09-24T00:00:00Z"
      }
    }
  },
  {
    "category": "vulnerability-databases",
    "channel": "security-advisories",
    "adapter": "feed-content",
    "item_url_prefix": null,
    "poll_interval_minutes": 15,
    "max_feed_bytes": 10000000,
    "id": "core-cve",
    "name": "Official CVE List",
    "feed_url": "https://raw.githubusercontent.com/CVEProject/cvelistV5/main/cves/deltaLog.json",
    "homepage": "https://www.cve.org",
    "discovery_url": "https://github.com/CVEProject/cvelistV5",
    "allowed_origins": [
      "https://raw.githubusercontent.com",
      "https://www.cve.org"
    ],
    "rationale": "Published CVE records across software and hardware, preserving CNA affected-product and version semantics.",
    "limitations": "Rolling delta-log coverage only; an expired checkpoint requires an explicit historical backfill. A CVE record can be incomplete or rejected.",
    "verification": {
      "status": "configured",
      "sync": {
        "since": "2026-09-24T00:00:00Z",
        "cve_bootstrap_ref": "c21430318b4b48252dd6ba344df26d60e6354f12"
      }
    }
  },
  {
    "category": "vulnerability-databases",
    "channel": "security-advisories",
    "adapter": "feed-content",
    "item_url_prefix": null,
    "poll_interval_minutes": 15,
    "max_feed_bytes": 10000000,
    "id": "core-kev",
    "name": "CISA Known Exploited Vulnerabilities",
    "feed_url": "https://raw.githubusercontent.com/cisagov/kev-data/main/known_exploited_vulnerabilities.json",
    "homepage": "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
    "discovery_url": "https://github.com/cisagov/kev-data",
    "allowed_origins": [
      "https://raw.githubusercontent.com",
      "https://www.cisa.gov"
    ],
    "rationale": "Confirmed exploitation and required-action context from CISA's official machine-readable catalog.",
    "limitations": "KEV is a selected exploited subset, not a complete vulnerability feed. Federal due dates are not customer-specific patch deadlines.",
    "verification": {
      "status": "configured",
      "sync": {
        "since": "2026-09-24T00:00:00Z"
      }
    }
  }
]$bootstrap$::jsonb)
as r (
  id text, name text, feed_url text, allowed_origins jsonb, category text,
  channel text, adapter text, homepage text, discovery_url text,
  rationale text, limitations text, item_url_prefix text,
  poll_interval_minutes integer, max_feed_bytes integer, verification jsonb
)
on conflict (id) do update set
  name = excluded.name,
  feed_url = excluded.feed_url,
  allowed_origins = excluded.allowed_origins,
  category = excluded.category,
  channel = excluded.channel,
  adapter = excluded.adapter,
  homepage = excluded.homepage,
  discovery_url = excluded.discovery_url,
  rationale = excluded.rationale,
  limitations = excluded.limitations,
  item_url_prefix = excluded.item_url_prefix,
  poll_interval_minutes = excluded.poll_interval_minutes,
  max_feed_bytes = excluded.max_feed_bytes,
  enabled = true,
  verification = case
    when public.sources.verification #>> '{sync,since}' is not null
      then public.sources.verification
    else coalesce(public.sources.verification, '{}'::jsonb) || excluded.verification
  end;

-- Explicit structured-only launch selection; retain vendor history for later opt-in.
update public.sources set enabled = false
where id not in ('core-osv', 'core-cve', 'core-kev');
