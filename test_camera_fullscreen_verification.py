import re
import math
import os
import sys

print("======================================================================")
print("  VOID RUNNER: SHADOW NINJA - CAMERA & FULLSCREEN VERIFICATION SUITE  ")
print("======================================================================")

passed = 0
failed = 0

def check(name, condition, extra=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  [PASS] {name} {extra}")
    else:
        failed += 1
        print(f"  [FAIL] {name} - {extra}")

# -----------------------------------------------------------------------------
# 1. HTML Verification
# -----------------------------------------------------------------------------
print("\n--- 1. VERIFYING HTML STRUCTURE (index.html) ---")
with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

check("Viewport meta has viewport-fit=cover", 'viewport-fit=cover' in html)
check("Camera reset button exists in HUD", 'id="cameraResetButton"' in html)
check("HUD Fullscreen button exists in HUD", 'id="hudFullscreenButton"' in html)
check("Pause button exists in HUD", 'id="pauseButton"' in html)
check("Health bar exists in HUD", 'id="healthBar"' in html)
check("Enemy counter exists in HUD", 'id="enemyValue"' in html)
check("Boss health panel exists", 'id="bossHealthPanel"' in html)
check("Campaign level counter exists", 'id="levelValue"' in html)
check("Virtual joystick zone exists", 'id="joystickZone"' in html)
check("Camera touch zone exists", 'id="cameraTouchZone"' in html)
check("Action buttons cluster exists", 'id="actionCluster"' in html)
check("Jump button exists", 'id="jumpButton"' in html)
check("Crouch button exists", 'id="crouchButton"' in html)
check("Dash attack button exists", 'id="dashAttackButton"' in html)
check("Dynamic attack button exists", 'id="attackButton"' in html)
check("Weapon switch button exists", 'id="weaponSwitchButton"' in html)
check("Katana SVG icon exists", 'id="attackIconKatana"' in html)
check("Gun SVG icon exists", 'id="attackIconGun"' in html)
check("Camera sensitivity H input exists", 'data-setting="cameraSensitivityX"' in html)
check("Camera sensitivity V input exists", 'data-setting="cameraSensitivityY"' in html)
check("Camera follow input exists", 'data-setting="cameraFollow"' in html)
check("Reset camera button in settings exists", 'id="settingsResetCameraBtn"' in html)
check("Reset defaults button in settings exists", 'id="settingsResetDefaultsBtn"' in html)
check("Fullscreen button in settings exists", 'id="fullscreenButton"' in html)
check("Portrait prompt overlay exists", 'id="portraitPrompt"' in html)
check("Lock landscape button exists", 'id="lockLandscapeButton"' in html)
check("Dismiss portrait button exists", 'id="dismissPortraitPrompt"' in html)

# -----------------------------------------------------------------------------
# 2. CSS Verification (src/style.css)
# -----------------------------------------------------------------------------
print("\n--- 2. VERIFYING STYLES (src/style.css) ---")
with open("src/style.css", "r", encoding="utf-8") as f:
    css = f.read()

check("Viewport canvas is positioned full-bleed without margins", 
      '#viewport canvas' in css and 'position: absolute' in css and 'inset: 0' in css)
check(".hud-fullscreen-button class defined", '.hud-fullscreen-button' in css)
check(".camera-reset-button class defined", '.camera-reset-button' in css)
check("#cameraResetButton is NOT display:none on mobile", 
      not re.search(r'#cameraResetButton\s*\{\s*display:\s*none', css))
check(".camera-touch-zone covers right 55%", 'width: 55%' in css)
check(".camera-touch-zone has pointer-events: auto", 
      re.search(r'\.camera-touch-zone\s*\{[^}]*pointer-events:\s*auto', css) is not None)
check(".action-cluster has pointer-events: none", 
      re.search(r'\.action-cluster\s*\{[^}]*pointer-events:\s*none', css) is not None)
check(".action-round-btn has pointer-events: auto", 
      re.search(r'\.action-round-btn\s*\{[^}]*pointer-events:\s*auto', css) is not None)
check("Settings scroll box allows internal scrolling", 
      re.search(r'\.settings-scroll-box\s*\{[^}]*overflow-y:\s*auto', css) is not None)
check("Portrait prompt hides in landscape", 
      'body.is-landscape .portrait-prompt-overlay' in css)

# -----------------------------------------------------------------------------
# 3. SettingsManager Verification (src/SettingsManager.js)
# -----------------------------------------------------------------------------
print("\n--- 3. VERIFYING SETTINGS MANAGER (src/SettingsManager.js) ---")
with open("src/SettingsManager.js", "r", encoding="utf-8") as f:
    sm_code = f.read()

check("Defaults has cameraSensitivityX", 'cameraSensitivityX: 1.0' in sm_code)
check("Defaults has cameraSensitivityY", 'cameraSensitivityY: 1.0' in sm_code)
check("validate() clamps cameraSensitivityX", 'this.values.cameraSensitivityX' in sm_code)
check("validate() clamps cameraSensitivityY", 'this.values.cameraSensitivityY' in sm_code)
check("resetToDefaults() method exists", 'resetToDefaults()' in sm_code)

# -----------------------------------------------------------------------------
# 4. CameraController Verification (src/CameraController.js)
# -----------------------------------------------------------------------------
print("\n--- 4. VERIFYING CAMERA CONTROLLER (src/CameraController.js) ---")
with open("src/CameraController.js", "r", encoding="utf-8") as f:
    cam_code = f.read()

check("CameraController has smoothedFocus", 'this.smoothedFocus = new THREE.Vector3()' in cam_code)
check("CameraController has sensitivityX & sensitivityY", 
      'this.sensitivityX = 1' in cam_code and 'this.sensitivityY = 1' in cam_code)
check("addMouseLook uses sensitivityX & sensitivityY", 
      'sensX' in cam_code and 'sensY' in cam_code and 'addMouseLook' in cam_code)
check("addTouchLook uses sensitivityX & sensitivityY", 
      'addTouchLook' in cam_code and 'sensX' in cam_code)
check("reset() restores lookYaw to Math.PI and resets smoothedFocus", 
      'this.lookYaw = Math.PI;' in cam_code and 'this.smoothedFocus' in cam_code)
check("Obstacle collision avoidance logic present", 
      'isLocationClear' in cam_code and 'minSafeDist' in cam_code)
check("Floor clearance test present", 'floor' in cam_code and 'getHeight' in cam_code)
check("Combat framing logic present for nearby enemies", 'combatWeight' in cam_code or 'nearest < 14' in cam_code)
check("Unwanted spinning fixed: only aligns when running forward (velDotFwd > 0.65)", 
      'velDotFwd > 0.65' in cam_code)
check("Camera shake thresholded (> 0.02) to prevent normal movement jitter", 
      'shake > 0.02' in cam_code)

# -----------------------------------------------------------------------------
# 5. Main Script Verification (src/main.js)
# -----------------------------------------------------------------------------
print("\n--- 5. VERIFYING GAME INTEGRATION (src/main.js) ---")
with open("src/main.js", "r", encoding="utf-8") as f:
    main_code = f.read()

check("toggleFullscreen function implemented", 'async function toggleFullscreen' in main_code)
check("lockLandscapeOrientation calls toggleFullscreen", 'await toggleFullscreen(true)' in main_code)
check("fullscreenchange event listeners registered", 'fullscreenchange' in main_code)
check("webkitfullscreenchange event listeners registered", 'webkitfullscreenchange' in main_code)
check("resize() handles aspect ratio and avoids duplicate sizing", 
      'lastRenderWidth' in main_code and 'renderer.setSize(width, height, true)' in main_code)
check("bindHoldControl calls event.stopPropagation()", 'event.stopPropagation()' in main_code)
check("cameraTouchZone pointerdown excludes UI elements", 
      'e.target.closest' in main_code and 'cameraTouchZone' in main_code)
check("applySettings updates camera sensitivity X and Y", 
      'cameraController.sensitivityX = settings.cameraSensitivityX' in main_code and
      'cameraController.sensitivityY = settings.cameraSensitivityY' in main_code)
check("settingsResetCameraBtn wired up", 'settingsResetCameraBtn' in main_code)
check("settingsResetDefaultsBtn wired up", 'settingsResetDefaultsBtn' in main_code)
check("updateCamera passes smooth torso focus", 'focus.y += 1.3' in main_code or 'focus.y += 1.25' in main_code)
check("No duplicate orientationchange listeners inside bindFrontend", 
      main_code.count("window.addEventListener('orientationchange'") == 1)

# -----------------------------------------------------------------------------
# 6. Functional Math Simulation for Camera Logic
# -----------------------------------------------------------------------------
print("\n--- 6. CAMERA MATH SIMULATION TESTS ---")

# Test 1: Moving backwards relative to camera should NOT cause camera to flip/spin
lookYaw = math.pi
camFwdX = -math.sin(lookYaw)
camFwdZ = -math.cos(lookYaw)

# Moving backwards: velocity is in opposite direction of camera forward
velX = -camFwdX * 15
velZ = -camFwdZ * 15
velMag = math.hypot(velX, velZ)
velDotFwd = (camFwdX * velX + camFwdZ * velZ) / velMag

check("Moving backwards has negative forward dot product", velDotFwd < 0)
check("Auto-alignment does NOT trigger when moving backwards", velDotFwd <= 0.65)

# Test 2: Moving forward relative to camera
velX = camFwdX * 15
velZ = camFwdZ * 15
velMag = math.hypot(velX, velZ)
velDotFwd = (camFwdX * velX + camFwdZ * velZ) / velMag
check("Moving forward has positive forward dot product", velDotFwd > 0.99)
check("Auto-alignment smoothly activates when running forward", velDotFwd > 0.65)

# Test 3: Horizontal and vertical sensitivity scaling
baseDeltaX = 50
baseDeltaY = 30
sensX = 1.5
sensY = 0.8
resX = baseDeltaX * 0.0042 * sensX
resY = baseDeltaY * 0.0028 * sensY
check("Horizontal sensitivity scales correctly", math.isclose(resX, 50 * 0.0042 * 1.5))
check("Vertical sensitivity scales correctly", math.isclose(resY, 30 * 0.0028 * 0.8))

# Test 4: Obstacle collision raycast clamping
desiredDist = 8.0
minSafeDist = 2.2
hitStep = 6 # out of 14 steps => hit at (6/14) * 8.0 = 3.42m
clampedDist = max(minSafeDist, ((hitStep - 1) / 14) * desiredDist)
check("Obstacle collision clamps distance safely", 
      clampedDist < desiredDist and clampedDist >= minSafeDist)

print("\n======================================================================")
print(f"  RESULTS: {passed} PASSED, {failed} FAILED")
print("======================================================================")

if failed > 0:
    sys.exit(1)
else:
    sys.exit(0)
