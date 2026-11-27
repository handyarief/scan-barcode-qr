// 7. Engine Foto Lens: Framing Presisi Live Preview -> Deteksi Cepat & Rapi Ala Google Lens
let ocrPreloadPromise = null;

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
  photoShutterBtn.classList.remove("active");
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
  }

  if (!isScanLocked && activeAppFeature !== "menu") {
    resumeCameraForNextScan();
  }
}

function getLiveViewportAspectRatio() {
  const targetEl = scannerViewport || document.querySelector("#reader video");
  if (!targetEl) return 0;
  const rect = targetEl.getBoundingClientRect();
  if (!rect.width || !rect.height) return 0;
  return rect.width / rect.height;
}

function drawCroppedToViewportDataUrl(source, srcW, srcH, targetAspect, maxOutDim = 1600) {
  if (!source || !srcW || !srcH) return "";
  try {
    let sx = 0;
    let sy = 0;
    let sw = srcW;
    let sh = srcH;

    if (targetAspect > 0) {
      const srcAspect = srcW / srcH;
      if (srcAspect > targetAspect) {
        sw = Math.max(1, Math.round(srcH * targetAspect));
        sx = Math.max(0, Math.round((srcW - sw) / 2));
      } else if (srcAspect < targetAspect) {
        sh = Math.max(1, Math.round(srcW / targetAspect));
        sy = Math.max(0, Math.round((srcH - sh) / 2));
      }
    }

    const maxCropDim = Math.max(sw, sh, 1);
    const scale = maxCropDim > maxOutDim ? maxOutDim / maxCropDim : 1;
    const outW = Math.max(1, Math.round(sw * scale));
    const outH = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, outW, outH);
    return canvas.toDataURL("image/jpeg", 0.94);
  } catch (err) {
    return "";
  }
}

function captureSnapshotFromVideo(targetAspect = 0) {
  const videoEl = document.querySelector("#reader video");
  if (!videoEl || !videoEl.videoWidth || !videoEl.videoHeight) return "";
  return drawCroppedToViewportDataUrl(
    videoEl,
    videoEl.videoWidth,
    videoEl.videoHeight,
    targetAspect,
    1600
  );
}

async function cropPhotoBlobToViewport(photoBlob, targetAspect) {
  if (!photoBlob) return "";
  const objectUrl = URL.createObjectURL(photoBlob);
  try {
    const img = await loadImageElement(objectUrl);
    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    return drawCroppedToViewportDataUrl(img, natW, natH, targetAspect, 1600);
  } catch (err) {
    return "";
  } finally {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch (e) {}
  }
}

