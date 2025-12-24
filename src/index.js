/*
================================================================================
SCROLL-DRIVEN LANDING PAGE v3
================================================================================

TWO-LAYER ARCHITECTURE (for iOS scroll compositor compatibility):
- ANCHOR BLURBS: Invisible (visibility: hidden), position: relative, scroll naturally
  with the page. These define scroll geometry and are used for position tracking.
- DISPLAY BLURBS: Visible, in a fixed overlay (#blurb-overlay), positioned by JS
  based on anchor positions + sticky offset. Transforms applied here don't fight
  iOS's native scroll compositor.

Canvas is fixed backdrop, animation driven by scroll position.

ANCHOR SYSTEM:
- Each blurb has a "home position" (vh from viewport top) where it's optimally placed
- At runtime, we calculate the scrollY where each blurb reaches its home
- Animation keyframes reference these anchors: ['blurbX', ratio]
  - ratio 0 = exactly when blurbX hits home
  - ratio 0.5 = halfway between blurbX home and next blurb's home

STICKY EFFECT:
- As blurbs approach their home position, they slow down (offset toward home)
- As they leave home, they speed up (offset decays)
- Achieved by applying transform offset to display blurbs (not anchor blurbs)

================================================================================
*/

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEBUG_TIMELINE = false;

// Responsive camera rotation keyframes based on viewport width
// Breakpoints match CSS media queries
function getCameraRotationKeyframes() {
  const width = window.innerWidth;
  // when tower is centered, we rotate such that it falls more backwards.
  if (width <= 400) {
    // centered tower
    return [
      { at: ['blurb1', 0], value: -15 },
      { at: ['blurb5', 1], value: 70, easing: 'easeIn' },
    ];
  } else if (width <= 600) {
    // centered tower
    return [
      { at: ['blurb1', 0], value: -15 },
      { at: ['blurb5', 1], value: 70, easing: 'easeIn' },
    ];
  } else if (width <= 900) {
    // leftwards tower - falls a little more to the right.
    return [
      { at: ['blurb1', 0], value: -10 },
      { at: ['blurb5', 1], value: 50, easing: 'easeIn' },
    ];
  } else {
    // desktop, most leftwards tower, falls farthest to the right.
    return [
      { at: ['blurb1', 0], value: -10 },
      { at: ['blurb5', 1], value: 15, easing: 'easeIn' },
    ];
  }
}

// Blurb config (all values in vh units)
// - home: viewport position where blurb is "in position"
// - fadeIn: vh below home where fade-in starts (0 opacity here, 1 at home)
// - hold: vh above home where full opacity is maintained
// - fadeOut: vh above hold zone where fade-out completes (0 opacity here)
function getBlurbConfig() {
  const width = window.innerWidth;
  if (width <= 400) {
    // Mobile
    return {
      blurb1: { home: 50, fadeIn: 30, hold: 50, fadeOut: 20 },
      blurb2: { home: 50, fadeIn: 30, hold: 50, fadeOut: 20 },
      blurb3: { home: 50, fadeIn: 30, hold: 50, fadeOut: 20 },
      blurb5: { home: 50, fadeIn: 30, hold: 50, fadeOut: 20 },
    };
  } else if (width <= 600) {
    return {
      blurb1: { home: 50, fadeIn: 30, hold: 50, fadeOut: 20 },
      blurb2: { home: 45, fadeIn: 30, hold: 50, fadeOut: 20 },
      blurb3: { home: 45, fadeIn: 30, hold: 50, fadeOut: 20 },
      blurb5: { home: 45, fadeIn: 30, hold: 50, fadeOut: 20 },
    };
  } else {
    // Desktop
    return {
      blurb1: { home: 50, fadeIn: 30, hold: 50, fadeOut: 20 },
      blurb2: { home: 45, fadeIn: 30, hold: 50, fadeOut: 20 },
      blurb3: { home: 45, fadeIn: 30, hold: 50, fadeOut: 20 },
      blurb5: { home: 45, fadeIn: 30, hold: 50, fadeOut: 20 },
    };
  }
}

// Spacing between blurbs (vh units)
const BLURB_SPACING = 100;

// =============================================================================
// ANIMATION TIMELINE
// =============================================================================
// Format: ['blurbX', ratio] where ratio is 0-1 toward next blurb's home

