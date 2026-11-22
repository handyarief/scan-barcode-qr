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
const fullscreenQrModal = document.getElementById("fullscreen-qr-modal");

// Elemen Menu Utama & Sesi Scan to Excel
const appHeaderTitle = document.getElementById("app-header-title");
const appHeaderSubtitle = document.getElementById("app-header-subtitle");
const backMenuBtn = document.getElementById("back-menu-btn");
const homeMenuView = document.getElementById("home-menu-view");
const scannerCard = document.getElementById("scanner-card");
const scanTopOverlay = document.getElementById("scan-top-overlay");
const excelScanToast = document.getElementById("excel-scan-toast");
const excelSessionPanel = document.getElementById("excel-session-panel");
const excelRowCount = document.getElementById("excel-row-count");
const excelDownloadBtn = document.getElementById("excel-download-btn");
const excelRowsTbody = document.getElementById("excel-rows-tbody");

let activeAppFeature = "menu"; // "menu" | "1d-to-qr" | "scan-to-excel" | "text-to-qr"
let excelSessionItems = [];
let lastExcelScanCode = "";
let lastExcelScanTime = 0;
let excelToastTimer = null;

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

// 4. Navigasi Menu Utama Sebelum Scan
function openFeatureMenu(feature) {
  const validFeatures = ["1d-to-qr", "scan-to-excel", "text-to-qr"];
  if (!validFeatures.includes(feature)) return;

  activeAppFeature = feature;
  closeFullscreenQrModal();
  closeScanSheetOnly();
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
  resetCandidateScan();

  if (homeMenuView) {
    homeMenuView.style.display = "none";
  }
  if (scannerCard) {
    scannerCard.style.display = "flex";
    scannerCard.classList.toggle("excel-mode", feature === "scan-to-excel");
  }
  if (backMenuBtn) {
    backMenuBtn.style.display = "inline-block";
  }

  if (feature === "1d-to-qr") {
    if (appHeaderTitle) appHeaderTitle.textContent = "1D to QR";
    if (appHeaderSubtitle) appHeaderSubtitle.textContent = "Semua Barcode 1D/2D atau scanner fisik";
    if (scanTopOverlay) scanTopOverlay.style.display = "";
    if (excelSessionPanel) excelSessionPanel.style.display = "none";
    if (galleryPhotoBtn) galleryPhotoBtn.style.display = "none";
    if (manualSubmitBtn) manualSubmitBtn.textContent = "Buat QR";
    if (lensCreateQrBtn) lensCreateQrBtn.textContent = "Buat Barkode";
    setScanMode(currentScanMode || "full");
  } else if (feature === "scan-to-excel") {
    if (appHeaderTitle) appHeaderTitle.textContent = "Scan to Excel";
    if (appHeaderSubtitle) appHeaderSubtitle.textContent = "Scan biasa, hasil langsung masuk ke Excel";
    if (scanTopOverlay) scanTopOverlay.style.display = "";
    if (excelSessionPanel) excelSessionPanel.style.display = "flex";
    if (galleryPhotoBtn) galleryPhotoBtn.style.display = "none";
    if (manualSubmitBtn) manualSubmitBtn.textContent = "Tambah Excel";
    if (lensCreateQrBtn) lensCreateQrBtn.textContent = "Masuk Excel";
    setScanMode(currentScanMode || "full");
    renderExcelSessionTable();
  } else if (feature === "text-to-qr") {
    if (appHeaderTitle) appHeaderTitle.textContent = "Text to QR";
    if (appHeaderSubtitle) appHeaderSubtitle.textContent = "Foto teks/SN lalu pilih blok menjadi QR";
    if (scanTopOverlay) scanTopOverlay.style.display = "none";
    if (excelSessionPanel) excelSessionPanel.style.display = "none";
    if (galleryPhotoBtn) galleryPhotoBtn.style.display = "inline-flex";
    if (manualSubmitBtn) manualSubmitBtn.textContent = "Buat QR";
    if (lensCreateQrBtn) lensCreateQrBtn.textContent = "Buat QR";
    if (scannerViewport) {
      scannerViewport.classList.remove("mode-square", "mode-bar");
      scannerViewport.classList.add("mode-full");
    }
  }

  ensureCameraStarted();
}

