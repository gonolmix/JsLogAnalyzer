(function() {
// const

const errorCheckbox = getElement('ERROR');
const warnCheckbox = getElement('WARN');
const infoCheckbox = getElement('INFO');
const othersCheckbox = getElement('OTHERS');
const startTimeInput = getElement('startTime');
const endTimeInput = getElement('endTime');
const keywordInput = getElement('messageKeyword');
const showAllLevelsCheckbox = getElement('showAllLevels');
const report = getElement('parseReport');
const fileInput = getElement('fileInput');
const fileButton = getElement('fileButton');
const exportButton = getElement('exportButton');
const tbody = getElement('logBody');


// more flexible regex
const logRegex = /^(?<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(?<level>\w+)\] (?<service>[a-zA-Z0-9_.-]+) [—\-:] (?<msg>.+)$/;

// max parse warnings
const MAX_PARSE_WARNINGS = 10;

// error counter
let parseErrorCount = 0;

// date error counter
let dateErrorsCount = 0;

// error messages storage
let parseMessages = [];

// all logs
let logs = [];

// filtered logs
let filteredLogs = [];

// listeners

// added real button instead of the label
fileButton.addEventListener('click', () =>{
  fileInput.click();
});
fileInput.addEventListener('change', handleFile);
errorCheckbox.addEventListener('change', disableShowAllLevelsCheckbox);
warnCheckbox.addEventListener('change', disableShowAllLevelsCheckbox);
infoCheckbox.addEventListener('change', disableShowAllLevelsCheckbox);
startTimeInput.addEventListener('change', applyFilters);
endTimeInput.addEventListener('change', applyFilters);
othersCheckbox.addEventListener('change', disableShowAllLevelsCheckbox);


// debounce (300 ms)
keywordInput.addEventListener('input', debounce(applyFilters, 300));

exportButton.addEventListener('click', exportToCSV);

showAllLevelsCheckbox.addEventListener('change', disableCheckBoxes);


async function handleFile(event) {
  try{
    parseErrorCount = 0;
    dateErrorsCount = 0;
    parseMessages = [];
    
    const file = event.target.files[0];

    if (!file)
        return;

    const text = await file.text();
    logs = parseLogText(text, file.name.endsWith('.json'));
    applyFilters();

    event.target.value = '';
    
    makeReport();
    }
  catch(error){
    console.error('File processing failed:', error);

    alert('Failed to read the file. Please check if it is valid and not corrupted.');

    parseMessages = [`File read error: ${error.message}`];

    makeReport();
  }
}

 //parsing strategy:
 //- Try to parse entire file as JSON (array or object)
 //- If fails, process as JSONL (line-by-line)

function parseLogText(text, isJson) {
  if (!isJson) {
    const lines = text.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    const logs = [];

  for (const line of lines) {
    const match = line.match(logRegex);
    if (!match || !match.groups) {
      logParseMessage('Line does not match format', line);
      parseErrorCount++;
      continue;
    }

    if (!isDateValid(match.groups.ts)) {
      logParseMessage('Invalid timestamp', line);
      dateErrorsCount++;
      continue;
    }

    logs.push({
      ts: match.groups.ts,
      isoTime: normalizeToIso(match.groups.ts),
      level: match.groups.level.toUpperCase(),
      service: match.groups.service,
      msg: match.groups.msg
    });
  }
    return logs;
  }

  try {
    const parsed = JSON.parse(text);

    if (Array.isArray(parsed)) {
      const logs = [];
      for (const entry of parsed) {
        if (!entry || typeof entry !== 'object') {
          logParseMessage('Invalid JSON entry (not an object)', JSON.stringify(entry).slice(0, 100));
          parseErrorCount++;
          continue;
        }
        if (!isDateValid(entry.ts)) {
          logParseMessage('Invalid timestamp in JSON entry', JSON.stringify(entry).slice(0, 100));
          dateErrorsCount++;
          continue;
        }
        logs.push({
          ts: entry.ts,
          isoTime: normalizeToIso(entry.ts),
          level: String(entry.level || 'INFO').toUpperCase(),
          service: String(entry.service || 'unknown'),
          msg: String(entry.msg || '')
        });
      }
      return logs;
    } else if (typeof parsed === 'object' && parsed !== null) {
      if (isDateValid(parsed.ts)) {
        return [{
          ts: parsed.ts,
          isoTime: normalizeToIso(parsed.ts),
          level: String(parsed.level || 'INFO').toUpperCase(),
          service: String(parsed.service || 'unknown'),
          msg: String(parsed.msg || '')
        }];
      } else {
        logParseMessage('Invalid timestamp in JSON object', JSON.stringify(parsed).slice(0, 100));
        dateErrorsCount++;
      }
    }
    return [];
  } catch (e) {
    logParseMessage('Failed to parse entire JSON file', e.message);
    parseErrorCount++;
  }

  const lines = text.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
  const logs = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (!entry || typeof entry !== 'object') {
        logParseMessage('Invalid JSONL entry (not an object)', line.slice(0, 100));
        parseErrorCount++;
        continue;
      }
      if (!isDateValid(entry.ts)) {
        logParseMessage('Invalid timestamp in JSONL entry', line.slice(0, 100));
        dateErrorsCount++;
        continue;
      }
      logs.push({
        ts: entry.ts,
        isoTime: normalizeToIso(entry.ts),
        level: String(entry.level || 'INFO').toUpperCase(),
        service: String(entry.service || 'unknown'),
        msg: String(entry.msg || '')
      });
    } catch (e) {
      logParseMessage('JSON parse error', line.slice(0, 100) + ' (' + e.message + ')');
      parseErrorCount++;
    }
  }
  return logs;
}

