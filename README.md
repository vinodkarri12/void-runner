# VOID RUNNER — Speed Is Your Weapon

VOID RUNNER is a playable 3D action game built with Vite and Three.js. The runner's movement speed determines collision damage. The world streams deterministic industrial sci-fi terrain and structures along an endless route, with a procedural armored runner, mechanical hunter enemies, and encounters generated ahead of the player. Its visuals use locally generated Three.js geometry and materials; no external model or texture downloads are required.

## Install and run

From the project root:

```bash
npm install
npm run dev
```

Then open the local URL Vite prints in the terminal, usually http://localhost:5173.
In VS Code, leave the dev server running and press F5 to open the game in Chrome.

The game opens on its animated front-end. Continue resumes the latest safe
checkpoint; New Game asks before replacing an existing campaign. Campaign
progress, equipped weapon, and settings are stored locally in the browser.

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
- Armory: select and equip weapons unlocked at campaign levels 1, 4, 7, 10, 12, and 14
- Orbital Drones: press Q to fire a manual energy shot (costs 10 energy)
- During gameplay, press 1–6 to switch to an unlocked weapon (in armory order); locked weapons report their unlock level.
- Esc: pause
- Mouse: orbit the camera; the camera anticipates velocity, widens FOV at speed, banks through turns, and avoids nearby terrain and walls
- Touchscreen: left movement stick or hold the on-screen LEFT/RIGHT buttons to steer; swipe to look, and use the movement and Q/F/R/T/G/V/X/Z combat buttons
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
- The campaign has 15 progressive levels. Levels 1–14 field 2–14 hostiles in controlled portal-spawned groups; Level 15 culminates in the VOID OVERLORD battle with a fixed 150 HP boss.
- Scouts, Guardians, ranged Artillerists, and Elite Reavers appear as difficulty rises. Enemy health, movement speed, attack damage, and attack cadence scale with campaign level.
- The boss uses three telegraphed attack patterns and becomes more aggressive as its health falls. Its health is shown numerically, and the game only completes after the boss is defeated.
- Level Select contains the 15 campaign levels and does not allow locked levels to launch. Completing objectives unlocks the next level; the final boss must be defeated to finish the campaign.
- Versioned localStorage saves retain the unlocked/current level, score, health, energy, defeated count, and latest safe wave checkpoint. Saves occur at level starts, cleared-wave transitions, and level completion; hiding or closing the page retains the most recent checkpoint.
- Level transitions show the destination, difficulty, and hostile count. Levels 6–10 and 11–15 progressively darken the industrial atmosphere.
- The campaign HUD shows the current level, objective, remaining hostiles, completion progress, and highest unlocked level.
- The front-end includes New Game/Continue, Level Select, Weapon Armory, Settings, and How to Play. Six procedural weapons have different damage, reach, cooldowns, and attack behavior; progress unlocks additional weapons.
- The front-end starts with only the main menu visible. Level Select can jump directly to any unlocked level from 1 to 15; locked levels remain unavailable.
- The procedural ninja loading screen is used for campaign launches, continues, level transitions, retries, and replays. Loading progress reports the two initialization stages, and failures expose Retry and Return to Menu actions.
- Settings for master/SFX volume, mouse sensitivity, camera follow/shake, screen flash, motion effects, reduced effects, graphics quality, and fullscreen persist locally.
- Use the HUD to track health, speed, energy, and combo.
- The local radar marks nearby hostiles and the distant rift.

## Project structure

- `index.html` — app shell and HUD markup
- `src/main.js` — game bootstrapping and update loop
- `src/Game.js` — project-level orchestration (not required in this simplified build, but kept modular for expansion)
- `src/Player.js` — player state and armored character mesh
- `src/MovementSystem.js` — motion, sprint, jump, slide, dash, and wall-run logic
- `src/Enemy.js` — enemy behavior, damage state, and mechanical hunter mesh
- `src/CombatSystem.js` — speed impacts, Reaver attacks, chain/execution abilities, charge, dash hit detection, Overdrive, combo scoring, and defeat rewards
- `src/AudioManager.js` — synthesized combat and charge audio
- `src/World.js` — cinematic atmosphere, industrial skyline, lighting, and portal
- `src/WorldChunkManager.js` — industrial terrain streaming, collision surfaces, anchor points, vector pads, breakable pillars, and floating-origin rebasing
- `src/Effects.js` — particles, trails, and shockwaves
- `src/CameraController.js` — follow camera and motion-based camera behavior
- `src/ProgressionManager.js` — 15-level campaign definitions and versioned unlock/checkpoint saves
- `src/WeaponManager.js` — progression-gated weapon unlocks, equip behavior, and save state
- `src/SettingsManager.js` — validated, persistent accessibility and graphics settings
- `src/HUD.js` — dynamic HUD updates and menus
- `src/style.css` — cyberpunk interface styling

## Notes

- The project uses procedural geometry so it runs without external model downloads.
- The terrain manager keeps a 5 × 5 neighborhood of chunks loaded, then disposes chunks that fall outside that window.
- The build is intentionally modular and easy to extend with new abilities, enemies, or art.
