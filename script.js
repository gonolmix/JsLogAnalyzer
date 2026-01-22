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

// вызов с задержкой (300 мс)
document.getElementById('messageKeyword').addEventListener('input', debounce(applyFilters, 300));

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
        if (!isDateValid(entry.ts)){
          // пропуск строки
          continue;
        }
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
      // 9. логирование ошибок парсинга в консоли
      console.warn('Failed to parse log line:', line, e);
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

    const logTimeText = toComparableDate(l.ts);
    const logTime = Date.parse(logTimeText);
    
    // 5. пропуск фильтрации, если поля времени пусты
    if (startTimeInput.value){
          const startTime = Date.parse(startTimeInput.value);
          if (isNaN(startTime) || logTime < startTime) {
          return false;
    }
    }

    if (endTimeInput.value){
          const endTime = Date.parse(endTimeInput.value);
          if (isNaN(endTime) || logTime > endTime){
          return false;
    }
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

// 4. Функция корректности даты
function isDateValid(ts){
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(ts);
}

// 3. Функция правильного экранирования ковычек
function escapeCsv(value){
  if (value == null){
    return '""';
  }
  let textString = String(value);
  textString = textString.replace(/"/g, '""');
  return '"${textString}"';
}

function exportToCSV(){
  if (filtered_logs.length === 0){
    alert("Нет данных для экспорта в CSV!");
    return;
  }

  const headers = ['Time', 'Level', 'Service', 'Message'];

  const rows = filtered_logs.map(l =>
  [
    escapeCsv(l.ts),
    escapeCsv(l.level),
    escapeCsv(l.service),
    escapeCsv(l.msg)
  ].join(',')
  );
  
  // 1. добавлен \ufeff; 2. изменено ; на , 
  const content = '\uFEFF' + [headers.join(','), ...rows].join('\n');

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

  // 6. функция задержки
  function debounce(callee, timeoutMs) {
  return function perform(...args) {
    let previousCall = this.lastCall

    this.lastCall = Date.now()

    if (previousCall && this.lastCall - previousCall <= timeoutMs) {
      clearTimeout(this.lastCallTimer)
    }

    this.lastCallTimer = setTimeout(() => callee(...args), timeoutMs)
  }
}

// 10. функция для корректного сравнения дат
function toComparableDate(date){
  return date.replace(' ', 'T');
}
