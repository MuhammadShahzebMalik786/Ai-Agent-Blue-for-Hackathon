# Ai agent Blue

**An AI agent that operates your browser. You type a goal in plain English; it plans the task, then clicks, types, navigates, and carries data across tabs until the job is done.**

A Manifest V3 Chrome extension. Bring your own API key (or run fully on-device). Built by Muhammad Shahzeb Malik.

---

## What it does

You open the side panel, write something like:

> Open notion.so/pricing, clickup.com/pricing and todoist.com/pricing in separate tabs, pull each tool's free plan, cheapest paid price and standout feature, ask Gemini for a recommendation for a 5-person startup, then put it all in a new Google Doc titled "Tool Comparison".

The agent:

1. **Plans** — turns the goal into an ordered checklist and a set of memory slots (the distinct pieces of data it needs to collect).
2. **Acts** — reads the current page as a numbered list of elements, decides one action, executes it, repeats. Navigate, click, type, scroll, open tabs, close tabs.
3. **Remembers** — extracts text from pages and AI responses into named slots, then injects the full content into other fields later without ever retyping it.
4. **Checks in** — pauses for your approval before anything irreversible (post, send, buy, delete), and asks you a question when a choice is genuinely ambiguous.
5. **Finishes** — tells you when it's done and where the result is.

It works on any website through the DOM. Google Search, GitHub, Gmail, Gemini, LinkedIn, pricing pages, news sites, docs — all the same mechanism.

## Features

| Feature | What it means |
|---|---|
| **Task planner** | One up-front reasoning pass produces a numbered plan + the data slots the task needs. Shown in the panel, checked off as it goes. |
| **Structured memory** | Data lives in named slots (`notion_pricing`, `summary`, …), one per piece. Content is injected into fields via `TYPE_FROM_MEMORY`, never re-typed by the model, so nothing gets paraphrased or truncated. |
| **Per-step reasoning** | Every action carries a `think` field (shown as 💭) plus a model-side thinking budget — a small model stays steady on element choice. |
| **Safety gate** | Before a send / post / submit / buy / delete / publish click, or closing your tabs, it pauses for approval. Toggle **Autonomous mode** to skip. |
| **Human-in-the-loop** | When the agent needs your input, a banner appears with a text box. Type an answer, hit Resume, and it's fed into the agent's context as an instruction. |
| **Prompt-injection hardening** | The agent treats all page text as data, never instructions. A malicious page can't redirect it. |
| **Crash recovery** | If Chrome suspends the service worker mid-task, the agent restores its state and continues. A stalled loop self-restarts. |
| **Stuck-loop breaker** | If the model repeats a dead action, the agent forces a different move, and stops cleanly if it's truly stuck. |
| **Voice input** | Dictate the goal instead of typing. |
| **Repeat** | Run the whole task N times. |
| **Multi-provider** | Google Gemini, Chrome's on-device Gemini Nano, any OpenAI-compatible endpoint, GitHub Models, Groq. |

## Providers

All bring-your-own-key. Your key is stored in `chrome.storage.local` and sent only to that provider.

| Provider | Key | Notes |
|---|---|---|
| **Google Gemini** | `AIza…` from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Recommended: `gemini-3.1-flash-lite` — fast, cheap, reliable at the agent's JSON. |
| **Chrome Built-in AI** | none | On-device Gemini Nano. Zero key, zero cost, zero limit. Needs Chrome 138+ with two flags enabled (the panel tells you). Small context window — best for planning and simple pages. |
| **Custom (OpenAI-compatible)** | `sk-…` + a Base URL | Point it at OmniRoute, LiteLLM, OpenRouter, Ollama, LM Studio, anything speaking the OpenAI chat API. |
| **GitHub Models** | `github_pat_…` | GPT-4o-mini, Llama, Mistral. |
| **Groq** | `gsk_…` | Fast Llama inference. |

## Install

