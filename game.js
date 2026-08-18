'use strict';
/* ============================================================
   《海报与正片》 —— 致敬电影《牛来》(2026) 的非官方小游戏原型
   规则一句话：好看的是假的，难看的才是真的。
   海报世界：水墨、轻盈、可飘行，但"画上去"的平台踩不实，票根摸不到
   正片世界：手搓 low poly、僵硬，但一切皆真实：平台能踩、票根能收、尖刺会死
   ============================================================ */

// ---------------- 基础 ----------------
const W = 960, H = 540;
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const RS = Math.min(2, window.devicePixelRatio || 1);
cv.width = W * RS; cv.height = H * RS;

const wrap = document.getElementById('wrap');
function fit() {
  const sw = Math.min(window.innerWidth, window.innerHeight * (W / H));
  const sh = sw * (H / W);
  wrap.style.width = sw + 'px'; wrap.style.height = sh + 'px';
  cv.style.width = sw + 'px'; cv.style.height = sh + 'px';
}
window.addEventListener('resize', fit); fit();

// ---------------- 常量 ----------------
const KILL_Y = 800;
const WORLD_W = 7250;
const TICKET_PRICE = 38.5;
const TARGET = 7705;           // 《牛来》上映10天的真实票房，作为累计目标
const INK = '#26221d', PAPER = '#f3ead8', VERM = '#c8402a';

const FILM = {
  g: 2300, jumpV: -640, maxV: 265, acc: 1900, fricG: 2400, fricA: 500,
};
const POSTER = {
  g: 560, jumpV: -430, maxV: 300, acc: 1000, fricG: 1400, fricA: 120,
  glideCap: 135,
};

// ---------------- 游戏状态 ----------------
const g = {
  state: 'menu',        // menu | play | dead | end
  mode: 'poster',       // poster | film
  time: 0, runTime: 0,
  box: 0,               // 本场票房
  total: parseFloat(localStorage.getItem('nl_total') || '0'),
  ach: localStorage.getItem('nl_ach') === '1',
  achievedThisRun: false,
  deaths: 0,
  checkpoint: { x: 80, y: 472 },
  switchCd: 0,
  deadT: 0,
  cam: 0,
  sub: null,            // 当前字幕 {line,t}
  shakeT: 0,
};
const pl = {
  x: 80, y: 472, w: 30, h: 28, vx: 0, vy: 0,
  onGround: false, face: 1,
  coyote: 0, jbuf: 0,
  animT: 0, poseT: 0, pose: 0,
};
const wall = { active: false, x: 5230, triggerX: 5450, startX: 5230, speed: 196 };
const bird = { state: 'perch', x: 3660, y: 288, t: 0, sayT: 0, sparkT: 0 };
const trans = { t: 0, to: 'poster', px: 0, py: 0, blobs: [] };
let particles = [];

// ---------------- 关卡数据 ----------------
let seedCnt = 1;
const plats = [], spikes = [], tickets = [], signs = [], cps = [], subs = [];
function G(x, w) { plats.push({ x, y: 500, w, h: 90, solid: 'both', seed: seedCnt++ }); }
function B(x, y, w, h = 18) { plats.push({ x, y, w, h, solid: 'both', seed: seedCnt++ }); }
function P(x, y, w, h = 18) { plats.push({ x, y, w, h, solid: 'film', seed: seedCnt++ }); }
function S(x, w) { spikes.push({ x, y: 478, w, h: 22 }); }
function T(x, y) { tickets.push({ x, y, r: 9, got: false, bob: seedCnt++ }); }

// 地面
G(0, 1400); G(1600, 1200); G(3000, 180); G(4350, 1750); G(6280, 970);
// 实台阶（两个世界都真实）
B(600, 440, 90); B(760, 380, 90); B(3620, 315, 380); B(4560, 430, 160);
// 手搓平台（只在正片里是实的）
P(1400, 500, 200);            // 第一座"画的桥"
P(3230, 440, 110); P(3410, 375, 110);
P(6100, 500, 180);            // 追逐战里的桥
// 尖刺（只在正片里致命）
S(1950, 170); S(2350, 240); S(4580, 120); S(4900, 180); S(5800, 130); S(6500, 200);
// 票根
[[300,470],[360,470],[420,470],[630,405],[790,345],
 [1450,468],[1510,468],[1570,468],[1700,470],
 [1975,432],[2200,470],[2260,470],[2360,432],
 [3270,405],[3450,340],[3700,280],[3780,280],[3860,280],
 [4420,470],[4620,395],[4700,395],[5150,470],
 [5700,470],[5950,470],[6160,468],[6220,468],[6800,470]].forEach(a => T(a[0], a[1]));
// 路牌
[[220,432,'←→ 移动 · 空格 跳'],
 [1290,428,'海报的桥是画的 · 按 X 进正片'],
 [1880,428,'正片的刺是真的 · 切回海报，飘过去'],
 [3080,420,'好看的是假的，难看的才是真的'],
 [3760,268,'云雀只在海报里认路'],
 [5480,428,'跑！排片正在消失！']].forEach(a => signs.push({ x: a[0], y: a[1], text: a[2] }));
// 存档点
cps.push({ x: 3060, y: 500, got: false }, { x: 5300, y: 500, got: false });
// 正片字幕（棒读）
[[500, '。。。加油。牛来。'],
 [2550, '牛来。你要，学会，勇敢。'],
 [4450, '（此处应有配乐。）'],
 [5750, '生死。就是，跑得快一点。'],
 [6700, '前面。就是，影院。']].forEach(a => subs.push({ x: a[0], line: a[1], shown: false }));
const goal = { x: 6950, y: 380, w: 90, h: 120 };
const waypoints = [{ x: 3060, y: 450 }, { x: 5300, y: 450 }, { x: 6990, y: 420 }];

const QUOTES = [
  '五星。建议直接申遗。',
  '画面朴实得让我检查了三遍显卡线。',
  '全场只有我一个人，观影体验极其尊贵。',
  '看完我沉默了，影院也沉默了，毕竟只有我。',
  '别人手搓火箭，这里手搓电影，都是勇气。',
  '海报值一张票钱，正片值一段人生阅历。',
  '牛来了，我也来了，我们都有光明的前途。',
  '特效炸裂，裂缝里全是诚意。',
  '从《牛申克的救赎》一路刷到这，二创浓度超标。',
];

