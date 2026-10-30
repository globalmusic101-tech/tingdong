/**
 * 시작 버튼을 눌렀을 때 읽기 시작할 문장을 정한다.
 * 커서를 따로 고르지 않았으면 저장된 이전 위치와 무관하게 첫 문장부터 시작한다.
 */
export function startIndexFor(
  caret: number | null,
  indexAtSource: (caret: number) => number,
): number {
  return caret === null ? 0 : indexAtSource(caret);
}
