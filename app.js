/* app.js — vocabulary trainer with theme, Lottie logo, and smoother UI */

// ------------------------------
// Small helper: debounce
// ------------------------------
function debounce(fn, delay = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ------------------------------
// Theme toggle + Lottie logo
// ------------------------------
const THEME_KEY = 'vt_theme';
const themeToggle = document.getElementById('themeToggle');
const navEl = document.querySelector('.navbar');
let logoLottieInstance = null;

function loadLogoLottie(theme) {
  const logoContainer = document.getElementById('logoLottie');
  if (!logoContainer || typeof lottie === 'undefined') return;

  if (logoLottieInstance) {
    logoLottieInstance.destroy();
    logoLottieInstance = null;
  }

  const path =
    theme === 'dark'
      ? 'https://assets7.lottiefiles.com/packages/lf20_nDZD95BlQM.json'
      : 'https://assets5.lottiefiles.com/packages/lf20_V9t630.json';

  logoLottieInstance = lottie.loadAnimation({
    container: logoContainer,
    renderer: 'svg',
    loop: true,
    autoplay: true,
    path
  });
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    navEl && navEl.classList.add('navbar-dark');
    navEl && navEl.classList.remove('navbar-light');
  } else {
    document.documentElement.classList.remove('dark');
    navEl && navEl.classList.remove('navbar-dark');
    navEl && navEl.classList.add('navbar-light');
  }
  if (theme === 'dark') {
    themeToggle && (themeToggle.textContent = '☀️');
    themeToggle && themeToggle.setAttribute('aria-pressed', 'true');
  } else {
    themeToggle && (themeToggle.textContent = '🌙');
    themeToggle && themeToggle.setAttribute('aria-pressed', 'false');
  }
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {}
  loadLogoLottie(theme);
}

function toggleTheme() {
  const cur = document.documentElement.classList.contains('dark')
    ? 'dark'
    : 'light';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}

(function () {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) applyTheme(saved);
  else {
    const prefersDark =
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
})();
themeToggle && themeToggle.addEventListener('click', toggleTheme);

// ------------------------------
// Data model & storage
// ------------------------------
const API_URL =
  "https://script.google.com/macros/s/AKfycbxDQj4g7KH82V-2N9YyoVEWIwyIEAv8wr-DkiCOvL5mxvP9B1C-ifSKkohRVZcF_hqjug/exec";

let vocab = []; // words ของ user ปัจจุบัน

// --------- user helpers ----------
function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("vt_user") || "null");
  } catch (e) {
    return null;
  }
}

function updateUserUI() {
  const u = getCurrentUser();
  const pill = document.getElementById("userPill");
  const nameEl = document.getElementById("userName");
  const avatarEl = document.getElementById("userAvatar");

  if (!pill || !nameEl || !avatarEl) return;

  if (u && (u.display_name || u.username)) {
    const name = (u.display_name || u.username).trim();
    nameEl.textContent = name;

    const initial = name ? name.charAt(0).toUpperCase() : "?";
    avatarEl.textContent = initial;

    pill.style.display = "flex";
  } else {
    pill.style.display = "none";
  }
}

function logout() {
  localStorage.removeItem("vt_user");
  window.location.href = "index.html";
}

// ------------------------------
// LOAD from backend
// ------------------------------
async function loadAll() {
  const user = getCurrentUser();
  if (!user || !user.id) {
    window.location.href = "index.html";
    return;
  }

  try {
    const res = await fetch(
      `${API_URL}?action=loadAll&userId=${encodeURIComponent(user.id)}`,
      {
        method: "GET",
        redirect: "follow",
      }
    );
    if (!res.ok) throw new Error("HTTP " + res.status);

    const json = await res.json();
    if (!json.success) {
      console.error("API loadAll error:", json.error);
      alert("โหลดคำศัพท์ไม่สำเร็จ: " + (json.error || "unknown error"));
      vocab = [];
      return;
    }

    const rows = Array.isArray(json.rows) ? json.rows : [];

    vocab = rows.map((r) => ({
      id: r.id,
      word: r.word || r.eng || "",
      translation: r.translation || r.thai || "",
      correct: Number(r.correct || 0),
      wrong: Number(r.wrong || 0),
      lastSeen: r.lastSeen || null,
    }));
  } catch (err) {
    console.error("loadAll() failed", err);
    alert("โหลดคำศัพท์ไม่สำเร็จ (ดู console สำหรับรายละเอียด)");
    vocab = [];
  }
}

