import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, type PrompterSettings } from './lib/settings';
import { TONE_LABELS, resolveVoice, type Gender, type Tone } from './lib/tts/voiceMap';

type MenuProps = {
  label: string;
  /** 지금 값 — 열지 않고도 무엇이 선택돼 있는지 보인다 */
  value: string;
  openId: string | null;
  id: string;
  onOpen: (id: string | null) => void;
  children: ReactNode;
  wide?: boolean;
};

function Menu({ label, value, id, openId, onOpen, children, wide }: MenuProps) {
  const open = openId === id;

  return (
    <div className="pr-menu">
      <button
        className={`pr-menu-btn${open ? ' is-open' : ''}`}
        onClick={() => onOpen(open ? null : id)}
      >
        <span className="pr-menu-label">{label}</span>
        <span className="pr-menu-value">{value}</span>
        <span className="pr-menu-caret">▾</span>
      </button>

      {open && (
        <div className={`pr-menu-pop${wide ? ' is-wide' : ''}`} role="menu">
          {children}
        </div>
      )}
    </div>
  );
}

/** 팝업 안의 선택지 한 줄 */
function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className={`pr-choice${on ? ' is-on' : ''}`} onClick={onClick} role="menuitemradio" aria-checked={on}>
      <span className="pr-choice-mark">{on ? '✓' : ''}</span>
      <span className="pr-choice-body">{children}</span>
    </button>
  );
}

type Props = {
  settings: PrompterSettings;
  onChange: (patch: Partial<PrompterSettings>) => void;
  edgeAvailable: boolean;
  pace: number | null;
  /** 메뉴가 열려 있는 동안은 단축키를 멈춘다 */
  onOpenChange: (open: boolean) => void;
};

const TONES: Tone[] = ['news', 'sermon', 'chat'];

const PINYIN_LABELS: Record<PrompterSettings['pinyinMode'], string> = {
  off: '끔',
  above: '한자 위',
  below: '한자 아래',
};

const TONE_HINTS: Record<Tone, string> = {
  sermon: '느리고 호흡이 길게',
  news: '또렷하고 균일하게',
  chat: '자연스러운 대화체',
};

