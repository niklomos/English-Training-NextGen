/* app.js — vocabulary trainer with theme, Lottie logo, and smoother UI */

// ------------------------------
// Small helper: debounce (ลด call ถี่ ๆ เช่น search)
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
      ? 'https://assets7.lottiefiles.com/packages/lf20_nDZD95BlQM.json' // dark
      : 'https://assets5.lottiefiles.com/packages/lf20_V9t630.json'; // light

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

// init theme
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
// Data model & storage (Google Sheet + multi-user)
// ------------------------------
const API_URL =
  "https://script.google.com/macros/s/AKfycbxDQj4g7KH82V-2N9YyoVEWIwyIEAv8wr-DkiCOvL5mxvP9B1C-ifSKkohRVZcF_hqjug/exec";

// vocab ของ user ปัจจุบัน
let vocab = [];

// ดึง user ปัจจุบันจาก localStorage
function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("vt_user") || "null");
  } catch (e) {
    return null;
  }
}

// แสดงชื่อ user ใน navbar
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

// logout
function logout() {
  localStorage.removeItem("vt_user");
  window.location.href = "index.html";
}

// โหลด vocab จาก Google Sheet (words + stats ของ user)
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
    const rows = json.rows || [];

    vocab = rows.map((r) => ({
      id: r.id, // word_id
      word: r.word || r.eng || "",
      translation: r.translation || r.thai || "",
      correct: Number(r.correct || 0),
      wrong: Number(r.wrong || 0),
      lastSeen: r.lastSeen || null,
    }));
  } catch (err) {
    console.error("loadAll() failed", err);
    vocab = [];
  }
}

