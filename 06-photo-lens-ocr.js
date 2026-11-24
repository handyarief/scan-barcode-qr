// 7. Engine Foto Lens: Auto-Crop CamScanner + Deteksi Barcode/QR & Huruf/Angka Akurat
let ocrPreloadPromise = null;

function setPhotoLensStatus(msg, hide = false) {
  if (!photoLensStatus) return;
  photoLensStatus.textContent = msg;
  photoLensStatus.classList.toggle("hidden", Boolean(hide));
}

function setDocEnhanceSweepActive(active) {
  const sweepEl = document.getElementById("doc-enhance-sweep");
  if (!sweepEl) return;
  sweepEl.classList.toggle("active", Boolean(active));
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
  setDocEnhanceSweepActive(false);
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

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    if (!blob) {
      resolve("");
      return;
    }
    try {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev && ev.target && ev.target.result ? String(ev.target.result) : "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    } catch (err) {
      resolve("");
    }
  });
}

function captureSnapshotFromVideo() {
  const videoEl = document.querySelector("#reader video");
  if (!videoEl || !videoEl.videoWidth || !videoEl.videoHeight) return "";
  try {
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const maxDim = Math.max(vw, vh, 1);
    const scale = maxDim < 1440 ? 1440 / maxDim : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(vw * scale));
    canvas.height = Math.max(1, Math.round(vh * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.99);
  } catch (err) {
    return "";
  }
}

async function captureHighResPhotoFromCamera() {
  if (typeof triggerAutoFocus === "function") {
    await withPromiseTimeout(triggerAutoFocus(false), 320, null).catch(() => {});
  }

  try {
    if (
      typeof html5QrCode !== "undefined" &&
      html5QrCode &&
      typeof html5QrCode.getRunningTrackCapabilities === "function"
    ) {
      const videoEl = document.querySelector("#reader video");
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
            const dataUrl = await blobToDataUrl(photoBlob);
            if (dataUrl) return dataUrl;
          }
        }
      }
    }
  } catch (err) {}

  return captureSnapshotFromVideo();
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
          tessedit_pageseg_mode: "6",
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

