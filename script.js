const qrWrapper = document.getElementById("qrcode-wrapper");
const decodedTextEl = document.getElementById("decoded-text");
const formatInfoEl = document.getElementById("format-info");
const statusBadge = document.getElementById("status-badge");
const scannerInput = document.getElementById("scanner-input");
const installBtn = document.getElementById("install-btn");
const flashBtn = document.getElementById("flash-btn");
const flashStatus = document.getElementById("flash-status");
const zoomBox = document.getElementById("zoom-box");
const zoomSlider = document.getElementById("zoom-slider");
const zoomValue = document.getElementById("zoom-value");
const scannerViewport = document.getElementById("scanner-viewport");
const docDetectCanvas = document.getElementById("doc-detect-canvas");
const scanGuide = document.getElementById("scan-guide");
const scanInstruction = document.getElementById("scan-instruction");
const autoZoomBadge = document.getElementById("auto-zoom-badge");
const zoomToggleBtn = document.getElementById("zoom-toggle-btn");
const autoZoomBtn = document.getElementById("auto-zoom-btn");
const keyboardToggleBtn = document.getElementById("keyboard-toggle-btn");
const manualPanel = document.getElementById("manual-panel");
const manualSubmitBtn = document.getElementById("manual-submit-btn");
const photoShutterBtn = document.getElementById("photo-shutter-btn");
const galleryPhotoBtn = document.getElementById("gallery-photo-btn");
const photoCaptureInput = document.getElementById("photo-capture-input");
const photoGalleryInput = document.getElementById("photo-gallery-input");
const photoLensOverlay = document.getElementById("photo-lens-overlay");
const photoLensStage = document.getElementById("photo-lens-stage");
const capturedPhotoPreview = document.getElementById("captured-photo-preview");
const photoOcrLayer = document.getElementById("photo-ocr-layer");
const photoLensActionBar = document.getElementById("photo-lens-action-bar");
const lensCreateQrBtn = document.getElementById("lens-create-qr-btn");
const photoLensStatus = document.getElementById("photo-lens-status");
const sheetBackdrop = document.getElementById("scan-sheet-backdrop");
const scanResultSheet = document.getElementById("scan-result-sheet");
const sheetDragHandle = document.getElementById("sheet-drag-handle");
const sheetScannedCount = document.getElementById("sheet-scanned-count");
const sheetBarcodeValue = document.getElementById("sheet-barcode-value");
const sheetFormatValue = document.getElementById("sheet-format-value");
const sheetExcelColRow = document.getElementById("sheet-excel-col-row");
const sheetExcelColValue = document.getElementById("sheet-excel-col-value");
const sheetCopyBtn = document.getElementById("sheet-copy-btn");
const fullscreenQrModal = document.getElementById("fullscreen-qr-modal");

// Elemen Notes Hasil Scan (Menu 1D to QR)
const qrScanNotesPanel = document.getElementById("qr-scan-notes-panel");
const qrNotesCount = document.getElementById("qr-notes-count");
const qrCopyAllBtn = document.getElementById("qr-copy-all-btn");
const qrCopySelectedBtn = document.getElementById("qr-copy-selected-btn");
const qrClearNotesBtn = document.getElementById("qr-clear-notes-btn");
const qrNotesFeedback = document.getElementById("qr-notes-feedback");
const qrNotesList = document.getElementById("qr-notes-list");

// Elemen Preview Excel Modal
const excelPreviewModal = document.getElementById("excel-preview-modal");
const excelPreviewTitle = document.getElementById("excel-preview-title");
const excelPreviewSubtitle = document.getElementById("excel-preview-subtitle");
const excelPreviewThead = document.getElementById("excel-preview-thead");
const excelPreviewTbody = document.getElementById("excel-preview-tbody");
const excelPreviewDownloadBtn = document.getElementById("excel-preview-download-btn");

// Elemen Header, Menu Utama & Hub Scan to Excel
const appHeaderTitle = document.getElementById("app-header-title");
const appHeaderSubtitle = document.getElementById("app-header-subtitle");
const homeMenuView = document.getElementById("home-menu-view");
const excelTaskHubView = document.getElementById("excel-task-hub-view");
const excelRunningCount = document.getElementById("excel-running-count");
const excelRunningTasksList = document.getElementById("excel-running-tasks-list");
const excelNewTaskView = document.getElementById("excel-new-task-view");
const newExcelTaskNameInput = document.getElementById("new-excel-task-name");
const newExcelColCountInput = document.getElementById("new-excel-col-count");
const newExcelColNamesList = document.getElementById("new-excel-col-names-list");
const newExcelSeqWrapper = document.getElementById("new-excel-seq-wrapper");
const newExcelSeqCheckbox = document.getElementById("new-excel-seq-checkbox");
const newExcelSeqHint = document.getElementById("new-excel-seq-hint");
const scannerCard = document.getElementById("scanner-card");
const scanTopOverlay = document.getElementById("scan-top-overlay");
const excelScanToast = document.getElementById("excel-scan-toast");
const excelSessionPanel = document.getElementById("excel-session-panel");
const excelActiveTaskName = document.getElementById("excel-active-task-name");
const excelRowCount = document.getElementById("excel-row-count");
const excelDownloadBtn = document.getElementById("excel-download-btn");
const excelTargetColBar = document.getElementById("excel-target-col-bar");
const excelRowsThead = document.getElementById("excel-rows-thead");
const excelRowsTbody = document.getElementById("excel-rows-tbody");

const EXCEL_TASKS_STORAGE_KEY = "scan2qr_excel_tasks_v2";

let activeAppFeature = "menu"; // "menu" | "1d-to-qr" | "scan-to-excel" | "text-to-qr"
let currentRoute = "menu";
let isHandlingPopState = false;
let ignoreNextSheetPopState = false;
let ignorePopStateCount = 0;
let isSheetHistoryPushed = false;
let excelTasks = [];
let activeExcelTaskId = null;
let previewingExcelTaskId = null;
let pendingScanData = null; // { text, format }
let excelToastTimer = null;

// Sub-mode Foto Text-to-QR di dalam menu Scan to Excel
let isExcelTextPhotoMode = false;
let excelPhotoHistoryDepth = 0;

// State Auto-Detect & Auto-Crop Dokumen Ala CamScanner
let docDetectTimer = null;
let lastDetectedDocQuad = null;
let smoothedDocQuad = null;
let docDetectMissCount = 0;

// State Notes Hasil Scan untuk 1D to QR
let qrScanNotes = []; // [{ id, text, checked }]
let qrNotesFeedbackTimer = null;

let lastScanned = "";
let deferredPrompt = null;
let isFlashOn = false;
let isFlashSupported = false;
let isCameraRunning = false;
let isCameraStarting = false;
let isScanLocked = false;
let audioCtx = null;
let autoFocusTimer = null;
let isFocusSupported = false;
let currentZoom = 1;
let minZoomSupported = 1;
let maxZoomSupported = 5;
let isZoomSupported = false;
let currentScanMode = "full";
let isAutoZoomEnabled = false;
let autoZoomTimer = null;
let autoZoomDirection = 1;
let scannedItemsCount = 0;
let sheetStartY = 0;
let sheetCurrentDeltaY = 0;
let isSheetDragging = false;
let scanCandidateHistory = new Map();
let isZoomSliderBound = false;
let ocrRunToken = 0;
let ocrWordItems = [];
let selectedOcrIndices = [];
let ocrNaturalWidth = 0;
let ocrNaturalHeight = 0;
let isOcrDragging = false;
let ocrDragStartIdx = -1;
let ocrDragStartPoint = null;
let ocrDragMoved = false;
let nativeLiveScanTimer = null;
let isNativeLiveScanBusy = false;
let fileDecodeScanner = null;
let sharedTesseractWorkerPromise = null;

// 1. Pasang Web App Manifest secara dinamis dengan logo lokal
const logoUrl = new URL("./logo.png", window.location.href).href;

const manifestData = {
  name: "Scan Barcode ke QR Code",
  short_name: "Scan2QR",
  description: "Scan barcode 1D/2D dan otomatis tampilkan QR Code",
  start_url: "./",
  scope: "./",
  display: "standalone",
  background_color: "#f4f6f9",
  theme_color: "#0f62fe",
  icons: [
    {
      src: logoUrl,
      sizes: "512x512",
      type: "image/png",
      purpose: "any maskable"
    }
  ]
};

const manifestBlob = new Blob([JSON.stringify(manifestData)], {
  type: "application/manifest+json"
});
document.getElementById("pwa-manifest").href = URL.createObjectURL(manifestBlob);

// 2. Tangkap event instalasi PWA (Android / Chrome / Edge)
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = "inline-block";
});

async function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.style.display = "none";
}

window.addEventListener("appinstalled", () => {
  installBtn.style.display = "none";
});

// 3. Registrasi Service Worker ringan
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const swCode = `
      self.addEventListener("install", () => self.skipWaiting());
      self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
      self.addEventListener("fetch", (event) => {
        event.respondWith(
          fetch(event.request).catch(() => caches.match(event.request))
        );
      });
    `;
    const swBlob = new Blob([swCode], { type: "application/javascript" });
    const swUrl = URL.createObjectURL(swBlob);
    navigator.serviceWorker.register(swUrl).catch(() => {});
  });
}

// 4. Penyimpanan Task Scan to Excel di LocalStorage
function loadExcelTasksFromStorage() {
  try {
    const raw = localStorage.getItem(EXCEL_TASKS_STORAGE_KEY);
    if (!raw) {
      excelTasks = [];
      return;
    }
    const parsed = JSON.parse(raw);
    excelTasks = Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    excelTasks = [];
  }
}

function saveExcelTasksToStorage() {
  try {
    localStorage.setItem(EXCEL_TASKS_STORAGE_KEY, JSON.stringify(excelTasks));
  } catch (err) {}
}

function getActiveExcelTask() {
  if (!activeExcelTaskId) return null;
  return excelTasks.find((t) => t.id === activeExcelTaskId) || null;
}

loadExcelTasksFromStorage();

// 5. Navigasi Berbasis Tombol Back HP (History API + Popstate)
function pushAppHistoryState(routeName) {
  currentRoute = routeName;
  if (isHandlingPopState) return;
  try {
    window.history.pushState({ appRoute: routeName }, "");
  } catch (err) {}
}

function replaceAppHistoryState(routeName) {
  currentRoute = routeName;
  try {
    window.history.replaceState({ appRoute: routeName }, "");
  } catch (err) {}
}

try {
  window.history.replaceState({ appRoute: "menu" }, "");
} catch (err) {}

window.addEventListener("popstate", () => {
  if (ignorePopStateCount > 0) {
    ignorePopStateCount -= 1;
    return;
  }
  if (ignoreNextSheetPopState) {
    ignoreNextSheetPopState = false;
    return;
  }

  isHandlingPopState = true;
  try {
    if (excelPreviewModal && excelPreviewModal.classList.contains("open")) {
      closeExcelTaskPreview(true);
      return;
    }
    if (fullscreenQrModal && fullscreenQrModal.classList.contains("open")) {
      resetScan(true);
      return;
    }
    if (scanResultSheet && scanResultSheet.classList.contains("open")) {
      dismissScanSheet(true);
      return;
    }
    if (photoLensOverlay && photoLensOverlay.classList.contains("open")) {
      closePhotoLensPanel(true);
      return;
    }
    if (activeAppFeature === "scan-to-excel" && isExcelTextPhotoMode) {
      exitExcelTextPhotoMode(true);
      return;
    }

    if (currentRoute === "scan-to-excel-scan" || (activeAppFeature === "scan-to-excel" && activeExcelTaskId)) {
      openExcelTaskHubView(true);
    } else if (currentRoute === "scan-to-excel-new") {
      openExcelTaskHubView(true);
    } else if (
      currentRoute === "scan-to-excel-hub" ||
      currentRoute === "1d-to-qr" ||
      currentRoute === "text-to-qr"
    ) {
      backToMainMenu(true);
    }
  } finally {
    isHandlingPopState = false;
  }
});

function navigateBackOneStep() {
  if (currentRoute === "scan-to-excel-scan" || currentRoute === "scan-to-excel-new") {
    openExcelTaskHubView(true);
    replaceAppHistoryState("scan-to-excel-hub");
    return;
  }
  if (window.history.length > 1 && currentRoute !== "menu") {
    window.history.back();
  } else {
    backToMainMenu(true);
  }
}

function hideAllMainSections() {
  if (homeMenuView) homeMenuView.style.display = "none";
  if (excelTaskHubView) excelTaskHubView.style.display = "none";
  if (excelNewTaskView) excelNewTaskView.style.display = "none";
  if (scannerCard) {
    scannerCard.style.display = "none";
    scannerCard.classList.remove("excel-mode", "notes-mode");
  }
  if (qrScanNotesPanel) qrScanNotesPanel.style.display = "none";
  if (excelSessionPanel) excelSessionPanel.style.display = "none";
}

function resetTransientScannerUI() {
  stopDocumentBoundaryDetector();
  isExcelTextPhotoMode = false;
  excelPhotoHistoryDepth = 0;
  closeExcelPreviewModalOnly();
  closeFullscreenQrModal();
  closeScanSheetOnly();
  isSheetHistoryPushed = false;
  ocrRunToken += 1;
  clearPhotoLensState();
  if (photoLensOverlay) photoLensOverlay.classList.remove("open");
  if (photoShutterBtn) photoShutterBtn.classList.remove("active");
  if (zoomBox) zoomBox.classList.remove("open");
  if (zoomToggleBtn) zoomToggleBtn.classList.remove("active");
  if (manualPanel) manualPanel.classList.remove("open");
  if (keyboardToggleBtn) keyboardToggleBtn.classList.remove("active");
  isScanLocked = false;
  lastScanned = "";
  pendingScanData = null;
  resetCandidateScan();
}

function isTextPhotoCameraActive() {
  return (
    activeAppFeature === "text-to-qr" ||
    (activeAppFeature === "scan-to-excel" && isExcelTextPhotoMode)
  );
}

function openFeatureMenu(feature) {
  const validFeatures = ["1d-to-qr", "scan-to-excel", "text-to-qr"];
  if (!validFeatures.includes(feature)) return;

  activeAppFeature = feature;
  resetTransientScannerUI();

  if (feature === "scan-to-excel") {
    openExcelTaskHubView(false);
    return;
  }

  hideAllMainSections();
  if (scannerCard) {
    scannerCard.style.display = "flex";
  }

  if (feature === "1d-to-qr") {
    if (appHeaderTitle) appHeaderTitle.textContent = "1D to QR";
    if (appHeaderSubtitle) appHeaderSubtitle.textContent = "Semua Barcode 1D/2D atau scanner fisik";
    if (scanTopOverlay) scanTopOverlay.style.display = "";
    if (scanGuide) scanGuide.style.display = "";
    if (zoomToggleBtn) zoomToggleBtn.style.display = "inline-flex";
    if (photoShutterBtn) photoShutterBtn.style.display = "none";
    if (galleryPhotoBtn) galleryPhotoBtn.style.display = "none";
    if (keyboardToggleBtn) keyboardToggleBtn.style.display = "inline-flex";
    if (manualSubmitBtn) manualSubmitBtn.textContent = "Buat QR";
    if (lensCreateQrBtn) lensCreateQrBtn.textContent = "Buat Barkode";
    if (scannerCard) scannerCard.classList.add("notes-mode");
    if (qrScanNotesPanel) qrScanNotesPanel.style.display = "flex";
    renderQrScanNotes();
    setScanMode(currentScanMode || "full");
    pushAppHistoryState("1d-to-qr");
  } else if (feature === "text-to-qr") {
    if (appHeaderTitle) appHeaderTitle.textContent = "Text to QR";
    if (appHeaderSubtitle) appHeaderSubtitle.textContent = "Foto teks/SN lalu pilih blok menjadi QR";
    if (scanTopOverlay) scanTopOverlay.style.display = "none";
    if (scanGuide) scanGuide.style.display = "none";
    if (zoomToggleBtn) zoomToggleBtn.style.display = "none";
    if (zoomBox) zoomBox.classList.remove("open");
    if (photoShutterBtn) photoShutterBtn.style.display = "inline-flex";
    if (galleryPhotoBtn) galleryPhotoBtn.style.display = "inline-flex";
    if (keyboardToggleBtn) keyboardToggleBtn.style.display = "none";
    if (manualPanel) manualPanel.classList.remove("open");
    if (lensCreateQrBtn) lensCreateQrBtn.textContent = "Buat Barkode";
    if (scannerViewport) {
      scannerViewport.classList.remove("mode-square", "mode-bar");
      scannerViewport.classList.add("mode-full");
    }
    pushAppHistoryState("text-to-qr");
    startDocumentBoundaryDetector();
  }

  ensureCameraStarted();
}

function enterExcelTextPhotoMode() {
  if (activeAppFeature !== "scan-to-excel" || isExcelTextPhotoMode) return;
  isExcelTextPhotoMode = true;
  resetCandidateScan();

  if (scanTopOverlay) scanTopOverlay.style.display = "none";
  if (scanGuide) scanGuide.style.display = "none";
  if (zoomToggleBtn) zoomToggleBtn.style.display = "none";
  if (zoomBox) zoomBox.classList.remove("open");
  if (zoomToggleBtn) zoomToggleBtn.classList.remove("active");
  if (keyboardToggleBtn) keyboardToggleBtn.style.display = "none";
  if (manualPanel) manualPanel.classList.remove("open");
  if (keyboardToggleBtn) keyboardToggleBtn.classList.remove("active");
  if (galleryPhotoBtn) galleryPhotoBtn.style.display = "inline-flex";
  if (lensCreateQrBtn) lensCreateQrBtn.textContent = "Salin ke Excel";

  if (scannerViewport) {
    scannerViewport.classList.remove("mode-square", "mode-bar");
    scannerViewport.classList.add("mode-full");
  }

  const task = getActiveExcelTask();
  if (appHeaderSubtitle && task) {
    appHeaderSubtitle.textContent = "Arahkan ke teks/dokumen lalu tekan tombol foto";
  }

  excelPhotoHistoryDepth = 1;
  pushAppHistoryState("scan-to-excel-scan:text-mode");
  startDocumentBoundaryDetector();
}

function exitExcelTextPhotoMode(fromBack = false) {
  if (!isExcelTextPhotoMode) return;
  if (!fromBack && excelPhotoHistoryDepth > 0 && window.history.length > 1) {
    window.history.back();
    return;
  }

  stopDocumentBoundaryDetector();
  isExcelTextPhotoMode = false;
  excelPhotoHistoryDepth = 0;

  if (scanTopOverlay) scanTopOverlay.style.display = "";
  if (scanGuide) scanGuide.style.display = "";
  if (zoomToggleBtn) zoomToggleBtn.style.display = "inline-flex";
  if (keyboardToggleBtn) keyboardToggleBtn.style.display = "inline-flex";
  if (galleryPhotoBtn) galleryPhotoBtn.style.display = "none";
  if (lensCreateQrBtn) lensCreateQrBtn.textContent = "Pilih Kode";

  const task = getActiveExcelTask();
  if (appHeaderSubtitle && task) {
    appHeaderSubtitle.textContent = task.sequentialColumns
      ? `Input Kolom berurutan (${task.columns.length} kolom)`
      : `${task.columns.length} kolom Excel`;
  }

  setScanMode(currentScanMode || "full");
  currentRoute = "scan-to-excel-scan";
  if (!isScanLocked) {
    resumeCameraForNextScan();
  }
}

async function openExcelTaskHubView(fromBack = false) {
  activeAppFeature = "scan-to-excel";
  activeExcelTaskId = null;
  resetTransientScannerUI();
  hideAllMainSections();

  if (appHeaderTitle) appHeaderTitle.textContent = "Scan to Excel";
  if (appHeaderSubtitle) appHeaderSubtitle.textContent = "Buat task baru atau lanjutkan task berjalan";
  if (excelTaskHubView) excelTaskHubView.style.display = "flex";

  renderExcelRunningTasksList();
  if (!fromBack) {
    pushAppHistoryState("scan-to-excel-hub");
  } else {
    currentRoute = "scan-to-excel-hub";
  }

  await stopCameraGracefully();
}

