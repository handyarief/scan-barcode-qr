// 6. Getar haptic native, bunyi beep singkat & notifikasi duplikat saat scan berhasil
function triggerHapticFeedback(style = "success") {
  try {
    if (!navigator.vibrate) return;
    if (style === "light") {
      navigator.vibrate(12);
    } else if (style === "medium") {
      navigator.vibrate(25);
    } else if (style === "warning") {
      navigator.vibrate([45, 45, 45]);
    } else {
      navigator.vibrate(140);
    }
  } catch (e) {}
}

function triggerScanFeedback(isDuplicate = false) {
  if (isDuplicate) {
    triggerHapticFeedback("warning");
    playDuplicateBeep();
    return;
  }
  triggerHapticFeedback("success");
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

function playDuplicateBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioCtx) {
      audioCtx = new AudioCtx();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.setValueAtTime(260, now + 0.11);
    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  } catch (e) {}
}

// 9. Kontrol Bottom Sheet Hasil Scan & Full Screen QR
function openScanSheet(cleanText, formatName, duplicateInfo = null) {
  const isDup = Boolean(duplicateInfo);
  if (!isDup) {
    scannedItemsCount += 1;
  }

  if (sheetScannedCount) {
    sheetScannedCount.textContent = isDup ? "Double Scan (Auto Cancel)" : "Scanned";
    sheetScannedCount.classList.toggle("duplicate", isDup);
  }
  if (sheetCompletedBtn) {
    sheetCompletedBtn.disabled = isDup;
    sheetCompletedBtn.style.display = isDup ? "none" : "";
  }
  if (sheetDuplicateAlert) {
    if (isDup) {
      sheetDuplicateAlert.textContent = `Nomor "${cleanText}" sudah pernah di-scan (Baris #${duplicateInfo.rowNumber}, Kolom "${duplicateInfo.colName}"). Input otomatis dibatalkan. Tekan panah bawah atau swipe ke bawah untuk scan lagi.`;
      sheetDuplicateAlert.style.display = "block";
    } else {
      sheetDuplicateAlert.textContent = "";
      sheetDuplicateAlert.style.display = "none";
    }
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
      sheetExcelColValue.textContent = isDup
        ? `Dibatalkan (Sudah ada di Baris #${duplicateInfo.rowNumber})`
        : `${targetInfo.colName} (Baris #${targetInfo.rowNumber})`;
    }
    if (statusBadge) {
      statusBadge.style.display = "inline-block";
      statusBadge.textContent = isDup ? "Double Scan Dibatalkan" : "Siap Masuk Excel";
      statusBadge.classList.toggle("duplicate", isDup);
      statusBadge.classList.toggle("ready", !isDup);
    }
  } else {
    if (sheetExcelColRow) {
      sheetExcelColRow.style.display = "none";
    }
    if (statusBadge) {
      statusBadge.style.display = "none";
      statusBadge.textContent = "";
      statusBadge.classList.remove("duplicate");
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
  if (sheetDuplicateAlert) {
    sheetDuplicateAlert.style.display = "none";
    sheetDuplicateAlert.textContent = "";
  }
  if (sheetScannedCount) {
    sheetScannedCount.classList.remove("duplicate");
  }
  if (sheetCompletedBtn) {
    sheetCompletedBtn.disabled = false;
    sheetCompletedBtn.style.display = "";
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
  isPendingScanDuplicate = false;
  resetCandidateScan();
  if (statusBadge) {
    statusBadge.textContent = activeAppFeature === "scan-to-excel" ? "Scan Dibatalkan" : "";
    statusBadge.classList.remove("ready", "duplicate");
  }
  if (activeAppFeature === "scan-to-excel") {
    currentRoute = "scan-to-excel-scan";
  } else if (activeAppFeature === "1d-to-qr" || activeAppFeature === "text-to-qr") {
    currentRoute = activeAppFeature;
  }
  if (typeof syncHeaderBackButton === "function") {
    syncHeaderBackButton(currentRoute);
  }
  resumeCameraForNextScan();
}

function copyScanSheetValue() {
  const activeCode = (pendingScanData && pendingScanData.text) || lastScanned;
  if (!activeCode) return;

  triggerHapticFeedback("light");
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
  isPendingScanDuplicate = false;
  resetCandidateScan();
  if (activeAppFeature === "scan-to-excel") {
    currentRoute = "scan-to-excel-scan";
  } else if (activeAppFeature === "1d-to-qr" || activeAppFeature === "text-to-qr") {
    currentRoute = activeAppFeature;
  }
  if (typeof syncHeaderBackButton === "function") {
    syncHeaderBackButton(currentRoute);
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
  if (isPendingScanDuplicate) {
    dismissScanSheet(false);
    return;
  }

  const activeCode = (pendingScanData && pendingScanData.text) || lastScanned;
  if (!activeCode) return;

  triggerHapticFeedback("medium");

  if (activeAppFeature === "scan-to-excel") {
    addScannedItemToExcel(activeCode);
    closeScanSheetOnly();
    isScanLocked = false;
    lastScanned = "";
    pendingScanData = null;
    isPendingScanDuplicate = false;
    resetCandidateScan();
    currentRoute = "scan-to-excel-scan";
    if (typeof syncHeaderBackButton === "function") {
      syncHeaderBackButton(currentRoute);
    }
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

  scanResultSheet.addEventListener(
    "touchstart",
    (e) => {
      if (!scanResultSheet.classList.contains("open") || !e.touches || e.touches.length === 0) return;
      if (e.target && e.target.closest("button")) return;
      isSheetDragging = true;
      sheetStartY = e.touches[0].clientY;
      sheetCurrentDeltaY = 0;
      scanResultSheet.classList.add("dragging");
    },
    { passive: true }
  );

  scanResultSheet.addEventListener(
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
    if (sheetCurrentDeltaY > 65) {
      dismissScanSheet();
    } else {
      scanResultSheet.style.transform = "";
    }
    sheetCurrentDeltaY = 0;
  };

  scanResultSheet.addEventListener("touchend", finishSwipe);
  scanResultSheet.addEventListener("touchcancel", finishSwipe);
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

  const duplicateInfo =
    activeAppFeature === "scan-to-excel" && typeof findDuplicateInActiveExcelTask === "function"
      ? findDuplicateInActiveExcelTask(cleanText)
      : null;
  const isDup = Boolean(duplicateInfo);

  isScanLocked = true;
  lastScanned = cleanText;
  isPendingScanDuplicate = isDup;
  pendingScanData = { text: cleanText, format: formatName, duplicateInfo };
  resetCandidateScan();
  pauseCameraForSingleScan();
  triggerScanFeedback(isDup);

  decodedTextEl.textContent = cleanText;
  formatInfoEl.textContent = `Format terbaca: ${formatName}`;

  if (activeAppFeature === "scan-to-excel") {
    if (statusBadge) {
      statusBadge.style.display = "inline-block";
      statusBadge.textContent = isDup ? "Double Scan Dibatalkan" : "Siap Masuk Excel";
      statusBadge.classList.toggle("duplicate", isDup);
      statusBadge.classList.toggle("ready", !isDup);
    }
  } else {
    if (statusBadge) {
      statusBadge.style.display = "inline-block";
      statusBadge.textContent = "QR Siap";
      statusBadge.classList.add("ready");
      statusBadge.classList.remove("duplicate");
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

  openScanSheet(cleanText, formatName, duplicateInfo);
}

function handleManualSubmit() {
  if (isTextPhotoCameraActive()) return;
  if (scannerInput.value.trim() !== "") {
    const rawVal = scannerInput.value.trim();
    const detectedFmt = detectScanFormatType(rawVal);

    isScanLocked = false;
    lastScanned = "";
    pendingScanData = null;
    isPendingScanDuplicate = false;
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
      isPendingScanDuplicate = false;
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
  triggerHapticFeedback("light");
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

  triggerHapticFeedback("light");
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
  isPendingScanDuplicate = false;
  resetCandidateScan();
  decodedTextEl.textContent = "-";
  formatInfoEl.textContent = "Format: -";
  if (statusBadge) {
    statusBadge.textContent = activeAppFeature === "scan-to-excel" ? "Menunggu Scan..." : "";
    statusBadge.classList.remove("ready", "duplicate");
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
    if (typeof syncHeaderBackButton === "function") {
      syncHeaderBackButton(currentRoute);
    }
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
    if (typeof syncHeaderBackButton === "function") {
      syncHeaderBackButton(currentRoute);
    }
  }
  if (activeAppFeature !== "menu") {
    resumeCameraForNextScan();
  }
}
