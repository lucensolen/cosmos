/* ============================================================
   COSMOS UI ENGINE
   Handles:
   - Dropdown menus
   - Breadcrumb updates
   - Right-panel updates (selection summary + logs)
   - Inspector modal open/save/delete
   - Focus + promote buttons
============================================================ */

import { COSMOS, Bus } from "./cosmos.core.js";
import * as Objects from "./cosmos.objects.js";
import * as Store from "./cosmos.storage.js";

/* ============================================================
   DROPDOWN POPULATION
============================================================ */

export function populateSystemDropdown() {
  const sel = document.getElementById("select-system");
  const active = COSMOS.selection.system;

  sel.innerHTML = `<option value="">— None —</option>`;

  for (const sys of COSMOS.systems) {
    const opt = document.createElement("option");
    opt.value = sys.id;
    opt.textContent = sys.title;
    if (sys.id === active) opt.selected = true;
    sel.appendChild(opt);
  }
}

export function populatePlanetDropdown() {
  const sel = document.getElementById("select-planet");
  const active = COSMOS.selection.planet;

  sel.innerHTML = `<option value="">— None —</option>`;

  const sys = COSMOS.systems.find(s => s.id === COSMOS.selection.system);
  if (!sys) return;

  for (const p of sys.planets) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.title;
    if (p.id === active) opt.selected = true;
    sel.appendChild(opt);
  }
}

export function populateMoonDropdown() {
  const sel = document.getElementById("select-moon");
  const active = COSMOS.selection.moon;

  sel.innerHTML = `<option value="">— None —</option>`;

  const sys = COSMOS.systems.find(s => s.id === COSMOS.selection.system);
  const planet = sys?.planets.find(p => p.id === COSMOS.selection.planet);
  if (!planet) return;

  for (const m of planet.moons) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.title;
    if (m.id === active) opt.selected = true;
    sel.appendChild(opt);
  }
}

/* ============================================================
   BREADCRUMBS
============================================================ */

export function updateBreadcrumbs() {
  const sysEl = document.getElementById("crumb-system");
  const plaEl = document.getElementById("crumb-planet");
  const monEl = document.getElementById("crumb-moon");

  const sys = COSMOS.systems.find(s => s.id === COSMOS.selection.system);
  const pla = sys?.planets.find(p => p.id === COSMOS.selection.planet);
  const mon = pla?.moons.find(m => m.id === COSMOS.selection.moon);

  sysEl.textContent = sys ? sys.title : "No system";
  plaEl.textContent = pla ? pla.title : "—";
  monEl.textContent = mon ? mon.title : "—";
}

/* ============================================================
   RIGHT PANEL UPDATE
============================================================ */

export function updateRightPanel() {
  const typeEl = document.getElementById("selection-type");
  const titleEl = document.getElementById("selection-title");
  const pathEl = document.getElementById("selection-path");
  const countEl = document.getElementById("selection-entry-count");
  const updateEl = document.getElementById("selection-last-update");
  const logEl = document.getElementById("entry-log");

  const sys = COSMOS.systems.find(s => s.id === COSMOS.selection.system);
  const pla = sys?.planets.find(p => p.id === COSMOS.selection.planet);
  const mon = pla?.moons.find(m => m.id === COSMOS.selection.moon);

  logEl.innerHTML = "";

  if (!sys) {
    typeEl.textContent = "Nothing selected";
    titleEl.textContent = "—";
    pathEl.textContent = "—";
    countEl.textContent = "0";
    updateEl.textContent = "—";
    return;
  }

  // SYSTEM VIEW
  if (!pla) {
    typeEl.textContent = "System";
    titleEl.textContent = sys.title;
    pathEl.textContent = sys.title;
    countEl.textContent = sys.planets.length + " planets";
    updateEl.textContent = formatTime(sys.updated);
    return;
  }

  // PLANET VIEW
  if (!mon) {
    typeEl.textContent = "Planet";
    titleEl.textContent = pla.title;
    pathEl.textContent = `${sys.title} / ${pla.title}`;
    countEl.textContent = pla.moons.length + " moons";
    updateEl.textContent = formatTime(pla.updated);
    return;
  }

  // MOON VIEW
  typeEl.textContent = "Moon";
  titleEl.textContent = mon.title;
  pathEl.textContent = `${sys.title} / ${pla.title} / ${mon.title}`;
  countEl.textContent = mon.entries.length + " entries";
  updateEl.textContent = formatTime(mon.updated);

  // Render entries
  mon.entries
    .sort((a, b) => a.created - b.created)
    .forEach(entry => {
      const d = document.createElement("div");
      d.className = "log-entry";
      d.innerHTML = `
        <div class="log-text">${entry.text || "(empty entry)"}</div>
        <div class="log-meta">${formatTime(entry.created)}</div>
      `;
      logEl.appendChild(d);
    });
}

