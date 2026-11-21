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
const photoShutterBtn = document.getElementById("photo-shutter-btn");
const photoCaptureInput = document.getElementById("photo-capture-input");
const photoLensOverlay = document.getElementById("photo-lens-overlay");
const photoLensStage = document.getElementById("photo-lens-stage");
const capturedPhotoPreview = document.getElementById("captured-photo-preview");
const photoOcrLayer = document.getElementById("photo-ocr-layer");
const photoLensActionBar = document.getElementById("photo-lens-action-bar");
const photoLensStatus = document.getElementById("photo-lens-status");
const sheetBackdrop = document.getElementById("scan-sheet-backdrop");
const scanResultSheet = document.getElementById("scan-result-sheet");
const sheetDragHandle = document.getElementById("sheet-drag-handle");
const sheetScannedCount = document.getElementById("sheet-scanned-count");
const sheetBarcodeValue = document.getElementById("sheet-barcode-value");
const sheetFormatValue = document.getElementById("sheet-format-value");
const fullscreenQrModal = document.getElementById("fullscreen-qr-modal");

let lastScanned = "";
let deferredPrompt = null;
let isFlashOn = false;
let isFlashSupported = false;
let isCameraRunning = false;
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

// 4. Getar & bunyi beep singkat saat scan berhasil
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