const ANIMATIONS = {
  // Canvas visibility and position
  canvas: {
    opacity: {
      keyframes: [
        { at: ['blurb1', 0.3], value: 0 },
        { at: ['blurb1', 0.7], value: 1, easing: 'easeOut' },
        { at: ['blurb5', 0.5], value: 1 },
        { at: ['blurb5', 0.9], value: 0, easing: 'easeIn' },
      ],
    },
  },

  // Tower build-up (layers appearing)
  towerBuild: {
    progress: {
      keyframes: [
        { at: ['blurb1', 0.5], value: 0 },
        { at: ['blurb2', 0], value: 1, easing: 'easeOut' },
      ],
    },
  },

  // Tower animation frame (0 = settled, 1 = fully collapsed)
  // Brick starts sliding around frame 130 (~0.08 of animation)
  towerFrame: {
    frame: {
      keyframes: [
        { at: ['blurb2', 0], value: 0 },
        { at: ['blurb3', 0], value: 0.08 },  // brick slid out
        { at: ['blurb5', 0], value: 1 },      // fully collapsed
      ],
    },
  },

  // Bottom block pulse intensity
  pulseIntensity: {
    intensity: {
      keyframes: [
        { at: ['blurb2', 0], value: 0 },
        { at: ['blurb2', 0.3], value: 1, easing: 'easeOut' },
        { at: ['blurb3', 0.5], value: 1 },
        { at: ['blurb5', 0], value: 0, easing: 'easeIn' },
      ],
    },
  },

  // Header bar (background/border behind wordmark)
  headerBar: {
    opacity: {
      keyframes: [
        { at: ['blurb5', 0.5], value: 0 },
        { at: ['blurb5', 1.0], value: 1, easing: 'easeOut' },
      ],
    },
  },

  // Camera rotation around center (gentle orbit during scroll)
  // Value is angle offset in degrees from starting position
  // Uses getCameraRotationKeyframes() for responsive values
  cameraRotation: {
    angle: {
      get keyframes() {
        return getCameraRotationKeyframes();
      },
    },
  },

  // Down arrow - visible until manifesto appears
  downArrow: {
    opacity: {
      keyframes: [
        { at: ['blurb1', 0], value: 1 },
        { at: ['blurb2', 0], value: 0.5 },
        { at: ['blurb5', 0], value: 0.5 },
        { at: ['blurb5', 0.6], value: 0, easing: 'easeIn' },
      ],
    },
  },
};

// =============================================================================
// EASING FUNCTIONS
// =============================================================================

const EASING = {
  linear: t => t,
  easeIn: t => t * t,
  easeOut: t => 1 - (1 - t) * (1 - t),
  easeInOut: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
};

// =============================================================================
// RUNTIME STATE
// =============================================================================

// Calculated on init/resize: the scrollY where each blurb hits its home
let blurbAnchors = {}; // { blurb1: { element, home, scrollHome }, ... }
let anchorOrder = [];  // ['blurb1', 'blurb2', 'blurb3', 'blurb5']

// Current scroll state
let currentScrollY = 0;
let smoothScrollY = 0;  // Interpolated scroll position for smoother animations
const SCROLL_SMOOTHING = 0.3;  // 0 = no smoothing, 1 = instant (lower = smoother but laggier)

// Get stable viewport height (svh) - doesn't change when iOS address bar hides
// This matches the CSS svh unit used for anchor blurb spacing
function getStableViewportHeight() {
  // Use CSS to compute 100svh in pixels
  const el = document.createElement('div');
  el.style.height = '100svh';
  el.style.position = 'absolute';
  el.style.visibility = 'hidden';
  document.body.appendChild(el);
  const svh = el.offsetHeight;
  document.body.removeChild(el);
  return svh;
}

let stableVh = 0;  // Cached on init, updated on resize

// =============================================================================
// THREE.JS SETUP
// =============================================================================

let THREE = null;
let LineSegments2 = null;
let LineMaterial = null;
let LineSegmentsGeometry = null;
let compressedAnimationData = null;

let resourcesLoaded = null;
let resourcesReady = false;
let scene3DInitialized = false;

let scene, camera, renderer;
let blocks = [];
let animationData = null;
let blockMaterials = [];
let wireframeMaterials = [];
let bottomBlockMaterial = null;

const COLOR_BACKGROUND = 0x1a1a1e;
const COLOR_BLOCK = 0x2d2d2f;
const COLOR_WIREFRAME = 0xffffff;
const LINE_WIDTH = 1;
const RENDER_WIDTH = 1920;
const RENDER_HEIGHT = 1080;
const MIN_FRAME = 90;
const TOWER_LAYERS = 18;

function startLoadingResources() {
  resourcesLoaded = Promise.all([
    import('three').then(module => { THREE = module; }),
    import('three/examples/jsm/lines/LineSegments2.js').then(module => { LineSegments2 = module.LineSegments2; }),
    import('three/examples/jsm/lines/LineMaterial.js').then(module => { LineMaterial = module.LineMaterial; }),
    import('three/examples/jsm/lines/LineSegmentsGeometry.js').then(module => { LineSegmentsGeometry = module.LineSegmentsGeometry; }),
    fetch('./animation-compressed.json').then(r => r.json()).then(data => { compressedAnimationData = data; })
  ]).then(() => {
    resourcesReady = true;
    console.log('Resources loaded');
  });
}

