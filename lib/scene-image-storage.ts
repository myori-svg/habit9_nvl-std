import { put } from '@vercel/blob';
import type { SceneSlot } from '@/types';

export const SCENE_IMAGE_PATH_PATTERN =
  /^novels\/[\w-]+\/parts\/[\w-]+\/scenes\/\d+-(main|optionA|optionB)\.webp$/;

// 질문의 임의 ID가 아니라 "이 파트의 몇 번째 질문·어느 슬롯"이라는 고정 자리를
// 경로로 쓴다. 그래야 "전체 다시 생성"으로 질문 ID가 통째로 바뀌어도 항상 같은
// 자리를 덮어써서 저장 용량이 늘어나지 않는다.
export function sceneImagePath(
  novelId: string,
  partId: string,
  dqIndex: number,
  slot: SceneSlot
): string {
  return `novels/${novelId}/parts/${partId}/scenes/${dqIndex}-${slot}.webp`;
}

// 보관함이 비공개 전용이라 브라우저가 Blob 주소를 직접 열 수 없다. 화면에는
// 서버 경유 주소(/api/scene-image)를 쓰고, 같은 경로를 덮어써도 브라우저가 옛
// 그림을 보여주지 않도록 v(생성 시각)를 붙인다.
export function sceneImageViewUrl(pathname: string): string {
  return `/api/scene-image?path=${encodeURIComponent(pathname)}&v=${Date.now()}`;
}

export async function uploadSceneImageToBlob(
  novelId: string,
  partId: string,
  dqIndex: number,
  slot: SceneSlot,
  base64: string,
  mime: string
): Promise<string> {
  const pathname = sceneImagePath(novelId, partId, dqIndex, slot);
  await put(pathname, Buffer.from(base64, 'base64'), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: mime,
  });
  return sceneImageViewUrl(pathname);
}
