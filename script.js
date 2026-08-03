/* ==========================================================================
   Der Himmel über uns – script.js
   Reines Vanilla-JavaScript. Kein Framework, keine Bibliotheken.

   Gliederung (jeder Block ist ein eigenständiges "Modul"):
     0. CONFIG            – hier stellst DU alles ein (Daten & Erinnerungen)
     1. Utils             – kleine Helfer (RNG, clamp, Datum, Haptik ...)
     2. SkyEngine         – Canvas-Hintergrund (Sterne, Mond, Nebel, Aurora,
                            Sternschnuppen, Partikel/Funken) mit rAF-Loop
     3. Parallax          – Gyroskop + Touch-Fallback
     4. MemoryStars       – interaktive Sterne (DOM) + Tages-Freischaltung
     5. Overlay           – Erinnerungs-Card öffnen/schließen (+ Swipe)
     6. ShootingMessages  – angetippte Sternschnuppe zeigt Nachricht
     7. Countdown         – Herz-Button -> Countdown bis zur Rückkehr
     8. Sound             – prozeduraler Wind + Chime (Web Audio, ohne Dateien)
     9. Progress          – "Du hast X von Y Erinnerungen entdeckt."
    10. Finale            – Herz aus Sternen + "Willkommen zurück"
    11. Intro             – Intro-Animation beim ersten Besuch
    12. PWA               – Service Worker registrieren
    13. Init              – alles zusammenstecken
   ========================================================================== */

'use strict';

/* 0. ======================================================================
   CONFIG  –  ▼▼▼  HIER ALLES ANPASSEN  ▼▼▼
   ====================================================================== */
const CONFIG = {
  /* Tag der Rückkehr:
     - Der Herz-Button zeigt den Countdown bis zu diesem Datum.
     - An diesem Tag startet automatisch die Finale-Animation (Herz). */
  END_DATE: '2026-08-14',     // Format: JJJJ-MM-TT

  /* Ton standardmäßig aus (kann per Button eingeschaltet werden). */
  soundDefaultOn: false,

  /* Nachrichten, die eine angetippte Sternschnuppe zeigt. */
  shootingMessages: [
    'Ich denke an dich ❤️',
    'Du bist meine Lieblingperson.',
    'Bald sehen wir uns wieder.',
    'Ich bin so stolz auf dich.',
    'Du bist wunderschön.',
    'Dein Theo liebt dich wirklich sehr.',
  ],

  /* ▼ DEINE STERNE ▼
     Feste Anzahl – alle sind von Anfang an sichtbar. Ein Tipp öffnet den Inhalt.

     Felder pro Stern:
       title     – Überschrift in der Karte
       subtitle  – kleines Label unter dem Stern (z.B. "Foto", "Video")
       text      – Beschreibung / Kompliment (\n = Zeilenumbruch)
       images    – Array mit Bildpfaden, z.B. ['assets/images/foto.jpg']
       video     – Pfad zu einem Video, z.B. 'assets/videos/clip.mp4'
       audio     – Pfad zu einer Audiodatei
       spotify   – normaler Spotify-Link (Track/Album/Playlist) -> wird eingebettet
       x, y      – Position in % (0–100). Um die Mitte herum angeordnet.
     Nicht benötigte Felder einfach weglassen. */
  memories: [
    {
      title: 'Unser erstes Treffen',
      subtitle: 'Alte Errinnerung',
      x: 34, y: 43,
      text: 'Ich weiß noch wie nervös ich an diesen ersten Tagen war. Ich bin und habe mich so in dich verliebt!',
      images: ['assets/images/erinnerung1.jpg'],
    },
    {
      title: 'All die schönen Momente',
      subtitle: 'Momente mit dir',
      x: 66, y: 41,
      text: 'Jetzt sind wir schon so lang zusammen, und wachsen trotzdem immer mehr zusammen.',
      images: ['assets/images/erinnerung2.jpg'],
    },
    {
      title: 'Um dich zum Lachen zu bringen😊',
      subtitle: 'Video',
      x: 50, y: 55,
      text: 'Wir teilen denn selben, weirden Humor. Aber genau deshalb fühle ich mich auch so wohl mit dir',
      video: 'assets/videos/lustig.mp4',
    },
    {
      title: 'Unser Song',
      subtitle: 'Musik',
      x: 33, y: 68,
      text: 'Eigentlich haben wir viele gemeinsame Songs, an diesen muss im Moment öfter denken. Ich hoffe er hilft wenn du dich mal schlecht fühlst',
      // Normalen Spotify-Link einfügen (Song teilen -> Link kopieren):
      spotify: 'https://open.spotify.com/intl-de/track/0aF9m87P8Tja3NUMv4DfHt?si=d0e68318ce654781',
    },
    {
      title: 'Mein Schatz',
      subtitle: 'Kompliment',
      x: 67, y: 68,
      text: 'Lola, du bist die schönste, schlauste und kreativste Person die ich je kennenlernen durfte.\n\nEs gibt niemanden der so ist wie du und auf den ich so unendlich stolz bin. Ich liebe dich von meinem ganz Herzen❤️',
    },
  ],
};

