/* Vice Coast Cover Studio — editor wiring.
 *
 * Connects the controls in index.html to the cover engine in cover.js:
 * photo upload (file picker + drag & drop), sample photos, per-panel
 * crop/zoom/pan, caption editing, colour grades, PNG export, and the
 * ?shot= scenes used for screenshots (?shot=cover / ?shot=editor).
 * Photos are read locally with FileReader / Image and never uploaded.
 */

"use strict";

window.__errors = [];
window.addEventListener("error", (event) => {
  window.__errors.push(String(event.message || event.error || "unknown error"));
});
window.addEventListener("unhandledrejection", (event) => {
  window.__errors.push("unhandled rejection: " + String(event.reason || "unknown"));
});

const SAMPLE_PHOTOS = [
  { id: "boulevard", label: "Boulevard", src: "samples/boulevard.jpg" },
  { id: "pier", label: "Pier", src: "samples/pier.jpg" },
];

const EXPORT_SIZES = [
  { width: 1080, height: 1080, label: "1080x1080" },
  { width: 1080, height: 1350, label: "1080x1350" },
  { width: 1920, height: 1080, label: "1920x1080" },
];

let coverState = createDefaultCoverState();
let loadedPhotos = []; // HTMLImageElement list, index = photoIndex
let selectedPanelIndex = 0;
let previewCanvas = null;
let isDraggingPanel = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartPanX = 0;
let dragStartPanY = 0;

/* ------------------------------------------------------------------ */
/* Small helpers.                                                     */
/* ------------------------------------------------------------------ */

function $(id) {
  return document.getElementById(id);
}

function setStatusMessage(text) {
  const status = $("exportStatus");
  if (status) status.textContent = text;
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Gagal memuat gambar: " + url));
    image.src = url;
  });
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      loadImageFromUrl(reader.result).then(resolve, reject);
    };
    reader.onerror = () => reject(new Error("Gagal membaca file foto"));
    reader.readAsDataURL(file);
  });
}

/* Wait until Anton + Pacifico are ready so canvas lettering is correct. */
function waitForCoverFonts() {
  const wanted = [
    document.fonts.load("64px Anton"),
    document.fonts.load("32px Pacifico"),
  ];
  return Promise.all(wanted).catch(() => undefined);
}

/* ------------------------------------------------------------------ */
/* Preview rendering.                                                 */
/* ------------------------------------------------------------------ */

function renderPreview() {
  if (!previewCanvas) return;
  drawCoverOntoCanvas(previewCanvas, coverState, loadedPhotos);
}

function renderPreviewWhenReady() {
  waitForCoverFonts().then(renderPreview);
  renderPreview();
}

/* ------------------------------------------------------------------ */
/* Photo library + panel controls.                                    */
/* ------------------------------------------------------------------ */

function refreshPanelSelectors() {
  const panelSelector = $("panelSelector");
  const photoSelector = $("panelPhotoSelector");
  if (!panelSelector || !photoSelector) return;

  const layout = COVER_LAYOUTS[coverState.layoutId];
  const panelCount = layout.panels.length;
  if (selectedPanelIndex >= panelCount) selectedPanelIndex = 0;

  panelSelector.innerHTML = "";
  for (let i = 0; i < panelCount; i += 1) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = "Panel " + (i + 1) + (i === 0 ? " (utama)" : "");
    panelSelector.appendChild(option);
  }
  panelSelector.value = String(selectedPanelIndex);

  photoSelector.innerHTML = "";
  if (loadedPhotos.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Belum ada foto — tambah foto dulu";
    photoSelector.appendChild(option);
  } else {
    loadedPhotos.forEach((photo, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = photo.dataset.photoLabel || ("Foto " + (index + 1));
      photoSelector.appendChild(option);
    });
  }
  const panelState = coverState.panels[selectedPanelIndex];
  if (panelState) photoSelector.value = String(panelState.photoIndex);

  syncPanelCropControls();
}

function syncPanelCropControls() {
  const panelState = coverState.panels[selectedPanelIndex];
  if (!panelState) return;
  const zoomSlider = $("panelZoomSlider");
  const panXSlider = $("panelPanXSlider");
  const panYSlider = $("panelPanYSlider");
  zoomSlider.value = String(Math.round(panelState.zoom * 100));
  panXSlider.value = String(Math.round(panelState.panX * 100));
  panYSlider.value = String(Math.round(panelState.panY * 100));
  $("panelZoomValue").textContent = Math.round(panelState.zoom * 100) + "%";
  $("panelPanXValue").textContent = String(Math.round(panelState.panX * 100));
  $("panelPanYValue").textContent = String(Math.round(panelState.panY * 100));
}