// ------------------------------
// SAVE to backend
//   - ส่ง vocab ทั้งชุดของ user นี้ไป
//   - backend จะ rebuild words + stats ของ user ตาม data นี้
//   - ถ้า vocab.length === 0  ⇒ ลบคำทั้งหมดของ user นั้น ๆ
// ------------------------------
function saveAll() {
  const user = getCurrentUser();
  if (!user || !user.id) return;

  const payload = {
    action: "saveAll",
    userId: user.id,
    data: vocab,
  };

  updateStatsUI();

  fetch(API_URL, {
    method: "POST",
    redirect: "follow",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.error("saveAll() failed", err);
  });
}

/* ------------------------------
  Tab handling
-------------------------------*/
document.querySelectorAll('.nav-link').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.nav-link').forEach(x =>
      x.classList.remove('active')
    );
    t.classList.add('active');
    const tab = t.dataset.tab;
    document.querySelectorAll('[id^="panel-"]').forEach(
      p => (p.style.display = 'none')
    );
    document.getElementById('panel-' + tab).style.display = 'block';
    refreshUI();

    const navCollapse = document.getElementById('mainNav');
    const navToggler = document.querySelector('.navbar-toggler');
    if (navCollapse && navCollapse.classList.contains('show') && navToggler) {
      navToggler.click();
    }
  });
});

/* ------------------------------
  Library functions
-------------------------------*/

function renderLibraryImmediate() {
  const list = document.getElementById('list');

  list.innerHTML = '';
  const q = (document.getElementById('search').value || '').toLowerCase();
  const filter = document.getElementById('filter').value;
  let items = vocab.map((it, i) => ({ ...it, idx: i }));
  if (filter === 'weak') items = items.filter(i => (i.wrong || 0) >= 2);
  if (filter === 'mastered') items = items.filter(i => (i.correct || 0) >= 3);
  if (q)
    items = items.filter(i =>
      (i.word + ' ' + i.translation).toLowerCase().includes(q)
    );
  if (!items.length) {
    list.innerHTML = '<div class="small small-muted">ไม่มีคำศัพท์</div>';
    return;
  }
  items.forEach(it => {
    const el = document.createElement('div');
    el.className =
      'list-group-item d-flex justify-content-between align-items-center';
    el.innerHTML = `
      <div class="d-flex gap-3 align-items-center">
        <div class="badge bg-light text-muted" style="min-width:44px;text-align:center">${
          it.idx + 1
        }</div>
        <div>
          <div class="fw-bold text-word">${escapeHtml(it.word)}</div>
          <div class="small text-muted text-list">${escapeHtml(
            it.translation
          )}</div>
          <div class="small">✅ ${it.correct || 0} ❌ ${it.wrong || 0}</div>
        </div>
      </div>
      <div class="d-flex gap-2 align-items-center text-list">
        <button class="btn btn-icon-circle icon-sound btn-sm" onclick="playENIndex(${
          it.idx
        })">
          <img src="./icon/sound.png" alt="sound" class="icon-static" />
        </button>
        <button class="btn btn-icon-circle icon-edit btn-sm" onclick="editItem(${
          it.idx
        })">
          <img src="./icon/edit.png" alt="edit" class="icon-static" />
        </button>
        <button class="btn btn-icon-circle icon-delete btn-sm" onclick="deleteItem(${
          it.idx
        })">
          <img src="./icon/delete.png" alt="delete" class="icon-static" />
        </button>
      </div>`;
    list.appendChild(el);
  });
}

window.renderLibrary = debounce(renderLibraryImmediate, 120);

function isDuplicateWord(word) {
  const w = String(word || '').trim().toLowerCase();
  if (!w) return false;
  return vocab.some(
    v => String(v.word || '').trim().toLowerCase() === w
  );
}