function openNewExcelTaskForm() {
  activeAppFeature = "scan-to-excel";
  resetTransientScannerUI();
  hideAllMainSections();

  if (appHeaderTitle) appHeaderTitle.textContent = "New Excel";
  if (appHeaderSubtitle) appHeaderSubtitle.textContent = "Atur jumlah dan nama kolom Excel baru";
  if (excelNewTaskView) excelNewTaskView.style.display = "flex";

  const now = new Date();
  const defaultTitle = `Excel_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

  if (newExcelTaskNameInput) {
    newExcelTaskNameInput.value = defaultTitle;
  }
  if (newExcelColCountInput) {
    newExcelColCountInput.value = "1";
  }
  renderNewExcelColumnInputs(1);
  pushAppHistoryState("scan-to-excel-new");
}

function adjustNewExcelColumnCount(delta) {
  if (!newExcelColCountInput) return;
  const current = parseInt(newExcelColCountInput.value, 10) || 1;
  const next = Math.max(1, Math.min(20, current + delta));
  newExcelColCountInput.value = String(next);
  renderNewExcelColumnInputs(next);
}

function handleNewExcelColumnCountInput() {
  if (!newExcelColCountInput) return;
  let val = parseInt(newExcelColCountInput.value, 10);
  if (isNaN(val) || val < 1) val = 1;
  if (val > 20) val = 20;
  renderNewExcelColumnInputs(val);
}

function renderNewExcelColumnInputs(count) {
  if (!newExcelColNamesList) return;
  const existingInputs = newExcelColNamesList.querySelectorAll("input[data-col-idx]");
  const savedNames = {};
  existingInputs.forEach((inp) => {
    savedNames[Number(inp.getAttribute("data-col-idx"))] = inp.value;
  });

  let html = "";
  for (let i = 0; i < count; i += 1) {
    const val = savedNames[i] !== undefined ? savedNames[i] : `Kolom ${i + 1}`;
    html += `<div class="col-name-item">
      <span class="col-name-badge">Kolom ${i + 1}</span>
      <input type="text" data-col-idx="${i}" value="${escapeHtmlSafe(val)}" placeholder="Nama Kolom ${i + 1}" autocomplete="off" />
    </div>`;
  }
  newExcelColNamesList.innerHTML = html;

  const isMultiColumn = count > 1;
  if (newExcelSeqWrapper && newExcelSeqCheckbox) {
    newExcelSeqWrapper.classList.toggle("disabled", !isMultiColumn);
    newExcelSeqCheckbox.disabled = !isMultiColumn;
    if (!isMultiColumn) {
      newExcelSeqCheckbox.checked = false;
    } else if (!newExcelSeqCheckbox.dataset.userToggled) {
      newExcelSeqCheckbox.checked = true;
    }
  }
}

if (newExcelSeqCheckbox) {
  newExcelSeqCheckbox.addEventListener("change", () => {
    newExcelSeqCheckbox.dataset.userToggled = "1";
  });
}

function createAndStartExcelTask() {
  const rawTaskName = newExcelTaskNameInput ? newExcelTaskNameInput.value.trim() : "";
  const taskName = rawTaskName || `Excel_${Date.now()}`;
  const count = Math.max(1, Math.min(20, parseInt(newExcelColCountInput ? newExcelColCountInput.value : "1", 10) || 1));

  const colInputs = newExcelColNamesList ? newExcelColNamesList.querySelectorAll("input[data-col-idx]") : [];
  const columns = [];
  for (let i = 0; i < count; i += 1) {
    const inp = colInputs[i];
    const colLabel = inp && inp.value.trim() ? inp.value.trim() : `Kolom ${i + 1}`;
    columns.push(colLabel);
  }

  const sequentialColumns = count > 1 && Boolean(newExcelSeqCheckbox && newExcelSeqCheckbox.checked);

  const newTask = {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: taskName,
    columns,
    sequentialColumns,
    rows: [],
    activeColIndex: 0,
    status: "running",
    createdAt: new Date().toISOString()
  };

  excelTasks.unshift(newTask);
  saveExcelTasksToStorage();
  openExcelTaskScanner(newTask.id, true);
}

function openExcelTaskScanner(taskId, replaceFromForm = false) {
  const task = excelTasks.find((t) => t.id === taskId);
  if (!task) return;

  task.status = "running";
  saveExcelTasksToStorage();

  activeAppFeature = "scan-to-excel";
  activeExcelTaskId = task.id;
  resetTransientScannerUI();
  hideAllMainSections();

  if (appHeaderTitle) appHeaderTitle.textContent = task.name;
  if (appHeaderSubtitle) {
    const modeDesc = task.sequentialColumns
      ? `Input Kolom berurutan (${task.columns.length} kolom)`
      : `${task.columns.length} kolom Excel`;
    appHeaderSubtitle.textContent = modeDesc;
  }

  if (scannerCard) {
    scannerCard.style.display = "flex";
    scannerCard.classList.add("excel-mode");
  }
  if (scanTopOverlay) scanTopOverlay.style.display = "";
  if (scanGuide) scanGuide.style.display = "";
  if (zoomToggleBtn) zoomToggleBtn.style.display = "inline-flex";
  if (photoShutterBtn) photoShutterBtn.style.display = "inline-flex";
  if (keyboardToggleBtn) keyboardToggleBtn.style.display = "inline-flex";
  if (excelSessionPanel) excelSessionPanel.style.display = "flex";
  if (galleryPhotoBtn) galleryPhotoBtn.style.display = "none";
  if (manualSubmitBtn) manualSubmitBtn.textContent = "Scan Manual";
  if (lensCreateQrBtn) lensCreateQrBtn.textContent = "Salin ke Excel";

  setScanMode(currentScanMode || "full");
  renderExcelSessionTable();

  if (replaceFromForm) {
    replaceAppHistoryState("scan-to-excel-scan");
  } else {
    pushAppHistoryState("scan-to-excel-scan");
  }

  ensureCameraStarted();
}

function endExcelTaskById(taskId) {
  excelTasks = excelTasks.filter((t) => t.id !== taskId);
  saveExcelTasksToStorage();
  renderExcelRunningTasksList();
}

function deleteExcelTaskById(taskId) {
  endExcelTaskById(taskId);
}

function markCurrentExcelTaskCompleted() {
  const task = getActiveExcelTask();
  if (task) {
    task.status = "running";
    saveExcelTasksToStorage();
  }
  openExcelTaskHubView(true);
  replaceAppHistoryState("scan-to-excel-hub");
}

function renderExcelRunningTasksList() {
  const runningTasks = excelTasks.filter((t) => t.status !== "ended");
  if (excelRunningCount) {
    excelRunningCount.textContent = `${runningTasks.length} task`;
  }
  if (!excelRunningTasksList) return;

  if (runningTasks.length === 0) {
    excelRunningTasksList.innerHTML =
      '<div class="excel-running-empty">Belum ada task berjalan. Tekan <strong>+ New Task</strong> untuk membuat Excel baru.</div>';
    return;
  }

  excelRunningTasksList.innerHTML = runningTasks
    .map((task) => {
      const colNamesPreview = task.columns.join(", ");
      const nextColName = task.columns[task.activeColIndex] || task.columns[0] || "Kolom 1";
      const seqBadge = task.sequentialColumns ? ` • Urut: ${escapeHtmlSafe(nextColName)}` : "";
      const hasRows = Array.isArray(task.rows) && task.rows.length > 0;
      return `<div class="excel-task-card">
        <div class="excel-task-card-info">
          <div class="excel-task-card-title">${escapeHtmlSafe(task.name)}</div>
          <div class="excel-task-card-meta">${task.columns.length} Kolom (${escapeHtmlSafe(colNamesPreview)}) • ${task.rows.length} baris${seqBadge}</div>
        </div>
        <div class="excel-task-card-actions">
          <button type="button" class="excel-task-open-btn" onclick="openExcelTaskScanner('${escapeHtmlSafe(task.id)}')">Lanjutkan</button>
          <button type="button" class="excel-task-preview-btn" onclick="openExcelTaskPreview('${escapeHtmlSafe(task.id)}')">Preview</button>
          <button type="button" class="excel-task-download-btn" onclick="exportExcelTaskById('${escapeHtmlSafe(task.id)}')" ${hasRows ? "" : "disabled"}>Download</button>
          <button type="button" class="excel-task-del-btn" onclick="endExcelTaskById('${escapeHtmlSafe(task.id)}')">End Task</button>
        </div>
      </div>`;
    })
    .join("");
}

function openExcelTaskPreview(taskId) {
  const task = excelTasks.find((t) => t.id === taskId);
  if (!task || !excelPreviewModal) return;

  previewingExcelTaskId = task.id;
  if (excelPreviewTitle) {
    excelPreviewTitle.textContent = task.name;
  }
  if (excelPreviewSubtitle) {
    excelPreviewSubtitle.textContent = `${task.columns.length} Kolom • ${task.rows.length} baris`;
  }
  if (excelPreviewDownloadBtn) {
    excelPreviewDownloadBtn.disabled = task.rows.length === 0;
  }

  if (excelPreviewThead) {
    const thCols = task.columns.map((c) => `<th>${escapeHtmlSafe(c)}</th>`).join("");
    excelPreviewThead.innerHTML = `<tr><th>No</th>${thCols}</tr>`;
  }

  if (excelPreviewTbody) {
    if (!Array.isArray(task.rows) || task.rows.length === 0) {
      excelPreviewTbody.innerHTML = `<tr><td colspan="${task.columns.length + 1}" style="text-align:center; color:#64748b; padding:24px 12px;">Belum ada data hasil scan pada task ini.</td></tr>`;
    } else {
      excelPreviewTbody.innerHTML = task.rows
        .map((rowArr, idx) => {
          const tds = task.columns
            .map((_, cIdx) => {
              const val = rowArr[cIdx] || "";
              return `<td>${val ? escapeHtmlSafe(val) : '<span style="color:#94a3b8;">-</span>'}</td>`;
            })
            .join("");
          return `<tr><td>${idx + 1}</td>${tds}</tr>`;
        })
        .join("");
    }
  }

  const wasOpen = excelPreviewModal.classList.contains("open");
  excelPreviewModal.classList.add("open");
  excelPreviewModal.setAttribute("aria-hidden", "false");
  if (!wasOpen) {
    pushAppHistoryState("scan-to-excel-hub:preview");
  }
}

function closeExcelPreviewModalOnly() {
  previewingExcelTaskId = null;
  if (excelPreviewModal) {
    excelPreviewModal.classList.remove("open");
    excelPreviewModal.setAttribute("aria-hidden", "true");
  }
}

function closeExcelTaskPreview(fromBack = false) {
  if (!fromBack && excelPreviewModal && excelPreviewModal.classList.contains("open")) {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
  }
  closeExcelPreviewModalOnly();
  currentRoute = "scan-to-excel-hub";
}

function downloadPreviewedExcelTask() {
  if (!previewingExcelTaskId) return;
  exportExcelTaskById(previewingExcelTaskId);
}

async function backToMainMenu(fromBack = false) {
  activeAppFeature = "menu";
  activeExcelTaskId = null;
  resetTransientScannerUI();
  hideAllMainSections();

  if (homeMenuView) {
    homeMenuView.style.display = "flex";
  }
  if (appHeaderTitle) {
    appHeaderTitle.textContent = "Scan Barcode → QR Code";
  }
  if (appHeaderSubtitle) {
    appHeaderSubtitle.textContent = "Pilih fitur pemindaian di bawah";
  }

  if (!fromBack) {
    pushAppHistoryState("menu");
  } else {
    currentRoute = "menu";
  }

  await stopCameraGracefully();
}

// 6. Getar & bunyi beep singkat saat scan berhasil
function triggerScanFeedback() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(140);
    }
  } catch (e) {}

  playBeep();
}

function playBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioCtx) {
      audioCtx = new AudioCtx();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.14, audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.14);
  } catch (e) {}
}

function resetCandidateScan() {
  scanCandidateHistory.clear();
}

function pauseCameraForSingleScan() {
  if (!isCameraRunning) return;
  try {
    if (typeof html5QrCode.pause === "function") {
      html5QrCode.pause(true);
    }
  } catch (err) {}
}

function resumeCameraForNextScan() {
  if (!isCameraRunning) return;
  resetCandidateScan();
  try {
    if (typeof html5QrCode.resume === "function") {
      html5QrCode.resume();
    }
    triggerAutoFocus(false);
  } catch (err) {}
}

// Pengaturan Mode Scan (Full, Square, Bar)
function setScanMode(mode) {
  const validModes = ["full", "square", "bar"];
  if (!validModes.includes(mode)) return;
  currentScanMode = mode;
  resetCandidateScan();

  if (scannerViewport) {
    scannerViewport.classList.remove("mode-full", "mode-square", "mode-bar");
    scannerViewport.classList.add(`mode-${mode}`);
  }

  const tabs = document.querySelectorAll(".mode-tab");
  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.getAttribute("data-mode") === mode);
  });

  if (scanInstruction) {
    scanInstruction.textContent = "";
  }

  triggerAutoFocus(true);
}

function toggleZoomPanel() {
  if (!zoomBox || !zoomToggleBtn) return;
  const isOpen = zoomBox.classList.toggle("open");
  zoomToggleBtn.classList.toggle("active", isOpen);
}

function toggleManualPanel() {
  if (!manualPanel || !keyboardToggleBtn) return;
  const isOpen = manualPanel.classList.toggle("open");
  keyboardToggleBtn.classList.toggle("active", isOpen);
  if (isOpen && scannerInput) {
    scannerInput.focus();
  }
}

// 6B. Engine Auto-Detect & Auto-Crop Dokumen Presisi Ala CamScanner
function orderQuadCorners(pts) {
  if (!Array.isArray(pts) || pts.length !== 4) return null;
  const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
  const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;

  const sortedByAngle = [...pts].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx)
  );

  // Dalam koordinat layar (y ke bawah), atan2 urutan sudut adalah: TL (-3pi/4), TR (-pi/4), BR (+pi/4), BL (+3pi/4)
  let tlIdx = 0;
  let minSum = Infinity;
  sortedByAngle.forEach((p, idx) => {
    const s = p.x + p.y;
    if (s < minSum) {
      minSum = s;
      tlIdx = idx;
    }
  });

  return [
    sortedByAngle[tlIdx],
    sortedByAngle[(tlIdx + 1) % 4],
    sortedByAngle[(tlIdx + 2) % 4],
    sortedByAngle[(tlIdx + 3) % 4]
  ];
}

function computeOtsuLuminanceThreshold(lum, w, h) {
  const hist = new Uint32Array(256);
  const x0 = Math.floor(w * 0.05);
  const x1 = Math.ceil(w * 0.95);
  const y0 = Math.floor(h * 0.05);
  const y1 = Math.ceil(h * 0.95);
  let total = 0;

  for (let y = y0; y < y1; y += 1) {
    const rOff = y * w;
    for (let x = x0; x < x1; x += 1) {
      hist[lum[rOff + x]] += 1;
      total += 1;
    }
  }
  if (total === 0) return 145;

  let sumAll = 0;
  for (let i = 0; i < 256; i += 1) {
    sumAll += i * hist[i];
  }

  let sumB = 0;
  let wB = 0;
  let maxVar = -1;
  let threshold = 145;

  for (let t = 0; t < 256; t += 1) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const diff = mB - mF;
    const betweenVar = wB * wF * diff * diff;
    if (betweenVar > maxVar) {
      maxVar = betweenVar;
      threshold = t;
    }
  }

  return threshold;
}

function dilateBinaryMask(src, dst, w, h) {
  dst.fill(0);
  for (let y = 1; y < h - 1; y += 1) {
    const rOff = y * w;
    for (let x = 1; x < w - 1; x += 1) {
      if (
        src[rOff - w + x - 1] ||
        src[rOff - w + x] ||
        src[rOff - w + x + 1] ||
        src[rOff + x - 1] ||
        src[rOff + x] ||
        src[rOff + x + 1] ||
        src[rOff + w + x - 1] ||
        src[rOff + w + x] ||
        src[rOff + w + x + 1]
      ) {
        dst[rOff + x] = 1;
      }
    }
  }
}

function erodeBinaryMask(src, dst, w, h) {
  dst.fill(0);
  for (let y = 1; y < h - 1; y += 1) {
    const rOff = y * w;
    for (let x = 1; x < w - 1; x += 1) {
      if (
        src[rOff - w + x - 1] &&
        src[rOff - w + x] &&
        src[rOff - w + x + 1] &&
        src[rOff + x - 1] &&
        src[rOff + x] &&
        src[rOff + x + 1] &&
        src[rOff + w + x - 1] &&
        src[rOff + w + x] &&
        src[rOff + w + x + 1]
      ) {
        dst[rOff + x] = 1;
      }
    }
  }
}

function fitLineToPoints2D(points) {
  const n = points.length;
  if (n < 2) return null;

  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i += 1) {
    mx += points[i].x;
    my += points[i].y;
  }
  mx /= n;
  my /= n;

  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = points[i].x - mx;
    const dy = points[i].y - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }

  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const vx = Math.cos(angle);
  const vy = Math.sin(angle);
  // Persamaan garis: nx * x + ny * y = c
  const nx = -vy;
  const ny = vx;
  const c = nx * mx + ny * my;
  return { nx, ny, c };
}

function intersectLines2D(lineA, lineB) {
  if (!lineA || !lineB) return null;
  const det = lineA.nx * lineB.ny - lineA.ny * lineB.nx;
  if (Math.abs(det) < 1e-6) return null;
  const x = (lineA.c * lineB.ny - lineA.ny * lineB.c) / det;
  const y = (lineA.nx * lineB.c - lineA.c * lineB.nx) / det;
  return { x, y };
}

function refineQuadWithEdgeLines(boundaryPts, rawQuad, w, h) {
  if (!Array.isArray(boundaryPts) || boundaryPts.length < 24 || !rawQuad || rawQuad.length !== 4) {
    return rawQuad;
  }

  const sideBuckets = [[], [], [], []]; // 0: Top (0->1), 1: Right (1->2), 2: Bottom (2->3), 3: Left (3->0)
  const diagLen = Math.hypot(w, h);
  const maxDist = Math.max(3.5, diagLen * 0.032);

  for (let i = 0; i < boundaryPts.length; i += 1) {
    const pt = boundaryPts[i];
    let bestSide = -1;
    let bestDist = Infinity;

    for (let s = 0; s < 4; s += 1) {
      const a = rawQuad[s];
      const b = rawQuad[(s + 1) % 4];
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const lenSq = abx * abx + aby * aby;
      if (lenSq < 1) continue;

      const t = ((pt.x - a.x) * abx + (pt.y - a.y) * aby) / lenSq;
      if (t < 0.12 || t > 0.88) continue;

      const projX = a.x + t * abx;
      const projY = a.y + t * aby;
      const dist = Math.hypot(pt.x - projX, pt.y - projY);
      if (dist < bestDist) {
        bestDist = dist;
        bestSide = s;
      }
    }

    if (bestSide >= 0 && bestDist <= maxDist) {
      sideBuckets[bestSide].push(pt);
    }
  }

  const lines = sideBuckets.map((bucket) => (bucket.length >= 6 ? fitLineToPoints2D(bucket) : null));
  if (lines.some((l) => !l)) {
    return rawQuad;
  }

  const tl = intersectLines2D(lines[3], lines[0]);
  const tr = intersectLines2D(lines[0], lines[1]);
  const br = intersectLines2D(lines[1], lines[2]);
  const bl = intersectLines2D(lines[2], lines[3]);
  const refined = [tl, tr, br, bl];

  for (let i = 0; i < 4; i += 1) {
    const rp = refined[i];
    const op = rawQuad[i];
    if (!rp || !Number.isFinite(rp.x) || !Number.isFinite(rp.y)) return rawQuad;
    if (Math.hypot(rp.x - op.x, rp.y - op.y) > diagLen * 0.08) return rawQuad;
    rp.x = Math.max(0, Math.min(w - 1, rp.x));
    rp.y = Math.max(0, Math.min(h - 1, rp.y));
  }

  return refined;
}

function detectDocumentQuadFromCanvas(srcCanvas, srcW, srcH) {
  const ctx = srcCanvas.getContext("2d");
  if (!ctx || srcW < 40 || srcH < 40) return null;

  try {
    const imgData = ctx.getImageData(0, 0, srcW, srcH).data;
    const totalPixels = srcW * srcH;
    const lum = new Uint8Array(totalPixels);
    const sat = new Uint8Array(totalPixels);

    for (let i = 0, p = 0; i < imgData.length; i += 4, p += 1) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];
      const maxC = r > g ? (r > b ? r : b) : (g > b ? g : b);
      const minC = r < g ? (r < b ? r : b) : (g < b ? g : b);
      lum[p] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      sat[p] = maxC - minC;
    }

    const otsuThresh = computeOtsuLuminanceThreshold(lum, srcW, srcH);
    const brightThresh = Math.max(102, Math.min(212, otsuThresh));

    // Segmentasi piksel kertas/stiker terang & netral (memisahkan dari meja coklat/gelap)
    const rawMask = new Uint8Array(totalPixels);
    for (let p = 0; p < totalPixels; p += 1) {
      if (lum[p] >= brightThresh && sat[p] <= 84) {
        rawMask[p] = 1;
      }
    }

    // Morphological Closing 2x untuk menyatukan blok stiker & menutup garis barcode, sambil tetap terpisah dari kabel luar
    const bufA = new Uint8Array(totalPixels);
    const bufB = new Uint8Array(totalPixels);
    dilateBinaryMask(rawMask, bufA, srcW, srcH);
    dilateBinaryMask(bufA, bufB, srcW, srcH);
    erodeBinaryMask(bufB, bufA, srcW, srcH);
    erodeBinaryMask(bufA, bufB, srcW, srcH);
    const closedMask = bufB;

    // Connected Component Labeling (CCL) untuk memilih HANYA objek dokumen utama (abaikan kabel putih di tepi)
    const labels = new Int32Array(totalPixels);
    const queue = new Int32Array(totalPixels);
    let currentLabel = 0;
    let bestComponent = null;
    let bestScore = -1;

    const frameCenterX = srcW * 0.5;
    const frameCenterY = srcH * 0.5;
    const maxCenterDist = Math.hypot(frameCenterX, frameCenterY);

    for (let y = 1; y < srcH - 1; y += 1) {
      const rOff = y * srcW;
      for (let x = 1; x < srcW - 1; x += 1) {
        const startIdx = rOff + x;
        if (!closedMask[startIdx] || labels[startIdx] !== 0) continue;

        currentLabel += 1;
        let qHead = 0;
        let qTail = 0;
        queue[qTail++] = startIdx;
        labels[startIdx] = currentLabel;

        let area = 0;
        let sumX = 0;
        let sumY = 0;
        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        let topEdgeHits = 0;
        let bottomEdgeHits = 0;
        let leftEdgeHits = 0;
        let rightEdgeHits = 0;

        while (qHead < qTail) {
          const idx = queue[qHead++];
          const py = Math.floor(idx / srcW);
          const px = idx - py * srcW;

          area += 1;
          sumX += px;
          sumY += py;
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;

          if (py <= 2) topEdgeHits += 1;
          if (py >= srcH - 3) bottomEdgeHits += 1;
          if (px <= 2) leftEdgeHits += 1;
          if (px >= srcW - 3) rightEdgeHits += 1;

          // 4-connected neighbors
          if (px > 1 && closedMask[idx - 1] && labels[idx - 1] === 0) {
            labels[idx - 1] = currentLabel;
            queue[qTail++] = idx - 1;
          }
          if (px < srcW - 2 && closedMask[idx + 1] && labels[idx + 1] === 0) {
            labels[idx + 1] = currentLabel;
            queue[qTail++] = idx + 1;
          }
          if (py > 1 && closedMask[idx - srcW] && labels[idx - srcW] === 0) {
            labels[idx - srcW] = currentLabel;
            queue[qTail++] = idx - srcW;
          }
          if (py < srcH - 2 && closedMask[idx + srcW] && labels[idx + srcW] === 0) {
            labels[idx + srcW] = currentLabel;
            queue[qTail++] = idx + srcW;
          }
        }

        const areaRatio = area / totalPixels;
        if (areaRatio < 0.065 || areaRatio > 0.91) continue;

        const bboxW = maxX - minX + 1;
        const bboxH = maxY - minY + 1;
        const solidity = area / Math.max(1, bboxW * bboxH);
        if (solidity < 0.52) continue;

        // Jika dokumen terlalu dekat hingga terpotong di >= 3 sisi frame (seperti di video detik 00:10), lepaskan deteksi
        let clippedSides = 0;
        if (topEdgeHits > bboxW * 0.35) clippedSides += 1;
        if (bottomEdgeHits > bboxW * 0.35) clippedSides += 1;
        if (leftEdgeHits > bboxH * 0.35) clippedSides += 1;
        if (rightEdgeHits > bboxH * 0.35) clippedSides += 1;
        if (clippedSides >= 3) continue;

        const cx = sumX / area;
        const cy = sumY / area;
        const centerDistNorm = Math.hypot(cx - frameCenterX, cy - frameCenterY) / maxCenterDist;
        const score = areaRatio * solidity * (1.4 - 0.55 * centerDistNorm);

        if (score > bestScore) {
          bestScore = score;
          bestComponent = { label: currentLabel, area, cx, cy };
        }
      }
    }

    if (!bestComponent) return null;

    // Hitung orientasi utama komponen dokumen (PCA moments) untuk mendeteksi sudut bahkan saat miring
    const winLabel = bestComponent.label;
    const cx = bestComponent.cx;
    const cy = bestComponent.cy;
    let mu20 = 0;
    let mu02 = 0;
    let mu11 = 0;
    const boundaryPts = [];

    for (let y = 1; y < srcH - 1; y += 1) {
      const rOff = y * srcW;
      for (let x = 1; x < srcW - 1; x += 1) {
        const idx = rOff + x;
        if (labels[idx] !== winLabel) continue;

        const dx = x - cx;
        const dy = y - cy;
        mu20 += dx * dx;
        mu02 += dy * dy;
        mu11 += dx * dy;

        if (
          labels[idx - 1] !== winLabel ||
          labels[idx + 1] !== winLabel ||
          labels[idx - srcW] !== winLabel ||
          labels[idx + srcW] !== winLabel
        ) {
          boundaryPts.push({ x, y });
        }
      }
    }

    if (boundaryPts.length < 16) return null;

    const theta = 0.5 * Math.atan2(2 * mu11, mu20 - mu02);
    const cosT = Math.cos(-theta);
    const sinT = Math.sin(-theta);

    let ptTL = boundaryPts[0];
    let ptTR = boundaryPts[0];
    let ptBR = boundaryPts[0];
    let ptBL = boundaryPts[0];
    let minSum = Infinity;
    let maxSum = -Infinity;
    let minDiff = Infinity;
    let maxDiff = -Infinity;

    for (let i = 0; i < boundaryPts.length; i += 1) {
      const p = boundaryPts[i];
      const dx = p.x - cx;
      const dy = p.y - cy;
      const u = dx * cosT - dy * sinT;
      const v = dx * sinT + dy * cosT;
      const sum = u + v;
      const diff = u - v;

      if (sum < minSum) {
        minSum = sum;
        ptTL = p;
      }
      if (sum > maxSum) {
        maxSum = sum;
        ptBR = p;
      }
      if (diff > maxDiff) {
        maxDiff = diff;
        ptTR = p;
      }
      if (diff < minDiff) {
        minDiff = diff;
        ptBL = p;
      }
    }

    const ordered = orderQuadCorners([ptTL, ptTR, ptBR, ptBL]);
    if (!ordered) return null;

    const refined = refineQuadWithEdgeLines(boundaryPts, ordered, srcW, srcH);

    // Hitung luas poligon dengan Shoelace formula
    let polyArea = 0;
    for (let i = 0; i < 4; i += 1) {
      const j = (i + 1) % 4;
      polyArea += refined[i].x * refined[j].y - refined[j].x * refined[i].y;
    }
    polyArea = Math.abs(polyArea) / 2;
    const polyAreaRatio = polyArea / totalPixels;
    if (polyAreaRatio < 0.065 || polyAreaRatio > 0.93) {
      return null;
    }

    // Konversi ke koordinat ternormalisasi [0..1] dengan sedikit padding aman dari titik pusat agar tepi putih tetap utuh
    const qCx = (refined[0].x + refined[1].x + refined[2].x + refined[3].x) / 4;
    const qCy = (refined[0].y + refined[1].y + refined[2].y + refined[3].y) / 4;
    const expandFactor = 1.018;

    const normQuad = refined.map((pt) => {
      const ex = qCx + (pt.x - qCx) * expandFactor;
      const ey = qCy + (pt.y - qCy) * expandFactor;
      return {
        x: Math.max(0, Math.min(1, ex / srcW)),
        y: Math.max(0, Math.min(1, ey / srcH))
      };
    });

    const topWidth = Math.hypot(normQuad[1].x - normQuad[0].x, normQuad[1].y - normQuad[0].y);
    const bottomWidth = Math.hypot(normQuad[2].x - normQuad[3].x, normQuad[2].y - normQuad[3].y);
    const leftHeight = Math.hypot(normQuad[3].x - normQuad[0].x, normQuad[3].y - normQuad[0].y);
    const rightHeight = Math.hypot(normQuad[2].x - normQuad[1].x, normQuad[2].y - normQuad[1].y);

    if (
      Math.min(topWidth, bottomWidth) < 0.18 ||
      Math.min(leftHeight, rightHeight) < 0.14
    ) {
      return null;
    }

    return normQuad;
  } catch (err) {
    return null;
  }
}

function drawDocumentBoundaryOverlay(quad) {
  if (!docDetectCanvas || !scannerViewport) return;
  const rect = scannerViewport.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = Math.round(rect.width * dpr);
  const ch = Math.round(rect.height * dpr);
  if (docDetectCanvas.width !== cw || docDetectCanvas.height !== ch) {
    docDetectCanvas.width = cw;
    docDetectCanvas.height = ch;
  }

  const ctx = docDetectCanvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, cw, ch);

  if (!quad || quad.length !== 4) return;

  const videoEl = document.querySelector("#reader video");
  let offsetX = 0;
  let offsetY = 0;
  let drawW = cw;
  let drawH = ch;

  if (videoEl && videoEl.videoWidth && videoEl.videoHeight) {
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const scale = Math.max(cw / vw, ch / vh);
    drawW = vw * scale;
    drawH = vh * scale;
    offsetX = (cw - drawW) / 2;
    offsetY = (ch - drawH) / 2;
  }

  const pts = quad.map((p) => ({
    x: offsetX + p.x * drawW,
    y: offsetY + p.y * drawH
  }));

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y);
  ctx.lineTo(pts[3].x, pts[3].y);
  ctx.closePath();

  ctx.fillStyle = "rgba(16, 185, 129, 0.09)";
  ctx.fill();

  ctx.lineWidth = 2.6 * dpr;
  ctx.strokeStyle = "#10b981";
  ctx.lineJoin = "round";
  ctx.stroke();

  pts.forEach((pt) => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4.2 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = "#34d399";
    ctx.fill();
  });
  ctx.restore();
}

function runDocumentBoundaryFrame() {
  if (
    !isTextPhotoCameraActive() ||
    !isCameraRunning ||
    (photoLensOverlay && photoLensOverlay.classList.contains("open")) ||
    document.visibilityState !== "visible"
  ) {
    return;
  }

  const videoEl = document.querySelector("#reader video");
  if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth || !videoEl.videoHeight) {
    return;
  }

  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  const maxSample = 240;
  const scale = Math.min(1, maxSample / Math.max(vw, vh));
  const sw = Math.max(40, Math.round(vw * scale));
  const sh = Math.max(40, Math.round(vh * scale));

  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = sw;
  sampleCanvas.height = sh;
  const sCtx = sampleCanvas.getContext("2d");
  if (!sCtx) return;

  sCtx.drawImage(videoEl, 0, 0, sw, sh);
  const detectedQuad = detectDocumentQuadFromCanvas(sampleCanvas, sw, sh);

  if (detectedQuad) {
    docDetectMissCount = 0;
    lastDetectedDocQuad = detectedQuad;
    if (!smoothedDocQuad) {
      smoothedDocQuad = detectedQuad.map((p) => ({ ...p }));
    } else {
      const maxJump = Math.max(
        ...detectedQuad.map((p, idx) =>
          Math.hypot(p.x - smoothedDocQuad[idx].x, p.y - smoothedDocQuad[idx].y)
        )
      );
      const alpha = maxJump > 0.14 ? 0.72 : 0.42;
      smoothedDocQuad = smoothedDocQuad.map((prev, idx) => ({
        x: prev.x + (detectedQuad[idx].x - prev.x) * alpha,
        y: prev.y + (detectedQuad[idx].y - prev.y) * alpha
      }));
    }
    drawDocumentBoundaryOverlay(smoothedDocQuad);
  } else {
    docDetectMissCount += 1;
    if (docDetectMissCount > 3) {
      lastDetectedDocQuad = null;
      smoothedDocQuad = null;
      drawDocumentBoundaryOverlay(null);
    }
  }
}

function startDocumentBoundaryDetector() {
  stopDocumentBoundaryDetector();
  if (docDetectCanvas) {
    docDetectCanvas.classList.add("active");
  }
  docDetectTimer = setInterval(runDocumentBoundaryFrame, 95);
}

function stopDocumentBoundaryDetector() {
  if (docDetectTimer) {
    clearInterval(docDetectTimer);
    docDetectTimer = null;
  }
  lastDetectedDocQuad = null;
  smoothedDocQuad = null;
  docDetectMissCount = 0;
  if (docDetectCanvas) {
    const ctx = docDetectCanvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, docDetectCanvas.width, docDetectCanvas.height);
    }
    docDetectCanvas.classList.remove("active");
  }
}

function solveLinearSystem8x8(A, b) {
  const n = 8;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col += 1) {
    let pivotRow = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivotRow][col])) {
        pivotRow = r;
      }
    }
    if (Math.abs(M[pivotRow][col]) < 1e-9) return null;
    if (pivotRow !== col) {
      const tmp = M[col];
      M[col] = M[pivotRow];
      M[pivotRow] = tmp;
    }

    const pivotVal = M[col][col];
    for (let c = col; c <= n; c += 1) {
      M[col][c] /= pivotVal;
    }

    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const factor = M[r][col];
      for (let c = col; c <= n; c += 1) {
        M[r][c] -= factor * M[col][c];
      }
    }
  }

  return M.map((row) => row[n]);
}

function computeHomographyFromRectToQuad(dstW, dstH, srcQuadPx) {
  const dstPts = [
    { x: 0, y: 0 },
    { x: dstW, y: 0 },
    { x: dstW, y: dstH },
    { x: 0, y: dstH }
  ];

  const A = [];
  const b = [];
  for (let i = 0; i < 4; i += 1) {
    const u = dstPts[i].x;
    const v = dstPts[i].y;
    const x = srcQuadPx[i].x;
    const y = srcQuadPx[i].y;
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }

  return solveLinearSystem8x8(A, b);
}

function warpDocumentQuadToCanvas(img, normQuad) {
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;

  const srcQuadPx = normQuad.map((p) => ({
    x: p.x * naturalW,
    y: p.y * naturalH
  }));

  const topW = Math.hypot(srcQuadPx[1].x - srcQuadPx[0].x, srcQuadPx[1].y - srcQuadPx[0].y);
  const botW = Math.hypot(srcQuadPx[2].x - srcQuadPx[3].x, srcQuadPx[2].y - srcQuadPx[3].y);
  const leftH = Math.hypot(srcQuadPx[3].x - srcQuadPx[0].x, srcQuadPx[3].y - srcQuadPx[0].y);
  const rightH = Math.hypot(srcQuadPx[2].x - srcQuadPx[1].x, srcQuadPx[2].y - srcQuadPx[1].y);

  let targetW = Math.max(140, Math.round((topW + botW) / 2));
  let targetH = Math.max(140, Math.round((leftH + rightH) / 2));

  const maxOutDim = 1640;
  if (Math.max(targetW, targetH) > maxOutDim) {
    const scale = maxOutDim / Math.max(targetW, targetH);
    targetW = Math.round(targetW * scale);
    targetH = Math.round(targetH * scale);
  }

  const h = computeHomographyFromRectToQuad(targetW, targetH, srcQuadPx);
  if (!h) return null;

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = naturalW;
  srcCanvas.height = naturalH;
  const sCtx = srcCanvas.getContext("2d");
  if (!sCtx) return null;
  sCtx.drawImage(img, 0, 0, naturalW, naturalH);
  const srcData = sCtx.getImageData(0, 0, naturalW, naturalH).data;

  const dstCanvas = document.createElement("canvas");
  dstCanvas.width = targetW;
  dstCanvas.height = targetH;
  const dCtx = dstCanvas.getContext("2d");
  if (!dCtx) return null;
  const dstImgData = dCtx.createImageData(targetW, targetH);
  const dstData = dstImgData.data;

  const [h0, h1, h2, h3, h4, h5, h6, h7] = h;
  const maxSx = naturalW - 1.001;
  const maxSy = naturalH - 1.001;

  // Bilinear interpolation agar garis barcode & teks kecil tetap halus tanpa bergerigi
  for (let v = 0; v < targetH; v += 1) {
    const rowBase = v * targetW * 4;
    const h1v_h2 = h1 * v + h2;
    const h4v_h5 = h4 * v + h5;
    const h7v_1 = h7 * v + 1;

    for (let u = 0; u < targetW; u += 1) {
      const denom = h6 * u + h7v_1;
      const invDenom = denom !== 0 ? 1 / denom : 1;
      const sx = Math.max(0, Math.min(maxSx, (h0 * u + h1v_h2) * invDenom));
      const sy = Math.max(0, Math.min(maxSy, (h3 * u + h4v_h5) * invDenom));

      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = x0 + 1;
      const y1 = y0 + 1;
      const fx = sx - x0;
      const fy = sy - y0;
      const oneMinusFx = 1 - fx;
      const oneMinusFy = 1 - fy;

      const w00 = oneMinusFx * oneMinusFy;
      const w10 = fx * oneMinusFy;
      const w01 = oneMinusFx * fy;
      const w11 = fx * fy;

      const idx00 = (y0 * naturalW + x0) * 4;
      const idx10 = (y0 * naturalW + x1) * 4;
      const idx01 = (y1 * naturalW + x0) * 4;
      const idx11 = (y1 * naturalW + x1) * 4;

      const dIdx = rowBase + u * 4;
      dstData[dIdx] = Math.round(
        srcData[idx00] * w00 + srcData[idx10] * w10 + srcData[idx01] * w01 + srcData[idx11] * w11
      );
      dstData[dIdx + 1] = Math.round(
        srcData[idx00 + 1] * w00 +
          srcData[idx10 + 1] * w10 +
          srcData[idx01 + 1] * w01 +
          srcData[idx11 + 1] * w11
      );
      dstData[dIdx + 2] = Math.round(
        srcData[idx00 + 2] * w00 +
          srcData[idx10 + 2] * w10 +
          srcData[idx01 + 2] * w01 +
          srcData[idx11 + 2] * w11
      );
      dstData[dIdx + 3] = 255;
    }
  }

  dCtx.putImageData(dstImgData, 0, 0);
  return dstCanvas;
}

function applyCamScannerDocumentFilter(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx || !canvas.width || !canvas.height) return;

  try {
    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const total = w * h;
    const lum = new Uint8Array(total);

    // 1. Konversi ke luminance monokrom netral (bobot hijau dominan untuk noise terendah & 0% noda biru cyan)
    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      lum[p] = Math.round(0.25 * data[i] + 0.6 * data[i + 1] + 0.15 * data[i + 2]);
    }

    // 2. Estimasi latar belakang kertas lokal (88th percentile per tile) + smoothing 3x3
    const tile = Math.max(20, Math.round(Math.min(w, h) / 16));
    const gw = Math.max(1, Math.ceil(w / tile));
    const gh = Math.max(1, Math.ceil(h / tile));
    const rawBgGrid = new Float32Array(gw * gh);
    const hist = new Uint32Array(256);

    for (let gy = 0; gy < gh; gy += 1) {
      const y0 = gy * tile;
      const y1 = Math.min(h, y0 + tile);
      for (let gx = 0; gx < gw; gx += 1) {
        const x0 = gx * tile;
        const x1 = Math.min(w, x0 + tile);
        hist.fill(0);
        let sampleCount = 0;

        for (let y = y0; y < y1; y += 2) {
          const rOff = y * w;
          for (let x = x0; x < x1; x += 2) {
            hist[lum[rOff + x]] += 1;
            sampleCount += 1;
          }
        }

        const targetRank = Math.max(1, Math.floor(sampleCount * 0.88));
        let accum = 0;
        let bgVal = 200;
        for (let v = 0; v < 256; v += 1) {
          accum += hist[v];
          if (accum >= targetRank) {
            bgVal = v;
            break;
          }
        }
        rawBgGrid[gy * gw + gx] = Math.max(75, bgVal);
      }
    }

    const bgGrid = new Float32Array(gw * gh);
    for (let gy = 0; gy < gh; gy += 1) {
      for (let gx = 0; gx < gw; gx += 1) {
        let sum = 0;
        let weightSum = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          const ny = Math.max(0, Math.min(gh - 1, gy + dy));
          const wy = dy === 0 ? 2 : 1;
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = Math.max(0, Math.min(gw - 1, gx + dx));
            const wx = dx === 0 ? 2 : 1;
            const wt = wx * wy;
            sum += rawBgGrid[ny * gw + nx] * wt;
            weightSum += wt;
          }
        }
        bgGrid[gy * gw + gx] = sum / weightSum;
      }
    }

    // 3. Normalisasi pencahayaan kertas ke putih murni (#FFFFFF) & teks/barcode ke hitam pekat halus
    const toneBuf = new Uint8Array(total);
    for (let y = 0; y < h; y += 1) {
      const fy = Math.min(gh - 1, Math.max(0, (y + 0.5) / tile - 0.5));
      const gy0 = Math.floor(fy);
      const gy1 = Math.min(gh - 1, gy0 + 1);
      const wy = fy - gy0;
      const rOff = y * w;

      for (let x = 0; x < w; x += 1) {
        const fx = Math.min(gw - 1, Math.max(0, (x + 0.5) / tile - 0.5));
        const gx0 = Math.floor(fx);
        const gx1 = Math.min(gw - 1, gx0 + 1);
        const wx = fx - gx0;

        const b00 = bgGrid[gy0 * gw + gx0];
        const b10 = bgGrid[gy0 * gw + gx1];
        const b01 = bgGrid[gy1 * gw + gx0];
        const b11 = bgGrid[gy1 * gw + gx1];
        const localBg =
          (b00 * (1 - wx) + b10 * wx) * (1 - wy) +
          (b01 * (1 - wx) + b11 * wx) * wy;

        const p = rOff + x;
        const normVal = (lum[p] / Math.max(60, localBg)) * 255;

        let outGray;
        if (normVal >= 205) {
          outGray = 255;
        } else if (normVal <= 122) {
          outGray = Math.max(0, Math.round((normVal / 122) * 18));
        } else {
          const t = (normVal - 122) / (205 - 122);
          const smoothT = t * t * (3 - 2 * t);
          outGray = Math.round(18 + (255 - 18) * smoothT);
        }
        toneBuf[p] = outGray;
      }
    }

    // 4. Penajaman tepi halus (Unsharp Mask) agar huruf kecil & garis barcode tajam seperti Gambar 4
    for (let y = 0; y < h; y += 1) {
      const rOff = y * w;
      const yPrev = y > 0 ? (y - 1) * w : rOff;
      const yNext = y < h - 1 ? (y + 1) * w : rOff;

      for (let x = 0; x < w; x += 1) {
        const xPrev = x > 0 ? x - 1 : x;
        const xNext = x < w - 1 ? x + 1 : x;

        const center = toneBuf[rOff + x];
        let finalVal = center;

        if (center > 0 && center < 255) {
          const blur =
            (toneBuf[yPrev + xPrev] +
              2 * toneBuf[yPrev + x] +
              toneBuf[yPrev + xNext] +
              2 * toneBuf[rOff + xPrev] +
              4 * center +
              2 * toneBuf[rOff + xNext] +
              toneBuf[yNext + xPrev] +
              2 * toneBuf[yNext + x] +
              toneBuf[yNext + xNext]) /
            16;
          const sharpened = center + 0.36 * (center - blur);
          finalVal = sharpened >= 244 ? 255 : Math.max(0, Math.min(255, Math.round(sharpened)));
        }

        const idx = (rOff + x) * 4;
        data[idx] = finalVal;
        data[idx + 1] = finalVal;
        data[idx + 2] = finalVal;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  } catch (err) {}
}

async function processDocumentAutoCropAndEnhance(rawImageUrl, preDetectedQuad = null) {
  const img = await loadImageElement(rawImageUrl);
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;

  let quadToUse = preDetectedQuad;
  if (!quadToUse) {
    const maxSample = 300;
    const scale = Math.min(1, maxSample / Math.max(naturalW, naturalH));
    const sw = Math.max(40, Math.round(naturalW * scale));
    const sh = Math.max(40, Math.round(naturalH * scale));
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = sw;
    sampleCanvas.height = sh;
    const sCtx = sampleCanvas.getContext("2d");
    if (sCtx) {
      sCtx.drawImage(img, 0, 0, sw, sh);
      quadToUse = detectDocumentQuadFromCanvas(sampleCanvas, sw, sh);
    }
  }

  let outputCanvas = null;
  if (quadToUse) {
    outputCanvas = warpDocumentQuadToCanvas(img, quadToUse);
  }

  if (!outputCanvas) {
    const maxOutDim = 1640;
    const scale = Math.max(naturalW, naturalH) > maxOutDim
      ? maxOutDim / Math.max(naturalW, naturalH)
      : 1;
    outputCanvas = document.createElement("canvas");
    outputCanvas.width = Math.max(1, Math.round(naturalW * scale));
    outputCanvas.height = Math.max(1, Math.round(naturalH * scale));
    const oCtx = outputCanvas.getContext("2d");
    if (oCtx) {
      oCtx.drawImage(img, 0, 0, outputCanvas.width, outputCanvas.height);
    }
  }

  applyCamScannerDocumentFilter(outputCanvas);
  return outputCanvas.toDataURL("image/jpeg", 0.96);
}

// 7. Engine Foto Lens: Auto-Crop CamScanner + Deteksi Barcode & Huruf/Angka Cepat
function setPhotoLensStatus(msg, hide = false) {
  if (!photoLensStatus) return;
  photoLensStatus.textContent = msg;
  photoLensStatus.classList.toggle("hidden", Boolean(hide));
}

function clearPhotoLensState() {
  ocrWordItems = [];
  selectedOcrIndices = [];
  ocrNaturalWidth = 0;
  ocrNaturalHeight = 0;
  isOcrDragging = false;
  ocrDragStartIdx = -1;
  ocrDragStartPoint = null;
  ocrDragMoved = false;
  if (photoOcrLayer) {
    photoOcrLayer.innerHTML = "";
  }
  if (photoLensActionBar) {
    photoLensActionBar.classList.remove("visible");
  }
  if (capturedPhotoPreview) {
    capturedPhotoPreview.removeAttribute("src");
    capturedPhotoPreview.classList.remove("has-image");
  }
}

function openPhotoLensPanel() {
  if (!photoLensOverlay || !photoShutterBtn) return;
  const wasOpen = photoLensOverlay.classList.contains("open");
  photoLensOverlay.classList.add("open");
  photoShutterBtn.classList.add("active");
  stopDocumentBoundaryDetector();
  pauseCameraForSingleScan();
  if (!wasOpen) {
    if (activeAppFeature === "scan-to-excel" && isExcelTextPhotoMode) {
      excelPhotoHistoryDepth = 2;
      pushAppHistoryState("scan-to-excel-scan:photo-lens");
    } else {
      pushAppHistoryState(`${activeAppFeature}:photo-lens`);
    }
  }
}

function closePhotoLensPanel(fromBack = false) {
  if (!fromBack && photoLensOverlay && photoLensOverlay.classList.contains("open")) {
    if (activeAppFeature === "scan-to-excel" && isExcelTextPhotoMode && excelPhotoHistoryDepth > 1) {
      const depthToPop = excelPhotoHistoryDepth;
      excelPhotoHistoryDepth = 0;
      ocrRunToken += 1;
      clearPhotoLensState();
      photoLensOverlay.classList.remove("open");
      if (photoShutterBtn) photoShutterBtn.classList.remove("active");
      exitExcelTextPhotoMode(true);
      ignorePopStateCount = depthToPop;
      try {
        window.history.go(-depthToPop);
      } catch (err) {
        ignorePopStateCount = 0;
      }
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
  }

  ocrRunToken += 1;
  clearPhotoLensState();
  if (photoLensOverlay) {
    photoLensOverlay.classList.remove("open");
  }
  if (photoShutterBtn) {
    photoShutterBtn.classList.remove("active");
  }

  if (activeAppFeature === "scan-to-excel" && isExcelTextPhotoMode) {
    if (fromBack && excelPhotoHistoryDepth > 1) {
      excelPhotoHistoryDepth = 0;
      exitExcelTextPhotoMode(true);
      ignorePopStateCount = 1;
      try {
        window.history.go(-1);
      } catch (err) {
        ignorePopStateCount = 0;
      }
      return;
    }
    exitExcelTextPhotoMode(true);
    return;
  }

  if (activeAppFeature === "text-to-qr") {
    currentRoute = "text-to-qr";
    startDocumentBoundaryDetector();
  }

  if (!isScanLocked && activeAppFeature !== "menu") {
    resumeCameraForNextScan();
  }
}

function captureSnapshotFromVideo() {
  const videoEl = document.querySelector("#reader video");
  if (!videoEl || !videoEl.videoWidth || !videoEl.videoHeight) return "";
  try {
    const canvas = document.createElement("canvas");
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.96);
  } catch (err) {
    return "";
  }
}

function loadImageElement(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageUrl;
  });
}

function withPromiseTimeout(promise, ms, fallbackValue) {
  let timer = null;
  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallbackValue), ms);
  });
  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    timeoutPromise
  ]);
}

async function getPersistentOcrWorker() {
  if (typeof window.Tesseract === "undefined" || typeof window.Tesseract.createWorker !== "function") {
    return null;
  }
  if (!sharedTesseractWorkerPromise) {
    sharedTesseractWorkerPromise = (async () => {
      try {
        const worker = await window.Tesseract.createWorker("eng", 1, {
          logger: () => {}
        });
        await worker.setParameters({
          tessedit_pageseg_mode: "11",
          preserve_interword_spaces: "1"
        });
        return worker;
      } catch (err) {
        sharedTesseractWorkerPromise = null;
        return null;
      }
    })();
  }
  return sharedTesseractWorkerPromise;
}

function suppressLongTableLinesOnGrayBuffer(grayBuf, width, height) {
  const minHorizRun = Math.max(70, Math.floor(width * 0.26));
  for (let y = 1; y < height - 1; y += 1) {
    const rowOffset = y * width;
    let runStart = -1;
    for (let x = 0; x <= width; x += 1) {
      const isDark = x < width && grayBuf[rowOffset + x] < 155;
      if (isDark) {
        if (runStart < 0) runStart = x;
      } else if (runStart >= 0) {
        const runLen = x - runStart;
        if (runLen >= minHorizRun) {
          for (let rx = runStart; rx < x; rx += 1) {
            const aboveVal = grayBuf[(y - 1) * width + rx];
            const belowVal = grayBuf[(y + 1) * width + rx];
            const isTouchingChar = aboveVal < 130 && belowVal < 130;
            if (!isTouchingChar) {
              grayBuf[rowOffset + rx] = 250;
            }
          }
        }
        runStart = -1;
      }
    }
  }

  const minVertRun = Math.max(80, Math.floor(height * 0.26));
  for (let x = 1; x < width - 1; x += 1) {
    let runStart = -1;
    for (let y = 0; y <= height; y += 1) {
      const isDark = y < height && grayBuf[y * width + x] < 155;
      if (isDark) {
        if (runStart < 0) runStart = y;
      } else if (runStart >= 0) {
        const runLen = y - runStart;
        if (runLen >= minVertRun) {
          for (let ry = runStart; ry < y; ry += 1) {
            const leftVal = grayBuf[ry * width + (x - 1)];
            const rightVal = grayBuf[ry * width + (x + 1)];
            const isTouchingChar = leftVal < 130 && rightVal < 130;
            if (!isTouchingChar) {
              grayBuf[ry * width + x] = 250;
            }
          }
        }
        runStart = -1;
      }
    }
  }
}

function buildEnhancedCanvasForOcr(img) {
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;
  const maxDim = Math.max(naturalW, naturalH, 1);
  const targetMaxDim = 1520;
  const scale = maxDim > targetMaxDim ? targetMaxDim / maxDim : 1;

  const width = Math.max(1, Math.round(naturalW * scale));
  const height = Math.max(1, Math.round(naturalH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { canvas, scale: 1, cleanGray: null, width, height };

  ctx.drawImage(img, 0, 0, width, height);
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const len = data.length;
    const rawGray = new Uint8Array(width * height);

    for (let i = 0, p = 0; i < len; i += 4, p += 1) {
      rawGray[p] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }

    const tileSize = Math.max(22, Math.round(Math.min(width, height) / 18));
    const gridW = Math.max(1, Math.ceil(width / tileSize));
    const gridH = Math.max(1, Math.ceil(height / tileSize));
    const tileBg = new Float32Array(gridW * gridH);

    for (let gy = 0; gy < gridH; gy += 1) {
      const y0 = gy * tileSize;
      const y1 = Math.min(height, y0 + tileSize);
      for (let gx = 0; gx < gridW; gx += 1) {
        const x0 = gx * tileSize;
        const x1 = Math.min(width, x0 + tileSize);
        let maxTileLum = 60;
        let sumTop = 0;
        let countTop = 0;

        for (let y = y0; y < y1; y += 2) {
          const rOff = y * width;
          for (let x = x0; x < x1; x += 2) {
            const v = rawGray[rOff + x];
            if (v > maxTileLum) maxTileLum = v;
            sumTop += v;
            countTop += 1;
          }
        }
        const meanTile = countTop > 0 ? sumTop / countTop : maxTileLum;
        tileBg[gy * gridW + gx] = Math.max(65, maxTileLum * 0.72 + meanTile * 0.28);
      }
    }

    const normGray = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
      const fy = Math.min(gridH - 1, Math.max(0, (y + 0.5) / tileSize - 0.5));
      const gy0 = Math.floor(fy);
      const gy1 = Math.min(gridH - 1, gy0 + 1);
      const wy = fy - gy0;
      const rOff = y * width;

      for (let x = 0; x < width; x += 1) {
        const fx = Math.min(gridW - 1, Math.max(0, (x + 0.5) / tileSize - 0.5));
        const gx0 = Math.floor(fx);
        const gx1 = Math.min(gridW - 1, gx0 + 1);
        const wx = fx - gx0;

        const b00 = tileBg[gy0 * gridW + gx0];
        const b10 = tileBg[gy0 * gridW + gx1];
        const b01 = tileBg[gy1 * gridW + gx0];
        const b11 = tileBg[gy1 * gridW + gx1];
        const localBg =
          (b00 * (1 - wx) + b10 * wx) * (1 - wy) +
          (b01 * (1 - wx) + b11 * wx) * wy;

        const rel = (rawGray[rOff + x] / Math.max(55, localBg)) * 242;
        const stretched = rel < 165 ? rel * 0.74 : Math.min(255, 165 + (rel - 165) * 1.2);
        normGray[rOff + x] = Math.max(0, Math.min(255, Math.round(stretched)));
      }
    }

    suppressLongTableLinesOnGrayBuffer(normGray, width, height);

    for (let i = 0, p = 0; i < len; i += 4, p += 1) {
      const val = normGray[p];
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
      data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    return { canvas, scale, cleanGray: normGray, width, height };
  } catch (err) {
    return { canvas, scale, cleanGray: null, width, height };
  }
}

function getDedicatedFileScanner() {
  if (fileDecodeScanner) return fileDecodeScanner;
  try {
    let hiddenHolder = document.getElementById("hidden-file-qr-reader");
    if (!hiddenHolder) {
      hiddenHolder = document.createElement("div");
      hiddenHolder.id = "hidden-file-qr-reader";
      hiddenHolder.style.display = "none";
      document.body.appendChild(hiddenHolder);
    }
    fileDecodeScanner = new Html5Qrcode("hidden-file-qr-reader", {
      formatsToSupport: getSupportedFormats(),
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: false
      },
      verbose: false
    });
    return fileDecodeScanner;
  } catch (err) {
    return null;
  }
}

async function detectBarcodeBoxesWithNativeDetector(source) {
  if (typeof window.BarcodeDetector === "undefined") return [];
  try {
    let detector;
    try {
      detector = new window.BarcodeDetector({
        formats: [
          "code_128",
          "code_39",
          "code_93",
          "codabar",
          "ean_13",
          "ean_8",
          "itf",
          "upc_a",
          "upc_e",
          "qr_code",
          "data_matrix",
          "aztec",
          "pdf417"
        ]
      });
    } catch (e) {
      detector = new window.BarcodeDetector();
    }

    const detected = await detector.detect(source);
    if (!Array.isArray(detected) || detected.length === 0) return [];

    return detected
      .filter((item) => item && item.boundingBox && item.boundingBox.width > 8 && item.boundingBox.height > 8)
      .map((item) => {
        const b = item.boundingBox;
        return {
          type: "barcode",
          text: String(item.rawValue || "").trim(),
          format: String(item.format || "BARCODE").toUpperCase(),
          bbox: {
            x0: Math.max(0, Number(b.x) || 0),
            y0: Math.max(0, Number(b.y) || 0),
            x1: Math.max(0, (Number(b.x) || 0) + (Number(b.width) || 0)),
            y1: Math.max(0, (Number(b.y) || 0) + (Number(b.height) || 0))
          }
        };
      });
  } catch (err) {
    return [];
  }
}

function detectStripeBarcodeRegions(canvas, scale) {
  const ctx = canvas.getContext("2d");
  if (!ctx || !canvas.width || !canvas.height) return [];

  try {
    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h).data;
    const invScale = scale > 0 ? 1 / scale : 1;

    const rowScores = new Float32Array(h);
    const rowMinX = new Int32Array(h).fill(w);
    const rowMaxX = new Int32Array(h).fill(0);

    for (let y = 0; y < h; y += 2) {
      let transitions = 0;
      let prevDark = false;
      let firstX = w;
      let lastX = 0;

      for (let x = 2; x < w - 2; x += 2) {
        const idx = (y * w + x) * 4;
        const lum = imgData[idx];
        const isDark = lum < 132;
        if (x > 2 && isDark !== prevDark) {
          transitions += 1;
          if (x < firstX) firstX = x;
          if (x > lastX) lastX = x;
        }
        prevDark = isDark;
      }

      const span = Math.max(1, lastX - firstX);
      if (transitions >= 20 && span > w * 0.18) {
        rowScores[y] = transitions / span;
        rowMinX[y] = firstX;
        rowMaxX[y] = lastX;
      }
    }

    const regions = [];
    let startY = -1;
    let sumMinX = 0;
    let sumMaxX = 0;
    let countRows = 0;

    for (let y = 0; y <= h; y += 2) {
      const active = y < h && rowScores[y] > 0.05;
      if (active) {
        if (startY < 0) {
          startY = y;
          sumMinX = 0;
          sumMaxX = 0;
          countRows = 0;
        }
        sumMinX += rowMinX[y];
        sumMaxX += rowMaxX[y];
        countRows += 1;
      } else if (startY >= 0) {
        const endY = y - 2;
        const bandHeight = endY - startY;
        if (bandHeight >= Math.max(20, h * 0.028) && countRows >= 5) {
          const avgMinX = Math.max(0, sumMinX / countRows - 6);
          const avgMaxX = Math.min(w, sumMaxX / countRows + 6);
          const bandWidth = avgMaxX - avgMinX;
          if (bandWidth > bandHeight * 1.2) {
            regions.push({
              type: "barcode",
              text: "",
              format: "CODE_128",
              bbox: {
                x0: avgMinX * invScale,
                y0: Math.max(0, startY - 2) * invScale,
                x1: avgMaxX * invScale,
                y1: Math.min(h, endY + 2) * invScale
              }
            });
          }
        }
        startY = -1;
      }
    }

    return regions;
  } catch (err) {
    return [];
  }
}

function mergeDetectedBarcodes(nativeBarcodes, stripeBarcodes) {
  const merged = [...nativeBarcodes];
  stripeBarcodes.forEach((sb) => {
    const sbMidY = (sb.bbox.y0 + sb.bbox.y1) / 2;
    const sbMidX = (sb.bbox.x0 + sb.bbox.x1) / 2;
    const alreadyCovered = merged.some(
      (nb) =>
        sbMidX >= nb.bbox.x0 - 16 &&
        sbMidX <= nb.bbox.x1 + 16 &&
        sbMidY >= nb.bbox.y0 - 16 &&
        sbMidY <= nb.bbox.y1 + 16
    );
    if (!alreadyCovered) {
      merged.push(sb);
    }
  });
  return merged;
}

function canvasToPngFile(canvas, fileName) {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        try {
          resolve(new File([blob], fileName, { type: "image/png" }));
        } catch (err) {
          blob.name = fileName;
          resolve(blob);
        }
      }, "image/png");
    } catch (err) {
      resolve(null);
    }
  });
}

function buildBinarizedCropCanvas(sourceCanvas, thresholdFactor = 0.88) {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx) return out;

  ctx.drawImage(sourceCanvas, 0, 0);
  try {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const len = data.length;
    let sumLum = 0;
    let count = 0;

    for (let i = 0; i < len; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sumLum += lum;
      count += 1;
    }

    const meanLum = count > 0 ? sumLum / count : 128;
    const threshold = Math.max(75, Math.min(215, meanLum * thresholdFactor));

    for (let i = 0; i < len; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const val = lum < threshold ? 0 : 255;
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
      data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (err) {}
  return out;
}

async function scanBarcodeFromCanvasWithFileDecoder(targetCanvas) {
  const scanner = getDedicatedFileScanner();
  if (!scanner) return null;
  try {
    const file = await canvasToPngFile(targetCanvas, "barcode-crop.png");
    if (!file) return null;

    if (typeof scanner.scanFileV2 === "function") {
      const res = await scanner.scanFileV2(file, false);
      if (res && res.decodedText) {
        return {
          text: String(res.decodedText).trim(),
          format: res.result && res.result.format && res.result.format.formatName
            ? res.result.format.formatName
            : ""
        };
      }
    } else if (typeof scanner.scanFile === "function") {
      const text = await scanner.scanFile(file, false);
      if (text) {
        return { text: String(text).trim(), format: "" };
      }
    }
  } catch (err) {}
  return null;
}

async function decodeSingleBarcodeRegionFromImage(img, bc) {
  if (!img || !bc || !bc.bbox || bc.text) return;

  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;
  const bWidth = Math.max(10, bc.bbox.x1 - bc.bbox.x0);
  const bHeight = Math.max(10, bc.bbox.y1 - bc.bbox.y0);

  const marginX = Math.round(bWidth * 0.18);
  const marginY = Math.round(bHeight * 0.25);
  const sx = Math.max(0, Math.floor(bc.bbox.x0 - marginX));
  const sy = Math.max(0, Math.floor(bc.bbox.y0 - marginY));
  const sw = Math.min(naturalW - sx, Math.ceil(bWidth + marginX * 2));
  const sh = Math.min(naturalH - sy, Math.ceil(bHeight + marginY * 2));
  if (sw <= 10 || sh <= 10) return;

  const quietPad = 56;
  const upScale = sw < 900 ? 2 : 1;
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = sw * upScale + quietPad * 2;
  cropCanvas.height = sh * upScale + quietPad * 2;
  const ctx = cropCanvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
  ctx.drawImage(img, sx, sy, sw, sh, quietPad, quietPad, sw * upScale, sh * upScale);

  const cropNative = await detectBarcodeBoxesWithNativeDetector(cropCanvas);
  const matchedNative = cropNative.find((item) => item.text && item.text.length >= 2);
  if (matchedNative) {
    bc.text = matchedNative.text;
    if (matchedNative.format) bc.format = matchedNative.format;
    return;
  }

  const binNormal = buildBinarizedCropCanvas(cropCanvas, 0.88);
  const binBright = buildBinarizedCropCanvas(cropCanvas, 1.02);

  const binNative =
    (await detectBarcodeBoxesWithNativeDetector(binNormal)).find((item) => item.text && item.text.length >= 2) ||
    (await detectBarcodeBoxesWithNativeDetector(binBright)).find((item) => item.text && item.text.length >= 2);
  if (binNative) {
    bc.text = binNative.text;
    if (binNative.format) bc.format = binNative.format;
    return;
  }

  const zxingRes =
    (await scanBarcodeFromCanvasWithFileDecoder(cropCanvas)) ||
    (await scanBarcodeFromCanvasWithFileDecoder(binNormal)) ||
    (await scanBarcodeFromCanvasWithFileDecoder(binBright));
  if (zxingRes && zxingRes.text) {
    bc.text = zxingRes.text;
    if (zxingRes.format) bc.format = zxingRes.format;
  }
}

function isBoxOverlappingBarcode(wordBbox, barcodeItems) {
  if (!Array.isArray(barcodeItems) || barcodeItems.length === 0) return false;
  const wWidth = Math.max(1, wordBbox.x1 - wordBbox.x0);
  const wHeight = Math.max(1, wordBbox.y1 - wordBbox.y0);
  const wArea = wWidth * wHeight;
  const cx = (wordBbox.x0 + wordBbox.x1) / 2;
  const cy = (wordBbox.y0 + wordBbox.y1) / 2;

  return barcodeItems.some((bc) => {
    const b = bc.bbox;
    if (cx >= b.x0 - 2 && cx <= b.x1 + 2 && cy >= b.y0 - 2 && cy <= b.y1 + 2) {
      return true;
    }
    const interX0 = Math.max(wordBbox.x0, b.x0);
    const interY0 = Math.max(wordBbox.y0, b.y0);
    const interX1 = Math.min(wordBbox.x1, b.x1);
    const interY1 = Math.min(wordBbox.y1, b.y1);
    if (interX1 > interX0 && interY1 > interY0) {
      const interArea = (interX1 - interX0) * (interY1 - interY0);
      if (interArea / wArea > 0.35) {
        return true;
      }
    }
    return false;
  });
}

function isBarcodeArtifactText(text, bbox) {
  const clean = String(text || "").trim();
  if (!clean) return true;
  if (!/[A-Za-z0-9]/.test(clean)) return true;

  const width = Math.max(1, bbox.x1 - bbox.x0);
  const height = Math.max(1, bbox.y1 - bbox.y0);

  if (/^[|!Il1i\[\]\/\\\-_=.,:;'"`~]+$/.test(clean) && height > width * 1.1) {
    return true;
  }
  if (/^[|\/\\]{2,}$/.test(clean)) {
    return true;
  }
  return false;
}

