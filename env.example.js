// ─────────────────────────────────────────────────────────────
// Local defaults for the popup. COPY THIS FILE TO  env.js  and
// fill in your values. env.js is git-ignored and must NOT be
// shared / zipped with the submission — it only pre-fills the
// fields; everything still lives in chrome.storage after run 1.
// ─────────────────────────────────────────────────────────────

self.AGENT_ENV = {
  // Preselected provider: 'gemini' | 'custom' | 'chrome-ai' | 'groq' | 'github'
  provider: 'gemini',

  // Direct Gemini (provider 'gemini') — get a key at aistudio.google.com/apikey
  apiKey: 'AIza...',
  model: 'gemini-3.1-flash-lite',

  // OpenAI-compatible gateway (provider 'custom') — OmniRoute, LiteLLM, Ollama, …
  // For a LOCAL gateway prefer 127.0.0.1 over localhost (Chrome may pick IPv6).
  customBaseUrl: 'http://127.0.0.1:20128/v1',
  customApiKey: 'sk-...',
  customModel: 'gpt-4o-mini',
};
