// =====================================================
// Live Browser Agent — Content Script (Eyes & Hands)
// =====================================================

let interactableElements = new Map();

const TAG_BLACKLIST = new Set(['script', 'style', 'noscript', 'template', 'svg', 'path', 'meta', 'link', 'head']);

// ── Visibility Check (Whole Page, not just viewport) ───
// We include every rendered element regardless of scroll position so the agent
// sees the ENTIRE page in one snapshot and doesn't have to scroll blindly.

function isElementVisible(el) {
  try {
    if (el.tagName && TAG_BLACKLIST.has(el.tagName.toLowerCase())) return false;
    if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return false;

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    // Reject elements pushed far off-canvas (common hiding trick), but keep
    // everything that's part of the real page even if far below the fold.
    if (rect.top + window.scrollY < -2000) return false;
    if (rect.left + window.scrollX < -2000) return false;

    return true;
  } catch (e) {
    return false;
  }
}

function isNearViewport(el) {
  try {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || 800;
    return rect.bottom > -vh && rect.top < vh * 2;
  } catch (e) {
    return false;
  }
}

// ── Recursive Element Discovery (pierces Shadow DOM) ───

function getInteractiveElements(root) {
  let elements = [];
  let nodes;
  try {
    nodes = root.querySelectorAll('*');
  } catch (e) {
    return elements;
  }

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    // Recurse into Shadow DOM
    if (node.shadowRoot) {
      elements = elements.concat(getInteractiveElements(node.shadowRoot));
    }

    const tag = node.tagName ? node.tagName.toLowerCase() : '';
    const role = node.getAttribute ? node.getAttribute('role') : null;

    const isInteractive =
      ['a', 'button', 'input', 'textarea', 'select'].includes(tag) ||
      role === 'button' || role === 'link' || role === 'textbox' || role === 'tab' || role === 'menuitem' ||
      (node.getAttribute && node.getAttribute('contenteditable') === 'true') ||
      (node.hasAttribute && node.hasAttribute('tabindex') && node.getAttribute('tabindex') !== '-1');

    // Also capture text-heavy elements so the agent can "read" the page
    let hasDirectText = false;
    if (!isInteractive && node.childNodes) {
      for (let j = 0; j < node.childNodes.length; j++) {
        const child = node.childNodes[j];
        if (child.nodeType === Node.TEXT_NODE && child.textContent.trim().length > 15) {
          hasDirectText = true;
          break;
        }
      }
    }

    if (isInteractive || hasDirectText) {
      node._isInteractive = isInteractive;
      elements.push(node);
    }
  }
  return elements;
}

// ── Extract Direct Text Only (avoids nested duplication) ──

function getDirectText(el) {
  let text = '';
  for (let i = 0; i < el.childNodes.length; i++) {
    if (el.childNodes[i].nodeType === Node.TEXT_NODE) {
      text += el.childNodes[i].textContent;
    }
  }
  return text.trim();
}

// ── Build Simplified DOM Snapshot ──────────────────────

