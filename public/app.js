const strengthOptions = [
  { value: 'subtle', label: 'Lätt', hint: 'Mest nära originalet' },
  { value: 'clear', label: 'Tydlig', hint: 'Bästa demo-nivån' },
  { value: 'theatrical', label: 'Maxad', hint: 'Överdriven och rolig' },
];

const state = {
  isRecording: false,
  isSubmitting: false,
  strength: 'clear',
  voice: 'sage',
  speechSpeed: 0.76,
  config: {
    appName: 'Dialektlab',
    targetDialect: 'Skanska',
    defaultVoice: 'sage',
    availableVoices: ['sage', 'coral', 'ash', 'verse'],
    speakerMode: 'builtin',
    speechSpeed: 0.76,
  },
  result: null,
  audioSrc: null,
  playbackNeedsTap: false,
  error: null,
};

const recordButton = document.getElementById('record-button');
const playButton = document.getElementById('play-button');
const resultAudio = document.getElementById('result-audio');
const statusMessage = document.getElementById('status-message');
const transcriptBox = document.getElementById('transcript-box');
const transformedBox = document.getElementById('transformed-box');
const ttsBox = document.getElementById('tts-box');
const metaCards = document.getElementById('meta-cards');
const strengthContainer = document.getElementById('strength-options');
const voiceContainer = document.getElementById('voice-options');
const voiceHint = document.getElementById('voice-hint');
const tempoSlider = document.getElementById('tempo-slider');
const tempoValue = document.getElementById('tempo-value');

let audioStream = null;
let mediaRecorder = null;
let audioChunks = [];
let recordingStartedAt = 0;

function getBestSupportedMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/wav',
  ];

  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
    return 'audio/mp4';
  }

  return 'audio/webm';
}

function getFileExtension(mimeType) {
  if (mimeType.includes('mp4')) {
    return 'm4a';
  }
  if (mimeType.includes('ogg')) {
    return 'ogg';
  }
  if (mimeType.includes('wav')) {
    return 'wav';
  }
  return 'webm';
}

function formatLatency(value) {
  return `${(value / 1000).toFixed(1)} s`;
}

function stopTracks() {
  if (!audioStream) {
    return;
  }

  audioStream.getTracks().forEach((track) => track.stop());
  audioStream = null;
}

function setStatus(message) {
  statusMessage.textContent = message;
}

function renderStrengthOptions() {
  strengthContainer.innerHTML = '';

  strengthOptions.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `option-button ${state.strength === option.value ? 'active' : ''}`;
    button.innerHTML = `<strong>${option.label}</strong><span>${option.hint}</span>`;
    button.addEventListener('click', () => {
      state.strength = option.value;
      renderStrengthOptions();
    });
    strengthContainer.appendChild(button);
  });
}

function renderVoiceOptions() {
  voiceContainer.innerHTML = '';

  state.config.availableVoices.forEach((voice) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `voice-button ${state.voice === voice ? 'active' : ''}`;
    button.textContent = voice;
    button.addEventListener('click', () => {
      state.voice = voice;
      renderVoiceOptions();
    });
    voiceContainer.appendChild(button);
  });

  voiceHint.textContent =
    state.config.speakerMode === 'configured'
      ? 'En konfigurerad röst används som default i den här installationen.'
      : 'Byggd för inbyggda OpenAI-röster nu. En egen röst kan kopplas på senare via konfiguration.';
}

function renderOutputControls() {
  tempoSlider.value = String(state.speechSpeed);
  tempoValue.textContent = `${Number(state.speechSpeed).toFixed(2)}x`;
}

function renderMeta() {
  if (!state.result) {
    metaCards.innerHTML = '<div class="meta-card">Ingen output ännu. Kör en första testfras.</div>';
    return;
  }

  const cards = [
    `Latens: <strong>${formatLatency(state.result.meta.latencyMs)}</strong>`,
    `TTS-röst: <strong>${state.result.meta.voice}</strong> (${state.result.meta.speakerMode === 'builtin' ? 'inbyggd' : 'konfigurerad'})`,
    `Tempo: <strong>${Number(state.result.meta.speechSpeed).toFixed(2)}x</strong>`,
  ];

  if (state.result.meta.accentStrategy) {
    cards.push(`Accentstrategi: <strong>${state.result.meta.accentStrategy}</strong>`);
  }

  state.result.meta.warnings.forEach((warning) => {
    cards.push(`<span class="warning-text">${warning}</span>`);
  });

  metaCards.innerHTML = cards.map((card) => `<div class="meta-card">${card}</div>`).join('');
}

function renderAudio() {
  if (!state.audioSrc) {
    resultAudio.removeAttribute('src');
    playButton.classList.add('hidden');
    return;
  }

  resultAudio.src = state.audioSrc;
  resultAudio.load();
  resultAudio.play().then(() => {
    state.playbackNeedsTap = false;
    playButton.classList.add('hidden');
  }).catch(() => {
    state.playbackNeedsTap = true;
    playButton.classList.remove('hidden');
  });
}

