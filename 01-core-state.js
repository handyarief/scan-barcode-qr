const qrWrapper = document.getElementById("qrcode-wrapper");
const decodedTextEl = document.getElementById("decoded-text");
const formatInfoEl = document.getElementById("format-info");
const statusBadge = document.getElementById("status-badge");
const scannerInput = document.getElementById("scanner-input");
const installBtn = document.getElementById("install-btn");
const flashBtn = document.getElementById("flash-btn");
const flashStatus = document.getElementById("flash-status");
const zoomBox = document.getElementById("zoom-box");
const zoomSlider = document.getElementById("zoom-slider");
const zoomValue = document.getElementById("zoom-value");
const scannerViewport = document.getElementById("scanner-viewport");
const docDetectCanvas = document.getElementById("doc-detect-canvas");
const scanGuide = document.getElementById("scan-guide");
const scanInstruction = document.getElementById("scan-instruction");
const autoZoomBadge = document.getElementById("auto-zoom-badge");
const zoomToggleBtn = document.getElementById("zoom-toggle-btn");
const autoZoomBtn = document.getElementById("auto-zoom-btn");
const keyboardToggleBtn = document.getElementById("keyboard-toggle-btn");
const manualPanel = document.getElementById("manual-panel");
const manualSubmitBtn = document.getElementById("manual-submit-btn");
const photoShutterBtn = document.getElementById("photo-shutter-btn");
const galleryPhotoBtn = document.getElementById("gallery-photo-btn");
const photoCaptureInput = document.getElementById("photo-capture-input");
const photoGalleryInput = document.getElementById("photo-gallery-input");
const photoLensOverlay = document.getElementById("photo-lens-overlay");
const photoLensStage = document.getElementById("photo-lens-stage");
const capturedPhotoPreview = document.getElementById("captured-photo-preview");
const photoOcrLayer = document.getElementById("photo-ocr-layer");
const photoLensActionBar = document.getElementById("photo-lens-action-bar");
const lensCreateQrBtn = document.getElementById("lens-create-qr-btn");
const photoLensStatus = document.getElementById("photo-lens-status");
const sheetBackdrop = document.getElementById("scan-sheet-backdrop");
const scanResultSheet = document.getElementById("scan-result-sheet");
const sheetDragHandle = document.getElementById("sheet-drag-handle");
const sheetScannedCount = document.getElementById("sheet-scanned-count");
const sheetBarcodeValue = document.getElementById("sheet-barcode-value");
const sheetFormatValue = document.getElementById("sheet-format-value");
const sheetExcelColRow = document.getElementById("sheet-excel-col-row");
const sheetExcelColValue = document.getElementById("sheet-excel-col-value");
const sheetCopyBtn = document.getElementById("sheet-copy-btn");
const fullscreenQrModal = document.getElementById("fullscreen-qr-modal");

// Elemen Notes Hasil Scan (Menu 1D to QR)
const qrScanNotesPanel = document.getElementById("qr-scan-notes-panel");
const qrNotesCount = document.getElementById("qr-notes-count");
const qrCopyAllBtn = document.getElementById("qr-copy-all-btn");
const qrCopySelectedBtn = document.getElementById("qr-copy-selected-btn");
const qrClearNotesBtn = document.getElementById("qr-clear-notes-btn");
const qrNotesFeedback = document.getElementById("qr-notes-feedback");
const qrNotesList = document.getElementById("qr-notes-list");

// Elemen Preview Excel Modal
const excelPreviewModal = document.getElementById("excel-preview-modal");
const excelPreviewTitle = document.getElementById("excel-preview-title");
const excelPreviewSubtitle = document.getElementById("excel-preview-subtitle");
const excelPreviewThead = document.getElementById("excel-preview-thead");
const excelPreviewTbody = document.getElementById("excel-preview-tbody");
const excelPreviewDownloadBtn = document.getElementById("excel-preview-download-btn");

