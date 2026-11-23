// 10. Kontrol Kamera, Mode Scan (Full/Square/Bar), Zoom, Focus, Flash & Dual-Engine Scanner
let html5QrCode = null;
let nativeBarcodeDetectorInstance = null;

function getSupportedFormats() {
  if (typeof Html5QrcodeSupportedFormats === "undefined") return undefined;
  return [
    Html5QrcodeSupportedFormats.QR_CODE,
    Html5QrcodeSupportedFormats.AZTEC,
    Html5QrcodeSupportedFormats.CODABAR,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.CODE_93,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.DATA_MATRIX,
    Html5QrcodeSupportedFormats.MAXICODE,
    Html5QrcodeSupportedFormats.ITF,
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.PDF_417,
    Html5QrcodeSupportedFormats.RSS_14,
    Html5QrcodeSupportedFormats.RSS_EXPANDED,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION
  ].filter((f) => f !== undefined);
}

function getScanQrboxConfig(viewfinderWidth, viewfinderHeight) {
  const w = Math.max(120, viewfinderWidth || 300);
  const h = Math.max(120, viewfinderHeight || 300);

  if (currentScanMode === "square") {
    const size = Math.min(248, Math.floor(Math.min(w, h) * 0.78));
    return { width: size, height: size };
  }
  if (currentScanMode === "bar") {
    const boxW = Math.max(180, Math.floor(w - 36));
    const boxH = Math.min(116, Math.max(84, Math.floor(h * 0.28)));
    return { width: boxW, height: boxH };
  }
  return {
    width: Math.max(160, Math.floor(w * 0.94)),
    height: Math.max(160, Math.floor(h * 0.94))
  };
}

function setScanMode(mode) {
  if (!["full", "square", "bar"].includes(mode)) return;
  currentScanMode = mode;

  if (scannerViewport) {
    scannerViewport.classList.remove("mode-full", "mode-square", "mode-bar");
    scannerViewport.classList.add(`mode-${mode}`);
  }

  ["full", "square", "bar"].forEach((m) => {
    const tab = document.getElementById(`mode-${m}`);
    if (tab) {
      tab.classList.toggle("active", m === mode);
    }
  });

  resetCandidateScan();
}

function getActiveVideoTrack() {
  const videoEl = document.querySelector("#reader video");
  if (!videoEl || !videoEl.srcObject) return null;
  const tracks = videoEl.srcObject.getVideoTracks();
  return tracks && tracks.length > 0 ? tracks[0] : null;
}

async function applyCameraZoomValue(val) {
  const track = getActiveVideoTrack();
  if (!track || !isZoomSupported) return;
  const clamped = Math.max(minZoomSupported, Math.min(maxZoomSupported, Number(val) || 1));
  currentZoom = clamped;

  if (zoomSlider) zoomSlider.value = String(clamped);
  if (zoomValue) zoomValue.textContent = `${clamped.toFixed(1)}x`;

  try {
    await track.applyConstraints({ advanced: [{ zoom: clamped }] });
  } catch (err) {}
}

function startAutoZoomCycle() {
  stopAutoZoomCycle();
  if (!isAutoZoomEnabled || !isZoomSupported) return;
  autoZoomDirection = 1;
  autoZoomTimer = setInterval(() => {
    if (!isCameraRunning || isScanLocked || !isAutoZoomEnabled) return;
    const upperCap = Math.min(maxZoomSupported, 3.0);
    const step = 0.2;
    let nextZoom = currentZoom + step * autoZoomDirection;
    if (nextZoom >= upperCap) {
      nextZoom = upperCap;
      autoZoomDirection = -1;
    } else if (nextZoom <= minZoomSupported) {
      nextZoom = minZoomSupported;
      autoZoomDirection = 1;
    }
    applyCameraZoomValue(nextZoom);
  }, 650);
}