// เซฟ vocab ทั้งหมดไป Google Sheet
function saveAll() {
  const user = getCurrentUser();
  if (!user || !user.id) return;

  updateStatsUI(); // อัปเดต UI ทันที

  const payload = {
    action: "saveAll",
    userId: user.id,
    data: vocab,
  };

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
  Tab handling (uses data-tab attributes)
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

    // ปิดเมนูแบบ smooth ใน mobile โดยให้ Bootstrap จัดการ
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

// ตัว render จริง (เรียกตรง ๆ ตอน add / import / clear)
function renderLibraryImmediate() {
  const list = document.getElementById('list');

  // destroy Lottie เก่าก่อนเคลียร์ list เพื่อลด memory / CPU leak (ถ้าเคยมี)
  list.querySelectorAll('.lottie-icon').forEach(icon => {
    if (icon._lottieInstance) {
      icon._lottieInstance.destroy();
      icon._lottieInstance = null;
    }
  });

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

// เวอร์ชัน debounce สำหรับ search (เรียกจาก oninput ใน HTML)
window.renderLibrary = debounce(renderLibraryImmediate, 120);

// helper: เช็กว่ามีคำนี้อยู่แล้วหรือยัง (เทียบเฉพาะ word, ไม่สนตัวพิมพ์เล็กใหญ่)
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

  // กันคำซ้ำ
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

  // ถ้าแก้แล้วไปชนคำอื่น
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

function deleteItem(i) {
  if (!confirm('ลบคำศัพท์?')) return;
  vocab.splice(i, 1);
  saveAll();
  renderLibraryImmediate();
}

function clearAll() {
  if (!confirm('ล้างทั้งหมด?')) return;
  vocab = [];
  saveAll();
  renderLibraryImmediate();
}

/* ------------------------------
  Import / Export CSV
-------------------------------*/

// import คำหลายคำแบบกันคำซ้ำ
// newItems = [{word:'...', translation:'...'}, ...]
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

      // เพิ่มแบบกันคำซ้ำ
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

  // เพิ่มแบบกันคำซ้ำ
  importItems(items);
}

function autoFixPaste() {
  const txt = document.getElementById('pasteCsv').value;
  if (!txt) return alert('วางข้อความก่อน');
  try {
    if (/%[0-9A-F]{2}/i.test(txt)) {
      document.getElementById('pasteCsv').value = decodeURIComponent(txt);
      alert('decodeURIComponent applied');
      return;
    }
    document.getElementById('pasteCsv').value = decodeURIComponent(escape(txt));
    alert('attempted latin1->utf8 conversion');
  } catch (e) {
    alert('ไม่สามารถแปลงอัตโนมัติได้');
  }
}

function exportCSV() {
  if (!vocab.length) return alert('ไม่มีคำศัพท์');
  const rows = vocab.map(i => ({ Word: i.word, Translation: i.translation }));
  const csv = Papa.unparse(rows);
  const blob = new Blob(['\uFEFF' + csv], {
    type: 'text/csv;charset=utf-8;'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vocabulary.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function copyCSV() {
  if (!vocab.length) return alert('ไม่มีคำศัพท์');
  const rows = vocab.map(i => ({ Word: i.word, Translation: i.translation }));
  const csv = Papa.unparse(rows);
  try {
    await navigator.clipboard.writeText(csv);
    alert('คัดลอกเรียบร้อย');
  } catch (e) {
    alert('คัดลอกล้มเหลว');
  }
}

/* ------------------------------
  Practice (flashcards)
-------------------------------*/
let practiceQueue = [],
  practiceIndex = 0;
let shuffleMode = false;

// auto sound toggle สำหรับ practice & quiz
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

  if (shuffleMode) {
    if (pIDEl) pIDEl.style.display = 'none';
  } else {
    if (pIDEl) {
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

  // เล่นเสียงอัตโนมัติ เฉพาะตอนที่เปิด auto sound ไว้
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

  // กด Show อัตโนมัติ -> แสดงคำแปล
  revealPractice();

  // นับสถิติ wrong ตามปกติ
  vocab[idx].wrong = (vocab[idx].wrong || 0) + 1;
  vocab[idx].lastSeen = Date.now();
  saveAll();

  // รอให้เราเห็นคำตอบแป๊บหนึ่งแล้วค่อย Next ไปข้อถัดไป
  setTimeout(() => {
    nextPractice();
  }, 800); // ปรับเวลาได้ตามชอบ เช่น 500, 1000 ms
}

/* ===== Keyboard shortcuts: Left = Known, Right = Wrong, Shift = sound ===== */
document.addEventListener('keydown', function (e) {
  const ae = document.activeElement;
  const isTextField =
    ae &&
    (ae.tagName === 'INPUT' ||
      ae.tagName === 'TEXTAREA' ||
      ae.isContentEditable);

  // ถ้าโฟกัสอยู่ใน input/textarea: ปิด shortcut ทั้งหมด ยกเว้นปุ่ม Shift (ใช้เล่นเสียงได้)
  if (isTextField && e.key !== 'Shift') {
    return;
  }

  // ซ้าย = Known
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    markWrong();
    return;
  }

  // ขวา = Wrong
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    markKnown();
    return;
  }

  // Shift = เล่นเสียง EN (ตามหน้า) แม้โฟกัสอยู่ในช่องพิมพ์ก็ได้
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

    // ถ้าเผื่ออนาคตดันเห็นทั้งคู่ ให้ priority กับ Quiz
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
let quizQueue = [],
  quizScore = 0,
  quizTotal = 0,
  quizCurrent = null,
  sessionWrong = [],
  quizRandomize = false,
  quizFixedMode = null;

function ensureQuizObj(q) {
  if (!q) return null;

  if (typeof q === 'object' && !Array.isArray(q)) {
    if (q.item && (q.item.word !== undefined || q.item.translation !== undefined)) {
      return {
        idx:
          q.idx !== undefined ? q.idx : q.i !== undefined ? q.i : -1,
        item: {
          word: String(q.item.word || ''),
          translation: String(q.item.translation || '')
        },
        mode: q.mode,
        options: q.options
      };
    }
    const word =
      q.word !== undefined ? q.word : q[0] !== undefined ? q[0] : '';
    const translation =
      q.translation !== undefined
        ? q.translation
        : q[1] !== undefined
        ? q[1]
        : '';
    const idx =
      q.idx !== undefined
        ? q.idx
        : q.i !== undefined
        ? q.i
        : typeof q[2] === 'number'
        ? q[2]
        : -1;
    return {
      idx: idx,
      item: { word: String(word || ''), translation: String(translation || '') },
      mode: q.mode,
      options: q.options
    };
  }

  if (Array.isArray(q)) {
    let idx = null,
      word = '',
      translation = '';
    if (typeof q[0] === 'number') {
      idx = q[0];
      word = q[1] || '';
      translation = q[2] || '';
    } else if (typeof q[q.length - 1] === 'number') {
      idx = q[q.length - 1];
      word = q[0] || '';
      translation = q[1] || '';
    } else {
      word = q[0] || '';
      translation = q[1] || '';
    }
    if (idx === null || idx === -1) {
      const found = vocab.findIndex(
        v =>
          v.word === word &&
          (translation ? v.translation === translation : true)
      );
      idx = found >= 0 ? found : -1;
    }
    return {
      idx: idx,
      item: { word: String(word || ''), translation: String(translation || '') }
    };
  }

  return null;
}

function startQuiz() {
  if (!vocab.length) return alert('ไม่มีคำศัพท์');
  const s = parseInt(document.getElementById('qStart').value) || 1;
  const e = parseInt(document.getElementById('qEnd').value) || vocab.length;
  const start = Math.max(1, s) - 1,
    end = Math.min(vocab.length, e);
  if (start >= end) return alert('ช่วงคำไม่ถูกต้อง');

  quizRandomize = document.getElementById('randomMode').checked;
  const fixedMode = document.getElementById('qMode').value;
  quizFixedMode = quizRandomize ? null : fixedMode;

  quizQueue = [];
  for (let i = start; i < end; i++) quizQueue.push(i);
  shuffleArray(quizQueue);

  quizTotal = quizQueue.length;
  quizScore = 0;
  sessionWrong = [];
  updateSessionWrong();
  document.getElementById('qScore').textContent = `${quizScore} / ${quizTotal}`;

  document.getElementById('quizCard').style.display = 'block';
  document.getElementById('spellingArea').style.display = 'none';
  showNextQuiz(quizRandomize ? null : quizFixedMode);
}

function showNextQuiz(mode) {
  if (!quizQueue.length) {
    alert(`จบแบบทดสอบ! คะแนน: ${quizScore} / ${quizTotal}`);
    renderSessionWrong();
    return;
  }
  const idx = quizQueue.pop();
  const it = vocab[idx];
  let chosenMode = mode;
  if (quizRandomize || !chosenMode) {
    const modes = ['multiple', 'reverse', 'spelling', 'spelling-no-thai'];
    chosenMode = modes[Math.floor(Math.random() * modes.length)];
  }
  quizCurrent = { idx, item: it, mode: chosenMode };
  const modeLabel =
    chosenMode === 'multiple'
      ? 'EN → TH'
      : chosenMode === 'reverse'
      ? 'TH → EN'
      : chosenMode === 'spelling'
      ? 'Spelling EN'
      : 'spelling-no-thai';
  document.getElementById(
    'qCurrentMode'
  ).textContent = `Mode: ${modeLabel}`;

  // เล่นเสียงอัตโนมัติ เฉพาะที่เปิด auto sound และไม่ใช่ reverse
  if (chosenMode !== 'reverse' && autoSoundQuiz) {
    setTimeout(() => {
      try {
        playEN('quiz');
      } catch (e) {
        console.warn('TTS failed', e);
      }
    }, 80);
  }

  if (chosenMode === 'spelling') {
    renderSpelling(quizCurrent);
  } else if (chosenMode === 'spelling-no-thai') {
    renderSpellingNoTH(quizCurrent);
  } else if (chosenMode === 'reverse') {
    const options = [it.word];
    const pool = vocab.map(v => v.word).filter(w => w !== it.word);
    shuffleArray(pool);
    for (let i = 0; i < pool.length && options.length < 4; i++) {
      if (!options.includes(pool[i])) options.push(pool[i]);
    }
    while (options.length < 4) options.push('(no option)');
    shuffleArray(options);
    quizCurrent.options = options;
    renderReverse(quizCurrent);
  } else {
    const options = [it.translation];
    const pool = vocab
      .map(v => v.translation)
      .filter(t => t !== it.translation);
    shuffleArray(pool);
    for (let i = 0; i < pool.length && options.length < 4; i++) {
      if (!options.includes(pool[i])) options.push(pool[i]);
    }
    while (options.length < 4) options.push('(no option)');
    shuffleArray(options);
    quizCurrent.options = options;
    renderQuiz(quizCurrent);
  }
}

function renderQuiz(q) {
  document.getElementById('qWord').textContent = q.item.word;
  document.getElementById('qHint').textContent = '';
  document.getElementById('spellingArea').style.display = 'none';
  const optsEl = document.getElementById('qOptions');
  optsEl.innerHTML = '';
  q.options.forEach(opt => {
    const d = document.createElement('button');
    d.className =
      'btn btn-outline-secondary d-block mb-2 option';
    d.textContent = opt;
    d.onclick = () =>
      evaluateQuiz(opt, q.item.translation, q.idx, d);
    optsEl.appendChild(d);
  });
  const done = quizTotal - quizQueue.length;
  const pct = Math.round((done / quizTotal) * 100);
  document.getElementById('qProgress').style.width = pct + '%';
}

function renderReverse(q) {
  document.getElementById('qWord').textContent = q.item.translation;
  document.getElementById('spellingArea').style.display = 'none';
  const optsEl = document.getElementById('qOptions');
  optsEl.innerHTML = '';
  q.options.forEach(opt => {
    const d = document.createElement('button');
    d.className =
      'btn btn-outline-secondary d-block mb-2 option';
    d.textContent = opt;
    d.onclick = () => evaluateQuiz(opt, q.item.word, q.idx, d);
    optsEl.appendChild(d);
  });
  const done = quizTotal - quizQueue.length;
  const pct = Math.round((done / quizTotal) * 100);
  document.getElementById('qProgress').style.width = pct + '%';
}

/* ---------- Spelling status indicator ---------- */

function resetSpellingStatus() {
  const wrapper = document.getElementById('spellingStatus');
  if (!wrapper) return;
  wrapper.classList.remove('visible', 'is-correct', 'is-wrong');
  const title = document.getElementById('spellingStatusTitle');
  const detail = document.getElementById('spellingStatusDetail');
  if (title) title.textContent = '';
  if (detail) detail.textContent = '';
}

function showSpellingStatus(kind, word, detailText) {
  const wrapper = document.getElementById('spellingStatus');
  const title = document.getElementById('spellingStatusTitle');
  const detail = document.getElementById('spellingStatusDetail');
  const icon = document.getElementById('spellingStatusIcon');
  if (!wrapper || !title || !detail || !icon) return;

  wrapper.classList.remove('is-correct', 'is-wrong');

  if (kind === 'correct') {
    wrapper.classList.add('is-correct');
    title.textContent = 'ถูกต้อง';
    icon.textContent = '✓';
  } else if (kind === 'wrong') {
    wrapper.classList.add('is-wrong');
    title.textContent = 'ผิด';
    icon.textContent = '!';
  }

  detail.textContent = detailText || word || '';
  wrapper.classList.add('visible');
}

/* ---------- Spelling renderers ---------- */

function renderSpelling(q) {
  resetSpellingStatus();

  const qHintEl = document.getElementById('qHint');
  qHintEl.textContent = q.item.translation;
  qHintEl.style.display = 'block';

  document.getElementById('qWord').textContent = '';
  document.getElementById('qBlanks').innerHTML = '';
  document.getElementById('spellingInput').value = '';
  document.getElementById('spellingFeedback').textContent = '';
  document.getElementById('spellingArea').style.display = 'block';
  document.getElementById('qOptions').innerHTML = '';
  const word = q.item.word;
  const revealCount = Math.min(2, Math.floor(word.length / 4));
  const revealPositions = new Set();
  while (revealPositions.size < revealCount) {
    revealPositions.add(Math.floor(Math.random() * word.length));
  }
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    const span = document.createElement('div');
    span.className = 'blank me-1';
    span.textContent = revealPositions.has(i) ? ch : '_';
    document.getElementById('qBlanks').appendChild(span);
  }
  const done = quizTotal - quizQueue.length;
  const pct = Math.round((done / quizTotal) * 100);
  document.getElementById('qProgress').style.width = pct + '%';
  setTimeout(() => document.getElementById('spellingInput').focus(), 60);
}

function renderSpellingNoTH(q) {
  resetSpellingStatus();

  const qHintEl = document.getElementById('qHint');
  qHintEl.textContent = '';
  qHintEl.style.display = 'none';

  document.getElementById('qWord').textContent = '';
  document.getElementById('qBlanks').innerHTML = '';
  document.getElementById('spellingInput').value = '';
  document.getElementById('spellingFeedback').textContent = '';
  document.getElementById('spellingArea').style.display = 'block';
  document.getElementById('qOptions').innerHTML = '';
  const word = q.item.word;
  const revealCount = Math.min(2, Math.floor(word.length / 4));
  const revealPositions = new Set();
  while (revealPositions.size < revealCount) {
    revealPositions.add(Math.floor(Math.random() * word.length));
  }
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    const span = document.createElement('div');
    span.className = 'blank me-1';
    span.textContent = revealPositions.has(i) ? ch : '_';
    document.getElementById('qBlanks').appendChild(span);
  }
  const done = quizTotal - quizQueue.length;
  const pct = Math.round((done / quizTotal) * 100);
  document.getElementById('qProgress').style.width = pct + '%';
  setTimeout(() => document.getElementById('spellingInput').focus(), 60);
}

function submitSpelling() {
  if (!quizCurrent) return;
  const input = document
    .getElementById('spellingInput')
    .value.trim();
  const correctObj = ensureQuizObj(quizCurrent);
  const idx =
    correctObj && typeof correctObj.idx === 'number'
      ? correctObj.idx
      : (quizCurrent && quizCurrent.idx) || -1;
  evaluateSpelling(input, correctObj, idx);
}

// ให้กด Enter เพื่อ Submit ได้
const spellingInputEl = document.getElementById('spellingInput');
if (spellingInputEl) {
  spellingInputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitSpelling();
    }
  });
}

