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
  const targetMaxDim = 1600;
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
    const normGray = new Uint8Array(width * height);

    for (let i = 0, p = 0; i < len; i += 4, p += 1) {
      normGray[p] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
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
  setPhotoLensStatus("Memproses dokumen...", false);

  try {
    // Auto-crop + filter bersih putih murni (#FFFFFF) & teks/kode hitam pekat seperti Gambar 3
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

    // Tahap 1: Deteksi area barcode secara senyap di latar belakang
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
      selectedOcrIndices = [];
      renderOcrWordBoxes();
    }

    // Tahap 2: Deteksi huruf & angka tanpa menutupi gambar dengan blok biru massal
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

  const barWidth = photoLensActionBar.offsetWidth || 196;
  const barHeight = photoLensActionBar.offsetHeight || 42;
  const gap = 10;

  let targetLeft = 0;
  let targetTop = (minTop + maxBottom) / 2 - barHeight / 2;

  if (maxRight + gap + barWidth <= stageRect.width - 8) {
    targetLeft = maxRight + gap;
  } else if (minLeft - gap - barWidth >= 8) {
    targetLeft = minLeft - gap - barWidth;
  } else {
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
  generateQR(targetVal, resolvedFormat);
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