async function backToMainMenu() {
  activeAppFeature = "menu";
  closeFullscreenQrModal();
  closeScanSheetOnly();
  ocrRunToken += 1;
  clearPhotoLensState();

  if (photoLensOverlay) {
    photoLensOverlay.classList.remove("open");
  }
  if (photoShutterBtn) {
    photoShutterBtn.classList.remove("active");
  }
  if (zoomBox) {
    zoomBox.classList.remove("open");
  }
  if (zoomToggleBtn) {
    zoomToggleBtn.classList.remove("active");
  }
  if (manualPanel) {
    manualPanel.classList.remove("open");
  }
  if (keyboardToggleBtn) {
    keyboardToggleBtn.classList.remove("active");
  }

  isScanLocked = false;
  lastScanned = "";
  resetCandidateScan();

  if (scannerCard) {
    scannerCard.style.display = "none";
    scannerCard.classList.remove("excel-mode");
  }
  if (excelSessionPanel) {
    excelSessionPanel.style.display = "none";
  }
  if (backMenuBtn) {
    backMenuBtn.style.display = "none";
  }
  if (homeMenuView) {
    homeMenuView.style.display = "flex";
  }
  if (appHeaderTitle) {
    appHeaderTitle.textContent = "Scan Barcode → QR Code";
  }
  if (appHeaderSubtitle) {
    appHeaderSubtitle.textContent = "Pilih fitur pemindaian di bawah";
  }

  await stopCameraGracefully();
}

// 5. Getar & bunyi beep singkat saat scan berhasil
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

// 6. Fitur Foto Ala Google Lens & OCR Akurasi Tinggi (Normalisasi Lokal + Anti-Garis Tabel + Ink Trimming)
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
}

function openPhotoLensPanel() {
  if (!photoLensOverlay || !photoShutterBtn) return;
  photoLensOverlay.classList.add("open");
  photoShutterBtn.classList.add("active");
  pauseCameraForSingleScan();
}

