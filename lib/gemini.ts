// Convert Google Drive share URL to direct image URL
export function driveUrlToDirectUrl(driveUrl: string): string {
  const match = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  }
  return driveUrl;
}

// Fetch image as base64 from Google Drive
export async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const directUrl = driveUrlToDirectUrl(url);
    const res = await fetch(`/api/fetch-image?url=${encodeURIComponent(directUrl)}`);
    if (!res.ok) return null;
    const { data, mimeType } = await res.json();
    return { data, mimeType };
  } catch {
    return null;
  }
}
