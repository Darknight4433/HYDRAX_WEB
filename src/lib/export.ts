export function exportCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportPDF(title: string, sections: { heading: string; lines: string[] }[]) {
  const html = `<!doctype html><html><head><title>${title}</title>
    <style>body{font-family:ui-sans-serif,system-ui;padding:32px;color:#0b1220}
    h1{margin:0 0 6px;color:#0891b2}h2{margin:22px 0 6px;color:#334155}
    p{margin:2px 0;color:#475569;font-size:13px}hr{border:0;border-top:1px solid #e2e8f0}</style>
    </head><body>
    <h1>${title}</h1><p>Generated ${new Date().toLocaleString()}</p><hr/>
    ${sections
      .map((s) => `<h2>${s.heading}</h2>${s.lines.map((l) => `<p>${l}</p>`).join("")}`)
      .join("")}
    </body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 300);
}