function refineWordBoundingBoxWithInk(rawBbox, text, cleanGray, imgW, imgH) {
  if (!cleanGray || !imgW || !imgH) return rawBbox;

  const x0 = Math.max(0, Math.floor(rawBbox.x0));
  const y0 = Math.max(0, Math.floor(rawBbox.y0));
  const x1 = Math.min(imgW, Math.ceil(rawBbox.x1));
  const y1 = Math.min(imgH, Math.ceil(rawBbox.y1));
  const bw = x1 - x0;
  const bh = y1 - y0;
  if (bw <= 6 || bh <= 6) return rawBbox;

  const colCounts = new Uint16Array(bw);
  const rowCounts = new Uint16Array(bh);
  const inkThreshold = 155;

  for (let y = y0; y < y1; y += 1) {
    const rOff = y * imgW;
    let rHits = 0;
    for (let x = x0; x < x1; x += 1) {
      if (cleanGray[rOff + x] < inkThreshold) {
        colCounts[x - x0] += 1;
        rHits += 1;
      }
    }
    rowCounts[y - y0] = rHits;
  }

  let trimY0 = 0;
  let trimY1 = bh - 1;
  const maxLineSpan = Math.max(bw * 0.94, 40);
  while (trimY0 < trimY1 && (rowCounts[trimY0] < 2 || rowCounts[trimY0] > maxLineSpan)) {
    trimY0 += 1;
  }
  while (trimY1 > trimY0 && (rowCounts[trimY1] < 2 || rowCounts[trimY1] > maxLineSpan)) {
    trimY1 -= 1;
  }

  const activeHeight = Math.max(6, trimY1 - trimY0 + 1);
  const activeColCounts = new Uint16Array(bw);
  for (let y = y0 + trimY0; y <= y0 + trimY1; y += 1) {
    const rOff = y * imgW;
    for (let x = x0; x < x1; x += 1) {
      if (cleanGray[rOff + x] < inkThreshold) {
        activeColCounts[x - x0] += 1;
      }
    }
  }

  const segments = [];
  let segStart = -1;
  let emptyGap = 0;
  const maxCharGap = Math.max(10, Math.round(activeHeight * 0.95));

  for (let c = 0; c < bw; c += 1) {
    const hasInk = activeColCounts[c] >= 2;
    if (hasInk) {
      if (segStart < 0) {
        segStart = c;
      }
      emptyGap = 0;
    } else if (segStart >= 0) {
      emptyGap += 1;
      if (emptyGap > maxCharGap) {
        const segEnd = c - emptyGap;
        if (segEnd - segStart >= 4) {
          segments.push({ start: segStart, end: segEnd });
        }
        segStart = -1;
        emptyGap = 0;
      }
    }
  }
  if (segStart >= 0) {
    const segEnd = bw - 1 - emptyGap;
    if (segEnd - segStart >= 4) {
      segments.push({ start: segStart, end: segEnd });
    }
  }

  if (segments.length === 0) {
    return rawBbox;
  }

  let bestSeg = segments[0];
  if (segments.length > 1) {
    const expectedWidth = Math.max(16, text.length * activeHeight * 0.62);
    let bestScore = -Infinity;
    segments.forEach((seg) => {
      const segW = seg.end - seg.start + 1;
      let inkMass = 0;
      for (let c = seg.start; c <= seg.end; c += 1) {
        inkMass += activeColCounts[c];
      }
      const distFromCenter = Math.abs((seg.start + seg.end) / 2 - bw / 2);
      const sizeDiff = Math.abs(segW - expectedWidth);
      const score = inkMass * 2 - sizeDiff * 1.4 - distFromCenter * 0.35;
      if (score > bestScore) {
        bestScore = score;
        bestSeg = seg;
      }
    });
  }

  return {
    x0: Math.max(0, x0 + bestSeg.start - 2),
    y0: Math.max(0, y0 + trimY0 - 1),
    x1: Math.min(imgW, x0 + bestSeg.end + 3),
    y1: Math.min(imgH, y0 + trimY1 + 2)
  };
}

