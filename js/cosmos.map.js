/* ============================================================
   COSMOS MAP ENGINE
   Renders:
   - Suns (Systems)
   - Planets
   - Moons
   Handles:
   - Orbit physics
   - Lineage curves between systems
   - Hit testing & selection
   - Camera (pan + zoom)
   - Animation loop
============================================================ */

import { COSMOS, Bus } from "./cosmos.core.js";

/* ============================================================
   INTERNAL STATE
============================================================ */

let canvas, ctx;
let dragging = false;
let dragStart = { x: 0, y: 0 };

/* ============================================================
   INITIALISATION
============================================================ */

export function init(COSMOS_STATE, BUS) {
  canvas = document.getElementById("cosmos-map");
  ctx = canvas.getContext("2d");

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  initCameraControls();
}

export function startRenderLoop() {
  function frame() {
    drawMap();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ============================================================
   CANVAS SIZE
============================================================ */

function resizeCanvas() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}

/* ============================================================
   CAMERA CONTROLS
============================================================ */

function initCameraControls() {
  canvas.addEventListener("mousedown", e => {
    dragging = true;
    dragStart.x = e.clientX;
    dragStart.y = e.clientY;
  });

  window.addEventListener("mousemove", e => {
    if (!dragging) return;
    COSMOS.camera.x += (e.clientX - dragStart.x) / COSMOS.camera.zoom;
    COSMOS.camera.y += (e.clientY - dragStart.y) / COSMOS.camera.zoom;
    dragStart.x = e.clientX;
    dragStart.y = e.clientY;
  });

  window.addEventListener("mouseup", () => {
    dragging = false;
  });

  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    COSMOS.camera.zoom *= e.deltaY < 0 ? 1.1 : 0.9;
    COSMOS.camera.zoom = Math.max(0.25, Math.min(4, COSMOS.camera.zoom));
  });

  canvas.addEventListener("click", handleClickSelection);
}

/* ============================================================
   CLICK SELECTION HANDLING
============================================================ */

function handleClickSelection(e) {
  const { x, y } = screenToWorld(e.clientX, e.clientY);

  // Hit test: Suns first
  for (const sys of COSMOS.systems) {
    if (hit(sys, x, y)) {
      COSMOS.selection.system = sys.id;
      COSMOS.selection.planet = null;
      COSMOS.selection.moon = null;
      Bus.emit("state-updated");
      return;
    }

    // Planets
    for (const p of sys.planets) {
      if (hit(p, x, y)) {
        COSMOS.selection.system = sys.id;
        COSMOS.selection.planet = p.id;
        COSMOS.selection.moon = null;
        Bus.emit("state-updated");
        return;
      }

      // Moons
      for (const m of p.moons) {
        if (hit(m, x, y)) {
          COSMOS.selection.system = sys.id;
          COSMOS.selection.planet = p.id;
          COSMOS.selection.moon = m.id;
          Bus.emit("state-updated");
          return;
        }
      }
    }
  }
}

function hit(obj, x, y) {
  const dx = x - obj.x;
  const dy = y - obj.y;
  return Math.sqrt(dx * dy + dy * dy) < obj.radius + 6;
}

/* ============================================================
   WORLD <-> SCREEN COORD TRANSFORMS
============================================================ */

function worldToScreen(x, y) {
  return {
    x: (x - COSMOS.camera.x) * COSMOS.camera.zoom + canvas.width / 2,
    y: (y - COSMOS.camera.y) * COSMOS.camera.zoom + canvas.height / 2
  };
}

function screenToWorld(x, y) {
  return {
    x: (x - canvas.width / 2) / COSMOS.camera.zoom + COSMOS.camera.x,
    y: (y - canvas.height / 2) / COSMOS.camera.zoom + COSMOS.camera.y
  };
}

/* ============================================================
   DRAW LOOP
============================================================ */

function drawMap() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--map-bg");
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw lineage system links
  drawSystemLinks();

  // Draw systems (Suns)
  for (const sys of COSMOS.systems) {
    updateSystemPosition(sys);
    drawSystem(sys);

    // Planets
    for (const p of sys.planets) {
      updatePlanetPosition(sys, p);
      drawPlanet(sys, p);

      // Moons
      for (const m of p.moons) {
        updateMoonPosition(p, m);
        drawMoon(sys, p, m);
      }
    }
  }
}

/* ============================================================
   ORBIT PHYSICS
============================================================ */

