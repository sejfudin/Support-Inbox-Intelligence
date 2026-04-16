export const escapeCsvCell = (value) => {
  const str = String(value ?? "");
  const escaped = str.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
};

export const formatCsvDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
};

export const buildCsv = (headers, rows) => {
  const safeHeaders = headers.map(escapeCsvCell).join(",");
  const safeRows = rows
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");
  return `${safeHeaders}\n${safeRows}`;
};

export const downloadCsvFile = (filename, csvContent) => {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

