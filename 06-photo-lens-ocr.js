// 7. Engine Foto Lens: Framing Presisi Live Preview -> Deteksi Cepat & Rapi Ala Google Lens
let ocrPreloadPromise = null;
let startHandleEl = null;
let endHandleEl = null;

function setPhotoLensStatus(msg, hide = false) {
  if (!photoLensStatus) return;
  photoLensStatus.textContent = msg;
  photoLensStatus.classList.toggle("hidden", Boolean(hide));
}

function removeSelectionHandles() {
  if (startHandleEl && startHandleEl.parentNode) {
    startHandleEl.parentNode.removeChild(startHandleEl);
  }
  if (endHandleEl && endHandleEl.parentNode) {
    endHandleEl.parentNode.removeChild(endHandleEl);
  }
  startHandleEl = null;
  endHandleEl = null;
}

function clearPhotoLensState() {
  ocrWordItems = [];
  ocrSelectionUnits = [];
  selectedOcrIndices = [];
  activeSelectionRange = null;
  draggingHandleSide = null;
  ocrNaturalWidth = 0;
  ocrNaturalHeight = 0;
  isOcrDragging = false;
  ocrDragStartIdx = -1;
  ocrDragStartPoint = null;
  ocrDragMoved = false;
  removeSelectionHandles();
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

function drawCroppedToViewportDataUrl(source, srcW, srcH, targetAspect, maxOutDim = 2048) {
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
    return canvas.toDataURL("image/jpeg", 0.95);
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
    2048
  );
}

