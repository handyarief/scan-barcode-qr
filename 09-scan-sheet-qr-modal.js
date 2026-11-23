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
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.14);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.14);
  } catch (e) {}
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

function copyScanSheetValue() {
  const activeCode = (pendingScanData && pendingScanData.text) || lastScanned;
  if (!activeCode) return;

  writeTextToClipboardSafe(activeCode);

  if (activeAppFeature === "1d-to-qr") {
    addQrScanNote(activeCode);
    showQrNotesFeedback("Hasil scan disalin & masuk ke Notes!", false);
  }

  if (sheetCopyBtn) {
    sheetCopyBtn.textContent = "Copied";
    setTimeout(() => {
      if (sheetCopyBtn) {
        sheetCopyBtn.textContent = "Copy";
      }
    }, 1400);
  }

  const shouldPopSheetHistory = Boolean(isSheetHistoryPushed && window.history.length > 1);
  isSheetHistoryPushed = false;
  closeScanSheetOnly();
  isScanLocked = false;
  lastScanned = "";
  pendingScanData = null;
  resetCandidateScan();
  if (activeAppFeature === "scan-to-excel") {
    currentRoute = "scan-to-excel-scan";
  } else if (activeAppFeature === "1d-to-qr" || activeAppFeature === "text-to-qr") {
    currentRoute = activeAppFeature;
  }
  if (shouldPopSheetHistory) {
    ignoreNextSheetPopState = true;
    try {
      window.history.back();
    } catch (err) {
      ignoreNextSheetPopState = false;
    }
  }
  resumeCameraForNextScan();
}

function openFullscreenQrModalDirect() {
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

  openFullscreenQrModalDirect();
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

function generateQR(text, formatName = "Scan", directFullscreen = false) {
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

  if (activeAppFeature === "scan-to-excel") {
    if (statusBadge) {
      statusBadge.style.display = "inline-block";
      statusBadge.textContent = "Siap Masuk Excel";
      statusBadge.classList.add("ready");
    }
  } else {
    if (statusBadge) {
      statusBadge.style.display = "inline-block";
      statusBadge.textContent = "QR Siap";
      statusBadge.classList.add("ready");
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

  if (directFullscreen && activeAppFeature === "text-to-qr") {
    openFullscreenQrModalDirect();
    return;
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
    sheetCopyBtn.textContent = "Copied";
    setTimeout(() => {
      if (sheetCopyBtn) {
        sheetCopyBtn.textContent = "Copy";
      }
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