// Fitur Foto Ala Google Lens:
// Klik Foto -> Langsung Tampil Foto + Blok Angka saja atau Blok Semua sama Barcode-nya -> Menu Mengambang "Salin" & "Buat Barkode"
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
  if (!isScanLocked) {
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
    return canvas.toDataURL("image/jpeg", 0.95);
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

function buildEnhancedCanvasForOcr(img) {
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;
  const maxDim = Math.max(naturalW, naturalH, 1);
  const targetMaxDim = 1800;
  const scale = maxDim > targetMaxDim ? targetMaxDim / maxDim : 1;

  const width = Math.max(1, Math.round(naturalW * scale));
  const height = Math.max(1, Math.round(naturalH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { canvas, scale: 1 };

  ctx.drawImage(img, 0, 0, width, height);
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const len = data.length;
    const grayBuf = new Uint8Array(width * height);
    let minL = 255;
    let maxL = 0;

    for (let i = 0, p = 0; i < len; i += 4, p += 1) {
      const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      grayBuf[p] = lum;
      if (lum < minL) minL = lum;
      if (lum > maxL) maxL = lum;
    }

    const range = Math.max(40, maxL - minL);
    for (let i = 0, p = 0; i < len; i += 4, p += 1) {
      const normalized = Math.max(0, Math.min(255, Math.round(((grayBuf[p] - minL) * 255) / range)));
      data[i] = normalized;
      data[i + 1] = normalized;
      data[i + 2] = normalized;
    }
    ctx.putImageData(imageData, 0, 0);
  } catch (err) {}

  return { canvas, scale };
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

async function decodeSingleBarcodeRegionFromImage(img, bc) {
  if (!img || !bc || !bc.bbox || bc.text) return;

  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;
  const bWidth = Math.max(10, bc.bbox.x1 - bc.bbox.x0);
  const bHeight = Math.max(10, bc.bbox.y1 - bc.bbox.y0);

  const marginX = Math.round(bWidth * 0.14);
  const marginY = Math.round(bHeight * 0.25);
  const sx = Math.max(0, Math.floor(bc.bbox.x0 - marginX));
  const sy = Math.max(0, Math.floor(bc.bbox.y0 - marginY));
  const sw = Math.min(naturalW - sx, Math.ceil(bWidth + marginX * 2));
  const sh = Math.min(naturalH - sy, Math.ceil(bHeight + marginY * 2));
  if (sw <= 10 || sh <= 10) return;

  const quietPad = 36;
  const upScale = sw < 640 ? 2 : 1;
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = sw * upScale + quietPad * 2;
  cropCanvas.height = sh * upScale + quietPad * 2;
  const ctx = cropCanvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
  ctx.drawImage(img, sx, sy, sw, sh, quietPad, quietPad, sw * upScale, sh * upScale);

  // 1. Coba Native BarcodeDetector pada potongan barcode yang sudah diperjelas
  const cropNative = await detectBarcodeBoxesWithNativeDetector(cropCanvas);
  const matchedNative = cropNative.find((item) => item.text && item.text.length >= 2);
  if (matchedNative) {
    bc.text = matchedNative.text;
    if (matchedNative.format) {
      bc.format = matchedNative.format;
    }
    return;
  }

  // 2. Coba ZXing / html5QrCode.scanFileV2 atau scanFile pada potongan barcode bersih
  try {
    const file = await canvasToPngFile(cropCanvas, "barcode-crop.png");
    if (!file) return;

    if (typeof html5QrCode.scanFileV2 === "function") {
      const res = await html5QrCode.scanFileV2(file, false);
      if (res && res.decodedText) {
        bc.text = String(res.decodedText).trim();
        if (res.result && res.result.format && res.result.format.formatName) {
          bc.format = res.result.format.formatName;
        }
      }
    } else if (typeof html5QrCode.scanFile === "function") {
      const text = await html5QrCode.scanFile(file, false);
      if (text) {
        bc.text = String(text).trim();
      }
    }
  } catch (err) {}
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

async function detectWordBoxesWithTesseract(canvas, scale) {
  if (typeof window.Tesseract === "undefined" || typeof window.Tesseract.recognize !== "function") {
    return [];
  }
  try {
    const result = await window.Tesseract.recognize(canvas, "eng", {
      logger: () => {}
    });
    const data = result && result.data ? result.data : null;
    if (!data) return [];

    let rawWords = Array.isArray(data.words) ? data.words : [];
    if (rawWords.length === 0 && Array.isArray(data.lines)) {
      rawWords = data.lines.flatMap((line) => (Array.isArray(line.words) ? line.words : []));
    }

    const invScale = scale > 0 ? 1 / scale : 1;
    const maxCanvasW = canvas.width * 0.88;
    const maxCanvasH = canvas.height * 0.22;

    return rawWords
      .filter((w) => {
        if (!w || !w.bbox) return false;
        const rawStr = String(w.text || "").trim().replace(/^\|+|\|+$/g, "").trim();
        if (!rawStr) return false;

        const boxW = (Number(w.bbox.x1) || 0) - (Number(w.bbox.x0) || 0);
        const boxH = (Number(w.bbox.y1) || 0) - (Number(w.bbox.y0) || 0);
        if (boxW < 6 || boxH < 8 || boxW > maxCanvasW || boxH > maxCanvasH) {
          return false;
        }

        const conf = typeof w.confidence === "number" ? w.confidence : 0;
        const isCodeLike = /[0-9]/.test(rawStr) && rawStr.length >= 4;
        const minConf = isCodeLike ? 38 : 58;
        return conf >= minConf;
      })
      .map((w) => {
        const rawStr = String(w.text).trim().replace(/^\|+|\|+$/g, "").trim();
        return {
          type: "word",
          text: rawStr,
          bbox: {
            x0: (Number(w.bbox.x0) || 0) * invScale,
            y0: (Number(w.bbox.y0) || 0) * invScale,
            x1: (Number(w.bbox.x1) || 0) * invScale,
            y1: (Number(w.bbox.y1) || 0) * invScale
          }
        };
      })
      .filter((item) => item.text.length > 0 && !isBarcodeArtifactText(item.text, item.bbox));
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
    const maxSearchY = b.y1 + bHeight * 1.65;

    const candidatesBelow = wordItems
      .filter((w) => {
        const wMidY = (w.bbox.y0 + w.bbox.y1) / 2;
        const wMidX = (w.bbox.x0 + w.bbox.x1) / 2;
        const isBelow = wMidY >= b.y1 - 2 && wMidY <= maxSearchY;
        const isAlignedX = wMidX >= b.x0 - 32 && wMidX <= b.x1 + 32;
        const isCodeToken = /^[A-Za-z0-9\-_]{4,}$/.test(w.text) && !isLabelPrefixToken(w.text);
        return isBelow && isAlignedX && isCodeToken;
      })
      .sort((a, bWord) => {
        const distA = a.bbox.y0 - b.y1;
        const distB = bWord.bbox.y0 - b.y1;
        if (Math.abs(distA - distB) > 14) return distA - distB;
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

    const padX = item.type === "barcode" ? 2 : 1.5;
    const padY = item.type === "barcode" ? 2 : 1;

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
    const pad = 5;
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
  const minX = Math.min(startPt.x, endPt.x) - 4;
  const maxX = Math.max(startPt.x, endPt.x) + 4;
  const minY = Math.min(startPt.y, endPt.y) - 4;
  const maxY = Math.max(startPt.y, endPt.y) + 4;

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
    if (hitIdx >= 0) {
      isOcrDragging = true;
      ocrDragStartIdx = hitIdx;
      ocrDragStartPoint = { x: e.clientX, y: e.clientY };
      ocrDragMoved = false;
      try {
        photoOcrLayer.setPointerCapture(e.pointerId);
      } catch (err) {}
    } else {
      isOcrDragging = false;
      ocrDragStartIdx = -1;
      ocrDragStartPoint = null;
      if (selectedOcrIndices.length > 0) {
        selectedOcrIndices = [];
        syncOcrSelectionVisuals();
      }
    }
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

    if (!wasDragged && startIdx >= 0) {
      const existingPos = selectedOcrIndices.indexOf(startIdx);
      if (existingPos >= 0) {
        selectedOcrIndices.splice(existingPos, 1);
      } else {
        selectedOcrIndices.push(startIdx);
      }
      syncOcrSelectionVisuals();
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
    return { text: "", format: "" };
  }

  const selectedItems = selectedOcrIndices
    .map((idx) => ocrWordItems[idx])
    .filter(Boolean);

  if (selectedItems.length === 0) {
    return { text: "", format: "" };
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
      return {
        text: decodedBarcodeTexts.join(" "),
        format: primaryFormat
      };
    }

    if (cleanedWordTokens.length > 0) {
      const codeTokens = cleanedWordTokens.filter((token) => /^[A-Za-z0-9\-_]{4,}$/.test(token));
      const finalTokens = codeTokens.length > 0 ? codeTokens : cleanedWordTokens;
      return {
        text: finalTokens.join(" ").trim(),
        format: primaryFormat
      };
    }
  }

  const joinedText = cleanedWordTokens.join(" ").trim();
  return {
    text: joinedText,
    format: joinedText ? detectScanFormatType(joinedText, "OCR Text") : ""
  };
}

function getSelectedPhotoText() {
  return getSelectedPhotoSelection().text;
}

async function applyDetectedPhotoText(imageUrl) {
  const token = ++ocrRunToken;
  clearPhotoLensState();
  setPhotoLensStatus("Mendeteksi angka, huruf & barcode...", false);

  try {
    const img = await loadImageElement(imageUrl);
    if (token !== ocrRunToken) return;

    ocrNaturalWidth = img.naturalWidth || img.width;
    ocrNaturalHeight = img.naturalHeight || img.height;

    const { canvas: enhancedCanvas, scale } = buildEnhancedCanvasForOcr(img);

    const [nativeBarcodes, tesseractWords] = await Promise.all([
      detectBarcodeBoxesWithNativeDetector(img),
      detectWordBoxesWithTesseract(enhancedCanvas, scale)
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
  const { text: targetVal } = getSelectedPhotoSelection();
  if (!targetVal) {
    setPhotoLensStatus("Ketuk angka/barcode untuk memblok biru terlebih dahulu", false);
    return;
  }
  writeTextToClipboardSafe(targetVal);
  resetScan();
  statusBadge.textContent = "Teks Tersalin!";
}

function createBarcodeFromPhotoText() {
  const { text: targetVal, format: detectedFormat } = getSelectedPhotoSelection();
  if (!targetVal) {
    setPhotoLensStatus("Ketuk angka/barcode untuk memblok biru terlebih dahulu", false);
    return;
  }
  writeTextToClipboardSafe(targetVal);
  closePhotoLensPanel();
  isScanLocked = false;
  lastScanned = "";
  resetCandidateScan();
  generateQR(targetVal, detectedFormat || detectScanFormatType(targetVal, "OCR Text"));
  completeScan();
}

if (photoCaptureInput) {
  photoCaptureInput.addEventListener("change", (e) => {
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
  });
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
    isScanLocked = false;
    lastScanned = "";
    resetCandidateScan();
    const rawVal = scannerInput.value.trim();
    generateQR(rawVal, detectScanFormatType(rawVal));
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
  const activeTag = document.activeElement ? document.activeElement.tagName : "";
  if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (e.key === "Enter") {
    if (physicalScannerBuffer.length >= 3) {
      const code = physicalScannerBuffer;
      physicalScannerBuffer = "";
      isScanLocked = false;
      lastScanned = "";
      resetCandidateScan();
      generateQR(code, detectScanFormatType(code));
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
  resumeCameraForNextScan();
}

// 5. Inisialisasi Kamera Scanner (Mendukung Seluruh Format 1D & 2D + Auto Fokus Cepat + Native BarcodeDetector)
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
    useBarCodeDetectorIfSupported: true
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
    const height = Math.floor(Math.max(108, Math.min(138, viewfinderHeight * 0.25)));
    return { width, height };
  }

  return {
    width: Math.floor(Math.max(220, viewfinderWidth * 0.9)),
    height: Math.floor(Math.max(220, Math.min(viewfinderHeight * 0.62, viewfinderWidth * 1.1)))
  };
}

const config = {
  fps: 20,
  disableFlip: true,
  qrbox: calculateDynamicQrBox,
  videoConstraints: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1920 },
    height: { ideal: 1080 }
  }
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

function setupCameraCapabilities() {
  try {
    const capabilities = html5QrCode.getRunningTrackCapabilities();

    // Cek Auto Fokus
    if (capabilities && Array.isArray(capabilities.focusMode) && capabilities.focusMode.length > 0) {
      isFocusSupported = true;
      triggerAutoFocus(false);
      startAutoFocusLoop();
    } else {
      isFocusSupported = false;
      triggerAutoFocus(false);
      startAutoFocusLoop();
    }

    // Cek Flash / Torch
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

    // Cek Zoom Kamera & siapkan kontrol Auto Zoom In / Out
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
  const upperFmt = String(fmt || "").toUpperCase();
  const noiseProne1D = ["CODE_39", "CODABAR", "ITF", "CODE_93", "RSS_14", "RSS_EXPANDED"];
  if (noiseProne1D.includes(upperFmt)) {
    return 3;
  }
  if (cleanText.length <= 3) {
    return 3;
  }
  return 2;
}

function onScanSuccess(decodedText, decodedResult) {
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

html5QrCode
  .start(
    { facingMode: "environment" },
    config,
    onScanSuccess,
    () => {}
  )
  .then(() => {
    isCameraRunning = true;
    setTimeout(setupCameraCapabilities, 350);
  })
  .catch(() => {
    isCameraRunning = false;
    flashBtn.disabled = true;
    flashStatus.textContent = "Kamera tidak aktif.";
    document.getElementById("reader").innerHTML =
      `<div style="color:#fff; padding:24px; text-align:center; font-size:0.9rem;">
        Kamera tidak aktif atau membutuhkan akses HTTPS.<br/>Gunakan ikon keyboard di bawah untuk mengetik / scanner fisik.
      </div>`;
  });
