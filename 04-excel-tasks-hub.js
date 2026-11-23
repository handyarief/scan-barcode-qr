function adjustNewExcelColumnCount(delta) {
  if (!newExcelColCountInput) return;
  const current = parseInt(newExcelColCountInput.value, 10) || 1;
  const next = Math.max(1, Math.min(20, current + delta));
  newExcelColCountInput.value = String(next);
  renderNewExcelColumnInputs(next);
}

function handleNewExcelColumnCountInput() {
  if (!newExcelColCountInput) return;
  let val = parseInt(newExcelColCountInput.value, 10);
  if (isNaN(val) || val < 1) val = 1;
  if (val > 20) val = 20;
  renderNewExcelColumnInputs(val);
}

function renderNewExcelColumnInputs(count) {
  if (!newExcelColNamesList) return;
  const existingInputs = newExcelColNamesList.querySelectorAll("input[data-col-idx]");
  const savedNames = {};
  existingInputs.forEach((inp) => {
    savedNames[Number(inp.getAttribute("data-col-idx"))] = inp.value;
  });

  let html = "";
  for (let i = 0; i < count; i += 1) {
    const val = savedNames[i] !== undefined ? savedNames[i] : `Kolom ${i + 1}`;
    html += `<div class="col-name-item">
      <span class="col-name-badge">Kolom ${i + 1}</span>
      <input type="text" data-col-idx="${i}" value="${escapeHtmlSafe(val)}" placeholder="Nama Kolom ${i + 1}" autocomplete="off" />
    </div>`;
  }
  newExcelColNamesList.innerHTML = html;

  const isMultiColumn = count > 1;
  if (newExcelSeqWrapper && newExcelSeqCheckbox) {
    newExcelSeqWrapper.classList.toggle("disabled", !isMultiColumn);
    newExcelSeqCheckbox.disabled = !isMultiColumn;
    if (!isMultiColumn) {
      newExcelSeqCheckbox.checked = false;
    } else if (!newExcelSeqCheckbox.dataset.userToggled) {
      newExcelSeqCheckbox.checked = true;
    }
  }
}

if (newExcelSeqCheckbox) {
  newExcelSeqCheckbox.addEventListener("change", () => {
    newExcelSeqCheckbox.dataset.userToggled = "1";
  });
}

function createAndStartExcelTask() {
  const rawTaskName = newExcelTaskNameInput ? newExcelTaskNameInput.value.trim() : "";
  const taskName = rawTaskName || `Excel_${Date.now()}`;
  const count = Math.max(1, Math.min(20, parseInt(newExcelColCountInput ? newExcelColCountInput.value : "1", 10) || 1));

  const colInputs = newExcelColNamesList ? newExcelColNamesList.querySelectorAll("input[data-col-idx]") : [];
  const columns = [];
  for (let i = 0; i < count; i += 1) {
    const inp = colInputs[i];
    const colLabel = inp && inp.value.trim() ? inp.value.trim() : `Kolom ${i + 1}`;
    columns.push(colLabel);
  }

  const sequentialColumns = count > 1 && Boolean(newExcelSeqCheckbox && newExcelSeqCheckbox.checked);

  const newTask = {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: taskName,
    columns,
    sequentialColumns,
    rows: [],
    activeColIndex: 0,
    status: "running",
    createdAt: new Date().toISOString()
  };

  excelTasks.unshift(newTask);
  saveExcelTasksToStorage();
  openExcelTaskScanner(newTask.id, true);
}

function openExcelTaskScanner(taskId, replaceFromForm = false) {
  const task = excelTasks.find((t) => t.id === taskId);
  if (!task) return;

  task.status = "running";
  saveExcelTasksToStorage();

  activeAppFeature = "scan-to-excel";
  activeExcelTaskId = task.id;
  resetTransientScannerUI();
  hideAllMainSections();

  if (appHeaderTitle) appHeaderTitle.textContent = task.name;
  if (appHeaderSubtitle) {
    const modeDesc = task.sequentialColumns
      ? `Input Kolom berurutan (${task.columns.length} kolom)`
      : `${task.columns.length} kolom Excel`;
    appHeaderSubtitle.textContent = modeDesc;
  }

  if (scannerCard) {
    scannerCard.style.display = "flex";
    scannerCard.classList.add("excel-mode");
  }
  if (scanTopOverlay) scanTopOverlay.style.display = "";
  if (scanGuide) scanGuide.style.display = "";
  if (zoomToggleBtn) zoomToggleBtn.style.display = "inline-flex";
  if (photoShutterBtn) photoShutterBtn.style.display = "inline-flex";
  if (keyboardToggleBtn) keyboardToggleBtn.style.display = "inline-flex";
  if (excelSessionPanel) excelSessionPanel.style.display = "flex";
  if (galleryPhotoBtn) galleryPhotoBtn.style.display = "none";
  if (manualSubmitBtn) manualSubmitBtn.textContent = "Scan Manual";
  if (lensCreateQrBtn) lensCreateQrBtn.textContent = "Salin ke Excel";

  setScanMode(currentScanMode || "full");
  renderExcelSessionTable();

  if (replaceFromForm) {
    replaceAppHistoryState("scan-to-excel-scan");
  } else {
    pushAppHistoryState("scan-to-excel-scan");
  }

  ensureCameraStarted();
}

