/* ============================================================
   COSMOS – BUNDLED ENGINE
   Single-file version (no ES modules, no imports).
   Works from file:// and any basic HTTP host.
============================================================ */
(function () {
  /* ==========================================================
     GLOBAL STATE + EVENT BUS
  ========================================================== */
  const COSMOS = {
    mode: "generate", // generate | evolve
    theme: "dark",
    selection: {
      system: null,
      planet: null,
      moon: null,
    },
    systems: [],
    timeline: [],
    camera: { x: 0, y: 0, zoom: 1 },
  };

  // expose for debugging
  window.COSMOS = COSMOS;

  const Bus = {
    events: {},
    on(event, fn) {
      (this.events[event] ??= []).push(fn);
    },
    emit(event, payload) {
      (this.events[event] || []).forEach((fn) => fn(payload));
    },
  };
  window.CosmOSBus = Bus;

  /* ==========================================================
     SMALL HELPERS
  ========================================================== */
  function uid() {
    if (window.crypto?.randomUUID) return crypto.randomUUID();
    return "c-" + Math.random().toString(36).slice(2);
  }

  function now() {
    return Date.now();
  }

  function randomAngle() {
    return Math.random() * Math.PI * 2;
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return (
      d.getHours().toString().padStart(2, "0") +
      ":" +
      d.getMinutes().toString().padStart(2, "0") +
      " " +
      d.getDate() +
      "/" +
      (d.getMonth() + 1)
    );
  }

  /* ==========================================================
     STORAGE (localStorage)
  ========================================================== */
  const STORAGE_KEY = "cosmos.state.v1";

  function saveState() {
    try {
      const data = {
        systems: COSMOS.systems,
        theme: COSMOS.theme,
        mode: COSMOS.mode,
        camera: COSMOS.camera,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("CosmOS: save failed", e);
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return;

      if (Array.isArray(data.systems)) COSMOS.systems = data.systems;
      if (data.theme === "light" || data.theme === "dark") {
        COSMOS.theme = data.theme;
        document.body.classList.remove("theme-light", "theme-dark");
        document.body.classList.add("theme-" + data.theme);
      }
      if (data.mode === "generate" || data.mode === "evolve") {
        COSMOS.mode = data.mode;
      }
      if (data.camera && typeof data.camera === "object") {
        COSMOS.camera.x = Number(data.camera.x) || 0;
        COSMOS.camera.y = Number(data.camera.y) || 0;
        COSMOS.camera.zoom = Number(data.camera.zoom) || 1;
      }
    } catch (e) {
      console.warn("CosmOS: load failed", e);
    }
  }

  /* ==========================================================
     OBJECT FACTORIES
  ========================================================== */
  function createSystem({ title, description, energy = 0 }) {
    return {
      id: uid(),
      type: "system",
      title,
      description,
      created: now(),
      updated: now(),
      energy,
      planets: [],
      lineage: [],
      x: 0,
      y: 0,
      radius: 40,
      orbitBand: 0,
      orbitAngle: randomAngle(),
    };
  }

  function createPlanet({ title, text, tone, energy }) {
    return {
      id: uid(),
      type: "planet",
      title,
      text,
      tone,
      energy,
      created: now(),
      updated: now(),
      moons: [],
      entries: [],
      x: 0,
      y: 0,
      radius: 26,
      orbitRadius: 0,
      orbitAngle: randomAngle(),
    };
  }

  function createMoon({ title, text, tone, energy }) {
    return {
      id: uid(),
      type: "moon",
      title,
      text,
      tone,
      energy,
      created: now(),
      updated: now(),
      entries: [],
      x: 0,
      y: 0,
      radius: 14,
      orbitRadius: 0,
      orbitAngle: randomAngle(),
    };
  }

  function createEntry({ text, tone }) {
    return {
      id: uid(),
      type: "entry",
      text,
      tone,
      created: now(),
    };
  }

  /* ==========================================================
     NODE CREATION (Generate / Evolve)
  ========================================================== */
  function createNode(payload) {
    const { title, text, tone, energy } = payload;
    const sel = COSMOS.selection;

    const sys = COSMOS.systems.find((s) => s.id === sel.system);
    const pla = sys?.planets.find((p) => p.id === sel.planet);
    const moon = pla?.moons.find((m) => m.id === sel.moon);

    // GENERATE → new System
    if (COSMOS.mode === "generate") {
      if (!sys) {
        const newSys = createSystem({ title, description: text, energy });
        COSMOS.systems.push(newSys);
        return newSys;
      }
      const newSys = createSystem({ title, description: text, energy });
      newSys.lineage.push(sys.id);
      COSMOS.systems.push(newSys);
      return newSys;
    }

    // EVOLVE → Planet / Moon / Entry
    if (sys && !pla) {
      const planet = createPlanet({ title, text, tone, energy });
      sys.planets.push(planet);
      sys.updated = now();
      return planet;
    }

    if (pla && !moon) {
      const m = createMoon({ title, text, tone, energy });
      pla.moons.push(m);
      pla.updated = now();
      return m;
    }

    if (moon) {
      const entry = createEntry({ text, tone });
      moon.entries.push(entry);
      moon.updated = now();
      return entry;
    }
  }

  function promoteToSystem(id) {
    // planets
    for (const sys of COSMOS.systems) {
      const pIdx = sys.planets.findIndex((p) => p.id === id);
      if (pIdx !== -1) {
        const planet = sys.planets.splice(pIdx, 1)[0];
        const newSys = createSystem({
          title: planet.title,
          description: planet.text,
          energy: planet.energy,
        });
        newSys.lineage.push(sys.id);
        COSMOS.systems.push(newSys);
        return newSys;
      }
      for (const planet of sys.planets) {
        const mIdx = planet.moons.findIndex((m) => m.id === id);
        if (mIdx !== -1) {
          const moon = planet.moons.splice(mIdx, 1)[0];
          const newSys = createSystem({
            title: moon.title,
            description: moon.text,
            energy: moon.energy,
          });
          newSys.lineage.push(planet.id, sys.id);
          COSMOS.systems.push(newSys);
          return newSys;
        }
      }
    }
    return null;
  }

  function deleteObject(id) {
    let idx = COSMOS.systems.findIndex((s) => s.id === id);
    if (idx !== -1) {
      COSMOS.systems.splice(idx, 1);
      return true;
    }
    for (const sys of COSMOS.systems) {
      idx = sys.planets.findIndex((p) => p.id === id);
      if (idx !== -1) {
        sys.planets.splice(idx, 1);
        return true;
      }
      for (const p of sys.planets) {
        let mIdx = p.moons.findIndex((m) => m.id === id);
        if (mIdx !== -1) {
          p.moons.splice(mIdx, 1);
          return true;
        }
        for (const m of p.moons) {
          const eIdx = m.entries.findIndex((e) => e.id === id);
          if (eIdx !== -1) {
            m.entries.splice(eIdx, 1);
            return true;
          }
        }
      }
    }
    return false;
  }

  /* ==========================================================
     TIMELINE (snapshots)
  ========================================================== */
  let timelineSlider, timelineLabel, playBtn, pauseBtn;
  let playing = false;
  let playInterval = null;

  function initTimeline() {
    timelineSlider = document.getElementById("timeline-slider");
    timelineLabel = document.getElementById("timeline-label");
    playBtn = document.getElementById("timeline-play");
    pauseBtn = document.getElementById("timeline-pause");

    playBtn.addEventListener("click", startPlayback);
    pauseBtn.addEventListener("click", pausePlayback);

    timelineSlider.addEventListener("input", () => {
      const idx = Number(timelineSlider.value);
      restoreSnapshot(idx);
    });

    snapshot("initial");
  }

  function snapshot(reason = "update") {
    const clone = JSON.parse(JSON.stringify(COSMOS.systems));
    COSMOS.timeline.push({ time: Date.now(), systems: clone, reason });
    timelineSlider.max = COSMOS.timeline.length - 1;
    timelineSlider.value = timelineSlider.max;
    updateTimelineLabel();
  }

  function restoreSnapshot(index) {
    const snap = COSMOS.timeline[index];
    if (!snap) return;
    COSMOS.systems = JSON.parse(JSON.stringify(snap.systems));
    updateTimelineLabel();
    Bus.emit("state-updated");
    saveState();
  }

  function updateTimelineLabel() {
    const idx = Number(timelineSlider.value);
    const snap = COSMOS.timeline[idx];
    if (!snap) {
      timelineLabel.textContent = "Now";
      return;
    }
    const d = new Date(snap.time);
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    timelineLabel.textContent =
      idx === Number(timelineSlider.max) ? "Now" : `${hh}:${mm}`;
  }

  function startPlayback() {
    if (playing) return;
    playing = true;
    playInterval = setInterval(() => {
      const idx = Number(timelineSlider.value);
      if (idx < Number(timelineSlider.max)) {
        timelineSlider.value = idx + 1;
        restoreSnapshot(idx + 1);
      } else {
        pausePlayback();
      }
    }, 600);
  }

  function pausePlayback() {
    playing = false;
    if (playInterval) clearInterval(playInterval);
    playInterval = null;
  }

  Bus.on("state-updated", () => snapshot("state-change"));

  /* ==========================================================
     MAP ENGINE (main canvas)
  ========================================================== */
  let mapCanvas, mapCtx;
  let dragging = false;
  const dragStart = { x: 0, y: 0 };

  function initMap() {
    mapCanvas = document.getElementById("cosmos-map");
    mapCtx = mapCanvas.getContext("2d");
    resizeMap();
    window.addEventListener("resize", resizeMap);

    mapCanvas.addEventListener("mousedown", (e) => {
      dragging = true;
      dragStart.x = e.clientX;
      dragStart.y = e.clientY;
    });

    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      COSMOS.camera.x += (e.clientX - dragStart.x) / COSMOS.camera.zoom;
      COSMOS.camera.y += (e.clientY - dragStart.y) / COSMOS.camera.zoom;
      dragStart.x = e.clientX;
      dragStart.y = e.clientY;
    });

    window.addEventListener("mouseup", () => {
      dragging = false;
    });

    mapCanvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      COSMOS.camera.zoom *= e.deltaY < 0 ? 1.1 : 0.9;
      COSMOS.camera.zoom = Math.max(0.25, Math.min(4, COSMOS.camera.zoom));
    });

    mapCanvas.addEventListener("click", handleMapClick);
  }

  function resizeMap() {
    mapCanvas.width = mapCanvas.clientWidth;
    mapCanvas.height = mapCanvas.clientHeight;
  }

  function worldToScreen(x, y) {
    return {
      x: (x - COSMOS.camera.x) * COSMOS.camera.zoom + mapCanvas.width / 2,
      y: (y - COSMOS.camera.y) * COSMOS.camera.zoom + mapCanvas.height / 2,
    };
  }

  function screenToWorld(x, y) {
    return {
      x: (x - mapCanvas.width / 2) / COSMOS.camera.zoom + COSMOS.camera.x,
      y: (y - mapCanvas.height / 2) / COSMOS.camera.zoom + COSMOS.camera.y,
    };
  }

  function hit(obj, x, y) {
    const dx = x - obj.x;
    const dy = y - obj.y;
    return Math.sqrt(dx * dx + dy * dy) < obj.radius + 6;
  }

  function handleMapClick(e) {
    const rect = mapCanvas.getBoundingClientRect();
    const { x, y } = screenToWorld(
      e.clientX - rect.left,
      e.clientY - rect.top
    );

    for (const sys of COSMOS.systems) {
      if (hit(sys, x, y)) {
        COSMOS.selection.system = sys.id;
        COSMOS.selection.planet = null;
        COSMOS.selection.moon = null;
        Bus.emit("state-updated");
        return;
      }
      for (const p of sys.planets) {
        if (hit(p, x, y)) {
          COSMOS.selection.system = sys.id;
          COSMOS.selection.planet = p.id;
          COSMOS.selection.moon = null;
          Bus.emit("state-updated");
          return;
        }
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

  function drawMap() {
    mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);

    mapCtx.fillStyle = getComputedStyle(document.body).getPropertyValue(
      "--map-bg"
    );
    mapCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);

    drawSystemLinks();

    for (const sys of COSMOS.systems) {
      updateSystemPosition(sys);
      drawSystem(sys);
      for (const p of sys.planets) {
        updatePlanetPosition(sys, p);
        drawPlanet(sys, p);
        for (const m of p.moons) {
          updateMoonPosition(p, m);
          drawMoon(p, m);
        }
      }
    }
  }

  function startRenderLoop() {
    function frame() {
      drawMap();
      drawMiniMap();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function updateSystemPosition(sys) {
    if (!sys.orbitBand) {
      sys.orbitBand = 200 + Math.random() * 120 + sys.energy * 18;
      sys.orbitAngle = randomAngle();
    }
    sys.orbitAngle += 0.0002;
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

  function drawSystemLinks() {
    const showLinks =
      document.getElementById("toggle-links")?.checked ?? true;
    if (!showLinks) return;
    const stroke = getComputedStyle(document.body).getPropertyValue(
      "--link-stroke"
    );
    mapCtx.strokeStyle = stroke;
    mapCtx.lineWidth = 1.8;

    for (const sys of COSMOS.systems) {
      const start = worldToScreen(sys.x, sys.y);
      for (const ancestor of sys.lineage) {
        const parent = COSMOS.systems.find((s) => s.id === ancestor);
        if (!parent) continue;
        const end = worldToScreen(parent.x, parent.y);
        mapCtx.beginPath();
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2 - 60;
        mapCtx.moveTo(start.x, start.y);
        mapCtx.quadraticCurveTo(midX, midY, end.x, end.y);
        mapCtx.stroke();
      }
    }
  }

  function drawSystem(sys) {
    const pos = worldToScreen(sys.x, sys.y);
    const glow = getComputedStyle(document.body).getPropertyValue(
      "--sun-color"
    );
    mapCtx.beginPath();
    mapCtx.fillStyle = glow;
    mapCtx.shadowBlur = 22;
    mapCtx.shadowColor = glow;
    mapCtx.arc(pos.x, pos.y, sys.radius, 0, Math.PI * 2);
    mapCtx.fill();
    mapCtx.shadowBlur = 0;

    mapCtx.fillStyle = getComputedStyle(document.body).getPropertyValue(
      "--text"
    );
    mapCtx.font = "13px system-ui";
    mapCtx.textAlign = "center";
    mapCtx.fillText(sys.title, pos.x, pos.y - sys.radius - 8);
  }

  function drawPlanet(sys, p) {
    const showOrbits =
      document.getElementById("toggle-orbits")?.checked ?? true;
    const posSys = worldToScreen(sys.x, sys.y);
    const pos = worldToScreen(p.x, p.y);

    if (showOrbits) {
      mapCtx.strokeStyle =
        getComputedStyle(document.body).getPropertyValue("--orbit-stroke");
      mapCtx.lineWidth = 1;
      mapCtx.beginPath();
      mapCtx.arc(
        posSys.x,
        posSys.y,
        p.orbitRadius * COSMOS.camera.zoom,
        0,
        Math.PI * 2
      );
      mapCtx.stroke();
    }

    const glow = getComputedStyle(document.body).getPropertyValue(
      "--planet-color"
    );
    mapCtx.beginPath();
    mapCtx.fillStyle = glow;
    mapCtx.shadowBlur = 14;
    mapCtx.shadowColor = glow;
    mapCtx.arc(pos.x, pos.y, p.radius, 0, Math.PI * 2);
    mapCtx.fill();
    mapCtx.shadowBlur = 0;

    mapCtx.fillStyle = getComputedStyle(document.body).getPropertyValue(
      "--text"
    );
    mapCtx.font = "12px system-ui";
    mapCtx.textAlign = "center";
    mapCtx.fillText(p.title, pos.x, pos.y - p.radius - 6);
  }

  function drawMoon(p, m) {
    const showOrbits =
      document.getElementById("toggle-orbits")?.checked ?? true;
    const posPlanet = worldToScreen(p.x, p.y);
    const pos = worldToScreen(m.x, m.y);

    if (showOrbits) {
      mapCtx.strokeStyle =
        getComputedStyle(document.body).getPropertyValue("--orbit-stroke");
      mapCtx.lineWidth = 1;
      mapCtx.beginPath();
      mapCtx.arc(
        posPlanet.x,
        posPlanet.y,
        m.orbitRadius * COSMOS.camera.zoom,
        0,
        Math.PI * 2
      );
      mapCtx.stroke();
    }

    const glow = getComputedStyle(document.body).getPropertyValue(
      "--moon-color"
    );
    mapCtx.beginPath();
    mapCtx.fillStyle = glow;
    mapCtx.shadowBlur = 12;
    mapCtx.shadowColor = glow;
    mapCtx.arc(pos.x, pos.y, m.radius, 0, Math.PI * 2);
    mapCtx.fill();
    mapCtx.shadowBlur = 0;

    mapCtx.fillStyle = getComputedStyle(document.body).getPropertyValue(
      "--text"
    );
    mapCtx.font = "11px system-ui";
    mapCtx.textAlign = "center";
    mapCtx.fillText(m.title, pos.x, pos.y - m.radius - 4);
  }

  /* ==========================================================
     MINI-MAP (Weaver-Drive)
  ========================================================== */
  let miniCanvas, miniCtx;

  function initWeaverDrive() {
    miniCanvas = document.getElementById("cosmos-mini-map");
    miniCtx = miniCanvas.getContext("2d");
    resizeMini();
    window.addEventListener("resize", resizeMini);
  }

  function resizeMini() {
    miniCanvas.width = miniCanvas.clientWidth;
    miniCanvas.height = miniCanvas.clientHeight;
  }

  function drawMiniMap() {
    if (!miniCtx) return;
    const showMini =
      document.getElementById("toggle-minimap")?.checked ?? true;
    if (!showMini) {
      miniCtx.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
      return;
    }

    miniCtx.fillStyle = getComputedStyle(document.body).getPropertyValue(
      "--bg-panel"
    );
    miniCtx.fillRect(0, 0, miniCanvas.width, miniCanvas.height);

    const cx = miniCanvas.width / 2;
    const cy = miniCanvas.height / 2;
    const SCALE = 0.15;

    for (const sys of COSMOS.systems) {
      const sx = cx + sys.x * SCALE;
      const sy = cy + sys.y * SCALE;
      miniCtx.beginPath();
      miniCtx.fillStyle = getComputedStyle(document.body).getPropertyValue(
        "--sun-color"
      );
      miniCtx.arc(sx, sy, 3, 0, Math.PI * 2);
      miniCtx.fill();

      if (COSMOS.selection.system === sys.id) {
        miniCtx.strokeStyle = "#fff";
        miniCtx.lineWidth = 1;
        miniCtx.beginPath();
        miniCtx.arc(sx, sy, 6, 0, Math.PI * 2);
        miniCtx.stroke();
      }

      for (const p of sys.planets) {
        const px = cx + p.x * SCALE;
        const py = cy + p.y * SCALE;
        miniCtx.beginPath();
        miniCtx.fillStyle = getComputedStyle(document.body).getPropertyValue(
          "--planet-color"
        );
        miniCtx.arc(px, py, 2, 0, Math.PI * 2);
        miniCtx.fill();

        if (COSMOS.selection.planet === p.id) {
          miniCtx.strokeStyle = "#fff";
          miniCtx.beginPath();
          miniCtx.arc(px, py, 4, 0, Math.PI * 2);
          miniCtx.stroke();
        }

        for (const m of p.moons) {
          const mx = cx + m.x * SCALE;
          const my = cy + m.y * SCALE;
          miniCtx.beginPath();
          miniCtx.fillStyle = getComputedStyle(document.body).getPropertyValue(
            "--moon-color"
          );
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
  }

  /* ==========================================================
     UI BINDING
  ========================================================== */
  function populateSystemDropdown() {
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

  function populatePlanetDropdown() {
    const sel = document.getElementById("select-planet");
    const active = COSMOS.selection.planet;
    sel.innerHTML = `<option value="">— None —</option>`;
    const sys = COSMOS.systems.find((s) => s.id === COSMOS.selection.system);
    if (!sys) return;
    for (const p of sys.planets) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.title;
      if (p.id === active) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  function populateMoonDropdown() {
    const sel = document.getElementById("select-moon");
    const active = COSMOS.selection.moon;
    sel.innerHTML = `<option value="">— None —</option>`;
    const sys = COSMOS.systems.find((s) => s.id === COSMOS.selection.system);
    const pla = sys?.planets.find((p) => p.id === COSMOS.selection.planet);
    if (!pla) return;
    for (const m of pla.moons) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.title;
      if (m.id === active) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  function updateBreadcrumbs() {
    const sysEl = document.getElementById("crumb-system");
    const plaEl = document.getElementById("crumb-planet");
    const monEl = document.getElementById("crumb-moon");

    const sys = COSMOS.systems.find((s) => s.id === COSMOS.selection.system);
    const pla = sys?.planets.find((p) => p.id === COSMOS.selection.planet);
    const mon = pla?.moons.find((m) => m.id === COSMOS.selection.moon);

    sysEl.textContent = sys ? sys.title : "No system";
    plaEl.textContent = pla ? pla.title : "—";
    monEl.textContent = mon ? mon.title : "—";
  }

  function updateRightPanel() {
    const typeEl = document.getElementById("selection-type");
    const titleEl = document.getElementById("selection-title");
    const pathEl = document.getElementById("selection-path");
    const countEl = document.getElementById("selection-entry-count");
    const updateEl = document.getElementById("selection-last-update");
    const logEl = document.getElementById("entry-log");

    const sys = COSMOS.systems.find((s) => s.id === COSMOS.selection.system);
    const pla = sys?.planets.find((p) => p.id === COSMOS.selection.planet);
    const mon = pla?.moons.find((m) => m.id === COSMOS.selection.moon);

    logEl.innerHTML = "";

    if (!sys) {
      typeEl.textContent = "Nothing selected";
      titleEl.textContent = "—";
      pathEl.textContent = "—";
      countEl.textContent = "0";
      updateEl.textContent = "—";
      return;
    }

    if (!pla) {
      typeEl.textContent = "System";
      titleEl.textContent = sys.title;
      pathEl.textContent = sys.title;
      countEl.textContent = sys.planets.length + " planets";
      updateEl.textContent = formatTime(sys.updated);
      return;
    }

    if (!mon) {
      typeEl.textContent = "Planet";
      titleEl.textContent = pla.title;
      pathEl.textContent = `${sys.title} / ${pla.title}`;
      countEl.textContent = pla.moons.length + " moons";
      updateEl.textContent = formatTime(pla.updated);
      return;
    }

    typeEl.textContent = "Moon";
    titleEl.textContent = mon.title;
    pathEl.textContent = `${sys.title} / ${pla.title} / ${mon.title}`;
    countEl.textContent = mon.entries.length + " entries";
    updateEl.textContent = formatTime(mon.updated);

    mon.entries
      .slice()
      .sort((a, b) => a.created - b.created)
      .forEach((entry) => {
        const d = document.createElement("div");
        d.className = "log-entry";
        d.innerHTML = `
          <div class="log-text">${entry.text || "(empty entry)"}</div>
          <div class="log-meta">${formatTime(entry.created)}</div>
        `;
        logEl.appendChild(d);
      });
  }

  function initDropdowns() {
    const sysSel = document.getElementById("select-system");
    const plaSel = document.getElementById("select-planet");
    const monSel = document.getElementById("select-moon");

    sysSel.addEventListener("change", () => {
      COSMOS.selection.system = sysSel.value || null;
      COSMOS.selection.planet = null;
      COSMOS.selection.moon = null;
      refreshUI();
    });

    plaSel.addEventListener("change", () => {
      COSMOS.selection.planet = plaSel.value || null;
      COSMOS.selection.moon = null;
      refreshUI();
    });

    monSel.addEventListener("change", () => {
      COSMOS.selection.moon = monSel.value || null;
      refreshUI();
    });

    Bus.on("state-updated", refreshUI);
    refreshUI();
  }

  function refreshUI() {
    populateSystemDropdown();
    populatePlanetDropdown();
    populateMoonDropdown();
    updateBreadcrumbs();
    updateRightPanel();
  }

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
      saveState();
    });
  }

  function initHelpPopover() {
    const pop = document.getElementById("help-popover");
    const content = document.getElementById("help-content");
    const triggers = document.querySelectorAll(".inline-help");
    const HELP_TEXT = {
      system:
        "<strong>Systems</strong> are star-level structures (Suns). Use Generate mode to create new systems. Each system can hold planets, moons, and entries.",
      node:
        "<strong>Add New</strong> creates a planet, moon, or entry depending on lineage. In Generate mode: new connected system. In Evolve: planets → moons → entries.",
    };
    triggers.forEach((btn) => {
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

  function initModeToggle() {
    const gen = document.getElementById("mode-generate");
    const evo = document.getElementById("mode-evolve");

    function setMode(mode) {
      COSMOS.mode = mode;
      gen.classList.toggle("active", mode === "generate");
      evo.classList.toggle("active", mode === "evolve");
      saveState();
    }

    gen.addEventListener("click", () => setMode("generate"));
    evo.addEventListener("click", () => setMode("evolve"));

    setMode(COSMOS.mode);
  }

  function initCreateSystem() {
    const btn = document.getElementById("create-system");
    const name = document.getElementById("system-name-input");
    const lens = document.getElementById("system-lens");
    btn.addEventListener("click", () => {
      if (!name.value.trim()) return;
      const sys = createSystem({
        title: name.value.trim(),
        description: lens.value.trim(),
        energy: 0,
      });
      COSMOS.systems.push(sys);
      name.value = "";
      lens.value = "";
      Bus.emit("state-updated");
      saveState();
    });
  }

  function initCreateNode() {
    const btn = document.getElementById("create-node");
    const title = document.getElementById("node-title-input");
    const lens = document.getElementById("node-lens");
    const tone = document.getElementById("tone-select");
    const slider = document.getElementById("energy-slider");

    btn.addEventListener("click", () => {
      if (!title.value.trim()) return;
      createNode({
        title: title.value.trim(),
        text: lens.value.trim(),
        tone: tone.value,
        energy: Number(slider.value),
      });
      title.value = "";
      lens.value = "";
      Bus.emit("state-updated");
      saveState();
    });
  }

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
      "5": "Very far orbit",
    };
    slider.addEventListener("input", () => {
      readout.textContent = labels[String(slider.value)];
    });
    readout.textContent = labels["0"];
  }

  function initFocusAndPromote() {
    document
      .getElementById("focus-on-selection")
      .addEventListener("click", () => {
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

    document
      .getElementById("promote-to-system")
      .addEventListener("click", () => {
        const { planet, moon } = COSMOS.selection;
        const target = planet || moon;
        if (!target) return;
        const newSys = promoteToSystem(target);
        if (!newSys) return;
        COSMOS.selection.system = newSys.id;
        COSMOS.selection.planet = null;
        COSMOS.selection.moon = null;
        Bus.emit("state-updated");
        saveState();
      });
  }

  /* ==========================================================
     BOOTSTRAP
  ========================================================== */
  document.addEventListener("DOMContentLoaded", () => {
    loadState();
    initThemeToggle();
    initHelpPopover();
    initModeToggle();
    initDropdowns();
    initCreateSystem();
    initCreateNode();
    initEnergySlider();
    initFocusAndPromote();
    initMap();
    initWeaverDrive();
    initTimeline();
    startRenderLoop();
    refreshUI();
    console.log("CosmOS bundled engine ready");
  });
})();
