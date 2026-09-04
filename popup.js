document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('api-key');
  const goalInput = document.getElementById('goal');
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  const logsContainer = document.getElementById('logs');
  const statusIndicator = document.getElementById('status-indicator');
  const memoryView = document.getElementById('memory-view');
  const providerSelect = document.getElementById('provider-select');
  const modelSelect = document.getElementById('model-select');
  const apiKeyLabel = document.getElementById('api-key-label');
  const stepCounter = document.getElementById('step-counter');
  const clearLogsBtn = document.getElementById('clear-logs-btn');
  const fetchModelsBtn = document.getElementById('fetch-models-btn');
  const humanBanner = document.getElementById('human-banner');
  const resumeBtn = document.getElementById('resume-btn');
  const humanBannerReason = document.getElementById('human-banner-reason');
  const humanAnswerInput = document.getElementById('human-answer');
  const micBtn = document.getElementById('mic-btn');
  const repeatCountInput = document.getElementById('repeat-count');
  const autonomousModeInput = document.getElementById('autonomous-mode');
  const planSection = document.getElementById('plan-section');
  const planList = document.getElementById('plan-list');
  const planThinking = document.getElementById('plan-thinking');
  const baseUrlInput = document.getElementById('base-url');
  const baseUrlSection = document.getElementById('base-url-section');
  const customModelInput = document.getElementById('custom-model');

  // Optional local defaults from env.js (git-ignored). See env.example.js.
  const ENV = (typeof self !== 'undefined' && self.AGENT_ENV) ? self.AGENT_ENV : {};

  let runInfo = { run: 1, total: 1 };

  let modelsByProvider = {
    gemini: [
      { value: 'gemini-3.5-flash-lite', text: 'Gemini 3.5 Flash-Lite (fast + cheap — recommended)' },
      { value: 'gemini-flash-lite-latest', text: 'Gemini Flash-Lite (latest alias)' },
      { value: 'gemini-3.6-flash', text: 'Gemini 3.6 Flash (smarter, slower)' },
      { value: 'gemini-flash-latest', text: 'Gemini Flash (latest alias)' }
    ],
    'chrome-ai': [
      { value: 'gemini-nano', text: 'Gemini Nano (on-device, no key, no limit)' }
    ],
    custom: [
      { value: '', text: '— set Base URL + key, then click Refresh —' }
    ],
    github: [
      { value: 'gpt-4o-mini', text: 'GPT-4o Mini (Fast, 150/day)' },
      { value: 'gpt-4o', text: 'GPT-4o (Smart, 50/day)' },
      { value: 'Meta-Llama-3-70B-Instruct', text: 'Llama 3 70B (Open)' },
      { value: 'Mistral-large', text: 'Mistral Large (Open)' }
    ],
    groq: [
      { value: 'llama-3.3-70b-versatile', text: 'Llama 3.3 70B Versatile' },
      { value: 'llama-3.1-8b-instant', text: 'Llama 3.1 8B Instant' },
      { value: 'llama3-70b-8192', text: 'Llama 3 70B' }
    ]
  };

  function updateModelOptions(selectedModel = null, fromUserChange = false) {
    const provider = providerSelect.value;
    modelSelect.innerHTML = '';
    (modelsByProvider[provider] || []).forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.value;
      opt.textContent = m.text;
      modelSelect.appendChild(opt);
    });

    if (selectedModel && (modelsByProvider[provider] || []).some(m => m.value === selectedModel)) {
      modelSelect.value = selectedModel;
    }

    const apiKeySection = apiKeyInput.closest('.section');
    const needsKey = provider !== 'chrome-ai';
    if (apiKeySection) apiKeySection.style.display = needsKey ? '' : 'none';
    fetchModelsBtn.style.display = needsKey ? '' : 'none';
    baseUrlSection.style.display = provider === 'custom' ? '' : 'none';

    // For custom: type the model name unless a real list was loaded via Refresh.
    const customListLoaded = (modelsByProvider.custom || []).some(m => m.value);
    const typeModel = provider === 'custom' && !customListLoaded;
    customModelInput.style.display = typeModel ? '' : 'none';
    modelSelect.style.display = typeModel ? 'none' : '';
    if (typeModel && selectedModel) customModelInput.value = selectedModel;

    if (provider === 'gemini') {
      apiKeyLabel.textContent = 'API Key (Gemini)';
      apiKeyInput.placeholder = 'AIza...';
    } else if (provider === 'github') {
      apiKeyLabel.textContent = 'API Key (GitHub Models)';
      apiKeyInput.placeholder = 'github_pat_...';
    } else if (provider === 'groq') {
      apiKeyLabel.textContent = 'API Key (Groq)';
      apiKeyInput.placeholder = 'gsk_...';
    } else if (provider === 'custom') {
      apiKeyLabel.textContent = 'API Key (Custom endpoint)';
      apiKeyInput.placeholder = 'sk-...';
    } else if (provider === 'chrome-ai' && fromUserChange) {
      checkChromeAI();
    }
  }

  // Report whether Chrome's on-device model is usable, in the logs.
  async function checkChromeAI() {
    const LM = (typeof LanguageModel !== 'undefined') ? LanguageModel : (self.LanguageModel || null);
    if (!LM) {
      logMessage('Chrome Built-in AI not detected. Needs Chrome 138+ with chrome://flags/#prompt-api-for-gemini-nano and #optimization-guide-on-device-model enabled, then restart.', 'error');
      return;
    }
    try {
      const a = await LM.availability({
        outputLanguage: 'en',
        expectedInputs: [{ type: 'text', languages: ['en'] }],
        expectedOutputs: [{ type: 'text', languages: ['en'] }]
      });
      if (a === 'available') logMessage('✓ Chrome Built-in AI ready (on-device, no key, no limit).', 'success');
      else if (a === 'downloadable') logMessage('Chrome Built-in AI available — the ~1–3 GB model downloads on first run.', 'system');
      else if (a === 'downloading') logMessage('Chrome Built-in AI model is downloading…', 'system');
      else logMessage('Chrome Built-in AI is unavailable on this device (disk space / GPU / OS requirements).', 'error');
    } catch (e) {
      logMessage(`Chrome Built-in AI check failed: ${e.message}`, 'error');
    }
  }

  providerSelect.addEventListener('change', () => {
    const p = providerSelect.value;
    chrome.storage.local.set({ selectedProvider: p });
    // Swap the key field to the one saved for this provider.
    chrome.storage.local.get(['githubApiKey', 'customApiKey'], (d) => {
      if (p === 'custom') apiKeyInput.value = d.customApiKey || ENV.customApiKey || '';
      else if (p !== 'chrome-ai') apiKeyInput.value = d.githubApiKey || '';
    });
    updateModelOptions(null, true);
  });

  // ── Fetch Models Dynamically ──
  fetchModelsBtn.addEventListener('click', async () => {
    const provider = providerSelect.value;
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) return alert('Please enter an API Key to fetch models.');

    fetchModelsBtn.textContent = '...';
    try {
      let models = [];
      if (provider === 'gemini') {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
          headers: { 'x-goog-api-key': apiKey }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch Gemini models');
        models = data.models
          .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
          .map(m => ({ value: m.name.replace('models/', ''), text: m.displayName || m.name.replace('models/', '') }));
      } else if (provider === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/models', { headers: { 'Authorization': `Bearer ${apiKey}` } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch Groq models');
        models = data.data.map(m => ({ value: m.id, text: m.id }));
      } else if (provider === 'github') {
        const res = await fetch('https://models.inference.ai.azure.com/models', { headers: { 'Authorization': `Bearer ${apiKey}` } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch GitHub models');
        models = data.data.map(m => ({ value: m.id, text: m.name || m.id }));
      } else if (provider === 'custom') {
        const base = baseUrlInput.value.trim().replace(/\/$/, '');
        if (!base) return alert('Enter the Base URL first.');
        const res = await fetch(`${base}/models`, { headers: { 'Authorization': `Bearer ${apiKey}` } });
        const data = await res.json();
        if (!res.ok) throw new Error((data.error && data.error.message) || `Failed to fetch models (${res.status})`);
        const list = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
        models = list.map(m => ({ value: m.id || m, text: m.id || m }));
      }

      if (models.length > 0) {
        modelsByProvider[provider] = models;
        chrome.storage.local.set({ cachedModels: modelsByProvider });
        updateModelOptions(modelSelect.value);
      } else if (provider === 'custom') {
        alert('No models returned. You can still Start — the model name is sent as typed if the list is empty.');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      fetchModelsBtn.textContent = 'Refresh';
    }
  });

  // ── Load Saved State ──
  chrome.storage.local.get(
    ['githubApiKey', 'customApiKey', 'customBaseUrl', 'selectedProvider', 'selectedModel', 'currentGoal', 'agentActive', 'cachedModels', 'repeatCount', 'autonomousMode'],
    (data) => {
      if (data.cachedModels) modelsByProvider = data.cachedModels;
      providerSelect.value = data.selectedProvider || ENV.provider || 'gemini';
      baseUrlInput.value = data.customBaseUrl || ENV.customBaseUrl || '';

      // Prefill the key: saved value first, else env.js default for this provider.
      if (providerSelect.value === 'custom') {
        apiKeyInput.value = data.customApiKey || ENV.customApiKey || '';
      } else {
        apiKeyInput.value = data.githubApiKey || ENV.apiKey || '';
      }

      const envModel = providerSelect.value === 'custom' ? ENV.customModel : ENV.model;
      updateModelOptions(data.selectedModel || envModel);
      if (data.currentGoal) goalInput.value = data.currentGoal;
      if (data.repeatCount) repeatCountInput.value = data.repeatCount;
      if (data.autonomousMode) autonomousModeInput.checked = true;

      if (data.agentActive) {
        setUIActive(true);
        chrome.runtime.sendMessage({ type: 'GET_MEMORY' }, (response) => {
          if (response) renderMemory(response);
        });
        chrome.runtime.sendMessage({ type: 'GET_STEP_COUNT' }, (count) => {
          if (count) stepCounter.textContent = `Step ${count}`;
        });
        chrome.runtime.sendMessage({ type: 'GET_PLAN' }, (res) => {
          if (res && res.plan) {
            runInfo = { run: res.run || 1, total: res.total || 1 };
            renderThinking(res.thinking || '');
            renderPlan(res.plan);
          }
        });
      }
    }
  );

  // ── Voice Input (Web Speech API) ──
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  function openMicPermissionPage() {
    try {
      chrome.tabs.create({ url: chrome.runtime.getURL('mic-permission.html') });
    } catch (e) {
      logMessage('Open the extension’s mic-permission.html to grant microphone access.', 'error');
    }
  }

  if (SpeechRecognition && micBtn) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    let baseText = '';
    let permissionPromptedThisSession = false;

    recognition.onstart = () => {
      micBtn.textContent = '⏺ Listening…';
      micBtn.classList.add('listening');
    };
    recognition.onend = () => {
      micBtn.textContent = '🎤 Speak';
      micBtn.classList.remove('listening');
    };
    recognition.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        logMessage('Microphone not allowed — opening a page to grant access. Allow it there, close the tab, then click 🎤 again.', 'error');
        if (!permissionPromptedThisSession) {
          permissionPromptedThisSession = true;
          openMicPermissionPage();
        }
      } else if (e.error === 'no-speech') {
        logMessage('No speech detected — click 🎤 and speak.', 'system');
      } else {
        logMessage(`Voice error: ${e.error}`, 'error');
      }
    };
    recognition.onresult = (e) => {
      let finalText = '';
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      if (finalText) baseText = (baseText ? baseText + ' ' : '') + finalText.trim();
      goalInput.value = (baseText + (interim ? ' ' + interim : '')).trim();
    };

    function startListening() {
      baseText = goalInput.value.trim();
      try {
        recognition.start();
      } catch (err) {
        logMessage(`Could not start voice input: ${err.message}`, 'error');
      }
    }

    micBtn.addEventListener('click', async () => {
      if (micBtn.classList.contains('listening')) {
        recognition.stop();
        return;
      }

      // Already granted before? Go straight to listening.
      const flag = await new Promise(res => {
        try { chrome.storage.local.get('micGranted', d => res(d && d.micGranted)); }
        catch (e) { res(false); }
      });
      if (flag) { startListening(); return; }

      // First use — request permission. In an MV3 popup getUserMedia can prompt
      // where the recognition API can't; if it's blocked, fall back to the page.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        try { chrome.storage.local.set({ micGranted: true }); } catch (e) {}
        startListening();
      } catch (err) {
        logMessage('Microphone access needed — opening a page to grant it. Allow it there, close the tab, then click 🎤 again.', 'error');
        openMicPermissionPage();
      }
    });
  } else if (micBtn) {
    micBtn.title = 'Voice input is not supported in this browser';
    micBtn.disabled = true;
  }

  // ── Helpers ──
  function getTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function logMessage(text, type = 'system') {
    const el = document.createElement('div');
    el.className = `log-entry ${type}`;

    const timestamp = document.createElement('span');
    timestamp.className = 'log-timestamp';
    timestamp.textContent = getTimestamp();

    const content = document.createElement('span');
    content.textContent = ` ${text}`;

    el.appendChild(timestamp);
    el.appendChild(content);

    logsContainer.appendChild(el);
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }

  function setStepCounter(n) {
    if (runInfo.total > 1) {
      stepCounter.textContent = `Run ${runInfo.run}/${runInfo.total} · Step ${n}`;
    } else {
      stepCounter.textContent = `Step ${n}`;
    }
  }

  function renderMemory(payload) {
    // Accepts the new { data, slots } shape; tolerates a bare object too.
    let data = {}, slots = [];
    if (payload && (payload.data || payload.slots)) {
      data = payload.data || {};
      slots = payload.slots || [];
    } else if (payload && typeof payload === 'object') {
      data = payload;
    }
    const keys = [];
    slots.forEach(s => { if (s && s.key && !keys.includes(s.key)) keys.push(s.key); });
    Object.keys(data).forEach(k => { if (!keys.includes(k)) keys.push(k); });

    if (!keys.length) { memoryView.textContent = '(empty)'; return; }

    memoryView.textContent = keys.map(k => {
      const slot = slots.find(s => s && s.key === k);
      const desc = slot && slot.desc ? ` — ${slot.desc}` : '';
      const v = data[k];
      if (v == null || String(v).trim() === '') return `○ ${k}${desc}`;
      const s = String(v).replace(/\s+/g, ' ').trim();
      return `● ${k} (${String(v).length})${desc}\n   ${s.slice(0, 110)}${s.length > 110 ? '…' : ''}`;
    }).join('\n');
  }

  function renderThinking(text) {
    if (text) {
      planThinking.textContent = '💭 ' + text;
      planThinking.style.display = 'block';
      planSection.style.display = 'flex';
    } else {
      planThinking.textContent = '';
      planThinking.style.display = 'none';
    }
  }

  function renderPlan(plan) {
    if (!plan || !plan.length) {
      planList.innerHTML = '';
      if (!planThinking.textContent) planSection.style.display = 'none';
      return;
    }
    planSection.style.display = 'flex';
    planList.innerHTML = '';
    plan.forEach(step => {
      const li = document.createElement('li');
      li.textContent = step.text;
      if (step.done) li.classList.add('done');
      planList.appendChild(li);
    });
  }

  function setUIActive(isActive) {
    startBtn.style.display = isActive ? 'none' : 'flex';
    stopBtn.style.display = isActive ? 'flex' : 'none';
    statusIndicator.className = `status-indicator ${isActive ? 'active' : ''}`;
    apiKeyInput.disabled = isActive;
    goalInput.disabled = isActive;
    providerSelect.disabled = isActive;
    modelSelect.disabled = isActive;
    baseUrlInput.disabled = isActive;
    customModelInput.disabled = isActive;
    repeatCountInput.disabled = isActive;
    autonomousModeInput.disabled = isActive;
    if (micBtn) micBtn.disabled = isActive;
    if (!isActive) humanBanner.style.display = 'none';
  }

  // ── Start Agent ──
  startBtn.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    const provider = providerSelect.value;
    const goal = goalInput.value.trim();
    const repeatCount = Math.max(1, Math.min(parseInt(repeatCountInput.value) || 1, 100));
    const autonomous = autonomousModeInput.checked;
    const baseUrl = baseUrlInput.value.trim().replace(/\/$/, '');
    const model = (provider === 'custom' && customModelInput.style.display !== 'none')
      ? customModelInput.value.trim()
      : modelSelect.value;

    if (!apiKey && provider !== 'chrome-ai') return alert('Please enter an API Key.');
    if (provider === 'custom' && !baseUrl) return alert('Please enter the Base URL (e.g. http://localhost:20128/v1).');
    if (provider === 'custom' && !model) return alert('Please enter a model name.');
    if (!goal) return alert('Please enter a goal.');

    repeatCountInput.value = repeatCount;
    runInfo = { run: 1, total: repeatCount };

    const toSave = {
      selectedProvider: provider,
      selectedModel: model,
      currentGoal: goal,
      repeatCount,
      autonomousMode: autonomous,
      agentActive: true
    };
    if (apiKey && provider === 'custom') {
      toSave.customApiKey = apiKey;
      toSave.customBaseUrl = baseUrl;
    } else if (apiKey) {
      toSave.githubApiKey = apiKey;  // don't wipe a saved key when using a keyless provider
    }
    chrome.storage.local.set(toSave);

    setUIActive(true);
    renderThinking('');
    renderPlan([]);
    setStepCounter(0);
    logMessage('Agent started', 'system');
    logMessage(`Provider: ${provider}${provider === 'custom' ? ` (${baseUrl})` : ''}`, 'system');
    logMessage(`Model: ${model}`, 'system');
    if (autonomous) logMessage('⚠️ Autonomous mode — no approval prompts', 'system');
    logMessage(goal, 'user');

    chrome.runtime.sendMessage({
      type: 'START_AGENT',
      payload: { apiKey, provider, model, goal, repeatCount, autonomous, baseUrl }
    });
  });

  // ── Stop Agent ──
  stopBtn.addEventListener('click', () => {
    chrome.storage.local.set({ agentActive: false });
    setUIActive(false);
    logMessage('Agent stopped by user.', 'system');
    chrome.runtime.sendMessage({ type: 'STOP_AGENT' });
  });

  // ── Clear Logs ──
  clearLogsBtn.addEventListener('click', () => {
    logsContainer.innerHTML = '';
  });

  // ── Listen for Messages from Background ──
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'LOG') {
      logMessage(message.payload.text, message.payload.level);

    } else if (message.type === 'AGENT_DONE') {
      setUIActive(false);
      chrome.storage.local.set({ agentActive: false });
      logMessage('Task completed or stopped.', 'success');

    } else if (message.type === 'HUMAN_NEEDED') {
      humanBannerReason.textContent = message.reason || 'Please complete the required action on the page.';
      humanBanner.style.display = 'flex';
      humanAnswerInput.value = '';
      setTimeout(() => humanAnswerInput.focus(), 60);
      logMessage(`🧑‍💻 Human input required: ${message.reason}`, 'system');

    } else if (message.type === 'UPDATE_MEMORY') {
      renderMemory(message.payload);

    } else if (message.type === 'STEP_COUNT') {
      setStepCounter(message.payload);

    } else if (message.type === 'PLAN') {
      renderPlan(message.payload);

    } else if (message.type === 'THINKING') {
      renderThinking(message.payload);

    } else if (message.type === 'RUN_COUNT') {
      runInfo = { run: message.payload.run, total: message.payload.total };
      setStepCounter(0);
    }
  });

  // ── Resume Button ──
  function doResume() {
    const answer = humanAnswerInput.value.trim();
    humanBanner.style.display = 'none';
    humanAnswerInput.value = '';
    logMessage(answer ? `🧑 You: ${answer}` : '▶ Resuming agent…', answer ? 'user' : 'system');
    chrome.runtime.sendMessage({ type: 'RESUME_AGENT', answer });
  }
  resumeBtn.addEventListener('click', doResume);
  humanAnswerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); doResume(); }
  });
});
