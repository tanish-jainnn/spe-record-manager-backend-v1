export function toCsv(headers, rows) {
  const esc = (c) => {
    let s = c === null || c === undefined ? '' : String(c);
    if (/^[=+\-@]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`; // block spreadsheet formula injection
    return `"${s.replace(/"/g, '""')}"`;
  };
  return '\uFEFF' + [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
}