function renderTable(logs) {
  tbody.innerHTML = '';

  for (const log of logs) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(log.ts)}</td>
      <td>${escapeHtml(log.level)}</td>
      <td>${escapeHtml(log.service)}</td>
      <td>${escapeHtml(log.msg)}</td>
    `;
    tbody.appendChild(row);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function applyFilters(){

  filteredLogs = logs.filter(l => {

    if (!l.isoTime) return false;
    
    if (!showAllLevelsCheckbox.checked) {
    const levelCheck = 
    (errorCheckbox.checked && l.level === "ERROR") ||
    (warnCheckbox.checked && l.level === "WARN") ||
    (infoCheckbox.checked && l.level === "INFO") ||
    (othersCheckbox.checked && l.level !== "ERROR" && l.level !== "WARN" && l.level !== "INFO")
    ;

    if (!levelCheck){
      return false;
    }
  }

    // comparison of ISO format dates
    if (startTimeInput.value) {
      const startWithSeconds = startTimeInput.value + ':00';
      if (l.isoTime < startWithSeconds) 
        return false;
    }

    if (endTimeInput.value){
      const endWithSeconds = endTimeInput.value + ':00';
      if (l.isoTime > endWithSeconds)
        return false;
    }

    const keyword = keywordInput.value.trim().toLowerCase();
    if (keyword && !l.msg.toLowerCase().includes(keyword)) {
      return false;
    }

    return true;
  }
  );
  renderTable(filteredLogs);
}

// advanced date validation function
function isDateValid(ts){
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(ts)) return false;

  const [datePart, timePart] = ts.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes, seconds] = timePart.split(':').map(Number);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (hours < 0 || hours > 23) return false;
  if (minutes < 0 || minutes > 59) return false;
  if (seconds < 0 || seconds > 59) return false;

  const d = new Date(year, month - 1, day, hours, minutes, seconds);
  return d.getFullYear() === year &&
         d.getMonth() === month - 1 &&
         d.getDate() === day;
}

function escapeCsv(value){
  if (value == null){
    return '""';
  }
  let textString = String(value);
  textString = textString.replace(/"/g, '""');
  return '"' + textString + '"';
}

function exportToCSV(){
  if (filteredLogs.length === 0){
    alert("No data for Export to CSV!");
    return;
  }

  const headers = ['Time', 'Level', 'Service', 'Message'];

  const rows = filteredLogs.map(l =>
  [
    escapeCsv(l.ts),
    escapeCsv(l.level),
    escapeCsv(l.service),
    escapeCsv(l.msg)
  ].join(',')
  );
  
  const content = '\uFEFF' + [headers.join(','), ...rows].join('\n');

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'filteredLogs.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

  function debounce(func, timeoutMs) {
    let timeout;
    return function perform(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), timeoutMs);
  }
}

// date normalization function (ISO format)
function normalizeToIso(ts) {
  if (!ts) return null;
  const match = ts.match(/^(\d{4})-(\d{1,2})-(\d{1,2}) (\d{1,2}):(\d{1,2}):(\d{1,2})$/);
  if (!match) return null;

  const [, year, month, day, hours, minutes, seconds] = match;
  const pad = n => String(n).padStart(2, '0');
  
  return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function disableCheckBoxes() {
    errorCheckbox.checked = false;
    warnCheckbox.checked = false;
    infoCheckbox.checked = false;
    othersCheckbox.checked = false;

    applyFilters();
}

function disableShowAllLevelsCheckbox() {
    showAllLevelsCheckbox.checked = false;

    applyFilters();
}

function logParseMessage(message, line = '') {
  console.warn(message, line);
  
  if (parseMessages.length < MAX_PARSE_WARNINGS) {
    parseMessages.push(`${message}: "${line.trim().slice(0, 80)}"`); 
  } else if (parseMessages.length === MAX_PARSE_WARNINGS) {
    parseMessages.push('... and more errors (skipped)');
  }
}

function makeReport() {
  const totalParsed = logs.length;
  const totalSkipped = parseErrorCount + dateErrorsCount;
  const totalProcessed = totalParsed + totalSkipped;

  let reportLines = [];
  reportLines.push(`Total lines processed: ${totalProcessed}`);
  reportLines.push(`Successfully parsed:  ${totalParsed}`);
  reportLines.push(`Skipped due to errors: ${totalSkipped}`);
  reportLines.push('');

  if (totalSkipped > 0) {
    reportLines.push('Error details:');
    if (parseMessages.length > 0) {
      parseMessages.forEach(msg => reportLines.push(msg));
    } else {
      reportLines.push('No specific errors captured (limit reached)');
    }
  } else {
    reportLines.push('No errors detected. All lines parsed successfully.');
  }

  report.value = reportLines.join('\n');
}

function getElement(id) {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Element with id "${id}" not found in DOM`);
  }
  return el;
}
})();

