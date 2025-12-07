/* ============================================================
   COSMOS STORAGE ENGINE
   Save + load universe state from localStorage, safely.
============================================================ */

import { COSMOS } from "./cosmos.core.js";

const STORAGE_KEY = "cosmos.state.v1";

/* ============================================================
   SAVE
============================================================ */

export function saveState(COSMOS_STATE) {
  try {
    const data = {
      systems: COSMOS_STATE.systems,
      theme: COSMOS_STATE.theme,
      mode: COSMOS_STATE.mode,
      camera: COSMOS_STATE.camera
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("CosmOS: failed to save state", err);
  }
}

/* ============================================================
   LOAD
============================================================ */

export function loadState(COSMOS_STATE) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return;

    // Restore systems
    if (Array.isArray(data.systems)) {
      COSMOS_STATE.systems = data.systems;
    }

    // Restore theme
    if (data.theme === "light" || data.theme === "dark") {
      COSMOS_STATE.theme = data.theme;

      document.body.classList.remove("theme-light", "theme-dark");
      document.body.classList.add("theme-" + data.theme);
    }

    // Restore mode
    if (data.mode === "generate" || data.mode === "evolve") {
      COSMOS_STATE.mode = data.mode;
    }

    // Restore camera
    if (data.camera && typeof data.camera === "object") {
      COSMOS_STATE.camera.x = Number(data.camera.x) || 0;
      COSMOS_STATE.camera.y = Number(data.camera.y) || 0;
      COSMOS_STATE.camera.zoom = Number(data.camera.zoom) || 1;
    }

  } catch (err) {
    console.warn("CosmOS: failed to load saved state", err);
  }
}