function addWord() {
  const w = document.getElementById('inputWord').value.trim();
  const t = document.getElementById('inputTrans').value.trim();
  if (!w || !t) {
    alert('กรุณากรอก Word และ Translation');
    return;
  }

  if (isDuplicateWord(w)) {
    alert('มีคำนี้อยู่แล้วในคลัง: ' + w);
    return;
  }

  vocab.push({
    word: w,
    translation: t,
    correct: 0,
    wrong: 0,
    lastSeen: Date.now()
  });

  document.getElementById('inputWord').value = '';
  document.getElementById('inputTrans').value = '';
  saveAll();
  renderLibraryImmediate();
}

function editItem(i) {
  const it = vocab[i];
  const nw = prompt('แก้คำศัพท์', it.word);
  if (nw === null) return;
  const nt = prompt('แก้คำแปล', it.translation);
  if (nt === null) return;
  const trimmedW = nw.trim();
  const trimmedT = nt.trim();

  if (
    trimmedW &&
    trimmedW.toLowerCase() !== it.word.trim().toLowerCase() &&
    isDuplicateWord(trimmedW)
  ) {
    alert('มีคำนี้อยู่แล้วในคลัง: ' + trimmedW);
    return;
  }

  it.word = trimmedW;
  it.translation = trimmedT;
  it.lastSeen = Date.now();

  saveAll();
  renderLibraryImmediate();
}

// ✅ ปุ่มลบ 1 คำ: vocab.splice + saveAll()
//    backend จะ rebuild words+stats ใหม่ของ user โดยไม่มีคำนี้ → stats ก็หายด้วย
function deleteItem(i) {
  if (!confirm('ลบคำศัพท์นี้ทั้งหมด (รวมสถิติ)?')) return;
  vocab.splice(i, 1);
  saveAll();
  renderLibraryImmediate();
  updateStatsUI();
}

// ✅ ปุ่ม Clear: ล้าง vocab แล้ว saveAll()
//    backend เห็น items=[] ⇒ ลบคำ + stats ทุกคำของ user นี้
function clearAll() {
  if (!confirm('ล้างคำศัพท์ทั้งหมดของคุณ (รวมสถิติทุกคำ)?')) return;
  vocab = [];
  saveAll();
  renderLibraryImmediate();
  updateStatsUI();
}

/* ------------------------------
  Import / Export CSV
-------------------------------*/

function importItems(newItems) {
  if (!newItems || !newItems.length) {
    alert('ไม่พบคำที่จะนำเข้า');
    return;
  }

  let added = 0;
  let duplicated = 0;
  const dupSamples = [];

  newItems.forEach(row => {
    const w = String(row.word || '').trim();
    const t = String(row.translation || '').trim();
    if (!w || !t) return;

    if (isDuplicateWord(w)) {
      duplicated++;
      if (dupSamples.length < 5) dupSamples.push(w);
      return;
    }

    vocab.push({
      word: w,
      translation: t,
      correct: 0,
      wrong: 0,
      lastSeen: Date.now()
    });
    added++;
  });

  saveAll();
  renderLibraryImmediate();

  let msg = `นำเข้าเรียบร้อย: เพิ่มใหม่ ${added} คำ`;
  if (duplicated > 0) {
    msg += `\nข้ามคำซ้ำ ${duplicated} คำ`;
    if (dupSamples.length) {
      msg += `\nตัวอย่างคำซ้ำ: ${dupSamples.join(', ')}`;
    }
  }
  alert(msg);
}

function handleImportFile(e) {
  const f = e.target.files[0];
  if (!f) return;

  Papa.parse(f, {
    header: true,
    skipEmptyLines: true,
    complete(results) {
      const rows = results.data;
      const items = [];
      for (const r of rows) {
        const W = r.Word ?? r.word ?? Object.values(r)[0];
        const T = r.Translation ?? r.translation ?? Object.values(r)[1];
        if (!W || !T) continue;
        items.push({
          word: String(W).trim(),
          translation: String(T).trim()
        });
      }

      if (!items.length) {
        alert('ไม่พบคำในไฟล์');
        return;
      }

      importItems(items);
    },
    error(err) {
      alert('Import failed: ' + err.message);
    }
  });
}