function buildSimplifiedDOM(maxChars) {
  const CAP = (typeof maxChars === 'number' && maxChars > 500) ? maxChars : 32000;

  // IMPORTANT: Clean up ALL old highlights before re-scanning
  clearHighlights();

  interactableElements.clear();
  let domText = '';
  let idCounter = 1;
  const addedTexts = new Set(); // Text deduplication tracker

  // If a modal / dialog is open, scan ONLY inside it so its own controls (e.g. a
  // "Post" button) can't be pushed past the size cap by the page behind it.
  let scanRoot = document;
  try {
    const vpArea = (window.innerWidth || 1000) * (window.innerHeight || 800);
    const dialogs = Array.from(document.querySelectorAll('[aria-modal="true"], [role="dialog"], dialog[open]'))
      .filter(d => {
        if (!isElementVisible(d)) return false;
        const r = d.getBoundingClientRect();
        if (r.width < 200 || r.height < 120) return false;
        // Treat as a real modal only if it declares itself modal OR covers a big
        // slice of the screen (filters out popovers, datepickers, chat widgets).
        const isModal = d.getAttribute('aria-modal') === 'true' || d.tagName === 'DIALOG';
        return isModal || (r.width * r.height) > vpArea * 0.25;
      });
    if (dialogs.length) {
      scanRoot = dialogs[dialogs.length - 1]; // topmost / most recently opened
      domText += `[dialog] A modal dialog is open — only its contents are listed. Complete it or close it before doing anything else.\n`;
    }
  } catch (e) { /* fall back to full document */ }

  const elements = getInteractiveElements(scanRoot);

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (!isElementVisible(el)) continue;

    // ── Smart Text Extraction ──
    let text;
    if (!el._isInteractive) {
      // For text blocks, only use direct text to avoid pulling nested duplicates
      text = getDirectText(el);
    } else {
      // For interactive elements, use innerText/value/aria-label
      text = el.value || el.innerText || el.placeholder || (el.getAttribute && el.getAttribute('aria-label')) || el.alt || '';
    }
    text = text.trim().replace(/\s+/g, ' ');

    // Character limits: 200 for buttons/links, 500 for text blocks
    const charLimit = el._isInteractive ? 200 : 500;
    text = text.substring(0, charLimit);

    // ── Classify Element Type ──
    let type = el.tagName ? el.tagName.toLowerCase() : 'unknown';
    if (type === 'input') type = `input[${el.type || 'text'}]`;
    if (el.getAttribute && el.getAttribute('contenteditable') === 'true') type = 'contenteditable';
    if (!el._isInteractive) type = 'text_block';

    // Skip empty non-input elements
    if (text.length === 0 && !type.includes('input') && type !== 'contenteditable') continue;

    // ── Text Deduplication ──
    // Skip text_block elements whose text is already represented
    if (type === 'text_block' && text.length > 20) {
      const textKey = text.substring(0, 100);
      if (addedTexts.has(textKey)) continue;
      addedTexts.add(textKey);
    }

    const id = idCounter++;
    interactableElements.set(id, el);

    const entry = `[${id}] ${type}: "${text}"\n`;

    // Hard character cutoff to keep the request within the model's context window.
    if (domText.length + entry.length > CAP) {
      domText += '\n...[TRUNCATED: page has more elements below. SCROLL down to reveal them.]\n';
      break;
    }

    domText += entry;

    // ── Visual Highlight Overlays (only near the viewport, to avoid jank) ──
    if (!isNearViewport(el)) continue;
    try {
      el.style.outline = '2px solid rgba(59, 130, 246, 0.4)';

      const label = document.createElement('div');
      label.className = 'agent-ui-label';
      label.style.cssText = `
        position: absolute;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        color: white;
        font-size: 9px;
        font-weight: 600;
        padding: 1px 4px;
        border-radius: 3px;
        z-index: 2147483647;
        pointer-events: none;
        font-family: monospace;
        line-height: 1.2;
      `;
      const rect = el.getBoundingClientRect();
      label.style.top = `${rect.top + window.scrollY - 14}px`;
      label.style.left = `${rect.left + window.scrollX}px`;
      label.textContent = id;
      document.body.appendChild(label);
    } catch (e) { /* skip if unable to highlight */ }
  }

  return domText;
}

// ── Clear All Highlights ──────────────────────────────

function clearHighlights() {
  interactableElements.forEach((el) => {
    try { el.style.outline = ''; } catch (e) { /* element may have been removed */ }
  });
  // Remove ALL label overlays at once
  document.querySelectorAll('.agent-ui-label').forEach(label => label.remove());
  interactableElements.clear();
}

// ── Human-Like Event Simulation ───────────────────────

function simulateClick(el) {
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };

  el.dispatchEvent(new PointerEvent('pointerdown', opts));
  el.dispatchEvent(new MouseEvent('mousedown', opts));
  el.dispatchEvent(new PointerEvent('pointerup', opts));
  el.dispatchEvent(new MouseEvent('mouseup', opts));
  el.dispatchEvent(new MouseEvent('click', opts));
}

function simulateEnter(el) {
  const opts = { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 };
  el.dispatchEvent(new KeyboardEvent('keydown', opts));
  el.dispatchEvent(new KeyboardEvent('keypress', opts));
  el.dispatchEvent(new KeyboardEvent('keyup', opts));
}

// ── Set Input Value (React/Vue compatible) ────────────

