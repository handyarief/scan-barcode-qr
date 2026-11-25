// 5. Navigasi Berbasis Tombol Back HP (History API + Popstate) & Native App Bar Sync
function syncHeaderBackButton(routeName) {
  if (!headerBackBtn) return;
  const showBack = routeName !== "menu";
  headerBackBtn.style.display = showBack ? "inline-flex" : "none";
}

function pushAppHistoryState(routeName) {
  currentRoute = routeName;
  syncHeaderBackButton(routeName);
  if (isHandlingPopState) return;
  try {
    window.history.pushState({ appRoute: routeName }, "");
  } catch (err) {}
}

function replaceAppHistoryState(routeName) {
  currentRoute = routeName;
  syncHeaderBackButton(routeName);
  try {
    window.history.replaceState({ appRoute: routeName }, "");
  } catch (err) {}
}

try {
  window.history.replaceState({ appRoute: "menu" }, "");
} catch (err) {}
syncHeaderBackButton("menu");

window.addEventListener("popstate", () => {
  if (ignorePopStateCount > 0) {
    ignorePopStateCount -= 1;
    return;
  }
  if (ignoreNextSheetPopState) {
    ignoreNextSheetPopState = false;
    return;
  }

  isHandlingPopState = true;
  try {
    if (excelPreviewModal && excelPreviewModal.classList.contains("open")) {
      closeExcelTaskPreview(true);
      return;
    }
    if (fullscreenQrModal && fullscreenQrModal.classList.contains("open")) {
      resetScan(true);
      return;
    }
    if (scanResultSheet && scanResultSheet.classList.contains("open")) {
      dismissScanSheet(true);
      return;
    }
    if (photoLensOverlay && photoLensOverlay.classList.contains("open")) {
      closePhotoLensPanel(true);
      return;
    }
    if (activeAppFeature === "scan-to-excel" && isExcelTextPhotoMode) {
      exitExcelTextPhotoMode(true);
      return;
    }

    if (currentRoute === "scan-to-excel-scan" || (activeAppFeature === "scan-to-excel" && activeExcelTaskId)) {
      openExcelTaskHubView(true);
    } else if (currentRoute === "scan-to-excel-new") {
      openExcelTaskHubView(true);
    } else if (
      currentRoute === "scan-to-excel-hub" ||
      currentRoute === "1d-to-qr" ||
      currentRoute === "text-to-qr"
    ) {
      backToMainMenu(true);
    }
  } finally {
    isHandlingPopState = false;
  }
});

function navigateBackOneStep() {
  if (typeof triggerHapticFeedback === "function") {
    triggerHapticFeedback("light");
  }
  if (excelPreviewModal && excelPreviewModal.classList.contains("open")) {
    closeExcelTaskPreview(false);
    return;
  }
  if (fullscreenQrModal && fullscreenQrModal.classList.contains("open")) {
    resetScan(false);
    return;
  }
  if (scanResultSheet && scanResultSheet.classList.contains("open")) {
    dismissScanSheet(false);
    return;
  }
  if (photoLensOverlay && photoLensOverlay.classList.contains("open")) {
    closePhotoLensPanel(false);
    return;
  }
  if (activeAppFeature === "scan-to-excel" && isExcelTextPhotoMode) {
    exitExcelTextPhotoMode(false);
    return;
  }
  if (currentRoute === "scan-to-excel-scan" || currentRoute === "scan-to-excel-new") {
    openExcelTaskHubView(true);
    replaceAppHistoryState("scan-to-excel-hub");
    return;
  }
  if (window.history.length > 1 && currentRoute !== "menu") {
    window.history.back();
  } else {
    backToMainMenu(true);
  }
}

function hideAllMainSections() {
  if (homeMenuView) homeMenuView.style.display = "none";
  if (excelTaskHubView) excelTaskHubView.style.display = "none";
  if (excelNewTaskView) excelNewTaskView.style.display = "none";
  if (scannerCard) {
    scannerCard.style.display = "none";
    scannerCard.classList.remove("excel-mode", "notes-mode");
  }
  if (qrScanNotesPanel) qrScanNotesPanel.style.display = "none";
  if (excelSessionPanel) excelSessionPanel.style.display = "none";
}

