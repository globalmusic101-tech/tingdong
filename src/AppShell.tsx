import { useState } from 'react';
import App from './App';
import { PrompterApp } from './prompter/PrompterApp';
import { BibleStudy } from './bible/BibleStudy';
import { LangProvider, useLang } from './lib/i18nContext';
import type { UiLang } from './lib/i18n';
import './appShell.css';

type Mode = 'translate' | 'prompter' | 'bible';

/**
 * 언어 선택은 탭 줄 오른쪽 끝에 둔다 (02-screens).
 * 설정 창 안에 숨기면, 한글 화면을 처음 만난 사람이 가장 먼저 찾아야 하는 것을
 * 가장 찾기 어려운 곳에 두는 셈이 된다.
 */
function LangToggle() {
  const { lang, setLang } = useLang();

  const pick = (next: UiLang) => (
    <button
      key={next}
      className={lang === next ? 'is-on' : ''}
      onClick={() => setLang(next)}
      lang={next}
      aria-pressed={lang === next}
    >
      {next === 'ko' ? '한국어' : 'English'}
    </button>
  );

  return <div className="shell-lang">{pick('ko')}{pick('en')}</div>;
}

function Shell() {
  const { t } = useLang();
  const [mode, setMode] = useState<Mode>(
    () => {
      try {
        const saved = localStorage.getItem('app.mode');
        return saved === 'translate' || saved === 'prompter' ? saved : 'bible';
      } catch { return 'bible'; }
    },
  );

  const pick = (next: Mode) => {
    setMode(next);
    try { localStorage.setItem('app.mode', next); } catch { /* 학습 화면에서 저장 실패를 안내합니다. */ }
  };

  return (
    <div className="shell">
      <nav className="shell-tabs">
        <button className={mode === 'bible' ? 'is-on' : ''} onClick={() => pick('bible')}>
          {t.navBible}
        </button>
        <button className={mode === 'translate' ? 'is-on' : ''} onClick={() => pick('translate')}>
          {t.navTranslate}
        </button>
        <button className={mode === 'prompter' ? 'is-on' : ''} onClick={() => pick('prompter')}>
          {t.navPractice}
        </button>
        <LangToggle />
      </nav>
      <div className="shell-body">
        {mode === 'bible' ? <BibleStudy /> : mode === 'translate' ? <App /> : <PrompterApp />}
      </div>
    </div>
  );
}

export function AppShell() {
  return (
    <LangProvider>
      <Shell />
    </LangProvider>
  );
}
