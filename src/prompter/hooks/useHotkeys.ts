import { useEffect } from 'react';

export type HotkeyHandlers = {
  next: (withSpeak: boolean) => void;
  prev: (withSpeak: boolean) => void;
  repeat: () => void;
  stop: () => void;
  biggerFont: () => void;
  smallerFont: () => void;
  faster: () => void;
  slower: () => void;
  markStart: () => void;
  markEnd: () => void;
  clearRange: () => void;
};

/** 입력 중일 때는 단축키가 타이핑을 가로채면 안 된다 */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

export function useHotkeys(handlers: HotkeyHandlers, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;

      const withSpeak = !event.shiftKey;

      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          handlers.next(withSpeak);
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          handlers.prev(withSpeak);
          break;
        case 'Enter':
          handlers.repeat();
          break;
        case ' ':
          // 프롬프터에서는 스페이스가 "다음"이 가장 자연스럽다
          handlers.next(withSpeak);
          break;
        case 'Escape':
          handlers.stop();
          break;
        case '+':
        case '=':
          handlers.biggerFont();
          break;
        case '-':
        case '_':
          handlers.smallerFont();
          break;
        case ']':
          handlers.faster();
          break;
        case '[':
          handlers.slower();
          break;
        case 'a':
        case 'A':
        case 'ㅁ':            // 한글 자판이 켜져 있어도 같은 자리
          handlers.markStart();
          break;
        case 'b':
        case 'B':
        case 'ㅠ':
          handlers.markEnd();
          break;
        case 'c':
        case 'C':
        case 'ㅊ':
          handlers.clearRange();
          break;
        default:
          return; // 우리가 쓰지 않는 키는 브라우저에 그대로 넘긴다
      }

      // 화살표·스페이스가 페이지를 스크롤하지 않게 한다
      event.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, handlers]);
}
