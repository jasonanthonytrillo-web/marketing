const escapeCsvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const downloadCsv = (filename, sections) => {
  const rows = [];
  sections.forEach((section, index) => {
    if (index > 0) rows.push([]);
    if (section.title) rows.push([section.title]);
    rows.push(section.headers || []);
    (section.rows || []).forEach(row => rows.push(row));
  });

  const csv = rows.map(row => row.map(escapeCsvValue).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}\r\n`], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export const downloadStyledExcel = (filename, sections) => {
  const tables = sections.map(section => `
    <h2>${escapeHtml(section.title || 'Report')}</h2>
    <table>
      <thead><tr>${(section.headers || []).map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
      <tbody>${(section.rows || []).map(row => `<tr>${row.map(value => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  `).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{font-family:Arial,sans-serif;color:#1e293b;padding:24px}h1{color:#075b12;margin:0 0 4px}h2{background:#075b12;color:#fff;padding:10px 12px;margin:22px 0 0;font-size:16px}table{border-collapse:collapse;width:100%;margin-bottom:20px}th{background:#e8f5e9;color:#075b12;font-weight:bold;text-align:left}th,td{border:1px solid #cbd5e1;padding:8px 10px}tr:nth-child(even) td{background:#f8fafc}
  </style></head><body><h1>${escapeHtml(filename.replace(/\.xls$/i, ''))}</h1>${tables}</body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'application/vnd.ms-excel' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const downloadBlob = (filename, response) => {
  const url = URL.createObjectURL(new Blob([response.data], { type: response.headers?.['content-type'] || 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
