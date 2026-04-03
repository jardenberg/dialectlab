const strengthOptions = [
  { value: 'subtle', label: 'Lätt', hint: 'Mest nära originalet' },
  { value: 'clear', label: 'Tydlig', hint: 'Bästa demo-nivån' },
  { value: 'theatrical', label: 'Maxad', hint: 'Överdriven och rolig' },
];

const state = {
  isRecording: false,
  isPreparingRecorder: false,
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
  processingProgress: 0,
  processingStage: '',
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
const progressShell = document.getElementById('progress-shell');
const progressBar = document.getElementById('progress-bar');
const progressHint = document.getElementById('progress-hint');

let audioStream = null;
let mediaRecorder = null;
let audioChunks = [];
let recordingStartedAt = 0;
let processingTimerId = null;
let processingStartedAt = 0;

const processingStages = [
  { afterMs: 0, label: 'Laddar upp inspelningen...' },
  { afterMs: 1600, label: 'Transkriberar svenskan...' },
  { afterMs: 5000, label: 'Gör om texten till skånska...' },
  { afterMs: 9500, label: 'Bygger rösten...' },
  { afterMs: 15000, label: 'Polerar sista dragen...' },
];

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

function getActiveProcessingStage(elapsedMs) {
  let stage = processingStages[0];

  processingStages.forEach((candidate) => {
    if (elapsedMs >= candidate.afterMs) {
      stage = candidate;
    }
  });

  return stage.label;
}

function clearProcessingFeedback() {
  if (processingTimerId) {
    clearInterval(processingTimerId);
    processingTimerId = null;
  }
}

function updateProcessingFeedback() {
  const elapsedMs = Date.now() - processingStartedAt;
  state.processingStage = getActiveProcessingStage(elapsedMs);
  state.processingProgress = Math.min(94, 8 + Math.round(86 * (1 - Math.exp(-elapsedMs / 12000))));
  renderProgress();
  renderStatus();
}

function startProcessingFeedback() {
  clearProcessingFeedback();
  processingStartedAt = Date.now();
  state.processingProgress = 6;
  state.processingStage = processingStages[0].label;
  updateProcessingFeedback();
  processingTimerId = window.setInterval(updateProcessingFeedback, 240);
}

function stopProcessingFeedback() {
  clearProcessingFeedback();
  state.processingProgress = 0;
  state.processingStage = '';
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

function renderProgress() {
  const isActive = state.isSubmitting;
  progressShell.classList.toggle('hidden', !isActive);
  progressHint.classList.toggle('hidden', !isActive);
  progressBar.style.width = `${isActive ? state.processingProgress : 0}%`;

  if (isActive) {
    progressShell.setAttribute('aria-valuenow', String(Math.round(state.processingProgress)));
    progressHint.textContent = state.processingStage;
    return;
  }

  progressShell.removeAttribute('aria-valuenow');
  progressHint.textContent = '';
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

  if (state.result.meta.clientRecordingMs) {
    cards.push(`Inspelning: <strong>${formatLatency(state.result.meta.clientRecordingMs)}</strong>`);
  }

  if (state.result.meta.transcriptChars && state.result.meta.ttsChars) {
    cards.push(
      `Längd: <strong>${state.result.meta.transcriptChars}</strong> tecken in, <strong>${state.result.meta.ttsChars}</strong> tecken ut`,
    );
  }

  if (state.result.meta.accentStrategy) {
    cards.push(`Accentstrategi: <strong>${state.result.meta.accentStrategy}</strong>`);
  }

  if (state.result.meta.timings) {
    cards.push(
      `Steg: <strong>${formatLatency(state.result.meta.timings.transcribeMs)}</strong> transkribering, <strong>${formatLatency(state.result.meta.timings.rewriteMs)}</strong> omskrivning, <strong>${formatLatency(state.result.meta.timings.ttsMs)}</strong> röst`,
    );
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
  resultAudio
    .play()
    .then(() => {
      state.playbackNeedsTap = false;
      playButton.classList.add('hidden');
      renderStatus();
    })
    .catch(() => {
      state.playbackNeedsTap = true;
      playButton.classList.remove('hidden');
      renderStatus();
    });
}

function renderRecordButton() {
  if (state.isPreparingRecorder) {
    recordButton.textContent = 'Öppnar mikrofonen...';
  } else if (state.isRecording) {
    recordButton.textContent = 'Stoppa inspelningen';
  } else if (state.isSubmitting) {
    recordButton.textContent = 'Bearbetar...';
  } else {
    recordButton.textContent = 'Tryck för att börja prata';
  }

  recordButton.classList.toggle('is-recording', state.isRecording);
  recordButton.classList.toggle('is-arming', state.isPreparingRecorder);
  recordButton.disabled = state.isSubmitting || state.isPreparingRecorder;
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
  if (state.isPreparingRecorder) {
    setStatus('Tillåt mikrofonen om webbläsaren frågar, så startar inspelningen direkt.');
    return;
  }
  if (state.isRecording) {
    setStatus('Spelar in nu. Tryck igen när du vill stoppa.');
    return;
  }
  if (state.isSubmitting) {
    setStatus('Jobbar på det...');
    return;
  }
  if (state.playbackNeedsTap) {
    setStatus('Klart. Tryck på Spela upp nu för att höra resultatet.');
    return;
  }
  if (state.result) {
    setStatus('Klart. Tryck igen för nästa runda.');
    return;
  }
  setStatus('Tryck för att börja prata.');
}

function render() {
  renderStrengthOptions();
  renderVoiceOptions();
  renderOutputControls();
  renderProgress();
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

async function submitAudio(audioBlob, mimeType, durationMs) {
  state.isSubmitting = true;
  state.error = null;
  state.result = null;
  state.audioSrc = null;
  state.playbackNeedsTap = false;
  startProcessingFeedback();
  render();

  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, `dialektlab.${getFileExtension(mimeType)}`);
    formData.append('strength', state.strength);
    formData.append('voice', state.voice);
    formData.append('speechSpeed', String(state.speechSpeed));
    formData.append('clientRecordingMs', String(durationMs));

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
    stopProcessingFeedback();
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
  if (state.isSubmitting || state.isRecording || state.isPreparingRecorder) {
    return;
  }

  if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    state.error = 'Den här webbläsaren saknar stöd för inspelning med MediaRecorder.';
    render();
    return;
  }

  try {
    state.isPreparingRecorder = true;
    state.error = null;
    state.result = null;
    state.audioSrc = null;
    state.playbackNeedsTap = false;
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

      submitAudio(new Blob(audioChunks, { type: mimeType }), mimeType, durationMs);
      audioChunks = [];
      mediaRecorder = null;
    });

    mediaRecorder.start(200);
    state.isPreparingRecorder = false;
    state.isRecording = true;
    render();
  } catch (_error) {
    stopTracks();
    mediaRecorder = null;
    audioChunks = [];
    state.isPreparingRecorder = false;
    state.error = 'Mikrofonåtkomst nekades eller kunde inte startas.';
    render();
  }
}

recordButton.addEventListener('click', async (event) => {
  event.preventDefault();
  if (state.isRecording) {
    stopRecording();
    return;
  }

  await startRecording();
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
