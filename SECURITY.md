# Security policy

This project is alpha. Security fixes target the default branch.

## Private reporting

Do not disclose exploitable vulnerabilities in public issues or pull requests.

Use GitHub's **Security → Report a vulnerability** when private vulnerability reporting is enabled. If that option is unavailable, contact **hello@heisthq.com** (the address published at [heist.security/contact](https://heist.security/contact)) with the subject "Heist Feed: private security reporting channel" to arrange confidential disclosure. Do not include passwords, credentials, customer data or vulnerability details in that initial email.

Once a private channel is established, include the affected commit, impact, prerequisites and a minimal safe reproduction. Do not test third-party publishers, hosted databases or production availability without separate authorization. This policy does not promise a bounty or response-time SLA.

## Trust boundaries

- Feed XML, HTML and model output are untrusted. The model has no tools and receives no database or cron credentials.
- Operators approve source origins and repository path prefixes. Checks apply to every redirect. Arbitrary caller-supplied URLs are not fetched.
- Allowlisting is not DNS pinning. Self-hosted operators should deny private-network and metadata destinations at the egress layer; do not allow untrusted people to edit source configuration.
- Only the backend service role accesses raw source text, queues and RPCs. Anonymous and authenticated Supabase roles have no access.
- Public endpoints return bounded, cacheable data. Rate controls must also be configured at the hosting edge.
- Evidence validation proves textual support, not semantic accuracy or immunity to malicious publisher text. Corrections and reclassification events are part of the stream.
- Cron endpoints require a long bearer secret and fail closed when it is missing. Preview deployments must use a separate database and must not receive production cron or model credentials.
