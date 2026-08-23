# Voice Shopping Assistant

A voice-based shopping list manager with smart suggestions. Speak naturally to add,
remove, modify, and search items in English, Hindi, or Telugu — the app parses the
command, categorizes the item, and surfaces suggestions that actually adapt to what's
in your cart.


---

## Tech Stack

| Layer            | Technology                                              |
| ----------------- | -------------------------------------------------------- |
| Frontend          | Vanilla HTML/CSS/JS (no build step, no framework)        |
| NLP engine        | Standalone module (`public/js/nlp.js`), unit-tested      |
| Voice recognition | Web Speech API (browser-native)                          |
| Testing           | Node's built-in test runner — zero dependencies          |
| Server            | Node.js + Express (static file server, for Docker)       |
| Container         | Docker (multi-stage) + Docker Compose                    |
| CI                | GitHub Actions                                           |
| Deployment        | Vercel                                                   |

No database, no API keys, and no LLM calls are required. The NLP is implemented as a
fast, rule-based local engine without an external NLP API.
---

## Testing

The NLP engine (`public/js/nlp.js`) is a standalone module, not buried in the page —
so it has a real, runnable test suite:

```bash
npm test
```

21 tests, zero install required (Node's built-in test runner, not Jest — nothing to
fail to resolve from a registry). Every test documents the actual bug it was written
to catch — order-independent parsing, Hindi/Telugu verb-stem conjugations, zero-width
Unicode artifacts from ASR, brand resolution, fuzzy-typo tolerance, and a false-positive
regression in the fuzzy matcher itself. See `tests/nlp.test.js`.

---

## 🌐 Live Application

**Live Demo:** https://vsa-7.vercel.app/

**GitHub Repository:** https://github.com/pranathi-05936/VSA_7

## Local Setup

### Prerequisites

- Node.js 20+
- npm
- (optional) Docker Desktop

### 1. Clone and install

```bash
git clone https://github.com/pranathi-05936/VSA_7.git
cd VSA_7
npm install
```

### 2. Start the dev server

```bash
npm start
```

Open <http://localhost:3000> in Chrome or Edge (best Web Speech API support).

---

## Running with Docker

### Local development

```bash
docker compose up --build
```

The app is available at `http://localhost:3000`.

### Build and run the image directly

```bash
docker build -t voice-shopping-assistant .
docker run -p 3000:3000 voice-shopping-assistant
```


---
## ☁️ Production Deployment

The application is deployed on **Vercel**.

### Deployment

The project is connected to GitHub and deployed through Vercel. Every new push to the `main` branch can trigger a new production deployment automatically.

### Production App

🌐 **Live Application →** https://vsa-7.vercel.app/

### GitHub Repository

💻 **Source Code →** https://github.com/pranathi-05936/VSA_7

### Docker Support

The project also includes a `Dockerfile` and `docker-compose.yml` for containerized
local execution. Docker is provided as an optional way to run the application locally.

## Project Structure

```
.
├── .github/workflows/
│   ├── docker-publish.yml     # CI: automated Docker image build
├── public/
│   ├── index.html             # UI, state, speech recognition, rendering
│   └── js/nlp.js              # standalone NLP engine — catalog, parsing, matching
├── tests/
│   └── nlp.test.js            # 21 tests against the real nlp.js module
├── server.js                  # Express static file server (for Docker)
├── package.json
├── Dockerfile                 # multi-stage Node build
├── docker-compose.yml
├── .dockerignore
├── .gitignore
├── README.md
└── APPROACH.md                # 200-word approach write-up
```

`public/js/nlp.js` has no DOM or speech-API dependency — it's pure catalog/parsing
logic, loaded by the page via `<script src="js/nlp.js">` and required directly by the
test suite. This split is what makes the NLP layer independently testable instead of
buried inside a single HTML file's inline script.

---

## How It Works

| Feature              | Approach                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| Voice input           | Browser `SpeechRecognition`, interim + final results, language picker for multilingual input                 |
| NLP                   | Order-independent trigger scan across English/Hindi/Telugu/Spanish/French — not anchored to sentence start, so rephrasing and word order don't break it |
| Catalog matching       | Exact → word-boundary-safe substring → edit-distance fuzzy fallback (typo/ASR-mishearing tolerant); 75 items across 8 categories, 26 branded SKUs generated from a data table |
| Size vs. quantity      | "1 liter milk" parses size (1L) separately from item count — not confused with "add 2 milk"                |
| Smart suggestions      | Adapts to the actual cart: pairing suggestions ("add pasta" → offers ketchup) take priority, then simulated purchase-cadence "running low", then seasonal, then a staples fallback so the rail is never empty |
| Modify                 | "change milk to 3" sets quantity directly — distinct from add/remove per the spec                            |
| Categorization         | Each catalog item carries a category; list view groups and re-sorts live                                    |
| Search & price filter  | "find toothpaste under $5" parses into item query + max price + brand, rendered as a results panel with one-tap add |
| Error handling         | No `SpeechRecognition` support, mic permission denial, no-speech timeout, unrecognized commands all show a specific message; text-input fallback always works |
| Accessibility          | Visible focus rings, `aria-live` caption region, `aria-pressed` mic state, reduced-motion respected          |

---

## Features Implemented

| Feature                              | Status |
| ------------------------------------- | ------ |
| Voice command recognition             | ✅      |
| Natural language phrasing flexibility | ✅      |
| Multilingual voice input              | ✅      |
| Product recommendations (running low) | ✅      |
| Seasonal recommendations              | ✅      |
| Substitute suggestions                | ✅      |
| Add / remove / modify by voice        | ✅      |
| Auto-categorization                   | ✅      |
| Quantity parsing                      | ✅      |
| Voice-activated search                | ✅      |
| Price range filtering                 | ✅      |
| Minimalist, mobile-optimized UI       | ✅      |
| Visual feedback / loading states      | ✅      |
| Error handling                        | ✅      |
| Dockerfile + docker-compose           | ✅      |
| GitHub Actions                         | ✅      |
| README + approach write-up            | ✅      |
