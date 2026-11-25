// 8. Fitur Scan to Excel (Multi-Kolom, Urutan Kolom Otomatis, Anti-Duplikat & Generator .xlsx Murni)
function escapeHtmlSafe(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showExcelScanToast(msg) {
  if (!excelScanToast) return;
  excelScanToast.textContent = msg;
  excelScanToast.classList.add("visible");
  if (excelToastTimer) {
    clearTimeout(excelToastTimer);
  }
  excelToastTimer = setTimeout(() => {
    excelScanToast.classList.remove("visible");
  }, 1700);
}

function selectExcelTargetColumn(colIdx) {
  const task = getActiveExcelTask();
  if (!task) return;
  if (colIdx < 0 || colIdx >= task.columns.length) return;
  task.activeColIndex = colIdx;
  saveExcelTasksToStorage();
  renderExcelSessionTable();
}

function getExcelNextTargetInfo(task) {
  if (!task || !Array.isArray(task.columns) || task.columns.length === 0) {
    return { colIndex: 0, colName: "Kolom 1", rowNumber: 1 };
  }
  const colIndex = Math.max(0, Math.min(task.columns.length - 1, task.activeColIndex || 0));
  const colName = task.columns[colIndex] || `Kolom ${colIndex + 1}`;
  const lastRow = task.rows.length > 0 ? task.rows[task.rows.length - 1] : null;
  const willAppendToLastRow =
    task.sequentialColumns &&
    task.columns.length > 1 &&
    colIndex > 0 &&
    lastRow &&
    !lastRow[colIndex];

  const rowNumber = willAppendToLastRow ? task.rows.length : task.rows.length + 1;
  return { colIndex, colName, rowNumber };
}

function findDuplicateInActiveExcelTask(rawText, taskOverride = null) {
  const cleanText = String(rawText || "").trim();
  const task = taskOverride || getActiveExcelTask();
  if (!cleanText || !task || !Array.isArray(task.rows)) return null;

  for (let rIdx = 0; rIdx < task.rows.length; rIdx += 1) {
    const rowArr = task.rows[rIdx];
    if (!Array.isArray(rowArr)) continue;
    for (let cIdx = 0; cIdx < task.columns.length; cIdx += 1) {
      const cellVal = String(rowArr[cIdx] || "").trim();
      if (cellVal && cellVal === cleanText) {
        return {
          value: cleanText,
          rowNumber: rIdx + 1,
          colIndex: cIdx,
          colName: task.columns[cIdx] || `Kolom ${cIdx + 1}`
        };
      }
    }
  }
  return null;
}

function addScannedItemToExcel(rawText) {
  const cleanText = String(rawText || "").trim();
  const task = getActiveExcelTask();
  if (!cleanText || !task) return false;

  const dupInfo = findDuplicateInActiveExcelTask(cleanText, task);
  if (dupInfo) {
    showExcelScanToast(`Double scan dibatalkan: ${cleanText} (Baris #${dupInfo.rowNumber})`);
    return false;
  }

  const colCount = Math.max(1, task.columns.length);
  const targetCol = Math.max(0, Math.min(colCount - 1, task.activeColIndex || 0));
  const targetColName = task.columns[targetCol] || `Kolom ${targetCol + 1}`;

  if (task.sequentialColumns && colCount > 1) {
    const lastRow = task.rows.length > 0 ? task.rows[task.rows.length - 1] : null;
    if (targetCol > 0 && lastRow && !lastRow[targetCol]) {
      lastRow[targetCol] = cleanText;
    } else {
      const freshRow = new Array(colCount).fill("");
      freshRow[targetCol] = cleanText;
      task.rows.push(freshRow);
    }
    task.activeColIndex = (targetCol + 1) % colCount;
  } else {
    const freshRow = new Array(colCount).fill("");
    freshRow[targetCol] = cleanText;
    task.rows.push(freshRow);
  }

  saveExcelTasksToStorage();
  renderExcelSessionTable();

  const nextColName = task.columns[task.activeColIndex] || task.columns[0];
  const nextHint =
    task.sequentialColumns && colCount > 1 ? ` • Lanjut: ${nextColName}` : "";
  showExcelScanToast(`Masuk [${targetColName}]: ${cleanText}${nextHint}`);
  return true;
}

function removeExcelSessionRow(index) {
  const task = getActiveExcelTask();
  if (!task || index < 0 || index >= task.rows.length) return;
  task.rows.splice(index, 1);
  if (task.rows.length === 0) {
    task.activeColIndex = 0;
  }
  saveExcelTasksToStorage();
  renderExcelSessionTable();
}

function renderExcelSessionTable() {
  const task = getActiveExcelTask();
  if (!task) return;

  if (excelActiveTaskName) {
    excelActiveTaskName.textContent = task.name;
  }
  if (excelRowCount) {
    excelRowCount.textContent = `${task.rows.length} baris`;
  }
  if (excelDownloadBtn) {
    excelDownloadBtn.disabled = task.rows.length === 0;
  }

  if (excelTargetColBar) {
    excelTargetColBar.innerHTML = task.columns
      .map((colName, idx) => {
        const isActive = idx === (task.activeColIndex || 0);
        const prefix = isActive ? "Target: " : "";
        return `<button type="button" class="excel-col-pill${isActive ? " active" : ""}" onclick="selectExcelTargetColumn(${idx})">${prefix}${idx + 1}. ${escapeHtmlSafe(colName)}</button>`;
      })
      .join("");
  }

  if (excelRowsThead) {
    const thCols = task.columns.map((c) => `<th>${escapeHtmlSafe(c)}</th>`).join("");
    excelRowsThead.innerHTML = `<tr><th>No</th>${thCols}<th>Aksi</th></tr>`;
  }

  if (!excelRowsTbody) return;

  if (task.rows.length === 0) {
    excelRowsTbody.innerHTML = `<tr class="excel-empty-row"><td colspan="${task.columns.length + 2}">Belum ada data. Arahkan kamera ke barcode/QR untuk mulai mencatat.</td></tr>`;
    return;
  }

  const rowsHtml = task.rows
    .map((rowArr, idx) => {
      const cellsHtml = task.columns
        .map((_, cIdx) => {
          const val = rowArr[cIdx] || "";
          return `<td>${val ? `<strong>${escapeHtmlSafe(val)}</strong>` : '<span style="color:#94a3b8;">-</span>'}</td>`;
        })
        .join("");
      return `<tr>
        <td>${idx + 1}</td>
        ${cellsHtml}
        <td><button type="button" class="excel-del-row-btn" onclick="removeExcelSessionRow(${idx})">Hapus</button></td>
      </tr>`;
    })
    .reverse()
    .join("");

  excelRowsTbody.innerHTML = rowsHtml;
}

function escapeXmlValue(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnIndexToExcelLetter(colIdx) {
  let letter = "";
  let temp = colIdx;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

function computeCrc32Bytes(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc & 1) ? ((crc >>> 1) ^ 0xedb88320) : (crc >>> 1);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildStoredZipBlob(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  entries.forEach((entry) => {
    const nameBytes = encoder.encode(entry.name);
    const dataBytes = encoder.encode(entry.content);
    const crc = computeCrc32Bytes(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lView = new DataView(localHeader.buffer);
    lView.setUint32(0, 0x04034b50, true);
    lView.setUint16(4, 20, true);
    lView.setUint16(6, 0, true);
    lView.setUint16(8, 0, true);
    lView.setUint16(10, 0, true);
    lView.setUint16(12, 0x0021, true);
    lView.setUint32(14, crc, true);
    lView.setUint32(18, dataBytes.length, true);
    lView.setUint32(22, dataBytes.length, true);
    lView.setUint16(26, nameBytes.length, true);
    lView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cView = new DataView(centralHeader.buffer);
    cView.setUint32(0, 0x02014b50, true);
    cView.setUint16(4, 20, true);
    cView.setUint16(6, 20, true);
    cView.setUint16(8, 0, true);
    cView.setUint16(10, 0, true);
    cView.setUint16(12, 0, true);
    cView.setUint16(14, 0x0021, true);
    cView.setUint32(16, crc, true);
    cView.setUint32(20, dataBytes.length, true);
    cView.setUint32(24, dataBytes.length, true);
    cView.setUint16(28, nameBytes.length, true);
    cView.setUint16(30, 0, true);
    cView.setUint16(32, 0, true);
    cView.setUint16(34, 0, true);
    cView.setUint16(36, 0, true);
    cView.setUint32(38, 0, true);
    cView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  });

  const centralDirSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = new Uint8Array(22);
  const eView = new DataView(endRecord.buffer);
  eView.setUint32(0, 0x06054b50, true);
  eView.setUint16(4, 0, true);
  eView.setUint16(6, 0, true);
  eView.setUint16(8, entries.length, true);
  eView.setUint16(10, entries.length, true);
  eView.setUint32(12, centralDirSize, true);
  eView.setUint32(16, offset, true);
  eView.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, endRecord], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

function exportExcelTaskObject(task) {
  if (!task || !Array.isArray(task.rows) || task.rows.length === 0) return;

  const sheetRows = [
    ["No", ...task.columns],
    ...task.rows.map((rowArr, idx) => [
      idx + 1,
      ...task.columns.map((_, cIdx) => rowArr[cIdx] || "")
    ])
  ];

  const rowsXml = sheetRows
    .map((row, rIdx) => {
      const rowNum = rIdx + 1;
      const cellsXml = row
        .map((val, cIdx) => {
          const cellRef = `${columnIndexToExcelLetter(cIdx)}${rowNum}`;
          if (typeof val === "number") {
            return `<c r="${cellRef}" t="n"><v>${val}</v></c>`;
          }
          return `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXmlValue(val)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowNum}">${cellsXml}</row>`;
    })
    .join("");

  const colsXml = [
    `<col min="1" max="1" width="8" customWidth="1"/>`,
    ...task.columns.map(
      (_, idx) => `<col min="${idx + 2}" max="${idx + 2}" width="28" customWidth="1"/>`
    )
  ].join("\n    ");

  const zipEntries = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Hasil Scan" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>
    ${colsXml}
  </cols>
  <sheetData>${rowsXml}</sheetData>
</worksheet>`
    }
  ];

  const xlsxBlob = buildStoredZipBlob(zipEntries);
  const url = URL.createObjectURL(xlsxBlob);
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(
    now.getMinutes()
  ).padStart(2, "0")}`;
  const safeBaseName = task.name.replace(/[^A-Za-z0-9_\-]/g, "_") || "Hasil_Scan";

  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeBaseName}_${stamp}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function exportScannedListToExcel() {
  const task = getActiveExcelTask();
  if (!task || task.rows.length === 0) return;
  exportExcelTaskObject(task);
}

function exportExcelTaskById(taskId) {
  const task = excelTasks.find((t) => t.id === taskId);
  if (!task || task.rows.length === 0) return;
  exportExcelTaskObject(task);
}