function importFromPaste() {
  const txt = document.getElementById('pasteCsv').value.trim();
  if (!txt) {
    alert('วาง CSV ก่อน');
    return;
  }

  const parsed = Papa.parse(txt, { header: true, skipEmptyLines: true });
  const rows = parsed.data;
  const items = [];

  for (const r of rows) {
    const W = r.Word ?? r.word ?? Object.values(r)[0];
    const T = r.Translation ?? r.translation ?? Object.values(r)[1];
    if (!W || !T) continue;
    items.push({
      word: String(W).trim(),
      translation: String(T).trim()
    });
  }

  if (!items.length) {
    alert('ไม่พบคำในข้อมูลที่วาง');
    return;
  }

  importItems(items);
}

/* ------------------------------
  Practice (flashcards)
-------------------------------*/
let practiceQueue = [],
  practiceIndex = 0;
let shuffleMode = false;

let autoSoundPractice = true;
let autoSoundQuiz = true;

function toggleAutoSoundPractice(isOn) {
  autoSoundPractice = !!isOn;
}
function toggleAutoSoundQuiz(isOn) {
  autoSoundQuiz = !!isOn;
}

function toggleShuffle(btn) {
  shuffleMode = !shuffleMode;
  if (btn) {
    btn.classList.toggle('btn-primary', shuffleMode);
    btn.classList.toggle('btn-outline-secondary', !shuffleMode);
    btn.setAttribute('aria-pressed', String(shuffleMode));
    btn.textContent = shuffleMode ? 'Shuffle: ON' : 'Shuffle';
  } else {
    const b = document.getElementById('shuffleBtn');
    if (b) toggleShuffle(b);
  }

  if (practiceQueue.length) {
    if (shuffleMode) {
      shuffleArray(practiceQueue);
      practiceIndex = 0;
      showPracticeCard();
    } else {
      const s = parseInt(document.getElementById('pStart').value) || 1;
      const e = parseInt(document.getElementById('pEnd').value) || vocab.length;
      const start = Math.max(1, s) - 1,
        end = Math.min(vocab.length, e);
      const curIdx = parseInt(
        document.getElementById('practiceCard').dataset.idx || -1
      );
      practiceQueue = [];
      for (let i = start; i < end; i++) practiceQueue.push(i);
      practiceIndex = practiceQueue.indexOf(curIdx);
      if (practiceIndex === -1) practiceIndex = 0;
      showPracticeCard();
    }
  } else {
    showPracticeCard();
  }
}

function startPractice() {
  if (!vocab.length) return alert('ไม่มีคำศัพท์');
  const s = parseInt(document.getElementById('pStart').value) || 1;
  const e = parseInt(document.getElementById('pEnd').value) || vocab.length;
  const start = Math.max(1, s) - 1,
    end = Math.min(vocab.length, e);
  if (start >= end) return alert('ช่วงคำไม่ถูกต้อง');
  practiceQueue = [];
  for (let i = start; i < end; i++) practiceQueue.push(i);

  if (shuffleMode) shuffleArray(practiceQueue);

  practiceIndex = 0;
  document.getElementById('practiceCard').style.display = 'block';
  showPracticeCard();
}

function showPracticeCard() {
  const pIDEl = document.getElementById('pID');
  if (!practiceQueue.length) {
    if (pIDEl) pIDEl.style.display = '';
    document.getElementById('pWord').textContent = '';
    document.getElementById('pTrans').textContent = '';
    document.getElementById('pTrans').style.display = 'none';
    document.getElementById('practiceCard').dataset.idx = -1;
    document.getElementById('pCount').textContent = '0';
    document.getElementById('pIndex').textContent = '0';
    document.getElementById('pProgress').style.width = '0%';
    return;
  }

  if (practiceIndex >= practiceQueue.length) practiceIndex = 0;
  const idx = practiceQueue[practiceIndex];
  const it = vocab[idx];

  if (pIDEl) {
    if (shuffleMode) {
      pIDEl.style.display = 'none';
    } else {
      pIDEl.style.display = '';
      pIDEl.textContent =
        typeof idx === 'number' && idx >= 0 ? idx + 1 : '—';
    }
  }

  document.getElementById('pWord').textContent = it ? it.word : '(no word)';
  document.getElementById('pTrans').textContent = it ? it.translation : '';
  document.getElementById('pTrans').style.display = 'none';
  document.getElementById('practiceCard').dataset.idx = idx;
  document.getElementById('pCount').textContent = practiceQueue.length;
  document.getElementById(
    'pIndex'
  ).textContent = `${practiceIndex + 1} / ${practiceQueue.length}`;
  const pct = Math.round(
    ((practiceIndex + 1) / practiceQueue.length) * 100
  );
  document.getElementById('pProgress').style.width = pct + '%';

  if (autoSoundPractice) {
    setTimeout(() => {
      try {
        playEN('practice');
      } catch (e) {
        console.warn('TTS play failed', e);
      }
    }, 60);
  }
}