async function cropPhotoBlobToViewport(photoBlob, targetAspect) {
  if (!photoBlob) return "";
  const objectUrl = URL.createObjectURL(photoBlob);
  try {
    const img = await loadImageElement(objectUrl);
    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    return drawCroppedToViewportDataUrl(img, natW, natH, targetAspect, 2048);
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

  const alreadyFocused = typeof isCameraFocusedReady !== "undefined" && Boolean(isCameraFocusedReady);
  if (!alreadyFocused) {
    if (typeof waitForCameraAutoFocusLock === "function") {
      await withPromiseTimeout(waitForCameraAutoFocusLock(450), 500, true).catch(() => {});
    } else if (typeof triggerAutoFocus === "function") {
      await withPromiseTimeout(triggerAutoFocus(true), 250, null).catch(() => {});
    }
  }

  const videoEl = document.querySelector("#reader video");
  const vw = videoEl ? videoEl.videoWidth || 0 : 0;
  const vh = videoEl ? videoEl.videoHeight || 0 : 0;

  if (videoEl && Math.max(vw, vh) >= 1080) {
    const exactFrame = captureSnapshotFromVideo(targetAspect);
    if (exactFrame) {
      return exactFrame;
    }
  }

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

  if (videoEl && Math.max(vw, vh) >= 640) {
    const exactFrame = captureSnapshotFromVideo(targetAspect);
    if (exactFrame) {
      return exactFrame;
    }
  }

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

function preloadOcrWorker() {
  if (!ocrPreloadPromise) {
    ocrPreloadPromise = withPromiseTimeout(getPersistentOcrWorker(), 15000, null).catch(() => null);
  }
  return ocrPreloadPromise;
}

function computeGrayArray(img, targetMaxDim) {
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;
  const maxDim = Math.max(naturalW, naturalH, 1);
  const scale = targetMaxDim / maxDim;
  const width = Math.max(1, Math.round(naturalW * scale));
  const height = Math.max(1, Math.round(naturalH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { canvas, ctx: null, gray: new Uint8Array(0), scale: 1, width, height };
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const totalPixels = width * height;
  const gray = new Uint8Array(totalPixels);

  for (let i = 0, p = 0; p < totalPixels; i += 4, p += 1) {
    gray[p] = (77 * data[i] + 150 * data[i + 1] + 29 * data[i + 2]) >> 8;
  }

  return { canvas, ctx, imageData, gray, scale, width, height };
}

// Kanvas OCR internal dengan normalisasi persentil kertas terang & masking area barcode aman
function buildOcrCanvasFromImage(img, invertDarkBg = false, maskRegions = []) {
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;
  const maxDim = Math.max(naturalW, naturalH, 1);
  const targetMaxDim = maxDim < 1400 ? 1700 : Math.min(2048, maxDim);

  const prep = computeGrayArray(img, targetMaxDim);
  const { canvas, ctx, imageData, gray, scale, width, height } = prep;
  if (!ctx || !gray.length) {
    return { canvas, scale: 1, width, height, gray };
  }

  try {
    const data = imageData.data;
    const totalPixels = width * height;

    const cellSize = Math.max(32, Math.round(Math.min(width, height) / 18));
    const gridCols = Math.max(1, Math.ceil(width / cellSize));
    const gridRows = Math.max(1, Math.ceil(height / cellSize));
    const bgGrid = new Float32Array(gridCols * gridRows);
    const hist = new Uint32Array(256);

    for (let gy = 0; gy < gridRows; gy += 1) {
      const yStart = gy * cellSize;
      const yEnd = Math.min(height, yStart + cellSize);
      for (let gx = 0; gx < gridCols; gx += 1) {
        const xStart = gx * cellSize;
        const xEnd = Math.min(width, xStart + cellSize);
        hist.fill(0);
        let totalSamples = 0;

        for (let y = yStart; y < yEnd; y += 2) {
          const rowOff = y * width;
          for (let x = xStart; x < xEnd; x += 2) {
            hist[gray[rowOff + x]] += 1;
            totalSamples += 1;
          }
        }

        if (totalSamples === 0) {
          bgGrid[gy * gridCols + gx] = invertDarkBg ? 40 : 210;
          continue;
        }

        if (invertDarkBg) {
          const targetIdx = Math.max(0, Math.floor(totalSamples * 0.14));
          let acc = 0;
          let picked = 35;
          for (let v = 0; v < 256; v += 1) {
            acc += hist[v];
            if (acc >= targetIdx) {
              picked = v;
              break;
            }
          }
          bgGrid[gy * gridCols + gx] = Math.max(20, picked);
        } else {
          const targetIdx = Math.min(totalSamples - 1, Math.floor(totalSamples * 0.88));
          let acc = 0;
          let picked = 215;
          for (let v = 255; v >= 0; v -= 1) {
            acc += hist[v];
            if (acc >= targetIdx) {
              picked = v;
              break;
            }
          }
          bgGrid[gy * gridCols + gx] = Math.max(76, picked);
        }
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
        const localBg = Math.max(56, topBg * (1 - ty) + botBg * ty);

        const p = rowOff + x;
        let val;
        if (invertDarkBg) {
          const lift = Math.max(0, gray[p] - localBg);
          val = 255 - Math.min(255, Math.round(lift * 2.15));
        } else {
          const ratio = (gray[p] / localBg) * 250;
          val = Math.round((ratio - 132) * 1.24 + 144);
        }
        normBuf[p] = val < 0 ? 0 : val > 255 ? 255 : val;
      }
    }

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
        let sharp = Math.round(center + (center - avgNeighbors) * 0.34);
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

    // Mask bagian dalam barcode/QR yang terkonfirmasi agar batang garis tidak dibaca sebagai huruf
    if (Array.isArray(maskRegions) && maskRegions.length > 0) {
      ctx.fillStyle = "#ffffff";
      maskRegions.forEach((item) => {
        if (!item || !item.bbox || item.isInvalidPhotoBox) return;
        const bx0 = item.bbox.x0 * scale;
        const by0 = item.bbox.y0 * scale;
        const bx1 = item.bbox.x1 * scale;
        const by1 = item.bbox.y1 * scale;
        const bw = bx1 - bx0;
        const bh = by1 - by0;
        if (bw <= 8 || bh <= 8) return;

        // Sisakan sedikit margin atas-bawah agar teks tepat di bawah/atas barcode tetap terbaca OCR
        const mx0 = Math.max(0, Math.floor(bx0 + bw * 0.03));
        const my0 = Math.max(0, Math.floor(by0 + bh * 0.05));
        const mx1 = Math.min(width, Math.ceil(bx1 - bw * 0.03));
        const my1 = Math.min(height, Math.ceil(by1 - bh * 0.14));
        if (mx1 > mx0 && my1 > my0) {
          ctx.fillRect(mx0, my0, mx1 - mx0, my1 - my0);
        }
      });
    }
  } catch (err) {}

  return { canvas, scale, width, height, gray };
}

function createRotatedCanvasForOcr(sourceCanvas, angleDeg) {
  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;
  const rotCanvas = document.createElement("canvas");
  if (angleDeg === 90 || angleDeg === 270) {
    rotCanvas.width = sh;
    rotCanvas.height = sw;
  } else {
    rotCanvas.width = sw;
    rotCanvas.height = sh;
  }
  const ctx = rotCanvas.getContext("2d");
  if (!ctx) return rotCanvas;

  ctx.save();
  if (angleDeg === 90) {
    ctx.translate(sh, 0);
    ctx.rotate((90 * Math.PI) / 180);
  } else if (angleDeg === 270) {
    ctx.translate(0, sw);
    ctx.rotate((-90 * Math.PI) / 180);
  } else if (angleDeg === 180) {
    ctx.translate(sw, sh);
    ctx.rotate(Math.PI);
  }
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.restore();
  return rotCanvas;
}

function unrotateBboxToSource(bbox, rotW, rotH, angleDeg) {
  if (angleDeg === 270) {
    // Rotasi -90 deg: (rx, ry) pada rotCanvas (rotW x rotH) berasal dari (sx, sy) pada (rotH x rotW):
    // rx = sy, ry = rotW - 1 - sx  =>  sx = rotW - 1 - ry, sy = rx
    return {
      x0: Math.max(0, rotW - 1 - bbox.y1),
      y0: Math.max(0, bbox.x0),
      x1: Math.max(0, rotW - 1 - bbox.y0),
      y1: Math.max(0, bbox.x1)
    };
  }
  if (angleDeg === 90) {
    // Rotasi +90 deg: rx = rotH - 1 - sy, ry = sx  =>  sx = ry, sy = rotH - 1 - rx
    return {
      x0: Math.max(0, bbox.y0),
      y0: Math.max(0, rotH - 1 - bbox.x1),
      x1: Math.max(0, bbox.y1),
      y1: Math.max(0, rotH - 1 - bbox.x0)
    };
  }
  if (angleDeg === 180) {
    return {
      x0: Math.max(0, rotW - 1 - bbox.x1),
      y0: Math.max(0, rotH - 1 - bbox.y1),
      x1: Math.max(0, rotW - 1 - bbox.x0),
      y1: Math.max(0, rotH - 1 - bbox.y0)
    };
  }
  return { ...bbox };
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

function filterValidPhotoBarcodeBoxes(items, imgWidth, imgHeight) {
  const totalArea = Math.max(1, imgWidth * imgHeight);
  return items.filter((item) => {
    if (!item || !item.bbox) return false;
    const bw = item.bbox.x1 - item.bbox.x0;
    const bh = item.bbox.y1 - item.bbox.y0;
    if (bw < 14 || bh < 14) return false;

    const areaRatio = (bw * bh) / totalArea;
    const widthRatio = bw / Math.max(1, imgWidth);
    const heightRatio = bh / Math.max(1, imgHeight);
    const fmt = String(item.format || "").toUpperCase();
    const is2D = fmt.includes("QR") || fmt.includes("DATA_MATRIX") || fmt.includes("AZTEC") || fmt.includes("PDF417");

    // Tolak bounding box anomali yang membungkus blok stiker besar/seluruh label pada foto multi-item
    if (!is2D && areaRatio > 0.16 && widthRatio > 0.55 && heightRatio > 0.22) {
      return false;
    }
    if (areaRatio > 0.42) {
      return false;
    }
    return true;
  });
}

function deduplicateBarcodeItems(items) {
  const unique = [];
  items.forEach((cand) => {
    const cMidX = (cand.bbox.x0 + cand.bbox.x1) / 2;
    const cMidY = (cand.bbox.y0 + cand.bbox.y1) / 2;
    const exists = unique.some((ex) => {
      const eMidX = (ex.bbox.x0 + ex.bbox.x1) / 2;
      const eMidY = (ex.bbox.y0 + ex.bbox.y1) / 2;
      const tolX = Math.max(16, ((ex.bbox.x1 - ex.bbox.x0) + (cand.bbox.x1 - cand.bbox.x0)) * 0.35);
      const tolY = Math.max(16, ((ex.bbox.y1 - ex.bbox.y0) + (cand.bbox.y1 - cand.bbox.y0)) * 0.35);
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

async function detectConfirmedBarcodesFromImage(img, allowSlowFallback = false) {
  const imgW = img.naturalWidth || img.width || 1;
  const imgH = img.naturalHeight || img.height || 1;

  const nativeItems = await detectBarcodeBoxesWithNativeDetector(img, 1);
  if (nativeItems.length > 0) {
    const validNative = filterValidPhotoBarcodeBoxes(deduplicateBarcodeItems(nativeItems), imgW, imgH);
    if (validNative.length > 0) {
      return validNative;
    }
  }

  const prep = computeGrayArray(img, Math.min(1800, Math.max(imgW, imgH)));
  if (prep.ctx && prep.gray.length) {
    const { ctx, imageData, gray, width, height } = prep;
    const data = imageData.data;
    for (let i = 0, p = 0; p < gray.length; i += 4, p += 1) {
      const c = Math.max(0, Math.min(255, Math.round((gray[p] - 128) * 1.45 + 128)));
      data[i] = c;
      data[i + 1] = c;
      data[i + 2] = c;
      data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    const nativeFromHighContrast = await detectBarcodeBoxesWithNativeDetector(
      prep.canvas,
      prep.scale || 1
    );
    if (nativeFromHighContrast.length > 0) {
      const validHc = filterValidPhotoBarcodeBoxes(
        deduplicateBarcodeItems(nativeFromHighContrast),
        imgW,
        imgH
      );
      if (validHc.length > 0) {
        return validHc;
      }
    }
  }

  if (allowSlowFallback) {
    const fileDecoded = await scanBarcodeFromCanvasWithFileDecoder(prep.canvas);
    if (fileDecoded && fileDecoded.text) {
      return [
        {
          type: "barcode",
          text: fileDecoded.text,
          format: fileDecoded.format || detectScanFormatType(fileDecoded.text, "BARCODE"),
          bbox: {
            x0: imgW * 0.2,
            y0: imgH * 0.25,
            x1: imgW * 0.8,
            y1: imgH * 0.75
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
    // Gunakan area inti bagian atas-tengah barcode agar teks di bawah barcode tidak ikut tersaring
    const coreY1 = b.y0 + (b.y1 - b.y0) * 0.82;
    if (cx >= b.x0 && cx <= b.x1 && cy >= b.y0 && cy <= coreY1) {
      return true;
    }
    const interX0 = Math.max(wordBbox.x0, b.x0);
    const interY0 = Math.max(wordBbox.y0, b.y0);
    const interX1 = Math.min(wordBbox.x1, b.x1);
    const interY1 = Math.min(wordBbox.y1, coreY1);
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
  if (clean.length >= 3 && alnumCount / clean.length < 0.35) return false;
  return true;
}

function extractWordCharBoxes(rawWord, cleanStr, wordBbox, isVertical = false) {
  const chars = Array.from(cleanStr);
  if (chars.length === 0) return [];

  const rawSymbols = Array.isArray(rawWord && rawWord.symbols) ? rawWord.symbols : [];
  const validSymbols = rawSymbols.filter((sym) => {
    const symText = String(sym && sym.text ? sym.text : "").trim();
    return sym && sym.bbox && symText.length > 0 && symText !== " ";
  });

  if (validSymbols.length === chars.length) {
    return validSymbols.map((sym, idx) => ({
      char: chars[idx],
      bbox: {
        x0: Number(sym.bbox.x0) || wordBbox.x0,
        y0: Number(sym.bbox.y0) || wordBbox.y0,
        x1: Number(sym.bbox.x1) || wordBbox.x1,
        y1: Number(sym.bbox.y1) || wordBbox.y1
      }
    }));
  }

  // Fallback pembagian proporsional akurat bila simbol Tesseract tidak tersedia
  const result = [];
  if (isVertical) {
    const totalH = Math.max(1, wordBbox.y1 - wordBbox.y0);
    const stepH = totalH / chars.length;
    for (let i = 0; i < chars.length; i += 1) {
      result.push({
        char: chars[i],
        bbox: {
          x0: wordBbox.x0,
          y0: wordBbox.y0 + stepH * i,
          x1: wordBbox.x1,
          y1: wordBbox.y0 + stepH * (i + 1)
        }
      });
    }
  } else {
    const totalW = Math.max(1, wordBbox.x1 - wordBbox.x0);
    const stepW = totalW / chars.length;
    for (let i = 0; i < chars.length; i += 1) {
      result.push({
        char: chars[i],
        bbox: {
          x0: wordBbox.x0 + stepW * i,
          y0: wordBbox.y0,
          x1: wordBbox.x0 + stepW * (i + 1),
          y1: wordBbox.y1
        }
      });
    }
  }
  return result;
}

function parseRawTesseractWords(rawWords, canvas, scale, strictMode = false, rotationDeg = 0) {
  const invScale = scale > 0 ? 1 / scale : 1;
  const maxCanvasW = canvas.width * 0.88;
  const maxCanvasH = canvas.height * 0.16;
  const minCanvasH = Math.max(6, canvas.height * 0.004);
  const minCanvasW = Math.max(3, canvas.width * 0.0025);
  const isRotated90 = rotationDeg === 90 || rotationDeg === 270;

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
      if (aspectRatio < 0.14 || aspectRatio > 30) {
        return false;
      }

      const conf = typeof w.confidence === "number" ? w.confidence : 50;
      const isCodeLike = /^[A-Za-z0-9/.\-:+<>()|]+$/.test(cleanStr);

      let minConf = strictMode ? 50 : 34;
      if (cleanStr.length === 1) {
        minConf = isCodeLike ? (strictMode ? 62 : 50) : (strictMode ? 72 : 64);
      } else if (cleanStr.length === 2) {
        minConf = isCodeLike ? (strictMode ? 48 : 38) : (strictMode ? 58 : 48);
      } else if (isCodeLike) {
        minConf = strictMode ? 42 : 28;
      }

      return conf >= minConf;
    })
    .map((w) => {
      const cleanStr = sanitizeOcrToken(w.text);
      const rawBox = {
        x0: Number(w.bbox.x0) || 0,
        y0: Number(w.bbox.y0) || 0,
        x1: Number(w.bbox.x1) || 0,
        y1: Number(w.bbox.y1) || 0
      };

      const rawChars = extractWordCharBoxes(w, cleanStr, rawBox, false);
      const mappedChars = rawChars.map((cObj) => {
        const unrotCharBox = unrotateBboxToSource(cObj.bbox, canvas.width, canvas.height, rotationDeg);
        return {
          char: cObj.char,
          bbox: {
            x0: Math.max(0, unrotCharBox.x0 * invScale),
            y0: Math.max(0, unrotCharBox.y0 * invScale),
            x1: Math.max(0, unrotCharBox.x1 * invScale),
            y1: Math.max(0, unrotCharBox.y1 * invScale)
          }
        };
      });

      const unrotWordBox = unrotateBboxToSource(rawBox, canvas.width, canvas.height, rotationDeg);
      const finalBox = {
        x0: Math.max(0, unrotWordBox.x0 * invScale),
        y0: Math.max(0, unrotWordBox.y0 * invScale),
        x1: Math.max(0, unrotWordBox.x1 * invScale),
        y1: Math.max(0, unrotWordBox.y1 * invScale)
      };

      return {
        type: "word",
        text: cleanStr,
        isVertical: isRotated90,
        confidence: typeof w.confidence === "number" ? w.confidence : 50,
        bbox: finalBox,
        chars: mappedChars
      };
    })
    .filter((item) => item.text.length > 0 && item.bbox.x1 > item.bbox.x0 && item.bbox.y1 > item.bbox.y0);
}

async function recognizeCanvasWords(worker, canvas, scale, psm = "11", strictMode = false, rotationDeg = 0) {
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
      worker.recognize(canvas, {}, { blocks: true, text: true, symbols: true }),
      14000,
      null
    );
    const data = recognizeRes && recognizeRes.data ? recognizeRes.data : null;
    return parseRawTesseractWords(
      extractWordsFromTesseractData(data),
      canvas,
      scale,
      strictMode,
      rotationDeg
    );
  }

  if (typeof window.Tesseract !== "undefined" && typeof window.Tesseract.recognize === "function") {
    const fallbackRes = await withPromiseTimeout(
      window.Tesseract.recognize(
        canvas,
        "eng",
        { logger: () => {}, tessedit_pageseg_mode: String(psm) },
        { blocks: true, text: true, symbols: true }
      ),
      14000,
      null
    );
    const data = fallbackRes && fallbackRes.data ? fallbackRes.data : null;
    return parseRawTesseractWords(
      extractWordsFromTesseractData(data),
      canvas,
      scale,
      strictMode,
      rotationDeg
    );
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
    const candConf = typeof cand.confidence === "number" ? cand.confidence : 50;
    let matchedIdx = -1;

    for (let i = 0; i < merged.length; i += 1) {
      const ex = merged[i];
      const { iou, minContainment } = computeBboxIoUAndContainment(ex.bbox, cand.bbox);
      if (iou >= 0.28 || minContainment >= 0.52) {
        matchedIdx = i;
        break;
      }
      const cMidX = (cand.bbox.x0 + cand.bbox.x1) / 2;
      const cMidY = (cand.bbox.y0 + cand.bbox.y1) / 2;
      const eMidX = (ex.bbox.x0 + ex.bbox.x1) / 2;
      const eMidY = (ex.bbox.y0 + ex.bbox.y1) / 2;
      const tolX = Math.max(8, ((ex.bbox.x1 - ex.bbox.x0) + (cand.bbox.x1 - cand.bbox.x0)) * 0.28);
      const tolY = Math.max(8, ((ex.bbox.y1 - ex.bbox.y0) + (cand.bbox.y1 - cand.bbox.y0)) * 0.35);
      if (Math.abs(eMidX - cMidX) <= tolX && Math.abs(eMidY - cMidY) <= tolY) {
        matchedIdx = i;
        break;
      }
    }

    if (matchedIdx >= 0) {
      const ex = merged[matchedIdx];
      const exConf = typeof ex.confidence === "number" ? ex.confidence : 50;
      if (candConf > exConf + 8 || (cand.text.length > ex.text.length && candConf >= exConf - 5)) {
        merged[matchedIdx] = cand;
      }
    } else {
      merged.push(cand);
    }
  });
  return merged;
}

function pruneIsolatedNoiseWords(words) {
  if (words.length <= 2) return words;

  const anchorFlags = words.map((item) => {
    const conf = typeof item.confidence === "number" ? item.confidence : 50;
    return item.text.length >= 2 && conf >= 50;
  });

  return words.filter((item, idx) => {
    if (item.isVertical && item.text.length >= 2) return true;
    const conf = typeof item.confidence === "number" ? item.confidence : 50;
    const isShort = item.text.length <= 1;
    if (!isShort && conf >= 44) return true;

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
      if (dy <= h * 2.5 && dx <= h * 11) {
        nearbyAnchors += 1;
        break;
      }
    }

    if (nearbyAnchors === 0 && (isShort || conf < 64)) {
      return false;
    }
    return true;
  });
}

function mergeSplitCodeFragmentsInRow(lineItems) {
  if (lineItems.length <= 1) return lineItems;
  const merged = [];

  for (let i = 0; i < lineItems.length; i += 1) {
    const curr = {
      ...lineItems[i],
      bbox: { ...lineItems[i].bbox },
      chars: Array.isArray(lineItems[i].chars) ? [...lineItems[i].chars] : []
    };
    const prev = merged.length > 0 ? merged[merged.length - 1] : null;

    if (prev && !prev.isVertical && !curr.isVertical) {
      const prevH = Math.max(6, prev.bbox.y1 - prev.bbox.y0);
      const currH = Math.max(6, curr.bbox.y1 - curr.bbox.y0);
      const refH = Math.min(prevH, currH);
      const gapX = curr.bbox.x0 - prev.bbox.x1;
      const isBothCodeFragment =
        /^[A-Za-z0-9\-_]+$/.test(prev.text) &&
        /^[A-Za-z0-9\-_]+$/.test(curr.text) &&
        !isLabelPrefixToken(prev.text) &&
        !isLabelPrefixToken(curr.text);

      if (isBothCodeFragment && gapX >= -2 && gapX <= refH * 0.24 && (prev.text.length + curr.text.length) <= 24) {
        prev.text = `${prev.text}${curr.text}`;
        prev.bbox.x1 = Math.max(prev.bbox.x1, curr.bbox.x1);
        prev.bbox.y0 = Math.min(prev.bbox.y0, curr.bbox.y0);
        prev.bbox.y1 = Math.max(prev.bbox.y1, curr.bbox.y1);
        prev.confidence = Math.max(prev.confidence || 50, curr.confidence || 50);
        prev.chars = [...(prev.chars || []), ...(curr.chars || [])];
        continue;
      }
    }

    merged.push(curr);
  }

  return merged;
}

function alignAndRefineWordBoxes(words) {
  const verticalWords = words.filter((w) => w.isVertical);
  const horizontalWords = words.filter((w) => !w.isVertical);

  const sortedHoriz = sortDetectedItemsReadingOrder(horizontalWords);
  const lines = [];

  sortedHoriz.forEach((word) => {
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
    const lineItems = mergeSplitCodeFragmentsInRow(
      [...line.items].sort((a, b) => a.bbox.x0 - b.bbox.x0)
    );
    const heights = lineItems.map((it) => Math.max(6, it.bbox.y1 - it.bbox.y0)).sort((a, b) => a - b);
    const medianH = heights[Math.floor(heights.length / 2)] || Math.max(8, line.y1 - line.y0);
    const lineMidY = lineItems.reduce((acc, it) => acc + (it.bbox.y0 + it.bbox.y1) / 2, 0) / Math.max(1, lineItems.length);
    const refinedRow = [];

    for (let i = 0; i < lineItems.length; i += 1) {
      const curr = {
        ...lineItems[i],
        bbox: { ...lineItems[i].bbox }
      };

      const currH = Math.max(6, curr.bbox.y1 - curr.bbox.y0);
      const uniformH = currH >= medianH * 0.65 && currH <= medianH * 1.45 ? medianH : currH;
      curr.bbox.y0 = lineMidY - uniformH * 0.5;
      curr.bbox.y1 = lineMidY + uniformH * 0.5;

      const prev = refinedRow.length > 0 ? refinedRow[refinedRow.length - 1] : null;
      if (prev && curr.bbox.x0 < prev.bbox.x1 + 1.5) {
        const midX = (prev.bbox.x1 + curr.bbox.x0) / 2;
        if (midX - prev.bbox.x0 > 4 && curr.bbox.x1 - midX > 4) {
          prev.bbox.x1 = midX - 0.5;
          curr.bbox.x0 = midX + 0.5;
        } else {
          curr.bbox.x0 = Math.min(curr.bbox.x1 - 4, prev.bbox.x1 + 1.5);
        }
      }

      if (curr.bbox.x1 > curr.bbox.x0 + 2 && curr.bbox.y1 > curr.bbox.y0 + 2) {
        refinedRow.push(curr);
      }
    }
    return refinedRow;
  });

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

  return [...refinedLines.flat(), ...verticalWords];
}

async function detectWordBoxesWithTesseract(ocrPrep, img, knownBarcodes = []) {
  try {
    const worker = await withPromiseTimeout(getPersistentOcrWorker(), 12000, null);

    const sparseWords = await recognizeCanvasWords(
      worker,
      ocrPrep.canvas,
      ocrPrep.scale,
      "11",
      false,
      0
    );

    const autoWords = await recognizeCanvasWords(
      worker,
      ocrPrep.canvas,
      ocrPrep.scale,
      "3",
      false,
      0
    );

    let combined = mergeOcrWordPasses(sparseWords, autoWords);

    if (combined.length < 4 && img) {
      const invPrep = buildOcrCanvasFromImage(img, true, knownBarcodes);
      const invWords = await recognizeCanvasWords(
        worker,
        invPrep.canvas,
        invPrep.scale,
        "11",
        true,
        0
      );
      combined = mergeOcrWordPasses(combined, invWords);
    }

    // Jika hasil teks horizontal masih sedikit (mis. teks vertikal seperti RH-04-05-C), jalankan pass rotasi 270° & 90°
    if (combined.length < 5) {
      const rot270Canvas = createRotatedCanvasForOcr(ocrPrep.canvas, 270);
      const vert270Words = await recognizeCanvasWords(
        worker,
        rot270Canvas,
        ocrPrep.scale,
        "11",
        false,
        270
      );
      if (vert270Words.length > 0) {
        combined = mergeOcrWordPasses(combined, vert270Words);
      } else {
        const rot90Canvas = createRotatedCanvasForOcr(ocrPrep.canvas, 90);
        const vert90Words = await recognizeCanvasWords(
          worker,
          rot90Canvas,
          ocrPrep.scale,
          "11",
          false,
          90
        );
        combined = mergeOcrWordPasses(combined, vert90Words);
      }
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

function buildSelectionUnitsFromItems(items) {
  const units = [];
  items.forEach((item, itemIdx) => {
    if (!item || !item.bbox) return;

    if (item.type === "barcode") {
      units.push({
        type: "barcode",
        itemIndex: itemIdx,
        text: String(item.text || "").trim(),
        format: item.format || "CODE_128",
        isVertical: false,
        bbox: { ...item.bbox }
      });
      return;
    }

    const chars = Array.isArray(item.chars) && item.chars.length > 0
      ? item.chars
      : extractWordCharBoxes(item, item.text, item.bbox, Boolean(item.isVertical));

    if (chars.length > 1 && item.text.length > 1) {
      chars.forEach((cObj, cIdx) => {
        units.push({
          type: "char",
          itemIndex: itemIdx,
          charIndex: cIdx,
          wordLength: chars.length,
          text: cObj.char,
          isVertical: Boolean(item.isVertical),
          bbox: { ...cObj.bbox }
        });
      });
    } else {
      units.push({
        type: "word",
        itemIndex: itemIdx,
        charIndex: 0,
        wordLength: 1,
        text: item.text,
        isVertical: Boolean(item.isVertical),
        bbox: { ...item.bbox }
      });
    }
  });
  return units;
}

function getTextSelectionUnits() {
  return ocrSelectionUnits.filter((u) => u.type !== "barcode");
}

function syncRangeFromSelectedIndices(indices) {
  if (!Array.isArray(indices) || indices.length === 0) {
    activeSelectionRange = null;
    return;
  }
  const sorted = Array.from(new Set(indices)).sort((a, b) => a - b);
  activeSelectionRange = {
    start: sorted[0],
    end: sorted[sorted.length - 1]
  };
}

function applySelectionRange(startIdx, endIdx) {
  if (ocrSelectionUnits.length === 0) {
    activeSelectionRange = null;
    selectedOcrIndices = [];
    syncOcrSelectionVisuals();
    return;
  }

  const maxIdx = ocrSelectionUnits.length - 1;
  const s = Math.max(0, Math.min(maxIdx, startIdx));
  const e = Math.max(0, Math.min(maxIdx, endIdx));
  const minIdx = Math.min(s, e);
  const maxSelIdx = Math.max(s, e);

  const anchorUnit = ocrSelectionUnits[s] || ocrSelectionUnits[minIdx];
  const anchorIsBarcode = anchorUnit && anchorUnit.type === "barcode";

  const picked = [];
  for (let i = minIdx; i <= maxSelIdx; i += 1) {
    const u = ocrSelectionUnits[i];
    if (!u) continue;
    if (anchorIsBarcode && u.type !== "barcode") continue;
    if (!anchorIsBarcode && u.type === "barcode") continue;
    picked.push(i);
  }

  if (picked.length === 0 && anchorUnit) {
    picked.push(s);
  }

  activeSelectionRange = {
    start: picked[0],
    end: picked[picked.length - 1]
  };
  selectedOcrIndices = picked;
  syncOcrSelectionVisuals();
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

    let barcodeItems = await detectConfirmedBarcodesFromImage(img, false);
    if (token !== ocrRunToken) return;

    const ocrPrep = buildOcrCanvasFromImage(img, false, barcodeItems);
    const tesseractWords = await detectWordBoxesWithTesseract(ocrPrep, img, barcodeItems);
    if (token !== ocrRunToken) return;

    if (barcodeItems.length === 0 && tesseractWords.length <= 3) {
      const fallbackBarcodes = await detectConfirmedBarcodesFromImage(img, true);
      if (token !== ocrRunToken) return;
      if (fallbackBarcodes.length > 0) {
        barcodeItems = fallbackBarcodes;
      }
    }

    const cleanWords = tesseractWords.filter(
      (wordItem) => !isBoxOverlappingBarcode(wordItem.bbox, barcodeItems)
    );

    const combinedItems = sortDetectedItemsReadingOrder([...barcodeItems, ...cleanWords]);
    ocrWordItems = combinedItems;
    ocrSelectionUnits = buildSelectionUnitsFromItems(combinedItems);
    selectedOcrIndices = [];
    activeSelectionRange = null;
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

function updateSelectionHandlesPosition() {
  if (!photoOcrLayer || !activeSelectionRange || selectedOcrIndices.length === 0) {
    removeSelectionHandles();
    return;
  }

  const firstIdx = selectedOcrIndices[0];
  const lastIdx = selectedOcrIndices[selectedOcrIndices.length - 1];
  const firstUnit = ocrSelectionUnits[firstIdx];
  const lastUnit = ocrSelectionUnits[lastIdx];
  if (!firstUnit || !lastUnit) {
    removeSelectionHandles();
    return;
  }

  const firstEl = photoOcrLayer.querySelector(`[data-unit-index="${firstIdx}"]`);
  const lastEl = photoOcrLayer.querySelector(`[data-unit-index="${lastIdx}"]`);
  if (!firstEl || !lastEl) {
    removeSelectionHandles();
    return;
  }

  if (!startHandleEl) {
    startHandleEl = document.createElement("div");
    startHandleEl.className = "lens-selection-handle handle-start";
    startHandleEl.setAttribute("aria-label", "Geser awal blok");
    bindHandleDrag(startHandleEl, "start");
  }
  if (!endHandleEl) {
    endHandleEl = document.createElement("div");
    endHandleEl.className = "lens-selection-handle handle-end";
    endHandleEl.setAttribute("aria-label", "Geser akhir blok");
    bindHandleDrag(endHandleEl, "end");
  }

  if (startHandleEl.parentNode !== photoOcrLayer) {
    photoOcrLayer.appendChild(startHandleEl);
  }
  if (endHandleEl.parentNode !== photoOcrLayer) {
    photoOcrLayer.appendChild(endHandleEl);
  }

  const fLeft = parseFloat(firstEl.style.left) || 0;
  const fTop = parseFloat(firstEl.style.top) || 0;
  const fHeight = parseFloat(firstEl.style.height) || 0;

  const lLeft = parseFloat(lastEl.style.left) || 0;
  const lTop = parseFloat(lastEl.style.top) || 0;
  const lWidth = parseFloat(lastEl.style.width) || 0;
  const lHeight = parseFloat(lastEl.style.height) || 0;

  if (firstUnit.isVertical) {
    startHandleEl.style.left = `${fLeft}px`;
    startHandleEl.style.top = `${fTop}px`;
  } else {
    startHandleEl.style.left = `${fLeft}px`;
    startHandleEl.style.top = `${fTop + fHeight + 6}px`;
  }

  if (lastUnit.isVertical) {
    endHandleEl.style.left = `${lLeft + lWidth}px`;
    endHandleEl.style.top = `${lTop + lHeight + 6}px`;
  } else {
    endHandleEl.style.left = `${lLeft + lWidth}px`;
    endHandleEl.style.top = `${lTop + lHeight + 6}px`;
  }

  startHandleEl.classList.toggle("dragging", draggingHandleSide === "start");
  endHandleEl.classList.toggle("dragging", draggingHandleSide === "end");
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
    const boxEl = photoOcrLayer.querySelector(`[data-unit-index="${idx}"]`);
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
  const gap = 14;

  let targetLeft = (minLeft + maxRight) / 2 - barWidth / 2;
  let targetTop = minTop - gap - barHeight;

  if (targetTop < 58) {
    if (maxBottom + gap + 22 + barHeight <= stageRect.height - 12) {
      targetTop = maxBottom + gap + 22;
    } else if (maxRight + gap + barWidth <= stageRect.width - 8) {
      targetLeft = maxRight + gap;
      targetTop = (minTop + maxBottom) / 2 - barHeight / 2;
    } else if (minLeft - gap - barWidth >= 8) {
      targetLeft = minLeft - gap - barWidth;
      targetTop = (minTop + maxBottom) / 2 - barHeight / 2;
    } else {
      targetTop = Math.max(58, Math.min(stageRect.height - barHeight - 12, minTop - gap - barHeight));
    }
  }

  targetLeft = Math.max(8, Math.min(stageRect.width - barWidth - 8, targetLeft));
  targetTop = Math.max(58, Math.min(stageRect.height - barHeight - 12, targetTop));

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
    const idx = Number(box.getAttribute("data-unit-index"));
    const unit = ocrSelectionUnits[idx];
    const isSelected = sorted.includes(idx);
    const isVert = Boolean(unit && unit.isVertical);

    box.classList.toggle("selected", isSelected);
    box.classList.toggle("is-line-start", isSelected && !isVert && idx === firstIdx);
    box.classList.toggle("is-line-end", isSelected && !isVert && idx === lastIdx);
    box.classList.toggle("is-vert-start", isSelected && isVert && idx === firstIdx);
    box.classList.toggle("is-vert-end", isSelected && isVert && idx === lastIdx);
  });

  updateSelectionHandlesPosition();
  updateFloatingActionBarPosition();
}

function renderLineBackgroundHighlights(metrics) {
  if (!photoOcrLayer || !metrics) return;

  const horizWords = ocrWordItems.filter((it) => it && it.type !== "barcode" && !it.isVertical);
  const vertWords = ocrWordItems.filter((it) => it && it.type !== "barcode" && it.isVertical);

  const lines = [];
  horizWords.forEach((w) => {
    const midY = (w.bbox.y0 + w.bbox.y1) / 2;
    const h = Math.max(6, w.bbox.y1 - w.bbox.y0);
    let targetLine = null;
    for (const ln of lines) {
      const lnMidY = (ln.y0 + ln.y1) / 2;
      const lnH = Math.max(6, ln.y1 - ln.y0);
      if (Math.abs(midY - lnMidY) <= Math.min(h, lnH) * 0.5) {
        targetLine = ln;
        break;
      }
    }
    if (targetLine) {
      targetLine.words.push(w);
      targetLine.y0 = Math.min(targetLine.y0, w.bbox.y0);
      targetLine.y1 = Math.max(targetLine.y1, w.bbox.y1);
    } else {
      lines.push({ y0: w.bbox.y0, y1: w.bbox.y1, words: [w] });
    }
  });

  lines.forEach((ln) => {
    const sorted = [...ln.words].sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const runs = [];
    sorted.forEach((w) => {
      const prevRun = runs.length > 0 ? runs[runs.length - 1] : null;
      const refH = Math.max(8, w.bbox.y1 - w.bbox.y0);
      const gap = prevRun ? w.bbox.x0 - prevRun.x1 : Infinity;
      if (prevRun && gap <= refH * 1.45) {
        prevRun.x1 = Math.max(prevRun.x1, w.bbox.x1);
        prevRun.y0 = Math.min(prevRun.y0, w.bbox.y0);
        prevRun.y1 = Math.max(prevRun.y1, w.bbox.y1);
      } else {
        runs.push({ x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 });
      }
    });

    runs.forEach((r) => {
      const pill = document.createElement("div");
      pill.className = "ocr-line-highlight";
      const left = metrics.offsetX + r.x0 * metrics.scale - 4;
      const top = metrics.offsetY + r.y0 * metrics.scale - 2;
      const width = Math.max(10, (r.x1 - r.x0) * metrics.scale + 8);
      const height = Math.max(12, (r.y1 - r.y0) * metrics.scale + 4);
      pill.style.left = `${left}px`;
      pill.style.top = `${top}px`;
      pill.style.width = `${width}px`;
      pill.style.height = `${height}px`;
      photoOcrLayer.appendChild(pill);
    });
  });

  vertWords.forEach((vw) => {
    const pill = document.createElement("div");
    pill.className = "ocr-line-highlight";
    const left = metrics.offsetX + vw.bbox.x0 * metrics.scale - 3;
    const top = metrics.offsetY + vw.bbox.y0 * metrics.scale - 4;
    const width = Math.max(12, (vw.bbox.x1 - vw.bbox.x0) * metrics.scale + 6);
    const height = Math.max(14, (vw.bbox.y1 - vw.bbox.y0) * metrics.scale + 8);
    pill.style.left = `${left}px`;
    pill.style.top = `${top}px`;
    pill.style.width = `${width}px`;
    pill.style.height = `${height}px`;
    photoOcrLayer.appendChild(pill);
  });
}

function renderOcrWordBoxes() {
  if (!photoOcrLayer) return;
  removeSelectionHandles();
  const metrics = getRenderedImageMetrics();
  photoOcrLayer.innerHTML = "";
  if (!metrics || ocrSelectionUnits.length === 0) return;

  renderLineBackgroundHighlights(metrics);

  ocrSelectionUnits.forEach((unit, index) => {
    const box = document.createElement("div");
    box.className = unit.type === "barcode" ? "ocr-barcode-box" : "ocr-word-box";
    box.setAttribute("data-unit-index", String(index));
    box.setAttribute("role", "button");
    box.setAttribute("aria-label", unit.text || "Barcode");

    const isBarcode = unit.type === "barcode";
    const isChar = unit.type === "char";
    const padX = isBarcode ? 3 : isChar ? 0 : 1.5;
    const padY = isBarcode ? 3 : 1;

    const left = metrics.offsetX + unit.bbox.x0 * metrics.scale - padX;
    const top = metrics.offsetY + unit.bbox.y0 * metrics.scale - padY;
    const width = Math.max(4, (unit.bbox.x1 - unit.bbox.x0) * metrics.scale + padX * 2);
    const height = Math.max(10, (unit.bbox.y1 - unit.bbox.y0) * metrics.scale + padY * 2);

    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;

    photoOcrLayer.appendChild(box);
  });

  syncOcrSelectionVisuals();
}

function findUnitIndexAtPoint(clientX, clientY, preferTextOverBarcode = true) {
  if (!photoOcrLayer) return -1;
  const boxes = photoOcrLayer.querySelectorAll(".ocr-word-box, .ocr-barcode-box");
  let bestTextIdx = -1;
  let bestTextScore = Infinity;
  let bestBarcodeIdx = -1;
  let bestBarcodeScore = Infinity;

  boxes.forEach((box) => {
    const rect = box.getBoundingClientRect();
    const isTextBox = box.classList.contains("ocr-word-box");
    const padX = isTextBox ? 6 : 3;
    const padY = isTextBox ? 8 : 3;

    if (
      clientX >= rect.left - padX &&
      clientX <= rect.right + padX &&
      clientY >= rect.top - padY &&
      clientY <= rect.bottom + padY
    ) {
      const cx = (rect.left + rect.right) / 2;
      const cy = (rect.top + rect.bottom) / 2;
      const dist = Math.hypot(clientX - cx, clientY - cy);
      const area = Math.max(1, rect.width * rect.height);
      const score = dist + Math.sqrt(area) * 0.15;
      const idx = Number(box.getAttribute("data-unit-index"));

      if (isTextBox) {
        if (score < bestTextScore) {
          bestTextScore = score;
          bestTextIdx = idx;
        }
      } else if (score < bestBarcodeScore) {
        bestBarcodeScore = score;
        bestBarcodeIdx = idx;
      }
    }
  });

  if (preferTextOverBarcode && bestTextIdx >= 0) {
    return bestTextIdx;
  }
  return bestBarcodeIdx >= 0 ? bestBarcodeIdx : bestTextIdx;
}

function findNearestSelectionUnitToPoint(clientX, clientY, allowBarcode = false) {
  if (!photoOcrLayer) return -1;
  const selector = allowBarcode ? ".ocr-barcode-box" : ".ocr-word-box";
  const boxes = photoOcrLayer.querySelectorAll(selector);
  let bestIdx = -1;
  let bestDist = Infinity;

  boxes.forEach((box) => {
    const rect = box.getBoundingClientRect();
    const cx = (rect.left + rect.right) / 2;
    const cy = (rect.top + rect.bottom) / 2;
    const clampedX = Math.max(rect.left, Math.min(rect.right, clientX));
    const clampedY = Math.max(rect.top, Math.min(rect.bottom, clientY));
    const dist = Math.hypot(clientX - clampedX, clientY - clampedY) + Math.hypot(clientX - cx, clientY - cy) * 0.08;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = Number(box.getAttribute("data-unit-index"));
    }
  });

  return bestIdx;
}

function selectWordOrGroupAtUnitIndex(unitIdx) {
  const unit = ocrSelectionUnits[unitIdx];
  if (!unit) return;

  if (unit.type === "barcode") {
    applySelectionRange(unitIdx, unitIdx);
    return;
  }

  // Pilih seluruh karakter dalam kata yang sama saat pertama kali diketuk agar langsung siap disalin/dibuat QR
  const sameWordIndices = [];
  for (let i = 0; i < ocrSelectionUnits.length; i += 1) {
    const u = ocrSelectionUnits[i];
    if (u && u.itemIndex === unit.itemIndex && u.type !== "barcode") {
      sameWordIndices.push(i);
    }
  }
  if (sameWordIndices.length > 0) {
    applySelectionRange(sameWordIndices[0], sameWordIndices[sameWordIndices.length - 1]);
  } else {
    applySelectionRange(unitIdx, unitIdx);
  }
}

function selectUnitsInDragRect(startPt, endPt, anchorIdx) {
  if (!photoOcrLayer || !startPt || !endPt) return;
  const minX = Math.min(startPt.x, endPt.x) - 4;
  const maxX = Math.max(startPt.x, endPt.x) + 4;
  const minY = Math.min(startPt.y, endPt.y) - 6;
  const maxY = Math.max(startPt.y, endPt.y) + 6;

  const anchorUnit = anchorIdx >= 0 ? ocrSelectionUnits[anchorIdx] : null;
  const anchorIsBarcode = Boolean(anchorUnit && anchorUnit.type === "barcode");

  const hits = new Set();
  if (anchorIdx >= 0) {
    hits.add(anchorIdx);
  }

  const boxes = photoOcrLayer.querySelectorAll(".ocr-word-box, .ocr-barcode-box");
  boxes.forEach((box) => {
    const idx = Number(box.getAttribute("data-unit-index"));
    const unit = ocrSelectionUnits[idx];
    if (!unit) return;
    if (anchorIsBarcode && unit.type !== "barcode") return;
    if (!anchorIsBarcode && unit.type === "barcode") return;

    const rect = box.getBoundingClientRect();
    const intersects =
      rect.right >= minX &&
      rect.left <= maxX &&
      rect.bottom >= minY &&
      rect.top <= maxY;
    if (intersects) {
      hits.add(idx);
    }
  });

  if (hits.size > 0) {
    const sortedHits = Array.from(hits).sort((a, b) => a - b);
    applySelectionRange(sortedHits[0], sortedHits[sortedHits.length - 1]);
  }
}

function bindHandleDrag(handleEl, side) {
  if (!handleEl) return;

  handleEl.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!activeSelectionRange && selectedOcrIndices.length > 0) {
      syncRangeFromSelectedIndices(selectedOcrIndices);
    }
    if (!activeSelectionRange) return;

    draggingHandleSide = side;
    if (typeof triggerHapticFeedback === "function") {
      triggerHapticFeedback("light");
    }
    syncOcrSelectionVisuals();

    try {
      handleEl.setPointerCapture(e.pointerId);
    } catch (err) {}
  });

  handleEl.addEventListener("pointermove", (e) => {
    if (draggingHandleSide !== side || !activeSelectionRange) return;
    e.stopPropagation();
    e.preventDefault();

    const anchorUnit = ocrSelectionUnits[activeSelectionRange.start];
    const isBarcodeMode = Boolean(anchorUnit && anchorUnit.type === "barcode");
    const targetIdx = findNearestSelectionUnitToPoint(e.clientX, e.clientY, isBarcodeMode);
    if (targetIdx < 0) return;

    const prevEnd = activeSelectionRange.end;
    const prevStart = activeSelectionRange.start;

    if (side === "end") {
      applySelectionRange(prevStart, targetIdx);
      if (activeSelectionRange && activeSelectionRange.end !== prevEnd && typeof triggerHapticFeedback === "function") {
        triggerHapticFeedback("light");
      }
    } else {
      applySelectionRange(targetIdx, prevEnd);
      if (activeSelectionRange && activeSelectionRange.start !== prevStart && typeof triggerHapticFeedback === "function") {
        triggerHapticFeedback("light");
      }
    }
  });

  const releaseHandle = (e) => {
    if (draggingHandleSide !== side) return;
    e.stopPropagation();
    draggingHandleSide = null;
    try {
      if (e && typeof e.pointerId === "number") {
        handleEl.releasePointerCapture(e.pointerId);
      }
    } catch (err) {}
    syncOcrSelectionVisuals();
  };

  handleEl.addEventListener("pointerup", releaseHandle);
  handleEl.addEventListener("pointercancel", releaseHandle);
}

function setupPhotoOcrInteractions() {
  if (!photoOcrLayer) return;

  photoOcrLayer.addEventListener("pointerdown", (e) => {
    if (e.target.closest("#photo-lens-action-bar")) return;
    if (e.target.closest(".lens-selection-handle")) return;
    e.preventDefault();

    const hitIdx = findUnitIndexAtPoint(e.clientX, e.clientY, true);
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
    e.preventDefault();
    const dist = Math.hypot(e.clientX - ocrDragStartPoint.x, e.clientY - ocrDragStartPoint.y);
    if (dist > 7) {
      ocrDragMoved = true;
      selectUnitsInDragRect(ocrDragStartPoint, { x: e.clientX, y: e.clientY }, ocrDragStartIdx);
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
        if (typeof triggerHapticFeedback === "function") {
          triggerHapticFeedback("light");
        }
        selectWordOrGroupAtUnitIndex(startIdx);
      } else if (selectedOcrIndices.length > 0) {
        selectedOcrIndices = [];
        activeSelectionRange = null;
        syncOcrSelectionVisuals();
      }
    }
  };

  photoOcrLayer.addEventListener("pointerup", finishPointerSelection);
  photoOcrLayer.addEventListener("pointercancel", finishPointerSelection);
}

setupPhotoOcrInteractions();

window.addEventListener("resize", () => {
  if (photoLensOverlay && photoLensOverlay.classList.contains("open") && ocrSelectionUnits.length > 0) {
    renderOcrWordBoxes();
  }
});

function assembleTextFromSelectedUnits(selectedUnits) {
  if (!Array.isArray(selectedUnits) || selectedUnits.length === 0) return "";

  const nonBarcodeUnits = selectedUnits.filter((u) => u.type !== "barcode");
  if (nonBarcodeUnits.length === 0) return "";

  let assembled = "";
  let prevUnit = null;

  nonBarcodeUnits.forEach((unit) => {
    if (!prevUnit) {
      assembled += unit.text;
      prevUnit = unit;
      return;
    }

    const sameItem = prevUnit.itemIndex === unit.itemIndex;
    if (sameItem) {
      assembled += unit.text;
    } else if (prevUnit.isVertical && unit.isVertical) {
      const gapY = unit.bbox.y0 - prevUnit.bbox.y1;
      const refH = Math.max(8, prevUnit.bbox.y1 - prevUnit.bbox.y0);
      assembled += gapY > refH * 1.4 ? "\n" : " ";
      assembled += unit.text;
    } else if (!prevUnit.isVertical && !unit.isVertical) {
      const midPrevY = (prevUnit.bbox.y0 + prevUnit.bbox.y1) / 2;
      const midCurrY = (unit.bbox.y0 + unit.bbox.y1) / 2;
      const refH = Math.max(8, Math.min(prevUnit.bbox.y1 - prevUnit.bbox.y0, unit.bbox.y1 - unit.bbox.y0));
      if (Math.abs(midCurrY - midPrevY) > refH * 0.65) {
        assembled += "\n";
      } else {
        assembled += " ";
      }
      assembled += unit.text;
    } else {
      assembled += "\n";
      assembled += unit.text;
    }

    prevUnit = unit;
  });

  return assembled.trim();
}

function getSelectedPhotoSelection() {
  if (selectedOcrIndices.length === 0) {
    return { text: "", format: "", hasSelection: false };
  }

  const selectedUnits = selectedOcrIndices
    .map((idx) => ocrSelectionUnits[idx])
    .filter(Boolean);

  if (selectedUnits.length === 0) {
    return { text: "", format: "", hasSelection: false };
  }

  const selectedBarcodes = selectedUnits.filter((u) => u.type === "barcode");
  const selectedTextUnits = selectedUnits.filter((u) => u.type !== "barcode");

  if (selectedBarcodes.length > 0 && selectedTextUnits.length === 0) {
    const decodedBarcodeTexts = Array.from(
      new Set(selectedBarcodes.map((bc) => String(bc.text || "").trim()).filter(Boolean))
    );
    const primaryFormat = selectedBarcodes[0].format || "CODE_128";
    return {
      text: decodedBarcodeTexts.join(" ").trim(),
      format: primaryFormat,
      hasSelection: true
    };
  }

  const assembledText = assembleTextFromSelectedUnits(selectedTextUnits);
  const cleanedLines = assembledText
    .split(/\r?\n/)
    .map((ln) => cleanSelectedWordTokens(ln.split(/\s+/)).join(" ").trim())
    .filter(Boolean);
  const finalText = cleanedLines.join("\n").trim();

  return {
    text: finalText,
    format: finalText ? detectScanFormatType(finalText, "OCR Text") : "",
    hasSelection: true
  };
}

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
