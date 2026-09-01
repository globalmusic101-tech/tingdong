import type { EngineConfig, LookupResult } from './lib/translate';

/** preload.cjs가 창에 붙여주는 다리 — 브라우저에서 열면 없을 수 있으므로 전부 선택적이다 */
export type ElectronAPI = {
  onTranslateText: (cb: (data: {
    text: string;
    pinyin: string;
    copyFailed?: boolean;
    isAccessibilityTrusted?: boolean;
    engine?: EngineConfig;
  }) => void) => void;
  closePopup: () => void;
  setPinned: (pinned: boolean) => void;
  resize: (height: number) => void;
  requestAccessibility?: () => void;
  /** 번역기 탭의 엔진 설정을 팝업 창에도 넘겨준다 */
  syncEngineConfig?: (cfg: EngineConfig) => void;
};

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export type { LookupResult };
