/* ═══════════════════════════════════════════════════
   DermAI — Frontend Application Logic
   Handles: camera, upload, analysis, results rendering
════════════════════════════════════════════════════ */

const API_BASE = (window.location.origin && window.location.origin !== 'null' && !window.location.origin.startsWith('file:'))
  ? `${window.location.origin}/api`
  : 'http://localhost:5000/api';

// ─── State ────────────────────────────────────────
let currentImageData = null;   // base64 string
let currentTab = 'upload';
let cameraStream = null;
let capturedBase64 = null;

// ─── Disease Metadata (fallback if API offline) ───
const DISEASE_META = {
  mel:   { name: "Melanoma", icon: "⚠️", color: "#FF4444", risk: "High Risk - Malignant", desc: "Serious skin cancer from melanocytes." },
  nv:    { name: "Melanocytic Nevi", icon: "ℹ️", color: "#4488FF", risk: "Low Risk - Benign", desc: "Common benign skin moles." },
  bcc:   { name: "Basal Cell Carcinoma", icon: "⚡", color: "#FF8800", risk: "Moderate Risk - Malignant", desc: "Most common skin cancer." },
  akiec: { name: "Actinic Keratosis", icon: "🔶", color: "#FFCC00", risk: "Moderate Risk - Precancerous", desc: "Sun-damage precancerous lesion." },
  bkl:   { name: "Benign Keratosis", icon: "✅", color: "#00BB77", risk: "Low Risk - Benign", desc: "Non-cancerous skin growths." },
  df:    { name: "Dermatofibroma", icon: "🟣", color: "#9944FF", risk: "Very Low Risk - Benign", desc: "Common fibrous skin nodule." },
  vasc:  { name: "Vascular Lesion", icon: "🔴", color: "#FF4488", risk: "Low Risk - Benign", desc: "Blood vessel abnormalities." },
};


/* ═══════════════════════════════════════════════════
   INITIALIZATION
════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  checkAPIStatus();
  renderDiseaseCards();
  initNavbarScroll();
  setInterval(checkAPIStatus, 30000);
});

function initNavbarScroll() {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 80);
  });
}

async function checkAPIStatus() {
  const dot  = document.querySelector('.status-dot');
  const text = document.querySelector('.status-text');
  try {
    const res = await fetch(`${API_BASE}/status`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      dot.className  = `status-dot ${data.models_loaded ? 'online' : 'demo'}`;
      text.textContent = data.mode;
    } else { throw new Error(); }
  } catch {
    dot.className  = 'status-dot';
    text.textContent = 'Offline (demo)';
  }
}


/* ═══════════════════════════════════════════════════
   PARTICLES
════════════════════════════════════════════════════ */
function initParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 3 + 1;
    p.style.cssText = `
      width: ${size}px; height: ${size}px;
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      animation-duration: ${Math.random() * 15 + 10}s;
      animation-delay: ${Math.random() * 10}s;
      background: ${Math.random() > 0.5 ? '#00E5FF' : '#A855F7'};
      opacity: ${Math.random() * 0.5 + 0.2};
    `;
    container.appendChild(p);
  }
}


/* ═══════════════════════════════════════════════════
   NAVIGATION TABS
════════════════════════════════════════════════════ */
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`content-${tab}`).classList.add('active');

  if (tab !== 'camera') stopCamera();
}

function scrollToAnalyzer() {
  document.getElementById('analyzer').scrollIntoView({ behavior: 'smooth' });
}


/* ═══════════════════════════════════════════════════
   FILE UPLOAD
════════════════════════════════════════════════════ */
function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('dropZone').classList.add('drag-over');
}
function handleDragLeave() {
  document.getElementById('dropZone').classList.remove('drag-over');
}
function handleDrop(e) {
  e.preventDefault();
  handleDragLeave();
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadFile(file);
}
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) loadFile(file);
}

function loadFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    currentImageData = e.target.result;
    showUploadPreview(currentImageData);
    enableAnalyze();
  };
  reader.readAsDataURL(file);
}

function showUploadPreview(src) {
  const preview = document.getElementById('imagePreview');
  const img     = document.getElementById('previewImg');
  const dz      = document.getElementById('dropZone');
  img.src = src;
  preview.style.display = 'block';
  dz.style.display = 'none';
}