export function MenuBar({ settings, onChange, edgeAvailable, pace, onOpenChange }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const open = (id: string | null) => {
    setOpenId(id);
    onOpenChange(id !== null);
  };

  // 바깥을 누르거나 Esc를 누르면 닫는다
  useEffect(() => {
    if (openId === null) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!barRef.current?.contains(event.target as Node)) open(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        open(null);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  });

  const preset = resolveVoice(settings.gender, settings.tone);

  return (
    <div className={`pr-menubar${settings.muted ? ' is-muted' : ''}`} ref={barRef}>
      <Menu id="sound" label="소리" value={settings.muted ? '끔' : '켬'} openId={openId} onOpen={open}>
        <Choice on={!settings.muted} onClick={() => { onChange({ muted: false }); open(null); }}>
          <strong>켬</strong><em>문장을 읽어줍니다</em>
        </Choice>
        <Choice on={settings.muted} onClick={() => { onChange({ muted: true }); open(null); }}>
          <strong>끔 — 프롬프터</strong>
          <em>소리 없이 글만. 자동 진행은 속도에 맞춰 계속 넘어갑니다</em>
        </Choice>
      </Menu>

      <Menu id="voice" label="목소리" value={settings.gender === 'female' ? '여성' : '남성'}
            openId={openId} onOpen={open}>
        {(['female', 'male'] as Gender[]).map((g) => (
          <Choice key={g} on={settings.gender === g} onClick={() => { onChange({ gender: g }); open(null); }}>
            <strong>{g === 'female' ? '여성' : '남성'}</strong>
            <em>{resolveVoice(g, settings.tone).label}</em>
          </Choice>
        ))}
      </Menu>

      <Menu id="tone" label="톤" value={TONE_LABELS[settings.tone]} openId={openId} onOpen={open}>
        {TONES.map((t) => (
          <Choice key={t} on={settings.tone === t} onClick={() => { onChange({ tone: t }); open(null); }}>
            <strong>{TONE_LABELS[t]}</strong>
            <em>{resolveVoice(settings.gender, t).label} · {TONE_HINTS[t]}</em>
          </Choice>
        ))}
      </Menu>

      <Menu id="font" label="서체" value={settings.fontStyle === 'sans' ? '고딕' : '명조'}
            openId={openId} onOpen={open}>
        <Choice on={settings.fontStyle === 'sans'} onClick={() => { onChange({ fontStyle: 'sans' }); open(null); }}>
          <strong lang="zh-CN" style={{ fontFamily: "'PingFang SC', sans-serif" }}>고딕 黑体</strong>
          <em>PingFang SC · 화면용, 획이 선명</em>
        </Choice>
        <Choice on={settings.fontStyle === 'serif'} onClick={() => { onChange({ fontStyle: 'serif' }); open(null); }}>
          <strong lang="zh-CN" style={{ fontFamily: "'Songti SC', serif" }}>명조 宋体</strong>
          <em>Songti SC · 인쇄물 느낌</em>
        </Choice>
      </Menu>

      <Menu id="speed" label="속도" value={`${settings.rate.toFixed(2)}x`} openId={openId} onOpen={open} wide>
        <div className="pr-pop-row">
          <label>배속</label>
          <input type="range" min={0.5} max={1.5} step={0.05} value={settings.rate}
                 onChange={(e) => onChange({ rate: Number(e.target.value) })} />
          <span className="pr-pop-value">{settings.rate.toFixed(2)}x</span>
        </div>
        <div className="pr-pop-row">
          <label>음높이</label>
          <input type="range" min={-20} max={20} step={2} value={settings.pitchPct}
                 onChange={(e) => onChange({ pitchPct: Number(e.target.value) })} />
          <span className="pr-pop-value">{settings.pitchPct > 0 ? '+' : ''}{settings.pitchPct}%</span>
        </div>
        <p className="pr-pop-note">
          {settings.muted ? (
            <>넘어가는 속도 <strong>{Math.round(200 * settings.rate)}자/분</strong> (어림)</>
          ) : (
            <>실제 읽는 속도 <strong>{pace !== null ? `${pace}자/분` : '측정 중…'}</strong></>
          )}
          <br />단축키 <kbd>[</kbd> 느리게 · <kbd>]</kbd> 빠르게
        </p>
      </Menu>

      <Menu id="pinyin" label="병음" value={PINYIN_LABELS[settings.pinyinMode]} openId={openId} onOpen={open}>
        <Choice on={settings.pinyinMode === 'off'} onClick={() => { onChange({ pinyinMode: 'off' }); open(null); }}>
          <strong>끔</strong><em>한자만 보기</em>
        </Choice>
        <Choice on={settings.pinyinMode === 'above'} onClick={() => { onChange({ pinyinMode: 'above' }); open(null); }}>
          <strong>한자 위</strong><em>글자마다 성조를 얹어 표시</em>
        </Choice>
        <Choice on={settings.pinyinMode === 'below'} onClick={() => { onChange({ pinyinMode: 'below' }); open(null); }}>
          <strong>한자 아래</strong><em>글자마다 성조를 밑에 표시</em>
        </Choice>
      </Menu>

      <Menu id="text" label="글자" value={`${settings.fontSize}px`} openId={openId} onOpen={open} wide>
        <div className="pr-pop-row">
          <label>크기</label>
          <input type="range" min={24} max={160} step={4} value={settings.fontSize}
                 onChange={(e) => onChange({ fontSize: Number(e.target.value) })} />
          <span className="pr-pop-value">{settings.fontSize}px</span>
        </div>
        <div className="pr-pop-presets">
          {[44, 72, 100, 140].map((size) => (
            <button
              key={size}
              className={settings.fontSize === size ? 'is-on' : ''}
              onClick={() => onChange({ fontSize: size })}
            >
              {size}
            </button>
          ))}
        </div>
        <div className="pr-pop-row">
          <label>다음 문장</label>
          <input type="range" min={0} max={6} step={1} value={settings.contextAfter}
                 onChange={(e) => onChange({ contextAfter: Number(e.target.value) })} />
          <span className="pr-pop-value">{settings.contextAfter}개</span>
        </div>
        <div className="pr-pop-row">
          <label>이전 문장</label>
          <input type="range" min={0} max={4} step={1} value={settings.contextBefore}
                 onChange={(e) => onChange({ contextBefore: Number(e.target.value) })} />
          <span className="pr-pop-value">{settings.contextBefore}개</span>
        </div>
        <p className="pr-pop-note">
          단축키 <kbd>+</kbd> 크게 · <kbd>-</kbd> 작게
        </p>
      </Menu>

      <Menu id="more" label="더보기" value="진행·소스" openId={openId} onOpen={open} wide>
        <div className="pr-pop-row">
          <label>진행 간격</label>
          <input type="range" min={0} max={4000} step={100} value={settings.gapMs}
                 onChange={(e) => onChange({ gapMs: Number(e.target.value) })} />
          <span className="pr-pop-value">{(settings.gapMs / 1000).toFixed(1)}초</span>
        </div>

        <div className="pr-pop-modes">
          <span className="pr-pop-modes-label">무엇을 읽을지</span>
          {([
            ['chinese', '중국어만', '한국어·영어·병음을 모두 건너뜀'],
            ['chinese-english', '중국어 + 영어', '괄호 안은 버리고, 문장에 섞인 영어는 읽음'],
            ['raw', '원고 그대로', '거르지 않음'],
          ] as const).map(([mode, name, hint]) => (
            <Choice key={mode} on={settings.readMode === mode} onClick={() => onChange({ readMode: mode })}>
              <strong>{name}</strong><em>{hint}</em>
            </Choice>
          ))}
        </div>

        <div className="pr-pop-checks">
          <label className="pr-check">
            <input type="checkbox" checked={settings.autoAdvance}
                   onChange={(e) => onChange({ autoAdvance: e.target.checked })} />
            자동 진행
          </label>

          <label className="pr-check">
            <input type="checkbox" checked={settings.splitLongSentences}
                   onChange={(e) => onChange({ splitLongSentences: e.target.checked })} />
            긴 문장 쪼개기 ({settings.maxChars}자)
          </label>
          <label className="pr-check" title={edgeAvailable ? '' : 'Electron 앱에서만 온라인 음성을 쓸 수 있습니다'}>
            <input type="checkbox" checked={settings.engine === 'local'} disabled={!edgeAvailable}
                   onChange={(e) => onChange({ engine: e.target.checked ? 'local' : 'edge' })} />
            오프라인 전용 (기기 음성)
          </label>
        </div>

        <button
          className="pr-pop-reset"
          onClick={() => { onChange(DEFAULT_SETTINGS); open(null); }}
        >
          기본값으로 되돌리기
        </button>
      </Menu>

      <span className="pr-menubar-voice">{settings.muted ? '소리 꺼짐 — 프롬프터 모드' : preset.label}</span>
    </div>
  );
}
