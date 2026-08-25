/**
 * Browser-side file download helpers. Server actions hand back generated
 * documents base64-encoded (no storage round-trip for one-off exports); these
 * turn that payload into a save dialog.
 */

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const XLSX_MIME_TYPE = XLSX_MIME;

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Saves a base64 payload to disk under `fileName`. */
export function downloadBase64File(
  base64: string,
  fileName: string,
  mimeType: string,
): void {
  const blob = new Blob([base64ToBytes(base64)], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a tick to start the download before dropping the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
