# Extraction evaluation

The default fixtures are deliberately synthetic and contain no upstream copyrighted article text. They test basic relevance, no-CVE patches, attribution, severity and hostile instructions. Passing them is a smoke test, not evidence of production accuracy.

Use a dedicated provider project with spending limits. Select the model explicitly in OPENAI_MODEL and run:

    npm run eval:live -- --allow-paid

The command does not run without --allow-paid. It writes evaluation-results.json with the selected model, timestamp, pass/fail results and extracted output. Record token usage and currency cost separately from the provider dashboard. No provider credentials are written.

For the launch gate, supply at least 100 representative, manually labeled announcements:

    npm run eval:live -- --allow-paid --fixtures=/absolute/path/cases.json --launch

Each case has id, text and expected, including security_relevant and optionally kind, product, fixed_version, cves and severity. Set cves to an empty array to assert that none are invented. Include known negatives, multiple products with different fixed versions, explicit withdrawals, short notices, non-English announcements, ambiguous severity and prompt-injection text. Keep source URLs, acquisition dates and permissions in your separately reviewed dataset.

Review titles and summaries manually as well: exact-quote checks do not prove their correctness. Evaluate false positives/negatives and product-version association separately, and record actual provider cost. The automated gate fails if a case fails; decide and document broader production quality thresholds on the real dataset, rather than treating this small fixture schema as a complete benchmark.

Repeat evaluation on prompt/schema/model changes. Do not automatically publish evaluation output as live events.
