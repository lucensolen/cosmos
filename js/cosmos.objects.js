/* ============================================================
   COSMOS OBJECTS
   Defines the universe objects + creation logic:
   - Systems (Suns)
   - Planets
   - Moons
   - Entries
   Handles Generate/Evolve behaviour.
============================================================ */

import { COSMOS, Bus } from "./cosmos.core.js";

/* ============================================================
   UTILITIES
============================================================ */

function uid() {
  return crypto.randomUUID();
}

function now() {
  return Date.now();
}

/* Produce a random angle in radians */
function randomAngle() {
  return Math.random() * Math.PI * 2;
}

/* ============================================================
   SYSTEM (SUN)
============================================================ */

export function createSystem({ title, description, energy = 0 }) {
  const sys = {
    id: uid(),
    type: "system",
    title,
    description,
    created: now(),
    updated: now(),
    energy,

    planets: [],
    lineage: [],            // systems that spawned this system (optional curved link)
    x: 0,                   // map coordinates (set by map engine)
    y: 0,
    radius: 40,             // visual size
    orbitBand: 0            // computed by map engine
  };

  return sys;
}

/* ============================================================
   PLANET
============================================================ */

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
    orbitRadius: 0,     // distance from system centre
    orbitAngle: randomAngle()
  };
}

/* ============================================================
   MOON
============================================================ */

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
    orbitRadius: 0,     // distance from planet
    orbitAngle: randomAngle()
  };
}

/* ============================================================
   ENTRY (inside moons or planets)
============================================================ */

function createEntry({ text, tone }) {
  return {
    id: uid(),
    type: "entry",
    text,
    tone,
    created: now()
  };
}

/* ============================================================
   NODE CREATION LOGIC
   (Generate = new System, Evolve = Planet/Moon/Entry)
============================================================ */

export function createNode(COSMOS, payload) {
  const { title, text, tone, energy } = payload;

  const sel = COSMOS.selection;
  const currentSys = COSMOS.systems.find(s => s.id === sel.system);
  const currentPlan = currentSys?.planets.find(p => p.id === sel.planet);
  const currentMoon = currentPlan?.moons.find(m => m.id === sel.moon);

  /* ---------------------------------------------------------
     MODE: GENERATE
     Creates a new System linked to the selected System.
  --------------------------------------------------------- */
  if (COSMOS.mode === "generate") {
    if (!currentSys) {
      // If nothing selected, just create a standalone system.
      const newSys = createSystem({ title, description: text, energy });
      COSMOS.systems.push(newSys);
      return newSys;
    }

    // Otherwise: create new system with lineage link
    const newSys = createSystem({ title, description: text, energy });
    newSys.lineage.push(currentSys.id);
    COSMOS.systems.push(newSys);
    return newSys;
  }

  /* ---------------------------------------------------------
     MODE: EVOLVE
     Creates:
     - Planet inside a System
     - Moon inside a Planet
     - Entry inside a Moon
  --------------------------------------------------------- */

  // Evolve inside a System → create Planet
  if (currentSys && !currentPlan) {
    const planet = createPlanet({ title, text, tone, energy });
    currentSys.planets.push(planet);
    currentSys.updated = now();
    return planet;
  }

  // Evolve inside a Planet → create Moon
  if (currentPlan && !currentMoon) {
    const moon = createMoon({ title, text, tone, energy });
    currentPlan.moons.push(moon);
    currentPlan.updated = now();
    return moon;
  }

  // Evolve inside a Moon → create Entry
  if (currentMoon) {
    const entry = createEntry({ text, tone });
    currentMoon.entries.push(entry);
    currentMoon.updated = now();
    return entry;
  }
}

/* ============================================================
   PROMOTION LOGIC
   (Planet → System, Moon → System)
============================================================ */

export function promoteToSystem(COSMOS, id) {
  // Try planet first
  for (const sys of COSMOS.systems) {
    const idx = sys.planets.findIndex(p => p.id === id);
    if (idx !== -1) {
      const planet = sys.planets.splice(idx, 1)[0];

      const newSys = createSystem({
        title: planet.title,
        description: planet.text,
        energy: planet.energy
      });

      newSys.lineage.push(sys.id);
      COSMOS.systems.push(newSys);

      return newSys;
    }
  }

  // Try moons
  for (const sys of COSMOS.systems) {
    for (const planet of sys.planets) {
      const idx = planet.moons.findIndex(m => m.id === id);
      if (idx !== -1) {
        const moon = planet.moons.splice(idx, 1)[0];

        const newSys = createSystem({
          title: moon.title,
          description: moon.text,
          energy: moon.energy
        });

        newSys.lineage.push(planet.id, sys.id);
        COSMOS.systems.push(newSys);

        return newSys;
      }
    }
  }

  return null;
}

/* ============================================================
   DELETE LOGIC (systems, planets, moons, entries)
============================================================ */

export function deleteObject(COSMOS, id) {
  // Delete system
  const sIdx = COSMOS.systems.findIndex(s => s.id === id);
  if (sIdx !== -1) {
    COSMOS.systems.splice(sIdx, 1);
    return true;
  }

  // Delete planet
  for (const sys of COSMOS.systems) {
    const pIdx = sys.planets.findIndex(p => p.id === id);
    if (pIdx !== -1) {
      sys.planets.splice(pIdx, 1);
      return true;
    }

    // Delete moon
    for (const planet of sys.planets) {
      const mIdx = planet.moons.findIndex(m => m.id === id);
      if (mIdx !== -1) {
        planet.moons.splice(mIdx, 1);
        return true;
      }

      // Delete entry
      for (const moon of planet.moons) {
        const eIdx = moon.entries.findIndex(e => e.id === id);
        if (eIdx !== -1) {
          moon.entries.splice(eIdx, 1);
          return true;
        }
      }
    }
  }

  return false;
}