function setNativeValue(el, value) {
  const tag = el.tagName;
  // The native value setter only exists (and is only legal to call) on real
  // <input>/<textarea>. Calling it on anything else throws "Illegal invocation".
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    try {
      const proto = tag === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
      if (descriptor && descriptor.set) { descriptor.set.call(el, value); return; }
    } catch (e) { /* fall through */ }
  }
  try { el.value = value; } catch (e) { /* not a value-bearing element */ }
  try { if (el.isContentEditable) el.textContent = value; } catch (e) { /* ignore */ }
}

// ── Read back whatever text a field currently holds ────

function readFieldText(el) {
  if (!el) return '';
  if (el.isContentEditable || (el.getAttribute && el.getAttribute('contenteditable') === 'true')) {
    return (el.innerText || el.textContent || '').trim();
  }
  return (el.value || '').trim();
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function selectAllIn(el) {
  try {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch (e) { /* ignore */ }
}

// ── Robust insertion into rich-text (contenteditable) editors ──
// execCommand('insertText') mangles long multi-line text in Draft.js (LinkedIn),
// ProseMirror (ChatGPT), Lexical, Quill, etc. A synthetic paste event is the path
// those editors actually support. Each method runs only if the previous one left
// the field essentially empty, so we never stack two insertions.

async function insertRichText(el, text) {
  el.focus();
  selectAllIn(el);

  const enough = () => readFieldText(el).length >= text.length * 0.92;

  // 1. Synthetic paste event with a real DataTransfer payload.
  try {
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    const evt = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt });
    el.dispatchEvent(evt);
  } catch (e) { /* some editors / browsers block a constructed ClipboardEvent */ }
  await sleep(180);

  // 2. Single execCommand insertText.
  if (!enough()) {
    try {
      selectAllIn(el);
      document.execCommand('insertText', false, text);
    } catch (e) { /* ignore */ }
    await sleep(100);
  }

  // 3. Chunked insertText — gets past editors (Google Docs, some Draft.js) that
  //    silently drop a large single insert. Small chunks + pauses let the editor
  //    process each one.
  if (!enough()) {
    try {
      selectAllIn(el);
      document.execCommand('delete', false, null);
    } catch (e) { /* ignore */ }
    const chunks = text.match(/[\s\S]{1,400}/g) || [text];
    for (const c of chunks) {
      try { document.execCommand('insertText', false, c); } catch (e) { /* ignore */ }
      await sleep(45);
    }
    await sleep(100);
  }

  // 4. Last resort: write textContent directly (only if still nearly empty).
  if (readFieldText(el).length < Math.max(20, text.length * 0.3)) {
    try { el.textContent = text; } catch (e) { /* ignore */ }
  }

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return readFieldText(el).length;
}

// ── Execute Actions ───────────────────────────────────