function resetTransientScannerUI() {
  isExcelTextPhotoMode = false;
  excelPhotoHistoryDepth = 0;
  closeExcelPreviewModalOnly();
  closeFullscreenQrModal();
  closeScanSheetOnly();
  isSheetHistoryPushed = false;
  ocrRunToken += 1;
  clearPhotoLensState();
  if (photoLensOverlay) photoLensOverlay.classList.remove("open");
  if (photoShutterBtn) photoShutterBtn.classList.remove("active");
  if (zoomBox) zoomBox.classList.remove("open");
  if (zoomToggleBtn) zoomToggleBtn.classList.remove("active");
  if (manualPanel) manualPanel.classList.remove("open");
  if (keyboardToggleBtn) keyboardToggleBtn.classList.remove("active");
  isScanLocked = false;
  lastScanned = "";
  pendingScanData = null;
  isPendingScanDuplicate = false;
  resetCandidateScan();
}

function isTextPhotoCameraActive() {
  return (
    activeAppFeature === "text-to-qr" ||
    (activeAppFeature === "scan-to-excel" && isExcelTextPhotoMode)
  );
}

function openFeatureMenu(feature) {
  const validFeatures = ["1d-to-qr", "scan-to-excel", "text-to-qr"];
  if (!validFeatures.includes(feature)) return;

  if (typeof triggerHapticFeedback === "function") {
    triggerHapticFeedback("light");
  }

  activeAppFeature = feature;
  resetTransientScannerUI();

  if (typeof requestScreenWakeLock === "function") {
    requestScreenWakeLock();
  }

  if (feature === "scan-to-excel") {
    openExcelTaskHubView(false);
    return;
  }

  hideAllMainSections();
  if (scannerCard) {
    scannerCard.style.display = "flex";
  }

  if (feature === "1d-to-qr") {
    if (appHeaderTitle) appHeaderTitle.textContent = "1D to QR";
    if (appHeaderSubtitle) appHeaderSubtitle.textContent = "Semua Barcode 1D/2D atau scanner fisik";
    if (scanTopOverlay) scanTopOverlay.style.display = "";
    if (scanGuide) scanGuide.style.display = "";
    if (zoomToggleBtn) zoomToggleBtn.style.display = "inline-flex";
    if (photoShutterBtn) photoShutterBtn.style.display = "none";
    if (galleryPhotoBtn) galleryPhotoBtn.style.display = "none";
    if (keyboardToggleBtn) keyboardToggleBtn.style.display = "inline-flex";
    if (manualSubmitBtn) manualSubmitBtn.textContent = "Buat QR";
    if (lensCreateQrBtn) lensCreateQrBtn.textContent = "Buat Barkode";
    if (scannerCard) scannerCard.classList.add("notes-mode");
    if (qrScanNotesPanel) qrScanNotesPanel.style.display = "flex";
    renderQrScanNotes();
    setScanMode(currentScanMode || "full");
    pushAppHistoryState("1d-to-qr");
  } else if (feature === "text-to-qr") {
    if (appHeaderTitle) appHeaderTitle.textContent = "Text to QR";
    if (appHeaderSubtitle) appHeaderSubtitle.textContent = "Foto teks/SN lalu pilih blok menjadi QR";
    if (scanTopOverlay) scanTopOverlay.style.display = "none";
    if (scanGuide) scanGuide.style.display = "none";
    if (zoomToggleBtn) zoomToggleBtn.style.display = "none";
    if (zoomBox) zoomBox.classList.remove("open");
    if (photoShutterBtn) photoShutterBtn.style.display = "inline-flex";
    if (galleryPhotoBtn) galleryPhotoBtn.style.display = "inline-flex";
    if (keyboardToggleBtn) keyboardToggleBtn.style.display = "none";
    if (manualPanel) manualPanel.classList.remove("open");
    if (lensCreateQrBtn) lensCreateQrBtn.textContent = "Buat Barkode";
    if (scannerViewport) {
      scannerViewport.classList.remove("mode-square", "mode-bar");
      scannerViewport.classList.add("mode-full");
    }
    pushAppHistoryState("text-to-qr");
  }

  ensureCameraStarted();
}

function enterExcelTextPhotoMode() {
  if (activeAppFeature !== "scan-to-excel" || isExcelTextPhotoMode) return;
  isExcelTextPhotoMode = true;
  resetCandidateScan();

  if (scanTopOverlay) scanTopOverlay.style.display = "none";
  if (scanGuide) scanGuide.style.display = "none";
  if (zoomToggleBtn) zoomToggleBtn.style.display = "none";
  if (zoomBox) zoomBox.classList.remove("open");
  if (zoomToggleBtn) zoomToggleBtn.classList.remove("active");
  if (keyboardToggleBtn) keyboardToggleBtn.style.display = "none";
  if (manualPanel) manualPanel.classList.remove("open");
  if (keyboardToggleBtn) keyboardToggleBtn.classList.remove("active");
  if (galleryPhotoBtn) galleryPhotoBtn.style.display = "inline-flex";
  if (lensCreateQrBtn) lensCreateQrBtn.textContent = "Salin ke Excel";

  if (scannerViewport) {
    scannerViewport.classList.remove("mode-square", "mode-bar");
    scannerViewport.classList.add("mode-full");
  }

  const task = getActiveExcelTask();
  if (appHeaderSubtitle && task) {
    appHeaderSubtitle.textContent = "Arahkan ke teks lalu tekan tombol foto";
  }

  excelPhotoHistoryDepth = 1;
  pushAppHistoryState("scan-to-excel-scan:text-mode");
  if (typeof triggerAutoFocus === "function") {
    triggerAutoFocus(true);
  }
}