function stopAutoZoomCycle() {
  if (autoZoomTimer) {
    clearInterval(autoZoomTimer);
    autoZoomTimer = null;
  }
}

function toggleAutoZoom() {
  isAutoZoomEnabled = !isAutoZoomEnabled;
  if (autoZoomBtn) {
    autoZoomBtn.classList.toggle("active", isAutoZoomEnabled);
  }
  if (isAutoZoomEnabled) {
    startAutoZoomCycle();
  } else {
    stopAutoZoomCycle();
  }
}

function toggleZoomPanel() {
  if (!zoomBox || !zoomToggleBtn) return;
  const willOpen = !zoomBox.classList.contains("open");
  zoomBox.classList.toggle("open", willOpen);
  zoomToggleBtn.classList.toggle("active", willOpen);

  if (willOpen && manualPanel && manualPanel.classList.contains("open")) {
    manualPanel.classList.remove("open");
    if (keyboardToggleBtn) keyboardToggleBtn.classList.remove("active");
  }
}

function toggleKeyboardPanel() {
  if (!manualPanel || !keyboardToggleBtn) return;
  const willOpen = !manualPanel.classList.contains("open");
  manualPanel.classList.toggle("open", willOpen);
  keyboardToggleBtn.classList.toggle("active", willOpen);

  if (willOpen) {
    if (zoomBox && zoomBox.classList.contains("open")) {
      zoomBox.classList.remove("open");
      if (zoomToggleBtn) zoomToggleBtn.classList.remove("active");
    }
    if (scannerInput) {
      setTimeout(() => scannerInput.focus(), 60);
    }
  }
}

async function triggerAutoFocus(manualTap = false) {
  const track = getActiveVideoTrack();
  if (!track || !isFocusSupported) return;
  try {
    if (manualTap) {
      await track.applyConstraints({ advanced: [{ focusMode: "single-shot" }] });
      setTimeout(() => {
        track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(() => {});
      }, 450);
    } else {
      await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
    }
  } catch (err) {}
}

function startContinuousAutoFocus() {
  stopContinuousAutoFocus();
  autoFocusTimer = setInterval(() => {
    if (isCameraRunning && !isScanLocked && document.visibilityState === "visible") {
      triggerAutoFocus(false);
    }
  }, 2400);
}

function stopContinuousAutoFocus() {
  if (autoFocusTimer) {
    clearInterval(autoFocusTimer);
    autoFocusTimer = null;
  }
}

async function toggleFlash() {
  const track = getActiveVideoTrack();
  if (!track || !isFlashSupported) return;
  const nextState = !isFlashOn;
  try {
    await track.applyConstraints({ advanced: [{ torch: nextState }] });
    isFlashOn = nextState;
    if (flashBtn) flashBtn.classList.toggle("active", isFlashOn);
    if (flashStatus) flashStatus.textContent = isFlashOn ? "Flash ON" : "Flash OFF";
  } catch (err) {}
}

function inspectCameraCapabilities() {
  const track = getActiveVideoTrack();
  isFlashSupported = false;
  isZoomSupported = false;
  isFocusSupported = false;

  if (!track || typeof track.getCapabilities !== "function") {
    if (flashBtn) flashBtn.disabled = true;
    return;
  }

  try {
    const caps = track.getCapabilities();
    if (caps.torch) {
      isFlashSupported = true;
      if (flashBtn) flashBtn.disabled = false;
    } else if (flashBtn) {
      flashBtn.disabled = true;
    }

    if (caps.zoom && typeof caps.zoom.min === "number" && typeof caps.zoom.max === "number") {
      isZoomSupported = true;
      minZoomSupported = caps.zoom.min;
      maxZoomSupported = Math.min(8, caps.zoom.max);
      currentZoom = Math.max(minZoomSupported, Math.min(maxZoomSupported, 1));

      if (zoomSlider) {
        zoomSlider.min = String(minZoomSupported);
        zoomSlider.max = String(maxZoomSupported);
        zoomSlider.step = String(caps.zoom.step || 0.1);
        zoomSlider.value = String(currentZoom);
        if (!isZoomSliderBound) {
          isZoomSliderBound = true;
          zoomSlider.addEventListener("input", (e) => {
            if (isAutoZoomEnabled) {
              isAutoZoomEnabled = false;
              if (autoZoomBtn) autoZoomBtn.classList.remove("active");
              stopAutoZoomCycle();
            }
            applyCameraZoomValue(e.target.value);
          });
        }
      }
      if (zoomValue) zoomValue.textContent = `${currentZoom.toFixed(1)}x`;
    }

    if (Array.isArray(caps.focusMode) && caps.focusMode.length > 0) {
      isFocusSupported = true;
      triggerAutoFocus(false);
    }
  } catch (err) {}
}

