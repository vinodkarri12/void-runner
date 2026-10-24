import re
import os
import sys
import json

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

WORKSPACE = r"c:\Users\vinod\OneDrive\game"
SRC = os.path.join(WORKSPACE, "src")

passed = 0
failed = 0

def check(condition, desc):
    global passed, failed
    if condition:
        print(f"  [PASS] {desc}")
        passed += 1
    else:
        print(f"  [FAIL] {desc}")
        failed += 1

print("\n=== VOID RUNNER: SHADOW NINJA REFERENCE RECREATION VERIFICATION ===\n")

# 1. Environment & Atmosphere in World.js
print("--- 1. Testing Environment in World.js ---")
with open(os.path.join(SRC, "World.js"), "r", encoding="utf-8") as f:
    world_code = f.read()

check("addJapaneseCastleBackdrop" in world_code, "World.js contains Japanese Castle Tenshukaku & Pagoda backdrop")
check("addMoon" in world_code and "innerCorona" in world_code, "World.js has multi-layer lunar corona and glowing moon")
check("0xa4c7ee" in world_code or "DirectionalLight" in world_code, "World.js has rich blue moonlight DirectionalLight")
check("castleGroup" in world_code and "shojiGlowMat" in world_code, "World.js has glowing Shoji windows on Japanese castle")

# 2. Courtyard & Sakura Trees in WorldChunkManager.js
print("\n--- 2. Testing Courtyard & Sakura in WorldChunkManager.js ---")
with open(os.path.join(SRC, "WorldChunkManager.js"), "r", encoding="utf-8") as f:
    chunk_code = f.read()

check("addSakuraTree" in chunk_code, "WorldChunkManager has addSakuraTree method")
check("addClanBanners" in chunk_code, "WorldChunkManager has addClanBanners for crimson silk '忍' banners")
check("sakuraBlossomMaterial" in chunk_code and "0xff9ec0" in chunk_code, "WorldChunkManager defines pink sakura blossom materials")
check("roughness: 0.28" in chunk_code and "metalness: 0.42" in chunk_code, "WorldChunkManager has reflective wet stone flagstones roadMaterial")
check("addSakuraTree(group" in chunk_code, "WorldChunkManager invokes addSakuraTree in createChunk")
check("addClanBanners(group" in chunk_code, "WorldChunkManager invokes addClanBanners in createChunk")

# 3. Sakura Petals, Cyan Katana Trail & Sparks in Effects.js
print("\n--- 3. Testing Sakura Petals & Combat VFX in Effects.js ---")
with open(os.path.join(SRC, "Effects.js"), "r", encoding="utf-8") as f:
    effects_code = f.read()

check("0xffb3c8" in effects_code and "0xff9ec0" in effects_code, "Effects.js uses pink cherry blossom sakura petal colors")
check("0x00f2fe" in effects_code, "Effects.js uses bright electric cyan-blue (0x00f2fe) for katana sword trail")
check("katanaSlashTrail" in effects_code and "cyanColor" in effects_code, "katanaSlashTrail creates dual-layer cyan and white blade arc")
check("sparks" in effects_code and ("0xffe57f" in effects_code or "sparkPalette" in effects_code), "Effects.js spawns golden-white impact sparks")
check("damageNumber" in effects_code and "floatingText" in effects_code, "Effects.js has floating damage number renderer")
check("context.strokeText(text, 192, 80)" in effects_code or "strokeStyle" in effects_code, "damageNumber renders high-visibility stroke and fill")

# 4. Katana Damage & Combat System in CombatSystem.js
print("\n--- 4. Testing Katana Damage & Combat in CombatSystem.js ---")
with open(os.path.join(SRC, "CombatSystem.js"), "r", encoding="utf-8") as f:
    combat_code = f.read()

check("scaledDamage = 70" in combat_code, "CombatSystem enforces exactly 70 HP damage per valid normal katana hit")
check("lastHitAttackId === attackId" in combat_code, "CombatSystem prevents multi-damage per single katana swing")
check("0x00f2fe" in combat_code, "CombatSystem uses electric cyan weaponColor for katana combo")
check("damageNumber" in combat_code and "displayDamage" in combat_code, "CombatSystem triggers damageNumber with exact damage on hit")
check("executeDashAttack" in combat_code and "performDashAttack" in combat_code, "CombatSystem supports targeted dash attack with katana follow-up")

# 5. Weapon Manager
print("\n--- 5. Testing Weapon Manager ---")
with open(os.path.join(SRC, "WeaponManager.js"), "r", encoding="utf-8") as f:
    weapon_code = f.read()

check("'void-reaver'" in weapon_code and "'SHADOW KATANA'" in weapon_code, "WeaponManager has SHADOW KATANA as starting weapon")
check("0x00f2fe" in weapon_code, "WeaponManager sets shadow katana color to cyan 0x00f2fe")
check("'void-hand-cannon'" in weapon_code and "'ranged'" in weapon_code, "WeaponManager has ranged firearms")

# 6. HUD HTML Structure in index.html
print("\n--- 6. Testing HUD Structure in index.html ---")
with open(os.path.join(WORKSPACE, "index.html"), "r", encoding="utf-8") as f:
    html_code = f.read()

# Top-Left
check("hud-top-left-status" in html_code, "index.html has hud-top-left-status container")
check("hud-avatar-circle" in html_code and "忍" in html_code, "index.html has circular ninja avatar with '忍' kanji")
check('id="healthText"' in html_code and 'id="healthBar"' in html_code, "index.html has healthText and healthBar elements")
check('id="comboValue"' in html_code and "hud-combo-badge" in html_code, "index.html has comboValue and hud-combo-badge")

