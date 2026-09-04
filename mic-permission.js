// Requests one-time microphone permission for the extension origin.
// Once granted here, webkitSpeechRecognition works in the popup.

const statusEl = document.getElementById('status');
const retryBtn = document.getElementById('retry');
const helpEl = document.getElementById('help');

function setStatus(text, cls) {
  statusEl.textContent = text;
  statusEl.className = `status ${cls}`;
}

async function requestMic() {
  setStatus('Requesting microphone access…', 'wait');
  retryBtn.style.display = 'none';
  helpEl.style.display = 'none';

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus('This browser does not expose microphone access here.', 'err');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // We only needed the permission grant — release the mic immediately.
    stream.getTracks().forEach(t => t.stop());
    setStatus('✓ Microphone enabled. You can close this tab and use 🎤 Speak in the extension.', 'ok');
    try { chrome.storage && chrome.storage.local.set({ micGranted: true }); } catch (e) {}
  } catch (err) {
    const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
    setStatus(
      denied
        ? '✗ Microphone was blocked. Follow the steps below, then reload this page.'
        : `✗ Could not access the microphone (${err && err.name || 'unknown error'}).`,
      'err'
    );
    retryBtn.style.display = 'inline-block';
    helpEl.style.display = 'block';
  }
}

retryBtn.addEventListener('click', requestMic);
requestMic();