function buildEnhancedCanvasForOcr(img) {
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;
  const maxDim = Math.max(naturalW, naturalH, 1);
  const targetMaxDim = maxDim < 1400 ? 1650 : Math.min(2000, maxDim);
  const scale = targetMaxDim / maxDim;

  const width = Math.max(1, Math.round(naturalW * scale));
  const height = Math.max(1, Math.round(naturalH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { canvas, scale: 1, cleanGray: null, width, height };

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const total = width * height;
    const rawGray = new Uint8Array(total);

    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      rawGray[p] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }

    // Estimasi latar belakang lokal untuk membersihkan noda lipatan kertas sebelum OCR
    const blurRadius = Math.max(12, Math.round(Math.min(width, height) / 42));
    const localBg =
      typeof separableBoxBlurFloat === "function"
        ? separableBoxBlurFloat(rawGray, width, height, blurRadius)
        : null;

    const normGray = new Uint8Array(total);
    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      const gVal = rawGray[p];
      const bgVal = localBg ? Math.max(85, localBg[p]) : 235;
      const ratio = gVal / bgVal;
      let cleanVal;
      if (ratio >= 0.87 || gVal >= 224) {
        cleanVal = 255;
      } else if (ratio <= 0.65 || gVal <= 95) {
        cleanVal = 0;
      } else {
        cleanVal = Math.max(0, Math.min(255, Math.round(((ratio - 0.65) / 0.22) * 255)));
      }
      normGray[p] = cleanVal;
      data[i] = cleanVal;
      data[i + 1] = cleanVal;
      data[i + 2] = cleanVal;
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
      if (transitions >= 22 && span > w * 0.16) {
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
        if (bandHeight >= Math.max(18, h * 0.024) && countRows >= 5) {
          const avgMinX = Math.max(0, sumMinX / countRows - 4);
          const avgMaxX = Math.min(w, sumMaxX / countRows + 4);
          const bandWidth = avgMaxX - avgMinX;
          if (bandWidth > bandHeight * 1.15) {
            regions.push({
              type: "barcode",
              text: "",
              format: "CODE_128",
              bbox: {
                x0: avgMinX * invScale,
                y0: Math.max(0, startY) * invScale,
                x1: avgMaxX * invScale,
                y1: Math.min(h, endY) * invScale
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

function detectSquareMatrixRegions(canvas, scale) {
  const ctx = canvas.getContext("2d");
  if (!ctx || !canvas.width || !canvas.height) return [];

  try {
    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h).data;
    const invScale = scale > 0 ? 1 / scale : 1;

    const step = 4;
    const gw = Math.floor(w / step);
    const gh = Math.floor(h / step);
    if (gw < 16 || gh < 16) return [];

    const denseMask = new Uint8Array(gw * gh);
    const win = 3;

    for (let gy = win; gy < gh - win; gy += 1) {
      for (let gx = win; gx < gw - win; gx += 1) {
        let darkCount = 0;
        let transitions = 0;
        let prevDark = false;
        let totalSamples = 0;

        for (let dy = -win; dy <= win; dy += 1) {
          const py = Math.min(h - 1, (gy + dy) * step);
          for (let dx = -win; dx <= win; dx += 1) {
            const px = Math.min(w - 1, (gx + dx) * step);
            const isDark = imgData[(py * w + px) * 4] < 130;
            if (isDark) darkCount += 1;
            if (dx > -win && isDark !== prevDark) transitions += 1;
            prevDark = isDark;
            totalSamples += 1;
          }
        }

        const darkRatio = darkCount / Math.max(1, totalSamples);
        if (darkRatio >= 0.25 && darkRatio <= 0.75 && transitions >= 8) {
          denseMask[gy * gw + gx] = 1;
        }
      }
    }

    const visited = new Uint8Array(gw * gh);
    const queue = new Int32Array(gw * gh);
    const regions = [];

    for (let gy = 1; gy < gh - 1; gy += 1) {
      for (let gx = 1; gx < gw - 1; gx += 1) {
        const start = gy * gw + gx;
        if (!denseMask[start] || visited[start]) continue;

        let head = 0;
        let tail = 0;
        queue[tail++] = start;
        visited[start] = 1;

        let count = 0;
        let minX = gx;
        let maxX = gx;
        let minY = gy;
        let maxY = gy;

        while (head < tail) {
          const curr = queue[head++];
          const cy = Math.floor(curr / gw);
          const cx = curr - cy * gw;
          count += 1;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          const neighbors = [
            cx > 0 ? curr - 1 : -1,
            cx < gw - 1 ? curr + 1 : -1,
            cy > 0 ? curr - gw : -1,
            cy < gh - 1 ? curr + gw : -1
          ];
          for (let n = 0; n < 4; n += 1) {
            const nb = neighbors[n];
            if (nb >= 0 && denseMask[nb] && !visited[nb]) {
              visited[nb] = 1;
              queue[tail++] = nb;
            }
          }
        }

        const boxW = (maxX - minX + 1) * step;
        const boxH = (maxY - minY + 1) * step;
        const aspect = boxW / Math.max(1, boxH);
        const minSide = Math.max(36, Math.min(w, h) * 0.085);

        if (
          count >= 18 &&
          boxW >= minSide &&
          boxH >= minSide &&
          aspect >= 0.72 &&
          aspect <= 1.38
        ) {
          const pad = 3 * step;
          regions.push({
            type: "barcode",
            text: "",
            format: "QR_CODE",
            bbox: {
              x0: Math.max(0, (minX * step - pad)) * invScale,
              y0: Math.max(0, (minY * step - pad)) * invScale,
              x1: Math.min(w, ((maxX + 1) * step + pad)) * invScale,
              y1: Math.min(h, ((maxY + 1) * step + pad)) * invScale
            }
          });
        }
      }
    }

    return regions;
  } catch (err) {
    return [];
  }
}

function mergeDetectedBarcodes(nativeBarcodes, extraRegions) {
  const merged = [...nativeBarcodes];
  extraRegions.forEach((reg) => {
    const rMidY = (reg.bbox.y0 + reg.bbox.y1) / 2;
    const rMidX = (reg.bbox.x0 + reg.bbox.x1) / 2;
    const alreadyCovered = merged.some(
      (nb) =>
        rMidX >= nb.bbox.x0 - 20 &&
        rMidX <= nb.bbox.x1 + 20 &&
        rMidY >= nb.bbox.y0 - 20 &&
        rMidY <= nb.bbox.y1 + 20
    );
    if (!alreadyCovered) {
      merged.push(reg);
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
  const marginY = Math.round(bHeight * 0.16);
  const sx = Math.max(0, Math.floor(bc.bbox.x0 - marginX));
  const sy = Math.max(0, Math.floor(bc.bbox.y0 - marginY));
  const sw = Math.min(naturalW - sx, Math.ceil(bWidth + marginX * 2));
  const sh = Math.min(naturalH - sy, Math.ceil(bHeight + marginY * 2));
  if (sw <= 10 || sh <= 10) return;

  const quietPad = 64;
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
    if (bc.type === "barcode" && (!bc.text || bc.format === "CODE_128")) {
      const interX0 = Math.max(wordBbox.x0, b.x0);
      const interY0 = Math.max(wordBbox.y0, b.y0);
      const interX1 = Math.min(wordBbox.x1, b.x1);
      const interY1 = Math.min(wordBbox.y1, b.y1);
      if (interX1 > interX0 && interY1 > interY0) {
        const interArea = (interX1 - interX0) * (interY1 - interY0);
        if (interArea / wArea > 0.72) {
          return true;
        }
      }
      return false;
    }

    if (cx >= b.x0 && cx <= b.x1 && cy >= b.y0 && cy <= b.y1) {
      return true;
    }
    const interX0 = Math.max(wordBbox.x0, b.x0);
    const interY0 = Math.max(wordBbox.y0, b.y0);
    const interX1 = Math.min(wordBbox.x1, b.x1);
    const interY1 = Math.min(wordBbox.y1, b.y1);
    if (interX1 > interX0 && interY1 > interY0) {
      const interArea = (interX1 - interX0) * (interY1 - interY0);
      if (interArea / wArea > 0.65) {
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

  if (/^[|!Il1i\[\]\/\\\-_=.,:;'"`~]+$/.test(clean) && height > width * 1.45) {
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
  if (bw <= 3 || bh <= 3) return rawBbox;

  const colCounts = new Uint16Array(bw);
  const rowCounts = new Uint16Array(bh);
  const inkThreshold = 205;

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
  while (trimY0 < trimY1 && rowCounts[trimY0] < 1) {
    trimY0 += 1;
  }
  while (trimY1 > trimY0 && rowCounts[trimY1] < 1) {
    trimY1 -= 1;
  }

  let trimX0 = 0;
  let trimX1 = bw - 1;
  while (trimX0 < trimX1 && colCounts[trimX0] < 1) {
    trimX0 += 1;
  }
  while (trimX1 > trimX0 && colCounts[trimX1] < 1) {
    trimX1 -= 1;
  }

  if (trimX1 <= trimX0 || trimY1 <= trimY0) {
    return rawBbox;
  }

  return {
    x0: Math.max(0, x0 + trimX0 - 2),
    y0: Math.max(0, y0 + trimY0 - 1),
    x1: Math.min(imgW, x0 + trimX1 + 3),
    y1: Math.min(imgH, y0 + trimY1 + 2)
  };
}

function extractWordsFromTesseractData(data) {
  if (!data) return [];

  if (Array.isArray(data.words) && data.words.length > 0) {
    return data.words;
  }

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
  const maxCanvasW = canvas.width * 0.96;
  const maxCanvasH = canvas.height * 0.25;

  return rawWords
    .filter((w) => {
      if (!w || !w.bbox) return false;
      const rawStr = String(w.text || "").trim().replace(/^\|+|\|+$/g, "").trim();
      if (!rawStr) return false;

      const boxW = (Number(w.bbox.x1) || 0) - (Number(w.bbox.x0) || 0);
      const boxH = (Number(w.bbox.y1) || 0) - (Number(w.bbox.y0) || 0);
      if (boxW < 2 || boxH < 3 || boxW > maxCanvasW || boxH > maxCanvasH) {
        return false;
      }

      const conf = typeof w.confidence === "number" ? w.confidence : 55;
      const isAlnum = /^[A-Za-z0-9\-_./:()<>]+$/.test(rawStr);
      const minConf = isAlnum ? 3 : 12;
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
        confidence: typeof w.confidence === "number" ? w.confidence : 55,
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
    const worker = await withPromiseTimeout(getPersistentOcrWorker(), 12000, null);
    if (worker) {
      await withPromiseTimeout(
        worker.setParameters({
          tessedit_pageseg_mode: "6",
          preserve_interword_spaces: "1"
        }),
        2000,
        null
      );

      const recognizeRes = await withPromiseTimeout(
        worker.recognize(canvas, {}, { blocks: true, text: true, tsv: true }),
        16000,
        null
      );
      const data = recognizeRes && recognizeRes.data ? recognizeRes.data : null;
      let parsed = parseRawTesseractWords(
        extractWordsFromTesseractData(data),
        canvas,
        scale,
        cleanGray
      );

      if (parsed.length < 4) {
        const binCanvas = buildBinarizedCropCanvas(canvas, 0.93);
        const retryRes = await withPromiseTimeout(
          worker.recognize(binCanvas, {}, { blocks: true, text: true, tsv: true }),
          14000,
          null
        );
        const retryData = retryRes && retryRes.data ? retryRes.data : null;
        const retryParsed = parseRawTesseractWords(
          extractWordsFromTesseractData(retryData),
          binCanvas,
          scale,
          cleanGray
        );
        if (retryParsed.length > parsed.length) {
          parsed = retryParsed;
        }
      }

      return parsed;
    }

    if (typeof window.Tesseract !== "undefined" && typeof window.Tesseract.recognize === "function") {
      const fallbackRes = await withPromiseTimeout(
        window.Tesseract.recognize(
          canvas,
          "eng",
          { logger: () => {}, tessedit_pageseg_mode: "6" },
          { blocks: true, text: true, tsv: true }
        ),
        16000,
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
    const maxSearchY = b.y1 + bHeight * 2.1;

    const candidatesBelow = wordItems
      .filter((w) => {
        const wMidY = (w.bbox.y0 + w.bbox.y1) / 2;
        const wMidX = (w.bbox.x0 + w.bbox.x1) / 2;
        const isBelow = wMidY >= b.y1 - 2 && wMidY <= maxSearchY;
        const isAlignedX = wMidX >= b.x0 - 60 && wMidX <= b.x1 + 60;
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
      12,
      ((a.bbox.y1 - a.bbox.y0) + (b.bbox.y1 - b.bbox.y0)) * 0.34
    );
    if (Math.abs(midAY - midBY) > lineThreshold) {
      return midAY - midBY;
    }
    return a.bbox.x0 - b.bbox.x0;
  });
}

function mapViewportQuadToImageQuad(viewportQuad, photoDataUrl) {
  if (!Array.isArray(viewportQuad) || viewportQuad.length !== 4) return null;
  const videoEl = document.querySelector("#reader video");
  if (!videoEl || !videoEl.videoWidth || !videoEl.videoHeight) {
    return viewportQuad;
  }

  // Jika foto diambil via ImageCapture dengan rasio berbeda dari <video>, biarkan auto-crop menganalisis gambar asli
  if (photoDataUrl && typeof window.ImageCapture !== "undefined") {
    return null;
  }

  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  const vpRect = scannerViewport ? scannerViewport.getBoundingClientRect() : null;
  if (!vpRect || !vpRect.width || !vpRect.height) return viewportQuad;

  const cw = vpRect.width;
  const ch = vpRect.height;
  const coverScale = Math.max(cw / vw, ch / vh);
  const dispW = vw * coverScale;
  const dispH = vh * coverScale;
  const offX = (cw - dispW) / 2;
  const offY = (ch - dispH) / 2;

  return viewportQuad.map((p) => {
    const vxPx = p.x * dispW + offX;
    const vyPx = p.y * dispH + offY;
    const normX = Math.max(0.005, Math.min(0.995, vxPx / cw));
    const normY = Math.max(0.005, Math.min(0.995, vyPx / ch));
    return { x: normX, y: normY };
  });
}

async function applyDetectedPhotoText(rawImageUrl, preDetectedQuad = null) {
  const token = ++ocrRunToken;
  clearPhotoLensState();
  setPhotoLensStatus("Auto-crop & deteksi teks/barkode...", false);

  if (capturedPhotoPreview && rawImageUrl) {
    capturedPhotoPreview.src = rawImageUrl;
    capturedPhotoPreview.classList.add("has-image");
    setDocEnhanceSweepActive(true);
  }

  try {
    const mappedQuad = mapViewportQuadToImageQuad(preDetectedQuad, rawImageUrl);
    const processedDataUrl = await processDocumentAutoCropAndEnhance(rawImageUrl, mappedQuad);
    if (token !== ocrRunToken) return;

    setDocEnhanceSweepActive(false);

    if (capturedPhotoPreview) {
      capturedPhotoPreview.src = processedDataUrl;
      capturedPhotoPreview.classList.add("has-image");
    }

    const img = await loadImageElement(processedDataUrl);
    if (token !== ocrRunToken) return;

    ocrNaturalWidth = img.naturalWidth || img.width;
    ocrNaturalHeight = img.naturalHeight || img.height;

    const { canvas: enhancedCanvas, scale, cleanGray } = buildEnhancedCanvasForOcr(img);

    const nativeBarcodes = await detectBarcodeBoxesWithNativeDetector(img);
    if (token !== ocrRunToken) return;

    const stripeBarcodes = detectStripeBarcodeRegions(enhancedCanvas, scale);
    const matrixBarcodes = detectSquareMatrixRegions(enhancedCanvas, scale);
    const barcodeItems = mergeDetectedBarcodes(nativeBarcodes, [...stripeBarcodes, ...matrixBarcodes]);

    await Promise.all(
      barcodeItems.map((bc) => decodeSingleBarcodeRegionFromImage(img, bc))
    );
    if (token !== ocrRunToken) return;

    if (barcodeItems.length > 0) {
      ocrWordItems = sortDetectedItemsReadingOrder(barcodeItems);
      selectedOcrIndices = [];
      renderOcrWordBoxes();
    }

    const tesseractWords = await detectWordBoxesWithTesseract(enhancedCanvas, scale, cleanGray);
    if (token !== ocrRunToken) return;

    const cleanWords = tesseractWords.filter(
      (wordItem) => !isBoxOverlappingBarcode(wordItem.bbox, barcodeItems)
    );

    attachFallbackValuesToBarcodes(barcodeItems, cleanWords);

    const combinedItems = sortDetectedItemsReadingOrder([...barcodeItems, ...cleanWords]);
    ocrWordItems = combinedItems;
    selectedOcrIndices = [];
    renderOcrWordBoxes();

    if (ocrWordItems.length > 0) {
      setPhotoLensStatus("", true);
    } else {
      setPhotoLensStatus("Angka/huruf tidak terbaca, ketuk Foto Ulang", false);
    }
  } catch (err) {
    if (token !== ocrRunToken) return;
    setDocEnhanceSweepActive(false);
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
  const gap = 10;

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

    const padX = item.type === "barcode" ? 3 : 3.5;
    const padY = item.type === "barcode" ? 3 : 2.5;

    const left = metrics.offsetX + item.bbox.x0 * metrics.scale - padX;
    const top = metrics.offsetY + item.bbox.y0 * metrics.scale - padY;
    const width = Math.max(14, (item.bbox.x1 - item.bbox.x0) * metrics.scale + padX * 2);
    const height = Math.max(15, (item.bbox.y1 - item.bbox.y0) * metrics.scale + padY * 2);

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
    const pad = 8;
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

async function triggerPhotoCapture() {
  if (activeAppFeature === "scan-to-excel" && !isExcelTextPhotoMode) {
    enterExcelTextPhotoMode();
    return;
  }

  docAutoScanTriggered = true;
  const capturedQuad = lastDetectedDocQuad ? lastDetectedDocQuad.map((p) => ({ ...p })) : null;
  clearPhotoLensState();
  openPhotoLensPanel();
  setPhotoLensStatus("Mengambil foto resolusi tinggi...", false);

  const snapDataUrl = await captureHighResPhotoFromCamera();
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

  isScanLocked = false;
  lastScanned = "";
  pendingScanData = null;
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