function renderRecordButton() {
  recordButton.textContent = state.isRecording ? 'Släpp för att skicka' : 'Håll inne för att prata';
  recordButton.classList.toggle('is-recording', state.isRecording);
  recordButton.disabled = state.isSubmitting;
}

function renderText() {
  transcriptBox.textContent = state.result
    ? state.result.transcript
    : 'Transkriptet dyker upp här efter första körningen.';
  transformedBox.textContent = state.result
    ? state.result.transformedText
    : 'Den omskrivna repliken landar här.';
  ttsBox.textContent = state.result
    ? state.result.ttsText
    : 'Ett mer fonetiskt script för röstmotorn landar här.';
}

function renderStatus() {
  if (state.error) {
    setStatus(state.error);
    return;
  }
  if (state.isRecording) {
    setStatus('Spelar in. Håll inne och prata.');
    return;
  }
  if (state.isSubmitting) {
    setStatus('Transkriberar, vrider mot Skånska och läser upp resultatet...');
    return;
  }
  setStatus('Håll inne knappen, prata svenska, släpp och lyssna.');
}

function render() {
  renderStrengthOptions();
  renderVoiceOptions();
  renderOutputControls();
  renderRecordButton();
  renderText();
  renderMeta();
  renderStatus();
}

async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) {
      throw new Error('Failed to load config');
    }

    state.config = await response.json();
    state.voice = state.config.defaultVoice;
    state.speechSpeed = state.config.speechSpeed ?? state.speechSpeed;
    render();
  } catch (_error) {
    render();
  }
}

async function submitAudio(audioBlob, mimeType) {
  state.isSubmitting = true;
  state.error = null;
  state.result = null;
  state.audioSrc = null;
  state.playbackNeedsTap = false;
  render();

  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, `dialektlab.${getFileExtension(mimeType)}`);
    formData.append('strength', state.strength);
    formData.append('voice', state.voice);
    formData.append('speechSpeed', String(state.speechSpeed));

    const response = await fetch('/api/transform', {
      method: 'POST',
      body: formData,
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) {
      throw new Error((payload && payload.message) || 'Dialektlab failed to process the recording.');
    }

    state.result = payload;
    state.audioSrc = `data:${payload.outputAudioMimeType};base64,${payload.outputAudioBase64}`;
    render();
    renderAudio();
  } catch (error) {
    state.error = error.message;
    render();
  } finally {
    state.isSubmitting = false;
    render();
  }
}

function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state !== 'recording') {
    return;
  }

  mediaRecorder.stop();
  stopTracks();
  state.isRecording = false;
  render();
}

async function startRecording() {
  if (state.isSubmitting || state.isRecording) {
    return;
  }

  if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    state.error = 'Den här webbläsaren saknar stöd för inspelning med MediaRecorder.';
    render();
    return;
  }

  try {
    state.error = null;
    state.result = null;
    state.audioSrc = null;
    render();

    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: false,
    });

    const mimeType = getBestSupportedMimeType();
    audioChunks = [];
    recordingStartedAt = Date.now();
    mediaRecorder = new MediaRecorder(audioStream, { mimeType });

    mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    });

    mediaRecorder.addEventListener('stop', () => {
      const durationMs = Date.now() - recordingStartedAt;
      if (durationMs < 250 || audioChunks.length === 0) {
        state.error = 'För kort inspelning. Håll inne knappen lite längre.';
        render();
        return;
      }

      submitAudio(new Blob(audioChunks, { type: mimeType }), mimeType);
      audioChunks = [];
      mediaRecorder = null;
    });

    mediaRecorder.start(200);
    state.isRecording = true;
    render();
  } catch (_error) {
    stopTracks();
    mediaRecorder = null;
    audioChunks = [];
    state.error = 'Mikrofonåtkomst nekades eller kunde inte startas.';
    render();
  }
}

recordButton.addEventListener('pointerdown', async (event) => {
  event.preventDefault();
  await startRecording();
});

['pointerup', 'pointerleave', 'pointercancel'].forEach((eventName) => {
  recordButton.addEventListener(eventName, (event) => {
    event.preventDefault();
    stopRecording();
  });
});

recordButton.addEventListener('keydown', async (event) => {
  if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
    event.preventDefault();
    await startRecording();
  }
});

recordButton.addEventListener('keyup', (event) => {
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    stopRecording();
  }
});

playButton.addEventListener('click', () => {
  resultAudio.play();
});

tempoSlider.addEventListener('input', () => {
  state.speechSpeed = Number(tempoSlider.value);
  renderOutputControls();
});

window.addEventListener('beforeunload', stopTracks);

loadConfig();
