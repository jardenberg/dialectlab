const fallbackCopy = {
  locale: 'sv',
  noResult: 'Ingen skånska än. Kör en första testfras.',
  transcriptPlaceholder: 'Transkriptet dyker upp här efter första körningen.',
  transformedPlaceholder: 'Den omskrivna repliken landar här.',
  ttsPlaceholder: 'Ett mer fonetiskt script för röstmotorn landar här.',
  downloadAudio: 'Ladda ner ljudfil',
  recordButtonIdle: 'Tryck å snacka',
  recordButtonStop: 'Tryck för å stoppa',
  recordButtonPreparing: 'Öppnar mikrofonen...',
  recordButtonSubmitting: 'Bearbetar...',
  statusIdle: 'Tryck å snacka, på vilket språk du vill.',
  statusPreparing: 'Tillåt mikrofonen om webbläsarn frågar, så drar inspelningen igång direkt.',
  statusRecording: 'Spelar in nu. Tryck igen när du vill stoppa.',
  statusSubmitting: 'Jobbar på det...',
  statusPlayback: 'Klart. Tryck på Spela upp nu för att höra resultatet.',
  statusDone: 'Klart. Tryck igen för nästa runda.',
  progressStages: [
    'Laddar upp inspelningen...',
    'Transkriberar talet...',
    'Vrider texten mot skånska...',
    'Bygger rösten...',
    'Polerar sista dragen...',
  ],
  strengthOptions: [
    { value: 'subtle', label: 'Lätt', hint: 'Mest nära originalet' },
    { value: 'clear', label: 'Tydlig', hint: 'Bästa demo-nivån' },
    { value: 'theatrical', label: 'Maxad', hint: 'Överdriven och rolig' },
  ],
  metaLabels: {
    latency: 'Latens',
    ttsVoice: 'TTS-röst',
    builtin: 'inbyggd',
    configured: 'konfigurerad',
    tempo: 'Tempo',
    inputLanguage: 'Inputspråk',
    recording: 'Inspelning',
    length: 'Längd',
    charsIn: 'tecken in',
    charsOut: 'tecken ut',
    accentStrategy: 'Accentstrategi',
    steps: 'Steg',
    transcribe: 'transkribering',
    rewrite: 'omskrivning',
    voice: 'röst',
  },
  voiceHintConfigured: 'En konfigurerad röst används som default i den här installationen.',
  voiceHintBuiltin: 'Byggd för inbyggda OpenAI-röster nu. En egen röst kan kopplas på senare via konfiguration.',
  errors: {
    loadConfig: 'Kunde inte läsa in konfigurationen.',
    processFailed: 'Gormigskånsk kunde inte bearbeta inspelningen just nu.',
    mediaRecorderMissing: 'Den här webbläsaren saknar stöd för inspelning med MediaRecorder.',
    tooShort: 'För kort inspelning. Håll igång lite längre.',
    micDenied: 'Mikrofonåtkomst nekades eller kunde inte startas.',
  },
};

const runtime = window.__GORMIGSKANSK__ || {};
const copy = runtime.copy || fallbackCopy;
const strengthOptions = copy.strengthOptions || fallbackCopy.strengthOptions;
const metaLabels = copy.metaLabels || fallbackCopy.metaLabels;
const errorCopy = copy.errors || fallbackCopy.errors;

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
  audioDownloadName: 'gormigskansk.mp3',
  playbackNeedsTap: false,
  processingProgress: 0,
  processingStage: '',
  error: null,
};

const recordButton = document.getElementById('record-button');
const playButton = document.getElementById('play-button');
const downloadLink = document.getElementById('download-link');
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
let activeAudioUrl = null;

const processingStages = (copy.progressStages || fallbackCopy.progressStages).map((label, index) => ({
  afterMs: [0, 1600, 5000, 9500, 15000][index] ?? index * 3000,
  label,
}));

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

function revokeAudioUrl() {
  if (!activeAudioUrl) {
    return;
  }

  URL.revokeObjectURL(activeAudioUrl);
  activeAudioUrl = null;
}

function createAudioBlob(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function createDownloadName() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `gormigskansk-${copy.locale || 'sv'}-${timestamp}.mp3`;
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
      ? copy.voiceHintConfigured || fallbackCopy.voiceHintConfigured
      : copy.voiceHintBuiltin || fallbackCopy.voiceHintBuiltin;
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
    metaCards.innerHTML = `<div class="meta-card">${escapeHtml(copy.noResult || fallbackCopy.noResult)}</div>`;
    return;
  }

  const cards = [
    `${escapeHtml(metaLabels.latency)}: <strong>${escapeHtml(formatLatency(state.result.meta.latencyMs))}</strong>`,
    `${escapeHtml(metaLabels.ttsVoice)}: <strong>${escapeHtml(state.result.meta.voice)}</strong> (${escapeHtml(
      state.result.meta.speakerMode === 'builtin' ? metaLabels.builtin : metaLabels.configured,
    )})`,
    `${escapeHtml(metaLabels.tempo)}: <strong>${escapeHtml(`${Number(state.result.meta.speechSpeed).toFixed(2)}x`)}</strong>`,
  ];

  if (state.result.meta.sourceLanguage) {
    cards.push(`${escapeHtml(metaLabels.inputLanguage)}: <strong>${escapeHtml(state.result.meta.sourceLanguage)}</strong>`);
  }

  if (state.result.meta.clientRecordingMs) {
    cards.push(`${escapeHtml(metaLabels.recording)}: <strong>${escapeHtml(formatLatency(state.result.meta.clientRecordingMs))}</strong>`);
  }

  if (state.result.meta.transcriptChars && state.result.meta.ttsChars) {
    cards.push(
      `${escapeHtml(metaLabels.length)}: <strong>${escapeHtml(String(state.result.meta.transcriptChars))}</strong> ${escapeHtml(
        metaLabels.charsIn,
      )}, <strong>${escapeHtml(String(state.result.meta.ttsChars))}</strong> ${escapeHtml(metaLabels.charsOut)}`,
    );
  }

  if (state.result.meta.accentStrategy) {
    cards.push(`${escapeHtml(metaLabels.accentStrategy)}: <strong>${escapeHtml(state.result.meta.accentStrategy)}</strong>`);
  }

  if (state.result.meta.timings) {
    cards.push(
      `${escapeHtml(metaLabels.steps)}: <strong>${escapeHtml(
        formatLatency(state.result.meta.timings.transcribeMs),
      )}</strong> ${escapeHtml(metaLabels.transcribe)}, <strong>${escapeHtml(
        formatLatency(state.result.meta.timings.rewriteMs),
      )}</strong> ${escapeHtml(metaLabels.rewrite)}, <strong>${escapeHtml(
        formatLatency(state.result.meta.timings.ttsMs),
      )}</strong> ${escapeHtml(metaLabels.voice)}`,
    );
  }

  (state.result.meta.warnings || []).forEach((warning) => {
    cards.push(`<span class="warning-text">${escapeHtml(warning)}</span>`);
  });

  metaCards.innerHTML = cards.map((card) => `<div class="meta-card">${card}</div>`).join('');
}

