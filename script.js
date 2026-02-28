(function() {
// const

const errorCheckbox = document.getElementById('ERROR');
const warnCheckbox = document.getElementById('WARN');
const infoCheckbox = document.getElementById('INFO');
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');
const keywordInput = document.getElementById('messageKeyword');

// more flexible regex
const logRegex = /^(?<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(?<level>\w+)\] (?<service>[a-zA-Z0-9_.-]+) [—\-:] (?<msg>.+)$/;

// max parse warnings
const MAX_PARSE_WARNINGS = 10;

// error counter
let parseErrorCount = 0;

// date error counter
let dateErrorsCount = 0;

// all logs
let logs = [];

// filtered logs
let filteredLogs = [];

// listeners

// added real button instead of the label
document.getElementById('fileButton').addEventListener('click', () =>{
  document.getElementById('fileInput').click();
});
document.getElementById('fileInput').addEventListener('change', handleFile);
document.getElementById('ERROR').addEventListener('change', applyFilters);
document.getElementById('WARN').addEventListener('change', applyFilters);
document.getElementById('INFO').addEventListener('change', applyFilters);
document.getElementById('startTime').addEventListener('change', applyFilters);
document.getElementById('endTime').addEventListener('change', applyFilters);

// debounce (300 ms)
document.getElementById('messageKeyword').addEventListener('input', debounce(applyFilters, 300));

document.getElementById('exportButton').addEventListener('click', exportToCSV);



async function handleFile(event) {
    parseErrorCount = 0;
    dateErrorsCount = 0;
    
    const file = event.target.files[0];

    if (!file)
        return;

    const text = await file.text();
    logs = parseLogText(text, file.name.endsWith('.json'));
    renderTable(logs);
    applyFilters();

    event.target.value = '';
}

// added JSON array support
function parseLogText(text, isJson) {
  if (!isJson) {
    const lines = text.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    const logs = [];

    for (const line of lines) {
      try {
        const match = line.match(logRegex);
        if (match && match.groups) {
          if (isDateValid(match.groups.ts)) {
          logs.push({
            ts: match.groups.ts,
            isoTime: normalizeToIso(match.groups.ts),
            level: match.groups.level.toUpperCase(),
            service: match.groups.service,
            msg: match.groups.msg
          });
          }
          else {
          if (dateErrorsCount < MAX_PARSE_WARNINGS) {
            console.warn('Invalid timestamp in log line:', line);
            dateErrorsCount++;
          } else if (dateErrorsCount === MAX_PARSE_WARNINGS) {
            console.warn('... and more timestamp errors (skipped)');
            dateErrorsCount++;
          }
        }
      }
        else {
          if (parseErrorCount < MAX_PARSE_WARNINGS) {
            console.warn('Line does not match log format:', line);
            parseErrorCount++;
          } else if (parseErrorCount === MAX_PARSE_WARNINGS) {
              console.warn('... and more format errors (skipped)');
              parseErrorCount++;
          }
        }
      } catch (e) {
        if (parseErrorCount < MAX_PARSE_WARNINGS) {
          console.warn('Failed to parse log line:', line, e);
          parseErrorCount++;
        } else if (parseErrorCount === MAX_PARSE_WARNINGS) {
            console.warn('... and more parsing errors (skipped)');
            parseErrorCount++;
        }
      }
    }
    return logs;
  }

  try {
    const parsed = JSON.parse(text);

    if (Array.isArray(parsed)) {
      return parsed
        .filter(entry => entry && typeof entry === 'object' && isDateValid(entry.ts))
        .map(entry => ({
          ts: entry.ts,
          isoTime: normalizeToIso(entry.ts),
          level: String(entry.level || 'INFO').toUpperCase(),
          service: String(entry.service || 'unknown'),
          msg: String(entry.msg || '')
        }));
    } else if (typeof parsed === 'object' && parsed !== null) {
      if (isDateValid(parsed.ts)) {
        return [{
          ts: parsed.ts,
          isoTime: normalizeToIso(parsed.ts),
          level: String(parsed.level || 'INFO').toUpperCase(),
          service: String(parsed.service || 'unknown'),
          msg: String(parsed.msg || '')
        }];
      }
    }
  } catch (e) {}

  const lines = text.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
  const logs = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (isDateValid(entry.ts)) {
        logs.push({
          ts: entry.ts,
          isoTime: normalizeToIso(entry.ts),
          level: String(entry.level || 'INFO').toUpperCase(),
          service: String(entry.service || 'unknown'),
          msg: String(entry.msg || '')
        });
      }
    } catch (e) {
        if (parseErrorCount < MAX_PARSE_WARNINGS) {
          console.warn('Failed to parse JSON line:', line, e);
          parseErrorCount++;
        } else if (parseErrorCount === MAX_PARSE_WARNINGS) {
            console.warn('... and more parsing errors (skipped)');
            parseErrorCount++;
        }
    }
  }
  return logs;
}

function renderTable(logs) {
  const tbody = document.getElementById('logBody');
  tbody.innerHTML = '';

  for (const log of logs) {
    const row = document.createElement('tr');
    // added escapeHtml to ts/level/service
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
    const levelCheck = 
    (errorCheckbox.checked && l.level === "ERROR") ||
    (warnCheckbox.checked && l.level === "WARN") ||
    (infoCheckbox.checked && l.level === "INFO");

    if (!levelCheck){
      return false;
    }

    // comparison of ISO format dates
    if (startTimeInput.value && l.isoTime < startTimeInput.value) return false;

    if (endTimeInput.value && l.isoTime > endTimeInput.value) return false;

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
    alert("Нет данных для экспорта в CSV!");
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

  // функция с локальной переменной
  function debounce(func, timeoutMs) {
    let timeout;
    return function perform(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), timeoutMs);
  }
}

// date normalization function (ISO format)
function normalizeToIso(ts) {
  const match = ts.match(/^(\d{4})-(\d{1,2})-(\d{1,2}) (\d{1,2}):(\d{1,2}):\d{1,2}$/);
  if (!match) return null;

  const [, year, month, day, hours, minutes] = match;
  const pad = n => n.toString().padStart(2, '0');
  
  return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}`;
}
})();