function clearImage() {
  currentImageData = null;
  document.getElementById('imagePreview').style.display = 'none';
  document.getElementById('dropZone').style.display = 'block';
  document.getElementById('fileInput').value = '';
  disableAnalyze();
}


/* ═══════════════════════════════════════════════════
   CAMERA
════════════════════════════════════════════════════ */
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } }
    });
    cameraStream = stream;
    const video = document.getElementById('videoStream');
    video.srcObject = stream;

    document.getElementById('cameraFrame').classList.add('active');
    document.getElementById('startCamBtn').style.display = 'none';
    document.getElementById('stopCamBtn').style.display = 'flex';
    document.getElementById('captureBtn').disabled = false;
  } catch (err) {
    alert('Camera access denied. Please allow camera permissions and try again.');
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  const video = document.getElementById('videoStream');
  if (video) video.srcObject = null;
  document.getElementById('cameraFrame').classList.remove('active');
  document.getElementById('startCamBtn').style.display = 'flex';
  document.getElementById('stopCamBtn').style.display = 'none';
  document.getElementById('captureBtn').disabled = true;
}

function captureFrame() {
  const video  = document.getElementById('videoStream');
  const canvas = document.getElementById('captureCanvas');
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);

  capturedBase64 = canvas.toDataURL('image/jpeg', 0.9);
  currentImageData = capturedBase64;

  // Show preview
  const camPreview = document.getElementById('camPreview');
  const camImg     = document.getElementById('camPreviewImg');
  camImg.src       = capturedBase64;
  camPreview.style.display = 'block';

  stopCamera();
  enableAnalyze();

  // Flash effect
  document.body.style.backgroundColor = '#fff';
  setTimeout(() => { document.body.style.backgroundColor = ''; }, 150);
}

function clearCamPreview() {
  capturedBase64 = null;
  currentImageData = null;
  document.getElementById('camPreview').style.display = 'none';
  disableAnalyze();
}


/* ═══════════════════════════════════════════════════
   ANALYZE BUTTON STATE
════════════════════════════════════════════════════ */
function enableAnalyze() {
  document.getElementById('analyzeBtn').disabled = false;
}
function disableAnalyze() {
  document.getElementById('analyzeBtn').disabled = true;
}


/* ═══════════════════════════════════════════════════
   MAIN ANALYSIS
════════════════════════════════════════════════════ */
async function analyzeImage() {
  if (!currentImageData) return;

  // Animate to loading state
  setUIState('loading');
  simulateLoadingSteps();

  try {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: currentImageData }),
      signal: AbortSignal.timeout(30000)
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();

    if (!data.success) throw new Error(data.error || 'Analysis failed');

    renderResults(data);
    setUIState('results');
  } catch (err) {
    console.error('Analysis error:', err);
    // Run demo mode locally
    const demoData = generateDemoResult();
    renderResults(demoData);
    setUIState('results');
  }
}

function setUIState(state) {
  const empty   = document.getElementById('resultsEmpty');
  const loading = document.getElementById('resultsLoading');
  const content = document.getElementById('resultsContent');
  const btn     = document.getElementById('analyzeBtn');
  const btnContent = btn.querySelector('.btn-content');
  const btnLoader  = btn.querySelector('.btn-loader');

  empty.style.display   = state === 'empty'   ? 'flex' : 'none';
  loading.style.display = state === 'loading' ? 'flex' : 'none';
  content.style.display = state === 'results' ? 'block' : 'none';

  btnContent.style.display = state === 'loading' ? 'none' : 'flex';
  btnLoader.style.display  = state === 'loading' ? 'flex' : 'none';
  btn.disabled = state === 'loading';
}

function simulateLoadingSteps() {
  const steps = ['step1','step2','step3','step4'];
  steps.forEach((id, i) => {
    document.getElementById(id).className = 'load-step';
    setTimeout(() => {
      steps.slice(0, i).forEach(prev => {
        document.getElementById(prev).className = 'load-step done';
        document.getElementById(prev).textContent = document.getElementById(prev).textContent.replace('...','✓');
      });
      document.getElementById(id).className = 'load-step active';
    }, i * 700);
  });
}