function revealSpelling() {
  if (!quizCurrent) return;

  const q = ensureQuizObj(quizCurrent);
  const idx = q ? q.idx : -1;
  const word = q && q.item ? q.item.word : '';
  const fb = document.getElementById('spellingFeedback');

  let detailLine = word;
  if (idx >= 0 && vocab[idx] && vocab[idx].translation) {
    detailLine = `${word} (${vocab[idx].translation})`;
  }

  if (fb) fb.textContent = `เฉลย: ${detailLine}`;
  showSpellingStatus('wrong', word, detailLine);

  if (idx >= 0 && vocab[idx]) {
    vocab[idx].wrong = (vocab[idx].wrong || 0) + 1;
    vocab[idx].lastSeen = Date.now();
    saveAll();
    sessionWrong.push({
      idx: idx,
      word: vocab[idx].word,
      correct: vocab[idx].translation
    });
    updateSessionWrong();
  }

  const auto = document.getElementById('autoNext').checked;
  if (auto) {
    setTimeout(
      () => showNextQuiz(quizRandomize ? null : quizFixedMode),
      900
    );
  }
}

function evaluateSpelling(input, correctObj, idx) {
  const inputEl = document.getElementById('spellingInput');
  if (!inputEl) return;

  inputEl.disabled = true;
  const auto = document.getElementById('autoNext').checked;
  const fb = document.getElementById('spellingFeedback');

  const correctItem =
    correctObj && correctObj.item
      ? correctObj.item
      : typeof correctObj === 'string'
      ? { word: String(correctObj), translation: '' }
      : null;

  const correctWord = correctItem ? correctItem.word || '' : '';
  const correctTrans = correctItem ? correctItem.translation || '' : '';

  const normalizedInput = String(input || '').trim().toLowerCase();
  const normalizedCorrect = String(correctWord || '')
    .trim()
    .toLowerCase();

  if (normalizedInput === normalizedCorrect) {
    const detailLine = correctTrans
      ? `${correctWord} — ${correctTrans}`
      : correctWord;

    if (fb) fb.textContent = `ถูกต้อง — ${detailLine}`;
    showSpellingStatus('correct', correctWord, detailLine);

    if (idx >= 0 && vocab[idx]) {
      vocab[idx].correct = (vocab[idx].correct || 0) + 1;
    }
    quizScore++;
  } else {
    const detailLine = correctTrans
      ? `${correctWord} (${correctTrans})`
      : correctWord;

    if (fb) fb.textContent = `ผิด — คำที่ถูกต้อง: ${detailLine}`;
    showSpellingStatus('wrong', correctWord, detailLine);

    if (idx >= 0 && vocab[idx]) {
      vocab[idx].wrong = (vocab[idx].wrong || 0) + 1;
      sessionWrong.push({
        idx,
        word: vocab[idx].word,
        correct: vocab[idx].translation
      });
    }
  }

  if (idx >= 0 && vocab[idx]) {
    vocab[idx].lastSeen = Date.now();
  }

  saveAll();
  document.getElementById('qScore').textContent = `${quizScore} / ${quizTotal}`;
  updateSessionWrong();

  if (auto) {
    setTimeout(() => {
      inputEl.disabled = false;
      showNextQuiz(quizRandomize ? null : quizFixedMode);
    }, 900);
  } else {
    setTimeout(() => {
      inputEl.disabled = false;
    }, 250);
  }
}