function updateSystemPosition(sys) {
  // Systems placed in orbit bands outward from origin.
  // Energy controls how far from centre it drifts.
  if (!sys.orbitBand) {
    sys.orbitBand = 200 + Math.random() * 120 + sys.energy * 18;
    sys.orbitAngle = randomAngle();
  }

  sys.orbitAngle += 0.0002; // slow drift
  sys.x = Math.cos(sys.orbitAngle) * sys.orbitBand;
  sys.y = Math.sin(sys.orbitAngle) * sys.orbitBand;
}

function updatePlanetPosition(sys, p) {
  if (!p.orbitRadius) {
    p.orbitRadius = 80 + Math.random() * 50 + p.energy * 12;
    p.orbitAngle = randomAngle();
  }

  p.orbitAngle += 0.0015;

  p.x = sys.x + Math.cos(p.orbitAngle) * p.orbitRadius;
  p.y = sys.y + Math.sin(p.orbitAngle) * p.orbitRadius;
}

function updateMoonPosition(p, m) {
  if (!m.orbitRadius) {
    m.orbitRadius = 28 + Math.random() * 20 + m.energy * 10;
    m.orbitAngle = randomAngle();
  }

  m.orbitAngle += 0.004;

  m.x = p.x + Math.cos(m.orbitAngle) * m.orbitRadius;
  m.y = p.y + Math.sin(m.orbitAngle) * m.orbitRadius;
}

/* ============================================================
   DRAW SYSTEM LINKS (curved arcs between Suns)
============================================================ */

function drawSystemLinks() {
  const showLinks = document.getElementById("toggle-links").checked;
  if (!showLinks) return;

  ctx.strokeStyle = getComputedStyle(document.body)
    .getPropertyValue("--link-stroke");
  ctx.lineWidth = 1.8;

  for (const sys of COSMOS.systems) {
    const start = worldToScreen(sys.x, sys.y);

    for (const ancestor of sys.lineage) {
      const parent = COSMOS.systems.find(s => s.id === ancestor);
      if (!parent) continue;

      const end = worldToScreen(parent.x, parent.y);

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);

      // Midpoint control point for curve
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2 - 60;

      ctx.quadraticCurveTo(midX, midY, end.x, end.y);
      ctx.stroke();
    }
  }
}

/* ============================================================
   DRAW NODES
============================================================ */

function drawSystem(sys) {
  const pos = worldToScreen(sys.x, sys.y);
  const glow = getComputedStyle(document.body)
    .getPropertyValue("--sun-color");

  ctx.beginPath();
  ctx.fillStyle = glow;
  ctx.shadowBlur = 22;
  ctx.shadowColor = glow;
  ctx.arc(pos.x, pos.y, sys.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;

  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--text");
  ctx.font = "13px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(sys.title, pos.x, pos.y - sys.radius - 8);
}

function drawPlanet(sys, p) {
  const showOrbits = document.getElementById("toggle-orbits").checked;
  const posSys = worldToScreen(sys.x, sys.y);
  const pos = worldToScreen(p.x, p.y);

  if (showOrbits) {
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--orbit-stroke");
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(posSys.x, posSys.y, p.orbitRadius * COSMOS.camera.zoom, 0, Math.PI * 2);
    ctx.stroke();
  }

  const glow = getComputedStyle(document.body).getPropertyValue("--planet-color");

  ctx.beginPath();
  ctx.fillStyle = glow;
  ctx.shadowBlur = 14;
  ctx.shadowColor = glow;
  ctx.arc(pos.x, pos.y, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--text");
  ctx.font = "12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(p.title, pos.x, pos.y - p.radius - 6);
}

function drawMoon(sys, p, m) {
  const posPlanet = worldToScreen(p.x, p.y);
  const pos = worldToScreen(m.x, m.y);

  const showOrbits = document.getElementById("toggle-orbits").checked;

  if (showOrbits) {
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--orbit-stroke");
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(posPlanet.x, posPlanet.y, m.orbitRadius * COSMOS.camera.zoom, 0, Math.PI * 2);
    ctx.stroke();
  }

  const glow = getComputedStyle(document.body).getPropertyValue("--moon-color");

  ctx.beginPath();
  ctx.fillStyle = glow;
  ctx.shadowBlur = 12;
  ctx.shadowColor = glow;
  ctx.arc(pos.x, pos.y, m.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--text");
  ctx.font = "11px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(m.title, pos.x, pos.y - m.radius - 4);
}