function resetCandidateScan() {
  scanCandidateHistory.clear();
}

function confirmConsistentScanCandidate(text) {
  const now = Date.now();
  for (const [key, entry] of scanCandidateHistory.entries()) {
    if (now - entry.lastTime > 900) {
      scanCandidateHistory.delete(key);
    }
  }

  const existing = scanCandidateHistory.get(text);
  if (!existing) {
    scanCandidateHistory.set(text, { count: 1, lastTime: now });
    return false;
  }

  existing.count += 1;
  existing.lastTime = now;
  return existing.count >= 2;
}

function onScanSuccess(decodedText, decodedResult) {
  if (activeAppFeature === "menu") return;
  if (isTextPhotoCameraActive()) return;
  if (isScanLocked) return;

  const cleanText = String(decodedText || "").trim();
  if (!cleanText) return;

  const rawFormat =
    decodedResult &&
    decodedResult.result &&
    decodedResult.result.format &&
    decodedResult.result.format.formatName
      ? decodedResult.result.format.formatName
      : "";

  const isHardwareScan = rawFormat === "HW_SCANNER";
  if (!isHardwareScan && !confirmConsistentScanCandidate(cleanText)) {
    return;
  }

  resetCandidateScan();
  isScanLocked = true;
  lastScanned = cleanText;

  const formattedType = detectScanFormatType(cleanText, rawFormat);
  triggerScanFeedback();
  pauseCameraForSingleScan();
  openScanSheet(cleanText, formattedType);
}

function isBoundingBoxInsideActiveScanMode(bbox, frameW, frameH) {
  if (!bbox || !frameW || !frameH || currentScanMode === "full") return true;

  const cx = (bbox.x + bbox.width / 2) / frameW;
  const cy = (bbox.y + bbox.height / 2) / frameH;

  if (currentScanMode === "square") {
    return cx >= 0.14 && cx <= 0.86 && cy >= 0.22 && cy <= 0.78;
  }
  if (currentScanMode === "bar") {
    return cx >= 0.06 && cx <= 0.94 && cy >= 0.34 && cy <= 0.66;
  }
  return true;
}

