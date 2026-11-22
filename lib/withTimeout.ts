// Firebase Storage 업로드가 (CORS 오탐, 네트워크 등으로) 응답 없이 무한
// 재시도에 빠지는 경우가 있어서, 일정 시간 넘게 안 끝나면 에러로 처리하고
// 다음 항목으로 넘어갈 수 있게 한다 (사람이 재생성/재시도 버튼으로 복구 가능).
// 실제 프라미스 자체를 취소하지는 못하고 그냥 기다리는 걸 포기하는 것뿐이라,
// 백그라운드에서 원래 요청이 뒤늦게 끝날 수도 있다 — 그건 무해함.
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            `${label} 시간 초과 (${Math.round(ms / 1000)}초) — 다시 시도해주세요`
          )
        ),
      ms
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}