// ---------------- 工具 ----------------
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function solids() {
  return plats.filter(p => p.solid === 'both' || (p.solid === 'film' && g.mode === 'film'));
}

// ---------------- 音效（WebAudio 手搓） ----------------
let AC = null;
function ac() { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; }
function tone(f0, f1, dur, type, vol) {
  try {
    const a = ac(), o = a.createOscillator(), gn = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, a.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), a.currentTime + dur);
    gn.gain.setValueAtTime(vol, a.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.connect(gn); gn.connect(a.destination); o.start(); o.stop(a.currentTime + dur + 0.02);
  } catch (e) {}
}
function splash(dur, vol, freq) {
  try {
    const a = ac(), len = a.sampleRate * dur, buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const gn = a.createGain(); gn.gain.value = vol;
    src.connect(f); f.connect(gn); gn.connect(a.destination); src.start();
  } catch (e) {}
}
const sfx = {
  jump: () => tone(300, 540, 0.12, 'square', 0.06),
  switch: () => splash(0.22, 0.16, 900),
  ticket: () => { tone(880, 880, 0.07, 'sine', 0.08); setTimeout(() => tone(1318, 1318, 0.1, 'sine', 0.08), 70); },
  die: () => tone(200, 55, 0.4, 'sawtooth', 0.1),
  cp: () => tone(523, 784, 0.16, 'triangle', 0.08),
  goal: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, f, 0.18, 'triangle', 0.09), i * 110)),
};

