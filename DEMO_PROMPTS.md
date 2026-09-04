# Demo Prompts

Copy-paste goals for Ai agent Blue. Grouped by what they show off.

---

## Setup (once, before any run)

- Provider: **Google Gemini** · Model: **Gemini 3.1 Flash Lite**
- Start on a **blank tab** (`about:blank`) so the agent isn't reading old page content.
- Be logged into Google (Gemini, Docs, Gmail) in the same browser.
- Between runs, wait ~1 minute so the Gemini free tier isn't rate-limited.
- **Autonomous mode ON** for everything except the ones marked *(Autonomous OFF)*.

---

## Tier 1 — proven, use these for the submission video

### Tool comparison brief
*Shows: multi-tab, real data extraction, AI synthesis, structured output. Best match for the "automates SaaS operations" pitch.*

```
Build a comparison brief in a Google Doc. Autonomous — do not stop to ask; do not post or share anything.
1. In separate tabs, open notion.so/pricing , clickup.com/pricing , and todoist.com/pricing . Read each pricing page.
2. Save to memory, one key per tool (notion, clickup, todoist): free plan limit, cheapest paid price, one standout feature.
3. When the MEMORY list shows [x] for notion, clickup AND todoist, open gemini.google.com in a NEW TAB, give it the three tools' data, and ask for a neutral recommendation for a 5-person startup under 120 words. WAIT for the full answer, save it to memory.
4. Open docs.google.com/document/create , title it "Tool Comparison", and write:
   - a markdown table with one row for Notion, one for ClickUp, one for Todoist — columns: Tool | Free plan | Cheapest paid | Standout
   - the recommendation paragraph below it
5. Re-read the doc; if a tool row is missing, add it. Then say it is ready.
```

### GitHub repo explainer
*Shows: reading a long page, extracting specifics, clean formatting. Very reliable.*

```
Explain a GitHub repo in a Google Doc.
1. Go to github.com/microsoft/playwright . Read the README (scroll through it).
2. Save to memory: what it does in one sentence, the install command, and 3 key features.
3. Open docs.google.com/document/create , title it "Playwright Notes", and write: a one-line summary, an "Install" section with the command, and a bullet list of the 3 features.
4. Tell me it's ready.
```

### Bulletproof fallback (bad wifi / short on time)

```
Go to gemini.google.com, ask it to explain quantum computing in 100 words for a beginner, WAIT for the full response, then open docs.google.com/document/create and paste the explanation into the body with the title "Quantum Notes".
```

---

## Tier 2 — capability showcase (variety, not research-to-doc)

### Tab cleanup
*Shows: browser-level control a normal web-automation tool can't do. ~10 seconds. Good opener.*

```
Close every tab except this one and my pinned tabs. Then tell me how many you closed.
```

```
Close all my duplicate tabs.
```

### Email draft — the safety gate  *(Autonomous OFF)*
*Shows: the pause-for-approval banner. Talk about the guardrail here.*

```
Draft a reply to the newest email in my inbox. DO NOT send it.
1. Open mail.google.com , open the top email, read it.
2. Open gemini.google.com in a new tab, give it the email content, ask for a warm 3-sentence reply. WAIT for the full answer, save it to memory.
3. Back in Gmail, click Reply and paste the draft into the reply box.
4. Stop before clicking Send and ask me to review it.
```

### Cross-site relay — Gemini → Translate → Doc
*Shows: three tools, two languages, memory carrying content between all of them intact.*

```
1. Open gemini.google.com , ask it to write a 4-sentence product announcement for a new note-taking app. WAIT for the full answer, save it to memory.
2. Open translate.google.com , paste the announcement, translate it to Spanish, save the Spanish version to memory.
3. Open docs.google.com/document/create , title it "Announcement (EN + ES)", paste the English version, then the Spanish version below it.
4. Tell me it's ready.
```

### Form fill  *(make a Google Form first, 2-3 questions)*
*Shows: reading a form's structure and entering matching data.*

```
Open PASTE_YOUR_GOOGLE_FORM_URL and fill it in with sensible test answers, but DO NOT submit.
Read each question, enter an appropriate answer, then stop and tell me what you entered in each field.
```

### Add to cart, stop before buying  *(Autonomous OFF)*
*Shows: "asks before anything that spends money".*

```
Go to PASTE_A_SIMPLE_SHOP_URL , find a product under $20, add it to the cart, then STOP. Do not check out. Tell me what's in the cart and the total.
```

### GitHub issue triage
*Shows: reading a list, opening items, summarising.*

```
Go to github.com/microsoft/playwright/issues . Open the 5 newest open issues one at a time, and save each one's title + a one-line summary to memory. Then open docs.google.com/document/create , title it "Playwright — Recent Issues", and list the 5 items. Tell me it's ready.
```

### YouTube lookup
*Shows: search + navigate + extract on a heavy SPA.*

```
Search YouTube for "how transformers work explained". Open the top result, read the video description and the top comment, and tell me the channel name, the video length, and a one-line summary of the description.
```

### Repeat / loop  *(set Repeat = 3)*
*Shows: the run counter and per-run memory.*

```
Go to gemini.google.com and ask for one surprising fact about the ocean. WAIT for the answer, then save it to memory under a new key like ocean_fact_1, ocean_fact_2, etc. — one new key per run.
```

---

## Writing your own

- **Name exact sites.** `notion.so/pricing`, not "the pricing page".
- **Number the steps.**
- After any "ask an AI to write X" step, add **"WAIT for the full answer, then save it to memory."**
- Say what the final output is and where it goes.
- Add **"do not post / send / submit / buy"** if you only want a draft.
- One idea per memory key. If you're gathering 3 things, that's 3 keys.
- Turn **Autonomous mode OFF** for anything that touches your real accounts.
