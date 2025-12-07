/* ============================================================
   COSMOS TIMELINE ENGINE
   Handles:
   - Snapshotting universe states
   - Timeline slider (scrub through past)
   - Play / pause simulation
   - Restoring historical states
============================================================ */

import { COSMOS, Bus } from "./cosmos.core.js";
import * as Store from "./cosmos.storage.js";

/* ============================================================
   INTERNAL STATE
============================================================ */

let playing = false;
let playInterval = null;

const slider = document.getElementById("timeline-slider");
const label = document.getElementById("timeline-label");
const playBtn = document.getElementById("timeline-play");
const pauseBtn = document.getElementById("timeline-pause");

/* ============================================================
   INIT
============================================================ */

export function init() {
  initButtons();
  initSlider();

  // Take initial snapshot (empty or loaded universe)
  snapshot("initial");
}

/* ============================================================
   SNAPSHOT LOGIC
   Shallow clone is not enough — we need deep clone.
============================================================ */

export function snapshot(reason = "update") {
  // Deep clone the whole universe
  const clone = JSON.parse(JSON.stringify(COSMOS.systems));

  COSMOS.timeline.push({
    time: Date.now(),
    systems: clone,
    reason
  });

  slider.max = COSMOS.timeline.length - 1;
  slider.value = slider.max;
  updateLabel();
}

/* Take snapshot on every major state change */
Bus.on("state-updated", () => snapshot("state-change"));

/* ============================================================
   RESTORE SNAPSHOT
============================================================ */

function restoreSnapshot(index) {
  const snap = COSMOS.timeline[index];
  if (!snap) return;

  // Replace universe with snapshot
  COSMOS.systems = JSON.parse(JSON.stringify(snap.systems));

  updateLabel();
  Bus.emit("state-updated");
  Store.saveState(COSMOS);
}

/* ============================================================
   TIMELINE SLIDER
============================================================ */

function initSlider() {
  slider.addEventListener("input", () => {
    const idx = Number(slider.value);
    restoreSnapshot(idx);
  });
}

function updateLabel() {
  const idx = Number(slider.value);
  const snap = COSMOS.timeline[idx];
  if (!snap) {
    label.textContent = "Now";
    return;
  }

  const date = new Date(snap.time);
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");

  label.textContent = idx === slider.max ? "Now" : `${hh}:${mm}`;
}

/* ============================================================
   PLAYBACK CONTROLS
============================================================ */

function initButtons() {
  playBtn.addEventListener("click", () => {
    if (playing) return;
    playing = true;

    playInterval = setInterval(() => {
      const idx = Number(slider.value);

      if (idx < slider.max) {
        slider.value = idx + 1;
        restoreSnapshot(idx + 1);
      } else {
        pausePlayback();
      }
    }, 600); // 0.6 sec per step
  });

  pauseBtn.addEventListener("click", pausePlayback);
}

function pausePlayback() {
  playing = false;
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
}