function init3D() {
  if (scene3DInitialized || !resourcesReady) return;
  scene3DInitialized = true;

  animationData = expandAnimationData(compressedAnimationData);
  console.log(`Animation: ${animationData.frameCount} frames, ${animationData.frames[0].length} blocks`);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(COLOR_BACKGROUND);

  const aspect = RENDER_WIDTH / RENDER_HEIGHT;
  const viewSize = 6;
  camera = new THREE.OrthographicCamera(
    -viewSize * aspect, viewSize * aspect,
    viewSize, -viewSize,
    0.1, 100
  );
  // Position camera to preserve original viewing angle
  // Original: (20, 20, 20) looking at (3, 2, 0)
  // Adjusted: (17, 20.75, 20) looking at (0, 2.75, 0)
  camera.position.set(17, 20.75, 20);
  camera.lookAt(0, 2.75, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(RENDER_WIDTH, RENDER_HEIGHT, false);
  document.getElementById('canvas-container').appendChild(renderer.domElement);

  createBlocks(animationData);
  setFrame(MIN_FRAME);
}

function createBlocks(data) {
  const { length, width, height } = data.blockDimensions;
  const geometry = new THREE.BoxGeometry(length, height, width);
  const edgesGeo = new THREE.EdgesGeometry(geometry);
  const edgePositions = edgesGeo.attributes.position.array;

  const settledFrame = data.frames[90];
  const blockLayers = settledFrame.map((b, i) => {
    const y = b.p[1];
    const layer = Math.round((y - 0.13) / 0.29);
    return Math.max(0, Math.min(layer, TOWER_LAYERS - 1));
  });

  const firstFrame = data.frames[0];
  for (let i = 0; i < firstFrame.length; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: COLOR_BLOCK,
      transparent: true,
      opacity: 0,
    });
    blockMaterials.push(material);
    if (i === 0) bottomBlockMaterial = material;

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.layer = blockLayers[i];
    scene.add(mesh);
    blocks.push(mesh);

    const wireMaterial = new LineMaterial({
      color: COLOR_WIREFRAME,
      linewidth: LINE_WIDTH,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      transparent: true,
      opacity: 0,
    });
    wireMaterial.resolution.set(RENDER_WIDTH, RENDER_HEIGHT);
    wireframeMaterials.push(wireMaterial);

    const lineGeo = new LineSegmentsGeometry();
    lineGeo.setPositions(edgePositions);
    const wireframe = new LineSegments2(lineGeo, wireMaterial);
    mesh.userData.wireframe = wireframe;
    scene.add(wireframe);
  }
}

function setFrame(frameIndex) {
  if (!animationData) return;
  frameIndex = Math.max(MIN_FRAME, Math.min(frameIndex, animationData.frames.length - 1));
  const frame = animationData.frames[frameIndex];

  for (let i = 0; i < blocks.length && i < frame.length; i++) {
    const block = blocks[i];
    const { p, q } = frame[i];

    block.position.set(p[0], p[1], p[2]);
    block.quaternion.set(q[0], q[1], q[2], q[3]);

    if (block.userData.wireframe) {
      block.userData.wireframe.position.copy(block.position);
      block.userData.wireframe.quaternion.copy(block.quaternion);
    }
  }
}

function expandAnimationData(compressed) {
  const expandedFrames = [];
  for (let i = 0; i < compressed.frames.length; i++) {
    expandedFrames.push(compressed.frames[i]);
    if (i < compressed.frames.length - 1) {
      const frameA = compressed.frames[i];
      const frameB = compressed.frames[i + 1];
      const midFrame = frameA.map((blockA, j) => {
        const blockB = frameB[j];
        return {
          p: blockA.p.map((v, k) => (v + blockB.p[k]) / 2),
          q: blockA.q.map((v, k) => (v + blockB.q[k]) / 2)
        };
      });
      expandedFrames.push(midFrame);
    }
  }

  const offset = compressed.originalFrameOffset || 90;
  const paddedFrames = [];
  const settledFrame = expandedFrames[0];
  for (let i = 0; i < offset; i++) {
    paddedFrames.push(settledFrame);
  }
  paddedFrames.push(...expandedFrames);

  return {
    blockDimensions: compressed.blockDimensions,
    frames: paddedFrames,
    frameCount: paddedFrames.length
  };
}

// =============================================================================
// ANCHOR CALCULATION
// =============================================================================

