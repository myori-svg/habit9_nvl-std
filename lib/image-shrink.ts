// 폰 사진은 한 장이 3~5MB라 그대로 올리면 오래 걸리고 AI 요청 크기 한도에도 부담이
// 된다. 교재 글씨가 읽히는 크기로만 줄여서 JPEG로 만든다. 브라우저에서만 쓴다.

const MAX_LONG_SIDE = 1800;
const JPEG_QUALITY = 0.82;

export async function shrinkImage(file: File): Promise<Blob> {
  // 폰 사진의 회전 정보(EXIF)를 반영해서 읽어야 눕지 않는다.
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  });
  try {
    const scale = Math.min(
      1,
      MAX_LONG_SIDE / Math.max(bitmap.width, bitmap.height)
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('이미지를 줄일 수 없는 브라우저예요');
    // 투명 배경(PNG 캡처 등)이 JPEG에서 검게 변하지 않도록 흰색으로 먼저 칠한다.
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error('이미지를 줄이지 못했어요')),
        'image/jpeg',
        JPEG_QUALITY
      );
    });
  } finally {
    bitmap.close();
  }
}