1. `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Click the extension icon. The side panel opens on the right.
4. Pick a provider, paste your key (or pick Chrome Built-in AI), choose a model.
5. Type a goal, click **Start Agent**.

Requires **Chrome 138+** (for the side panel and, optionally, on-device AI).

### Optional: local defaults

Copy `env.example.js` to `env.js` and fill in your provider / key / model. The panel pre-fills from it on first open. `env.js` is git-ignored — do not commit or share it.

## Usage

**Writing a good goal:**

- Name the exact sites (`notion.so/pricing`, not "the pricing page").
- Number the steps.
- Say **"WAIT for the full response"** after any step that asks an AI to generate text.
- Say what the final output is and where it goes.
- Say **"do not post / send / share"** if you only want a draft.
- Turn **Autonomous mode** off if the task touches your real accounts (email, social).

**Example goals that work well:**

```
Explain a GitHub repo in a Google Doc.
1. Go to github.com/microsoft/playwright and read the README.
2. Save to memory: what it does in one sentence, the install command, 3 key features.
3. Open docs.google.com/document/create, title it "Playwright Notes", write a one-line
   summary, an Install section with the command, and a bullet list of the 3 features.
4. Tell me it's ready.
```

```
Draft a reply to my newest email, but DO NOT send it.
1. Open mail.google.com, open the newest email, read it.
2. In a new tab, use gemini.google.com to draft a polite 3-sentence reply. WAIT, save it.
3. Back in Gmail, click Reply and paste the draft.
4. Stop before Send — ask me to review.
```

**The panel shows, live:** the plan with checkmarks, the 💭 reasoning, the memory slots filling (`●` filled / `○` empty), and a full action log.

## Project layout

| File | Role |
|---|---|
| `manifest.json` | MV3 manifest. Side panel, `<all_urls>` + localhost host permissions. |
| `background.js` | The **brain** — service worker. Planner, agent loop, LLM calls, memory, safety gate, crash recovery. |
| `content.js` | The **eyes and hands** — injected into every page. Builds the numbered element snapshot, executes clicks/typing, extracts text. |
| `popup.html` / `popup.js` / `popup.css` | The side-panel UI. |
| `mic-permission.html` / `mic-permission.js` | One-time microphone permission page for voice input. |
| `env.example.js` | Template for local defaults (`env.js` is git-ignored). |
| `models.json` | Reference list of default models per provider. |
| `landing.html` | Marketing page. |

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full agent loop, the DOM snapshot format, the memory model, and the design trade-offs.

Short version:

```
┌──────────────┐   goal    ┌───────────────────────── background.js ─────────────────────────┐
│  Side panel  │──────────▶│  plan()  →  loop:  read DOM → ask LLM → execute → repeat         │
│ (popup.*)    │◀──────────│                        │            │           │                │
└──────────────┘  log/plan │                   ┌────┘       ┌────┘      ┌─────┘                │
                  /memory  │              LLM provider   content.js   chrome.tabs / scripting  │
                           │            (Gemini / Nano / │  (per tab) │                        │
                           │             OpenAI-compat)  │            │                        │
                           └─────────────────────────────┴────────────┴────────────────────────┘
```

Every step: the content script serialises the visible page into a numbered list of elements. The LLM gets that list + the goal + the plan + the compact memory view, and returns one JSON action. The background executes it and loops. Data captured from pages is stored server-side (in the worker) and injected into fields directly, so it never has to pass back through the model's token limit.

## Privacy

- Keys and task state live in `chrome.storage.local` on your machine.
- Page content is sent to your chosen LLM provider (or stays on-device with Chrome Built-in AI).
- Nothing is sent anywhere else. No analytics, no servers.

## Known limits

- Canvas-based editors (Google Docs / Sheets bodies) work but are fiddly — the agent pastes in chunks to get around it.
- CAPTCHAs and login walls stop the agent — it pauses and asks you to handle them.
- Very long infinite-scroll feeds can exceed the page-snapshot budget.
- On-device Gemini Nano has a small context window; use it for planning and simple pages, a cloud model for heavy multi-tab work.