function extractWordsFromTesseractData(data) {
  if (!data) return [];

  if (Array.isArray(data.words) && data.words.length > 0) {
    return data.words;
  }

  if (Array.isArray(data.blocks) && data.blocks.length > 0) {
    const wordsFromBlocks = [];
    data.blocks.forEach((block) => {
      const paragraphs = Array.isArray(block.paragraphs) ? block.paragraphs : [];
      paragraphs.forEach((para) => {
        const lines = Array.isArray(para.lines) ? para.lines : [];
        lines.forEach((line) => {
          const words = Array.isArray(line.words) ? line.words : [];
          words.forEach((word) => wordsFromBlocks.push(word));
        });
      });
    });
    if (wordsFromBlocks.length > 0) {
      return wordsFromBlocks;
    }
  }

  if (Array.isArray(data.lines) && data.lines.length > 0) {
    const wordsFromLines = data.lines.flatMap((line) => (Array.isArray(line.words) ? line.words : []));
    if (wordsFromLines.length > 0) {
      return wordsFromLines;
    }
  }

  if (typeof data.tsv === "string" && data.tsv.trim()) {
    const tsvWords = [];
    const rows = data.tsv.split(/\r?\n/);
    for (let i = 1; i < rows.length; i += 1) {
      const cols = rows[i].split("\t");
      if (cols.length >= 12 && Number(cols[0]) === 5) {
        const left = Number(cols[6]) || 0;
        const top = Number(cols[7]) || 0;
        const width = Number(cols[8]) || 0;
        const height = Number(cols[9]) || 0;
        const conf = Number(cols[10]);
        const wordText = cols.slice(11).join("\t").trim();
        if (wordText && width > 0 && height > 0) {
          tsvWords.push({
            text: wordText,
            confidence: Number.isFinite(conf) ? conf : 60,
            bbox: {
              x0: left,
              y0: top,
              x1: left + width,
              y1: top + height
            }
          });
        }
      }
    }
    return tsvWords;
  }

  return [];
}