/* ═══════════════════════════════════════════════════
   RESULTS RENDERING
════════════════════════════════════════════════════ */
function renderResults(data) {
  const diag = data.primary_diagnosis;
  const sev  = data.severity;
  const stage = data.stage;

  // ── Primary Diagnosis ──────────────────────────
  const db = document.getElementById('diagnosisBadge');
  db.innerHTML = `${diag.icon || '🔍'} ${diag.code?.toUpperCase() || ''}`;
  db.style.borderColor = diag.color || '#00E5FF';
  db.style.color = diag.color || '#00E5FF';

  // Confidence ring animation
  const pct = diag.confidence || 0;
  const circumference = 201;
  const offset = circumference - (pct / 100) * circumference;
  setTimeout(() => {
    const ring = document.getElementById('confRing');
    ring.style.strokeDashoffset = offset;
    ring.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
  }, 200);
  animateCounter('confNum', pct, '%');

  document.getElementById('diagnosisName').textContent = diag.name || '—';
  document.getElementById('diagnosisName').style.color = diag.color || '#fff';
  document.getElementById('diagnosisDesc').textContent = diag.description || '';

  const riskBadge = document.getElementById('riskBadge');
  riskBadge.textContent = diag.risk_level || '';
  applyRiskStyle(riskBadge, diag.risk_level || '');

  const urgency = document.getElementById('urgencyNotice');
  urgency.textContent = `⚡ ${diag.urgency || ''}`;

  // ── Severity ───────────────────────────────────
  document.getElementById('severityLabel').textContent = sev.label;
  document.getElementById('severityLabel').style.color = sev.color;
  document.getElementById('severityPct').textContent = `${sev.percentage}%`;

  const fill = document.getElementById('severityFill');
  const glow = document.getElementById('severityGlow');
  setTimeout(() => {
    fill.style.width = `${sev.percentage}%`;
    fill.style.background = severityGradient(sev.label);
    glow.style.background = sev.color;
    glow.style.boxShadow = `0 0 10px ${sev.color}`;
  }, 300);

  // ── Stage ─────────────────────────────────────
  document.getElementById('stageName').textContent = stage.stage || '—';
  document.getElementById('stageDesc').textContent = stage.desc || '';
  const survival = document.getElementById('stageSurvival');
  if (stage.survival && stage.survival !== 'N/A') {
    survival.textContent = `5-yr Survival: ${stage.survival}`;
    survival.style.display = 'inline-block';
  } else {
    survival.style.display = 'none';
  }

  // ── Symptoms ──────────────────────────────────
  renderList('symptomList', data.symptoms || [], 'li');

  // ── Treatments ────────────────────────────────
  renderList('treatmentList', data.treatments || [], 'li');

  // ── Prevention ────────────────────────────────
  const prevList = document.getElementById('preventionList');
  prevList.innerHTML = '';
  (data.prevention || []).forEach(p => {
    const span = document.createElement('span');
    span.className = 'prevention-item';
    span.textContent = `🛡 ${p}`;
    prevList.appendChild(span);
  });

  // ── Prediction Bars ───────────────────────────
  const predList = document.getElementById('predictionsList');
  predList.innerHTML = '';
  (data.all_predictions || []).slice(0, 5).forEach((pred, idx) => {
    const row = document.createElement('div');
    row.className = 'pred-row';
    const pct = pred.confidence_pct || Math.round(pred.probability * 100);
    row.innerHTML = `
      <span class="pred-name">${pred.name}</span>
      <div class="pred-bar-track"><div class="pred-bar" style="width:0%" data-w="${pct}%"></div></div>
      <span class="pred-pct">${pct}%</span>
    `;
    predList.appendChild(row);
  });
  // Animate bars
  setTimeout(() => {
    document.querySelectorAll('.pred-bar').forEach(b => {
      b.style.width = b.dataset.w;
    });
  }, 400);

  // ── Disclaimer ────────────────────────────────
  document.getElementById('disclaimerText').textContent = data.disclaimer || '';

  // Scroll to results
  document.getElementById('resultsPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderList(containerId, items, tag) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  items.forEach(item => {
    const li = document.createElement(tag);
    li.textContent = item;
    el.appendChild(li);
  });
}

