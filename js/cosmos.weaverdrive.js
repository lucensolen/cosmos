/* ============================================================
   COSMOS WEAVER-DRIVE
   Mini-map engine + cockpit overview
============================================================ */

import { COSMOS, Bus } from "./cosmos.core.js";

/* ============================================================
   INTERNAL
============================================================ */

let miniCanvas, miniCtx;
let running = false;

/* ============================================================
   INIT
============================================================ */

export function init() {
  miniCanvas = document.getElementById("cosmos-mini-map");
  miniCtx = miniCanvas.getContext("2d");

  resizeMini();
  window.addEventListener("resize", resizeMini);

  startMiniLoop();

  console.log("%cWeaver-Drive ready", "color:#7dd3fc");
}

function resizeMini() {
  miniCanvas.width = miniCanvas.clientWidth;
  miniCanvas.height = miniCanvas.clientHeight;
}

/* ============================================================
   MINI-MAP LOOP
============================================================ */

function startMiniLoop() {
  if (running) return;
  running = true;

  function frame() {
    drawMiniMap();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ============================================================
   DRAW MINI-MAP
============================================================ */

function drawMiniMap() {
  if (!miniCtx) return;

  const showMini = document.getElementById("toggle-minimap")?.checked;
  if (!showMini) {
    miniCtx.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
    return;
  }

  // Clear background
  miniCtx.fillStyle = getComputedStyle(document.body).getPropertyValue("--bg-panel");
  miniCtx.fillRect(0, 0, miniCanvas.width, miniCanvas.height);

  const cx = miniCanvas.width / 2;
  const cy = miniCanvas.height / 2;

  const SCALE = 0.15; // Universe → minimap scale

  // Draw Systems
  for (const sys of COSMOS.systems) {
    const sx = cx + sys.x * SCALE;
    const sy = cy + sys.y * SCALE;

    // Glow
    miniCtx.beginPath();
    miniCtx.fillStyle =
      getComputedStyle(document.body).getPropertyValue("--sun-color");
    miniCtx.arc(sx, sy, 3, 0, Math.PI * 2);
    miniCtx.fill();

    // Selection highlight
    if (COSMOS.selection.system === sys.id) {
      miniCtx.strokeStyle = "#fff";
      miniCtx.lineWidth = 1;
      miniCtx.beginPath();
      miniCtx.arc(sx, sy, 6, 0, Math.PI * 2);
      miniCtx.stroke();
    }

    // Planets
    for (const p of sys.planets) {
      const px = cx + p.x * SCALE;
      const py = cy + p.y * SCALE;

      miniCtx.beginPath();
      miniCtx.fillStyle =
        getComputedStyle(document.body).getPropertyValue("--planet-color");
      miniCtx.arc(px, py, 2, 0, Math.PI * 2);
      miniCtx.fill();

      // Planets selection
      if (COSMOS.selection.planet === p.id) {
        miniCtx.strokeStyle = "#fff";
        miniCtx.beginPath();
        miniCtx.arc(px, py, 4, 0, Math.PI * 2);
        miniCtx.stroke();
      }

      // Moons
      for (const m of p.moons) {
        const mx = cx + m.x * SCALE;
        const my = cy + m.y * SCALE;

        miniCtx.beginPath();
        miniCtx.fillStyle =
          getComputedStyle(document.body).getPropertyValue("--moon-color");
        miniCtx.arc(mx, my, 1.4, 0, Math.PI * 2);
        miniCtx.fill();

        if (COSMOS.selection.moon === m.id) {
          miniCtx.strokeStyle = "#fff";
          miniCtx.beginPath();
          miniCtx.arc(mx, my, 3, 0, Math.PI * 2);
          miniCtx.stroke();
        }
      }
    }
  }

  // Draw camera rectangle overlay for reference
  drawCameraViewport();
}

/* ============================================================
   CAMERA VIEWPORT OUTLINE
============================================================ */

function drawCameraViewport() {
  const { x, y, zoom } = COSMOS.camera;

  // Convert world → minimap
  const SCALE = 0.15;

  // Determine map size in world space
  const vw = miniCanvas.width / (zoom / SCALE);
  const vh = miniCanvas.height / (zoom / SCALE);

  const cx = miniCanvas.width / 2;
  const cy = miniCanvas.height / 2;

  const rx = cx - (vw / 2) - x * SCALE;
  const ry = cy - (vh / 2) - y * SCALE;

  miniCtx.strokeStyle = "rgba(255,255,255,0.45)";
  miniCtx.lineWidth = 1;
  miniCtx.strokeRect(rx, ry, vw, vh);
}