function parseRawTesseractWords(rawWords, canvas, scale, cleanGray) {
  const invScale = scale > 0 ? 1 / scale : 1;
  const maxCanvasW = canvas.width * 0.88;
  const maxCanvasH = canvas.height * 0.16;

  return rawWords
    .filter((w) => {
      if (!w || !w.bbox) return false;
      const rawStr = String(w.text || "").trim().replace(/^\|+|\|+$/g, "").trim();
      if (!rawStr) return false;

      const boxW = (Number(w.bbox.x1) || 0) - (Number(w.bbox.x0) || 0);
      const boxH = (Number(w.bbox.y1) || 0) - (Number(w.bbox.y0) || 0);
      if (boxW < 5 || boxH < 7 || boxW > maxCanvasW || boxH > maxCanvasH) {
        return false;
      }

      const conf = typeof w.confidence === "number" ? w.confidence : 0;
      const isCodeLike = /[0-9]/.test(rawStr) && rawStr.length >= 3;
      const minConf = isCodeLike ? 20 : 38;
      return conf >= minConf;
    })
    .map((w) => {
      const rawStr = String(w.text).trim().replace(/^\|+|\|+$/g, "").trim();
      const canvasBox = {
        x0: Math.max(0, Number(w.bbox.x0) || 0),
        y0: Math.max(0, Number(w.bbox.y0) || 0),
        x1: Math.min(canvas.width, Number(w.bbox.x1) || 0),
        y1: Math.min(canvas.height, Number(w.bbox.y1) || 0)
      };

      const trimmedCanvasBox = refineWordBoundingBoxWithInk(
        canvasBox,
        rawStr,
        cleanGray,
        canvas.width,
        canvas.height
      );

      return {
        type: "word",
        text: rawStr,
        confidence: typeof w.confidence === "number" ? w.confidence : 50,
        bbox: {
          x0: trimmedCanvasBox.x0 * invScale,
          y0: trimmedCanvasBox.y0 * invScale,
          x1: trimmedCanvasBox.x1 * invScale,
          y1: trimmedCanvasBox.y1 * invScale
        }
      };
    })
    .filter((item) => item.text.length > 0 && !isBarcodeArtifactText(item.text, item.bbox));
}

async function detectWordBoxesWithTesseract(canvas, scale, cleanGray) {
  try {
    const worker = await withPromiseTimeout(getPersistentOcrWorker(), 4500, null);
    if (worker) {
      const recognizeRes = await withPromiseTimeout(
        worker.recognize(canvas, {}, { blocks: true, text: true, tsv: true }),
        8500,
        null
      );
      const data = recognizeRes && recognizeRes.data ? recognizeRes.data : null;
      return parseRawTesseractWords(
        extractWordsFromTesseractData(data),
        canvas,
        scale,
        cleanGray
      );
    }

    if (typeof window.Tesseract !== "undefined" && typeof window.Tesseract.recognize === "function") {
      const fallbackRes = await withPromiseTimeout(
        window.Tesseract.recognize(
          canvas,
          "eng",
          { logger: () => {}, tessedit_pageseg_mode: "11" },
          { blocks: true, text: true, tsv: true }
        ),
        8500,
        null
      );
      const data = fallbackRes && fallbackRes.data ? fallbackRes.data : null;
      return parseRawTesseractWords(
        extractWordsFromTesseractData(data),
        canvas,
        scale,
        cleanGray
      );
    }
  } catch (err) {}
  return [];
}

function isLabelPrefixToken(token) {
  return /^(S\/N|P\/N|SN|PN|NO|ID|LOT|BATCH|DESC|QTY|PCS)[:：]?$/i.test(String(token || "").trim());
}

function attachFallbackValuesToBarcodes(barcodeItems, wordItems) {
  if (!Array.isArray(barcodeItems) || barcodeItems.length === 0) return;

  barcodeItems.forEach((bc) => {
    if (bc.text) return;
    const b = bc.bbox;
    const bHeight = Math.max(14, b.y1 - b.y0);
    const maxSearchY = b.y1 + bHeight * 1.95;

    const candidatesBelow = wordItems
      .filter((w) => {
        const wMidY = (w.bbox.y0 + w.bbox.y1) / 2;
        const wMidX = (w.bbox.x0 + w.bbox.x1) / 2;
        const isBelow = wMidY >= b.y1 - 4 && wMidY <= maxSearchY;
        const isAlignedX = wMidX >= b.x0 - 52 && wMidX <= b.x1 + 52;
        const isCodeToken = /^[A-Za-z0-9\-_]{4,}$/.test(w.text) && !isLabelPrefixToken(w.text);
        return isBelow && isAlignedX && isCodeToken;
      })
      .sort((a, bWord) => {
        const distA = a.bbox.y0 - b.y1;
        const distB = bWord.bbox.y0 - b.y1;
        if (Math.abs(distA - distB) > 16) return distA - distB;
        return bWord.text.length - a.text.length;
      });

    if (candidatesBelow.length > 0) {
      bc.text = candidatesBelow[0].text;
    }
  });
}

function sortDetectedItemsReadingOrder(items) {
  return [...items].sort((a, b) => {
    const midAY = (a.bbox.y0 + a.bbox.y1) / 2;
    const midBY = (b.bbox.y0 + b.bbox.y1) / 2;
    const lineThreshold = Math.max(
      14,
      ((a.bbox.y1 - a.bbox.y0) + (b.bbox.y1 - b.bbox.y0)) * 0.32
    );
    if (Math.abs(midAY - midBY) > lineThreshold) {
      return midAY - midBY;
    }
    return a.bbox.x0 - b.bbox.x0;
  });
}

async function applyDetectedPhotoText(rawImageUrl, preDetectedQuad = null) {
  const token = ++ocrRunToken;
  clearPhotoLensState();
  setPhotoLensStatus("Memotong dokumen & mendeteksi huruf/angka...", false);

  try {
    // Auto-crop + filter bersih putih murni dengan teks hitam pekat seperti Gambar 4
    const processedDataUrl = await processDocumentAutoCropAndEnhance(rawImageUrl, preDetectedQuad);
    if (token !== ocrRunToken) return;

    if (capturedPhotoPreview) {
      capturedPhotoPreview.src = processedDataUrl;
      capturedPhotoPreview.classList.add("has-image");
    }

    const img = await loadImageElement(processedDataUrl);
    if (token !== ocrRunToken) return;

    ocrNaturalWidth = img.naturalWidth || img.width;
    ocrNaturalHeight = img.naturalHeight || img.height;

    const { canvas: enhancedCanvas, scale, cleanGray } = buildEnhancedCanvasForOcr(img);

    // Tahap 1: Deteksi barcode pada gambar hasil scan
    const nativeBarcodes = await detectBarcodeBoxesWithNativeDetector(img);
    if (token !== ocrRunToken) return;

    const stripeBarcodes = detectStripeBarcodeRegions(enhancedCanvas, scale);
    const barcodeItems = mergeDetectedBarcodes(nativeBarcodes, stripeBarcodes);

    await Promise.all(
      barcodeItems.map((bc) => decodeSingleBarcodeRegionFromImage(img, bc))
    );
    if (token !== ocrRunToken) return;

    if (barcodeItems.length > 0) {
      ocrWordItems = sortDetectedItemsReadingOrder(barcodeItems);
      selectedOcrIndices = ocrWordItems.map((_, idx) => idx);
      renderOcrWordBoxes();
      setPhotoLensStatus("Barcode terdeteksi • Membaca angka & huruf...", false);
    }

    // Tahap 2: Deteksi semua huruf & angka lalu auto-blok seluruhnya
    const tesseractWords = await detectWordBoxesWithTesseract(enhancedCanvas, scale, cleanGray);
    if (token !== ocrRunToken) return;

    const cleanWords = tesseractWords.filter(
      (wordItem) => !isBoxOverlappingBarcode(wordItem.bbox, barcodeItems)
    );

    attachFallbackValuesToBarcodes(barcodeItems, cleanWords);

    const combinedItems = sortDetectedItemsReadingOrder([...barcodeItems, ...cleanWords]);
    ocrWordItems = combinedItems;

    // Auto-blok semua huruf dan angka yang terdeteksi
    selectedOcrIndices = ocrWordItems.map((_, idx) => idx);
    renderOcrWordBoxes();

    if (ocrWordItems.length > 0) {
      setPhotoLensStatus("", true);
    } else {
      setPhotoLensStatus("Angka/huruf tidak terbaca, ketuk Foto Ulang", false);
    }
  } catch (err) {
    if (token !== ocrRunToken) return;
    setPhotoLensStatus("Gagal memproses foto, ketuk Foto Ulang", false);
  }
}