function startNativeLiveFrameScanner() {
  stopNativeLiveFrameScanner();
  if (typeof window.BarcodeDetector === "undefined") return;

  if (!nativeBarcodeDetectorInstance) {
    try {
      nativeBarcodeDetectorInstance = new window.BarcodeDetector({
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
    } catch (err) {
      try {
        nativeBarcodeDetectorInstance = new window.BarcodeDetector();
      } catch (e) {
        return;
      }
    }
  }

  nativeLiveScanTimer = setInterval(async () => {
    if (
      isNativeLiveScanBusy ||
      !isCameraRunning ||
      isScanLocked ||
      activeAppFeature === "menu" ||
      isTextPhotoCameraActive() ||
      document.visibilityState !== "visible"
    ) {
      return;
    }

    const videoEl = document.querySelector("#reader video");
    if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth || !videoEl.videoHeight) {
      return;
    }

    isNativeLiveScanBusy = true;
    try {
      const results = await nativeBarcodeDetectorInstance.detect(videoEl);
      if (Array.isArray(results) && results.length > 0 && !isScanLocked) {
        const match = results.find(
          (item) =>
            item &&
            item.rawValue &&
            isBoundingBoxInsideActiveScanMode(item.boundingBox, videoEl.videoWidth, videoEl.videoHeight)
        );
        if (match && match.rawValue) {
          onScanSuccess(String(match.rawValue).trim(), {
            result: {
              format: {
                formatName: String(match.format || "").toUpperCase()
              }
            }
          });
        }
      }
    } catch (err) {
    } finally {
      isNativeLiveScanBusy = false;
    }
  }, 160);
}

function stopNativeLiveFrameScanner() {
  if (nativeLiveScanTimer) {
    clearInterval(nativeLiveScanTimer);
    nativeLiveScanTimer = null;
  }
  isNativeLiveScanBusy = false;
}

function pauseCameraForSingleScan() {
  stopNativeLiveFrameScanner();
  stopAutoZoomCycle();
  try {
    if (html5QrCode && isCameraRunning && typeof html5QrCode.pause === "function") {
      html5QrCode.pause(true);
    }
  } catch (err) {}
}

function resumeCameraForNextScan() {
  if (activeAppFeature === "menu") return;
  if (!isCameraRunning) {
    ensureCameraStarted();
    return;
  }
  try {
    if (html5QrCode && typeof html5QrCode.resume === "function") {
      html5QrCode.resume();
    }
  } catch (err) {}

  if (isTextPhotoCameraActive()) {
    startDocumentBoundaryDetector();
  } else {
    startNativeLiveFrameScanner();
    if (isAutoZoomEnabled) startAutoZoomCycle();
  }
}

async function ensureCameraStarted() {
  if (isCameraRunning || isCameraStarting || activeAppFeature === "menu") return;
  if (typeof Html5Qrcode === "undefined") return;

  isCameraStarting = true;
  try {
    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode("reader", {
        formatsToSupport: getSupportedFormats(),
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        },
        verbose: false
      });
    }

    const config = {
      fps: 15,
      qrbox: getScanQrboxConfig,
      aspectRatio: 1.0,
      disableFlip: false
    };

    await html5QrCode.start(
      { facingMode: "environment" },
      config,
      onScanSuccess,
      () => {}
    );

    isCameraRunning = true;
    inspectCameraCapabilities();
    startContinuousAutoFocus();

    if (isTextPhotoCameraActive()) {
      startDocumentBoundaryDetector();
    } else {
      startNativeLiveFrameScanner();
      if (isAutoZoomEnabled) startAutoZoomCycle();
    }
  } catch (err) {
    isCameraRunning = false;
  } finally {
    isCameraStarting = false;
  }
}

async function stopCameraGracefully() {
  stopDocumentBoundaryDetector();
  stopNativeLiveFrameScanner();
  stopContinuousAutoFocus();
  stopAutoZoomCycle();

  if (isFlashOn) {
    isFlashOn = false;
    if (flashBtn) flashBtn.classList.remove("active");
  }

  if (html5QrCode && isCameraRunning) {
    try {
      await html5QrCode.stop();
    } catch (err) {}
  }
  isCameraRunning = false;
  isCameraStarting = false;
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    stopDocumentBoundaryDetector();
    stopNativeLiveFrameScanner();
    stopAutoZoomCycle();
  } else if (document.visibilityState === "visible" && activeAppFeature !== "menu" && !isScanLocked) {
    if (photoLensOverlay && photoLensOverlay.classList.contains("open")) return;
    if (isTextPhotoCameraActive()) {
      startDocumentBoundaryDetector();
    } else {
      startNativeLiveFrameScanner();
      if (isAutoZoomEnabled) startAutoZoomCycle();
    }
  }
});