function closePhotoLensPanel() {
  ocrRunToken += 1;
  clearPhotoLensState();
  if (photoLensOverlay) {
    photoLensOverlay.classList.remove("open");
  }
  if (photoShutterBtn) {
    photoShutterBtn.classList.remove("active");
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

function suppressLongTableLinesOnGrayBuffer(grayBuf, width, height) {
  // Hapus garis tabel horizontal panjang agar tidak menyatu dengan karakter SN di atas/bawahnya
  const minHorizRun = Math.max(80, Math.floor(width * 0.28));
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

  // Hapus garis batas kolom vertikal panjang agar tidak melebar ke kolom samping
  const minVertRun = Math.max(90, Math.floor(height * 0.28));
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
  const targetMaxDim = 2200;
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

    // Estimasi pencahayaan latar lokal (grid tile) agar area redup di tengah kertas ikut terang merata
    const tileSize = Math.max(24, Math.round(Math.min(width, height) / 18));
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
        // Kontras S-curve ringan untuk mempertegas tinta SN terhadap kertas putih
        const stretched = rel < 165 ? rel * 0.76 : Math.min(255, 165 + (rel - 165) * 1.18);
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
        const isDark = lum < 128;
        if (x > 2 && isDark !== prevDark) {
          transitions += 1;
          if (x < firstX) firstX = x;
          if (x > lastX) lastX = x;
        }
        prevDark = isDark;
      }

      const span = Math.max(1, lastX - firstX);
      if (transitions >= 22 && span > w * 0.2) {
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
      const active = y < h && rowScores[y] > 0.055;
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
        if (bandHeight >= Math.max(22, h * 0.03) && countRows >= 5) {
          const avgMinX = Math.max(0, sumMinX / countRows - 6);
          const avgMaxX = Math.min(w, sumMaxX / countRows + 6);
          const bandWidth = avgMaxX - avgMinX;
          if (bandWidth > bandHeight * 1.25) {
            regions.push({
              type: "barcode",
              text: "",
              format: "CODE_39",
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

function buildBinarizedCropCanvas(sourceCanvas) {
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
    const threshold = Math.max(85, Math.min(205, meanLum * 0.88));

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

  const marginX = Math.round(bWidth * 0.16);
  const marginY = Math.round(bHeight * 0.24);
  const sx = Math.max(0, Math.floor(bc.bbox.x0 - marginX));
  const sy = Math.max(0, Math.floor(bc.bbox.y0 - marginY));
  const sw = Math.min(naturalW - sx, Math.ceil(bWidth + marginX * 2));
  const sh = Math.min(naturalH - sy, Math.ceil(bHeight + marginY * 2));
  if (sw <= 10 || sh <= 10) return;

  const quietPad = 48;
  const upScale = sw < 800 ? 2 : 1;
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

  const binCanvas = buildBinarizedCropCanvas(cropCanvas);
  const binNative = await detectBarcodeBoxesWithNativeDetector(binCanvas);
  const matchedBinNative = binNative.find((item) => item.text && item.text.length >= 2);
  if (matchedBinNative) {
    bc.text = matchedBinNative.text;
    if (matchedBinNative.format) bc.format = matchedBinNative.format;
    return;
  }

  const zxingRes =
    (await scanBarcodeFromCanvasWithFileDecoder(cropCanvas)) ||
    (await scanBarcodeFromCanvasWithFileDecoder(binCanvas));
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

  // Hitung kepadatan piksel tinta gelap per kolom di dalam kotak
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

  // Pangkas baris atas/bawah yang kosong atau sisa garis horizontal penuh
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
  // Hitung ulang proyeksi kolom hanya pada rentang tinggi huruf aktual
  const activeColCounts = new Uint16Array(bw);
  for (let y = y0 + trimY0; y <= y0 + trimY1; y += 1) {
    const rOff = y * imgW;
    for (let x = x0; x < x1; x += 1) {
      if (cleanGray[rOff + x] < inkThreshold) {
        activeColCounts[x - x0] += 1;
      }
    }
  }

  // Kelompokkan segmen tinta horizontal yang terpisah celah lebar (mencegah kotak melebar selebar tabel)
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

  // Pilih segmen tinta utama yang paling sesuai dengan panjang teks karakter
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
      const minConf = isCodeLike ? 22 : 42;
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

function computeBoxIoU(boxA, boxB) {
  const interX0 = Math.max(boxA.x0, boxB.x0);
  const interY0 = Math.max(boxA.y0, boxB.y0);
  const interX1 = Math.min(boxA.x1, boxB.x1);
  const interY1 = Math.min(boxA.y1, boxB.y1);
  if (interX1 <= interX0 || interY1 <= interY0) return 0;

  const interArea = (interX1 - interX0) * (interY1 - interY0);
  const areaA = Math.max(1, (boxA.x1 - boxA.x0) * (boxA.y1 - boxA.y0));
  const areaB = Math.max(1, (boxB.x1 - boxB.x0) * (boxB.y1 - boxB.y0));
  return interArea / Math.max(1, areaA + areaB - interArea);
}

function mergeUniqueWordDetections(primaryWords, secondaryWords) {
  const merged = [...primaryWords];
  secondaryWords.forEach((cand) => {
    const candMidX = (cand.bbox.x0 + cand.bbox.x1) / 2;
    const candMidY = (cand.bbox.y0 + cand.bbox.y1) / 2;

    const duplicateIdx = merged.findIndex((existing) => {
      if (computeBoxIoU(existing.bbox, cand.bbox) > 0.28) return true;
      const exMidX = (existing.bbox.x0 + existing.bbox.x1) / 2;
      const exMidY = (existing.bbox.y0 + existing.bbox.y1) / 2;
      const sameRow = Math.abs(exMidY - candMidY) < Math.max(10, (existing.bbox.y1 - existing.bbox.y0) * 0.55);
      const sameCol = Math.abs(exMidX - candMidX) < Math.max(18, (existing.bbox.x1 - existing.bbox.x0) * 0.45);
      return sameRow && sameCol;
    });

    if (duplicateIdx < 0) {
      merged.push(cand);
    } else {
      const existing = merged[duplicateIdx];
      // Jika kandidat kedua menangkap SN lebih lengkap dan panjangnya wajar, perbarui
      if (cand.text.length > existing.text.length && cand.confidence >= existing.confidence - 8) {
        merged[duplicateIdx] = cand;
      }
    }
  });
  return merged;
}

async function detectWordBoxesWithTesseract(canvas, scale, cleanGray) {
  if (typeof window.Tesseract === "undefined" || typeof window.Tesseract.recognize !== "function") {
    return [];
  }
  try {
    // Pass 1: Sparse Text (PSM 11) agar setiap baris SN di tengah tabel terdeteksi tanpa terlewat
    const sparseResult = await window.Tesseract.recognize(
      canvas,
      "eng",
      {
        logger: () => {},
        tessedit_pageseg_mode: "11"
      },
      { blocks: true, text: true, tsv: true }
    );
    const sparseData = sparseResult && sparseResult.data ? sparseResult.data : null;
    const sparseWords = parseRawTesseractWords(
      extractWordsFromTesseractData(sparseData),
      canvas,
      scale,
      cleanGray
    );

    // Pass 2: Auto/Block Layout (PSM 3) untuk melengkapi jika ada kata terstruktur yang terlewat di Pass 1
    const blockResult = await window.Tesseract.recognize(
      canvas,
      "eng",
      {
        logger: () => {},
        tessedit_pageseg_mode: "3"
      },
      { blocks: true, text: true, tsv: true }
    );
    const blockData = blockResult && blockResult.data ? blockResult.data : null;
    const blockWords = parseRawTesseractWords(
      extractWordsFromTesseractData(blockData),
      canvas,
      scale,
      cleanGray
    );

    return mergeUniqueWordDetections(sparseWords, blockWords);
  } catch (err) {
    return [];
  }
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
    const maxSearchY = b.y1 + bHeight * 1.85;

    const candidatesBelow = wordItems
      .filter((w) => {
        const wMidY = (w.bbox.y0 + w.bbox.y1) / 2;
        const wMidX = (w.bbox.x0 + w.bbox.x1) / 2;
        const isBelow = wMidY >= b.y1 - 4 && wMidY <= maxSearchY;
        const isAlignedX = wMidX >= b.x0 - 48 && wMidX <= b.x1 + 48;
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

  const barWidth = photoLensActionBar.offsetWidth || 184;
  const barHeight = photoLensActionBar.offsetHeight || 42;
  const halfBar = barWidth / 2;

  const centerX = (minLeft + maxRight) / 2;
  const clampedCenterX = Math.max(halfBar + 10, Math.min(stageRect.width - halfBar - 10, centerX));

  let targetTop = minTop - 10;
  if (targetTop - barHeight < 56) {
    targetTop = Math.min(stageRect.height - 12, maxBottom + barHeight + 14);
  }

  photoLensActionBar.style.left = `${clampedCenterX}px`;
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
    const primaryFormat = selectedBarcodes[0].format || "CODE_39";

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

function getSelectedPhotoText() {
  return getSelectedPhotoSelection().text;
}

async function applyDetectedPhotoText(imageUrl) {
  const token = ++ocrRunToken;
  clearPhotoLensState();
  setPhotoLensStatus("Mendeteksi semua SN, angka & barcode...", false);

  try {
    const img = await loadImageElement(imageUrl);
    if (token !== ocrRunToken) return;

    ocrNaturalWidth = img.naturalWidth || img.width;
    ocrNaturalHeight = img.naturalHeight || img.height;

    const { canvas: enhancedCanvas, scale, cleanGray } = buildEnhancedCanvasForOcr(img);

    const [nativeBarcodes, tesseractWords] = await Promise.all([
      detectBarcodeBoxesWithNativeDetector(img),
      detectWordBoxesWithTesseract(enhancedCanvas, scale, cleanGray)
    ]);
    if (token !== ocrRunToken) return;

    const stripeBarcodes = detectStripeBarcodeRegions(enhancedCanvas, scale);
    const barcodeItems = mergeDetectedBarcodes(nativeBarcodes, stripeBarcodes);

    await Promise.all(
      barcodeItems.map((bc) => decodeSingleBarcodeRegionFromImage(img, bc))
    );
    if (token !== ocrRunToken) return;

    const cleanWords = tesseractWords.filter(
      (wordItem) => !isBoxOverlappingBarcode(wordItem.bbox, barcodeItems)
    );

    attachFallbackValuesToBarcodes(barcodeItems, cleanWords);

    const combinedItems = [...barcodeItems, ...cleanWords];

    combinedItems.sort((a, b) => {
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

    ocrWordItems = combinedItems;
    renderOcrWordBoxes();

    if (ocrWordItems.length > 0) {
      setPhotoLensStatus("Ketuk angka/barcode atau geser untuk memblok biru", false);
    } else {
      setPhotoLensStatus("Angka/huruf tidak terbaca, ketuk Foto Ulang", false);
    }
  } catch (err) {
    if (token !== ocrRunToken) return;
    setPhotoLensStatus("Gagal memproses foto, ketuk Foto Ulang", false);
  }
}

function retakePhotoOnly() {
  openPhotoLensPanel();
  if (photoCaptureInput) {
    photoCaptureInput.value = "";
    photoCaptureInput.click();
  }
}

function triggerPhotoCapture() {
  clearPhotoLensState();
  const snapDataUrl = captureSnapshotFromVideo();
  openPhotoLensPanel();

  if (snapDataUrl && capturedPhotoPreview) {
    capturedPhotoPreview.src = snapDataUrl;
    capturedPhotoPreview.classList.add("has-image");
    applyDetectedPhotoText(snapDataUrl);
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
  resetScan();
  statusBadge.textContent = "Teks Tersalin!";
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
  closePhotoLensPanel();
  isScanLocked = false;
  lastScanned = "";
  resetCandidateScan();

  if (activeAppFeature === "scan-to-excel") {
    addScannedItemToExcel(targetVal, detectedFormat || detectScanFormatType(targetVal, "OCR Text"));
    return;
  }

  generateQR(targetVal, detectedFormat || detectScanFormatType(targetVal, "OCR Text"));
  completeScan();
}

function handlePhotoFileSelected(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const resultUrl = ev.target && ev.target.result ? String(ev.target.result) : "";
    if (resultUrl && capturedPhotoPreview) {
      capturedPhotoPreview.src = resultUrl;
      capturedPhotoPreview.classList.add("has-image");
      applyDetectedPhotoText(resultUrl);
    }
    openPhotoLensPanel();
  };
  reader.readAsDataURL(file);
}

if (photoCaptureInput) {
  photoCaptureInput.addEventListener("change", handlePhotoFileSelected);
}

if (photoGalleryInput) {
  photoGalleryInput.addEventListener("change", handlePhotoFileSelected);
}

// 7. Fitur Scan to Excel (Perekam Baris Otomatis + Generator File Excel .xlsx Murni)
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
  }, 1600);
}

function addScannedItemToExcel(rawText, formatName = "Scan") {
  const cleanText = String(rawText || "").trim();
  if (!cleanText) return;

  const now = Date.now();
  if (cleanText === lastExcelScanCode && now - lastExcelScanTime < 1800) {
    return;
  }

  lastExcelScanCode = cleanText;
  lastExcelScanTime = now;
  resetCandidateScan();
  triggerScanFeedback();

  const timeStr = new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  excelSessionItems.push({
    code: cleanText,
    format: formatName,
    time: timeStr
  });

  renderExcelSessionTable();
  showExcelScanToast(`+1 Masuk Excel: ${cleanText}`);
}

function removeExcelSessionRow(index) {
  if (index < 0 || index >= excelSessionItems.length) return;
  excelSessionItems.splice(index, 1);
  renderExcelSessionTable();
}

function clearExcelSessionRows() {
  if (excelSessionItems.length === 0) return;
  excelSessionItems = [];
  lastExcelScanCode = "";
  lastExcelScanTime = 0;
  renderExcelSessionTable();
}

function renderExcelSessionTable() {
  if (excelRowCount) {
    excelRowCount.textContent = `${excelSessionItems.length} item`;
  }
  if (excelDownloadBtn) {
    excelDownloadBtn.disabled = excelSessionItems.length === 0;
  }
  if (!excelRowsTbody) return;

  if (excelSessionItems.length === 0) {
    excelRowsTbody.innerHTML =
      '<tr class="excel-empty-row"><td colspan="4">Belum ada data. Arahkan kamera ke barcode/QR untuk mulai mencatat.</td></tr>';
    return;
  }

  const rowsHtml = excelSessionItems
    .map((item, idx) => {
      return `<tr>
        <td>${idx + 1}</td>
        <td><strong>${escapeHtmlSafe(item.code)}</strong></td>
        <td>${escapeHtmlSafe(item.format)}</td>
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

function exportScannedListToExcel() {
  if (excelSessionItems.length === 0) return;

  const sheetRows = [
    ["No", "Hasil Scan", "Format", "Waktu Scan"],
    ...excelSessionItems.map((item, idx) => [
      idx + 1,
      item.code,
      item.format,
      item.time
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
    <col min="1" max="1" width="8" customWidth="1"/>
    <col min="2" max="2" width="32" customWidth="1"/>
    <col min="3" max="3" width="16" customWidth="1"/>
    <col min="4" max="4" width="16" customWidth="1"/>
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

  const link = document.createElement("a");
  link.href = url;
  link.download = `Hasil_Scan_${stamp}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2500);
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

// Kontrol Bottom Sheet Hasil Scan & Full Screen QR
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
  if (scanResultSheet) {
    scanResultSheet.style.transform = "";
    scanResultSheet.classList.add("open");
  }
  if (sheetBackdrop) {
    sheetBackdrop.classList.add("open");
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

function dismissScanSheet() {
  closeScanSheetOnly();
  isScanLocked = false;
  lastScanned = "";
  resetCandidateScan();
  statusBadge.textContent = "Scan Dibatalkan";
  statusBadge.classList.remove("ready");
  resumeCameraForNextScan();
}

function completeScan() {
  if (!lastScanned) return;
  closeScanSheetOnly();
  if (fullscreenQrModal) {
    fullscreenQrModal.classList.add("open");
    fullscreenQrModal.setAttribute("aria-hidden", "false");
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

  if (activeAppFeature === "scan-to-excel") {
    addScannedItemToExcel(cleanText, formatName);
    return;
  }

  isScanLocked = true;
  lastScanned = cleanText;
  resetCandidateScan();
  pauseCameraForSingleScan();
  triggerScanFeedback();

  decodedTextEl.textContent = cleanText;
  formatInfoEl.textContent = `Format terbaca: ${formatName}`;
  statusBadge.textContent = "Tersedia Disalin";
  statusBadge.classList.add("ready");

  qrWrapper.innerHTML = "";
  new QRCode(qrWrapper, {
    text: cleanText,
    width: 260,
    height: 260,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });

  openScanSheet(cleanText, formatName);
}

function handleManualSubmit() {
  if (scannerInput.value.trim() !== "") {
    const rawVal = scannerInput.value.trim();
    const detectedFmt = detectScanFormatType(rawVal);

    if (activeAppFeature === "scan-to-excel") {
      addScannedItemToExcel(rawVal, detectedFmt);
      scannerInput.value = "";
      scannerInput.focus();
      return;
    }

    isScanLocked = false;
    lastScanned = "";
    resetCandidateScan();
    generateQR(rawVal, detectedFmt);
    scannerInput.value = "";
    scannerInput.focus();
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
  if (activeAppFeature === "menu") return;
  const activeTag = document.activeElement ? document.activeElement.tagName : "";
  if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (e.key === "Enter") {
    if (physicalScannerBuffer.length >= 3) {
      const code = physicalScannerBuffer;
      physicalScannerBuffer = "";
      const detectedFmt = detectScanFormatType(code);

      if (activeAppFeature === "scan-to-excel") {
        addScannedItemToExcel(code, detectedFmt);
        return;
      }

      isScanLocked = false;
      lastScanned = "";
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
  navigator.clipboard.writeText(lastScanned);
  statusBadge.textContent = "Teks Tersalin!";
  setTimeout(() => {
    statusBadge.textContent = isScanLocked ? "Tersedia Disalin" : "QR Code Siap Scan";
  }, 1500);
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

function resetScan() {
  closeFullscreenQrModal();
  closeScanSheetOnly();
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
  resetCandidateScan();
  decodedTextEl.textContent = "-";
  formatInfoEl.textContent = "Format: -";
  statusBadge.textContent = "Menunggu Scan...";
  statusBadge.classList.remove("ready");
  qrWrapper.innerHTML =
    '<span style="color:#8d8d8d; font-size:0.85rem;">QR Code akan muncul di sini</span>';
  scannerInput.value = "";
  if (activeAppFeature !== "menu") {
    resumeCameraForNextScan();
  }
}

// 8. Inisialisasi Kamera Scanner Dual-Engine (ZXing 1D/2D + Native BarcodeDetector Resolusi Penuh)
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
  if (activeAppFeature === "menu" || activeAppFeature === "text-to-qr") return;
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
    if (activeAppFeature === "scan-to-excel") {
      addScannedItemToExcel(cleanText, fmt);
    } else {
      generateQR(cleanText, fmt);
    }
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
    activeAppFeature === "text-to-qr" ||
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