function getRenderedImageMetrics() {
  if (!photoLensStage || !ocrNaturalWidth || !ocrNaturalHeight) return null;
  const stageRect = photoLensStage.getBoundingClientRect();
  if (!stageRect.width || !stageRect.height) return null;

  const scale = Math.min(stageRect.width / ocrNaturalWidth, stageRect.height / ocrNaturalHeight);
  const renderedWidth = ocrNaturalWidth * scale;
  const renderedHeight = ocrNaturalHeight * scale;
  const offsetX = (stageRect.width - renderedWidth) / 2;
  const offsetY = (stageRect.height - renderedHeight) / 2;

  return {
    stageWidth: stageRect.width,
    stageHeight: stageRect.height,
    scale,
    offsetX,
    offsetY
  };
}

function updateFloatingActionBarPosition() {
  if (!photoLensActionBar || !photoOcrLayer || !photoLensStage) return;

  if (selectedOcrIndices.length === 0) {
    photoLensActionBar.classList.remove("visible");
    setPhotoLensStatus("Ketuk angka/barcode atau geser untuk memblok biru", false);
    return;
  }

  const stageRect = photoLensStage.getBoundingClientRect();
  let minLeft = Infinity;
  let minTop = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;

  selectedOcrIndices.forEach((idx) => {
    const boxEl = photoOcrLayer.querySelector(`[data-index="${idx}"]`);
    if (!boxEl) return;
    const left = parseFloat(boxEl.style.left) || 0;
    const top = parseFloat(boxEl.style.top) || 0;
    const width = parseFloat(boxEl.style.width) || 0;
    const height = parseFloat(boxEl.style.height) || 0;

    minLeft = Math.min(minLeft, left);
    minTop = Math.min(minTop, top);
    maxRight = Math.max(maxRight, left + width);
    maxBottom = Math.max(maxBottom, top + height);
  });

  if (!isFinite(minLeft)) {
    photoLensActionBar.classList.remove("visible");
    return;
  }

  photoLensActionBar.classList.add("visible");
  setPhotoLensStatus("", true);

  const barWidth = photoLensActionBar.offsetWidth || 196;
  const barHeight = photoLensActionBar.offsetHeight || 42;
  const gap = 10;

  let targetLeft = 0;
  let targetTop = (minTop + maxBottom) / 2 - barHeight / 2;

  // Prioritaskan penempatan di samping kanan atau kiri blok biru
  if (maxRight + gap + barWidth <= stageRect.width - 8) {
    targetLeft = maxRight + gap;
  } else if (minLeft - gap - barWidth >= 8) {
    targetLeft = minLeft - gap - barWidth;
  } else {
    // Jika blok melebar penuh layar, tempatkan tepat di tepi kanan/bawah blok dalam batas aman
    targetLeft = Math.max(8, Math.min(stageRect.width - barWidth - 8, maxRight - barWidth));
    if (maxBottom + gap + barHeight <= stageRect.height - 12) {
      targetTop = maxBottom + gap;
    } else if (minTop - gap - barHeight >= 56) {
      targetTop = minTop - gap - barHeight;
    }
  }

  targetLeft = Math.max(8, Math.min(stageRect.width - barWidth - 8, targetLeft));
  targetTop = Math.max(56, Math.min(stageRect.height - barHeight - 12, targetTop));

  photoLensActionBar.style.left = `${targetLeft}px`;
  photoLensActionBar.style.top = `${targetTop}px`;
}

function syncOcrSelectionVisuals() {
  if (!photoOcrLayer) return;
  const sorted = Array.from(new Set(selectedOcrIndices)).sort((a, b) => a - b);
  selectedOcrIndices = sorted;

  const firstIdx = sorted.length > 0 ? sorted[0] : -1;
  const lastIdx = sorted.length > 0 ? sorted[sorted.length - 1] : -1;

  const boxes = photoOcrLayer.querySelectorAll(".ocr-word-box, .ocr-barcode-box");
  boxes.forEach((box) => {
    const idx = Number(box.getAttribute("data-index"));
    const isSelected = sorted.includes(idx);
    box.classList.toggle("selected", isSelected);
    box.classList.toggle("is-first", isSelected && idx === firstIdx);
    box.classList.toggle("is-last", isSelected && idx === lastIdx);
  });

  updateFloatingActionBarPosition();
}

function renderOcrWordBoxes() {
  if (!photoOcrLayer) return;
  const metrics = getRenderedImageMetrics();
  photoOcrLayer.innerHTML = "";
  if (!metrics || ocrWordItems.length === 0) return;

  ocrWordItems.forEach((item, index) => {
    const box = document.createElement("div");
    box.className = item.type === "barcode" ? "ocr-barcode-box" : "ocr-word-box";
    box.setAttribute("data-index", String(index));
    box.setAttribute("role", "button");
    box.setAttribute("aria-label", item.text || "Barcode");

    const padX = 2;
    const padY = item.type === "barcode" ? 2 : 1.5;

    const left = metrics.offsetX + item.bbox.x0 * metrics.scale - padX;
    const top = metrics.offsetY + item.bbox.y0 * metrics.scale - padY;
    const width = Math.max(12, (item.bbox.x1 - item.bbox.x0) * metrics.scale + padX * 2);
    const height = Math.max(14, (item.bbox.y1 - item.bbox.y0) * metrics.scale + padY * 2);

    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;

    photoOcrLayer.appendChild(box);
  });

  syncOcrSelectionVisuals();
}

function findWordIndexAtPoint(clientX, clientY) {
  if (!photoOcrLayer) return -1;
  const boxes = photoOcrLayer.querySelectorAll(".ocr-word-box, .ocr-barcode-box");
  let closestIdx = -1;
  let closestDist = Infinity;

  boxes.forEach((box) => {
    const rect = box.getBoundingClientRect();
    const pad = 6;
    if (
      clientX >= rect.left - pad &&
      clientX <= rect.right + pad &&
      clientY >= rect.top - pad &&
      clientY <= rect.bottom + pad
    ) {
      const cx = (rect.left + rect.right) / 2;
      const cy = (rect.top + rect.bottom) / 2;
      const dist = Math.hypot(clientX - cx, clientY - cy);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = Number(box.getAttribute("data-index"));
      }
    }
  });

  return closestIdx;
}

function selectItemsInDragRect(startPt, endPt, anchorIdx) {
  if (!photoOcrLayer || !startPt || !endPt) return;
  const minX = Math.min(startPt.x, endPt.x) - 5;
  const maxX = Math.max(startPt.x, endPt.x) + 5;
  const minY = Math.min(startPt.y, endPt.y) - 5;
  const maxY = Math.max(startPt.y, endPt.y) + 5;

  const hits = new Set();
  if (anchorIdx >= 0) {
    hits.add(anchorIdx);
  }

  const boxes = photoOcrLayer.querySelectorAll(".ocr-word-box, .ocr-barcode-box");
  boxes.forEach((box) => {
    const rect = box.getBoundingClientRect();
    const intersects =
      rect.right >= minX &&
      rect.left <= maxX &&
      rect.bottom >= minY &&
      rect.top <= maxY;
    if (intersects) {
      hits.add(Number(box.getAttribute("data-index")));
    }
  });

  if (hits.size > 0) {
    selectedOcrIndices = Array.from(hits);
    syncOcrSelectionVisuals();
  }
}

function setupPhotoOcrInteractions() {
  if (!photoOcrLayer) return;

  photoOcrLayer.addEventListener("pointerdown", (e) => {
    if (e.target.closest("#photo-lens-action-bar")) return;
    const hitIdx = findWordIndexAtPoint(e.clientX, e.clientY);
    isOcrDragging = true;
    ocrDragStartIdx = hitIdx >= 0 ? hitIdx : -1;
    ocrDragStartPoint = { x: e.clientX, y: e.clientY };
    ocrDragMoved = false;
    try {
      photoOcrLayer.setPointerCapture(e.pointerId);
    } catch (err) {}
  });

  photoOcrLayer.addEventListener("pointermove", (e) => {
    if (!isOcrDragging || !ocrDragStartPoint) return;
    const dist = Math.hypot(e.clientX - ocrDragStartPoint.x, e.clientY - ocrDragStartPoint.y);
    if (dist > 8) {
      ocrDragMoved = true;
      selectItemsInDragRect(ocrDragStartPoint, { x: e.clientX, y: e.clientY }, ocrDragStartIdx);
    }
  });

  const finishPointerSelection = (e) => {
    if (!isOcrDragging) return;
    const startIdx = ocrDragStartIdx;
    const wasDragged = ocrDragMoved;
    isOcrDragging = false;
    ocrDragStartIdx = -1;
    ocrDragStartPoint = null;
    ocrDragMoved = false;

    try {
      if (e && typeof e.pointerId === "number") {
        photoOcrLayer.releasePointerCapture(e.pointerId);
      }
    } catch (err) {}

    if (!wasDragged) {
      if (startIdx >= 0) {
        const existingPos = selectedOcrIndices.indexOf(startIdx);
        if (existingPos >= 0) {
          selectedOcrIndices.splice(existingPos, 1);
        } else {
          selectedOcrIndices.push(startIdx);
        }
        syncOcrSelectionVisuals();
      } else if (selectedOcrIndices.length > 0) {
        selectedOcrIndices = [];
        syncOcrSelectionVisuals();
      }
    }
  };

  photoOcrLayer.addEventListener("pointerup", finishPointerSelection);
  photoOcrLayer.addEventListener("pointercancel", finishPointerSelection);
}

setupPhotoOcrInteractions();

window.addEventListener("resize", () => {
  if (photoLensOverlay && photoLensOverlay.classList.contains("open") && ocrWordItems.length > 0) {
    renderOcrWordBoxes();
  }
});

function cleanSelectedWordTokens(rawWords) {
  const cleaned = rawWords
    .map((w) => String(w || "").trim().replace(/^[:：]+|[:：]+$/g, "").trim())
    .filter(Boolean);

  if (cleaned.length <= 1) {
    return cleaned;
  }

  const withoutLabels = cleaned.filter((token) => !isLabelPrefixToken(token));
  return withoutLabels.length > 0 ? withoutLabels : cleaned;
}

function getSelectedPhotoSelection() {
  if (selectedOcrIndices.length === 0) {
    return { text: "", format: "", hasSelection: false };
  }

  const selectedItems = selectedOcrIndices
    .map((idx) => ocrWordItems[idx])
    .filter(Boolean);

  if (selectedItems.length === 0) {
    return { text: "", format: "", hasSelection: false };
  }

  const selectedBarcodes = selectedItems.filter((item) => item.type === "barcode");
  const selectedWords = selectedItems.filter((item) => item.type === "word");
  const cleanedWordTokens = cleanSelectedWordTokens(selectedWords.map((w) => w.text));

  if (selectedBarcodes.length > 0) {
    const decodedBarcodeTexts = Array.from(
      new Set(selectedBarcodes.map((bc) => String(bc.text || "").trim()).filter(Boolean))
    );
    const primaryFormat = selectedBarcodes[0].format || "CODE_128";

    if (decodedBarcodeTexts.length > 0) {
      const extraDistinctWords = cleanedWordTokens.filter(
        (token) => !decodedBarcodeTexts.includes(token)
      );
      const combined =
        extraDistinctWords.length > 0
          ? `${decodedBarcodeTexts.join(" ")} ${extraDistinctWords.join(" ")}`.trim()
          : decodedBarcodeTexts.join(" ");

      return {
        text: combined,
        format: primaryFormat,
        hasSelection: true
      };
    }

    if (cleanedWordTokens.length > 0) {
      const codeTokens = cleanedWordTokens.filter((token) => /^[A-Za-z0-9\-_]{4,}$/.test(token));
      const finalTokens = codeTokens.length > 0 ? codeTokens : cleanedWordTokens;
      return {
        text: finalTokens.join(" ").trim(),
        format: primaryFormat,
        hasSelection: true
      };
    }

    return { text: "", format: primaryFormat, hasSelection: true };
  }

  const joinedText = cleanedWordTokens.join(" ").trim();
  return {
    text: joinedText,
    format: joinedText ? detectScanFormatType(joinedText, "OCR Text") : "",
    hasSelection: true
  };
}

function retakePhotoOnly() {
  ocrRunToken += 1;
  clearPhotoLensState();
  if (photoLensOverlay) {
    photoLensOverlay.classList.remove("open");
  }
  if (photoShutterBtn) {
    photoShutterBtn.classList.remove("active");
  }
  if (activeAppFeature === "text-to-qr") {
    currentRoute = "text-to-qr";
    startDocumentBoundaryDetector();
  } else if (activeAppFeature === "scan-to-excel" && isExcelTextPhotoMode) {
    currentRoute = "scan-to-excel-scan:text-mode";
    startDocumentBoundaryDetector();
  }
  if (!isScanLocked && activeAppFeature !== "menu") {
    resumeCameraForNextScan();
  }
}

function triggerPhotoCapture() {
  // Di menu Scan to Excel: klik foto pertama kali masuk ke mode kamera Text to QR + auto-detect dulu
  if (activeAppFeature === "scan-to-excel" && !isExcelTextPhotoMode) {
    enterExcelTextPhotoMode();
    return;
  }

  const capturedQuad = lastDetectedDocQuad ? lastDetectedDocQuad.map((p) => ({ ...p })) : null;
  clearPhotoLensState();
  const snapDataUrl = captureSnapshotFromVideo();
  openPhotoLensPanel();

  if (snapDataUrl) {
    applyDetectedPhotoText(snapDataUrl, capturedQuad);
  } else if (photoCaptureInput) {
    setPhotoLensStatus("Ambil foto angka atau huruf...", false);
    photoCaptureInput.value = "";
    photoCaptureInput.click();
  }
}

function triggerGalleryPhotoPick() {
  if (photoGalleryInput) {
    photoGalleryInput.value = "";
    photoGalleryInput.click();
  }
}

function writeTextToClipboardSafe(text) {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
    return;
  }
  try {
    const tempArea = document.createElement("textarea");
    tempArea.value = text;
    tempArea.style.position = "fixed";
    tempArea.style.opacity = "0";
    document.body.appendChild(tempArea);
    tempArea.select();
    document.execCommand("copy");
    document.body.removeChild(tempArea);
  } catch (err) {}
}

function copyPhotoText() {
  const { text: targetVal, hasSelection } = getSelectedPhotoSelection();
  if (!targetVal) {
    setPhotoLensStatus(
      hasSelection
        ? "Kode batang tidak terbaca, blok angka di bawahnya atau Foto Ulang"
        : "Ketuk angka/barcode untuk memblok biru terlebih dahulu",
      false
    );
    return;
  }
  writeTextToClipboardSafe(targetVal);
  if (activeAppFeature === "1d-to-qr") {
    addQrScanNote(targetVal);
  }
  if (activeAppFeature === "scan-to-excel" && isExcelTextPhotoMode) {
    const depthToPop = excelPhotoHistoryDepth;
    excelPhotoHistoryDepth = 0;
    ocrRunToken += 1;
    clearPhotoLensState();
    if (photoLensOverlay) photoLensOverlay.classList.remove("open");
    if (photoShutterBtn) photoShutterBtn.classList.remove("active");
    exitExcelTextPhotoMode(true);
    showExcelScanToast(`Teks disalin: ${targetVal}`);
    if (depthToPop > 0) {
      ignorePopStateCount = depthToPop;
      try {
        window.history.go(-depthToPop);
      } catch (err) {
        ignorePopStateCount = 0;
      }
    }
    return;
  }
  closePhotoLensPanel();
  if (activeAppFeature === "1d-to-qr") {
    showQrNotesFeedback("Teks dari foto disalin!", false);
  } else if (statusBadge) {
    statusBadge.style.display = "inline-block";
    statusBadge.textContent = "Teks Tersalin!";
  }
}

function createBarcodeFromPhotoText() {
  const { text: targetVal, format: detectedFormat, hasSelection } = getSelectedPhotoSelection();
  if (!targetVal) {
    setPhotoLensStatus(
      hasSelection
        ? "Kode batang tidak terbaca, blok angka di bawahnya atau Foto Ulang"
        : "Ketuk angka/barcode untuk memblok biru terlebih dahulu",
      false
    );
    return;
  }
  writeTextToClipboardSafe(targetVal);

  // Di menu Scan to Excel: langsung salin ke Excel & kembali ke mode scan barcode standar
  if (activeAppFeature === "scan-to-excel") {
    const depthToPop = excelPhotoHistoryDepth;
    excelPhotoHistoryDepth = 0;
    ocrRunToken += 1;
    clearPhotoLensState();
    if (photoLensOverlay) {
      photoLensOverlay.classList.remove("open");
    }
    if (photoShutterBtn) {
      photoShutterBtn.classList.remove("active");
    }
    isScanLocked = false;
    lastScanned = "";
    pendingScanData = null;
    resetCandidateScan();
    exitExcelTextPhotoMode(true);
    addScannedItemToExcel(targetVal);

    if (depthToPop > 0) {
      ignorePopStateCount = depthToPop;
      try {
        window.history.go(-depthToPop);
      } catch (err) {
        ignorePopStateCount = 0;
      }
    }
    return;
  }

  // Di menu Text to QR: pertahankan photoLensOverlay terbuka di bawah modal QR agar Back fisik kembali ke gambar foto lagi
  isScanLocked = false;
  lastScanned = "";
  pendingScanData = null;
  resetCandidateScan();

  const resolvedFormat = detectedFormat || detectScanFormatType(targetVal, "OCR Text");
  generateQR(targetVal, resolvedFormat);
  completeScan();
}

function handlePhotoFileSelected(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const resultUrl = ev.target && ev.target.result ? String(ev.target.result) : "";
    if (resultUrl) {
      openPhotoLensPanel();
      applyDetectedPhotoText(resultUrl, null);
    }
  };
  reader.readAsDataURL(file);
}

if (photoCaptureInput) {
  photoCaptureInput.addEventListener("change", handlePhotoFileSelected);
}

if (photoGalleryInput) {
  photoGalleryInput.addEventListener("change", handlePhotoFileSelected);
}

// 7B. Fitur Notes Hasil Scan dengan Checklist (Menu 1D to QR)
function showQrNotesFeedback(msg, isWarning = false) {
  if (!qrNotesFeedback) return;
  qrNotesFeedback.textContent = msg;
  qrNotesFeedback.classList.toggle("warn", Boolean(isWarning));
  qrNotesFeedback.classList.add("visible");
  if (qrNotesFeedbackTimer) {
    clearTimeout(qrNotesFeedbackTimer);
  }
  qrNotesFeedbackTimer = setTimeout(() => {
    qrNotesFeedback.classList.remove("visible");
  }, 1800);
}

function addQrScanNote(rawText) {
  const cleanText = String(rawText || "").trim();
  if (!cleanText) return;
  qrScanNotes.push({
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text: cleanText,
    checked: false
  });
  renderQrScanNotes();
}

function toggleQrNoteChecked(noteId) {
  const item = qrScanNotes.find((n) => n.id === noteId);
  if (!item) return;
  item.checked = !item.checked;
  renderQrScanNotes();
}

function removeQrNoteById(noteId) {
  qrScanNotes = qrScanNotes.filter((n) => n.id !== noteId);
  renderQrScanNotes();
}

function clearAllQrNotes() {
  if (qrScanNotes.length === 0) return;
  qrScanNotes = [];
  renderQrScanNotes();
  showQrNotesFeedback("Semua notes hasil scan dihapus.", false);
}

