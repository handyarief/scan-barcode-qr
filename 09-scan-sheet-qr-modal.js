// 9. Feedback Audio/Getar, Bottom Sheet Hasil Scan & Modal QR Code Full Screen
function playBeep() {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1046.5, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.14, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.11);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch (err) {}
}

function triggerScanFeedback() {
  playBeep();
  try {
    if (navigator.vibrate) {
      navigator.vibrate(65);
    }
  } catch (err) {}
}

function detectScanFormatType(text, fallbackFormat = "") {
  const cleanFallback = String(fallbackFormat || "").trim();
  if (cleanFallback && cleanFallback !== "UNKNOWN") {
    return cleanFallback.replace(/_/g, " ");
  }

  const val = String(text || "").trim();
  if (!val) return "TEXT";
  if (/^https?:\/\//i.test(val)) return "URL / LINK";
  if (/^\d{8}$/.test(val)) return "EAN-8";
  if (/^\d{12}$/.test(val)) return "UPC-A";
  if (/^\d{13}$/.test(val)) return "EAN-13";
  if (/^\d{14}$/.test(val)) return "ITF-14";
  if (/^[0-9A-Z\-\.\ \$\/\+\%]+$/.test(val) && val.length <= 24) return "CODE 39 / 128";
  return "TEXT / CODE 128";
}

function openScanSheet(text, formatLabel) {
  pendingScanData = { text, format: formatLabel };
  scannedItemsCount += 1;

  if (sheetScannedCount) {
    sheetScannedCount.textContent = `Scanned ${scannedItemsCount} items`;
  }
  if (sheetBarcodeValue) {
    sheetBarcodeValue.textContent = text;
  }
  if (sheetFormatValue) {
    sheetFormatValue.textContent = formatLabel;
  }

  if (activeAppFeature === "scan-to-excel") {
    const task = getActiveExcelTask();
    const targetInfo = getExcelNextTargetInfo(task);
    if (sheetExcelColRow) sheetExcelColRow.style.display = "flex";
    if (sheetExcelColValue) {
      sheetExcelColValue.textContent = `${targetInfo.colName} (Baris ${targetInfo.rowNumber})`;
    }
  } else if (sheetExcelColRow) {
    sheetExcelColRow.style.display = "none";
  }

  if (sheetCopyBtn) {
    sheetCopyBtn.textContent = "Copy";
  }

  if (sheetBackdrop) sheetBackdrop.classList.add("open");
  if (scanResultSheet) {
    scanResultSheet.style.transform = "";
    scanResultSheet.classList.remove("dragging");
    scanResultSheet.classList.add("open");
  }

  if (!isSheetHistoryPushed) {
    isSheetHistoryPushed = true;
    pushAppHistoryState(`${currentRoute}:sheet`);
  }
}

function closeScanSheetOnly() {
  if (sheetBackdrop) sheetBackdrop.classList.remove("open");
  if (scanResultSheet) {
    scanResultSheet.classList.remove("open", "dragging");
    scanResultSheet.style.transform = "";
  }
}

function dismissScanSheet(fromBack = false) {
  const wasPushed = isSheetHistoryPushed;
  isSheetHistoryPushed = false;
  closeScanSheetOnly();

  pendingScanData = null;
  isScanLocked = false;
  lastScanned = "";
  resetCandidateScan();

  if (!fromBack && wasPushed && window.history.length > 1) {
    ignoreNextSheetPopState = true;
    try {
      window.history.back();
    } catch (err) {
      ignoreNextSheetPopState = false;
    }
  }

  if (activeAppFeature !== "menu") {
    resumeCameraForNextScan();
  }
}

function copyScanSheetValue() {
  const val =
    (pendingScanData && pendingScanData.text) ||
    (sheetBarcodeValue ? sheetBarcodeValue.textContent.trim() : "");
  if (!val) return;
  writeTextToClipboardSafe(val);
  if (sheetCopyBtn) {
    sheetCopyBtn.textContent = "Copied!";
    setTimeout(() => {
      if (sheetCopyBtn) sheetCopyBtn.textContent = "Copy";
    }, 1400);
  }
}

function setupScanSheetSwipe() {
  if (!scanResultSheet) return;

  scanResultSheet.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    isSheetDragging = true;
    sheetStartY = e.clientY;
    sheetCurrentDeltaY = 0;
    scanResultSheet.classList.add("dragging");
    try {
      scanResultSheet.setPointerCapture(e.pointerId);
    } catch (err) {}
  });

  scanResultSheet.addEventListener("pointermove", (e) => {
    if (!isSheetDragging) return;
    const deltaY = Math.max(0, e.clientY - sheetStartY);
    sheetCurrentDeltaY = deltaY;
    scanResultSheet.style.transform = `translateY(${deltaY}px)`;
  });

  const endSheetDrag = (e) => {
    if (!isSheetDragging) return;
    isSheetDragging = false;
    scanResultSheet.classList.remove("dragging");
    try {
      if (e && typeof e.pointerId === "number") {
        scanResultSheet.releasePointerCapture(e.pointerId);
      }
    } catch (err) {}

    if (sheetCurrentDeltaY > 68) {
      dismissScanSheet(false);
    } else {
      scanResultSheet.style.transform = "";
    }
    sheetCurrentDeltaY = 0;
  };

  scanResultSheet.addEventListener("pointerup", endSheetDrag);
  scanResultSheet.addEventListener("pointercancel", endSheetDrag);
}

setupScanSheetSwipe();