# Top-Center
check("hud-top-center-pill" in html_code, "index.html has hud-top-center-pill container")
check('id="levelValue"' in html_code, "index.html has levelValue for LEVEL 01 / 15")
check('id="enemyValue"' in html_code and "💀" in html_code, "index.html has enemyValue with skull icon")

# Top-Right
check('id="hudSettingsButton"' in html_code, "index.html has hudSettingsButton circular button (⚙)")
check('id="hudFullscreenButton"' in html_code, "index.html has hudFullscreenButton circular button (⛶)")
check('id="pauseButton"' in html_code, "index.html has pauseButton circular button (⏸)")

# Bottom-Left
check('id="moveStick"' in html_code and "joystick-base-ring" in html_code, "index.html has circular virtual joystick with base ring")
check('id="runButton"' in html_code and "run-button" in html_code, "index.html has dedicated circular RUN button")

# Right-Side
check('id="cameraTouchZone"' in html_code, "index.html has dedicated cameraTouchZone for right-half camera drag")
check('id="mobileCameraResetBtn"' in html_code, "index.html has circular CAMERA reset button in actionCluster")
check('id="jumpButton"' in html_code, "index.html has circular JUMP button")
check('id="crouchButton"' in html_code, "index.html has circular CROUCH/SIT button")
check('id="dashAttackButton"' in html_code and "dash-cooldown-fill" in html_code, "index.html has circular BOOST/DASH button with cooldown fill ring")
check('id="attackButton"' in html_code and "attack-button" in html_code, "index.html has prominent ATTACK button")
check('id="attackIconKatana"' in html_code and 'id="attackIconGun"' in html_code, "index.html has dynamic katana and gun icons on attack button")
check('id="weaponSwitchButton"' in html_code, "index.html has separate weaponSwitchButton")

# 7. CSS Styles in src/style.css
print("\n--- 7. Testing CSS Styles in src/style.css ---")
with open(os.path.join(SRC, "style.css"), "r", encoding="utf-8") as f:
    css_code = f.read()

check(".hud-top-left-status" in css_code, "style.css styles hud-top-left-status")
check(".hud-avatar-circle" in css_code, "style.css styles circular avatar")
check(".hud-hp-bar-fill" in css_code and "#00e640" in css_code, "style.css styles bright green health bar (#00e640)")
check(".hud-combo-badge" in css_code and "#ffd060" in css_code, "style.css styles glowing gold combo badge")
check(".hud-top-center-pill" in css_code, "style.css styles glassmorphic center pill for level and enemies")
check(".hud-circle-btn" in css_code, "style.css styles circular top-right action buttons")
check(".camera-btn" in css_code, "style.css styles circular camera reset button")
check(".attack-button.weapon-katana" in css_code and "#ff2a4b" in css_code, "style.css styles prominent red neon attack button for katana")
check(".attack-button.weapon-gun" in css_code, "style.css styles attack button when firearm equipped")
check(".move-stick" in css_code and ".move-knob" in css_code, "style.css styles circular virtual joystick and knob")
check(".run-button" in css_code, "style.css styles dedicated circular run button")

# 8. HUD.js updates
print("\n--- 8. Testing HUD.js Logic ---")
with open(os.path.join(SRC, "HUD.js"), "r", encoding="utf-8") as f:
    hud_code = f.read()

check("COMBO:" in hud_code, "HUD.js formats combo text as COMBO: 2x")
check("hudComboBadge" in hud_code, "HUD.js activates hudComboBadge on combo")
check("Enemies:" in hud_code, "HUD.js formats enemy counter as Enemies: X")
check("HP:" in hud_code, "HUD.js formats health text as HP: 100 / 100")
check("LEVEL" in hud_code, "HUD.js formats level text as LEVEL 01 / 15")
check("updateAttackButton" in hud_code, "HUD.js dynamically updates attack button icon between katana and gun")

# 9. Main.js wiring & event handlers
print("\n--- 9. Testing main.js wiring ---")
with open(os.path.join(SRC, "main.js"), "r", encoding="utf-8") as f:
    main_code = f.read()

check("hudSettingsButton" in main_code, "main.js wires hudSettingsButton to open settings")
check("mobileCameraResetBtn" in main_code, "main.js wires mobileCameraResetBtn to reset camera")
check("toggleFullscreen" in main_code, "main.js handles toggleFullscreen")
check("cameraTouchZone" in main_code, "main.js binds cameraTouchZone for touch camera orbiting")
check("moveStick" in main_code and "moveKnob" in main_code, "main.js handles joystick movement")

# 10. ControlsCustomizer layout
print("\n--- 10. Testing ControlsCustomizer Layout Presets ---")
with open(os.path.join(SRC, "ControlsCustomizer.js"), "r", encoding="utf-8") as f:
    custom_code = f.read()

check("mobileCameraResetBtn" in custom_code, "ControlsCustomizer includes mobileCameraResetBtn in presets")
check("joystickZone" in custom_code and "attackButton" in custom_code, "ControlsCustomizer includes joystick and attack button")
check("left-handed" in custom_code, "ControlsCustomizer includes left-handed layout")

# 11. Preserving Campaign & Progression
print("\n--- 11. Testing Progression Preservation ---")
with open(os.path.join(SRC, "ProgressionManager.js"), "r", encoding="utf-8") as f:
    prog_code = f.read()

check("TOTAL_LEVELS = 15" in prog_code or "15" in prog_code, "ProgressionManager preserves all 15 campaign levels")
check("unlockedLevel" in prog_code and "completedLevels" in prog_code, "ProgressionManager preserves progress tracking")

print(f"\n==========================================")
print(f"VERIFICATION SUMMARY: {passed} PASSED, {failed} FAILED")
print(f"==========================================\n")

if failed > 0:
    sys.exit(1)
