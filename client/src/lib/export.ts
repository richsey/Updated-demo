export function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);

  // Convert objects to CSV string
  const csvContent = [
    headers.join(","), // Header row
    ...data.map((row) =>
      headers
        .map((header) => {
          let cell = row[header] === null || row[header] === undefined ? "" : String(row[header]);
          // Escape quotes and wrap in quotes if it contains comma, newline, or quote
          if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
            cell = `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(",")
    ),
  ].join("\n");

  // Create Blob and download link
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