function revealPractice() {
  document.getElementById('pTrans').style.display = 'block';
}
function nextPractice() {
  practiceIndex++;
  if (practiceIndex >= practiceQueue.length) practiceIndex = 0;
  showPracticeCard();
}
function shufflePractice() {
  if (!practiceQueue.length) {
    toggleShuffle(document.getElementById('shuffleBtn'));
    return;
  }
  shuffleArray(practiceQueue);
  practiceIndex = 0;
  showPracticeCard();
}
function markKnown() {
  const idx = parseInt(
    document.getElementById('practiceCard').dataset.idx || -1
  );
  if (idx < 0) return;
  vocab[idx].correct = (vocab[idx].correct || 0) + 1;
  vocab[idx].lastSeen = Date.now();
  saveAll();
  nextPractice();
}

function markWrong() {
  const idx = parseInt(
    document.getElementById('practiceCard').dataset.idx || -1
  );
  if (idx < 0) return;

  revealPractice();
  vocab[idx].wrong = (vocab[idx].wrong || 0) + 1;
  vocab[idx].lastSeen = Date.now();
  saveAll();

  setTimeout(() => {
    nextPractice();
  }, 800);
}

document.addEventListener('keydown', function (e) {
  const ae = document.activeElement;
  const isTextField =
    ae &&
    (ae.tagName === 'INPUT' ||
      ae.tagName === 'TEXTAREA' ||
      ae.isContentEditable);

  if (isTextField && e.key !== 'Shift') {
    return;
  }

  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    markWrong();
    return;
  }

  if (e.key === 'ArrowRight') {
    e.preventDefault();
    markKnown();
    return;
  }

  if (e.key === 'Shift') {
    e.preventDefault();

    const practiceCard = document.getElementById('practiceCard');
    const quizCard = document.getElementById('quizCard');

    const practiceVisible =
      practiceCard && practiceCard.offsetParent !== null;
    const quizVisible = quizCard && quizCard.offsetParent !== null;

    if (practiceVisible && !quizVisible) {
      playEN('practice');
      return;
    }

    if (quizVisible && !practiceVisible) {
      playEN('quiz');
      return;
    }

    if (quizVisible) {
      playEN('quiz');
      return;
    }
  }
});

function stopPractice() {
  document.getElementById('practiceCard').style.display = 'none';
}
function practiceWeak() {
  const weak = vocab
    .map((it, i) => ({ it, i }))
    .filter(x => (x.it.wrong || 0) >= 2)
    .map(x => x.i);
  if (!weak.length) return alert('ไม่มีคำที่ผิดบ่อย');
  practiceQueue = weak;
  practiceIndex = 0;
  document.getElementById('practiceCard').style.display = 'block';
  showPracticeCard();
}

/* ------------------------------
  Quiz + spelling
-------------------------------*/
// (ส่วน Quiz ทั้งชุดใช้ของเดิมที่คุณมี — ผมคงไว้เหมือนเดิมยกมาแล้วด้านบน)

// ... (โค้ด quiz/spelling ที่คุณวางมาเหมือนเดิมทั้งหมด ไม่ต้องแก้)

// ------------------------------
// Audio
// ------------------------------
let enVoice = null;
function initVoices() {
  const voices = speechSynthesis.getVoices();
  enVoice = voices.find(v => v.lang && v.lang.startsWith('en')) || null;
}
speechSynthesis.onvoiceschanged = initVoices;
initVoices();

