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
    alert("โหลดคำศัพท์ไม่สำเร็จ (เช็ก Console ดู error เพิ่มเติม)");
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

// ---------- แก้: ลบคำเดียว + ลบ stats ของคำนี้ผ่าน saveAll ----------
function deleteItem(i) {
  if (!confirm('ลบคำศัพท์นี้ทั้งหมด (รวมสถิติ) ?')) return;
  vocab.splice(i, 1);   // ลบออกจาก vocab ของ user นี้
  saveAll();            // backend จะเขียน words + user_word_stats ใหม่ของ user นี้
  renderLibraryImmediate();
  updateStatsUI();
}

// ---------- แก้: Clear ทั้งหมดของ user นี้ ----------
function clearAll() {
  if (!confirm('ล้างคำศัพท์ทั้งหมดของ user นี้ (รวมสถิติทุกคำ)?')) return;
  vocab = [];       // ล้าง vocab ของ user ปัจจุบัน
  saveAll();        // backend จะลบทั้ง words + user_word_stats ของ user นี้
  renderLibraryImmediate();
  updateStatsUI();
}

/* ------------------------------
  Import / Export CSV
-------------------------------*/
// ... (ส่วน Import / Export, Practice, Quiz, Audio, Stats ทั้งหมดเหมือนเดิมของคุณ)
// (ไม่ขยายซ้ำอีก เพื่อให้ตอบไม่ยาวเกินไป – ใช้ของเดิมที่คุณมีได้เลย)

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

// ... (renderWeakList, practiceSingle, resetStats, shuffleArray, escapeHtml, refreshUI เหมือนเดิม)

// ❌ ลบอันนี้ทิ้งไปเลย (ไม่ต้องมีแล้ว) ❌
// window.addEventListener("beforeunload", () => saveAll());

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