function endExcelTaskById(taskId) {
  excelTasks = excelTasks.filter((t) => t.id !== taskId);
  saveExcelTasksToStorage();
  renderExcelRunningTasksList();
}

function deleteExcelTaskById(taskId) {
  endExcelTaskById(taskId);
}

function markCurrentExcelTaskCompleted() {
  const task = getActiveExcelTask();
  if (task) {
    task.status = "running";
    saveExcelTasksToStorage();
  }
  openExcelTaskHubView(true);
  replaceAppHistoryState("scan-to-excel-hub");
}

function renderExcelRunningTasksList() {
  const runningTasks = excelTasks.filter((t) => t.status !== "ended");
  if (excelRunningCount) {
    excelRunningCount.textContent = `${runningTasks.length} task`;
  }
  if (!excelRunningTasksList) return;

  if (runningTasks.length === 0) {
    excelRunningTasksList.innerHTML =
      '<div class="excel-running-empty">Belum ada task berjalan. Tekan <strong>+ New Task</strong> untuk membuat Excel baru.</div>';
    return;
  }

  excelRunningTasksList.innerHTML = runningTasks
    .map((task) => {
      const colNamesPreview = task.columns.join(", ");
      const nextColName = task.columns[task.activeColIndex] || task.columns[0] || "Kolom 1";
      const seqBadge = task.sequentialColumns ? ` • Urut: ${escapeHtmlSafe(nextColName)}` : "";
      const hasRows = Array.isArray(task.rows) && task.rows.length > 0;
      return `<div class="excel-task-card">
        <div class="excel-task-card-info">
          <div class="excel-task-card-title">${escapeHtmlSafe(task.name)}</div>
          <div class="excel-task-card-meta">${task.columns.length} Kolom (${escapeHtmlSafe(colNamesPreview)}) • ${task.rows.length} baris${seqBadge}</div>
        </div>
        <div class="excel-task-card-actions">
          <button type="button" class="excel-task-open-btn" onclick="openExcelTaskScanner('${escapeHtmlSafe(task.id)}')">Lanjutkan</button>
          <button type="button" class="excel-task-preview-btn" onclick="openExcelTaskPreview('${escapeHtmlSafe(task.id)}')">Preview</button>
          <button type="button" class="excel-task-download-btn" onclick="exportExcelTaskById('${escapeHtmlSafe(task.id)}')" ${hasRows ? "" : "disabled"}>Download</button>
          <button type="button" class="excel-task-del-btn" onclick="endExcelTaskById('${escapeHtmlSafe(task.id)}')">End Task</button>
        </div>
      </div>`;
    })
    .join("");
}

function openExcelTaskPreview(taskId) {
  const task = excelTasks.find((t) => t.id === taskId);
  if (!task || !excelPreviewModal) return;

  previewingExcelTaskId = task.id;
  if (excelPreviewTitle) {
    excelPreviewTitle.textContent = task.name;
  }
  if (excelPreviewSubtitle) {
    excelPreviewSubtitle.textContent = `${task.columns.length} Kolom • ${task.rows.length} baris`;
  }
  if (excelPreviewDownloadBtn) {
    excelPreviewDownloadBtn.disabled = task.rows.length === 0;
  }

  if (excelPreviewThead) {
    const thCols = task.columns.map((c) => `<th>${escapeHtmlSafe(c)}</th>`).join("");
    excelPreviewThead.innerHTML = `<tr><th>No</th>${thCols}</tr>`;
  }

  if (excelPreviewTbody) {
    if (!Array.isArray(task.rows) || task.rows.length === 0) {
      excelPreviewTbody.innerHTML = `<tr><td colspan="${task.columns.length + 1}" style="text-align:center; color:#64748b; padding:24px 12px;">Belum ada data hasil scan pada task ini.</td></tr>`;
    } else {
      excelPreviewTbody.innerHTML = task.rows
        .map((rowArr, idx) => {
          const tds = task.columns
            .map((_, cIdx) => {
              const val = rowArr[cIdx] || "";
              return `<td>${val ? escapeHtmlSafe(val) : '<span style="color:#94a3b8;">-</span>'}</td>`;
            })
            .join("");
          return `<tr><td>${idx + 1}</td>${tds}</tr>`;
        })
        .join("");
    }
  }

  const wasOpen = excelPreviewModal.classList.contains("open");
  excelPreviewModal.classList.add("open");
  excelPreviewModal.setAttribute("aria-hidden", "false");
  if (!wasOpen) {
    pushAppHistoryState("scan-to-excel-hub:preview");
  }
}

function closeExcelPreviewModalOnly() {
  previewingExcelTaskId = null;
  if (excelPreviewModal) {
    excelPreviewModal.classList.remove("open");
    excelPreviewModal.setAttribute("aria-hidden", "true");
  }
}

function closeExcelTaskPreview(fromBack = false) {
  if (!fromBack && excelPreviewModal && excelPreviewModal.classList.contains("open")) {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
  }
  closeExcelPreviewModalOnly();
  currentRoute = "scan-to-excel-hub";
}

function downloadPreviewedExcelTask() {
  if (!previewingExcelTaskId) return;
  exportExcelTaskById(previewingExcelTaskId);
}