function evaluateQuiz(selected, correct, idx, el) {
  document
    .querySelectorAll('#qOptions .option')
    .forEach(o => (o.onclick = null));
  const auto = document.getElementById('autoNext').checked;
  if (selected === correct) {
    el.classList.add('correct');
    quizScore++;
    if (idx >= 0 && vocab[idx])
      vocab[idx].correct = (vocab[idx].correct || 0) + 1;
  } else {
    el.classList.add('wrong');
    if (idx >= 0 && vocab[idx])
      vocab[idx].wrong = (vocab[idx].wrong || 0) + 1;
    document
      .querySelectorAll('#qOptions .option')
      .forEach(o => {
        if (o.textContent === correct) o.classList.add('correct');
      });
    if (idx >= 0 && vocab[idx])
      sessionWrong.push({
        idx,
        word: vocab[idx].word,
        correct: vocab[idx].translation
      });
  }
  if (idx >= 0 && vocab[idx]) vocab[idx].lastSeen = Date.now();
  saveAll();
  document.getElementById('qScore').textContent = `${quizScore} / ${quizTotal}`;
  updateSessionWrong();
  if (auto) {
    setTimeout(
      () => showNextQuiz(quizRandomize ? null : quizFixedMode),
      700
    );
  } else {
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next';
    nextBtn.className = 'btn btn-outline-primary mt-2';
    nextBtn.onclick = () => {
      nextBtn.remove();
      showNextQuiz(quizRandomize ? null : quizFixedMode);
    };
    document.getElementById('qOptions').appendChild(nextBtn);
  }
}