// ---------------- 输入 ----------------
const keys = {};
window.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (keys[e.code]) return;
  keys[e.code] = true;
  ac();
  if (g.state === 'menu' && (e.code === 'Enter' || e.code === 'Space')) { startGame(); return; }
  if (g.state === 'end' && e.code === 'Enter') { resetRun(); return; }
  if (g.state !== 'play') return;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') pl.jbuf = 0.12;
  if (e.code === 'KeyX' || e.code === 'KeyJ' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') switchMode();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
const left = () => keys['ArrowLeft'] || keys['KeyA'];
const right = () => keys['ArrowRight'] || keys['KeyD'];

// ---------------- 世界切换 ----------------
function switchMode() {
  if (g.switchCd > 0 || g.state !== 'play') return;
  g.switchCd = 0.18;
  g.mode = g.mode === 'poster' ? 'film' : 'poster';
  trans.t = 1; trans.to = g.mode;
  trans.px = pl.x + pl.w / 2 - g.cam; trans.py = pl.y + pl.h / 2;
  trans.blobs = [];
  for (let i = 0; i < 16; i++) {
    trans.blobs.push({ ang: Math.random() * 6.283, spd: 120 + Math.random() * 480, r: 24 + Math.random() * 90 });
  }
  sfx.switch();
  resolveEmbed();
  updateHud();
}
// 切到正片时若卡进新变实的平台里，把人往安全处推
function resolveEmbed() {
  for (let iter = 0; iter < 4; iter++) {
    let hit = null;
    for (const p of solids()) if (overlap(pl, p)) { hit = p; break; }
    if (!hit) return;
    const pen = pl.y + pl.h - hit.y;
    if (pen < 26) { pl.y = hit.y - pl.h; pl.vy = Math.min(pl.vy, 0); pl.onGround = true; }
    else {
      const dl = pl.x + pl.w - hit.x, dr = hit.x + hit.w - pl.x;
      if (dl < dr) pl.x = hit.x - pl.w; else pl.x = hit.x + hit.w;
    }
  }
}

// ---------------- 逻辑 ----------------
function startGame() {
  document.getElementById('menu').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  document.getElementById('startbtn').blur();
  g.state = 'play'; g.runTime = 0;
  updateHud();
}
function resetRun() {
  tickets.forEach(t => t.got = false);
  cps.forEach(c => c.got = false);
  subs.forEach(s => s.shown = false);
  g.box = 0; g.deaths = 0; g.runTime = 0; g.achievedThisRun = false;
  g.checkpoint = { x: 80, y: 472 };
  g.mode = 'poster'; g.sub = null;
  pl.x = 80; pl.y = 472; pl.vx = 0; pl.vy = 0;
  wall.active = false; wall.x = wall.startX;
  bird.state = 'perch'; bird.x = 3660; bird.y = 288;
  particles = [];
  document.getElementById('endo').style.display = 'none';
  document.getElementById('againbtn').blur();
  g.state = 'play';
  updateHud();
}
function die() {
  if (g.state !== 'play') return;
  g.state = 'dead'; g.deadT = 0.7; g.deaths++;
  g.shakeT = 0.3;
  sfx.die();
  const col = g.mode === 'poster' ? INK : '#777';
  for (let i = 0; i < 24; i++) {
    particles.push({ type: 'burst', x: pl.x + pl.w / 2, y: pl.y + pl.h / 2,
      vx: (Math.random() - 0.5) * 420, vy: -Math.random() * 380, life: 0.9, max: 0.9, col });
  }
}
function respawn() {
  pl.x = g.checkpoint.x; pl.y = g.checkpoint.y; pl.vx = 0; pl.vy = 0;
  wall.active = false; wall.x = wall.startX;
  g.mode = 'poster'; g.sub = null;
  g.state = 'play';
  updateHud();
}
function endGame() {
  g.state = 'end';
  sfx.goal();
  document.getElementById('hud').style.display = 'none';
  fillEndScreen();
  document.getElementById('endo').style.display = 'flex';
}

function collectTicket(t) {
  t.got = true;
  g.box += TICKET_PRICE;
  const before = g.total;
  g.total += TICKET_PRICE;
  localStorage.setItem('nl_total', g.total.toFixed(1));
  if (before < TARGET && g.total >= TARGET) {
    g.ach = true; g.achievedThisRun = true;
    localStorage.setItem('nl_ach', '1');
  }
  sfx.ticket();
  particles.push({ type: 'plus', x: t.x, y: t.y - 14, vx: 0, vy: -46, life: 0.9, max: 0.9, txt: '+¥38.5' });
  for (let i = 0; i < 6; i++) particles.push({ type: 'gold', x: t.x, y: t.y,
    vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 140, life: 0.5, max: 0.5 });
  updateHud();
}

function update(dt) {
  g.time += dt;
  if (g.switchCd > 0) g.switchCd -= dt;
  if (trans.t > 0) trans.t -= dt * 3.5;
  if (g.shakeT > 0) g.shakeT -= dt;
  if (g.sub) { g.sub.t -= dt; if (g.sub.t <= 0) g.sub = null; }

  particles = particles.filter(p => (p.life -= dt) > 0);
  particles.forEach(p => {
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.type === 'burst') p.vy += 900 * dt;
    if (p.type === 'gold') p.vy += 500 * dt;
  });

  if (g.state === 'dead') {
    g.deadT -= dt;
    if (g.deadT <= 0) respawn();
    return;
  }
  if (g.state !== 'play') { pl.animT += dt * 0.4; return; }

  g.runTime += dt;
  const M = g.mode === 'poster' ? POSTER : FILM;

  // --- 水平 ---
  let ax = 0;
  if (left()) { ax -= M.acc; pl.face = -1; }
  if (right()) { ax += M.acc; pl.face = 1; }
  if (ax === 0) {
    const f = pl.onGround ? M.fricG : M.fricA;
    if (pl.vx > 0) pl.vx = Math.max(0, pl.vx - f * dt);
    else pl.vx = Math.min(0, pl.vx + f * dt);
  } else pl.vx += ax * dt;
  pl.vx = Math.max(-M.maxV, Math.min(M.maxV, pl.vx));

  // --- 跳跃（含 coyote time 和输入缓冲） ---
  pl.coyote = pl.onGround ? 0.1 : Math.max(0, pl.coyote - dt);
  pl.jbuf = Math.max(0, pl.jbuf - dt);
  if (pl.jbuf > 0 && pl.coyote > 0) {
    pl.vy = M.jumpV; pl.onGround = false; pl.coyote = 0; pl.jbuf = 0;
    sfx.jump();
  }

  // --- 重力（海报世界飘） ---
  pl.vy += M.g * dt;
  if (g.mode === 'poster' && pl.vy > POSTER.glideCap) pl.vy = POSTER.glideCap;

  // --- 碰撞：分轴 ---
  const S_ = solids();
  pl.x += pl.vx * dt;
  pl.x = Math.max(0, Math.min(WORLD_W - pl.w, pl.x));
  for (const p of S_) if (overlap(pl, p)) {
    if (pl.vx > 0) pl.x = p.x - pl.w; else if (pl.vx < 0) pl.x = p.x + p.w;
    pl.vx = 0;
  }
  pl.onGround = false;
  pl.y += pl.vy * dt;
  for (const p of S_) if (overlap(pl, p)) {
    if (pl.vy > 0) { pl.y = p.y - pl.h; pl.vy = 0; pl.onGround = true; }
    else if (pl.vy < 0) { pl.y = p.y + p.h; pl.vy = 0; }
  }

  pl.animT += dt * (0.3 + Math.abs(pl.vx) / M.maxV);
  pl.poseT += dt;
  if (pl.poseT > 1 / 6) { pl.poseT = 0; pl.pose = 1 - pl.pose; }

  // --- 掉出世界 ---
  if (pl.y > KILL_Y) { die(); return; }

  // --- 尖刺：只在正片里是真的 ---
  if (g.mode === 'film') {
    for (const s of spikes) {
      const box = { x: s.x + 5, y: s.y + 6, w: s.w - 10, h: s.h - 6 };
      if (overlap(pl, box)) { die(); return; }
    }
  }

  // --- 票根：只在正片里收得进口袋 ---
  if (g.mode === 'film') {
    for (const t of tickets) {
      if (!t.got && Math.abs(pl.x + pl.w / 2 - t.x) < 24 && Math.abs(pl.y + pl.h / 2 - t.y) < 26) collectTicket(t);
    }
  }

  // --- 存档点 ---
  for (const c of cps) {
    if (!c.got && pl.x + pl.w > c.x && pl.x < c.x + 30) {
      c.got = true; g.checkpoint = { x: c.x, y: c.y - pl.h };
      sfx.cp();
    }
  }

  // --- 字幕触发 ---
  for (const s of subs) {
    if (!s.shown && pl.x > s.x) { s.shown = true; g.sub = { line: s.line, t: 3.4 }; }
  }

  // --- 云雀 ---
  bird.t += dt;
  if (bird.state === 'perch' && pl.x > 3400) bird.state = 'follow';
  if (bird.state === 'follow') {
    const tx = pl.x + 130 * pl.face;
    bird.x += (tx - bird.x) * Math.min(1, dt * 2.6);
    const baseY = Math.max(80, pl.y - 85);
    bird.y += (baseY + Math.sin(bird.t * 3) * 16 - bird.y) * Math.min(1, dt * 3);
    bird.sayT -= dt;
    if (bird.sayT < -6) bird.sayT = 1.2;
    // 海报世界里指路的金粉
    if (g.mode === 'poster') {
      bird.sparkT -= dt;
      if (bird.sparkT <= 0) {
        bird.sparkT = 0.09;
        const wp = waypoints.find(w => w.x > pl.x + 40) || waypoints[waypoints.length - 1];
        const dx = wp.x - bird.x, dy = wp.y - bird.y, len = Math.hypot(dx, dy) || 1;
        particles.push({ type: 'gold', x: bird.x, y: bird.y,
          vx: dx / len * 90 + (Math.random() - 0.5) * 30, vy: dy / len * 90 + (Math.random() - 0.5) * 30,
          life: 0.8, max: 0.8 });
      }
    }
  }

  // --- 追逐战：黑幕（两个世界都吞） ---
  if (!wall.active && pl.x > wall.triggerX) { wall.active = true; wall.x = wall.startX; g.shakeT = 0.4; }
  if (wall.active) {
    wall.x += wall.speed * dt;
    if (pl.x < wall.x - 10) { die(); return; }
  }

  // --- 终点 ---
  if (overlap(pl, goal)) { endGame(); return; }

  // --- 水墨拖尾 ---
  if (g.mode === 'poster' && (Math.abs(pl.vx) > 60 || !pl.onGround)) {
    if (Math.random() < 0.35) particles.push({ type: 'ink', x: pl.x + pl.w / 2 - pl.face * 12, y: pl.y + pl.h - 6,
      vx: -pl.face * 20, vy: -14 - Math.random() * 20, life: 0.7, max: 0.7 });
  }

  // --- 相机 ---
  const target = Math.max(0, Math.min(WORLD_W - W, pl.x - W * 0.38));
  g.cam += (target - g.cam) * Math.min(1, dt * 8);
}

