import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { loadUiLang, saveUiLang, stringsFor, targetLangFor, type Strings, type UiLang } from './i18n';

type LangValue = {
  lang: UiLang;
  /** 번역 타깃 — 화면 언어를 따라간다 */
  target: 'ko' | 'en';
  t: Strings;
  setLang: (next: UiLang) => void;
};

const LangContext = createContext<LangValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLang>(loadUiLang);

  const setLang = useCallback((next: UiLang) => {
    setLangState(next);
    saveUiLang(next);
  }, []);

  const value = useMemo<LangValue>(
    () => ({ lang, target: targetLangFor(lang), t: stringsFor(lang), setLang }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangValue {
  const value = useContext(LangContext);
  // Provider 없이 쓰면 화면이 반쯤 한국어로 남는다 — 조용히 기본값을 주지 않는다
  if (!value) throw new Error('useLang은 LangProvider 안에서만 쓸 수 있습니다');
  return value;
}