function calculateAnchors() {
  // Use stable viewport height (svh) to match CSS units
  stableVh = getStableViewportHeight();
  const blurbConfig = getBlurbConfig();
  anchorOrder = Object.keys(blurbConfig);

  for (const id of anchorOrder) {
    const element = document.getElementById(id);
    if (!element) continue;

    const elementHeight = element.offsetHeight;
    const offsetTop = element.offsetTop;

    // Get the element's visual center, accounting for CSS transforms
    // For elements with transform: translateY(-50%), the visual center
    // is at offsetTop (since the transform shifts it up by half its height)
    const style = window.getComputedStyle(element);
    const transform = style.transform;
    let visualCenterOffset = elementHeight / 2;
    if (transform && transform !== 'none') {
      // Parse translateY from transform matrix
      const match = transform.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
      if (match) {
        visualCenterOffset += parseFloat(match[1]);
      }
    }
    const visualCenter = offsetTop + visualCenterOffset;

    // Config home value represents where the CENTER should be (in vh)
    const homeVh = blurbConfig[id].home;
    const homePx = homeVh * stableVh / 100;

    // scrollY where this blurb's visual center reaches its home position
    const scrollHome = visualCenter - homePx;

    blurbAnchors[id] = {
      element,
      homeVh,
      homePx,
      offsetTop,
      elementHeight,
      visualCenter,
      scrollHome,
    };
  }

  console.log('Anchors calculated (stableVh=' + stableVh + '):');
  for (const id of anchorOrder) {
    const a = blurbAnchors[id];
    console.log(`  ${id}: offsetTop=${a.offsetTop}, height=${a.elementHeight}, visualCenter=${Math.round(a.visualCenter)}, homePx=${Math.round(a.homePx)}, scrollHome=${Math.round(a.scrollHome)}`);
  }
}

// Validate that anchors are sane (not all at the same position)
// Returns true if anchors look good, false if something is wrong
function validateAnchors() {
  const ids = Object.keys(blurbAnchors);
  if (ids.length < 2) {
    console.warn('Anchor validation: fewer than 2 anchors found');
    return false;
  }

  // Check that anchors have distinct scrollHome values with reasonable spacing
  const scrollHomes = ids.map(id => blurbAnchors[id].scrollHome);
  const minSpacing = stableVh; // At least 1vh between anchors

  for (let i = 1; i < scrollHomes.length; i++) {
    const spacing = scrollHomes[i] - scrollHomes[i - 1];
    if (spacing < minSpacing) {
      console.warn(`Anchor validation FAILED: ${ids[i-1]} and ${ids[i]} are only ${Math.round(spacing)}px apart (min: ${Math.round(minSpacing)}px)`);
      return false;
    }
  }

  // Check that first anchor isn't at 0 (margin collapse issue)
  if (blurbAnchors[ids[0]].offsetTop === 0) {
    console.warn(`Anchor validation FAILED: ${ids[0]} has offsetTop=0 (possible margin collapse)`);
    return false;
  }

  console.log('Anchor validation passed');
  return true;
}

// =============================================================================
// SCROLL TO ANCHOR CONVERSION
// =============================================================================

// Convert an anchor reference ['blurbX', ratio] to a scrollY value
function anchorToScrollY(anchorRef) {
  const [blurbId, ratio] = anchorRef;
  const idx = anchorOrder.indexOf(blurbId);
  if (idx === -1) return 0;

  const anchor = blurbAnchors[blurbId];
  if (!anchor) return 0;

  if (ratio === 0) {
    return anchor.scrollHome;
  }

  // Find next anchor
  const nextId = anchorOrder[idx + 1];
  if (!nextId || !blurbAnchors[nextId]) {
    // No next blurb anchor - use distance to manifesto content
    const manifesto = document.getElementById('manifesto');
    if (manifesto) {
      const manifestoTop = manifesto.offsetTop;
      const distance = manifestoTop - anchor.scrollHome;
      return anchor.scrollHome + ratio * distance;
    }
    // Fallback if no manifesto
    return anchor.scrollHome + ratio * window.innerHeight * 2;
  }

  const nextAnchor = blurbAnchors[nextId];
  const distance = nextAnchor.scrollHome - anchor.scrollHome;
  return anchor.scrollHome + ratio * distance;
}

// =============================================================================
// INTERPOLATION
// =============================================================================

// Interpolate animation value at current scroll position
function interpolateAnimation(animConfig) {
  const keyframes = animConfig.keyframes;
  if (!keyframes || keyframes.length === 0) return 0;

  // Convert all keyframes to scrollY values
  const resolved = keyframes.map(kf => ({
    scrollY: anchorToScrollY(kf.at),
    value: kf.value,
    easing: kf.easing || 'linear',
  }));

  // Before first keyframe
  if (currentScrollY <= resolved[0].scrollY) {
    return resolved[0].value;
  }

  // After last keyframe
  if (currentScrollY >= resolved[resolved.length - 1].scrollY) {
    return resolved[resolved.length - 1].value;
  }

  // Find segment
  for (let i = 0; i < resolved.length - 1; i++) {
    const a = resolved[i];
    const b = resolved[i + 1];

    if (currentScrollY >= a.scrollY && currentScrollY < b.scrollY) {
      const t = (currentScrollY - a.scrollY) / (b.scrollY - a.scrollY);
      const easedT = EASING[b.easing](t);
      return a.value + (b.value - a.value) * easedT;
    }
  }

  return resolved[resolved.length - 1].value;
}

