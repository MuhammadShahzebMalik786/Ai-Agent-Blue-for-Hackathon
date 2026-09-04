# Ai agent Blue — Pitch

Alibaba Cloud AI Hackathon Pakistan 2026 · Open Innovation · Solo · Muhammad Shahzeb Malik

---

## One-paragraph version

Everyone loses hours to repetitive web work: researching across a dozen tabs, copying
data between sites, filling forms, triaging email, compiling notes into a doc. Existing
"AI browser" tools make you hand your logged-in accounts to a cloud service, or need a
developer to set up, or only run on expensive frontier models. **Ai agent Blue** is a
Chrome extension that does the work in *your* browser: you type a goal in plain English,
it plans the task, then clicks, types, navigates and carries data across tabs until it's
done. Your sessions, your machine, your API key. It runs on a free model tier, or fully
on-device with Chrome's built-in Gemini Nano so nothing leaves your computer at all.

---

## Slide outline

### 1. Title
Ai agent Blue — *an AI agent that operates your browser.*
Type a goal. It does the rest.

### 2. The problem
- Knowledge work lives in the browser, and a lot of it is repetitive multi-step drudgery:
  cross-tab research, copy-paste between sites, form filling, inbox triage, compiling notes.
- It breaks focus and eats hours a week.
- **Who it affects:** students, researchers, analysts, support teams, solo founders — anyone
  whose job is a browser.

### 3. Why existing tools don't fit
| Approach | The catch |
|---|---|
| Cloud "AI browser" services | You hand over your logged-in accounts to a third party |
| Dev frameworks (Playwright + LLM) | Needs a developer and a server to run |
| Frontier-model agents | Expensive; overkill; still cloud |

### 4. Our solution
A Manifest V3 Chrome extension. A side panel where you write a goal. The agent:
1. **Plans** the task into a checklist + the data it needs to collect.
2. **Acts** — one action per step, reading each page as a numbered list of elements.
3. **Remembers** — captures text into named slots, injects it into other fields later.
4. **Checks in** — pauses for your OK before anything irreversible; asks when genuinely unsure.

Runs in your browser, on your machine, with your key. Nothing to host.

### 5. Live demo (2–3 minutes)
> "Open Notion, ClickUp and Todoist pricing in separate tabs, pull each tool's free plan,
> cheapest paid price and standout feature, ask Gemini for a recommendation for a 5-person
> startup, and put it all in a new Google Doc."

Show, on screen: the plan appears → the 💭 reasoning → the memory slots filling one by one
→ tabs opening → the finished Google Doc. Hands never touch the keyboard.

### 6. The need it addresses
- **Privacy:** page text goes only to the model you pick. No third-party account access.
  On-device mode: nothing leaves the machine.
- **Cost:** runs on free API tiers, or entirely free on-device. No subscription.
- **Access:** no developer, no server, no cloud account. Install and type.

### 7. Innovation — engineered for a *small* model
The design assumes a weak, cheap model and compensates, so it runs on free tiers and on-device:
- **Text-only page understanding.** No vision model, no screenshots — works with any text LLM.
- **Structured memory.** Captured content never passes back through the model's token limit,
  so it can't be paraphrased or truncated. It's resolved in the background and injected directly.
- **Per-step reasoning** + a small thinking budget keeps element choice steady.
- **Self-recovery:** stuck-loop breaker, JSON-repair retries, a service-worker watchdog, and
  full state checkpointing so a suspended background worker resumes mid-task.

### 8. Innovation — safety by construction
- **Prompt-injection boundary:** all page text is data, never instructions. A hostile page
  can't redirect the agent.
- **Human gate:** before a send / post / buy / delete, or closing your tabs, it pauses for
  approval. One toggle for full autonomy when you trust the task.
- **No dangerous actions exist:** there is no action for entering a password or solving a
  CAPTCHA — it hands control back to you.

### 9. The technology
- Manifest V3: side panel, service worker, `chrome.alarms` watchdog, `chrome.tabs` /
  `chrome.scripting`. Browser-level control (close tabs) a page script can't do.
- Sense→think→act loop; content script serialises the DOM, background runs the loop.
- **Multi-provider, bring-your-own-key:** Google Gemini, Chrome on-device Gemini Nano,
  **any OpenAI-compatible endpoint** (so it plugs into gateways and the wider model
  ecosystem), GitHub Models, Groq.

### 10. Feasibility — what's actually built
- A complete, working extension. ~4,000 lines. Not a prototype.
- Demonstrated end to end: multi-tab research → Google Doc, GitHub repo → doc explainer,
  email draft with an approval pause, tab cleanup, cross-site translate relay.
- Runs today on the free tier of `gemini-3.1-flash-lite`, or fully offline on Gemini Nano.
- Code: github.com/MuhammadShahzebMalik786/Ai-Agent-Blue-for-Hackathon
- Docs: `README.md`, `ARCHITECTURE.md`, `DEMO_PROMPTS.md` in the repo.

### 11. Roadmap
- Optional screenshot grounding for canvas / image-only UIs.
- Saved "recipes" — turn a one-off goal into a reusable one-click automation.
- A shared, rate-limited demo backend so anyone can try it with zero setup.

### 12. Close
Browser automation without the SaaS middleman.
Your browser. Your data. Your key. Type a goal.

---

## If you can only show one thing

Prompt #1 from `DEMO_PROMPTS.md` (the tool-comparison → Google Doc). It hits every point:
multi-tab, real data extraction, an AI-synthesis step, the memory slots visibly filling,
and a clean artifact at the end — the "automates tedious operations" claim, proven on camera.