function addLoadedPhoto(image, label) {
  image.dataset.photoLabel = label;
  loadedPhotos.push(image);
  // Point every panel that had no photo yet at the newest photo.
  coverState.panels.forEach((panelState) => {
    if (panelState.photoIndex >= loadedPhotos.length) {
      panelState.photoIndex = loadedPhotos.length - 1;
    }
  });
  refreshPanelSelectors();
  renderPreviewWhenReady();
}

async function loadSamplePhoto(sampleId) {
  const sample = SAMPLE_PHOTOS.find((entry) => entry.id === sampleId);
  if (!sample) return false;
  const existingIndex = loadedPhotos.findIndex(
    (photo) => photo.dataset.photoLabel === sample.label,
  );
  if (existingIndex >= 0) {
    coverState.panels[selectedPanelIndex].photoIndex = existingIndex;
    refreshPanelSelectors();
    renderPreviewWhenReady();
    return true;
  }
  const image = await loadImageFromUrl(sample.src);
  addLoadedPhoto(image, sample.label);
  setStatusMessage("Foto contoh “" + sample.label + "” dimuat. Siap diedit dan diekspor.");
  return true;
}

async function handlePickedPhotoFiles(fileList) {
  const files = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
  if (files.length === 0) {
    setStatusMessage("Tidak ada file gambar yang dipilih.");
    return;
  }
  for (const file of files) {
    try {
      const image = await loadImageFromFile(file);
      addLoadedPhoto(image, file.name.replace(/\.[^.]+$/, ""));
    } catch (error) {
      setStatusMessage("Gagal memuat " + file.name + ": " + error.message);
    }
  }
  setStatusMessage(files.length + " foto ditambahkan. Foto hanya dibaca di mesin ini.");
}

/* ------------------------------------------------------------------ */
/* Export.                                                            */
/* ------------------------------------------------------------------ */

function downloadPngBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function coverFileName(width, height) {
  const slug = (coverState.title || "cover").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cover";
  return "vice-coast-" + slug + "-" + width + "x" + height + ".png";
}

async function exportOneSize(width, height) {
  const blob = await exportCoverAsPngBlob(coverState, loadedPhotos, width, height);
  downloadPngBlob(blob, coverFileName(width, height));
  return blob;
}

async function exportAllSizes() {
  if (loadedPhotos.length === 0) {
    setStatusMessage("Tambah foto dulu sebelum export.");
    return;
  }
  setStatusMessage("Mengekspor 3 ukuran PNG…");
  for (const size of EXPORT_SIZES) {
    await exportOneSize(size.width, size.height);
  }
  setStatusMessage("Selesai: 3 PNG diekspor (1080×1080, 1080×1350, 1920×1080).");
}

/* Exposed for ?shot= captures and playtesting: draw + return a PNG. */
window.__exportCoverPng = function exportCoverPngForCapture(width, height) {
  return exportCoverAsDataUrl(coverState, loadedPhotos, width, height);
};
window.__coverState = function currentCoverState() {
  return {
    layoutId: coverState.layoutId,
    gradeId: coverState.gradeId,
    title: coverState.title,
    photosLoaded: loadedPhotos.length,
    errors: window.__errors,
  };
};

/* ------------------------------------------------------------------ */
/* ?shot= scenes: full-frame cover or editor with a photo loaded.     */
/* ------------------------------------------------------------------ */

function readShotParams() {
  return new URLSearchParams(window.location.search);
}