// =============================================================================
// BLURB UPDATE (opacity + sticky transform)
// =============================================================================

// How much to "stick" near home (0 = no effect, 1 = fully sticky, >1 = more intense)
const STICKY_STRENGTH = 0.9;
// Range in vh where sticky effect applies
const STICKY_RANGE = 60;

// Display blurb elements (in the fixed overlay)
let displayBlurbs = {};

// Detect touch device for potential sticky disable
const IS_TOUCH_DEVICE = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

function initDisplayBlurbs() {
  for (const id of Object.keys(getBlurbConfig())) {
    const displayEl = document.getElementById(`${id}-display`);
    if (displayEl) {
      displayBlurbs[id] = displayEl;
    }
  }
}

function updateBlurb(id) {
  const anchor = blurbAnchors[id];
  const config = getBlurbConfig()[id];
  const displayEl = displayBlurbs[id];
  if (!anchor || !config || !displayEl) return;

  // Use stable viewport height to avoid iOS address bar resize issues
  const vh = stableVh;

  // Convert config vh values to pixels
  const fadeInPx = config.fadeIn * vh / 100;
  const holdPx = config.hold * vh / 100;
  const fadeOutPx = config.fadeOut * vh / 100;
  const stickyRangePx = STICKY_RANGE * vh / 100;

  // Current position of anchor blurb's visual CENTER relative to viewport
  // Use smoothScrollY for smoother animation on touch devices
  const blurbCenterViewportY = anchor.visualCenter - smoothScrollY;

  // Distance from home position (negative = above home, positive = below home)
  // Home represents where the CENTER should be
  const distanceFromHome = blurbCenterViewportY - anchor.homePx;

  // --- Opacity calculation ---
  // Hold zone is symmetric: extends holdPx/2 above AND below home
  const holdHalf = holdPx / 2;
  let opacity = 1;

  if (distanceFromHome > holdHalf + fadeInPx) {
    // Below fade-in zone - not visible yet
    opacity = 0;
  } else if (distanceFromHome > holdHalf) {
    // In fade-in zone (fading in as we approach the hold zone)
    opacity = 1 - (distanceFromHome - holdHalf) / fadeInPx;
  } else if (distanceFromHome > -holdHalf) {
    // In hold zone (centered on home) - full opacity
    opacity = 1;
  } else if (distanceFromHome > -holdHalf - fadeOutPx) {
    // In fade-out zone
    const fadeOutProgress = (-distanceFromHome - holdHalf) / fadeOutPx;
    opacity = 1 - fadeOutProgress;
  } else {
    // Above fade-out zone - fully faded
    opacity = 0;
  }

  // --- Sticky transform calculation ---
  // Offset counteracts scroll near home, creating slow-down/speed-up effect
  let offsetY = 0;

  if (Math.abs(distanceFromHome) < stickyRangePx) {
    // Within sticky range - apply offset proportional to distance
    // The offset pushes OPPOSITE to distance (toward home)
    // Using a quadratic curve so effect is stronger near the edges of the range
    const normalizedDist = distanceFromHome / stickyRangePx; // -1 to 1
    // Offset is negative of distance * strength (pushes toward home)
    // Multiply by (1 - |normalizedDist|) so it tapers off at edges
    const edgeFactor = 1 - Math.abs(normalizedDist);
    offsetY = -distanceFromHome * STICKY_STRENGTH * Math.pow(edgeFactor,0.5);
  }

  // Store for debug visualization
  anchor.currentOffsetY = offsetY;
  anchor.currentDistanceFromHome = distanceFromHome;
  anchor.stickyRangePx = stickyRangePx;

  // --- Position the display blurb in the fixed overlay ---
  // Position display so its center is at blurbCenterViewportY + offset
  // displayTop = centerY - height/2
  const displayTop = blurbCenterViewportY - anchor.elementHeight / 2 + offsetY;

  displayEl.style.opacity = Math.max(0, Math.min(1, opacity));
  displayEl.style.top = `${displayTop}px`;
}

// =============================================================================
// ELEMENT UPDATES
// =============================================================================

let canvasContainer, header, wordmark, downArrow, debugEl;

