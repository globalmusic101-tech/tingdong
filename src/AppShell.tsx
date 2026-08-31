import { useState } from 'react';
import App from './App';
import { PrompterApp } from './prompter/PrompterApp';
import './appShell.css';

type Mode = 'translate' | 'prompter';

export function AppShell() {
  const [mode, setMode] = useState<Mode>(
    () => (localStorage.getItem('app.mode') as Mode) || 'translate',
  );

  const pick = (next: Mode) => {
    setMode(next);
    localStorage.setItem('app.mode', next);
  };

  return (
    <div className="shell">
      <nav className="shell-tabs">
        <button className={mode === 'translate' ? 'is-on' : ''} onClick={() => pick('translate')}>
          번역기
        </button>
        <button className={mode === 'prompter' ? 'is-on' : ''} onClick={() => pick('prompter')}>
          읽기 연습
        </button>
      </nav>
      <div className="shell-body">
        {mode === 'translate' ? <App /> : <PrompterApp />}
      </div>
    </div>
  );
}