function executeAction(action) {
  return new Promise((resolve) => {

    // ── CLICK ──
    if (action.action === 'CLICK') {
      const el = interactableElements.get(action.elementId);
      if (!el) return resolve({ success: false, message: `Element [${action.elementId}] not found` });

      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        simulateClick(el);
        resolve({ success: true, message: `Clicked element [${action.elementId}]` });
      }, 250);

    // ── TYPE ──
    } else if (action.action === 'TYPE') {
      const el = interactableElements.get(action.elementId);
      if (!el) return resolve({ success: false, message: `Element [${action.elementId}] not found` });

      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus();
      simulateClick(el); // Some editors require a click to become truly active

      setTimeout(async () => {
       try {
        const isRich = el.getAttribute('contenteditable') === 'true' || el.isContentEditable ||
                       (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT');
        if (isRich) {
          await insertRichText(el, action.text);
        } else {
          setNativeValue(el, action.text);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Verify the field actually holds what we tried to type.
        const got = readFieldText(el);
        const want = (action.text || '').trim();
        if (want.length > 30 && got.length < want.length * 0.8) {
          return resolve({
            success: false,
            message: `Only ${got.length}/${want.length} characters landed in [${action.elementId}]. The editor rejected the input — do NOT submit. Try a different field or split the text.`
          });
        }

        if (action.submit) {
          setTimeout(() => {
            simulateEnter(el);
            if (el.form) {
              try { el.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); } catch (e) { }
            }
            resolve({ success: true, message: `Typed ${got.length} chars into [${action.elementId}] and submitted` });
          }, 150);
        } else {
          resolve({ success: true, message: `Typed ${got.length} chars into element [${action.elementId}]` });
        }
       } catch (err) {
        resolve({ success: false, message: `Type failed: ${err.message}` });
       }
      }, 200);

    // ── TYPE_FROM_MEMORY ──
    // Injects pre-resolved memory content (sent by background.js) directly into a field.
    // This bypasses the LLM token limit since the text is never echoed in the JSON response.
    } else if (action.action === 'TYPE_FROM_MEMORY') {
      const el = interactableElements.get(action.elementId);
      if (!el) return resolve({ success: false, message: `Element [${action.elementId}] not found` });
      if (!action.resolvedText) return resolve({ success: false, message: 'TYPE_FROM_MEMORY: no resolvedText provided by background.js' });

      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus();
      simulateClick(el);

      setTimeout(async () => {
       try {
        const isRich = el.getAttribute('contenteditable') === 'true' || el.isContentEditable ||
                       (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT');
        if (isRich) {
          await insertRichText(el, action.resolvedText);
        } else {
          setNativeValue(el, action.resolvedText);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const got = readFieldText(el);
        const want = (action.resolvedText || '').trim();
        if (want.length > 30 && got.length < want.length * 0.9) {
          return resolve({
            success: false,
            message: `Only ${got.length}/${want.length} chars of "${action.memoryKey}" landed in [${action.elementId}]. The editor truncated it — do NOT submit or post. Retry once; if it still won't fit, paste it in parts.`
          });
        }

        if (action.submit) {
          setTimeout(() => {
            simulateEnter(el);
            if (el.form) {
              try { el.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); } catch (e) { }
            }
            resolve({ success: true, message: `Injected "${action.memoryKey}" (${got.length}/${want.length} chars) into [${action.elementId}] and submitted` });
          }, 150);
        } else {
          resolve({ success: true, message: `Injected "${action.memoryKey}" (${got.length}/${want.length} chars) into [${action.elementId}]` });
        }
       } catch (err) {
        resolve({ success: false, message: `Paste failed: ${err.message}` });
       }
      }, 200);

    // ── PRESS_ENTER ──
    } else if (action.action === 'PRESS_ENTER') {
      const el = interactableElements.get(action.elementId);
      if (!el) return resolve({ success: false, message: `Element [${action.elementId}] not found` });

      el.focus();
      simulateEnter(el);
      if (el.form) {
        try { el.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); } catch (e) { }
      }
      resolve({ success: true, message: `Pressed Enter on element [${action.elementId}]` });

    // ── EXTRACT_MEMORY ──
    } else if (action.action === 'EXTRACT_MEMORY') {
      // ── Auto-Find Mode (elementId: 0) ──
      // When elementId is 0 or absent, auto-find the last AI response on the page
      // using known selectors for Gemini, ChatGPT, Claude, AI Studio, etc.
      if (!action.elementId || action.elementId === 0) {
        // If the AI site is still streaming its answer, don't grab a partial response.
        const GENERATING_INDICATORS = [
          'button[data-testid="stop-button"]',                 // ChatGPT
          'button[aria-label="Stop generating"]',
          'button[aria-label="Stop streaming"]',
          'button[aria-label="Stop response"]',                // Claude
          'button[aria-label*="Stop response" i]',             // Gemini
          '.result-streaming'                                  // ChatGPT (legacy)
        ];
        const stillGenerating = GENERATING_INDICATORS.some(s => {
          try { return !!document.querySelector(s); } catch (e) { return false; }
        });
        if (stillGenerating) {
          return resolve({
            success: false,
            message: 'The AI response is still generating. Use WAIT (15-20s) and then EXTRACT_MEMORY again — do not extract a partial answer.'
          });
        }

        const RESPONSE_SELECTORS = [
          // Gemini Web / AI Studio
          'model-response', 'message-content', 'ms-cmark-node',
          '[data-message-author-role="model"]',
          // ChatGPT
          '[data-message-author-role="assistant"]',
          // Claude
          '[data-testid="message-content"]', 'div.font-claude-message',
          // Generic assistant/markdown containers
          '.markdown', '.prose',
          // Fallback: any large text block
          'article', '[class*="model"]', '[class*="response"]', '[class*="message"]'
        ];

        let foundEl = null;
        let foundText = '';
        for (const sel of RESPONSE_SELECTORS) {
          const all = document.querySelectorAll(sel);
          if (all.length > 0) {
            foundEl = all[all.length - 1]; // Always grab the LAST response
            foundText = (foundEl.innerText || foundEl.textContent || '').trim();
            if (foundText.length >= 20) break;
          }
        }

        // Fallback for non-chat pages (humanizers, paraphrasers, articles):
        // take the fullest textarea/editable, else the largest readable block.
        if (foundText.length < 20) {
          let best = '', bestEl = null;
          document.querySelectorAll('textarea, [contenteditable="true"], input[type="text"]').forEach(f => {
            const v = (f.value || f.innerText || '').trim();
            if (v.length > best.length) { best = v; bestEl = f; }
          });
          if (best.length < 40) {
            const container = document.querySelector('main, article, [role="main"]') || document.body;
            document.querySelectorAll('main, article, [role="main"], section, .content, #content, .post, .entry, .article-body').forEach(c => {
              const t = (c.innerText || '').trim();
              if (t.length > best.length && t.length < 40000) { best = t; bestEl = c; }
            });
            if (best.length < 40) { best = (container.innerText || '').trim().slice(0, 40000); bestEl = container; }
          }
          foundText = best;
          foundEl = bestEl;
        }

        if (!foundEl || foundText.length < 20) {
          return resolve({ success: false, message: 'No readable result found on the page yet. WAIT and retry, or specify an elementId.' });
        }

        return resolve({
          success: true,
          message: `Auto-extracted ${foundText.length} characters`,
          extractedText: foundText,
          key: action.key
        });
      }

      // ── Manual Element Mode ──
      const el = interactableElements.get(action.elementId);
      if (!el) return resolve({ success: false, message: `Element [${action.elementId}] not found` });

      // Climb up from the targeted element to find the full response container
      let extractEl = el;
      if (!el._isInteractive) {
        let current = el;
        while (current && current.tagName !== 'BODY') {
          const tag = current.tagName.toLowerCase();
          const cls = (current.className || '').toString().toLowerCase();
          if (tag === 'article' || tag === 'main' ||
              cls.includes('model') || cls.includes('message') || 
              cls.includes('response') || cls.includes('markdown')) {
            extractEl = current;
            break;
          }
          current = current.parentElement;
        }
        // If still only the original element, go up 3 levels as a last resort
        if (extractEl === el) {
          let p = el.parentElement;
          for (let i = 0; i < 3 && p && p.tagName !== 'BODY'; i++) {
            p = p.parentElement;
          }
          if (p && p.tagName !== 'BODY') extractEl = p;
        }
      }

      const text = (extractEl.innerText || extractEl.textContent || extractEl.value || '').trim();
      resolve({ 
        success: true, 
        message: `Extracted ${text.length} characters from element [${action.elementId}] (expanded)`, 
        extractedText: text, 
        key: action.key 
      });

    // ── SCROLL ──
    } else if (action.action === 'SCROLL') {
      const amount = action.direction === 'up' ? -window.innerHeight * 0.75 : window.innerHeight * 0.75;
      window.scrollBy({ top: amount, behavior: 'smooth' });
      resolve({ success: true, message: `Scrolled ${action.direction}` });

    } else {
      resolve({ success: false, message: `Unknown action: ${action.action}` });
    }
  });
}

// ── Message Listener ──────────────────────────────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'EXTRACT_DOM') {
    const simplifiedDOM = buildSimplifiedDOM(request.maxChars);
    sendResponse({ dom: simplifiedDOM, url: window.location.href, title: document.title });

  } else if (request.type === 'EXECUTE_ACTION') {
    executeAction(request.payload).then(result => {
      sendResponse(result);
    });
    return true; // Keep message channel open for async response

  } else if (request.type === 'CLEAR_HIGHLIGHTS') {
    clearHighlights();
    sendResponse({ success: true });
  }
});