function initDOMElements() {
  canvasContainer = document.getElementById('canvas-container');
  header = document.getElementById('header');
  wordmark = document.getElementById('wordmark');
  downArrow = document.getElementById('down-arrow');
  debugEl = document.getElementById('debug');

  // Wordmark click scrolls to top (but allow cmd/ctrl+click to open in new tab)
  wordmark.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey) return; // Allow new tab behavior
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function updateCanvas() {
  const opacity = interpolateAnimation(ANIMATIONS.canvas.opacity);
  canvasContainer.style.opacity = opacity;

  // Canvas is fixed position - just fades in/out, no movement

  // Initialize 3D when canvas becomes visible
  if (opacity > 0 && !scene3DInitialized) {
    if (resourcesReady) {
      init3D();
    } else {
      resourcesLoaded.then(() => init3D());
    }
  }
}

function updateTowerBuild() {
  if (!scene3DInitialized) return;

  const progress = interpolateAnimation(ANIMATIONS.towerBuild.progress);

  for (let i = 0; i < blocks.length; i++) {
    const layer = blocks[i].userData.layer;
    const layerNorm = layer / (TOWER_LAYERS - 1);

    const fadeZone = 0.15;
    const layerStart = layerNorm * (1 - fadeZone);
    const layerEnd = layerStart + fadeZone;

    let opacity = 0;
    if (progress >= layerEnd) {
      opacity = 1;
    } else if (progress > layerStart) {
      opacity = (progress - layerStart) / fadeZone;
    }

    blockMaterials[i].opacity = opacity;
    wireframeMaterials[i].opacity = opacity;
    blocks[i].visible = opacity > 0;
    blocks[i].userData.wireframe.visible = opacity > 0;
    blockMaterials[i].depthWrite = opacity > 0.9;
  }
}

function updateTowerFrame() {
  if (!scene3DInitialized || !animationData) return;

  const frameProgress = interpolateAnimation(ANIMATIONS.towerFrame.frame);
  const maxFrame = animationData.frames.length - 1;
  const targetFrame = MIN_FRAME + frameProgress * (maxFrame - MIN_FRAME);
  setFrame(Math.round(targetFrame));
}

function updateBottomBlockPulse(timestamp) {
  if (!scene3DInitialized || !bottomBlockMaterial) return;

  const intensity = interpolateAnimation(ANIMATIONS.pulseIntensity.intensity);

  if (intensity > 0) {
    const pulseWave = (Math.sin(timestamp / 200) + 1) / 2;
    const pulse = pulseWave * intensity;

    const baseColor = new THREE.Color(COLOR_BLOCK);
    const highlightColor = new THREE.Color(0x808085);
    bottomBlockMaterial.color.copy(baseColor).lerp(highlightColor, pulse);
  } else {
    bottomBlockMaterial.color.setHex(COLOR_BLOCK);
  }
}

function updateDownArrow() {
  const opacity = interpolateAnimation(ANIMATIONS.downArrow.opacity);
  downArrow.style.opacity = opacity;
}

function updateHeaderBar() {
  const opacity = interpolateAnimation(ANIMATIONS.headerBar.opacity);
  header.style.setProperty('--header-bar-opacity', opacity);
}

// Camera rotation - orbit around the tower's physical center based on scroll
// Original camera: (20, 20, 20), looked at: (3, 2, 0)
// We moved lookAt to tower center (0, 2.75, 0), delta = (-3, +0.75, 0)
// So camera moves same delta: (20, 20, 20) -> (17, 20.75, 20)
// Tower is centered at origin (0, 0, 0) in the physics simulation
const TOWER_CENTER = { x: 0, y: 0, z: 0 };
const CAMERA_LOOK_AT = { x: 0, y: 2.75, z: 0 }; // Tower center (y = midpoint of tower height)
const CAMERA_Y = 20.75;

// Adjusted camera offset from tower center: (17-0, 20.75, 20-0) = (17, 20.75, 20)
// Horizontal distance from tower center in XZ plane = sqrt(17² + 20²) ≈ 26.25
const CAMERA_OFFSET_X = 17 - TOWER_CENTER.x; // 17
const CAMERA_OFFSET_Z = 20 - TOWER_CENTER.z; // 20
const CAMERA_HORIZONTAL_RADIUS = Math.sqrt(CAMERA_OFFSET_X * CAMERA_OFFSET_X + CAMERA_OFFSET_Z * CAMERA_OFFSET_Z);
// Base angle from tower center: atan2(20, 17) ≈ 49.6 degrees
const CAMERA_BASE_ANGLE = Math.atan2(CAMERA_OFFSET_Z, CAMERA_OFFSET_X);

// LookAt offset from tower center (for framing)
const LOOKAT_OFFSET = { x: CAMERA_LOOK_AT.x - TOWER_CENTER.x, z: CAMERA_LOOK_AT.z - TOWER_CENTER.z };