// Elemen Header, Menu Utama & Hub Scan to Excel
const appHeaderTitle = document.getElementById("app-header-title");
const appHeaderSubtitle = document.getElementById("app-header-subtitle");
const homeMenuView = document.getElementById("home-menu-view");
const excelTaskHubView = document.getElementById("excel-task-hub-view");
const excelRunningCount = document.getElementById("excel-running-count");
const excelRunningTasksList = document.getElementById("excel-running-tasks-list");
const excelNewTaskView = document.getElementById("excel-new-task-view");
const newExcelTaskNameInput = document.getElementById("new-excel-task-name");
const newExcelColCountInput = document.getElementById("new-excel-col-count");
const newExcelColNamesList = document.getElementById("new-excel-col-names-list");
const newExcelSeqWrapper = document.getElementById("new-excel-seq-wrapper");
const newExcelSeqCheckbox = document.getElementById("new-excel-seq-checkbox");
const newExcelSeqHint = document.getElementById("new-excel-seq-hint");
const scannerCard = document.getElementById("scanner-card");
const scanTopOverlay = document.getElementById("scan-top-overlay");
const excelScanToast = document.getElementById("excel-scan-toast");
const excelSessionPanel = document.getElementById("excel-session-panel");
const excelActiveTaskName = document.getElementById("excel-active-task-name");
const excelRowCount = document.getElementById("excel-row-count");
const excelDownloadBtn = document.getElementById("excel-download-btn");
const excelTargetColBar = document.getElementById("excel-target-col-bar");
const excelRowsThead = document.getElementById("excel-rows-thead");
const excelRowsTbody = document.getElementById("excel-rows-tbody");

const EXCEL_TASKS_STORAGE_KEY = "scan2qr_excel_tasks_v2";

let activeAppFeature = "menu"; // "menu" | "1d-to-qr" | "scan-to-excel" | "text-to-qr"
let currentRoute = "menu";
let isHandlingPopState = false;
let ignoreNextSheetPopState = false;
let ignorePopStateCount = 0;
let isSheetHistoryPushed = false;
let excelTasks = [];
let activeExcelTaskId = null;
let previewingExcelTaskId = null;
let pendingScanData = null; // { text, format }
let excelToastTimer = null;

// Sub-mode Foto Text-to-QR di dalam menu Scan to Excel
let isExcelTextPhotoMode = false;
let excelPhotoHistoryDepth = 0;

// State Auto-Detect, Auto-Scan & Auto-Crop Dokumen Ala CamScanner
let docDetectTimer = null;
let lastDetectedDocQuad = null;
let smoothedDocQuad = null;
let docDetectMissCount = 0;
let docStableHits = 0;
let docLastStableQuad = null;
let docAutoScanTriggered = false;

// State Notes Hasil Scan untuk 1D to QR
let qrScanNotes = []; // [{ id, text, checked }]
let qrNotesFeedbackTimer = null;

let lastScanned = "";
let deferredPrompt = null;
let isFlashOn = false;
let isFlashSupported = false;
let isCameraRunning = false;
let isCameraStarting = false;
let isScanLocked = false;
let audioCtx = null;
let autoFocusTimer = null;
let isFocusSupported = false;
let currentZoom = 1;
let minZoomSupported = 1;
let maxZoomSupported = 5;
let isZoomSupported = false;
let currentScanMode = "full";
let isAutoZoomEnabled = false;
let autoZoomTimer = null;
let autoZoomDirection = 1;
let scannedItemsCount = 0;
let sheetStartY = 0;
let sheetCurrentDeltaY = 0;
let isSheetDragging = false;
let scanCandidateHistory = new Map();
let isZoomSliderBound = false;
let ocrRunToken = 0;
let ocrWordItems = [];
let selectedOcrIndices = [];
let ocrNaturalWidth = 0;
let ocrNaturalHeight = 0;
let isOcrDragging = false;
let ocrDragStartIdx = -1;
let ocrDragStartPoint = null;
let ocrDragMoved = false;
let nativeLiveScanTimer = null;
let isNativeLiveScanBusy = false;
let fileDecodeScanner = null;
let sharedTesseractWorkerPromise = null;
