// Pengaturan Mode Scan (Full, Square, Bar)
function setScanMode(mode) {
  const validModes = ["full", "square", "bar"];
  if (!validModes.includes(mode)) return;
  currentScanMode = mode;
  resetCandidateScan();

  if (typeof triggerHapticFeedback === "function") {
    triggerHapticFeedback("light");
  }

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
  if (typeof triggerHapticFeedback === "function") {
    triggerHapticFeedback("light");
  }
  const isOpen = zoomBox.classList.toggle("open");
  zoomToggleBtn.classList.toggle("active", isOpen);
}

function toggleKeyboardPanel() {
  if (!manualPanel || !keyboardToggleBtn) return;
  if (typeof triggerHapticFeedback === "function") {
    triggerHapticFeedback("light");
  }
  const isOpen = manualPanel.classList.toggle("open");
  keyboardToggleBtn.classList.toggle("active", isOpen);
  if (isOpen && scannerInput) {
    scannerInput.focus();
  }
}

function resetCandidateScan() {
  scanCandidateHistory.clear();
}

function resetFocusLockState() {
  isCameraFocusedReady = false;
  focusStableFramesCount = 0;
  if (cameraFocusRing) {
    cameraFocusRing.classList.remove("active", "locked");
  }
}

function showFocusRingVisual(locked = false, clientX = null, clientY = null) {
  if (!cameraFocusRing || !scannerViewport) return;

  if (typeof clientX === "number" && typeof clientY === "number") {
    const rect = scannerViewport.getBoundingClientRect();
    const x = Math.max(44, Math.min(rect.width - 44, clientX - rect.left));
    const y = Math.max(44, Math.min(rect.height - 44, clientY - rect.top));
    cameraFocusRing.style.left = `${x}px`;
    cameraFocusRing.style.top = `${y}px`;
  } else {
    cameraFocusRing.style.left = "50%";
    cameraFocusRing.style.top = "50%";
  }

  cameraFocusRing.classList.remove("locked");
  cameraFocusRing.classList.add("active");

  if (focusRingTimer) {
    clearTimeout(focusRingTimer);
  }
  focusRingTimer = setTimeout(() => {
    if (!cameraFocusRing) return;
    if (locked) {
      cameraFocusRing.classList.add("locked");
      setTimeout(() => {
        if (cameraFocusRing) {
          cameraFocusRing.classList.remove("active", "locked");
        }
      }, 280);
    } else {
      cameraFocusRing.classList.remove("active", "locked");
    }
  }, 520);
}

// Mengukur ketajaman gambar frame video untuk memastikan auto-fokus tajam sebelum scan
function measureVideoFrameSharpness() {
  const videoEl = document.querySelector("#reader video");
  if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth || !videoEl.videoHeight) {
    return 0;
  }

  try {
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const sw = 200;
    const sh = Math.max(112, Math.round((vh / vw) * sw));
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return 0;

    ctx.drawImage(videoEl, 0, 0, sw, sh);
    const data = ctx.getImageData(0, 0, sw, sh).data;
    const lum = new Uint8Array(sw * sh);
    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      lum[p] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }

    let sum = 0;
    let sqSum = 0;
    let n = 0;
    for (let y = 2; y < sh - 2; y += 2) {
      const row = y * sw;
      for (let x = 2; x < sw - 2; x += 2) {
        const lap =
          lum[row - sw + x] +
          lum[row + sw + x] +
          lum[row + x - 1] +
          lum[row + x + 1] -
          4 * lum[row + x];
        sum += lap;
        sqSum += lap * lap;
        n += 1;
      }
    }
    if (n === 0) return 0;
    const mean = sum / n;
    return Math.max(0, sqSum / n - mean * mean);
  } catch (err) {
    return 0;
  }
}

function evaluateCameraFocusGate() {
  if (!isCameraRunning || isScanLocked || document.visibilityState !== "visible") {
    return false;
  }

  const sharpness = measureVideoFrameSharpness();
  const prevSharp = lastFrameSharpnessScore;
  lastFrameSharpnessScore = sharpness;

  const isSharp = sharpness >= 115;
  const isSteady = prevSharp > 0 ? Math.abs(sharpness - prevSharp) <= Math.max(45, prevSharp * 0.35) : true;

  if (isSharp && isSteady) {
    focusStableFramesCount += 1;
    if (focusStableFramesCount >= 2) {
      if (!isCameraFocusedReady) {
        isCameraFocusedReady = true;
        showFocusRingVisual(true);
      }
      return true;
    }
  } else {
    focusStableFramesCount = 0;
    isCameraFocusedReady = false;
    const now = Date.now();
    if (now - lastRefocusAttemptAt > 900) {
      lastRefocusAttemptAt = now;
      triggerAutoFocus(false);
    }
  }

  return isCameraFocusedReady && isSharp;
}