function updateCameraRotation() {
  if (!scene3DInitialized || !camera) return;

  const angleDeg = interpolateAnimation(ANIMATIONS.cameraRotation.angle);
  const angleRad = angleDeg * Math.PI / 180;

  const totalAngle = CAMERA_BASE_ANGLE + angleRad;

  // Rotate camera position around the tower center
  camera.position.x = TOWER_CENTER.x + CAMERA_HORIZONTAL_RADIUS * Math.cos(totalAngle);
  camera.position.z = TOWER_CENTER.z + CAMERA_HORIZONTAL_RADIUS * Math.sin(totalAngle);
  camera.position.y = CAMERA_Y;

  // Rotate the lookAt point by the same angle to maintain framing
  const lookAtX = TOWER_CENTER.x + LOOKAT_OFFSET.x * Math.cos(angleRad) - LOOKAT_OFFSET.z * Math.sin(angleRad);
  const lookAtZ = TOWER_CENTER.z + LOOKAT_OFFSET.x * Math.sin(angleRad) + LOOKAT_OFFSET.z * Math.cos(angleRad);
  camera.lookAt(lookAtX, CAMERA_LOOK_AT.y, lookAtZ);
}

// =============================================================================
// DEBUG TIMELINE
// =============================================================================

function createDebugTimeline() {
  if (!DEBUG_TIMELINE) return;

  const timeline = document.createElement('div');
  timeline.id = 'debug-timeline';
  timeline.style.cssText = `
    position: fixed;
    left: 10px;
    top: 0;
    bottom: 0;
    width: 4px;
    background: rgba(255,255,255,0.1);
    z-index: 9998;
    pointer-events: none;
  `;
  document.body.appendChild(timeline);

  // Current position marker
  const marker = document.createElement('div');
  marker.id = 'debug-timeline-current';
  marker.style.cssText = `
    position: fixed;
    left: 6px;
    width: 12px;
    height: 3px;
    background: #0f0;
    z-index: 9999;
    pointer-events: none;
  `;
  document.body.appendChild(marker);
}

function updateDebugTimeline() {
  if (!DEBUG_TIMELINE) return;

  const timeline = document.getElementById('debug-timeline');
  const marker = document.getElementById('debug-timeline-current');
  if (!timeline || !marker) return;

  // Remove old notches
  timeline.querySelectorAll('.debug-notch, .debug-label').forEach(el => el.remove());

  // Calculate total scroll range
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (maxScroll <= 0) return;

  // Add notches for each anchor
  for (const id of anchorOrder) {
    const anchor = blurbAnchors[id];
    if (!anchor) continue;

    const percent = (anchor.scrollHome / maxScroll) * 100;

    // Sticky range indicator (background bar)
    if (anchor.stickyRangePx) {
      const stickyRangeScroll = anchor.stickyRangePx; // sticky range in scroll pixels
      const rangeTopPercent = ((anchor.scrollHome - stickyRangeScroll) / maxScroll) * 100;
      const rangeBottomPercent = ((anchor.scrollHome + stickyRangeScroll) / maxScroll) * 100;
      const rangeHeight = rangeBottomPercent - rangeTopPercent;

      const stickyBar = document.createElement('div');
      stickyBar.className = 'debug-notch';
      stickyBar.style.cssText = `
        position: absolute;
        left: 0;
        top: ${rangeTopPercent}%;
        width: 8px;
        height: ${rangeHeight}%;
        background: rgba(100,100,255,0.3);
        border-radius: 2px;
      `;
      timeline.appendChild(stickyBar);

      // Show current offset as a horizontal bar - exaggerated for visibility
      if (anchor.currentOffsetY !== undefined && anchor.currentOffsetY !== 0) {
        const offsetIndicator = document.createElement('div');
        offsetIndicator.className = 'debug-notch';
        // Exaggerate width: 1px offset = 2px width, up to 200px max
        const offsetWidth = Math.min(200, Math.abs(anchor.currentOffsetY) * 2);
        offsetIndicator.style.cssText = `
          position: absolute;
          left: 8px;
          top: ${percent}%;
          width: ${offsetWidth}px;
          height: 8px;
          background: ${anchor.currentOffsetY > 0 ? 'rgba(100,255,100,0.9)' : 'rgba(255,255,100,0.9)'};
          transform: translateY(-50%);
          border-radius: 2px;
        `;
        timeline.appendChild(offsetIndicator);
      }
    }

    const notch = document.createElement('div');
    notch.className = 'debug-notch';
    notch.style.cssText = `
      position: absolute;
      left: 0;
      top: ${percent}%;
      width: 20px;
      height: 1px;
      background: rgba(255,100,100,0.6);
    `;
    timeline.appendChild(notch);

    const label = document.createElement('div');
    label.className = 'debug-label';
    label.textContent = `${id}${anchor.currentOffsetY ? ` (${Math.round(anchor.currentOffsetY)}px)` : ''}`;
    label.style.cssText = `
      position: absolute;
      left: 24px;
      top: ${percent}%;
      transform: translateY(-50%);
      font-size: 9px;
      font-family: monospace;
      color: rgba(255,100,100,0.6);
      white-space: nowrap;
    `;
    timeline.appendChild(label);
  }

  // Update current position marker - use smoothScrollY on touch devices
  const scrollForMarker = IS_TOUCH_DEVICE ? smoothScrollY : currentScrollY;
  const currentPercent = (scrollForMarker / maxScroll) * 100;
  marker.style.top = `${Math.min(100, Math.max(0, currentPercent))}%`;
}