async function applyShotParams() {
  const params = readShotParams();
  const shot = params.get("shot");
  if (!shot) return;

  const caption = params.get("caption");
  if (caption) {
    coverState.title = caption;
    const titleInput = $("coverTitleInput");
    if (titleInput) titleInput.value = caption;
  }
  const subtitle = params.get("subtitle");
  if (subtitle) {
    coverState.subtitle = subtitle;
    const subtitleInput = $("coverSubtitleInput");
    if (subtitleInput) subtitleInput.value = subtitle;
  }
  const layout = params.get("layout");
  if (layout && COVER_LAYOUTS[layout]) coverState.layoutId = layout;
  const grade = params.get("grade");
  if (grade && COVER_GRADES[grade]) coverState.gradeId = grade;

  const photo = params.get("photo");
  if (photo) await loadSamplePhoto(photo);

  if (shot === "cover") {
    // Full-frame cover: hide the editor chrome, stretch the canvas.
    document.body.classList.add("shot-cover-mode");
    const width = Number(params.get("w") || 1920);
    const height = Number(params.get("h") || 1080);
    coverState.canvasWidth = width;
    coverState.canvasHeight = height;
    const style = document.createElement("style");
    style.textContent =
      "body.shot-cover-mode{margin:0;background:#14041f;}" +
      "body.shot-cover-mode .topbar,body.shot-cover-mode .controls-column," +
      "body.shot-cover-mode .size-row,body.shot-cover-mode .drop-hint," +
      "body.shot-cover-mode .status{display:none !important;}" +
      "body.shot-cover-mode .workspace{display:block;padding:0;}" +
      "body.shot-cover-mode .preview-column{margin:0;}" +
      "body.shot-cover-mode .drop-zone{border:0;padding:0;background:none;border-radius:0;}" +
      "body.shot-cover-mode #coverPreview{max-width:none;width:100vw;height:100vh;object-fit:contain;border-radius:0;box-shadow:none;}";
    document.head.appendChild(style);
    renderPreviewWhenReady();
  }
}

/* ------------------------------------------------------------------ */
/* Editor events.                                                     */
/* ------------------------------------------------------------------ */

