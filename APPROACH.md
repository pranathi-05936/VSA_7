# Approach (194 words)

I built this as a single, dependency-free HTML file so it needs no build step, no API keys,
and no backend — it opens in a browser or deploys to any static host in one step.

**Voice + NLP:** The browser's native Web Speech API handles recognition (with a language
picker for multilingual input); a small regex-based intent parser turns transcripts into
`add` / `remove` / `find` commands, extracting quantities and stripping filler words so
"I want to buy two bottles of water" and "add 2 water" resolve the same way. This keeps
the app free and instant, at the cost of flexibility on unusual phrasing — a fallback text
input covers that gap and doubles as an accessibility path.

**Suggestions:** A simulated purchase-history cadence drives "running low" suggestions;
the current month drives seasonal ones; out-of-stock items automatically surface
substitutes instead of failing silently.

**UI:** A minimalist, receipt-styled list groups items by category, with visible
listening/processing states and specific error messages (no mic support, permission
denied, no speech, unrecognized command) rather than generic failures.

**Trade-off:** catalog, stock, and history are mocked in-memory; a production version
would swap these for a real inventory/orders API.
