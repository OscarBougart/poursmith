/** Triggers a browser download of an in-memory text file. */
export function downloadFile(
  filename: string,
  contents: string,
  mime = 'text/csv;charset=utf-8',
): void {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