function exitExcelTextPhotoMode(fromBack = false) {
  if (!isExcelTextPhotoMode) return;
  if (!fromBack && excelPhotoHistoryDepth > 0 && window.history.length > 1) {
    window.history.back();
    return;
  }

  isExcelTextPhotoMode = false;
  excelPhotoHistoryDepth = 0;

  if (scanTopOverlay) scanTopOverlay.style.display = "";
  if (scanGuide) scanGuide.style.display = "";
  if (zoomToggleBtn) zoomToggleBtn.style.display = "inline-flex";
  if (keyboardToggleBtn) keyboardToggleBtn.style.display = "inline-flex";
  if (galleryPhotoBtn) galleryPhotoBtn.style.display = "none";
  if (lensCreateQrBtn) lensCreateQrBtn.textContent = "Pilih Kode";

  const task = getActiveExcelTask();
  if (appHeaderSubtitle && task) {
    appHeaderSubtitle.textContent = task.sequentialColumns
      ? `Input Kolom berurutan (${task.columns.length} kolom)`
      : `${task.columns.length} kolom Excel`;
  }

  setScanMode(currentScanMode || "full");
  currentRoute = "scan-to-excel-scan";
  syncHeaderBackButton(currentRoute);
  if (!isScanLocked) {
    resumeCameraForNextScan();
  }
}

async function openExcelTaskHubView(fromBack = false) {
  activeAppFeature = "scan-to-excel";
  activeExcelTaskId = null;
  resetTransientScannerUI();
  hideAllMainSections();

  if (typeof releaseScreenWakeLock === "function") {
    releaseScreenWakeLock();
  }

  if (appHeaderTitle) appHeaderTitle.textContent = "Scan to Excel";
  if (appHeaderSubtitle) appHeaderSubtitle.textContent = "Buat task baru atau lanjutkan task berjalan";
  if (excelTaskHubView) excelTaskHubView.style.display = "flex";

  renderExcelRunningTasksList();
  if (!fromBack) {
    pushAppHistoryState("scan-to-excel-hub");
  } else {
    currentRoute = "scan-to-excel-hub";
    syncHeaderBackButton(currentRoute);
  }

  await stopCameraGracefully();
}

function openNewExcelTaskForm() {
  activeAppFeature = "scan-to-excel";
  resetTransientScannerUI();
  hideAllMainSections();

  if (appHeaderTitle) appHeaderTitle.textContent = "New Excel";
  if (appHeaderSubtitle) appHeaderSubtitle.textContent = "Atur jumlah dan nama kolom Excel baru";
  if (excelNewTaskView) excelNewTaskView.style.display = "flex";

  const now = new Date();
  const defaultTitle = `Excel_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

  if (newExcelTaskNameInput) {
    newExcelTaskNameInput.value = defaultTitle;
  }
  if (newExcelColCountInput) {
    newExcelColCountInput.value = "1";
  }
  renderNewExcelColumnInputs(1);
  pushAppHistoryState("scan-to-excel-new");
}

async function backToMainMenu(fromBack = false) {
  activeAppFeature = "menu";
  activeExcelTaskId = null;
  resetTransientScannerUI();
  hideAllMainSections();

  if (typeof releaseScreenWakeLock === "function") {
    releaseScreenWakeLock();
  }

  if (homeMenuView) {
    homeMenuView.style.display = "flex";
  }
  if (appHeaderTitle) {
    appHeaderTitle.textContent = "Scan Barcode → QR Code";
  }
  if (appHeaderSubtitle) {
    appHeaderSubtitle.textContent = "Pilih fitur pemindaian di bawah";
  }

  if (!fromBack) {
    pushAppHistoryState("menu");
  } else {
    currentRoute = "menu";
    syncHeaderBackButton(currentRoute);
  }

  await stopCameraGracefully();
}