function generateQR(text, formatName = "") {
  const cleanText = String(text || "").trim();
  if (!cleanText) return;

  lastScanned = cleanText;
  if (decodedTextEl) decodedTextEl.textContent = cleanText;
  if (formatInfoEl) {
    const resolvedFormat = detectScanFormatType(cleanText, formatName);
    formatInfoEl.textContent = `Format Asli: ${resolvedFormat} • ${cleanText.length} karakter`;
  }
  if (statusBadge) {
    statusBadge.textContent = "QR Siap";
    statusBadge.className = "badge ready";
  }

  if (qrWrapper) {
    qrWrapper.innerHTML = "";
    if (typeof QRCode !== "undefined") {
      new QRCode(qrWrapper, {
        text: cleanText,
        width: 260,
        height: 260,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }
}

function closeFullscreenQrModal() {
  if (fullscreenQrModal) {
    fullscreenQrModal.classList.remove("open");
    fullscreenQrModal.setAttribute("aria-hidden", "true");
  }
}

function completeScan() {
  const activePayload = pendingScanData
    ? { ...pendingScanData }
    : lastScanned
      ? { text: lastScanned, format: detectScanFormatType(lastScanned, "") }
      : null;

  const wasPushed = isSheetHistoryPushed;
  isSheetHistoryPushed = false;
  closeScanSheetOnly();

  if (activeAppFeature === "scan-to-excel") {
    if (activePayload && activePayload.text) {
      addScannedItemToExcel(activePayload.text);
    }
    pendingScanData = null;
    isScanLocked = false;
    lastScanned = "";
    resetCandidateScan();

    if (wasPushed && window.history.length > 1) {
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

  if (activePayload && activePayload.text) {
    generateQR(activePayload.text, activePayload.format);
    if (activeAppFeature === "1d-to-qr") {
      addQrScanNote(activePayload.text);
    }
  }

  pendingScanData = null;
  pauseCameraForSingleScan();

  if (fullscreenQrModal) {
    const alreadyOpen = fullscreenQrModal.classList.contains("open");
    fullscreenQrModal.classList.add("open");
    fullscreenQrModal.setAttribute("aria-hidden", "false");
    if (!alreadyOpen) {
      if (wasPushed) {
        replaceAppHistoryState(`${activeAppFeature}:qr-modal`);
      } else {
        pushAppHistoryState(`${activeAppFeature}:qr-modal`);
      }
    }
  }
}

function copyText() {
  const val = decodedTextEl ? decodedTextEl.textContent.trim() : "";
  if (!val || val === "-") return;
  writeTextToClipboardSafe(val);
  if (statusBadge) {
    statusBadge.textContent = "Tersalin!";
    setTimeout(() => {
      if (statusBadge) statusBadge.textContent = "QR Siap";
    }, 1500);
  }
}

function downloadQR() {
  if (!qrWrapper) return;
  const img = qrWrapper.querySelector("img");
  const canvas = qrWrapper.querySelector("canvas");
  let dataUrl = "";

  if (img && img.src && img.src.startsWith("data:image")) {
    dataUrl = img.src;
  } else if (canvas) {
    dataUrl = canvas.toDataURL("image/png");
  }

  if (!dataUrl) return;
  const safeName = (lastScanned || "qrcode").replace(/[^A-Za-z0-9_\-]/g, "_").slice(0, 32);
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `QR_${safeName}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function resetScan(fromBack = false) {
  if (!fromBack && fullscreenQrModal && fullscreenQrModal.classList.contains("open")) {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
  }

  closeFullscreenQrModal();
  closeScanSheetOnly();
  isSheetHistoryPushed = false;
  pendingScanData = null;
  isScanLocked = false;
  lastScanned = "";
  resetCandidateScan();

  if (activeAppFeature === "text-to-qr") {
    currentRoute = "text-to-qr";
    startDocumentBoundaryDetector();
  } else if (activeAppFeature === "1d-to-qr") {
    currentRoute = "1d-to-qr";
  } else if (activeAppFeature === "scan-to-excel") {
    currentRoute = "scan-to-excel-scan";
  }

  if (activeAppFeature !== "menu") {
    resumeCameraForNextScan();
  }
}

function handleManualSubmit() {
  if (!scannerInput) return;
  const val = scannerInput.value.trim();
  if (!val) return;
  scannerInput.value = "";

  if (manualPanel) manualPanel.classList.remove("open");
  if (keyboardToggleBtn) keyboardToggleBtn.classList.remove("active");

  if (activeAppFeature === "scan-to-excel") {
    triggerScanFeedback();
    addScannedItemToExcel(val);
    return;
  }

  triggerScanFeedback();
  const formatLabel = detectScanFormatType(val, "Manual Input");
  generateQR(val, formatLabel);
  if (activeAppFeature === "1d-to-qr") {
    addQrScanNote(val);
  }
  completeScan();
}

if (scannerInput) {
  scannerInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleManualSubmit();
    }
  });
}

// Tangkap input dari scanner barcode fisik USB/Bluetooth (Keyboard Wedge)
let hardwareScannerBuffer = "";
let hardwareScannerLastTime = 0;

document.addEventListener("keydown", (e) => {
  if (activeAppFeature === "menu") return;
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) {
    return;
  }
  if (e.ctrlKey || e.altKey || e.metaKey) return;

  const now = Date.now();
  if (now - hardwareScannerLastTime > 120) {
    hardwareScannerBuffer = "";
  }
  hardwareScannerLastTime = now;

  if (e.key === "Enter") {
    const scannedCode = hardwareScannerBuffer.trim();
    hardwareScannerBuffer = "";
    if (scannedCode.length >= 2) {
      e.preventDefault();
      onScanSuccess(scannedCode, {
        result: { format: { formatName: "HW_SCANNER" } }
      });
    }
  } else if (e.key.length === 1) {
    hardwareScannerBuffer += e.key;
  }
});
