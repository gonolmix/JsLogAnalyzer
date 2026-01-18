// константы

const errorCheckbox = document.getElementById('ERROR');
const warnCheckbox = document.getElementById('WARN');
const infoCheckbox = document.getElementById('INFO');
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');
const keywordInput = document.getElementById('messageKeyword');


const log_regex = /^(?<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(?<level>\w+)\] (?<service>\w+) — (?<msg>.+)$/;

// все логи
let logs = [];

// отфильтрованные логи
let filtered_logs = [];

// слушатели

document.getElementById('fileInput').addEventListener('change', handleFile);
document.getElementById('ERROR').addEventListener('change', applyFilters);
document.getElementById('WARN').addEventListener('change', applyFilters);
document.getElementById('INFO').addEventListener('change', applyFilters);
document.getElementById('startTime').addEventListener('change', applyFilters);
document.getElementById('endTime').addEventListener('change', applyFilters);
document.getElementById('messageKeyword').addEventListener('input', applyFilters);
document.getElementById('exportButton').addEventListener('click', exportToCSV);


async function handleFile(event) {
    const file = event.target.files[0];

    if (!file)
        return;

    const text = await file.text();
    logs = parseLogText(text, file.name.endsWith('.json'));
    renderTable(logs);
    applyFilters();
}

function parseLogText(text, isJson) {
  const lines = text.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
  const logs = [];

  for (const line of lines) {
    try {
      if (isJson) {
        const entry = JSON.parse(line);
        logs.push({
          ts: entry.ts,
          level: entry.level || 'INFO',
          service: entry.service || 'unknown',
          msg: entry.msg || ''
        });
      } else {
        const match = line.match(log_regex);
        if (match && match.groups) {
          logs.push({
            ts: match.groups.ts,
            level: match.groups.level,
            service: match.groups.service,
            msg: match.groups.msg
          });
        }
      }
    } catch (e) {
    }
  }

  return logs;
}

function renderTable(logs) {
  const tbody = document.getElementById('logBody');
  tbody.innerHTML = '';

  for (const log of logs) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${log.ts}</td>
      <td>${log.level}</td>
      <td>${log.service}</td>
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

  filtered_logs = logs.filter(l => {
    const levelCheck = 
    (errorCheckbox.checked && l.level === "ERROR") ||
    (warnCheckbox.checked && l.level === "WARN") ||
    (infoCheckbox.checked && l.level === "INFO");

    if (!levelCheck){
      return false;
    }

    const logTime = new Date(l.ts);
    const startTime = new Date(startTimeInput.value);
    const endTime = new Date(endTimeInput.value);

    if (logTime < startTime) {
      return false;
    }

    if (logTime > endTime){
      return false;
    }

    const keyword = keywordInput.value.trim().toLowerCase();
    if (keyword && !l.msg.toLowerCase().includes(keyword)) {
      return false;
    }

    return true;
  }
  );
  renderTable(filtered_logs);
}

function exportToCSV(){
  if (filtered_logs.length === 0){
    alert("Нет данных для экспорта в CSV!");
    return;
  }

  const headers = ['Time', 'Level', 'Service', 'Message'];

  const rows = filtered_logs.map(l =>
  [
    l.ts,
    l.level,
    l.service,
    l.msg
  ].join(';')
  );

  const content = [headers.join(';'), ...rows].join('\n');

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'filtered_logs.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}