function applyRiskStyle(el, risk) {
  if (risk.includes('High') || risk.includes('Malignant')) {
    el.style.background = 'rgba(239,68,68,0.12)';
    el.style.color = '#EF4444';
    el.style.border = '1px solid rgba(239,68,68,0.3)';
  } else if (risk.includes('Moderate') || risk.includes('Precancerous')) {
    el.style.background = 'rgba(245,158,11,0.12)';
    el.style.color = '#F59E0B';
    el.style.border = '1px solid rgba(245,158,11,0.3)';
  } else {
    el.style.background = 'rgba(34,197,94,0.12)';
    el.style.color = '#22C55E';
    el.style.border = '1px solid rgba(34,197,94,0.3)';
  }
}

function severityGradient(label) {
  const map = {
    Mild:     'linear-gradient(90deg, #22C55E, #4ADE80)',
    Moderate: 'linear-gradient(90deg, #F59E0B, #FBBF24)',
    Severe:   'linear-gradient(90deg, #EF4444, #F87171)',
    Critical: 'linear-gradient(90deg, #7C3AED, #A855F7)',
  };
  return map[label] || '#00E5FF';
}

function animateCounter(id, target, suffix = '') {
  const el = document.getElementById(id);
  let current = 0;
  const step = target / 40;
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = `${Math.round(current)}${suffix}`;
    if (current >= target) clearInterval(timer);
  }, 30);
}

function resetAnalysis() {
  currentImageData = null;
  capturedBase64 = null;
  clearImage();
  clearCamPreview();
  setUIState('empty');
  disableAnalyze();
  document.getElementById('confRing').style.strokeDashoffset = '201';
  document.getElementById('confRing').style.transition = 'none';
  document.getElementById('severityFill').style.width = '0%';
  document.getElementById('uploadPanel').scrollIntoView({ behavior: 'smooth' });
}


/* ═══════════════════════════════════════════════════
   DEMO RESULT (when API is offline)
════════════════════════════════════════════════════ */
function generateDemoResult() {
  const classes = Object.keys(DISEASE_META);
  const idx = Math.floor(Math.random() * classes.length);
  const code = classes[idx];
  const meta = DISEASE_META[code];

  const probs = classes.map((c, i) => ({
    code: c, name: DISEASE_META[c].name,
    probability: i === idx ? 0.72 : Math.random() * 0.15,
    confidence_pct: i === idx ? 72 : Math.floor(Math.random() * 15)
  })).sort((a, b) => b.probability - a.probability);

  const severityLabels = ['Mild','Moderate','Severe'];
  const sevLabel = severityLabels[Math.floor(Math.random() * 3)];
  const sevPct = { Mild: 22, Moderate: 48, Severe: 71 }[sevLabel];

  return {
    success: true,
    mode: 'Demo Mode',
    primary_diagnosis: {
      code, name: meta.name, icon: meta.icon,
      description: meta.desc, confidence: 72,
      risk_level: meta.risk, color: meta.color,
      urgency: 'Please consult a qualified dermatologist for proper evaluation'
    },
    severity: { label: sevLabel, percentage: sevPct, color: { Mild:'#22C55E', Moderate:'#F59E0B', Severe:'#EF4444' }[sevLabel] },
    stage: { stage: 'Stage I', desc: 'Early stage lesion, localized presentation', survival: 'N/A' },
    symptoms: ['Visible lesion or spot', 'Color variation', 'Border irregularity', 'Surface texture change'],
    treatments: ['Dermatoscopy examination', 'Biopsy if suspicious', 'Photographic monitoring', 'UV protection'],
    prevention: ['Daily sunscreen SPF50+', 'Annual skin check', 'Avoid tanning beds', 'Protective clothing'],
    all_predictions: probs,
    disclaimer: '⚠️ DEMO MODE: Running without trained AI model. This result is for demonstration only. Always consult a qualified dermatologist for medical diagnosis.'
  };
}


/* ═══════════════════════════════════════════════════
   DISEASE CARDS
════════════════════════════════════════════════════ */
function renderDiseaseCards() {
  const grid = document.getElementById('diseasesGrid');
  if (!grid) return;

  fetch(`${API_BASE}/diseases`)
    .then(r => r.json())
    .then(data => populateDiseaseCards(grid, data))
    .catch(() => populateDiseaseCards(grid, buildFallbackDiseases()));
}