// ---------------- HUD 与结算 ----------------
const boxEl = document.getElementById('boxoffice');
const modeEl = document.getElementById('modechip');
function updateHud() {
  boxEl.innerHTML = `本场票房 <b>¥${g.box.toFixed(1)}</b>　·　累计 ¥${g.total.toFixed(1)}`;
  modeEl.className = 'chip ' + g.mode;
  modeEl.innerHTML = (g.mode === 'poster' ? '海报' : '正片') + '<small>X 切换世界</small>';
}
function fillEndScreen() {
  const audience = Math.min(60, g.deaths + 1);
  const rnd = mulberry(g.deaths * 31 + 7);
  const idx = new Set();
  while (idx.size < audience) idx.add(Math.floor(rnd() * 60));
  let html = '';
  for (let r = 0; r < 5; r++) {
    html += '<div class="row">';
    for (let c = 0; c < 12; c++) {
      const i = r * 12 + c;
      html += idx.has(i) ? '<span class="p">人</span>' : '<span class="s">〇</span>';
    }
    html += '</div>';
  }
  document.getElementById('seats').innerHTML = html;

  const got = tickets.filter(t => t.got).length;
  const mm = Math.floor(g.runTime / 60), ss = Math.floor(g.runTime % 60);
  document.getElementById('endstats').innerHTML =
    `本场票房 <b>¥${g.box.toFixed(1)}</b>（票根 ${got}/${tickets.length} 张）<br>` +
    `观影人数 <b>${audience} 位</b>（1 位是你，其余 ${Math.max(0, audience - 1)} 位是没跑到结局的你）<br>` +
    `放映时长 ${mm} 分 ${String(ss).padStart(2, '0')} 秒`;

  const pct = Math.min(100, g.total / TARGET * 100);
  document.getElementById('totalfill').style.width = pct + '%';
  document.getElementById('totaltxt').textContent = g.total >= TARGET
    ? `累计票房 ¥${g.total.toFixed(1)}，已超越《牛来》上映 10 天的 ¥7705 纪录！`
    : `累计票房 ¥${g.total.toFixed(1)} / ¥7705，还差 ¥${(TARGET - g.total).toFixed(1)} 就能超过《牛来》首周纪录`;
  document.getElementById('ach').style.display = g.ach ? 'block' : 'none';

  const qa = (g.deaths * 7 + got * 3) % QUOTES.length;
  let qb = (qa + 3) % QUOTES.length; if (qb === qa) qb = (qb + 1) % QUOTES.length;
  document.getElementById('q1').textContent = QUOTES[qa];
  document.getElementById('q2').textContent = QUOTES[qb];
}
document.getElementById('startbtn').addEventListener('click', () => { ac(); startGame(); });
document.getElementById('againbtn').addEventListener('click', () => resetRun());
document.getElementById('resetTotal').addEventListener('click', () => {
  localStorage.removeItem('nl_total'); localStorage.removeItem('nl_ach');
  g.total = 0; g.ach = false; fillEndScreen(); updateHud();
});

// ---------------- 渲染：公共 ----------------
let paperTex = null;
function makePaper() {
  const c = document.createElement('canvas'); c.width = 480; c.height = 270;
  const x = c.getContext('2d');
  x.fillStyle = PAPER; x.fillRect(0, 0, 480, 270);
  for (let i = 0; i < 5200; i++) {
    x.fillStyle = `rgba(120,105,80,${Math.random() * 0.09})`;
    x.fillRect(Math.random() * 480, Math.random() * 270, 1.3, 1.3);
  }
  for (let i = 0; i < 60; i++) {
    x.strokeStyle = `rgba(150,135,105,${0.05 + Math.random() * 0.07})`;
    x.beginPath();
    const sx = Math.random() * 480, sy = Math.random() * 270;
    x.moveTo(sx, sy); x.lineTo(sx + (Math.random() - 0.5) * 60, sy + (Math.random() - 0.5) * 8);
    x.stroke();
  }
  paperTex = c;
}
makePaper();

function render() {
  ctx.setTransform(RS, 0, 0, RS, 0, 0);
  let shx = 0, shy = 0;
  if (g.shakeT > 0) { shx = (Math.random() - 0.5) * 8 * g.shakeT; shy = (Math.random() - 0.5) * 8 * g.shakeT; }

  if (g.mode === 'poster') renderPosterBG(); else renderFilmBG();

  ctx.save();
  ctx.translate(-g.cam + shx, shy);

  for (const p of plats) g.mode === 'poster' ? drawPlatPoster(p) : drawPlatFilm(p);
  for (const s of spikes) g.mode === 'poster' ? drawSpikePoster(s) : drawSpikeFilm(s);
  for (const c of cps) drawCP(c);
  drawGoal();
  for (const s of signs) drawSign(s);
  for (const t of tickets) if (!t.got) drawTicket(t);
  drawBird();
  if (g.state !== 'dead') drawPlayer();
  drawWall();
  drawParticles();
  ctx.restore();

  if (g.mode === 'poster') posterOverlay(); else filmOverlay();
  drawSubtitle();
  drawTransition();
}