let lastViewportHeight = 0;

function updateDebug() {
  if (!DEBUG_TIMELINE || !debugEl) return;

  // Find which segment we're in
  let segment = 'before';
  for (let i = 0; i < anchorOrder.length; i++) {
    const id = anchorOrder[i];
    const anchor = blurbAnchors[id];
    if (!anchor) continue;

    if (currentScrollY < anchor.scrollHome) {
      segment = i === 0 ? 'before ' + id : `${anchorOrder[i-1]} → ${id}`;
      break;
    }
    segment = 'after ' + id;
  }

  // Track viewport height changes (iOS address bar hide/show)
  const vh = window.innerHeight;
  const vhChanged = lastViewportHeight !== 0 && vh !== lastViewportHeight;
  lastViewportHeight = vh;

  debugEl.textContent = `scroll: ${Math.round(currentScrollY)}
segment: ${segment}
vh: ${vh}${vhChanged ? ' CHANGED!' : ''}
svh: ${stableVh} (stable)`;
}

// =============================================================================
// MAIN LOOP
// =============================================================================

function animate(timestamp) {
  requestAnimationFrame(animate);

  currentScrollY = window.scrollY;

  // Smooth the scroll position to reduce iOS momentum scroll jank
  // On touch devices, interpolate toward the actual scroll position
  if (IS_TOUCH_DEVICE) {
    smoothScrollY += (currentScrollY - smoothScrollY) * SCROLL_SMOOTHING;
  } else {
    smoothScrollY = currentScrollY;
  }

  // Update blurbs (opacity + sticky transform) - uses smoothScrollY internally
  for (const id of anchorOrder) {
    updateBlurb(id);
  }

  // Update canvas and animations
  updateDownArrow();
  updateCanvas();
  updateTowerBuild();
  updateTowerFrame();
  updateBottomBlockPulse(timestamp);
  updateCameraRotation();
  updateHeaderBar();

  // Render 3D
  if (renderer) {
    renderer.render(scene, camera);
  }

  updateDebug();
  updateDebugTimeline();
}

// =============================================================================
// INITIALIZATION
// =============================================================================

async function init() {
  initDOMElements();

  // Initialize display blurb references (in the fixed overlay)
  initDisplayBlurbs();

  // Wait for fonts to load before calculating anchors
  // This ensures accurate element measurements (offsetHeight, offsetTop)
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  // Wait for layout to stabilize after fonts load
  await new Promise(resolve => requestAnimationFrame(() => {
    requestAnimationFrame(resolve);
  }));

  // Calculate anchors (now with correct font metrics)
  calculateAnchors();

  // Validate anchors - retry a few times if they look wrong
  let attempts = 0;
  const maxAttempts = 5;
  while (!validateAnchors() && attempts < maxAttempts) {
    attempts++;
    console.log(`Anchor validation failed, retrying (attempt ${attempts}/${maxAttempts})...`);
    await new Promise(resolve => requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    }));
    calculateAnchors();
  }

  if (attempts >= maxAttempts) {
    console.error('Anchor validation failed after max attempts - proceeding anyway');
  }

  // Recalculate on resize
  window.addEventListener('resize', () => {
    calculateAnchors();
  });

  // Create debug timeline
  createDebugTimeline();

  // Start loading resources
  startLoadingResources();

  // Initialize scroll position for interpolation
  currentScrollY = window.scrollY;
  smoothScrollY = currentScrollY;

  // Set initial states BEFORE revealing the page
  // (otherwise elements flash with wrong opacity/position)
  for (const id of anchorOrder) {
    updateBlurb(id);
  }
  updateDownArrow();
  updateCanvas();
  updateHeaderBar();

  // Remove not-ready class
  document.body.classList.remove('not-ready');

  // Add debug-mode class if debug is enabled
  if (DEBUG_TIMELINE) {
    document.body.classList.add('debug-mode');
  }

  // Start animation loop
  requestAnimationFrame(animate);
}

init();