function bindEditorEvents() {
  const photoPicker = $("photoPicker");
  $("uploadButton").addEventListener("click", () => photoPicker.click());
  photoPicker.addEventListener("change", () => {
    handlePickedPhotoFiles(photoPicker.files);
    photoPicker.value = "";
  });

  $("sampleBoulevardButton").addEventListener("click", () => loadSamplePhoto("boulevard"));
  $("samplePierButton").addEventListener("click", () => loadSamplePhoto("pier"));

  const dropZone = $("dropZone");
  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("is-dragging");
    });
  });
  dropZone.addEventListener("drop", (event) => {
    handlePickedPhotoFiles(event.dataTransfer.files);
  });

  document.querySelectorAll("#layoutPicker .layout-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("#layoutPicker .layout-btn").forEach((other) => other.classList.remove("is-active"));
      button.classList.add("is-active");
      coverState.layoutId = button.dataset.layout;
      // Keep panel states aligned with the new layout's panel count.
      const layout = COVER_LAYOUTS[coverState.layoutId];
      while (coverState.panels.length < layout.panels.length) {
        coverState.panels.push({ photoIndex: 0, zoom: 1, panX: 0, panY: 0 });
      }
      refreshPanelSelectors();
      renderPreviewWhenReady();
    });
  });

  document.querySelectorAll("#gradePicker .grade-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("#gradePicker .grade-btn").forEach((other) => other.classList.remove("is-active"));
      button.classList.add("is-active");
      coverState.gradeId = button.dataset.grade;
      renderPreviewWhenReady();
    });
  });

  $("panelSelector").addEventListener("change", (event) => {
    selectedPanelIndex = Number(event.target.value);
    refreshPanelSelectors();
  });

  $("panelPhotoSelector").addEventListener("change", (event) => {
    const panelState = coverState.panels[selectedPanelIndex];
    if (panelState && event.target.value !== "") {
      panelState.photoIndex = Number(event.target.value);
      renderPreviewWhenReady();
    }
  });

  $("fillAllButton").addEventListener("click", () => {
    const panelState = coverState.panels[selectedPanelIndex];
    if (!panelState) return;
    coverState.panels.forEach((other) => {
      other.photoIndex = panelState.photoIndex;
    });
    renderPreviewWhenReady();
    setStatusMessage("Semua panel kini memakai foto yang sama.");
  });

  $("panelZoomSlider").addEventListener("input", (event) => {
    const panelState = coverState.panels[selectedPanelIndex];
    if (!panelState) return;
    panelState.zoom = Number(event.target.value) / 100;
    syncPanelCropControls();
    renderPreview();
  });
  $("panelPanXSlider").addEventListener("input", (event) => {
    const panelState = coverState.panels[selectedPanelIndex];
    if (!panelState) return;
    panelState.panX = Number(event.target.value) / 100;
    syncPanelCropControls();
    renderPreview();
  });
  $("panelPanYSlider").addEventListener("input", (event) => {
    const panelState = coverState.panels[selectedPanelIndex];
    if (!panelState) return;
    panelState.panY = Number(event.target.value) / 100;
    syncPanelCropControls();
    renderPreview();
  });

  $("coverTitleInput").addEventListener("input", (event) => {
    coverState.title = event.target.value;
    renderPreview();
  });
  $("coverSubtitleInput").addEventListener("input", (event) => {
    coverState.subtitle = event.target.value;
    renderPreview();
  });

  document.querySelectorAll("#titleColorPicker .swatch").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("#titleColorPicker .swatch").forEach((other) => other.classList.remove("is-active"));
      button.classList.add("is-active");
      coverState.titleColor = button.dataset.titleColor;
      renderPreviewWhenReady();
    });
  });

  $("titlePositionSelector").addEventListener("change", (event) => {
    coverState.titlePosition = event.target.value;
    renderPreviewWhenReady();
  });

  document.querySelectorAll("#canvasSizePicker .size-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("#canvasSizePicker .size-btn").forEach((other) => other.classList.remove("is-active"));
      button.classList.add("is-active");
      coverState.canvasWidth = Number(button.dataset.canvasWidth);
      coverState.canvasHeight = Number(button.dataset.canvasHeight);
      renderPreviewWhenReady();
    });
  });

  document.querySelectorAll("[data-export-width]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (loadedPhotos.length === 0) {
        setStatusMessage("Tambah foto dulu sebelum export.");
        return;
      }
      const width = Number(button.dataset.exportWidth);
      const height = Number(button.dataset.exportHeight);
      setStatusMessage("Mengekspor PNG " + width + "×" + height + "…");
      try {
        await exportOneSize(width, height);
        setStatusMessage("PNG " + width + "×" + height + " terunduh.");
      } catch (error) {
        setStatusMessage("Export gagal: " + error.message);
      }
    });
  });

  $("exportAllButton").addEventListener("click", () => {
    exportAllSizes().catch((error) => setStatusMessage("Export gagal: " + error.message));
  });

  // Drag on the preview pans the selected panel; wheel zooms it.
  previewCanvas = $("coverPreview");
  previewCanvas.addEventListener("pointerdown", (event) => {
    isDraggingPanel = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    const panelState = coverState.panels[selectedPanelIndex];
    dragStartPanX = panelState ? panelState.panX : 0;
    dragStartPanY = panelState ? panelState.panY : 0;
    previewCanvas.setPointerCapture(event.pointerId);
  });
  previewCanvas.addEventListener("pointermove", (event) => {
    if (!isDraggingPanel) return;
    const panelState = coverState.panels[selectedPanelIndex];
    if (!panelState) return;
    const rect = previewCanvas.getBoundingClientRect();
    const deltaX = (event.clientX - dragStartX) / rect.width;
    const deltaY = (event.clientY - dragStartY) / rect.height;
    panelState.panX = Math.max(-1, Math.min(1, dragStartPanX + deltaX * 2));
    panelState.panY = Math.max(-1, Math.min(1, dragStartPanY + deltaY * 2));
    syncPanelCropControls();
    renderPreview();
  });
  const endPanelDrag = () => { isDraggingPanel = false; };
  previewCanvas.addEventListener("pointerup", endPanelDrag);
  previewCanvas.addEventListener("pointercancel", endPanelDrag);
  previewCanvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const panelState = coverState.panels[selectedPanelIndex];
    if (!panelState) return;
    const step = event.deltaY < 0 ? 0.08 : -0.08;
    panelState.zoom = Math.max(1, Math.min(3, panelState.zoom + step));
    syncPanelCropControls();
    renderPreview();
  }, { passive: false });
}

/* ------------------------------------------------------------------ */
/* Boot.                                                              */
/* ------------------------------------------------------------------ */

function bootViceCoastStudio() {
  previewCanvas = $("coverPreview");
  bindEditorEvents();
  refreshPanelSelectors();
  renderPreviewWhenReady();
  applyShotParams().then(renderPreviewWhenReady);
}

document.addEventListener("DOMContentLoaded", bootViceCoastStudio);