function copyAllQrNotes() {
  if (qrScanNotes.length === 0) return;
  qrScanNotes.forEach((item) => {
    item.checked = true;
  });
  renderQrScanNotes();
  const payload = qrScanNotes.map((item) => item.text).join("\n");
  writeTextToClipboardSafe(payload);
  showQrNotesFeedback(`Semua (${qrScanNotes.length}) hasil scan dicentang & disalin!`, false);
}

function copySelectedQrNotes() {
  if (qrScanNotes.length === 0) return;
  const selectedItems = qrScanNotes.filter((item) => item.checked);
  if (selectedItems.length === 0) {
    showQrNotesFeedback("Centang minimal 1 kotak hasil scan terlebih dahulu.", true);
    return;
  }
  const payload = selectedItems.map((item) => item.text).join("\n");
  writeTextToClipboardSafe(payload);
  showQrNotesFeedback(`${selectedItems.length} hasil scan pilihan disalin!`, false);
}

function renderQrScanNotes() {
  const totalCount = qrScanNotes.length;
  const checkedCount = qrScanNotes.filter((item) => item.checked).length;

  if (qrNotesCount) {
    qrNotesCount.textContent = `${totalCount} item`;
  }
  if (qrCopyAllBtn) {
    qrCopyAllBtn.disabled = totalCount === 0;
  }
  if (qrCopySelectedBtn) {
    qrCopySelectedBtn.disabled = checkedCount === 0;
    qrCopySelectedBtn.textContent = checkedCount > 0 ? `Salin Pilihan (${checkedCount})` : "Salin Pilihan";
  }
  if (qrClearNotesBtn) {
    qrClearNotesBtn.disabled = totalCount === 0;
  }
  if (!qrNotesList) return;

  if (totalCount === 0) {
    qrNotesList.innerHTML =
      '<div class="qr-notes-empty">Belum ada hasil scan. Hasil scan akan muncul berurutan ke bawah di sini.</div>';
    return;
  }

  qrNotesList.innerHTML = qrScanNotes
    .map((item, index) => {
      const safeId = escapeHtmlSafe(item.id);
      const checkedAttr = item.checked ? "checked" : "";
      const rowClass = item.checked ? "qr-note-item checked" : "qr-note-item";
      return `<div class="${rowClass}">
        <input
          type="checkbox"
          id="chk_${safeId}"
          class="qr-note-checkbox"
          ${checkedAttr}
          onchange="toggleQrNoteChecked('${safeId}')"
        />
        <label for="chk_${safeId}" class="qr-note-label">
          <span class="qr-note-num">${index + 1}.</span>
          <span class="qr-note-text">${escapeHtmlSafe(item.text)}</span>
        </label>
        <button type="button" class="qr-note-del-btn" onclick="removeQrNoteById('${safeId}')" aria-label="Hapus item">✕</button>
      </div>`;
    })
    .join("");

  qrNotesList.scrollTop = qrNotesList.scrollHeight;
}