function buildFallbackDiseases() {
  return {
    mel:   { name: "Melanoma", icon: "⚠️", color: "#FF4444", risk_level: "High Risk - Malignant", description: "Serious skin cancer from melanocytes. Irregular borders, multiple colors, asymmetric.", stages: [{stage:"Stage I"},{stage:"Stage II"},{stage:"Stage III"},{stage:"Stage IV"}], symptoms:["Asymmetric mole","Irregular borders","Multiple colors"] },
    nv:    { name: "Melanocytic Nevi", icon: "ℹ️", color: "#4488FF", risk_level: "Low Risk - Benign", description: "Common benign skin moles. Uniform color, round shape, stable size.", stages:[{stage:"Congenital"},{stage:"Junctional"},{stage:"Compound"}], symptoms:["Uniform color","Round shape","Stable"] },
    bcc:   { name: "Basal Cell Carcinoma", icon: "⚡", color: "#FF8800", risk_level: "Moderate Risk - Malignant", description: "Most common skin cancer. Pearly/waxy bump, often on face/neck.", stages:[{stage:"Superficial"},{stage:"Nodular"},{stage:"Infiltrative"}], symptoms:["Pearly bump","Bleeding sore","Flat lesion"] },
    akiec: { name: "Actinic Keratosis", icon: "🔶", color: "#FFCC00", risk_level: "Moderate Risk - Precancerous", description: "Rough scaly patch from sun exposure. Precancerous condition.", stages:[{stage:"Grade I"},{stage:"Grade II"},{stage:"Grade III"}], symptoms:["Rough dry patch","Pink/red color","Itching"] },
    bkl:   { name: "Benign Keratosis", icon: "✅", color: "#00BB77", risk_level: "Low Risk - Benign", description: "Non-cancerous growths including seborrheic keratoses.", stages:[{stage:"Early"},{stage:"Intermediate"},{stage:"Advanced"}], symptoms:["Waxy stuck-on look","Variable color","No ulceration"] },
    df:    { name: "Dermatofibroma", icon: "🟣", color: "#9944FF", risk_level: "Very Low Risk - Benign", description: "Benign fibrous skin nodule, usually on legs.", stages:[{stage:"Single Lesion"},{stage:"Multiple Lesions"}], symptoms:["Firm bump","Dimples when pinched","Brown/red color"] },
    vasc:  { name: "Vascular Lesion", icon: "🔴", color: "#FF4488", risk_level: "Low Risk - Benign", description: "Blood vessel abnormalities including cherry angiomas.", stages:[{stage:"Superficial"},{stage:"Deep"},{stage:"Extensive"}], symptoms:["Bright red spots","Spider vessels","Easy bleeding"] },
  };
}

function populateDiseaseCards(grid, diseases) {
  grid.innerHTML = '';
  Object.entries(diseases).forEach(([code, d]) => {
    const card = document.createElement('div');
    card.className = 'disease-card';
    card.style.setProperty('--card-color', d.color || '#00E5FF');
    card.style.borderTopColor = d.color || 'transparent';
    card.innerHTML = `
      <div class="disease-card-header">
        <span class="disease-icon">${d.icon || '🔬'}</span>
        <div>
          <div class="disease-card-title">${d.name}</div>
          <div class="disease-card-code">${code.toUpperCase()}</div>
        </div>
      </div>
      <div class="disease-risk" style="background:${hexToRgba(d.color,0.12)};color:${d.color};border:1px solid ${hexToRgba(d.color,0.35)}">${d.risk_level || ''}</div>
      <div class="disease-desc">${d.description || ''}</div>
      <div class="disease-tags">
        ${(d.stages || []).slice(0, 3).map(s => `<span class="disease-tag">${typeof s === 'object' ? s.stage : s}</span>`).join('')}
      </div>
    `;
    card.style.setProperty('--before-bg', d.color || '#00E5FF');
    card.style.cssText += `--_color:${d.color}`;
    card.querySelector('.disease-card::before') && (card.style.background = `linear-gradient(135deg,rgba(${hexToRgb(d.color)},0.04),transparent)`);

    // Add colored top border
    const topBar = document.createElement('div');
    topBar.style.cssText = `position:absolute;top:0;left:0;right:0;height:3px;background:${d.color};border-radius:20px 20px 0 0;opacity:0.8`;
    card.style.position = 'relative';
    card.style.overflow = 'hidden';
    card.appendChild(topBar);

    card.addEventListener('click', () => highlightDisease(code));
    grid.appendChild(card);
  });
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

function highlightDisease(code) {
  document.getElementById('analyzer').scrollIntoView({ behavior: 'smooth' });
}