function playEN(mode) {
  let text = null;
  if (mode === 'practice') {
    const idx = parseInt(
      document.getElementById('practiceCard').dataset.idx || -1
    );
    if (idx >= 0) text = vocab[idx].word;
  } else if (mode === 'quiz') {
    const q = ensureQuizObj(quizCurrent);
    if (q && q.item) text = q.item.word;
  } else if (typeof mode === 'number') {
    text = vocab[mode] && vocab[mode].word;
  }
  if (!text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  if (enVoice) u.voice = enVoice;
  speechSynthesis.speak(u);
}
function playENIndex(i) {
  playEN(i);
}

/* ------------------------------
  Stats & helpers
-------------------------------*/
function updateStatsUI() {
  document.getElementById('statTotal').textContent = vocab.length;
  document.getElementById('statMaster').textContent = vocab.filter(
    i => (i.correct || 0) >= 3
  ).length;
  document.getElementById('statWeak').textContent = vocab.filter(
    i => (i.wrong || 0) >= 2
  ).length;
  document.getElementById('dTotal').textContent = vocab.length;
  document.getElementById('dMaster').textContent = vocab.filter(
    i => (i.correct || 0) >= 3
  ).length;
  document.getElementById('dWeak').textContent = vocab.filter(
    i => (i.wrong || 0) >= 2
  ).length;
  renderWeakList();
}

function renderWeakList() {
  const el = document.getElementById('weakList');
  el.innerHTML = '';
  const weak = vocab
    .map((it, i) => ({ ...it, i }))
    .filter(x => (x.wrong || 0) >= 2)
    .sort((a, b) => (b.wrong || 0) - (a.wrong || 0));
  weak.forEach(w => {
    const div = document.createElement('div');
    div.className =
      'list-group-item d-flex justify-content-between align-items-center';
    div.innerHTML = `<div class="d-flex gap-3 align-items-center"><div class="badge bg-light text-muted" style="min-width:44px;text-align:center">${
      w.i + 1
    }</div><div><div class="fw-bold text-word">${escapeHtml(
      w.word
    )}</div><div class="small text-muted text-list">${escapeHtml(
      w.translation
    )}</div><div class="small">Wrong: ${
      w.wrong || 0
    }</div></div></div>
        <div class="d-flex gap-2"><button class="btn btn-primary btn-sm" onclick="practiceSingle(${
          w.i
        })">Practice</button><button class="btn btn-outline-secondary btn-sm" onclick="editItem(${
      w.i
    })">Edit</button></div>`;
    el.appendChild(div);
  });
}

function practiceSingle(i) {
  practiceQueue = [i];
  practiceIndex = 0;
  document.getElementById('practiceCard').style.display = 'block';
  showPracticeCard();
}

function resetStats() {
  if (!confirm('Reset stats?')) return;
  vocab.forEach(i => {
    i.correct = 0;
    i.wrong = 0;
  });
  saveAll();
  updateStatsUI();
  alert('Reset done');
}

function shuffleArray(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function refreshUI() {
  renderLibraryImmediate();
  updateStatsUI();
  updateSessionWrong();
}

// เซฟก่อน unload เผื่อ stats เปลี่ยน
window.addEventListener("beforeunload", () => saveAll());

// init app
async function initApp() {
  updateUserUI();
  await loadAll();
  renderLibraryImmediate();
  updateStatsUI();
  updateSessionWrong();
}
initApp();

/* ============================
   FANCY BUTTON RIPPLE EFFECT
   ============================= */
(function initButtonRipple() {
  const buttons = document.querySelectorAll('button, .btn');

  buttons.forEach(btn => {
    const style = window.getComputedStyle(btn);
    if (style.position === 'static') {
      btn.style.position = 'relative';
    }
    if (style.overflow === 'visible') {
      btn.style.overflow = 'hidden';
    }

    btn.addEventListener('click', function (e) {
      const rect = this.getBoundingClientRect();
      const diameter = Math.max(rect.width, rect.height);
      const radius = diameter / 2;

      const circle = document.createElement('span');
      circle.classList.add('ripple');
      circle.style.width = circle.style.height = `${diameter}px`;
      circle.style.left = `${e.clientX - rect.left - radius}px`;
      circle.style.top = `${e.clientY - rect.top - radius}px`;

      const oldRipple = this.querySelector('.ripple');
      if (oldRipple) oldRipple.remove();

      this.appendChild(circle);
    });
  });
})();
