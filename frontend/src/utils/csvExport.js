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