// ---------------- 渲染：海报世界（水墨） ----------------
function renderPosterBG() {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  // 远山三层：照官方海报，墨色与青绿交替
  const MTN = ['rgba(70,72,66,0.12)', 'rgba(74,112,96,0.17)', 'rgba(52,86,78,0.22)'];
  for (let L = 0; L < 3; L++) {
    const par = 0.12 + L * 0.1, base = 300 + L * 55;
    ctx.fillStyle = MTN[L];
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 40; x += 40) {
      const wx = x + g.cam * par;
      const y = base - Math.abs(Math.sin(wx * 0.0022 + L * 2.1)) * 130 - Math.sin(wx * 0.011 + L) * 18;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
  // 蜿蜒青绿溪流（海报同款）
  ctx.beginPath();
  for (let x = -20; x <= W + 20; x += 24) {
    const wx = x + g.cam * 0.5;
    ctx.lineTo(x, 462 + Math.sin(wx * 0.0042) * 15 + Math.sin(wx * 0.013) * 4);
  }
  for (let x = W + 20; x >= -20; x -= 24) {
    const wx = x + g.cam * 0.5;
    ctx.lineTo(x, 486 + Math.sin(wx * 0.0042 + 0.5) * 13);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(84,134,116,0.30)'; ctx.fill();
  ctx.strokeStyle = 'rgba(50,72,64,0.25)'; ctx.lineWidth = 1.4; ctx.stroke();
  // 朱色淡日
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#d86a4a';
  ctx.beginPath(); ctx.arc(700 - (g.cam * 0.04) % 200, 95, 34, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
  // 纸纹
  ctx.globalAlpha = 0.5;
  ctx.drawImage(paperTex, 0, 0, W, H);
  ctx.globalAlpha = 1;
}
function drawPlatPoster(p) {
  if (p.solid === 'film') {
    // 画上去的：铅笔虚线，摸不到
    ctx.save();
    ctx.strokeStyle = 'rgba(120,110,90,0.75)'; ctx.lineWidth = 1.6;
    ctx.setLineDash([7, 5]);
    ctx.strokeRect(p.x, p.y, p.w, p.h);
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(120,110,90,0.3)';
    ctx.beginPath();
    ctx.moveTo(p.x + 6, p.y + p.h - 3); ctx.lineTo(p.x + p.w * 0.4, p.y + 3);
    ctx.moveTo(p.x + p.w * 0.55, p.y + p.h - 3); ctx.lineTo(p.x + p.w - 6, p.y + 3);
    ctx.stroke();
    if (p.w >= 160) {
      ctx.fillStyle = 'rgba(120,110,90,0.8)';
      ctx.font = '13px "Kaiti SC","STKaiti",serif';
      ctx.textAlign = 'center';
      ctx.fillText('（画的）', p.x + p.w / 2, p.y - 8);
    }
    ctx.restore();
    return;
  }
  // 真实平台：墨笔触
  const rnd = mulberry(p.seed * 977);
  ctx.save();
  ctx.shadowColor = 'rgba(40,35,28,0.55)'; ctx.shadowBlur = 7;
  ctx.fillStyle = '#2c2822';
  ctx.beginPath();
  ctx.moveTo(p.x, p.y + 3);
  for (let x = 0; x <= p.w; x += 22) ctx.lineTo(p.x + x, p.y + Math.sin(x * 0.4 + p.seed) * 2.4);
  ctx.lineTo(p.x + p.w + 3, p.y + p.h);
  ctx.lineTo(p.x - 2, p.y + p.h - 1);
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  // 飞白
  ctx.globalAlpha = 0.16; ctx.fillStyle = PAPER;
  for (let i = 0; i < 2; i++) {
    const fx = p.x + rnd() * p.w * 0.8, fw = 14 + rnd() * p.w * 0.16;
    ctx.fillRect(fx, p.y + 4 + rnd() * (p.h - 8), fw, 1.6);
  }
  ctx.restore();
}
function drawSpikePoster(s) {
  // 海报里尖刺只是墨草与蓝花，无害
  const rnd = mulberry(s.x);
  ctx.save();
  ctx.strokeStyle = 'rgba(64,76,96,0.55)'; ctx.lineWidth = 1.5;
  for (let x = 6; x < s.w; x += 14) {
    const h = 10 + rnd() * 12, sw = Math.sin(g.time * 1.4 + x) * 2.5;
    ctx.beginPath();
    ctx.moveTo(s.x + x, s.y + s.h);
    ctx.quadraticCurveTo(s.x + x + sw, s.y + s.h - h * 0.7, s.x + x + sw * 2, s.y + s.h - h);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(90,110,150,0.5)';
  for (let x = 14; x < s.w; x += 34) ctx.fillRect(s.x + x, s.y + 4 + rnd() * 6, 2.6, 2.6);
  ctx.restore();
}
function posterOverlay() {
  // 边缘晕染
  const gr = ctx.createRadialGradient(W / 2, H / 2, H * 0.55, W / 2, H / 2, H * 0.95);
  gr.addColorStop(0, 'rgba(40,35,28,0)'); gr.addColorStop(1, 'rgba(40,35,28,0.14)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  // 竖排题字与印章
  ctx.save();
  ctx.fillStyle = 'rgba(42,38,32,0.85)';
  ctx.font = '20px "Kaiti SC","STKaiti",serif';
  ctx.textAlign = 'center';
  const chars = '海报与正片';
  for (let i = 0; i < chars.length; i++) ctx.fillText(chars[i], W - 30, 132 + i * 26);
  ctx.fillStyle = VERM;
  ctx.fillRect(W - 41, 270, 22, 22);
  ctx.fillStyle = PAPER;
  ctx.font = '14px "Kaiti SC","STKaiti",serif';
  ctx.fillText('牛', W - 30, 286);
  ctx.restore();
}

// ---------------- 渲染：正片世界（手搓 low poly） ----------------
function renderFilmBG() {
  // 硬色阶天空（故意的 banding）
  const bands = ['#87a0b8', '#93abc1', '#a2b7ca', '#b3c4d4', '#c5d2de', '#d8e1e9'];
  for (let i = 0; i < 6; i++) { ctx.fillStyle = bands[i]; ctx.fillRect(0, i * 64, W, 64); }
  ctx.fillStyle = '#cfc4b0'; ctx.fillRect(0, 384, W, H - 384);
  ctx.strokeStyle = '#9a9184'; ctx.beginPath(); ctx.moveTo(0, 384.5); ctx.lineTo(W, 384.5); ctx.stroke();
  // 廉价太阳 + 镜头光晕
  ctx.fillStyle = '#fdfdf6'; ctx.beginPath(); ctx.arc(730, 78, 26, 0, 7); ctx.fill();
  ctx.globalAlpha = 0.16;
  for (let i = 1; i <= 4; i++) {
    ctx.fillStyle = i % 2 ? '#ffffff' : '#ffe9b0';
    ctx.beginPath(); ctx.arc(730 - i * 68, 78 + i * 42, 14 - i * 2, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // 无贴图远山（平面三角形）
  for (let k = -1; k < 4; k++) {
    const bx = ((k * 420 - g.cam * 0.3) % (W + 840) + (W + 840)) % (W + 840) - 420;
    ctx.fillStyle = k % 2 ? '#8b9198' : '#7d848c';
    ctx.beginPath();
    ctx.moveTo(bx, 384); ctx.lineTo(bx + 170, 205 + (k % 3) * 30); ctx.lineTo(bx + 360, 384);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3a3d41'; ctx.stroke();
  }
  // 一动不动的云
  ctx.fillStyle = '#eceff2';
  for (let k = 0; k < 3; k++) {
    const cx = ((k * 340 + 120 - g.cam * 0.12) % (W + 300) + (W + 300)) % (W + 300) - 150;
    ctx.fillRect(cx, 60 + k * 46, 92, 16); ctx.fillRect(cx + 18, 48 + k * 46, 54, 14);
  }
}
function box3(x, y, w, h, base, top, side) {
  const dx = 7, dy = 6;
  ctx.fillStyle = top;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y - dy); ctx.lineTo(x + w + dx, y - dy); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#26282b'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = side;
  ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w + dx, y - dy); ctx.lineTo(x + w + dx, y + h - dy); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
  ctx.stroke();
  ctx.fillStyle = base; ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
function drawPlatFilm(p) {
  if (p.solid === 'film') box3(p.x, p.y, p.w, p.h, '#cdbfa8', '#e0d4bd', '#a8997f');
  else box3(p.x, p.y, p.w, p.h, '#9aa0a6', '#b4bac0', '#7c8288');
}
function drawSpikeFilm(s) {
  for (let x = 0; x + 16 <= s.w + 2; x += 16) {
    ctx.fillStyle = (x / 16) % 3 === 2 ? '#767c83' : '#8f959b';
    ctx.beginPath();
    ctx.moveTo(s.x + x, s.y + s.h); ctx.lineTo(s.x + x + 8, s.y); ctx.lineTo(s.x + x + 16, s.y + s.h);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#26282b'; ctx.stroke();
  }
}
function filmOverlay() {
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#555';
  ctx.font = '12px "Songti SC","SimSun",serif';
  ctx.textAlign = 'right';
  ctx.fillText('样片 DEMO · 请勿外传', W - 14, H - 12);
  ctx.restore();
}

// ---------------- 渲染：共用实体 ----------------
function drawTicket(t) {
  const bob = Math.sin(g.time * 2.2 + t.bob) * 3;
  if (g.mode === 'poster') {
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = '#b8922e'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(t.x, t.y + bob, t.r, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(184,146,46,0.7)';
    ctx.font = '9px "Kaiti SC","STKaiti",serif'; ctx.textAlign = 'center';
    ctx.fillText('票', t.x, t.y + bob + 3);
    ctx.restore();
  } else {
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath(); ctx.arc(t.x, t.y + bob, t.r, 0, 7); ctx.fill();
    ctx.strokeStyle = '#26282b'; ctx.stroke();
    ctx.fillStyle = '#26282b';
    ctx.font = 'bold 10px "Songti SC","SimSun",serif'; ctx.textAlign = 'center';
    ctx.fillText('¥', t.x, t.y + bob + 3.5);
  }
}
function drawSign(s) {
  if (g.mode === 'poster') {
    ctx.save();
    ctx.fillStyle = 'rgba(74,68,56,0.92)';
    ctx.font = '15px "Kaiti SC","STKaiti",serif'; ctx.textAlign = 'center';
    ctx.fillText(s.text, s.x, s.y);
    ctx.strokeStyle = 'rgba(74,68,56,0.4)'; ctx.lineWidth = 1;
    const w = ctx.measureText(s.text).width;
    ctx.beginPath(); ctx.moveTo(s.x - w / 2, s.y + 6); ctx.lineTo(s.x + w / 2, s.y + 6); ctx.stroke();
    ctx.restore();
  } else {
    ctx.save();
    ctx.font = '13px "Songti SC","SimSun",serif'; ctx.textAlign = 'center';
    const w = ctx.measureText(s.text).width + 18;
    ctx.strokeStyle = '#5a5d61'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(s.x, s.y + 10); ctx.lineTo(s.x, 500); ctx.stroke();
    ctx.fillStyle = '#dcdcd6';
    ctx.fillRect(s.x - w / 2, s.y - 16, w, 24);
    ctx.strokeStyle = '#26282b'; ctx.lineWidth = 1;
    ctx.strokeRect(s.x - w / 2 + 0.5, s.y - 15.5, w - 1, 23);
    ctx.fillStyle = '#26282b';
    ctx.fillText(s.text, s.x, s.y + 1);
    ctx.restore();
  }
}
function drawCP(c) {
  ctx.save();
  if (g.mode === 'poster') {
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x, c.y - 64); ctx.stroke();
    ctx.fillStyle = c.got ? VERM : 'rgba(42,38,32,0.55)';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - 64); ctx.lineTo(c.x + 34, c.y - 56); ctx.lineTo(c.x, c.y - 46);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = PAPER;
    ctx.font = '11px "Kaiti SC","STKaiti",serif';
    ctx.fillText('记', c.x + 8, c.y - 52);
  } else {
    ctx.strokeStyle = '#5a5d61'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x, c.y - 64); ctx.stroke();
    ctx.fillStyle = c.got ? '#ffd23a' : '#c8cbce';
    ctx.fillRect(c.x, c.y - 64, 34, 18);
    ctx.strokeStyle = '#26282b'; ctx.lineWidth = 1;
    ctx.strokeRect(c.x + 0.5, c.y - 63.5, 33, 17);
    ctx.fillStyle = '#26282b';
    ctx.font = '11px "Songti SC","SimSun",serif';
    ctx.fillText('存', c.x + 11, c.y - 51);
  }
  ctx.restore();
}
function drawGoal() {
  const q = goal;
  ctx.save();
  if (g.mode === 'poster') {
    ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(q.x, q.y + q.h); ctx.lineTo(q.x, q.y + 14);
    ctx.moveTo(q.x + q.w, q.y + q.h); ctx.lineTo(q.x + q.w, q.y + 14);
    ctx.stroke();
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(q.x - 14, q.y + 14); ctx.lineTo(q.x + q.w + 14, q.y + 14); ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(q.x - 6, q.y + 26); ctx.lineTo(q.x + q.w + 6, q.y + 26); ctx.stroke();
    ctx.fillStyle = VERM; ctx.fillRect(q.x + q.w / 2 - 13, q.y + 44, 26, 26);
    ctx.fillStyle = PAPER; ctx.font = '16px "Kaiti SC","STKaiti",serif'; ctx.textAlign = 'center';
    ctx.fillText('入', q.x + q.w / 2, q.y + 63);
    const glow = 0.25 + Math.sin(g.time * 2) * 0.1;
    ctx.globalAlpha = glow; ctx.fillStyle = '#e8a63a';
    ctx.beginPath(); ctx.arc(q.x + q.w / 2, q.y + q.h / 2 + 10, 52, 0, 7); ctx.fill();
  } else {
    box3(q.x - 10, q.y - 20, q.w + 20, q.h + 20, '#b0a794', '#c9c0ad', '#8e8674');
    ctx.fillStyle = '#f5f5ef';
    ctx.fillRect(q.x, q.y - 8, q.w, 26);
    ctx.strokeStyle = '#26282b'; ctx.strokeRect(q.x + 0.5, q.y - 7.5, q.w - 1, 25);
    ctx.fillStyle = '#26282b'; ctx.font = '16px "Songti SC","SimSun",serif'; ctx.textAlign = 'center';
    ctx.fillText('影 院', q.x + q.w / 2, q.y + 10);
    ctx.fillStyle = '#3a3226';
    ctx.fillRect(q.x + q.w / 2 - 16, q.y + 46, 32, 54);
    ctx.strokeRect(q.x + q.w / 2 - 15.5, q.y + 46.5, 31, 53);
  }
  ctx.restore();
}
function drawBird() {
  const bx = bird.x, by = bird.y;
  ctx.save();
  if (g.mode === 'poster') {
    // 朱红云雀（官方海报同款配色）
    const flap = Math.sin(bird.t * 9) * 0.9;
    ctx.strokeStyle = '#c2512f'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx - 14, by - flap * 8);
    ctx.quadraticCurveTo(bx - 5, by - 6 - flap * 5, bx, by);
    ctx.quadraticCurveTo(bx + 5, by - 6 + flap * 5, bx + 14, by + flap * 8);
    ctx.stroke();
    ctx.fillStyle = '#c0432a';
    ctx.beginPath(); ctx.ellipse(bx, by + 2, 5.5, 3.4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#6b2015';
    ctx.beginPath(); ctx.arc(bx + 4.6, by - 0.5, 1.6, 0, 7); ctx.fill();
  } else {
    const up = pl.pose === 0;
    ctx.fillStyle = '#9aa0a6';
    ctx.beginPath(); ctx.moveTo(bx - 9, by); ctx.lineTo(bx + 9, by - 4); ctx.lineTo(bx + 9, by + 4);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#26282b'; ctx.stroke();
    ctx.fillStyle = '#b4bac0';
    ctx.beginPath();
    if (up) { ctx.moveTo(bx - 2, by - 2); ctx.lineTo(bx - 6, by - 14); ctx.lineTo(bx + 4, by - 3); }
    else { ctx.moveTo(bx - 2, by + 2); ctx.lineTo(bx - 6, by + 12); ctx.lineTo(bx + 4, by + 3); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (bird.state === 'follow' && bird.sayT > 0) {
      ctx.fillStyle = '#fff'; ctx.fillRect(bx + 12, by - 22, 34, 16);
      ctx.strokeRect(bx + 12.5, by - 21.5, 33, 15);
      ctx.fillStyle = '#26282b'; ctx.font = '10px "Songti SC","SimSun",serif'; ctx.textAlign = 'center';
      ctx.fillText('。。。', bx + 29, by - 10);
    }
  }
  ctx.restore();
}
function drawPlayer() {
  const px = g.mode === 'film' ? Math.round(pl.x / 2) * 2 : pl.x;
  const py = g.mode === 'film' ? Math.round(pl.y / 2) * 2 : pl.y;
  const cx = px + pl.w / 2, cy = py + pl.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pl.face, 1);

  if (g.mode === 'poster') {
    // 水墨小牛：一笔身子，四笔腿，官方海报同款红披风
    const gliding = !pl.onGround;
    ctx.rotate(gliding ? -0.12 : 0);
    // 红披风（先画，垫在身后，飘）
    const flut = Math.sin(pl.animT * 9) * 3 + (gliding ? 5 : 0);
    ctx.fillStyle = VERM;
    ctx.beginPath();
    ctx.moveTo(8, -11);
    ctx.quadraticCurveTo(-8, -16 - flut, -22 - flut, -6 - flut * 0.8);
    ctx.quadraticCurveTo(-26 - flut * 1.3, 2 - flut * 0.4, -16 - flut * 0.6, 6);
    ctx.quadraticCurveTo(-4, 8, 8, -2);
    ctx.closePath(); ctx.fill();
    // 腿
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const bxx = -10 + i * 7;
      let ang;
      if (gliding) ang = 2.6 + i * 0.12;
      else if (Math.abs(pl.vx) > 20) ang = 1.57 + Math.sin(pl.animT * 14 + i * 1.7) * 0.5;
      else ang = 1.57 + (i % 2 ? 0.06 : -0.06);
      ctx.beginPath();
      ctx.moveTo(bxx, 4);
      ctx.lineTo(bxx + Math.cos(ang) * 10, 4 + Math.sin(ang) * 10);
      ctx.stroke();
    }
    // 身
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.ellipse(-1, -1, 15, 9.5, gliding ? -0.08 : 0, 0, 7); ctx.fill();
    // 头
    ctx.beginPath(); ctx.arc(13, -7, 7.5, 0, 7); ctx.fill();
    // 角
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(10, -13); ctx.quadraticCurveTo(9, -18, 5, -18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(15, -13); ctx.quadraticCurveTo(16, -18, 20, -17); ctx.stroke();
    // 尾
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-15, -3);
    ctx.quadraticCurveTo(-21, -6 + Math.sin(pl.animT * 8) * 3, -23, 1 + Math.sin(pl.animT * 8) * 2);
    ctx.stroke();
    // 披风领结 + 眼
    ctx.fillStyle = VERM; ctx.fillRect(5, -10, 6, 6);
    ctx.fillStyle = PAPER;
    ctx.beginPath(); ctx.arc(15.5, -8.5, 1.5, 0, 7); ctx.fill();
  } else {
    // 手搓小牛：方块拼的，六帧动画，脚底打滑
    const moving = Math.abs(pl.vx) > 20;
    const air = !pl.onGround;
    const o = pl.pose ? 4 : -4;
    ctx.strokeStyle = '#26282b'; ctx.lineWidth = 1;
    // 红披风（正片版：一块硬邦邦的红布片，两帧动画）
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.moveTo(-13, -12);
    ctx.lineTo(-25 + o / 2, -8);
    ctx.lineTo(-25 + o / 2, 6);
    ctx.lineTo(-13, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // 腿（四根方柱）
    for (let i = 0; i < 4; i++) {
      const lx = -12 + i * 7;
      let dx2 = 0;
      if (air) dx2 = i < 2 ? -5 : 5;
      else if (moving) dx2 = (i % 2 ? o : -o);
      ctx.fillStyle = '#8f8474';
      ctx.fillRect(lx + dx2, 2, 5, air ? 9 : 12);
      ctx.strokeRect(lx + dx2 + 0.5, 2.5, 5, air ? 9 : 12);
    }
    // 身（假 3D 盒子）
    ctx.fillStyle = '#c0b29a';
    ctx.beginPath(); ctx.moveTo(-16, -10); ctx.lineTo(-11, -14); ctx.lineTo(19, -14); ctx.lineTo(14, -10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#a89a82';
    ctx.beginPath(); ctx.moveTo(14, -10); ctx.lineTo(19, -14); ctx.lineTo(19, 0); ctx.lineTo(14, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b3a58d';
    ctx.fillRect(-16, -10, 30, 14);
    ctx.strokeRect(-15.5, -9.5, 29, 13);
    // 头（盒子）
    ctx.fillStyle = '#b3a58d';
    ctx.fillRect(9, -22, 13, 11);
    ctx.strokeRect(9.5, -21.5, 12, 10);
    // 鼻（粉色方块）
    ctx.fillStyle = '#d8a8a0';
    ctx.fillRect(18, -16, 5, 5);
    ctx.strokeRect(18.5, -15.5, 4, 4);
    // 角（灰三角）
    ctx.fillStyle = '#8f959b';
    ctx.beginPath(); ctx.moveTo(10, -22); ctx.lineTo(8, -27); ctx.lineTo(13, -22); ctx.closePath(); ctx.fill(); ctx.stroke();
    // 眼（一个像素点，无神）
    ctx.fillStyle = '#26282b';
    ctx.fillRect(15, -19, 2, 2);
  }
  ctx.restore();
}
function drawWall() {
  if (!wall.active) return;
  const wl = g.cam - 60, wr = wall.x;
  if (wr < wl) return;
  ctx.save();
  if (g.mode === 'poster') {
    // 撕纸边
    ctx.fillStyle = '#efe6d2';
    ctx.beginPath();
    ctx.moveTo(wr + 10, 0);
    for (let y = 0; y <= H; y += 26) ctx.lineTo(wr + 10 + Math.sin(y * 0.24 + g.time * 3.5) * 7, y);
    ctx.lineTo(wl, H); ctx.lineTo(wl, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#17140f';
    ctx.beginPath();
    ctx.moveTo(wr, 0);
    for (let y = 0; y <= H; y += 26) ctx.lineTo(wr + Math.sin(y * 0.24 + g.time * 3.5) * 7, y);
    ctx.lineTo(wl, H); ctx.lineTo(wl, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(243,234,216,0.18)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const sy = 90 + i * 120, r = 24 + (i % 2) * 14;
      ctx.beginPath(); ctx.arc(wr - 60 - i * 40, sy, r, g.time * 1.5 + i, g.time * 1.5 + i + 4.4); ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#0c0c0e';
    ctx.fillRect(wl, 0, wr - wl, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let y = 0; y < H; y += 4) { ctx.beginPath(); ctx.moveTo(wl, y + 0.5); ctx.lineTo(wr, y + 0.5); ctx.stroke(); }
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '17px "Songti SC","SimSun",serif'; ctx.textAlign = 'center';
    const msg = '排片已取消';
    for (let i = 0; i < msg.length; i++) ctx.fillText(msg[i], wr - 26, 150 + i * 26);
  }
  ctx.restore();
}
function drawParticles() {
  for (const p of particles) {
    const a = Math.max(0, p.life / p.max);
    ctx.save();
    ctx.globalAlpha = a;
    if (p.type === 'ink') {
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.5 * a, 0, 7); ctx.fill();
    } else if (p.type === 'gold') {
      ctx.fillStyle = '#e0b23a';
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    } else if (p.type === 'burst') {
      ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3 + 2 * a, 0, 7); ctx.fill();
    } else if (p.type === 'plus') {
      ctx.fillStyle = g.mode === 'poster' ? '#8a6a1e' : '#5a4a00';
      ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(p.txt, p.x, p.y);
    }
    ctx.restore();
  }
}
function drawSubtitle() {
  if (!g.sub || g.mode !== 'film' || g.state === 'end') return;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, H - 46, W, 46);
  ctx.fillStyle = '#fff';
  ctx.font = '17px "Songti SC","SimSun",serif';
  ctx.textAlign = 'center';
  ctx.fillText(g.sub.line, W / 2, H - 17);
  ctx.restore();
}
function drawTransition() {
  if (trans.t <= 0) return;
  const p = 1 - trans.t;
  const col = trans.to === 'poster' ? '#1c1a17' : '#8f959b';
  ctx.save();
  ctx.globalAlpha = Math.min(0.9, trans.t * 1.2);
  ctx.fillStyle = col;
  for (const b of trans.blobs) {
    const d = b.spd * p;
    ctx.beginPath();
    ctx.arc(trans.px + Math.cos(b.ang) * d, trans.py + Math.sin(b.ang) * d, b.r * (0.35 + p * 0.9), 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = trans.t * 0.22;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ---------------- 主循环 ----------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
updateHud();
requestAnimationFrame(frame);

// ---------------- 调试接口（供自动化测试用） ----------------
window.game = {
  g, pl, wall, bird, tickets, plats,
  tp(x, y) { pl.x = x; pl.y = y; pl.vx = 0; pl.vy = 0; },
  sw: switchMode,
  start: startGame,
  reset: resetRun,
  win() { pl.x = goal.x + 10; pl.y = goal.y + 40; },
  die,
};