// 8. Fitur Scan to Excel (Multi-Kolom, Urutan Kolom Otomatis & Generator .xlsx Murni)
function escapeHtmlSafe(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showExcelScanToast(msg) {
  if (!excelScanToast) return;
  excelScanToast.textContent = msg;
  excelScanToast.classList.add("visible");
  if (excelToastTimer) {
    clearTimeout(excelToastTimer);
  }
  excelToastTimer = setTimeout(() => {
    excelScanToast.classList.remove("visible");
  }, 1700);
}

function selectExcelTargetColumn(colIdx) {
  const task = getActiveExcelTask();
  if (!task) return;
  if (colIdx < 0 || colIdx >= task.columns.length) return;
  task.activeColIndex = colIdx;
  saveExcelTasksToStorage();
  renderExcelSessionTable();
}

function getExcelNextTargetInfo(task) {
  if (!task || !Array.isArray(task.columns) || task.columns.length === 0) {
    return { colIndex: 0, colName: "Kolom 1", rowNumber: 1 };
  }
  const colIndex = Math.max(0, Math.min(task.columns.length - 1, task.activeColIndex || 0));
  const colName = task.columns[colIndex] || `Kolom ${colIndex + 1}`;
  const lastRow = task.rows.length > 0 ? task.rows[task.rows.length - 1] : null;
  const willAppendToLastRow =
    task.sequentialColumns &&
    task.columns.length > 1 &&
    colIndex > 0 &&
    lastRow &&
    !lastRow[colIndex];

  const rowNumber = willAppendToLastRow ? task.rows.length : task.rows.length + 1;
  return { colIndex, colName, rowNumber };
}

function addScannedItemToExcel(rawText) {
  const cleanText = String(rawText || "").trim();
  const task = getActiveExcelTask();
  if (!cleanText || !task) return;

  const colCount = Math.max(1, task.columns.length);
  const targetCol = Math.max(0, Math.min(colCount - 1, task.activeColIndex || 0));
  const targetColName = task.columns[targetCol] || `Kolom ${targetCol + 1}`;

  if (task.sequentialColumns && colCount > 1) {
    const lastRow = task.rows.length > 0 ? task.rows[task.rows.length - 1] : null;
    if (targetCol > 0 && lastRow && !lastRow[targetCol]) {
      lastRow[targetCol] = cleanText;
    } else {
      const freshRow = new Array(colCount).fill("");
      freshRow[targetCol] = cleanText;
      task.rows.push(freshRow);
    }
    task.activeColIndex = (targetCol + 1) % colCount;
  } else {
    const freshRow = new Array(colCount).fill("");
    freshRow[targetCol] = cleanText;
    task.rows.push(freshRow);
  }

  saveExcelTasksToStorage();
  renderExcelSessionTable();

  const nextColName = task.columns[task.activeColIndex] || task.columns[0];
  const nextHint =
    task.sequentialColumns && colCount > 1 ? ` • Lanjut: ${nextColName}` : "";
  showExcelScanToast(`Masuk [${targetColName}]: ${cleanText}${nextHint}`);
}

function removeExcelSessionRow(index) {
  const task = getActiveExcelTask();
  if (!task || index < 0 || index >= task.rows.length) return;
  task.rows.splice(index, 1);
  if (task.rows.length === 0) {
    task.activeColIndex = 0;
  }
  saveExcelTasksToStorage();
  renderExcelSessionTable();
}

function renderExcelSessionTable() {
  const task = getActiveExcelTask();
  if (!task) return;

  if (excelActiveTaskName) {
    excelActiveTaskName.textContent = task.name;
  }
  if (excelRowCount) {
    excelRowCount.textContent = `${task.rows.length} baris`;
  }
  if (excelDownloadBtn) {
    excelDownloadBtn.disabled = task.rows.length === 0;
  }

  if (excelTargetColBar) {
    excelTargetColBar.innerHTML = task.columns
      .map((colName, idx) => {
        const isActive = idx === (task.activeColIndex || 0);
        const prefix = isActive ? "Target: " : "";
        return `<button type="button" class="excel-col-pill${isActive ? " active" : ""}" onclick="selectExcelTargetColumn(${idx})">${prefix}${idx + 1}. ${escapeHtmlSafe(colName)}</button>`;
      })
      .join("");
  }

  if (excelRowsThead) {
    const thCols = task.columns.map((c) => `<th>${escapeHtmlSafe(c)}</th>`).join("");
    excelRowsThead.innerHTML = `<tr><th>No</th>${thCols}<th>Aksi</th></tr>`;
  }

  if (!excelRowsTbody) return;

  if (task.rows.length === 0) {
    excelRowsTbody.innerHTML = `<tr class="excel-empty-row"><td colspan="${task.columns.length + 2}">Belum ada data. Arahkan kamera ke barcode/QR untuk mulai mencatat.</td></tr>`;
    return;
  }

  const rowsHtml = task.rows
    .map((rowArr, idx) => {
      const cellsHtml = task.columns
        .map((_, cIdx) => {
          const val = rowArr[cIdx] || "";
          return `<td>${val ? `<strong>${escapeHtmlSafe(val)}</strong>` : '<span style="color:#94a3b8;">-</span>'}</td>`;
        })
        .join("");
      return `<tr>
        <td>${idx + 1}</td>
        ${cellsHtml}
        <td><button type="button" class="excel-del-row-btn" onclick="removeExcelSessionRow(${idx})">Hapus</button></td>
      </tr>`;
    })
    .reverse()
    .join("");

  excelRowsTbody.innerHTML = rowsHtml;
}

function escapeXmlValue(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnIndexToExcelLetter(colIdx) {
  let letter = "";
  let temp = colIdx;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

function computeCrc32Bytes(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc & 1) ? ((crc >>> 1) ^ 0xedb88320) : (crc >>> 1);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildStoredZipBlob(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  entries.forEach((entry) => {
    const nameBytes = encoder.encode(entry.name);
    const dataBytes = encoder.encode(entry.content);
    const crc = computeCrc32Bytes(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lView = new DataView(localHeader.buffer);
    lView.setUint32(0, 0x04034b50, true);
    lView.setUint16(4, 20, true);
    lView.setUint16(6, 0, true);
    lView.setUint16(8, 0, true);
    lView.setUint16(10, 0, true);
    lView.setUint16(12, 0x0021, true);
    lView.setUint32(14, crc, true);
    lView.setUint32(18, dataBytes.length, true);
    lView.setUint32(22, dataBytes.length, true);
    lView.setUint16(26, nameBytes.length, true);
    lView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cView = new DataView(centralHeader.buffer);
    cView.setUint32(0, 0x02014b50, true);
    cView.setUint16(4, 20, true);
    cView.setUint16(6, 20, true);
    cView.setUint16(8, 0, true);
    cView.setUint16(10, 0, true);
    cView.setUint16(12, 0, true);
    cView.setUint16(14, 0x0021, true);
    cView.setUint32(16, crc, true);
    cView.setUint32(20, dataBytes.length, true);
    cView.setUint32(24, dataBytes.length, true);
    cView.setUint16(28, nameBytes.length, true);
    cView.setUint16(30, 0, true);
    cView.setUint16(32, 0, true);
    cView.setUint16(34, 0, true);
    cView.setUint16(36, 0, true);
    cView.setUint32(38, 0, true);
    cView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  });

  const centralDirSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = new Uint8Array(22);
  const eView = new DataView(endRecord.buffer);
  eView.setUint32(0, 0x06054b50, true);
  eView.setUint16(4, 0, true);
  eView.setUint16(6, 0, true);
  eView.setUint16(8, entries.length, true);
  eView.setUint16(10, entries.length, true);
  eView.setUint32(12, centralDirSize, true);
  eView.setUint32(16, offset, true);
  eView.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, endRecord], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

function exportExcelTaskObject(task) {
  if (!task || !Array.isArray(task.rows) || task.rows.length === 0) return;

  const sheetRows = [
    ["No", ...task.columns],
    ...task.rows.map((rowArr, idx) => [
      idx + 1,
      ...task.columns.map((_, cIdx) => rowArr[cIdx] || "")
    ])
  ];

  const rowsXml = sheetRows
    .map((row, rIdx) => {
      const rowNum = rIdx + 1;
      const cellsXml = row
        .map((val, cIdx) => {
          const cellRef = `${columnIndexToExcelLetter(cIdx)}${rowNum}`;
          if (typeof val === "number") {
            return `<c r="${cellRef}" t="n"><v>${val}</v></c>`;
          }
          return `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXmlValue(val)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowNum}">${cellsXml}</row>`;
    })
    .join("");

  const colsXml = [
    `<col min="1" max="1" width="8" customWidth="1"/>`,
    ...task.columns.map(
      (_, idx) => `<col min="${idx + 2}" max="${idx + 2}" width="28" customWidth="1"/>`
    )
  ].join("\n    ");

  const zipEntries = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Hasil Scan" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>
    ${colsXml}
  </cols>
  <sheetData>${rowsXml}</sheetData>
</worksheet>`
    }
  ];

  const xlsxBlob = buildStoredZipBlob(zipEntries);
  const url = URL.createObjectURL(xlsxBlob);
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(
    now.getMinutes()
  ).padStart(2, "0")}`;
  const safeBaseName = task.name.replace(/[^A-Za-z0-9_\-]/g, "_") || "Hasil_Scan";

  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeBaseName}_${stamp}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function exportScannedListToExcel() {
  const task = getActiveExcelTask();
  if (!task || task.rows.length === 0) return;
  exportExcelTaskObject(task);
}

function exportExcelTaskById(taskId) {
  const task = excelTasks.find((t) => t.id === taskId);
  if (!task || task.rows.length === 0) return;
  exportExcelTaskObject(task);
}

function toggleAutoZoom() {
  isAutoZoomEnabled = !isAutoZoomEnabled;
  if (autoZoomBtn) {
    autoZoomBtn.classList.toggle("active", isAutoZoomEnabled);
  }
  updateAutoZoomBadge();
}

function updateAutoZoomBadge() {
  if (!autoZoomBadge) return;
  autoZoomBadge.textContent = isAutoZoomEnabled
    ? `Auto Zoom: ${currentZoom.toFixed(1)}x`
    : `Manual Zoom: ${currentZoom.toFixed(1)}x`;
}

async function applyCameraZoomValue(val) {
  const clamped = Math.max(minZoomSupported, Math.min(maxZoomSupported, Number(val)));
  currentZoom = clamped;

  if (zoomSlider) {
    zoomSlider.value = clamped;
  }
  if (zoomValue) {
    zoomValue.textContent = `${clamped.toFixed(1)}x`;
  }
  updateAutoZoomBadge();

  if (!isCameraRunning || !isZoomSupported) return;
  try {
    const advancedConstraint = { zoom: clamped };
    if (isFocusSupported) {
      advancedConstraint.focusMode = "continuous";
    }
    await html5QrCode.applyVideoConstraints({
      advanced: [advancedConstraint]
    });
  } catch (err) {}
}

function startAutoZoomCycle() {
  if (autoZoomTimer) {
    clearInterval(autoZoomTimer);
  }
  autoZoomTimer = setInterval(() => {
    if (!isAutoZoomEnabled || !isCameraRunning || isScanLocked || document.visibilityState !== "visible") {
      return;
    }
    const targetMax = Math.min(maxZoomSupported, Math.max(minZoomSupported + 0.4, 2.0));
    const step = 0.2;
    let nextZoom = currentZoom + step * autoZoomDirection;

    if (nextZoom >= targetMax) {
      nextZoom = targetMax;
      autoZoomDirection = -1;
    } else if (nextZoom <= minZoomSupported) {
      nextZoom = minZoomSupported;
      autoZoomDirection = 1;
    }

    applyCameraZoomValue(Number(nextZoom.toFixed(1)));
  }, 3600);
}

// 9. Kontrol Bottom Sheet Hasil Scan & Full Screen QR
function openScanSheet(cleanText, formatName) {
  scannedItemsCount += 1;
  if (sheetScannedCount) {
    sheetScannedCount.textContent = "Scanned";
  }
  if (sheetBarcodeValue) {
    sheetBarcodeValue.textContent = cleanText;
  }
  if (sheetFormatValue) {
    sheetFormatValue.textContent = formatName;
  }

  if (activeAppFeature === "scan-to-excel") {
    const task = getActiveExcelTask();
    const targetInfo = getExcelNextTargetInfo(task);
    if (sheetExcelColRow) {
      sheetExcelColRow.style.display = "flex";
    }
    if (sheetExcelColValue) {
      sheetExcelColValue.textContent = `${targetInfo.colName} (Baris #${targetInfo.rowNumber})`;
    }
    if (statusBadge) {
      statusBadge.style.display = "inline-block";
      statusBadge.textContent = "Siap Masuk Excel";
    }
  } else {
    if (sheetExcelColRow) {
      sheetExcelColRow.style.display = "none";
    }
    if (statusBadge) {
      statusBadge.style.display = "none";
      statusBadge.textContent = "";
    }
  }

  const wasOpen = scanResultSheet && scanResultSheet.classList.contains("open");
  if (scanResultSheet) {
    scanResultSheet.style.transform = "";
    scanResultSheet.classList.add("open");
  }
  if (sheetBackdrop) {
    sheetBackdrop.classList.add("open");
  }
  if (!wasOpen) {
    isSheetHistoryPushed = true;
    pushAppHistoryState(`${currentRoute}:sheet`);
  }
}

function closeScanSheetOnly() {
  if (scanResultSheet) {
    scanResultSheet.style.transform = "";
    scanResultSheet.classList.remove("open", "dragging");
  }
  if (sheetBackdrop) {
    sheetBackdrop.classList.remove("open");
  }
}

function dismissScanSheet(fromBack = false) {
  if (!fromBack && scanResultSheet && scanResultSheet.classList.contains("open")) {
    if (isSheetHistoryPushed && window.history.length > 1) {
      window.history.back();
      return;
    }
  }
  isSheetHistoryPushed = false;
  closeScanSheetOnly();
  isScanLocked = false;
  lastScanned = "";
  pendingScanData = null;
  resetCandidateScan();
  if (statusBadge) {
    statusBadge.textContent = activeAppFeature === "scan-to-excel" ? "Scan Dibatalkan" : "";
    statusBadge.classList.remove("ready");
  }
  if (activeAppFeature === "scan-to-excel") {
    currentRoute = "scan-to-excel-scan";
  } else if (activeAppFeature === "1d-to-qr" || activeAppFeature === "text-to-qr") {
    currentRoute = activeAppFeature;
  }
  resumeCameraForNextScan();
}

function completeScan() {
  const activeCode = (pendingScanData && pendingScanData.text) || lastScanned;
  if (!activeCode) return;

  if (activeAppFeature === "scan-to-excel") {
    addScannedItemToExcel(activeCode);
    closeScanSheetOnly();
    isScanLocked = false;
    lastScanned = "";
    pendingScanData = null;
    resetCandidateScan();
    currentRoute = "scan-to-excel-scan";
    if (isSheetHistoryPushed && window.history.length > 1) {
      isSheetHistoryPushed = false;
      ignoreNextSheetPopState = true;
      try {
        window.history.back();
      } catch (err) {
        ignoreNextSheetPopState = false;
      }
    }
    resumeCameraForNextScan();
    return;
  }

  closeScanSheetOnly();
  if (fullscreenQrModal) {
    fullscreenQrModal.classList.add("open");
    fullscreenQrModal.setAttribute("aria-hidden", "false");
    const isFromPhotoLens =
      activeAppFeature === "text-to-qr" &&
      photoLensOverlay &&
      photoLensOverlay.classList.contains("open");
    const qrModalRoute = isFromPhotoLens
      ? "text-to-qr:photo-lens:qr-modal"
      : `${activeAppFeature}:qr-modal`;
    if (isSheetHistoryPushed) {
      replaceAppHistoryState(qrModalRoute);
    } else {
      pushAppHistoryState(qrModalRoute);
    }
    isSheetHistoryPushed = false;
  }
}

function closeFullscreenQrModal() {
  if (fullscreenQrModal) {
    fullscreenQrModal.classList.remove("open");
    fullscreenQrModal.setAttribute("aria-hidden", "true");
  }
}

function setupSheetSwipeDismiss() {
  if (!scanResultSheet) return;
  const swipeTarget = sheetDragHandle || scanResultSheet;

  swipeTarget.addEventListener(
    "touchstart",
    (e) => {
      if (!scanResultSheet.classList.contains("open") || !e.touches || e.touches.length === 0) return;
      isSheetDragging = true;
      sheetStartY = e.touches[0].clientY;
      sheetCurrentDeltaY = 0;
      scanResultSheet.classList.add("dragging");
    },
    { passive: true }
  );

  swipeTarget.addEventListener(
    "touchmove",
    (e) => {
      if (!isSheetDragging || !e.touches || e.touches.length === 0) return;
      const deltaY = e.touches[0].clientY - sheetStartY;
      if (deltaY > 0) {
        sheetCurrentDeltaY = deltaY;
        scanResultSheet.style.transform = `translateY(${deltaY}px)`;
      }
    },
    { passive: true }
  );

  const finishSwipe = () => {
    if (!isSheetDragging) return;
    isSheetDragging = false;
    scanResultSheet.classList.remove("dragging");
    if (sheetCurrentDeltaY > 75) {
      dismissScanSheet();
    } else {
      scanResultSheet.style.transform = "";
    }
    sheetCurrentDeltaY = 0;
  };

  swipeTarget.addEventListener("touchend", finishSwipe);
  swipeTarget.addEventListener("touchcancel", finishSwipe);
}

setupSheetSwipeDismiss();

function detectScanFormatType(value, fallbackLabel = "") {
  const trimmed = value.trim();
  if (/^\d{8}$/.test(trimmed)) return "EAN_8";
  if (/^\d{12}$/.test(trimmed)) return "UPC_A";
  if (/^\d{13}$/.test(trimmed)) return "EAN_13";
  if (/^https?:\/\//i.test(trimmed)) return "QR_CODE";
  if (/^[A-Za-z0-9\-_]{6,}$/.test(trimmed)) return "CODE_128";
  return fallbackLabel || `Scan ${currentScanMode.toUpperCase()}`;
}

function generateQR(text, formatName = "Scan") {
  const cleanText = text.trim();
  if (!cleanText || isScanLocked || cleanText === lastScanned) return;

  isScanLocked = true;
  lastScanned = cleanText;
  pendingScanData = { text: cleanText, format: formatName };
  resetCandidateScan();
  pauseCameraForSingleScan();
  triggerScanFeedback();

  decodedTextEl.textContent = cleanText;
  formatInfoEl.textContent = `Format terbaca: ${formatName}`;

  if (activeAppFeature === "1d-to-qr") {
    addQrScanNote(cleanText);
    if (statusBadge) {
      statusBadge.style.display = "none";
      statusBadge.textContent = "";
      statusBadge.classList.remove("ready");
    }
  } else if (activeAppFeature === "scan-to-excel") {
    if (statusBadge) {
      statusBadge.style.display = "inline-block";
      statusBadge.textContent = "Siap Masuk Excel";
      statusBadge.classList.add("ready");
    }
  } else {
    if (statusBadge) {
      statusBadge.style.display = "none";
      statusBadge.textContent = "";
      statusBadge.classList.remove("ready");
    }
  }

  if (activeAppFeature !== "scan-to-excel") {
    qrWrapper.innerHTML = "";
    new QRCode(qrWrapper, {
      text: cleanText,
      width: 260,
      height: 260,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  openScanSheet(cleanText, formatName);
}

function handleManualSubmit() {
  if (isTextPhotoCameraActive()) return;
  if (scannerInput.value.trim() !== "") {
    const rawVal = scannerInput.value.trim();
    const detectedFmt = detectScanFormatType(rawVal);

    isScanLocked = false;
    lastScanned = "";
    pendingScanData = null;
    resetCandidateScan();
    generateQR(rawVal, detectedFmt);
    scannerInput.value = "";
  }
}

scannerInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    handleManualSubmit();
  }
});

// Deteksi otomatis input cepat dari scanner fisik (barcode scanner keyboard wedge)
let physicalScannerBuffer = "";
let physicalScannerTimer = null;

document.addEventListener("keydown", (e) => {
  if (
    activeAppFeature === "menu" ||
    isTextPhotoCameraActive() ||
    currentRoute === "scan-to-excel-hub" ||
    currentRoute === "scan-to-excel-new"
  ) {
    return;
  }
  const activeTag = document.activeElement ? document.activeElement.tagName : "";
  if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (e.key === "Enter") {
    if (physicalScannerBuffer.length >= 3) {
      const code = physicalScannerBuffer;
      physicalScannerBuffer = "";
      const detectedFmt = detectScanFormatType(code);

      isScanLocked = false;
      lastScanned = "";
      pendingScanData = null;
      resetCandidateScan();
      generateQR(code, detectedFmt);
    }
    physicalScannerBuffer = "";
    return;
  }

  if (e.key.length === 1) {
    physicalScannerBuffer += e.key;
    clearTimeout(physicalScannerTimer);
    physicalScannerTimer = setTimeout(() => {
      physicalScannerBuffer = "";
    }, 120);
  }
});

function copyText() {
  if (!lastScanned) return;
  writeTextToClipboardSafe(lastScanned);

  if (sheetCopyBtn) {
    sheetCopyBtn.textContent = "Tersalin!";
    setTimeout(() => {
      sheetCopyBtn.textContent = "Salin Teks";
    }, 1400);
  }

  if (activeAppFeature === "scan-to-excel" && statusBadge) {
    statusBadge.style.display = "inline-block";
    statusBadge.textContent = "Teks Tersalin!";
    setTimeout(() => {
      statusBadge.textContent = isScanLocked ? "Siap Masuk Excel" : "QR Code Siap Scan";
    }, 1500);
  }
}

function downloadQR() {
  const img = qrWrapper.querySelector("img");
  const canvas = qrWrapper.querySelector("canvas");
  const dataUrl = img ? img.src : canvas ? canvas.toDataURL("image/png") : null;
  if (!dataUrl) return;

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `QR_${lastScanned}.png`;
  link.click();
}

function resetScan(fromBack = false) {
  if (!fromBack && fullscreenQrModal && fullscreenQrModal.classList.contains("open")) {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
  }
  isSheetHistoryPushed = false;
  closeFullscreenQrModal();
  closeScanSheetOnly();
  isScanLocked = false;
  lastScanned = "";
  pendingScanData = null;
  resetCandidateScan();
  decodedTextEl.textContent = "-";
  formatInfoEl.textContent = "Format: -";
  if (statusBadge) {
    statusBadge.textContent = activeAppFeature === "scan-to-excel" ? "Menunggu Scan..." : "";
    statusBadge.classList.remove("ready");
    if (activeAppFeature !== "scan-to-excel") {
      statusBadge.style.display = "none";
    }
  }
  qrWrapper.innerHTML =
    '<span style="color:#8d8d8d; font-size:0.85rem;">QR Code akan muncul di sini</span>';
  scannerInput.value = "";

  // Di menu Text to QR: setelah selesai buat barcode & klik Back, kembali ke tampilan gambar foto lagi
  if (
    activeAppFeature === "text-to-qr" &&
    photoLensOverlay &&
    photoLensOverlay.classList.contains("open")
  ) {
    currentRoute = "text-to-qr:photo-lens";
    if (ocrWordItems.length > 0) {
      renderOcrWordBoxes();
    }
    return;
  }

  ocrRunToken += 1;
  clearPhotoLensState();
  if (photoLensOverlay) {
    photoLensOverlay.classList.remove("open");
  }
  if (photoShutterBtn) {
    photoShutterBtn.classList.remove("active");
  }
  if (activeAppFeature === "1d-to-qr" || activeAppFeature === "text-to-qr") {
    currentRoute = activeAppFeature;
  }
  if (activeAppFeature === "text-to-qr") {
    startDocumentBoundaryDetector();
  }
  if (activeAppFeature !== "menu") {
    resumeCameraForNextScan();
  }
}

// 10. Inisialisasi Kamera Scanner Dual-Engine (ZXing 1D/2D + Native BarcodeDetector Resolusi Penuh)
function getSupportedFormats() {
  const f = typeof Html5QrcodeSupportedFormats !== "undefined" ? Html5QrcodeSupportedFormats : {};
  const list = [
    f.QR_CODE,
    f.AZTEC,
    f.CODABAR,
    f.CODE_39,
    f.CODE_93,
    f.CODE_128,
    f.DATA_MATRIX,
    f.MAXICODE,
    f.ITF,
    f.EAN_13,
    f.EAN_8,
    f.PDF_417,
    f.RSS_14,
    f.RSS_EXPANDED,
    f.UPC_A,
    f.UPC_E,
    f.UPC_EAN_EXTENSION
  ];
  return list.filter((item) => item !== undefined);
}

const html5QrCode = new Html5Qrcode("reader", {
  formatsToSupport: getSupportedFormats(),
  experimentalFeatures: {
    useBarCodeDetectorIfSupported: false
  },
  verbose: false
});

function calculateDynamicQrBox(viewfinderWidth, viewfinderHeight) {
  if (currentScanMode === "square") {
    const size = Math.floor(Math.max(180, Math.min(viewfinderWidth - 36, viewfinderHeight - 120, 248)));
    return { width: size, height: size };
  }

  if (currentScanMode === "bar") {
    const width = Math.floor(Math.max(220, Math.min(viewfinderWidth - 36, 404)));
    const height = Math.floor(Math.max(96, Math.min(104, viewfinderHeight * 0.22)));
    return { width, height };
  }

  return {
    width: Math.floor(Math.max(220, viewfinderWidth * 0.92)),
    height: Math.floor(Math.max(220, Math.min(viewfinderHeight * 0.68, viewfinderWidth * 1.15)))
  };
}

const config = {
  fps: 24,
  disableFlip: false,
  qrbox: calculateDynamicQrBox
};

async function applyFocusConstraint(mode = "continuous") {
  if (!isCameraRunning) return false;
  try {
    await html5QrCode.applyVideoConstraints({
      advanced: [{ focusMode: mode }]
    });
    return true;
  } catch (err) {
    return false;
  }
}

async function triggerAutoFocus(showIndicator = true) {
  if (!isCameraRunning || isScanLocked) return;

  if (showIndicator && scannerViewport) {
    scannerViewport.classList.add("refocusing");
    setTimeout(() => {
      scannerViewport.classList.remove("refocusing");
    }, 260);
  }

  try {
    const capabilities = html5QrCode.getRunningTrackCapabilities();
    const supportedModes = Array.isArray(capabilities?.focusMode) ? capabilities.focusMode : [];

    if (supportedModes.includes("single-shot")) {
      await applyFocusConstraint("single-shot");
      if (supportedModes.includes("continuous")) {
        setTimeout(() => {
          applyFocusConstraint("continuous").catch(() => {});
        }, 220);
      }
      return;
    }

    if (supportedModes.includes("continuous")) {
      await applyFocusConstraint("continuous");
      return;
    }

    await applyFocusConstraint("continuous");
  } catch (err) {}
}

function startAutoFocusLoop() {
  if (autoFocusTimer) {
    clearInterval(autoFocusTimer);
  }
  autoFocusTimer = setInterval(() => {
    if (isCameraRunning && !isScanLocked && document.visibilityState === "visible") {
      triggerAutoFocus(false);
    }
  }, 4500);
}

if (scannerViewport) {
  scannerViewport.addEventListener("click", (e) => {
    if (
      e.target.closest(".scan-top-overlay") ||
      e.target.closest(".scan-bottom-controls") ||
      e.target.closest("#scan-guide") ||
      e.target.closest("#photo-lens-overlay")
    ) {
      return;
    }
    triggerAutoFocus(true);
  });
}

async function upgradeCameraResolutionIfSupported() {
  if (!isCameraRunning) return;
  try {
    await html5QrCode.applyVideoConstraints({
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    });
  } catch (err) {}
}

function setupCameraCapabilities() {
  upgradeCameraResolutionIfSupported();

  try {
    const capabilities = html5QrCode.getRunningTrackCapabilities();

    if (capabilities && Array.isArray(capabilities.focusMode) && capabilities.focusMode.length > 0) {
      isFocusSupported = true;
      triggerAutoFocus(false);
      startAutoFocusLoop();
    } else {
      isFocusSupported = false;
      triggerAutoFocus(false);
      startAutoFocusLoop();
    }

    if (capabilities && capabilities.torch) {
      isFlashSupported = true;
      flashBtn.disabled = false;
      flashStatus.textContent = isFocusSupported
        ? "Auto fokus aktif • Flash tersedia — ketuk ikon lampu untuk menyalakan."
        : "Flash tersedia — ketuk ikon lampu untuk menyalakan.";
    } else {
      isFlashSupported = false;
      flashBtn.disabled = true;
      flashStatus.textContent = isFocusSupported
        ? "Auto fokus aktif • Flash tidak didukung di perangkat ini."
        : "Flash tidak didukung di kamera/browser ini.";
    }

    if (capabilities && capabilities.zoom) {
      isZoomSupported = true;
      minZoomSupported = capabilities.zoom.min || 1;
      maxZoomSupported = Math.min(capabilities.zoom.max || 4, 5);
      const stepZoom = capabilities.zoom.step || 0.1;

      zoomSlider.min = minZoomSupported;
      zoomSlider.max = maxZoomSupported;
      zoomSlider.step = stepZoom;
      zoomSlider.value = minZoomSupported;
      currentZoom = Number(minZoomSupported);
      zoomValue.textContent = `${currentZoom.toFixed(1)}x`;
      if (autoZoomBtn) {
        autoZoomBtn.classList.toggle("active", isAutoZoomEnabled);
      }
      updateAutoZoomBadge();

      if (!isZoomSliderBound) {
        isZoomSliderBound = true;
        zoomSlider.addEventListener("input", async (e) => {
          isAutoZoomEnabled = false;
          if (autoZoomBtn) {
            autoZoomBtn.classList.remove("active");
          }
          await applyCameraZoomValue(parseFloat(e.target.value));
        });
      }

      startAutoZoomCycle();
    } else {
      isZoomSupported = false;
      updateAutoZoomBadge();
    }
  } catch (err) {
    isFlashSupported = false;
    flashBtn.disabled = true;
    flashStatus.textContent = "Status flash tidak dapat dideteksi.";
  }
}

async function toggleFlash() {
  if (!isCameraRunning || !isFlashSupported) return;

  const nextState = !isFlashOn;
  try {
    const advancedConstraint = { torch: nextState };
    if (isFocusSupported) {
      advancedConstraint.focusMode = "continuous";
    }
    await html5QrCode.applyVideoConstraints({
      advanced: [advancedConstraint]
    });
    isFlashOn = nextState;
    flashBtn.classList.toggle("active", isFlashOn);
    flashStatus.textContent = isFlashOn
      ? "Cahaya flash aktif untuk menerangi barcode."
      : "Cahaya flash dimatikan.";
    triggerAutoFocus(false);
  } catch (err) {
    flashStatus.textContent = "Gagal mengubah status flash di perangkat ini.";
  }
}

function getRequiredConfirmHits(fmt, cleanText) {
  if (cleanText.length <= 3) {
    return 2;
  }
  return 1;
}

function onScanSuccess(decodedText, decodedResult) {
  if (
    activeAppFeature === "menu" ||
    isTextPhotoCameraActive() ||
    currentRoute === "scan-to-excel-hub" ||
    currentRoute === "scan-to-excel-new"
  ) {
    return;
  }
  if (isScanLocked) return;

  const cleanText = String(decodedText || "").trim();
  if (cleanText.length < 3) return;

  const fmt = decodedResult?.result?.format?.formatName || "Terdeteksi";
  const now = Date.now();

  for (const [key, entry] of scanCandidateHistory.entries()) {
    if (now > entry.expiresAt) {
      scanCandidateHistory.delete(key);
    }
  }

  const candidateKey = `${fmt}::${cleanText}`;
  const existing = scanCandidateHistory.get(candidateKey);
  const nextHits = existing ? existing.hits + 1 : 1;
  scanCandidateHistory.set(candidateKey, {
    hits: nextHits,
    expiresAt: now + 1400
  });

  const requiredHits = getRequiredConfirmHits(fmt, cleanText);
  if (nextHits >= requiredHits) {
    generateQR(cleanText, fmt);
  }
}

function buildLiveCropCanvasFromVideo() {
  const videoEl = document.querySelector("#reader video");
  if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth || !videoEl.videoHeight) {
    return null;
  }

  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  const vpRect = scannerViewport ? scannerViewport.getBoundingClientRect() : null;
  const cw = vpRect && vpRect.width ? vpRect.width : vw;
  const ch = vpRect && vpRect.height ? vpRect.height : vh;

  const coverScale = Math.max(cw / vw, ch / vh);
  const visibleW = Math.min(vw, cw / coverScale);
  const visibleH = Math.min(vh, ch / coverScale);

  let cropW = visibleW;
  let cropH = visibleH;

  if (currentScanMode === "square") {
    const guidePx = 248;
    cropW = Math.min(vw, (guidePx / coverScale) * 1.08);
    cropH = Math.min(vh, (guidePx / coverScale) * 1.08);
  } else if (currentScanMode === "bar") {
    const guideW = Math.max(220, cw - 36);
    const guideH = 104;
    cropW = Math.min(vw, (guideW / coverScale) * 1.08);
    cropH = Math.min(vh, (guideH / coverScale) * 1.15);
  }

  const sx = Math.max(0, Math.floor((vw - cropW) / 2));
  const sy = Math.max(0, Math.floor((vh - cropH) / 2));
  const sw = Math.max(16, Math.min(vw - sx, Math.ceil(cropW)));
  const sh = Math.max(16, Math.min(vh - sy, Math.ceil(cropH)));

  const quietPad = 24;
  const canvas = document.createElement("canvas");
  canvas.width = sw + quietPad * 2;
  canvas.height = sh + quietPad * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(videoEl, sx, sy, sw, sh, quietPad, quietPad, sw, sh);
  return canvas;
}

async function runNativeLiveFrameScan() {
  if (
    isNativeLiveScanBusy ||
    !isCameraRunning ||
    isScanLocked ||
    activeAppFeature === "menu" ||
    isTextPhotoCameraActive() ||
    currentRoute === "scan-to-excel-hub" ||
    currentRoute === "scan-to-excel-new" ||
    document.visibilityState !== "visible" ||
    (photoLensOverlay && photoLensOverlay.classList.contains("open"))
  ) {
    return;
  }

  isNativeLiveScanBusy = true;
  try {
    const cropCanvas = buildLiveCropCanvasFromVideo();
    if (!cropCanvas) return;

    const detected = await detectBarcodeBoxesWithNativeDetector(cropCanvas);
    if (!detected || detected.length === 0 || isScanLocked) return;

    const validItems = detected.filter((item) => item.text && item.text.length >= 3);
    if (validItems.length === 0) return;

    const midX = cropCanvas.width / 2;
    const midY = cropCanvas.height / 2;
    validItems.sort((a, b) => {
      const distA = Math.hypot((a.bbox.x0 + a.bbox.x1) / 2 - midX, (a.bbox.y0 + a.bbox.y1) / 2 - midY);
      const distB = Math.hypot((b.bbox.x0 + b.bbox.x1) / 2 - midX, (b.bbox.y0 + b.bbox.y1) / 2 - midY);
      return distA - distB;
    });

    const best = validItems[0];
    onScanSuccess(best.text, {
      result: {
        format: {
          formatName: best.format || detectScanFormatType(best.text, "Terdeteksi")
        }
      }
    });
  } catch (err) {
  } finally {
    isNativeLiveScanBusy = false;
  }
}

function startNativeLiveScanner() {
  if (typeof window.BarcodeDetector === "undefined") return;
  if (nativeLiveScanTimer) {
    clearInterval(nativeLiveScanTimer);
  }
  nativeLiveScanTimer = setInterval(runNativeLiveFrameScan, 160);
}

function ensureCameraStarted() {
  if (isCameraRunning) {
    resumeCameraForNextScan();
    return;
  }
  if (isCameraStarting) return;

  isCameraStarting = true;
  html5QrCode
    .start(
      { facingMode: "environment" },
      config,
      onScanSuccess,
      () => {}
    )
    .then(() => {
      isCameraStarting = false;
      isCameraRunning = true;
      startNativeLiveScanner();
      setTimeout(setupCameraCapabilities, 350);
    })
    .catch(() => {
      isCameraStarting = false;
      isCameraRunning = false;
      flashBtn.disabled = true;
      flashStatus.textContent = "Kamera tidak aktif.";
      const readerEl = document.getElementById("reader");
      if (readerEl) {
        readerEl.innerHTML =
          `<div style="color:#fff; padding:24px; text-align:center; font-size:0.9rem;">
            Kamera tidak aktif atau membutuhkan akses HTTPS.<br/>Gunakan tombol foto atau ikon keyboard di bawah.
          </div>`;
      }
    });
}

async function stopCameraGracefully() {
  stopDocumentBoundaryDetector();
  if (nativeLiveScanTimer) {
    clearInterval(nativeLiveScanTimer);
    nativeLiveScanTimer = null;
  }
  if (autoFocusTimer) {
    clearInterval(autoFocusTimer);
    autoFocusTimer = null;
  }
  if (autoZoomTimer) {
    clearInterval(autoZoomTimer);
    autoZoomTimer = null;
  }

  isFlashOn = false;
  if (flashBtn) {
    flashBtn.classList.remove("active");
    flashBtn.disabled = true;
  }

  if (!isCameraRunning) return;
  try {
    await html5QrCode.stop();
  } catch (err) {}
  isCameraRunning = false;
}
