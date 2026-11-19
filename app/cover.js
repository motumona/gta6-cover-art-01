/* Vice Coast Cover Studio — cover rendering engine.
 *
 * Draws a multi-panel GTA-style poster cover onto a canvas:
 * layouts, per-panel crop/zoom/pan, colour grades (gradient-map,
 * grain, vignette) and bold Anton title lettering with a Pacifico
 * script subtitle. Everything runs locally; no network access.
 */

"use strict";

/* ------------------------------------------------------------------ */
/* Layouts: panel rectangles as fractions of the canvas (x, y, w, h). */
/* ------------------------------------------------------------------ */

const COVER_LAYOUTS = {
  "hero-trio": {
    label: "Hero + 3 Panel",
    panelCount: 4,
    panels: [
      { x: 0.02, y: 0.02, w: 0.96, h: 0.52 },
      { x: 0.02, y: 0.57, w: 0.3133, h: 0.41 },
      { x: 0.3433, y: 0.57, w: 0.3133, h: 0.41 },
      { x: 0.6667, y: 0.57, w: 0.3133, h: 0.41 },
    ],
  },
  "grid-2x2": {
    label: "Grid 2 x 2",
    panelCount: 4,
    panels: [
      { x: 0.02, y: 0.02, w: 0.48, h: 0.48 },
      { x: 0.50, y: 0.02, w: 0.48, h: 0.48 },
      { x: 0.02, y: 0.50, w: 0.48, h: 0.48 },
      { x: 0.50, y: 0.50, w: 0.48, h: 0.48 },
    ],
  },
  "strip-4": {
    label: "Strip 4 Panel",
    panelCount: 4,
    panels: [
      { x: 0.02, y: 0.02, w: 0.2275, h: 0.96 },
      { x: 0.2575, y: 0.02, w: 0.2275, h: 0.96 },
      { x: 0.495, y: 0.02, w: 0.2275, h: 0.96 },
      { x: 0.7325, y: 0.02, w: 0.2275, h: 0.96 },
    ],
  },
  "fullbleed-inset": {
    label: "Full-Bleed + Inset",
    panelCount: 2,
    panels: [
      { x: 0.0, y: 0.0, w: 1.0, h: 1.0 },
      { x: 0.58, y: 0.56, w: 0.38, h: 0.34 },
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Colour grades: photo filter + overlay gradient stops.              */
/* ------------------------------------------------------------------ */

const COVER_GRADES = {
  sunset: {
    label: "Vice Sunset",
    photoFilter: "saturate(1.28) contrast(1.06) brightness(1.02)",
    overlayStops: [
      [0, "rgba(255, 122, 26, 0.16)"],
      [0.55, "rgba(255, 94, 168, 0.10)"],
      [1, "rgba(90, 20, 120, 0.22)"],
    ],
    overlayMode: "soft-light",
  },
  neon: {
    label: "Neon Night",
    photoFilter: "saturate(1.55) contrast(1.12) brightness(0.97)",
    overlayStops: [
      [0, "rgba(255, 46, 170, 0.22)"],
      [0.5, "rgba(120, 40, 200, 0.10)"],
      [1, "rgba(46, 230, 200, 0.22)"],
    ],
    overlayMode: "overlay",
  },
  golden: {
    label: "Golden Hour",
    photoFilter: "sepia(0.32) saturate(1.35) contrast(1.05)",
    overlayStops: [
      [0, "rgba(255, 190, 60, 0.18)"],
      [1, "rgba(180, 90, 10, 0.20)"],
    ],
    overlayMode: "soft-light",
  },
  noir: {
    label: "Noir",
    photoFilter: "grayscale(1) contrast(1.22) brightness(1.04)",
    overlayStops: [
      [0, "rgba(20, 30, 60, 0.20)"],
      [1, "rgba(0, 0, 0, 0.30)"],
    ],
    overlayMode: "multiply",
  },
};

/* ------------------------------------------------------------------ */
/* Default cover state.                                               */
/* ------------------------------------------------------------------ */

function createDefaultCoverState() {
  return {
    layoutId: "hero-trio",
    gradeId: "sunset",
    title: "SUNSET HEIST",
    subtitle: "Boulevard Queen",
    titleColor: "#ffffff",
    titlePosition: "bottom",
    canvasWidth: 1080,
    canvasHeight: 1080,
    panels: [
      // Hero panel favours the upper part of a photo (faces, skyline)
      // because a wide hero crop otherwise cuts them off.
      { photoIndex: 0, zoom: 1, panX: 0, panY: -0.25 },
      { photoIndex: 1, zoom: 1, panX: 0, panY: 0 },
      { photoIndex: 0, zoom: 1, panX: 0, panY: 0 },
      { photoIndex: 1, zoom: 1, panX: 0, panY: 0 },
    ],
  };
}

/* A tiny deterministic PRNG so the film grain looks the same every run. */
function createSeededRandom(seed) {
  let value = seed >>> 0;
  return function nextSeededRandom() {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Panel photo drawing: cover-fit crop with zoom + pan.                */
/* ------------------------------------------------------------------ */

function drawPanelPhoto(ctx, photo, panelRect, panelState, grade) {
  const px = panelRect.x;
  const py = panelRect.y;
  const pw = panelRect.w;
  const ph = panelRect.h;
  if (!photo || !photo.width || !photo.height) {
    ctx.fillStyle = "#241a2e";
    ctx.fillRect(px, py, pw, ph);
    return;
  }

  const panelAspect = pw / ph;
  const photoAspect = photo.width / photo.height;
  let sourceWidth;
  let sourceHeight;
  if (photoAspect > panelAspect) {
    sourceHeight = photo.height;
    sourceWidth = sourceHeight * panelAspect;
  } else {
    sourceWidth = photo.width;
    sourceHeight = sourceWidth / panelAspect;
  }
  sourceWidth /= panelState.zoom;
  sourceHeight /= panelState.zoom;

  const maxOffsetX = (photo.width - sourceWidth) / 2;
  const maxOffsetY = (photo.height - sourceHeight) / 2;
  const sourceX = (photo.width - sourceWidth) / 2 + panelState.panX * maxOffsetX;
  const sourceY = (photo.height - sourceHeight) / 2 + panelState.panY * maxOffsetY;

  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();
  ctx.filter = grade.photoFilter;
  ctx.drawImage(photo, sourceX, sourceY, sourceWidth, sourceHeight, px, py, pw, ph);
  ctx.filter = "none";

  const gradient = ctx.createLinearGradient(px, py, px + pw, py + ph);
  for (const [stop, color] of grade.overlayStops) {
    gradient.addColorStop(stop, color);
  }
  ctx.globalCompositeOperation = grade.overlayMode;
  ctx.fillStyle = gradient;
  ctx.fillRect(px, py, pw, ph);
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Film grain + vignette over the whole cover.                        */
/* ------------------------------------------------------------------ */

function applyFilmGrainAndVignette(ctx, width, height) {
  const random = createSeededRandom(20261119);
  const dotCount = Math.floor((width * height) / 900);
  ctx.save();
  for (let i = 0; i < dotCount; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const light = random() > 0.5;
    ctx.fillStyle = light ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
    ctx.fillRect(x, y, Math.max(1, width / 900), Math.max(1, width / 900));
  }
  const vignette = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.42,
    width / 2, height / 2, Math.max(width, height) * 0.75,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(10,4,20,0.42)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Title lettering: Anton uppercase with outline + shadow, Pacifico   */
/* subtitle, and a small Vice Coast badge.                            */
/* ------------------------------------------------------------------ */

function drawCoverTitleBlock(ctx, state, width, height) {
  const title = (state.title || "").trim().toUpperCase();
  const subtitle = (state.subtitle || "").trim();
  if (!title && !subtitle) return;

  const margin = width * 0.045;
  const maxTextWidth = width - margin * 2;
  let titleSize = width * 0.115;
  ctx.font = `${titleSize}px Anton, sans-serif`;
  while (title && ctx.measureText(title).width > maxTextWidth && titleSize > width * 0.04) {
    titleSize *= 0.92;
    ctx.font = `${titleSize}px Anton, sans-serif`;
  }

  const subtitleSize = Math.max(width * 0.032, 22);
  const blockHeight = titleSize * 1.05 + (subtitle ? subtitleSize * 1.5 : 0);
  let blockTop;
  if (state.titlePosition === "top") {
    blockTop = height * 0.045;
  } else if (state.titlePosition === "center") {
    blockTop = (height - blockHeight) / 2;
  } else {
    blockTop = height - blockHeight - height * 0.05;
  }

  // Soft dark band behind the lettering so it reads on any photo.
  ctx.save();
  ctx.fillStyle = "rgba(12, 5, 22, 0.42)";
  ctx.fillRect(0, blockTop - titleSize * 0.18, width, blockHeight + titleSize * 0.28);
  ctx.restore();

  const centerX = width / 2;
  const titleBaseline = blockTop + titleSize;
  if (title) {
    ctx.save();
    ctx.font = `${titleSize}px Anton, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(255, 94, 168, 0.85)";
    ctx.shadowBlur = width * 0.012;
    ctx.shadowOffsetY = width * 0.004;
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(3, titleSize * 0.09);
    ctx.strokeStyle = "#14041f";
    ctx.strokeText(title, centerX, titleBaseline);
    ctx.shadowColor = "transparent";
    ctx.fillStyle = state.titleColor || "#ffffff";
    ctx.fillText(title, centerX, titleBaseline);
    ctx.restore();
  }

  if (subtitle) {
    ctx.save();
    ctx.font = `${subtitleSize}px Pacifico, cursive`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(2, subtitleSize * 0.12);
    ctx.strokeStyle = "rgba(20, 4, 31, 0.9)";
    const subtitleBaseline = titleBaseline + subtitleSize * 1.35;
    ctx.strokeText(subtitle, centerX, subtitleBaseline);
    ctx.fillStyle = "#ffd23e";
    ctx.fillText(subtitle, centerX, subtitleBaseline);
    ctx.restore();
  }
}

function drawViceCoastBadge(ctx, width, height) {
  const badgeRadius = Math.max(26, width * 0.032);
  const badgeX = width - badgeRadius - width * 0.03;
  const badgeY = badgeRadius + height * 0.03;
  ctx.save();
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 94, 168, 0.92)";
  ctx.fill();
  ctx.lineWidth = Math.max(2, width * 0.003);
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = `${badgeRadius * 0.72}px Anton, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("VC", badgeX, badgeY + badgeRadius * 0.05);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Main entry: draw the whole cover onto any canvas.                   */
/* ------------------------------------------------------------------ */

function drawCoverOntoCanvas(canvas, state, photos) {
  const width = state.canvasWidth;
  const height = state.canvasHeight;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  // Poster paper: deep plum background with white gutters.
  ctx.fillStyle = "#14041f";
  ctx.fillRect(0, 0, width, height);

  const layout = COVER_LAYOUTS[state.layoutId] || COVER_LAYOUTS["hero-trio"];
  const grade = COVER_GRADES[state.gradeId] || COVER_GRADES.sunset;
  const panelCount = layout.panels.length;

  for (let i = 0; i < panelCount; i += 1) {
    const rectFrac = layout.panels[i];
    const panelRect = {
      x: rectFrac.x * width,
      y: rectFrac.y * height,
      w: rectFrac.w * width,
      h: rectFrac.h * height,
    };
    const panelState = state.panels[i] || { photoIndex: 0, zoom: 1, panX: 0, panY: 0 };
    const photo = photos[panelState.photoIndex] || null;
    drawPanelPhoto(ctx, photo, panelRect, panelState, grade);

    // Thin white frame around each panel, poster style.
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = Math.max(2, width * 0.004);
    ctx.strokeRect(panelRect.x, panelRect.y, panelRect.w, panelRect.h);
    ctx.restore();
  }

  applyFilmGrainAndVignette(ctx, width, height);
  drawCoverTitleBlock(ctx, state, width, height);
  drawViceCoastBadge(ctx, width, height);
  return true;
}

/* Render a fresh canvas at the requested post size and hand it back. */
function renderCoverCanvas(state, photos, exportWidth, exportHeight) {
  const exportState = { ...state, canvasWidth: exportWidth, canvasHeight: exportHeight };
  const canvas = document.createElement("canvas");
  drawCoverOntoCanvas(canvas, exportState, photos);
  return canvas;
}

/* Promise that resolves to a PNG blob for one post size. */
function exportCoverAsPngBlob(state, photos, exportWidth, exportHeight) {
  const canvas = renderCoverCanvas(state, photos, exportWidth, exportHeight);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Export PNG gagal dibuat"));
    }, "image/png");
  });
}

/* Promise that resolves to a PNG data URL (used by ?shot= captures). */
function exportCoverAsDataUrl(state, photos, exportWidth, exportHeight) {
  const canvas = renderCoverCanvas(state, photos, exportWidth, exportHeight);
  return canvas.toDataURL("image/png");
}
