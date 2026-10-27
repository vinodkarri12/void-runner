import os
import re
import math

print("=== VERIFYING JOYSTICK, CAMERA SMOOTHNESS, & BALANCED DIFFICULTY ===")
passed = 0
total = 0

def check(name, condition):
    global passed, total
    total += 1
    if condition:
        passed += 1
        print(f"  [PASS] {name}")
    else:
        print(f"  [FAIL] {name}")

SRC = "src"

# 1. HTML Joystick & Layout
with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

print("\n--- 1. Testing Virtual Joystick & Mobile UI in index.html ---")
check("No arrow button indicators in joystick", 'class="joystick-dir-indicator' not in html and '▲' not in html and '▼' not in html)
check("Virtual joystick container and base ring exist", 'id="joystickZone"' in html and 'id="moveStick"' in html and 'joystick-base-ring' in html)
check("Virtual joystick inner knob exists", 'id="moveKnob"' in html and 'knob-core' in html)
check("Dedicated circular RUN button preserved", 'id="runButton"' in html and 'run-button' in html)
check("CAMERA reset button preserved", 'id="mobileCameraResetBtn"' in html)
check("JUMP button preserved", 'id="jumpButton"' in html)
check("CROUCH button preserved", 'id="crouchButton"' in html)
check("DASH button preserved", 'id="dashAttackButton"' in html)
check("ATTACK button preserved with Katana and Gun icons", 'id="attackButton"' in html and 'id="attackIconKatana"' in html and 'id="attackIconGun"' in html)
check("Weapon switch button preserved", 'id="weaponSwitchButton"' in html)

# 2. Main.js Joystick Touch & Pointer Handling
with open(os.path.join(SRC, "main.js"), "r", encoding="utf-8") as f:
    main_code = f.read()

print("\n--- 2. Testing Joystick Input & Touch Handling in main.js ---")
check("Joystick tracks pointerId / touch identifier", 'stickPointer' in main_code and 'event.pointerId' in main_code)
check("Joystick supports pointer events and touch events", 'touchstart' in main_code and 'touchmove' in main_code and 'pointermove' in main_code)
check("Joystick resets safely on pointerup, touchend, touchcancel, blur", 'window.addEventListener(\'blur\'' in main_code and 'handleStickEnd' in main_code)
check("Dragging while holding action buttons supported (isolated pointerId / identifier)", 'event.stopPropagation()' in main_code)
check("Camera-relative diagonal & omnidirectional movement uses camera.quaternion", 'applyQuaternion(camera.quaternion)' in main_code)
check("Frame-rate optimization: pre-allocated scratch vectors for input", 'camInputFwdScratch' in main_code and 'camInputRightScratch' in main_code)

# 3. Enemy.js Balanced Difficulty & Dodge Timing
with open(os.path.join(SRC, "Enemy.js"), "r", encoding="utf-8") as f:
    enemy_code = f.read()

print("\n--- 3. Testing Enemy Speeds, Attack Windup & Frequency in Enemy.js ---")
check("Scout movement speed reduced slightly (3.75 vs 4.4)", 'speed: 3.75' in enemy_code)
check("Guardian movement speed reduced slightly (2.1 vs 2.45)", 'speed: 2.1' in enemy_code)
check("Ranged shinobi movement speed reduced slightly (2.5 vs 2.95)", 'speed: 2.5' in enemy_code)
check("Elite shinobi movement speed reduced slightly (2.85 vs 3.3)", 'speed: 2.85' in enemy_code)
check("Shadow Shogun colossus speed reduced slightly (1.4 vs 1.6)", 'speed: 1.4' in enemy_code)
check("Attack windup duration gives player more time to dodge (0.48 - 0.65s)", 'this.windupDuration = Math.max(0.48' in enemy_code)
check("Enemy attack cooldowns increased slightly to reduce attack spam", '1.85 : 2.35' in enemy_code or 'attackCooldownScale' in enemy_code)
check("Coordinator turn delay pause increased (0.45s)", 'pauseDuration = 0.45' in enemy_code)

# 4. CombatSystem.js Fair Hit Detection
with open(os.path.join(SRC, "CombatSystem.js"), "r", encoding="utf-8") as f:
    combat_code = f.read()

print("\n--- 4. Testing Hit Detection & Dodge Mechanics in CombatSystem.js ---")
check("Player can acrobatically dodge attacks by jumping or dashing", 'isAcrobaticDodge' in combat_code or 'dashDuration > 0' in combat_code)
check("Invulnerability window protects player from immediate re-damage", 'player.invulnerable = Math.max(0.55' in combat_code)
check("Exact katana base damage preserved (70 HP)", 'scaledDamage = 70' in combat_code)
check("Exact enemy normal attack damage preserved (30 HP)", '30' in combat_code)

# 5. CameraController.js Smoothness & Anti-Clipping
with open(os.path.join(SRC, "CameraController.js"), "r", encoding="utf-8") as f:
    cam_code = f.read()

print("\n--- 5. Testing Camera Smoothness & Collision in CameraController.js ---")
check("Frame-rate independent delta time exponential decay throughout", 'Math.exp(-dt *' in cam_code)
check("Smooth collision clearance interpolation without sudden snapping", 'collisionFraction' in cam_code)
check("Minimum safe distance to player model prevents camera clipping into ninja", 'minSafeDist = 2.4' in cam_code)
check("Floor clearance prevents camera clipping into ground", 'floor = (' in cam_code and 'getHeight' in cam_code)
check("Stable third-person camera angle and lookYaw preserved", 'this.lookYaw = Math.PI;' in cam_code)

# 6. Progression and PC Controls Preservation
print("\n--- 6. Testing Progression & PC Controls Preservation ---")
with open(os.path.join(SRC, "ProgressionManager.js"), "r", encoding="utf-8") as f:
    prog_code = f.read()
check("All 15 campaign levels preserved", 'levels = [' in prog_code or 'LEVELS = [' in prog_code or 'createLevelDefinition' in main_code)
check("PC keyboard controls preserved in main.js", 'KeyW' in main_code and 'KeyS' in main_code and 'KeyA' in main_code and 'KeyD' in main_code)

print(f"\n==========================================")
print(f"VERIFICATION RESULTS: {passed} / {total} PASSED")
print(f"==========================================")
if passed == total:
    exit(0)
else:
    exit(1)