function formatTime(ts) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes()
    .toString()
    .padStart(2, "0")} ${d.getDate()}/${d.getMonth() + 1}`;
}

/* ============================================================
   INSPECTOR MODAL
============================================================ */

const modal = document.getElementById("inspector-modal");
const modalBackdrop = modal.querySelector(".modal-backdrop");
const modalClose = document.getElementById("inspector-close");
const modalSave = document.getElementById("inspector-save");
const modalDelete = document.getElementById("inspector-delete");

let modalObject = null;

modalClose.addEventListener("click", closeInspector);
modalBackdrop.addEventListener("click", closeInspector);

function openInspector(obj) {
  modalObject = obj;

  document.getElementById("inspector-title").textContent = obj.title || "Node";
  document.getElementById("inspector-name").value = obj.title || "";
  document.getElementById("inspector-text").value = obj.text || obj.description || "";

  document.getElementById("inspector-meta").innerHTML = `
    Created: ${formatTime(obj.created)}<br>
    Updated: ${formatTime(obj.updated || obj.created)}
  `;

  modal.classList.remove("hidden");
}

function closeInspector() {
  modalObject = null;
  modal.classList.add("hidden");
}

/* SAVE CHANGES */
modalSave.addEventListener("click", () => {
  if (!modalObject) return;

  modalObject.title = document.getElementById("inspector-name").value;
  modalObject.text = document.getElementById("inspector-text").value;
  modalObject.updated = Date.now();

  Bus.emit("state-updated");
  Store.saveState(COSMOS);

  closeInspector();
});

/* DELETE OBJECT */
modalDelete.addEventListener("click", () => {
  if (!modalObject) return;

  Objects.deleteObject(COSMOS, modalObject.id);

  COSMOS.selection.system = null;
  COSMOS.selection.planet = null;
  COSMOS.selection.moon = null;

  Bus.emit("state-updated");
  Store.saveState(COSMOS);

  closeInspector();
});

/* ============================================================
   HOOKS FOR SELECTION FROM MAP
============================================================ */

Bus.on("state-updated", updateRightPanel);

/* ============================================================
   FOCUS BUTTON LOGIC
============================================================ */

document.getElementById("focus-on-selection").addEventListener("click", () => {
  const { system, planet, moon } = COSMOS.selection;

  let obj = null;

  for (const sys of COSMOS.systems) {
    if (sys.id === system) obj = sys;
    for (const p of sys.planets) {
      if (p.id === planet) obj = p;
      for (const m of p.moons) {
        if (m.id === moon) obj = m;
      }
    }
  }

  if (obj) {
    COSMOS.camera.x = obj.x;
    COSMOS.camera.y = obj.y;
    COSMOS.camera.zoom = 1.8;
  }
});

/* ============================================================
   PROMOTE BUTTON
============================================================ */

document.getElementById("promote-to-system").addEventListener("click", () => {
  const { planet, moon } = COSMOS.selection;
  const target = planet || moon;

  if (!target) return;

  const newSys = Objects.promoteToSystem(COSMOS, target);
  if (!newSys) return;

  // Clear selection + refresh UI
  COSMOS.selection.system = newSys.id;
  COSMOS.selection.planet = null;
  COSMOS.selection.moon = null;

  Bus.emit("state-updated");
  Store.saveState(COSMOS);
});

/* ============================================================
   MAP → UI HOOKS (INSPECTOR)
============================================================ */

/* Map engine will eventually call this on double-click if needed */
export function openInspectorFromMap(obj) {
  openInspector(obj);
}