/* Optional zum Testen per URL:
   ?finale=1   -> Finale-Animation (Herz) sofort abspielen                 */
const PARAMS = new URLSearchParams(location.search);

/* 1. ======================================================================
   Utils
   ====================================================================== */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const rand  = (min, max) => min + Math.random() * (max - min);

/* Deterministischer Zufall (mulberry32) – gleiche Seed => gleiche Werte.
   So bleiben Sternpositionen bei jedem Laden identisch. */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Datumshelfer: Tage zwischen zwei Daten (auf Mitternacht normiert). */
function daysBetween(from, to) {
  const a = new Date(from); a.setHours(0, 0, 0, 0);
  const b = new Date(to);   b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / 86400000);
}

/* Sanftes Vibrieren, wenn das Gerät es unterstützt. */
function haptic(pattern) {
  if (navigator.vibrate && !prefersReducedMotion()) {
    try { navigator.vibrate(pattern); } catch (_) {}
  }
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* 2. ======================================================================
   SkyEngine – zeichnet den kompletten Hintergrund auf ein Canvas.
   ====================================================================== */
const SkyEngine = (() => {
  const canvas = $('#sky');
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0, DPR = 1;
  let stars = [];         // Hintergrundsterne (funkeln/pulsieren)
  let nebulae = [];       // langsam driftende Nebel
  let shootingStars = []; // aktive Sternschnuppen
  let particles = [];     // Funken / Sternenstaub (Bursts)
  let moon = null;
  let aurora = { active: false, phase: 0, alpha: 0, target: 0 };
  let constellation = { points: [], edges: [] }; // Erinnerungs-Sterne verbinden

  let parallax = { x: 0, y: 0 };   // wird von Parallax-Modul gesetzt (-1..1)
  let running = false;
  let lastShoot = 0;               // Zeitstempel der letzten Sternschnuppe
  let nextShootGap = randGap();

  function randGap() { return rand(30000, 90000); } // 30–90 s

  /* --- Größe / Retina ------------------------------------------------- */
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2); // DPR deckeln = Performance
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    build();
  }

  /* --- Szene aufbauen (Anzahl abhängig von Fläche) -------------------- */
  function build() {
    const area = W * H;
    const starCount = clamp(Math.round(area / 1600), 80, 260);
    const rng = mulberry32(1234);

    stars = Array.from({ length: starCount }, () => {
      const depth = rng();                       // 0 = fern, 1 = nah (Parallax)
      return {
        x: rng() * W,
        y: rng() * H,
        r: 0.4 + depth * 1.4,
        depth,
        base: 0.3 + rng() * 0.5,                 // Grundhelligkeit
        tw: rng() * Math.PI * 2,                 // Funkel-Phase
        twSpeed: 0.5 + rng() * 1.5,
        pulse: rng() > 0.82,                     // manche pulsieren stärker
      };
    });

    nebulae = Array.from({ length: 4 }, (_, i) => ({
      x: rng() * W,
      y: rng() * H * 0.7,
      r: 180 + rng() * 220,
      hue: 210 + rng() * 60,
      drift: 4 + rng() * 6,
      phase: rng() * Math.PI * 2,
      alpha: 0.05 + rng() * 0.06,
    }));

    moon = {
      x: W * 0.76,
      y: H * 0.2,
      r: clamp(Math.min(W, H) * 0.09, 34, 70),
    };
  }

  /* --- Sternschnuppe erzeugen ---------------------------------------- */
  function spawnShootingStar(forceX, forceY) {
    const startX = forceX ?? rand(W * 0.1, W * 0.9);
    const startY = forceY ?? rand(H * 0.05, H * 0.4);
    const angle = rand(Math.PI * 0.12, Math.PI * 0.32); // nach unten-rechts
    const speed = rand(6, 10);
    shootingStars.push({
      x: startX, y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      len: rand(120, 220),
      life: 1,
      tappable: true,
      // Trefferbox für Tap wird beim Zeichnen aktualisiert
      hitX: startX, hitY: startY,
    });
  }

  /* --- Funken-/Stardust-Burst (Long-Press, neue Erinnerung) ---------- */
  function burst(x, y, opts = {}) {
    const n = opts.count ?? 22;
    const hue = opts.hue ?? 210;
    const spread = opts.spread ?? 2.4;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(0.5, spread);
      particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 0.6,
        r: rand(1, 2.6),
        life: 1,
        decay: rand(0.008, 0.02),
        hue: hue + rand(-20, 20),
      });
    }
    haptic(opts.haptic ?? 12);
  }

  /* --- Aurora (Polarlicht) manchmal einblenden ----------------------- */
  function maybeAurora() {
    if (aurora.active) {
      // langsam ausblenden nach einer Weile
      aurora.target = 0;
      if (aurora.alpha < 0.01) aurora.active = false;
    } else if (Math.random() < 0.00025) {   // sehr selten
      aurora.active = true;
      aurora.target = 0.5;
    }
  }

  /* --- Konstellation: Erinnerungs-Sterne mit feinen Linien verbinden ---
     Punkte kommen normiert (0..1) von MemoryStars. Kanten = jeweils der
     nächste Nachbar -> ergibt automatisch ein stimmiges Sternbild. */
  function setConstellation(points) {
    const edges = [];
    const seen = new Set();
    for (let i = 0; i < points.length; i++) {
      let best = -1, bestD = Infinity;
      for (let j = 0; j < points.length; j++) {
        if (i === j) continue;
        const d = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
        if (d < bestD) { bestD = d; best = j; }
      }
      if (best >= 0) {
        const key = Math.min(i, best) + '-' + Math.max(i, best);
        if (!seen.has(key)) { seen.add(key); edges.push([i, best]); }
      }
    }
    constellation = { points, edges };
  }

  function drawConstellation(t) {
    if (!constellation.points.length) return;
    const ox = parallax.x * 10, oy = parallax.y * 10; // an DOM-Sterne angeglichen
    const shimmer = 0.5 + 0.5 * Math.sin(t / 1600);

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1;
    for (const [a, b] of constellation.edges) {
      const p1 = constellation.points[a], p2 = constellation.points[b];
      const x1 = p1.x * W + ox, y1 = p1.y * H + oy;
      const x2 = p2.x * W + ox, y2 = p2.y * H + oy;
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, `rgba(157,180,255,${0.10 + shimmer * 0.08})`);
      g.addColorStop(0.5, `rgba(200,214,255,${0.16 + shimmer * 0.1})`);
      g.addColorStop(1, `rgba(157,180,255,${0.10 + shimmer * 0.08})`);
      ctx.strokeStyle = g;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    // weicher Anker-Glow hinter jedem Erinnerungs-Stern
    for (const p of constellation.points) {
      const x = p.x * W + ox, y = p.y * H + oy;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 26);
      glow.addColorStop(0, `rgba(157,180,255,${0.22 + shimmer * 0.12})`);
      glow.addColorStop(1, 'rgba(157,180,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* --- Zeichnen -------------------------------------------------------- */
  function drawNebulae(t) {
    ctx.globalCompositeOperation = 'lighter';
    for (const n of nebulae) {
      const ox = Math.sin(t / 9000 + n.phase) * n.drift + parallax.x * 14;
      const oy = Math.cos(t / 11000 + n.phase) * n.drift + parallax.y * 14;
      const g = ctx.createRadialGradient(n.x + ox, n.y + oy, 0, n.x + ox, n.y + oy, n.r);
      g.addColorStop(0, `hsla(${n.hue}, 70%, 60%, ${n.alpha})`);
      g.addColorStop(1, 'hsla(0,0%,0%,0)');
      ctx.fillStyle = g;
      ctx.fillRect(n.x + ox - n.r, n.y + oy - n.r, n.r * 2, n.r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawAurora(t) {
    aurora.alpha += (aurora.target - aurora.alpha) * 0.01;
    if (aurora.alpha < 0.005) return;
    ctx.globalCompositeOperation = 'lighter';
    for (let band = 0; band < 3; band++) {
      ctx.beginPath();
      const baseY = H * (0.14 + band * 0.05);
      for (let x = 0; x <= W; x += 24) {
        const y = baseY + Math.sin(x / 120 + t / 1400 + band) * 26 + Math.sin(x / 40 + t / 900) * 8;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      const hue = 140 + band * 30;
      ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${aurora.alpha * (0.5 - band * 0.12)})`;
      ctx.lineWidth = 30 + band * 10;
      ctx.filter = 'blur(6px)';
      ctx.stroke();
    }
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawMoon(t) {
    const mx = moon.x + parallax.x * 8;
    const my = moon.y + parallax.y * 8;

    // weicher Halo
    const halo = ctx.createRadialGradient(mx, my, moon.r * 0.4, mx, my, moon.r * 3.4);
    halo.addColorStop(0, 'rgba(255, 240, 214, 0.28)');
    halo.addColorStop(1, 'rgba(255, 240, 214, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(mx, my, moon.r * 3.4, 0, Math.PI * 2); ctx.fill();

    // Mondkörper
    const body = ctx.createRadialGradient(mx - moon.r * 0.3, my - moon.r * 0.3, moon.r * 0.2, mx, my, moon.r);
    body.addColorStop(0, '#fffaf0');
    body.addColorStop(1, '#d9d2c4');
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(mx, my, moon.r, 0, Math.PI * 2); ctx.fill();

    // dezente Krater
    ctx.fillStyle = 'rgba(180, 172, 156, 0.35)';
    const craters = [[-0.3, -0.2, 0.16], [0.25, 0.1, 0.12], [0.05, 0.35, 0.1], [-0.15, 0.28, 0.07]];
    for (const [dx, dy, cr] of craters) {
      ctx.beginPath();
      ctx.arc(mx + dx * moon.r, my + dy * moon.r, cr * moon.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawStars(t) {
    for (const s of stars) {
      // Parallax je nach Tiefe
      const px = s.x + parallax.x * (6 + s.depth * 26);
      const py = s.y + parallax.y * (6 + s.depth * 26);

      const flick = s.pulse
        ? 0.5 + 0.5 * Math.sin(t / 500 * s.twSpeed + s.tw)
        : 0.75 + 0.25 * Math.sin(t / 700 * s.twSpeed + s.tw);
      const alpha = clamp(s.base * flick + 0.1, 0, 1);

      ctx.beginPath();
      ctx.arc(px, py, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(238, 242, 255, ${alpha})`;
      ctx.fill();

      // helle Sterne bekommen einen kleinen Glow
      if (s.r > 1.2) {
        ctx.beginPath();
        ctx.arc(px, py, s.r * 2.6, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(px, py, 0, px, py, s.r * 2.6);
        g.addColorStop(0, `rgba(157, 180, 255, ${alpha * 0.5})`);
        g.addColorStop(1, 'rgba(157, 180, 255, 0)');
        ctx.fillStyle = g;
        ctx.fill();
      }
    }
  }

  function drawShootingStars() {
    ctx.globalCompositeOperation = 'lighter';
    for (const sh of shootingStars) {
      sh.x += sh.vx; sh.y += sh.vy;
      sh.hitX = sh.x; sh.hitY = sh.y;
      sh.life -= 0.008;

      const tailX = sh.x - sh.vx * (sh.len / 8);
      const tailY = sh.y - sh.vy * (sh.len / 8);
      const g = ctx.createLinearGradient(sh.x, sh.y, tailX, tailY);
      g.addColorStop(0, `rgba(255,255,255,${clamp(sh.life, 0, 1)})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();

      // heller Kopf
      ctx.beginPath();
      ctx.arc(sh.x, sh.y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${clamp(sh.life, 0, 1)})`;
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    shootingStars = shootingStars.filter(s => s.life > 0 && s.x < W + 100 && s.y < H + 100);
  }

  function drawParticles() {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.02; // leichte Schwerkraft
      p.life -= p.decay;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 90%, 75%, ${clamp(p.life, 0, 1)})`;
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    particles = particles.filter(p => p.life > 0);
  }

  /* --- Hauptschleife --------------------------------------------------- */
  function frame(t) {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);

    drawNebulae(t);
    drawAurora(t);
    drawStars(t);
    drawConstellation(t);
    drawMoon(t);
    drawShootingStars();
    drawParticles();

    // Sternschnuppen zeitgesteuert erzeugen
    if (t - lastShoot > nextShootGap) {
      spawnShootingStar();
      lastShoot = t;
      nextShootGap = randGap();
    }
    maybeAurora();

    requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    lastShoot = performance.now();
    requestAnimationFrame(frame);
  }
  function stop() { running = false; }

  /* Tap-Erkennung für Sternschnuppen (vom Init aufgerufen). */
  function hitShootingStar(x, y) {
    for (const sh of shootingStars) {
      if (!sh.tappable) continue;
      const d = Math.hypot(sh.hitX - x, sh.hitY - y);
      if (d < 44) { sh.tappable = false; return true; }
    }
    return false;
  }

  return {
    resize, start, stop,
    setParallax: (x, y) => { parallax.x = x; parallax.y = y; },
    spawnShootingStar, burst, hitShootingStar, setConstellation,
    get moonPos() { return moon; },
  };
})();

/* 3. ======================================================================
   Parallax – Gyroskop mit Touch-Fallback
   ====================================================================== */
const Parallax = (() => {
  let tx = 0, ty = 0;   // Ziel
  let cx = 0, cy = 0;   // aktuell (geglättet)
  let usingGyro = false;

  function loop() {
    cx += (tx - cx) * 0.06;
    cy += (ty - cy) * 0.06;
    SkyEngine.setParallax(cx, cy);
    // die DOM-Sternenebene leicht mitbewegen (Tiefe)
    starsLayer.style.transform = `translate(${cx * 10}px, ${cy * 10}px)`;
    requestAnimationFrame(loop);
  }

  let starsLayer;
  function init() {
    starsLayer = $('#stars');

    // Touch-Fallback: Finger/Cursor-Position steuert leichte Bewegung
    window.addEventListener('pointermove', (e) => {
      if (usingGyro) return;
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    // Gyroskop, sobald Berechtigung vorhanden ist
    function enableGyro() {
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma == null) return;
        usingGyro = true;
        tx = clamp(e.gamma / 35, -1, 1);   // links/rechts
        ty = clamp((e.beta - 45) / 45, -1, 1); // vor/zurück
      }, { passive: true });
    }

    // iOS verlangt eine Nutzer-Geste für die Berechtigung.
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      const ask = () => {
        DeviceOrientationEvent.requestPermission()
          .then(state => { if (state === 'granted') enableGyro(); })
          .catch(() => {});
        window.removeEventListener('pointerdown', ask);
      };
      window.addEventListener('pointerdown', ask, { once: true });
    } else {
      enableGyro(); // Android & Co.
    }

    requestAnimationFrame(loop);
  }

  return { init };
})();

/* 4. ======================================================================
   MemoryStars – interaktive Sterne (DOM) + Tages-Freischaltung
   ====================================================================== */
const MemoryStars = (() => {
  const layer = $('#stars');
  let starEls = [];

  /* Feste Anzahl: alle Sterne sind sichtbar. */
  function visibleCount() { return CONFIG.memories.length; }

  /* Position pro Stern kommt direkt aus der CONFIG (x/y in %). */
  function positionFor(mem, i) {
    // Fallback, falls mal keine Position gesetzt ist: leicht um die Mitte streuen
    if (typeof mem.x !== 'number' || typeof mem.y !== 'number') {
      const rng = mulberry32(1000 + i * 97);
      return { x: 30 + rng() * 40, y: 42 + rng() * 26 };
    }
    return { x: mem.x, y: mem.y };
  }

  /* Welche Erinnerungen wurden schon geöffnet? (localStorage) */
  function seenSet() {
    try { return new Set(JSON.parse(localStorage.getItem('seenMemories') || '[]')); }
    catch { return new Set(); }
  }
  function markSeen(i) {
    const s = seenSet(); s.add(i);
    localStorage.setItem('seenMemories', JSON.stringify([...s]));
    Progress.update();
  }

  /* SVG eines vierzackigen Funkelsterns. */
  function sparkSVG() {
    return `<svg class="mem-star__spark" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z"/>
    </svg>`;
  }

  function build() {
    layer.innerHTML = '';
    starEls = [];
    const seen = seenSet();
    const points = []; // für die Konstellations-Linien (normiert 0..1)

    CONFIG.memories.forEach((mem, i) => {
      const pos = positionFor(mem, i);
      points.push({ x: pos.x / 100, y: pos.y / 100 });

      const btn = document.createElement('button');
      btn.className = 'mem-star';
      btn.setAttribute('aria-label', `Öffnen: ${mem.title || 'Stern'}`);
      btn.style.left = pos.x + '%';
      btn.style.top = pos.y + '%';
      btn.style.setProperty('--tw', (3 + (i % 4)) + 's');   // variierendes Funkeln
      btn.style.setProperty('--float', (5 + (i % 3)) + 's'); // variierendes Schweben
      btn.style.setProperty('--delay', (i * 0.5) + 's');

      if (!seen.has(i)) btn.classList.add('mem-star--new');

      btn.innerHTML = `${sparkSVG()}<span class="mem-star__label">${mem.subtitle || ''}</span>`;

      bindStar(btn, i, mem);
      layer.appendChild(btn);
      starEls.push(btn);

      // gestaffeltes, sanftes Einblenden
      requestAnimationFrame(() => {
        setTimeout(() => btn.classList.add('mem-star--visible'), 160 * i + 400);
      });
    });

    // Konstellations-Linien im Hintergrund zeichnen lassen
    SkyEngine.setConstellation(points);
    Progress.update();
  }

  /* Interaktion:
     - Press-Feedback (Glow/Scale via CSS)
     - Long-Press erzeugt Funken
     - Loslassen öffnet das Overlay (ein Tipp = Inhalt) */
  function bindStar(btn, i, mem) {
    let pressTimer = null;

    const rectCenter = () => {
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };

    btn.addEventListener('pointerdown', (e) => {
      btn.classList.add('mem-star--press');
      haptic(8);
      pressTimer = setTimeout(() => {
        const c = rectCenter();
        SkyEngine.burst(c.x, c.y, { count: 26, hue: 210, spread: 2.8, haptic: [10, 20, 10] });
      }, 450);
      e.preventDefault();
    });

    const release = () => {
      clearTimeout(pressTimer);
      btn.classList.remove('mem-star--press');
    };

    btn.addEventListener('pointerup', () => {
      release();
      const c = rectCenter();
      if (!seenSet().has(i)) {
        // Sternenstaub-Konfetti beim ersten Öffnen
        SkyEngine.burst(c.x, c.y, { count: 40, hue: 45, spread: 3.2, haptic: [15, 30, 15] });
        btn.classList.remove('mem-star--new');
      }
      markSeen(i);
      Sound.chime();
      Overlay.openMemory(mem);
    });

    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
  }

  return { build, visibleCount, seenSet };
})();

/* 5. ======================================================================
   Overlay – Erinnerungs-Card (öffnen/schließen, Swipe-down, Lazy-Media)
   ====================================================================== */
const Overlay = (() => {
  const overlay = $('#memory-overlay');
  const card    = $('#memory-card');
  const mediaEl = $('#card-media');
  const titleEl = $('#card-title');
  const textEl  = $('#card-text');

  /* Wandelt einen normalen Spotify-Link in die Embed-URL um.
     Aus  open.spotify.com/track/ID       wird
          open.spotify.com/embed/track/ID                                   */
  function spotifyEmbed(url) {
    const m = url.match(/open\.spotify\.com\/(track|album|playlist|episode|show)\/([A-Za-z0-9]+)/);
    if (!m) return null;
    return `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0`;
  }

  function buildMedia(mem) {
    mediaEl.innerHTML = '';

    // Bilder (Array) – oder einzelnes image für Rückwärtskompatibilität
    const imgs = mem.images || (mem.image ? [mem.image] : []);
    imgs.forEach((src) => {
      const img = document.createElement('img');
      img.loading = 'lazy';               // Lazy Loading
      img.decoding = 'async';
      img.src = src;
      img.alt = mem.title || 'Erinnerung';
      mediaEl.appendChild(img);
    });

    if (mem.video) {
      const v = document.createElement('video');
      v.src = mem.video;
      v.controls = true;
      v.playsInline = true;
      v.preload = 'metadata';             // Video erst bei Bedarf laden
      mediaEl.appendChild(v);
    }

    if (mem.audio) {
      const a = document.createElement('audio');
      a.src = mem.audio;
      a.controls = true;
      a.preload = 'none';
      mediaEl.appendChild(a);
    }

    if (mem.spotify) {
      const embed = spotifyEmbed(mem.spotify);
      if (embed) {
        const frame = document.createElement('iframe');
        frame.className = 'card__spotify';
        frame.src = embed;
        frame.loading = 'lazy';
        frame.setAttribute('allow', 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture');
        frame.setAttribute('title', 'Spotify Player');
        mediaEl.appendChild(frame);
      }
      // zusätzlicher Button "In Spotify öffnen"
      const link = document.createElement('a');
      link.className = 'card__spotify-link';
      link.href = mem.spotify;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'In Spotify öffnen';
      mediaEl.appendChild(link);
    }
  }

  function openMemory(mem) {
    buildMedia(mem);
    titleEl.textContent = mem.title || '';
    textEl.textContent  = mem.text || '';
    open();
  }

  function open() {
    overlay.classList.add('overlay--open');
    overlay.setAttribute('aria-hidden', 'false');
  }
  function close() {
    overlay.classList.remove('overlay--open');
    overlay.setAttribute('aria-hidden', 'true');
    // Medien stoppen
    $$('video, audio', mediaEl).forEach(m => { try { m.pause(); } catch (_) {} });
    card.style.transform = '';
  }

  /* Schließen via X, Backdrop-Tap */
  function init() {
    $$('[data-close]', overlay).forEach(el => el.addEventListener('click', close));

    // Swipe nach unten zum Schließen
    let startY = 0, dragging = false, delta = 0;
    card.addEventListener('pointerdown', (e) => {
      // nur greifen, wenn oben im Card (nicht mitten im Scroll)
      if ($('.card__scroll', card).scrollTop > 4) return;
      startY = e.clientY; dragging = true; delta = 0;
      card.style.transition = 'none';
    });
    card.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      delta = Math.max(0, e.clientY - startY);
      card.style.transform = `translateY(${delta}px)`;
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      card.style.transition = '';
      if (delta > 110) { close(); haptic(10); }
      else card.style.transform = 'translateY(0)';
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);

    // ESC schließt (Desktop/Tastatur)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }

  return { init, openMemory, close };
})();

/* 6. ======================================================================
   ShootingMessages – angetippte Sternschnuppe zeigt Nachricht
   ====================================================================== */
const ShootingMessages = (() => {
  const toast = $('#shooting-message');
  let hideTimer = null;

  function show(msg) {
    toast.textContent = msg;
    toast.classList.add('toast--show');
    toast.setAttribute('aria-hidden', 'false');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      toast.classList.remove('toast--show');
      toast.setAttribute('aria-hidden', 'true');
    }, 3400);
  }

  /* Prüft bei jedem Tap, ob eine Sternschnuppe getroffen wurde. */
  function init() {
    window.addEventListener('pointerdown', (e) => {
      // nur reagieren, wenn nicht auf einen UI-Button getippt
      if (e.target.closest('button, .card, .countdown, .overlay--open')) return;
      if (SkyEngine.hitShootingStar(e.clientX, e.clientY)) {
        const msg = CONFIG.shootingMessages[Math.floor(Math.random() * CONFIG.shootingMessages.length)];
        show(msg);
        Sound.chime();
        haptic(20);
      }
    }, { passive: true });
  }

  return { init };
})();

/* 7. ======================================================================
   Countdown – Herz-Button öffnet Countdown bis zur Rückkehr
   ====================================================================== */
const Countdown = (() => {
  const overlay = $('#countdown-overlay');
  const grid = $('#countdown-grid');
  const sub  = $('#countdown-sub');
  const cells = {};
  let timer = null;
  const parts = [
    ['days', 'Tage'], ['hours', 'Std'], ['mins', 'Min'], ['secs', 'Sek'],
  ];

  function buildGrid() {
    grid.innerHTML = '';
    for (const [key, label] of parts) {
      const cell = document.createElement('div');
      cell.className = 'cd-cell';
      cell.innerHTML = `<div class="cd-cell__num" id="cd-${key}">00</div><div class="cd-cell__label">${label}</div>`;
      grid.appendChild(cell);
      cells[key] = $(`#cd-${key}`, grid);
    }
  }

  function tick() {
    const now = new Date();
    const end = new Date(CONFIG.END_DATE + 'T00:00:00');
    let diff = Math.max(0, end - now);

    const days = Math.floor(diff / 86400000); diff -= days * 86400000;
    const hours = Math.floor(diff / 3600000); diff -= hours * 3600000;
    const mins = Math.floor(diff / 60000);    diff -= mins * 60000;
    const secs = Math.floor(diff / 1000);

    setNum('days', days);
    setNum('hours', hours);
    setNum('mins', mins);
    setNum('secs', secs);

    if (end - now <= 0) {
      sub.textContent = 'Du bist wieder da. ❤️';
    } else {
      sub.textContent = 'Ich zähle die Sekunden.';
    }
  }

  function setNum(key, val) {
    const el = cells[key];
    const str = String(val).padStart(2, '0');
    if (el.textContent !== str) {
      el.textContent = str;
      el.classList.remove('cd-cell__num--tick');
      void el.offsetWidth;               // Reflow -> Animation neu starten
      el.classList.add('cd-cell__num--tick');
    }
  }

  function open() {
    overlay.classList.add('overlay--open');
    overlay.setAttribute('aria-hidden', 'false');
    tick();
    timer = setInterval(tick, 1000);
    haptic(10);
  }
  function close() {
    overlay.classList.remove('overlay--open');
    overlay.setAttribute('aria-hidden', 'true');
    clearInterval(timer);
  }

  function init() {
    buildGrid();
    $('#heart-btn').addEventListener('click', open);
    $$('[data-close]', overlay).forEach(el => el.addEventListener('click', close));
  }

  return { init };
})();

/* 8. ======================================================================
   Sound – prozeduraler Wind + Chime (Web Audio API, ganz ohne Dateien).
   Optional aktivierbar. Läuft nur nach einer Nutzer-Geste (Browser-Regel).
   ====================================================================== */
const Sound = (() => {
  let ctxA = null;
  let windGain = null;
  let enabled = false;

  function ensureCtx() {
    if (ctxA) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctxA = new AC();
  }

  /* Wind = gefiltertes weißes Rauschen mit langsam pendelnder Frequenz. */
  function startWind() {
    if (!ctxA || windGain) return;
    const bufferSize = 2 * ctxA.sampleRate;
    const buffer = ctxA.createBuffer(1, bufferSize, ctxA.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctxA.createBufferSource();
    noise.buffer = buffer; noise.loop = true;

    const filter = ctxA.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;

    // langsame Modulation der Filterfrequenz -> "atmender" Wind
    const lfo = ctxA.createOscillator();
    const lfoGain = ctxA.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(filter.frequency);

    windGain = ctxA.createGain();
    windGain.gain.value = 0.0;

    noise.connect(filter).connect(windGain).connect(ctxA.destination);
    noise.start(); lfo.start();

    // sanft einblenden
    windGain.gain.linearRampToValueAtTime(0.05, ctxA.currentTime + 3);
  }

  /* Leiser Chime beim Öffnen (Grundton + Quinte). */
  function chime() {
    if (!enabled || !ctxA) return;
    const now = ctxA.currentTime;
    [523.25, 783.99].forEach((freq, i) => {
      const osc = ctxA.createOscillator();
      const g = ctxA.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.12, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.6 + i * 0.2);
      osc.connect(g).connect(ctxA.destination);
      osc.start(now); osc.stop(now + 2);
    });
  }

  function setEnabled(on) {
    enabled = on;
    ensureCtx();
    if (ctxA && ctxA.state === 'suspended') ctxA.resume();
    if (on) startWind();
    if (windGain) {
      windGain.gain.cancelScheduledValues(ctxA.currentTime);
      windGain.gain.linearRampToValueAtTime(on ? 0.05 : 0.0, ctxA.currentTime + 1);
    }
  }

  function init() {
    const btn = $('#sound-btn');
    enabled = CONFIG.soundDefaultOn;
    btn.setAttribute('aria-pressed', String(enabled));
    btn.addEventListener('click', () => {
      enabled = !enabled;
      btn.setAttribute('aria-pressed', String(enabled));
      btn.setAttribute('aria-label', enabled ? 'Ton ausschalten' : 'Ton einschalten');
      setEnabled(enabled);
      haptic(8);
    });
    if (enabled) {
      // erst nach erster Geste starten (Autoplay-Policy)
      window.addEventListener('pointerdown', () => setEnabled(true), { once: true });
    }
  }

  return { init, chime, setEnabled };
})();

/* 9. ======================================================================
   Progress – "Du hast bereits X von Y Erinnerungen entdeckt."
   ====================================================================== */
const Progress = (() => {
  const el = $('#progress');

  function update() {
    const total = MemoryStars.visibleCount();
    const seen = [...MemoryStars.seenSet()].filter(i => i < total).length;
    if (total <= 0) { el.classList.remove('progress--show'); return; }
    el.textContent = `Du hast ${seen} von ${total} Erinnerungen entdeckt.`;
    el.classList.add('progress--show');
  }

  return { update };
})();

/* 10. =====================================================================
   Finale – Herz aus Sternen + "Willkommen zurück"
   ====================================================================== */
const Finale = (() => {
  const wrap = $('#finale');
  const canvas = $('#finale-canvas');
  const textEl = $('#finale-text');
  const ctx = canvas.getContext('2d');
  let raf = null;

  /* Herzkurve: liefert Punkt (x,y) für Parameter t in [0, 2π]. */
  function heartPoint(t, scale, cx, cy) {
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return { x: cx + x * scale, y: cy - y * scale };
  }

  function shouldPlay() {
    if (PARAMS.get('finale') === '1') return true;
    return daysBetween(new Date(), CONFIG.END_DATE) <= 0; // Rückkehrtag erreicht
  }

  function play() {
    wrap.classList.add('finale--show');
    wrap.setAttribute('aria-hidden', 'false');

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const scale = Math.min(W, H) * 0.028;
    const cx = W / 2, cy = H / 2;

    // Ziel-Punkte auf der Herzkurve
    const N = 90;
    const targets = Array.from({ length: N }, (_, i) => heartPoint((i / N) * Math.PI * 2, scale, cx, cy));

    // Sterne starten zufällig verteilt und fliegen zum Herz
    const dots = targets.map(tp => ({
      x: rand(0, W), y: rand(0, H),
      tx: tp.x, ty: tp.y,
      r: rand(1.4, 2.6),
    }));

    let progress = 0;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      progress = Math.min(1, progress + 0.012);
      const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic

      ctx.globalCompositeOperation = 'lighter';
      dots.forEach((d, i) => {
        const x = d.x + (d.tx - d.x) * ease;
        const y = d.y + (d.ty - d.y) * ease;

        // Verbindungslinien, sobald das Herz fast fertig ist
        if (ease > 0.7) {
          const next = dots[(i + 1) % dots.length];
          const nx = next.x + (next.tx - next.x) * ease;
          const ny = next.y + (next.ty - next.y) * ease;
          ctx.strokeStyle = `rgba(255,107,138,${(ease - 0.7) / 0.3 * 0.6})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke();
        }

        // leuchtender Sternpunkt
        const glow = ctx.createRadialGradient(x, y, 0, x, y, d.r * 5);
        glow.addColorStop(0, `rgba(255,180,200,${0.5 + 0.5 * ease})`);
        glow.addColorStop(1, 'rgba(255,107,138,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(x, y, d.r * 5, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x, y, d.r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';

      if (ease > 0.85 && !textEl.classList.contains('finale__text--show')) {
        textEl.classList.add('finale__text--show');
        haptic([30, 60, 30, 60, 120]);
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
  }

  function init() {
    if (shouldPlay()) {
      // kurz warten, damit die Szene erst ruhig da ist
      setTimeout(play, 1200);
    }
  }

  return { init, play };
})();

/* 11. =====================================================================
   Intro – Intro-Animation nur beim ersten Besuch
   ====================================================================== */
const Intro = (() => {
  const el = $('#intro');

  function init() {
    const seen = localStorage.getItem('introSeen');
    if (seen) { el.remove(); return; }

    localStorage.setItem('introSeen', '1');
    // nach der Animation ausblenden und entfernen
    setTimeout(() => el.classList.add('intro--hide'), 2800);
    setTimeout(() => el.remove(), 4200);
  }

  return { init };
})();

/* 12. =====================================================================
   PWA – Service Worker registrieren (nur über http/https, nicht file://)
   ====================================================================== */
function registerServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {/* still fine */});
    });
  }
}

/* 13. =====================================================================
   Init – alles zusammenstecken
   ====================================================================== */
function init() {
  // Hintergrund
  SkyEngine.resize();
  SkyEngine.start();

  // Fenstergröße ändern (Debounce)
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => SkyEngine.resize(), 150);
  });

  // Animationen pausieren, wenn der Tab im Hintergrund ist (Akku/Performance)
  document.addEventListener('visibilitychange', () => {
    document.hidden ? SkyEngine.stop() : SkyEngine.start();
  });

  // Module starten
  Parallax.init();
  MemoryStars.build();
  Overlay.init();
  ShootingMessages.init();
  Countdown.init();
  Sound.init();
  Intro.init();
  Finale.init();

  // Hinweis-Text ausblenden, sobald der erste Stern geöffnet wurde
  const hint = $('#hero-hint');
  document.addEventListener('pointerup', (e) => {
    if (e.target.closest('.mem-star')) hint.classList.add('hero__hint--gone');
  });

  registerServiceWorker();
}

// Start, sobald das DOM bereit ist
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
