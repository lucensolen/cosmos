/* ============================================================
   COSMOS CORE
   Bootstraps the entire Universe Engine.
   Loads modules, initialises state, handles global events.
============================================================ */

/* Module imports */
import * as Objects from "./cosmos.objects.js";
import * as MapEngine from "./cosmos.map.js";
import * as UI from "./cosmos.ui.js";
import * as Timeline from "./cosmos.timeline.js";
import * as Drive from "./cosmos.weaverdrive.js";
import * as Store from "./cosmos.storage.js";

/* ============================================================
   GLOBAL COSMOS STATE
   (suns, planets, moons, entries, attachments, modes, etc.)
============================================================ */

export const COSMOS = {
  mode: "generate", // generate | evolve
  theme: "dark",

  selection: {
    system: null,
    planet: null,
    moon: null
  },

  systems: [], // array of Sun objects
  timeline: [], // historical snapshots

  /* used by minimap + main map */
  camera: {
    x: 0,
    y: 0,
    zoom: 1
  }
};

/* Expose globally for debugging */
window.COSMOS = COSMOS;

/* ============================================================
   EVENT BUS (Simple pub/sub)
============================================================ */

export const Bus = {
  events: {},
  on(event, fn) {
    (this.events[event] ??= []).push(fn);
  },
  emit(event, payload) {
    (this.events[event] || []).forEach(fn => fn(payload));
  }
};

/* ============================================================
   INITIAL SETUP
============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  initHelpPopover();
  initModeToggle();
  initDropdowns();
  initCreateSystem();
  initCreateNode();
  initEnergySlider();

  // Load saved state from storage
  Store.loadState(COSMOS);

  // Initialise cosmos map
  MapEngine.init(COSMOS, Bus);

  // Initialise minimap + timeline + drive
  Drive.init(COSMOS, Bus);
  Timeline.init(COSMOS, Bus);

  // Render initial map
  MapEngine.startRenderLoop();

  console.log("%cCosmOS core loaded", "color: #fbbf24");
});

/* ============================================================
   THEME TOGGLE
============================================================ */

function initThemeToggle() {
  const btn = document.getElementById("theme-toggle");
  btn.addEventListener("click", () => {
    const body = document.body;

    if (body.classList.contains("theme-dark")) {
      body.classList.remove("theme-dark");
      body.classList.add("theme-light");
      COSMOS.theme = "light";
    } else {
      body.classList.remove("theme-light");
      body.classList.add("theme-dark");
      COSMOS.theme = "dark";
    }

    Store.saveState(COSMOS);
  });
}

/* ============================================================
   HELP POPOVER (lightweight)
============================================================ */

function initHelpPopover() {
  const pop = document.getElementById("help-popover");
  const content = document.getElementById("help-content");
  const triggers = document.querySelectorAll(".inline-help");

  const HELP_TEXT = {
    system: `
      <strong>Systems</strong> are star-level structures (Suns).
      Use Generate mode to create new systems.
      Each system can hold planets, moons, and entries.
    `,
    node: `
      <strong>Add New</strong> creates a planet, moon, or entry depending on lineage.
      In Generate mode: creates a connected system (Sun).
      In Evolve mode: creates planets → moons → entries.
    `
  };

  triggers.forEach(btn => {
    btn.addEventListener("mouseenter", () => {
      const key = btn.dataset.help;
      const rect = btn.getBoundingClientRect();

      content.innerHTML = HELP_TEXT[key] || "No help available.";
      pop.classList.remove("hidden");

      pop.style.left = rect.left + "px";
      pop.style.top = rect.bottom + "px";
    });

    btn.addEventListener("mouseleave", () => {
      pop.classList.add("hidden");
    });
  });
}

/* ============================================================
   MODE SWITCHER (Generate / Evolve)
============================================================ */

function initModeToggle() {
  const gen = document.getElementById("mode-generate");
  const evo = document.getElementById("mode-evolve");

  const setMode = mode => {
    COSMOS.mode = mode;
    gen.classList.toggle("active", mode === "generate");
    evo.classList.toggle("active", mode === "evolve");
    Store.saveState(COSMOS);
  };

  gen.addEventListener("click", () => setMode("generate"));
  evo.addEventListener("click", () => setMode("evolve"));

  setMode(COSMOS.mode); // initialise
}

/* ============================================================
   DROPDOWNS (system / planet / moon selectors)
============================================================ */

function initDropdowns() {
  const sysSel = document.getElementById("select-system");
  const plaSel = document.getElementById("select-planet");
  const monSel = document.getElementById("select-moon");

  function refresh() {
    UI.populateSystemDropdown(COSMOS);
    UI.populatePlanetDropdown(COSMOS);
    UI.populateMoonDropdown(COSMOS);
    UI.updateBreadcrumbs(COSMOS);
    UI.updateRightPanel(COSMOS);
  }

  sysSel.addEventListener("change", () => {
    COSMOS.selection.system = sysSel.value || null;
    COSMOS.selection.planet = null;
    COSMOS.selection.moon = null;
    refresh();
  });

  plaSel.addEventListener("change", () => {
    COSMOS.selection.planet = plaSel.value || null;
    COSMOS.selection.moon = null;
    refresh();
  });

  monSel.addEventListener("change", () => {
    COSMOS.selection.moon = monSel.value || null;
    refresh();
  });

  Bus.on("state-updated", refresh);
  refresh();
}

/* ============================================================
   CREATE SYSTEM (Sun)
============================================================ */

function initCreateSystem() {
  const btn = document.getElementById("create-system");
  const name = document.getElementById("system-name-input");
  const lens = document.getElementById("system-lens");

  btn.addEventListener("click", () => {
    if (!name.value.trim()) return;

    const sys = Objects.createSystem({
      title: name.value.trim(),
      description: lens.value.trim(),
      energy: 0
    });

    COSMOS.systems.push(sys);

    name.value = "";
    lens.value = "";

    Bus.emit("state-updated");
    Store.saveState(COSMOS);
  });
}

/* ============================================================
   CREATE NODE (Planet / Moon / Entry / New System via Generate)
============================================================ */

function initCreateNode() {
  const btn = document.getElementById("create-node");
  const title = document.getElementById("node-title-input");
  const lens = document.getElementById("node-lens");
  const tone = document.getElementById("tone-select");
  const slider = document.getElementById("energy-slider");

  btn.addEventListener("click", () => {
    if (!title.value.trim()) return;

    const payload = {
      title: title.value.trim(),
      text: lens.value.trim(),
      tone: tone.value,
      energy: Number(slider.value)
    };

    Objects.createNode(COSMOS, payload);

    title.value = "";
    lens.value = "";

    Bus.emit("state-updated");
    Store.saveState(COSMOS);
  });
}

/* ============================================================
   ENERGY SLIDER READOUT
============================================================ */

function initEnergySlider() {
  const slider = document.getElementById("energy-slider");
  const readout = document.getElementById("energy-readout");

  const labels = {
    "-5": "Deep inner orbit",
    "-4": "Inner orbit",
    "-3": "Close orbit",
    "-2": "Near orbit",
    "-1": "Lower orbit",
     "0": "Centre orbit",
     "1": "Outer orbit",
     "2": "Further orbit",
     "3": "Far orbit",
     "4": "Deep outer orbit",
     "5": "Very far orbit"
  };

  slider.addEventListener("input", () => {
    readout.textContent = labels[String(slider.value)];
  });
}
