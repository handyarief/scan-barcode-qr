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
