# VOID RUNNER — Speed Is Your Weapon

This prototype is a playable 3D action game built with Vite and Three.js. The silver-haired Void Runner's movement speed determines collision damage. The world streams deterministic terrain chunks along an endless highway, with procedural hills, ruins, red-leaf trees, a distant rift, and enemy encounters generated ahead of the player.

## Install and run

From the project root:

```bash
npm install
npm run dev
```

Then open the local URL Vite prints in the terminal, usually http://localhost:5173.

The game opens on its animated front-end. Continue resumes the latest unlocked
level; Start Game asks before replacing an existing campaign. Progress, equipped
weapon, and settings are stored locally in the browser.

## Controls

- W / A / S / D or arrow keys: move
- Space: jump
- Left Shift: sprint
- Ctrl: slide
- E: Phantom Dash (42 m/s burst; movement and one-hit-per-target dash attack)
- Q: Reaver Strike
- F: Void Slash
- Hold and release R: Impact Discharge (charge to at least 32% for a speed-scaled shockwave)
- T: Overdrive (build charge by sprinting)
- G: Shadow Clone (replays the recent movement path; 10-second cooldown)
- V: Void Chain (tethers to a clear, forward target within 24 units; 4.2-second cooldown)
- X: Kinetic Anchor (attach to a valid nearby wall, surface, or enemy; steer while tethered, press X again to detach)
- Z: Ninja Execution (finishes a nearby, low-health standard enemy; bosses are immune)
- C / Home or CAM RESET: recenter the third-person camera
- Armory: select and equip weapons unlocked by reaching campaign levels 1, 5, 10, 15, 25, and 40
- Orbital Drones: press Q to fire a manual energy shot (costs 10 energy)
- During gameplay, press 1–6 to switch to an unlocked weapon (in armory order); locked weapons report their unlock level.
- Esc: pause
- Mouse: orbit the camera; the camera anticipates velocity, widens FOV at speed, banks through turns, and avoids nearby terrain and walls
- Touchscreen: left movement stick, swipe to look, movement buttons, and Q/F/R/T/G/V/X/Z combat buttons
- Reduce Flash / Shake: toggle in the VOID REAVER panel

## Gameplay loop

- Build speed by sprinting and chaining movement.
- Movement now accelerates smoothly to 19 m/s running and 30 m/s sprinting; Phantom Dash peaks at 42 m/s. The HUD reports live m/s and marks sprint/max speed.
- Sprinting and top speed produce pooled cyan/violet boot particles, footprints, directional streaks, a flowing energy ribbon, brighter weapon glow, and limited character afterimages. Heavy landings create a velocity-scaled ripple.
- Jump and dash to maintain momentum through combat.
- Hit robots while moving to trigger kinetic damage.
- Start each run with 100 HP. Enemy attacks deal damage with a short invulnerability window; each unique defeated enemy restores up to 30 HP, capped at 100.
- Directly attack with the hand-mounted, procedural VOID REAVER. Strike and slash attacks have independent cooldowns and range-checked enemy hit detection.
- Void Chain requires line of sight and pulls the runner forward without teleporting; Ninja Execution is available only against a standard enemy below 28% health.
- Successful hits build a timed combo and score multiplier. Enemies sometimes drop proximity-collectible health, energy, or score-multiplier orbs.
- Hold and release R to trigger Impact Discharge after at least 32% charge; charge and current speed scale the blast, which costs energy and has a cooldown. Colossi resist it.
- Kinetic damage scales with real movement speed. Side/rear and truly elevated attacks earn tactical damage bonuses; heavy impacts stagger, launch, and knock back enemies.
- Kinetic Anchor uses 12 energy, has a 5.5-second cooldown, and preserves momentum while steering around a tether point. Cyan vector pads accelerate runners; high-speed enemy knockbacks can break marked pillars.
- Sprint to fill the Overdrive meter, then press T for a temporary acceleration, speed, camera-FOV, and damage bonus.
- Enemies show hit flashes, knockback/stun, health updates, and floating damage numbers on confirmed hits.
- The campaign contains exactly 1,000 generated levels. Level 1 starts a new save; completed levels unlock the next level and campaign progress/statistics persist in browser local storage.
- Levels use multiple portal-spawned encounter waves; Master levels reserve the boss for a later wave. A level gates completion on all required kills. The results screen reports rank, score, time, damage, and reward.
- The paginated Level Select displays 50 levels at a time and does not allow locked levels to launch. Portals animate enemy arrivals, and the level-complete screen offers Continue and Replay. Continuing carries health, energy, and score forward.
- Every fifth level (200 total) is a Master Level with a larger Colossus, escorts, telegraphed attacks, and vulnerable recovery windows. Level 1000 is the final Void Sovereign encounter.
- Scouts, Guardians, ranged Artillerists, and Elite Reavers are mixed into later encounters; difficulty increases with capped scaling and broader enemy combinations.
- The campaign HUD shows the current level, objective, remaining hostiles, completion progress, and highest unlocked level.
- The front-end includes Start/Continue, Level Select, Weapon Armory, Settings, and How to Play. Six procedural weapons have different damage, reach, cooldowns, and attack behavior; progress unlocks additional weapons.
- The front-end starts with only the main menu visible. Level Select is paginated in groups of 50 and can jump directly to any numbered level; locked levels remain unavailable.
- The procedural ninja loading screen is used for campaign launches, continues, level transitions, retries, and replays. Loading progress reports the two initialization stages, and failures expose Retry and Return to Menu actions.
- Settings for master/SFX volume, mouse sensitivity, camera follow/shake, screen flash, motion effects, reduced effects, graphics quality, and fullscreen persist locally.
- Use the HUD to track health, speed, energy, and combo.
- The local radar marks nearby hostiles and the distant rift.

## Project structure

- `index.html` — app shell and HUD markup
- `src/main.js` — game bootstrapping and update loop
- `src/Game.js` — project-level orchestration (not required in this simplified build, but kept modular for expansion)
- `src/Player.js` — player state and mesh
- `src/MovementSystem.js` — motion, sprint, jump, slide, dash, and wall-run logic
- `src/Enemy.js` — enemy behavior and damage state
- `src/CombatSystem.js` — speed impacts, Reaver attacks, chain/execution abilities, charge, dash hit detection, Overdrive, combo scoring, and defeat rewards
- `src/AudioManager.js` — synthesized combat and charge audio
- `src/World.js` — arena, lights, floating ruins, and portal
- `src/WorldChunkManager.js` — seeded terrain streaming, collision surfaces, anchor points, vector pads, breakable pillars, and floating-origin rebasing
- `src/Effects.js` — particles, trails, and shockwaves
- `src/CameraController.js` — follow camera and motion-based camera behavior
- `src/ProgressionManager.js` — deterministic 1,000-level campaign definitions and persistent unlock/completion saves
- `src/WeaponManager.js` — progression-gated weapon unlocks, equip behavior, and save state
- `src/SettingsManager.js` — validated, persistent accessibility and graphics settings
- `src/HUD.js` — dynamic HUD updates and menus
- `src/style.css` — cyberpunk interface styling

## Notes

- The project uses procedural geometry so it runs without external model downloads.
- The terrain manager keeps a 5 × 5 neighborhood of chunks loaded, then disposes chunks that fall outside that window.
- The build is intentionally modular and easy to extend with new abilities, enemies, or art.