function renderAudio() {
  if (!state.audioSrc) {
    resultAudio.pause();
    resultAudio.removeAttribute('src');
    playButton.classList.add('hidden');
    downloadLink.classList.add('hidden');
    downloadLink.removeAttribute('href');
    downloadLink.removeAttribute('download');
    return;
  }

  resultAudio.src = state.audioSrc;
  resultAudio.load();
  downloadLink.href = state.audioSrc;
  downloadLink.download = state.audioDownloadName;
  downloadLink.classList.remove('hidden');
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
    recordButton.textContent = copy.recordButtonPreparing || fallbackCopy.recordButtonPreparing;
  } else if (state.isRecording) {
    recordButton.textContent = copy.recordButtonStop || fallbackCopy.recordButtonStop;
  } else if (state.isSubmitting) {
    recordButton.textContent = copy.recordButtonSubmitting || fallbackCopy.recordButtonSubmitting;
  } else {
    recordButton.textContent = copy.recordButtonIdle || fallbackCopy.recordButtonIdle;
  }

  recordButton.classList.toggle('is-recording', state.isRecording);
  recordButton.classList.toggle('is-arming', state.isPreparingRecorder);
  recordButton.disabled = state.isSubmitting || state.isPreparingRecorder;
}

function renderText() {
  transcriptBox.textContent = state.result
    ? state.result.transcript
    : copy.transcriptPlaceholder || fallbackCopy.transcriptPlaceholder;
  transformedBox.textContent = state.result
    ? state.result.transformedText
    : copy.transformedPlaceholder || fallbackCopy.transformedPlaceholder;
  ttsBox.textContent = state.result
    ? state.result.ttsText
    : copy.ttsPlaceholder || fallbackCopy.ttsPlaceholder;
}

function renderStatus() {
  if (state.error) {
    setStatus(state.error);
    return;
  }
  if (state.isPreparingRecorder) {
    setStatus(copy.statusPreparing || fallbackCopy.statusPreparing);
    return;
  }
  if (state.isRecording) {
    setStatus(copy.statusRecording || fallbackCopy.statusRecording);
    return;
  }
  if (state.isSubmitting) {
    setStatus(copy.statusSubmitting || fallbackCopy.statusSubmitting);
    return;
  }
  if (state.playbackNeedsTap) {
    setStatus(copy.statusPlayback || fallbackCopy.statusPlayback);
    return;
  }
  if (state.result) {
    setStatus(copy.statusDone || fallbackCopy.statusDone);
    return;
  }
  setStatus(copy.statusIdle || fallbackCopy.statusIdle);
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
      throw new Error(errorCopy.loadConfig || fallbackCopy.errors.loadConfig);
    }

    state.config = await response.json();
    state.voice = state.config.defaultVoice;
    state.speechSpeed = state.config.speechSpeed ?? state.speechSpeed;
    render();
  } catch (_error) {
    state.error = errorCopy.loadConfig || fallbackCopy.errors.loadConfig;
    render();
  }
}

async function submitAudio(audioBlob, mimeType, durationMs) {
  state.isSubmitting = true;
  state.error = null;
  state.result = null;
  revokeAudioUrl();
  state.audioSrc = null;
  state.audioDownloadName = createDownloadName();
  state.playbackNeedsTap = false;
  renderAudio();
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
      throw new Error((payload && payload.message) || errorCopy.processFailed || fallbackCopy.errors.processFailed);
    }

    state.result = payload;
    const outputAudioBlob = createAudioBlob(payload.outputAudioBase64, payload.outputAudioMimeType);
    activeAudioUrl = URL.createObjectURL(outputAudioBlob);
    state.audioSrc = activeAudioUrl;
    state.audioDownloadName = createDownloadName();
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
    state.error = errorCopy.mediaRecorderMissing || fallbackCopy.errors.mediaRecorderMissing;
    render();
    return;
  }

  try {
    state.isPreparingRecorder = true;
    state.error = null;
    state.result = null;
    revokeAudioUrl();
    state.audioSrc = null;
    state.audioDownloadName = createDownloadName();
    state.playbackNeedsTap = false;
    renderAudio();
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
        state.error = errorCopy.tooShort || fallbackCopy.errors.tooShort;
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
    state.error = errorCopy.micDenied || fallbackCopy.errors.micDenied;
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
window.addEventListener('beforeunload', revokeAudioUrl);

loadConfig();