async function waitForCameraAutoFocusLock(maxWaitMs = 1500) {
  if (!isCameraRunning) return false;
  await triggerAutoFocus(true);

  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    if (evaluateCameraFocusGate() && isCameraFocusedReady) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 90));
  }
  return isCameraFocusedReady || measureVideoFrameSharpness() >= 115;
}

function startFocusMonitorLoop() {
  if (focusMonitorTimer) {
    clearInterval(focusMonitorTimer);
  }
  focusMonitorTimer = setInterval(() => {
    if (
      !isCameraRunning ||
      isScanLocked ||
      activeAppFeature === "menu" ||
      document.visibilityState !== "visible" ||
      (photoLensOverlay && photoLensOverlay.classList.contains("open"))
    ) {
      return;
    }
    evaluateCameraFocusGate();
  }, 150);
}

// Validasi jarak scan wajib ±30 cm (sensor focusDistance bila tersedia + estimasi proporsi optik)
function isScanWithinThirtyCmTarget(detectionMeta = null) {
  let sensorDistMeters = null;
  try {
    const videoEl = document.querySelector("#reader video");
    const stream = videoEl && videoEl.srcObject ? videoEl.srcObject : null;
    const track =
      stream && typeof stream.getVideoTracks === "function" ? stream.getVideoTracks()[0] : null;
    if (track && typeof track.getSettings === "function") {
      const settings = track.getSettings();
      if (typeof settings.focusDistance === "number" && settings.focusDistance > 0) {
        sensorDistMeters = settings.focusDistance;
      }
    }
  } catch (err) {}

  if (sensorDistMeters !== null) {
    // Target jarak ±30 cm (toleransi 0.25m - 0.38m)
    if (sensorDistMeters < 0.25 || sensorDistMeters > 0.38) {
      return false;
    }
  }

  // Estimasi jarak optik berdasarkan rasio ukuran objek/barcode terhadap frame video
  if (detectionMeta && detectionMeta.boxWidth && detectionMeta.boxHeight && detectionMeta.frameWidth && detectionMeta.frameHeight) {
    const areaRatio =
      (detectionMeta.boxWidth * detectionMeta.boxHeight) /
      Math.max(1, detectionMeta.frameWidth * detectionMeta.frameHeight);
    const maxSpanRatio = Math.max(
      detectionMeta.boxWidth / Math.max(1, detectionMeta.frameWidth),
      detectionMeta.boxHeight / Math.max(1, detectionMeta.frameHeight)
    );

    // Terlalu dekat (< 30 cm): objek memenuhi porsi frame terlalu besar
    if (areaRatio > 0.28 || maxSpanRatio > 0.72) {
      return false;
    }
    // Terlalu jauh (> 30 cm): objek terlalu kecil di dalam frame
    if (areaRatio < 0.012 && maxSpanRatio < 0.14) {
      return false;
    }
  }

  return true;
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
  resetFocusLockState();
  try {
    if (typeof html5QrCode.resume === "function") {
      html5QrCode.resume();
    }
    triggerAutoFocus(true);
  } catch (err) {}
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

async function applyFocusConstraint(mode = "continuous", extraConstraint = {}) {
  if (!isCameraRunning) return false;
  try {
    await html5QrCode.applyVideoConstraints({
      advanced: [{ focusMode: mode, ...extraConstraint }]
    });
    return true;
  } catch (err) {
    return false;
  }
}

async function triggerAutoFocus(showIndicator = true, clientX = null, clientY = null) {
  if (!isCameraRunning || isScanLocked) return;

  resetFocusLockState();
  lastRefocusAttemptAt = Date.now();

  if (showIndicator) {
    showFocusRingVisual(false, clientX, clientY);
  }

  try {
    const capabilities = html5QrCode.getRunningTrackCapabilities();
    const supportedModes = Array.isArray(capabilities?.focusMode) ? capabilities.focusMode : [];
    const poiConstraint =
      typeof clientX === "number" && typeof clientY === "number" && scannerViewport
        ? {
            pointsOfInterest: [
              {
                x: Math.max(0, Math.min(1, (clientX - scannerViewport.getBoundingClientRect().left) / Math.max(1, scannerViewport.clientWidth))),
                y: Math.max(0, Math.min(1, (clientY - scannerViewport.getBoundingClientRect().top) / Math.max(1, scannerViewport.clientHeight)))
              }
            ]
          }
        : {};

    if (supportedModes.includes("single-shot")) {
      await applyFocusConstraint("single-shot", poiConstraint);
      if (supportedModes.includes("continuous")) {
        setTimeout(() => {
          applyFocusConstraint("continuous", poiConstraint).catch(() => {});
        }, 240);
      }
      return;
    }

    if (supportedModes.includes("continuous")) {
      await applyFocusConstraint("continuous", poiConstraint);
      return;
    }

    await applyFocusConstraint("continuous", poiConstraint);
  } catch (err) {}
}

function startAutoFocusLoop() {
  if (autoFocusTimer) {
    clearInterval(autoFocusTimer);
  }
  const intervalMs = typeof isTextPhotoCameraActive === "function" && isTextPhotoCameraActive() ? 2200 : 3800;
  autoFocusTimer = setInterval(() => {
    if (isCameraRunning && !isScanLocked && document.visibilityState === "visible") {
      if (!isCameraFocusedReady) {
        triggerAutoFocus(false);
      }
    }
  }, intervalMs);
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
    if (typeof triggerHapticFeedback === "function") {
      triggerHapticFeedback("light");
    }
    triggerAutoFocus(true, e.clientX, e.clientY);
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
  resetFocusLockState();
  startFocusMonitorLoop();

  try {
    const capabilities = html5QrCode.getRunningTrackCapabilities();

    if (capabilities && Array.isArray(capabilities.focusMode) && capabilities.focusMode.length > 0) {
      isFocusSupported = true;
      triggerAutoFocus(true);
      startAutoFocusLoop();
    } else {
      isFocusSupported = false;
      triggerAutoFocus(true);
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
  if (typeof triggerHapticFeedback === "function") {
    triggerHapticFeedback("light");
  }

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

function buildHtml5QrDistanceMeta(decodedResult) {
  const videoEl = document.querySelector("#reader video");
  if (!videoEl || !videoEl.videoWidth || !videoEl.videoHeight) return null;
  const cornerPoints =
    decodedResult && decodedResult.result && Array.isArray(decodedResult.result.cornerPoints)
      ? decodedResult.result.cornerPoints
      : null;
  if (!cornerPoints || cornerPoints.length < 2) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  cornerPoints.forEach((pt) => {
    if (!pt) return;
    const px = Number(pt.x);
    const py = Number(pt.y);
    if (Number.isFinite(px)) {
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
    }
    if (Number.isFinite(py)) {
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
  });

  if (!isFinite(minX) || !isFinite(minY)) return null;
  return {
    boxWidth: Math.max(1, maxX - minX),
    boxHeight: Math.max(1, maxY - minY),
    frameWidth: videoEl.videoWidth,
    frameHeight: videoEl.videoHeight
  };
}

function onScanSuccess(decodedText, decodedResult, distanceMeta = null) {
  if (
    activeAppFeature === "menu" ||
    isTextPhotoCameraActive() ||
    currentRoute === "scan-to-excel-hub" ||
    currentRoute === "scan-to-excel-new"
  ) {
    return;
  }
  if (isScanLocked) return;

  // Wajib auto-fokus tajam dan jarak ±30 cm terpenuhi
  if (!evaluateCameraFocusGate()) {
    return;
  }

  const resolvedDistMeta = distanceMeta || buildHtml5QrDistanceMeta(decodedResult);
  if (!isScanWithinThirtyCmTarget(resolvedDistMeta)) {
    return;
  }

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

  if (!evaluateCameraFocusGate()) {
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
    const distMeta = best && best.bbox
      ? {
          boxWidth: Math.max(1, best.bbox.x1 - best.bbox.x0),
          boxHeight: Math.max(1, best.bbox.y1 - best.bbox.y0),
          frameWidth: cropCanvas.width,
          frameHeight: cropCanvas.height
        }
      : null;

    onScanSuccess(
      best.text,
      {
        result: {
          format: {
            formatName: best.format || detectScanFormatType(best.text, "Terdeteksi")
          }
        }
      },
      distMeta
    );
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
  if (typeof preloadOcrWorker === "function" && typeof isTextPhotoCameraActive === "function" && isTextPhotoCameraActive()) {
    preloadOcrWorker();
  }

  if (isCameraRunning) {
    resumeCameraForNextScan();
    return;
  }
  if (isCameraStarting) return;

  isCameraStarting = true;
  resetFocusLockState();
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
      resetFocusLockState();
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
  resetFocusLockState();
  if (focusMonitorTimer) {
    clearInterval(focusMonitorTimer);
    focusMonitorTimer = null;
  }
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