async function captureHighResPhotoFromCamera() {
  const targetAspect = getLiveViewportAspectRatio();

  // Jika kamera belum terkunci fokus, lakukan penguncian singkat agar tetap responsif
  const alreadyFocused = typeof isCameraFocusedReady !== "undefined" && Boolean(isCameraFocusedReady);
  if (!alreadyFocused) {
    if (typeof waitForCameraAutoFocusLock === "function") {
      await withPromiseTimeout(waitForCameraAutoFocusLock(450), 500, true).catch(() => {});
    } else if (typeof triggerAutoFocus === "function") {
      await withPromiseTimeout(triggerAutoFocus(true), 250, null).catch(() => {});
    }
  }

  // Prioritaskan frame video live yang dipotong sesuai viewport agar framing 100% sama & instan
  const videoEl = document.querySelector("#reader video");
  const vw = videoEl ? videoEl.videoWidth || 0 : 0;
  const vh = videoEl ? videoEl.videoHeight || 0 : 0;
  if (videoEl && Math.max(vw, vh) >= 640) {
    const exactFrame = captureSnapshotFromVideo(targetAspect);
    if (exactFrame) {
      return exactFrame;
    }
  }

  // Fallback ke ImageCapture.takePhoto() hanya jika stream video beresolusi rendah
  try {
    const mediaStream = videoEl && videoEl.srcObject ? videoEl.srcObject : null;
    const videoTrack =
      mediaStream && typeof mediaStream.getVideoTracks === "function"
        ? mediaStream.getVideoTracks()[0]
        : null;

    if (videoTrack && typeof window.ImageCapture !== "undefined") {
      const imageCapture = new window.ImageCapture(videoTrack);
      if (typeof imageCapture.takePhoto === "function") {
        const photoBlob = await withPromiseTimeout(imageCapture.takePhoto(), 1800, null);
        if (photoBlob) {
          const croppedDataUrl = await cropPhotoBlobToViewport(photoBlob, targetAspect);
          if (croppedDataUrl) return croppedDataUrl;
        }
      }
    }
  } catch (err) {}

  const fallbackSnap = captureSnapshotFromVideo(targetAspect);
  if (fallbackSnap) {
    return fallbackSnap;
  }

  return "";
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
          tessedit_pageseg_mode: "3",
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

function preloadOcrWorker() {
  if (!ocrPreloadPromise) {
    ocrPreloadPromise = withPromiseTimeout(getPersistentOcrWorker(), 15000, null).catch(() => null);
  }
  return ocrPreloadPromise;
}

// Kanvas OCR internal dengan normalisasi pencahayaan lokal + penajaman ringan tanpa mengubah foto asli
function buildOcrCanvasFromImage(img, invertDarkBg = false) {
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;
  const maxDim = Math.max(naturalW, naturalH, 1);
  const targetMaxDim = maxDim < 1280 ? 1400 : Math.min(1560, maxDim);
  const scale = targetMaxDim / maxDim;

  const width = Math.max(1, Math.round(naturalW * scale));
  const height = Math.max(1, Math.round(naturalH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { canvas, scale: 1, width, height };

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const totalPixels = width * height;
    const gray = new Uint8Array(totalPixels);

    for (let i = 0, p = 0; p < totalPixels; i += 4, p += 1) {
      gray[p] = (77 * data[i] + 150 * data[i + 1] + 29 * data[i + 2]) >> 8;
    }

    // Estimasi latar pencahayaan lokal per blok grid agar bayangan kertas & teks pudar tetap tajam
    const cellSize = Math.max(24, Math.round(Math.min(width, height) / 22));
    const gridCols = Math.max(1, Math.ceil(width / cellSize));
    const gridRows = Math.max(1, Math.ceil(height / cellSize));
    const bgGrid = new Float32Array(gridCols * gridRows);

    for (let gy = 0; gy < gridRows; gy += 1) {
      const yStart = gy * cellSize;
      const yEnd = Math.min(height, yStart + cellSize);
      for (let gx = 0; gx < gridCols; gx += 1) {
        const xStart = gx * cellSize;
        const xEnd = Math.min(width, xStart + cellSize);
        let sum = 0;
        let count = 0;
        let maxVal = 0;
        let minVal = 255;

        for (let y = yStart; y < yEnd; y += 2) {
          const rowOff = y * width;
          for (let x = xStart; x < xEnd; x += 2) {
            const v = gray[rowOff + x];
            sum += v;
            count += 1;
            if (v > maxVal) maxVal = v;
            if (v < minVal) minVal = v;
          }
        }

        const mean = count > 0 ? sum / count : 200;
        bgGrid[gy * gridCols + gx] = invertDarkBg
          ? Math.max(24, minVal * 0.65 + mean * 0.35)
          : Math.max(45, maxVal * 0.68 + mean * 0.32);
      }
    }

    const normBuf = new Uint8Array(totalPixels);
    for (let y = 0; y < height; y += 1) {
      const fy = (y + 0.5) / cellSize - 0.5;
      const gy0 = Math.max(0, Math.min(gridRows - 1, Math.floor(fy)));
      const gy1 = Math.max(0, Math.min(gridRows - 1, gy0 + 1));
      const ty = Math.max(0, Math.min(1, fy - gy0));
      const rowOff = y * width;

      for (let x = 0; x < width; x += 1) {
        const fx = (x + 0.5) / cellSize - 0.5;
        const gx0 = Math.max(0, Math.min(gridCols - 1, Math.floor(fx)));
        const gx1 = Math.max(0, Math.min(gridCols - 1, gx0 + 1));
        const tx = Math.max(0, Math.min(1, fx - gx0));

        const topBg = bgGrid[gy0 * gridCols + gx0] * (1 - tx) + bgGrid[gy0 * gridCols + gx1] * tx;
        const botBg = bgGrid[gy1 * gridCols + gx0] * (1 - tx) + bgGrid[gy1 * gridCols + gx1] * tx;
        const localBg = Math.max(36, topBg * (1 - ty) + botBg * ty);

        const p = rowOff + x;
        let val;
        if (invertDarkBg) {
          const lift = Math.max(0, gray[p] - localBg);
          val = 255 - Math.min(255, Math.round(lift * 2.1));
        } else {
          const ratio = (gray[p] / localBg) * 246;
          // Peregangan kontras lembut: tinta makin jelas, latar kertas bersih mendekati putih
          val = Math.round((ratio - 128) * 1.24 + 134);
        }
        normBuf[p] = val < 0 ? 0 : val > 255 ? 255 : val;
      }
    }

    // Penajaman ringan (unsharp mask 4-tetangga) agar huruf kecil terbaca jernih
    for (let y = 0; y < height; y += 1) {
      const rowOff = y * width;
      const upOff = y > 0 ? (y - 1) * width : rowOff;
      const downOff = y < height - 1 ? (y + 1) * width : rowOff;

      for (let x = 0; x < width; x += 1) {
        const p = rowOff + x;
        const center = normBuf[p];
        const left = x > 0 ? normBuf[p - 1] : center;
        const right = x < width - 1 ? normBuf[p + 1] : center;
        const avgNeighbors = (left + right + normBuf[upOff + x] + normBuf[downOff + x]) * 0.25;
        let sharp = Math.round(center + (center - avgNeighbors) * 0.42);
        if (sharp < 0) sharp = 0;
        else if (sharp > 255) sharp = 255;

        const idx = p * 4;
        data[idx] = sharp;
        data[idx + 1] = sharp;
        data[idx + 2] = sharp;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  } catch (err) {}

  return { canvas, scale, width, height };
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

async function detectBarcodeBoxesWithNativeDetector(source, scaleFactor = 1) {
  if (typeof window.BarcodeDetector === "undefined") return [];
  const invScale = scaleFactor > 0 ? 1 / scaleFactor : 1;
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
      .filter((item) => {
        const raw = String(item && item.rawValue ? item.rawValue : "").trim();
        return (
          item &&
          raw.length > 0 &&
          item.boundingBox &&
          item.boundingBox.width > 10 &&
          item.boundingBox.height > 10
        );
      })
      .map((item) => {
        const b = item.boundingBox;
        return {
          type: "barcode",
          text: String(item.rawValue || "").trim(),
          format: String(item.format || "BARCODE").toUpperCase(),
          bbox: {
            x0: Math.max(0, (Number(b.x) || 0) * invScale),
            y0: Math.max(0, (Number(b.y) || 0) * invScale),
            x1: Math.max(0, ((Number(b.x) || 0) + (Number(b.width) || 0)) * invScale),
            y1: Math.max(0, ((Number(b.y) || 0) + (Number(b.height) || 0)) * invScale)
          }
        };
      });
  } catch (err) {
    return [];
  }
}

function deduplicateBarcodeItems(items) {
  const unique = [];
  items.forEach((cand) => {
    const cMidX = (cand.bbox.x0 + cand.bbox.x1) / 2;
    const cMidY = (cand.bbox.y0 + cand.bbox.y1) / 2;
    const exists = unique.some((ex) => {
      const eMidX = (ex.bbox.x0 + ex.bbox.x1) / 2;
      const eMidY = (ex.bbox.y0 + ex.bbox.y1) / 2;
      const tolX = Math.max(14, ((ex.bbox.x1 - ex.bbox.x0) + (cand.bbox.x1 - cand.bbox.x0)) * 0.35);
      const tolY = Math.max(14, ((ex.bbox.y1 - ex.bbox.y0) + (cand.bbox.y1 - cand.bbox.y0)) * 0.35);
      return Math.abs(eMidX - cMidX) <= tolX && Math.abs(eMidY - cMidY) <= tolY;
    });
    if (!exists) {
      unique.push(cand);
    }
  });
  return unique;
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

async function scanBarcodeFromCanvasWithFileDecoder(targetCanvas) {
  const scanner = getDedicatedFileScanner();
  if (!scanner) return null;
  try {
    const file = await canvasToPngFile(targetCanvas, "barcode-photo.png");
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

async function detectConfirmedBarcodesFromImage(img, ocrPrep, allowSlowFallback = false) {
  const nativeItems = await detectBarcodeBoxesWithNativeDetector(img, 1);
  if (nativeItems.length > 0) {
    return deduplicateBarcodeItems(nativeItems);
  }

  const nativeFromOcr = await detectBarcodeBoxesWithNativeDetector(
    ocrPrep.canvas,
    ocrPrep.scale || 1
  );
  if (nativeFromOcr.length > 0) {
    return deduplicateBarcodeItems(nativeFromOcr);
  }

  if (allowSlowFallback) {
    const fileDecoded = await scanBarcodeFromCanvasWithFileDecoder(ocrPrep.canvas);
    if (fileDecoded && fileDecoded.text) {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      return [
        {
          type: "barcode",
          text: fileDecoded.text,
          format: fileDecoded.format || detectScanFormatType(fileDecoded.text, "BARCODE"),
          bbox: {
            x0: w * 0.15,
            y0: h * 0.2,
            x1: w * 0.85,
            y1: h * 0.8
          }
        }
      ];
    }
  }

  return [];
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
    if (cx >= b.x0 && cx <= b.x1 && cy >= b.y0 && cy <= b.y1) {
      return true;
    }
    const interX0 = Math.max(wordBbox.x0, b.x0);
    const interY0 = Math.max(wordBbox.y0, b.y0);
    const interX1 = Math.min(wordBbox.x1, b.x1);
    const interY1 = Math.min(wordBbox.y1, b.y1);
    if (interX1 > interX0 && interY1 > interY0) {
      const interArea = (interX1 - interX0) * (interY1 - interY0);
      if (interArea / wArea > 0.45) {
        return true;
      }
    }
    return false;
  });
}

function extractWordsFromTesseractData(data) {
  if (!data) return [];

  const collected = [];
  if (Array.isArray(data.blocks)) {
    data.blocks.forEach((block) => {
      const paragraphs = Array.isArray(block.paragraphs) ? block.paragraphs : [];
      paragraphs.forEach((para) => {
        const lines = Array.isArray(para.lines) ? para.lines : [];
        lines.forEach((line) => {
          const words = Array.isArray(line.words) ? line.words : [];
          words.forEach((word) => collected.push(word));
        });
      });
    });
  }
  if (collected.length > 0) {
    return collected;
  }

  if (Array.isArray(data.words) && data.words.length > 0) {
    return data.words;
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

function sanitizeOcrToken(rawStr) {
  return String(rawStr || "")
    .trim()
    .replace(/^[|_~`^•·]+|[|_~`^•·]+$/g, "")
    .trim();
}

function isMeaningfulTextToken(rawStr) {
  const clean = sanitizeOcrToken(rawStr);
  if (!clean) return false;
  if (!/[A-Za-z0-9]/.test(clean)) return false;
  if (/^([A-Za-z0-9])\1{2,}$/.test(clean) && clean.length >= 4) return false;
  const alnumCount = (clean.match(/[A-Za-z0-9]/g) || []).length;
  if (clean.length >= 3 && alnumCount / clean.length < 0.4) return false;
  return true;
}

function parseRawTesseractWords(rawWords, canvas, scale, strictMode = false) {
  const invScale = scale > 0 ? 1 / scale : 1;
  const maxCanvasW = canvas.width * 0.82;
  const maxCanvasH = canvas.height * 0.13;
  const minCanvasH = Math.max(7, canvas.height * 0.0055);
  const minCanvasW = Math.max(4, canvas.width * 0.004);

  return rawWords
    .filter((w) => {
      if (!w || !w.bbox) return false;
      const cleanStr = sanitizeOcrToken(w.text);
      if (!isMeaningfulTextToken(cleanStr)) return false;

      const boxW = (Number(w.bbox.x1) || 0) - (Number(w.bbox.x0) || 0);
      const boxH = (Number(w.bbox.y1) || 0) - (Number(w.bbox.y0) || 0);
      if (boxW < minCanvasW || boxH < minCanvasH || boxW > maxCanvasW || boxH > maxCanvasH) {
        return false;
      }

      const aspectRatio = boxW / Math.max(1, boxH);
      if (aspectRatio < 0.18 || aspectRatio > 22) {
        return false;
      }

      const conf = typeof w.confidence === "number" ? w.confidence : 50;
      const isCodeLike = /^[A-Za-z0-9/.\-:+]+$/.test(cleanStr);

      let minConf = strictMode ? 58 : 44;
      if (cleanStr.length === 1) {
        minConf = strictMode ? 78 : 72;
      } else if (cleanStr.length === 2) {
        minConf = isCodeLike ? (strictMode ? 62 : 52) : (strictMode ? 70 : 62);
      } else if (isCodeLike) {
        minConf = strictMode ? 50 : 38;
      }

      return conf >= minConf;
    })
    .map((w) => {
      const cleanStr = sanitizeOcrToken(w.text);
      return {
        type: "word",
        text: cleanStr,
        confidence: typeof w.confidence === "number" ? w.confidence : 50,
        bbox: {
          x0: Math.max(0, (Number(w.bbox.x0) || 0) * invScale),
          y0: Math.max(0, (Number(w.bbox.y0) || 0) * invScale),
          x1: Math.max(0, (Number(w.bbox.x1) || 0) * invScale),
          y1: Math.max(0, (Number(w.bbox.y1) || 0) * invScale)
        }
      };
    })
    .filter((item) => item.text.length > 0 && item.bbox.x1 > item.bbox.x0 && item.bbox.y1 > item.bbox.y0);
}

async function recognizeCanvasWords(worker, canvas, scale, psm = "3", strictMode = false) {
  if (worker) {
    await withPromiseTimeout(
      worker.setParameters({
        tessedit_pageseg_mode: String(psm),
        preserve_interword_spaces: "1"
      }),
      1500,
      null
    );
    const recognizeRes = await withPromiseTimeout(
      worker.recognize(canvas, {}, { blocks: true, text: true }),
      14000,
      null
    );
    const data = recognizeRes && recognizeRes.data ? recognizeRes.data : null;
    return parseRawTesseractWords(extractWordsFromTesseractData(data), canvas, scale, strictMode);
  }

  if (typeof window.Tesseract !== "undefined" && typeof window.Tesseract.recognize === "function") {
    const fallbackRes = await withPromiseTimeout(
      window.Tesseract.recognize(
        canvas,
        "eng",
        { logger: () => {}, tessedit_pageseg_mode: String(psm) },
        { blocks: true, text: true }
      ),
      14000,
      null
    );
    const data = fallbackRes && fallbackRes.data ? fallbackRes.data : null;
    return parseRawTesseractWords(extractWordsFromTesseractData(data), canvas, scale, strictMode);
  }

  return [];
}

function computeBboxIoUAndContainment(a, b) {
  const interX0 = Math.max(a.x0, b.x0);
  const interY0 = Math.max(a.y0, b.y0);
  const interX1 = Math.min(a.x1, b.x1);
  const interY1 = Math.min(a.y1, b.y1);
  if (interX1 <= interX0 || interY1 <= interY0) {
    return { iou: 0, minContainment: 0 };
  }
  const interArea = (interX1 - interX0) * (interY1 - interY0);
  const areaA = Math.max(1, (a.x1 - a.x0) * (a.y1 - a.y0));
  const areaB = Math.max(1, (b.x1 - b.x0) * (b.y1 - b.y0));
  const unionArea = Math.max(1, areaA + areaB - interArea);
  return {
    iou: interArea / unionArea,
    minContainment: interArea / Math.min(areaA, areaB)
  };
}

function mergeOcrWordPasses(primaryWords, secondaryWords) {
  const merged = [...primaryWords];
  secondaryWords.forEach((cand) => {
    const isDuplicateBox = merged.some((ex) => {
      const { iou, minContainment } = computeBboxIoUAndContainment(ex.bbox, cand.bbox);
      if (iou >= 0.3 || minContainment >= 0.58) {
        return true;
      }
      const cMidX = (cand.bbox.x0 + cand.bbox.x1) / 2;
      const cMidY = (cand.bbox.y0 + cand.bbox.y1) / 2;
      const eMidX = (ex.bbox.x0 + ex.bbox.x1) / 2;
      const eMidY = (ex.bbox.y0 + ex.bbox.y1) / 2;
      const tolX = Math.max(8, ((ex.bbox.x1 - ex.bbox.x0) + (cand.bbox.x1 - cand.bbox.x0)) * 0.25);
      const tolY = Math.max(8, ((ex.bbox.y1 - ex.bbox.y0) + (cand.bbox.y1 - cand.bbox.y0)) * 0.35);
      return Math.abs(eMidX - cMidX) <= tolX && Math.abs(eMidY - cMidY) <= tolY;
    });
    if (!isDuplicateBox) {
      merged.push(cand);
    }
  });
  return merged;
}

function pruneIsolatedNoiseWords(words) {
  if (words.length <= 2) return words;

  // Hanya jadikan kata berkepercayaan tinggi sebagai jangkar agar kelompok noise latar tidak saling menyelamatkan
  const anchorFlags = words.map((item) => {
    const conf = typeof item.confidence === "number" ? item.confidence : 50;
    return item.text.length >= 2 && conf >= 58;
  });

  return words.filter((item, idx) => {
    const conf = typeof item.confidence === "number" ? item.confidence : 50;
    const isShort = item.text.length <= 2;
    if (!isShort && conf >= 56) return true;

    const cx = (item.bbox.x0 + item.bbox.x1) / 2;
    const cy = (item.bbox.y0 + item.bbox.y1) / 2;
    const h = Math.max(10, item.bbox.y1 - item.bbox.y0);

    let nearbyAnchors = 0;
    for (let j = 0; j < words.length; j += 1) {
      if (idx === j || !anchorFlags[j]) continue;
      const other = words[j];
      const ocx = (other.bbox.x0 + other.bbox.x1) / 2;
      const ocy = (other.bbox.y0 + other.bbox.y1) / 2;
      const dx = Math.abs(ocx - cx);
      const dy = Math.abs(ocy - cy);
      if (dy <= h * 2.2 && dx <= h * 8.5) {
        nearbyAnchors += 1;
        break;
      }
    }

    if (nearbyAnchors === 0 && (isShort || conf < 72)) {
      return false;
    }
    return true;
  });
}

function alignAndRefineWordBoxes(words) {
  const sorted = sortDetectedItemsReadingOrder(words);
  if (sorted.length === 0) return [];

  // Kelompokkan kotak dalam baris yang sama secara ketat agar baris rapat (mis. Nama/Alamat/No Hp) tidak tercampur
  const lines = [];
  sorted.forEach((word) => {
    const midY = (word.bbox.y0 + word.bbox.y1) / 2;
    const h = Math.max(6, word.bbox.y1 - word.bbox.y0);
    let targetLine = null;
    for (const line of lines) {
      const lineMidY = (line.y0 + line.y1) / 2;
      const lineH = Math.max(6, line.y1 - line.y0);
      const minH = Math.min(lineH, h);
      const overlapY = Math.min(line.y1, word.bbox.y1) - Math.max(line.y0, word.bbox.y0);
      const overlapRatio = overlapY / Math.max(1, minH);
      if (Math.abs(midY - lineMidY) <= minH * 0.45 && overlapRatio >= 0.35) {
        targetLine = line;
        break;
      }
    }
    if (targetLine) {
      targetLine.items.push(word);
      const count = targetLine.items.length;
      targetLine.y0 = (targetLine.y0 * (count - 1) + word.bbox.y0) / count;
      targetLine.y1 = (targetLine.y1 * (count - 1) + word.bbox.y1) / count;
    } else {
      lines.push({
        y0: word.bbox.y0,
        y1: word.bbox.y1,
        items: [word]
      });
    }
  });

  lines.sort((a, b) => (a.y0 + a.y1) - (b.y0 + b.y1));

  const refinedLines = lines.map((line) => {
    const lineItems = [...line.items].sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const heights = lineItems.map((it) => Math.max(6, it.bbox.y1 - it.bbox.y0)).sort((a, b) => a - b);
    const medianH = heights[Math.floor(heights.length / 2)] || Math.max(8, line.y1 - line.y0);
    const refinedRow = [];

    for (let i = 0; i < lineItems.length; i += 1) {
      const curr = {
        ...lineItems[i],
        bbox: { ...lineItems[i].bbox }
      };

      const currH = Math.max(6, curr.bbox.y1 - curr.bbox.y0);
      if (currH >= medianH * 0.65 && currH <= medianH * 1.45) {
        curr.bbox.y0 = curr.bbox.y0 * 0.55 + line.y0 * 0.45;
        curr.bbox.y1 = curr.bbox.y1 * 0.55 + line.y1 * 0.45;
      }

      const prev = refinedRow.length > 0 ? refinedRow[refinedRow.length - 1] : null;
      if (prev && curr.bbox.x0 < prev.bbox.x1 + 2) {
        const midX = (prev.bbox.x1 + curr.bbox.x0) / 2;
        if (midX - prev.bbox.x0 > 4 && curr.bbox.x1 - midX > 4) {
          prev.bbox.x1 = midX - 1;
          curr.bbox.x0 = midX + 1;
        } else {
          curr.bbox.x0 = Math.min(curr.bbox.x1 - 4, prev.bbox.x1 + 2);
        }
      }

      if (curr.bbox.x1 > curr.bbox.x0 + 2 && curr.bbox.y1 > curr.bbox.y0 + 2) {
        refinedRow.push(curr);
      }
    }
    return refinedRow;
  });

  // Cegah tumpang tindih vertikal antar baris yang rapat
  for (let r = 1; r < refinedLines.length; r += 1) {
    const prevRow = refinedLines[r - 1];
    const currRow = refinedLines[r];
    for (const curr of currRow) {
      for (const prev of prevRow) {
        const horizOverlap = Math.min(prev.bbox.x1, curr.bbox.x1) - Math.max(prev.bbox.x0, curr.bbox.x0);
        if (horizOverlap > 2 && curr.bbox.y0 < prev.bbox.y1 + 2) {
          const midY = (prev.bbox.y1 + curr.bbox.y0) / 2;
          if (midY - prev.bbox.y0 > 5 && curr.bbox.y1 - midY > 5) {
            prev.bbox.y1 = midY - 1;
            curr.bbox.y0 = midY + 1;
          }
        }
      }
    }
  }

  return refinedLines.flat();
}

async function detectWordBoxesWithTesseract(ocrPrep, img) {
  try {
    const worker = await withPromiseTimeout(getPersistentOcrWorker(), 12000, null);
    // PSM 3 (Auto Page Segmentation) jauh lebih akurat & cepat untuk nota/tabel multi-kolom
    const primaryWords = await recognizeCanvasWords(
      worker,
      ocrPrep.canvas,
      ocrPrep.scale,
      "3",
      false
    );

    let combined = primaryWords;

    // Jalankan pass tambahan hanya jika hasil utama sangat sedikit
    if (combined.length < 3) {
      const sparseWords = await recognizeCanvasWords(
        worker,
        ocrPrep.canvas,
        ocrPrep.scale,
        "11",
        true
      );
      combined = mergeOcrWordPasses(combined, sparseWords);
    }

    if (combined.length < 2 && img) {
      const invPrep = buildOcrCanvasFromImage(img, true);
      const invWords = await recognizeCanvasWords(
        worker,
        invPrep.canvas,
        invPrep.scale,
        "3",
        true
      );
      combined = mergeOcrWordPasses(combined, invWords);
    }

    const pruned = pruneIsolatedNoiseWords(combined);
    return alignAndRefineWordBoxes(pruned);
  } catch (err) {}
  return [];
}

function isLabelPrefixToken(token) {
  return /^(S\/N|P\/N|SN|PN|NO|ID|LOT|BATCH|DESC|QTY|PCS)[:：]?$/i.test(String(token || "").trim());
}

function sortDetectedItemsReadingOrder(items) {
  return [...items].sort((a, b) => {
    const midAY = (a.bbox.y0 + a.bbox.y1) / 2;
    const midBY = (b.bbox.y0 + b.bbox.y1) / 2;
    const lineThreshold = Math.max(
      10,
      Math.min(a.bbox.y1 - a.bbox.y0, b.bbox.y1 - b.bbox.y0) * 0.55
    );
    if (Math.abs(midAY - midBY) > lineThreshold) {
      return midAY - midBY;
    }
    return a.bbox.x0 - b.bbox.x0;
  });
}

async function applyDetectedPhotoText(rawImageUrl) {
  const token = ++ocrRunToken;
  clearPhotoLensState();
  setPhotoLensStatus("Membaca teks, angka & barcode...", false);

  if (capturedPhotoPreview && rawImageUrl) {
    capturedPhotoPreview.src = rawImageUrl;
    capturedPhotoPreview.classList.add("has-image");
  }

  try {
    const img = await loadImageElement(rawImageUrl);
    if (token !== ocrRunToken) return;

    ocrNaturalWidth = img.naturalWidth || img.width;
    ocrNaturalHeight = img.naturalHeight || img.height;

    const ocrPrep = buildOcrCanvasFromImage(img, false);

    // Jalankan deteksi Barcode native & OCR Tesseract secara paralel untuk mempercepat hasil
    const [nativeBarcodes, tesseractWords] = await Promise.all([
      detectConfirmedBarcodesFromImage(img, ocrPrep, false),
      detectWordBoxesWithTesseract(ocrPrep, img)
    ]);
    if (token !== ocrRunToken) return;

    let barcodeItems = nativeBarcodes;
    // Fallback decoder file ZXing hanya dijalankan jika barcode native kosong dan teks OCR sangat minim
    if (barcodeItems.length === 0 && tesseractWords.length <= 4) {
      barcodeItems = await detectConfirmedBarcodesFromImage(img, ocrPrep, true);
      if (token !== ocrRunToken) return;
    }

    const cleanWords = tesseractWords.filter(
      (wordItem) => !isBoxOverlappingBarcode(wordItem.bbox, barcodeItems)
    );

    const combinedItems = sortDetectedItemsReadingOrder([...barcodeItems, ...cleanWords]);
    ocrWordItems = combinedItems;
    selectedOcrIndices = [];
    renderOcrWordBoxes();

    if (ocrWordItems.length > 0) {
      setPhotoLensStatus("", true);
    } else {
      setPhotoLensStatus("Teks/angka tidak terbaca, ketuk Foto Ulang", false);
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

  const computedStyle = window.getComputedStyle(photoLensStage);
  const padLeft = parseFloat(computedStyle.paddingLeft) || 0;
  const padRight = parseFloat(computedStyle.paddingRight) || 0;
  const padTop = parseFloat(computedStyle.paddingTop) || 0;
  const padBottom = parseFloat(computedStyle.paddingBottom) || 0;

  const availWidth = Math.max(10, stageRect.width - padLeft - padRight);
  const availHeight = Math.max(10, stageRect.height - padTop - padBottom);

  const scale = Math.min(availWidth / ocrNaturalWidth, availHeight / ocrNaturalHeight);
  const renderedWidth = ocrNaturalWidth * scale;
  const renderedHeight = ocrNaturalHeight * scale;
  const offsetX = padLeft + (availWidth - renderedWidth) / 2;
  const offsetY = padTop + (availHeight - renderedHeight) / 2;

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
    if (ocrWordItems.length > 0) {
      setPhotoLensStatus("", true);
    }
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

  const barWidth = photoLensActionBar.offsetWidth || 210;
  const barHeight = photoLensActionBar.offsetHeight || 42;
  const gap = 12;

  let targetLeft = (minLeft + maxRight) / 2 - barWidth / 2;
  let targetTop = minTop - gap - barHeight;

  if (targetTop < 56) {
    if (maxBottom + gap + barHeight <= stageRect.height - 12) {
      targetTop = maxBottom + gap;
    } else if (maxRight + gap + barWidth <= stageRect.width - 8) {
      targetLeft = maxRight + gap;
      targetTop = (minTop + maxBottom) / 2 - barHeight / 2;
    } else if (minLeft - gap - barWidth >= 8) {
      targetLeft = minLeft - gap - barWidth;
      targetTop = (minTop + maxBottom) / 2 - barHeight / 2;
    } else {
      targetTop = Math.max(56, Math.min(stageRect.height - barHeight - 12, (minTop + maxBottom) / 2 - barHeight / 2));
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

    const padX = item.type === "barcode" ? 2.5 : 2;
    const padY = item.type === "barcode" ? 2.5 : 1;

    const left = metrics.offsetX + item.bbox.x0 * metrics.scale - padX;
    const top = metrics.offsetY + item.bbox.y0 * metrics.scale - padY;
    const width = Math.max(8, (item.bbox.x1 - item.bbox.x0) * metrics.scale + padX * 2);
    const height = Math.max(10, (item.bbox.y1 - item.bbox.y0) * metrics.scale + padY * 2);

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
  let bestWordIdx = -1;
  let bestWordDist = Infinity;
  let bestBarcodeIdx = -1;
  let bestBarcodeDist = Infinity;

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
      const idx = Number(box.getAttribute("data-index"));
      if (box.classList.contains("ocr-word-box")) {
        if (dist < bestWordDist) {
          bestWordDist = dist;
          bestWordIdx = idx;
        }
      } else if (dist < bestBarcodeDist) {
        bestBarcodeDist = dist;
        bestBarcodeIdx = idx;
      }
    }
  });

  return bestWordIdx >= 0 ? bestWordIdx : bestBarcodeIdx;
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
        selectedOcrIndices = [startIdx];
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
      return {
        text: cleanedWordTokens.join(" ").trim(),
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
  } else if (activeAppFeature === "scan-to-excel" && isExcelTextPhotoMode) {
    currentRoute = "scan-to-excel-scan:text-mode";
  }
  if (!isScanLocked && activeAppFeature !== "menu") {
    resumeCameraForNextScan();
  }
}

async function triggerPhotoCapture() {
  if (activeAppFeature === "scan-to-excel" && !isExcelTextPhotoMode) {
    enterExcelTextPhotoMode();
    return;
  }

  clearPhotoLensState();
  openPhotoLensPanel();
  setPhotoLensStatus("Mengambil foto...", false);

  const snapDataUrl = await captureHighResPhotoFromCamera();
  if (snapDataUrl) {
    applyDetectedPhotoText(snapDataUrl);
  } else if (photoCaptureInput) {
    setPhotoLensStatus("Ambil foto...", false);
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
        ? "Kode batang tidak terbaca, ketuk teks/angka atau Foto Ulang"
        : "Ketuk kata, huruf, angka, atau barcode terlebih dahulu",
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
        ? "Kode batang tidak terbaca, ketuk teks/angka atau Foto Ulang"
        : "Ketuk kata, huruf, angka, atau barcode terlebih dahulu",
      false
    );
    return;
  }
  writeTextToClipboardSafe(targetVal);

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
    isPendingScanDuplicate = false;
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

  isScanLocked = false;
  lastScanned = "";
  pendingScanData = null;
  isPendingScanDuplicate = false;
  resetCandidateScan();

  const resolvedFormat = detectedFormat || detectScanFormatType(targetVal, "OCR Text");
  generateQR(targetVal, resolvedFormat, activeAppFeature === "text-to-qr");
}

function handlePhotoFileSelected(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const resultUrl = ev.target && ev.target.result ? String(ev.target.result) : "";
    if (resultUrl) {
      openPhotoLensPanel();
      applyDetectedPhotoText(resultUrl);
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