function updateSessionWrong() {
  const el = document.getElementById('sessionWrong');
  el.innerHTML = '';
  sessionWrong.forEach(w => {
    const d = document.createElement('div');
    d.className = 'mb-1 d-flex align-items-center';
    const badge = document.createElement('span');
    badge.className = 'badge bg-danger rounded-pill me-2';
    badge.style.minWidth = '28px';
    badge.style.textAlign = 'center';
    badge.style.display = 'inline-block';
    badge.textContent =
      typeof w.idx === 'number' && w.idx >= 0 ? w.idx + 1 : '';
    const txt = document.createElement('span');
    txt.textContent = `${w.word} → ${w.correct}`;
    d.appendChild(badge);
    d.appendChild(txt);
    el.appendChild(d);
  });
}

function renderSessionWrong() {
  updateSessionWrong();
}

function retryWrong() {
  const wrongIdx = vocab
    .map((it, i) => ({ it, i }))
    .filter(x => (x.it.wrong || 0) >= 1)
    .map(x => x.i);
  if (!wrongIdx.length) return alert('ไม่มีคำที่ผิดบ่อย');
  quizQueue = [...wrongIdx];
  shuffleArray(quizQueue);
  quizTotal = quizQueue.length;
  quizScore = 0;
  sessionWrong = [];
  document.getElementById('qScore').textContent = `${quizScore} / ${quizTotal}`;
  document.getElementById('quizCard').style.display = 'block';
  showNextQuiz(quizRandomize ? null : quizFixedMode);
}

/* ------------------------------
  Audio (EN TTS only)
-------------------------------*/
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

window.addEventListener("beforeunload", () => saveAll());

// โหลดข้อมูลครั้งแรกจาก API
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
