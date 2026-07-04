export function downloadBase64File(
  base64: string,
  mime: string,
  name: string
): void {
  const ext = mime.split('/')[1] || 'png';
  const a = document.createElement('a');
  a.href = `data:${mime};base64,${base64}`;
  a.download = `${name}.${ext}`;
  a.click();
}
