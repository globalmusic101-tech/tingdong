import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, type PrompterSettings } from './lib/settings';
import { resolveVoice, type Gender, type Tone } from './lib/tts/voiceMap';
import { useLang } from '../lib/i18nContext';
import type { Strings } from '../lib/i18n';

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

const pinyinLabels = (t: Strings): Record<PrompterSettings['pinyinMode'], string> => ({
  off: t.pinyinOff,
  above: t.pinyinAbove,
  below: t.pinyinBelow,
});

const toneLabels = (t: Strings): Record<Tone, string> => ({
  sermon: t.toneSermon,
  news: t.toneNews,
  chat: t.toneChat,
});

const toneHints = (t: Strings): Record<Tone, string> => ({
  sermon: t.toneHintSermon,
  news: t.toneHintNews,
  chat: t.toneHintChat,
});

export function MenuBar({ settings, onChange, edgeAvailable, pace, onOpenChange }: Props) {
  const { t } = useLang();
  const PINYIN_LABELS = pinyinLabels(t);
  const TONE_LABELS = toneLabels(t);
  const TONE_HINTS = toneHints(t);
  const [openId, setOpenId] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  /** `云健 (열정적)` — 이름은 그대로, 설명만 화면 언어를 따른다 */
  const voiceName = (preset: { voiceId: string; label: string }) => {
    const blurb = t.voiceBlurbs[preset.voiceId];
    return blurb ? `${preset.label} (${blurb})` : preset.label;
  };

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
      <Menu id="sound" label={t.menuSound} value={settings.muted ? t.off : t.on} openId={openId} onOpen={open}>
        <Choice on={!settings.muted} onClick={() => { onChange({ muted: false }); open(null); }}>
          <strong>{t.on}</strong><em>{t.soundOnHint}</em>
        </Choice>
        <Choice on={settings.muted} onClick={() => { onChange({ muted: true }); open(null); }}>
          <strong>{t.soundOffTitle}</strong>
          <em>{t.soundOffHint}</em>
        </Choice>
      </Menu>

      <Menu id="voice" label={t.menuVoice} value={settings.gender === 'female' ? t.voiceFemale : t.voiceMale}
            openId={openId} onOpen={open}>
        {(['female', 'male'] as Gender[]).map((g) => (
          <Choice key={g} on={settings.gender === g} onClick={() => { onChange({ gender: g }); open(null); }}>
            <strong>{g === 'female' ? t.voiceFemale : t.voiceMale}</strong>
            <em>{voiceName(resolveVoice(g, settings.tone))}</em>
          </Choice>
        ))}
      </Menu>

      <Menu id="tone" label={t.menuTone} value={TONE_LABELS[settings.tone]} openId={openId} onOpen={open}>
        {TONES.map((tone) => (
          <Choice key={tone} on={settings.tone === tone} onClick={() => { onChange({ tone }); open(null); }}>
            <strong>{TONE_LABELS[tone]}</strong>
            <em>{voiceName(resolveVoice(settings.gender, tone))} · {TONE_HINTS[tone]}</em>
          </Choice>
        ))}
      </Menu>

      <Menu id="font" label={t.menuFont} value={settings.fontStyle === 'sans' ? t.fontSans : t.fontSerif}
            openId={openId} onOpen={open}>
        <Choice on={settings.fontStyle === 'sans'} onClick={() => { onChange({ fontStyle: 'sans' }); open(null); }}>
          <strong lang="zh-CN" style={{ fontFamily: "'PingFang SC', sans-serif" }}>{t.fontSans} 黑体</strong>
          <em>{t.fontSansHint}</em>
        </Choice>
        <Choice on={settings.fontStyle === 'serif'} onClick={() => { onChange({ fontStyle: 'serif' }); open(null); }}>
          <strong lang="zh-CN" style={{ fontFamily: "'Songti SC', serif" }}>{t.fontSerif} 宋体</strong>
          <em>{t.fontSerifHint}</em>
        </Choice>
      </Menu>

      <Menu id="speed" label={t.menuSpeed} value={`${settings.rate.toFixed(2)}x`} openId={openId} onOpen={open} wide>
        <div className="pr-pop-row">
          <label>{t.speedRate}</label>
          <input type="range" min={0.5} max={1.5} step={0.05} value={settings.rate}
                 onChange={(e) => onChange({ rate: Number(e.target.value) })} />
          <span className="pr-pop-value">{settings.rate.toFixed(2)}x</span>
        </div>
        <div className="pr-pop-row">
          <label>{t.speedPitch}</label>
          <input type="range" min={-20} max={20} step={2} value={settings.pitchPct}
                 onChange={(e) => onChange({ pitchPct: Number(e.target.value) })} />
          <span className="pr-pop-value">{settings.pitchPct > 0 ? '+' : ''}{settings.pitchPct}%</span>
        </div>
        <p className="pr-pop-note">
          {settings.muted ? (
            <>{t.speedNoteMuted(Math.round(200 * settings.rate))}</>
          ) : (
            <>{t.speedNoteLive} <strong>{pace !== null ? t.paceUnit(pace) : t.paceMeasuring}</strong></>
          )}
          <br />{t.shortcut} <kbd>[</kbd> {t.speedKeysSlow} <kbd>]</kbd> {t.speedKeysFast}
        </p>
      </Menu>

      <Menu id="pinyin" label={t.menuPinyin} value={PINYIN_LABELS[settings.pinyinMode]} openId={openId} onOpen={open}>
        <Choice on={settings.pinyinMode === 'off'} onClick={() => { onChange({ pinyinMode: 'off' }); open(null); }}>
          <strong>{t.pinyinOff}</strong><em>{t.pinyinOffHint}</em>
        </Choice>
        <Choice on={settings.pinyinMode === 'above'} onClick={() => { onChange({ pinyinMode: 'above' }); open(null); }}>
          <strong>{t.pinyinAbove}</strong><em>{t.pinyinAboveHint}</em>
        </Choice>
        <Choice on={settings.pinyinMode === 'below'} onClick={() => { onChange({ pinyinMode: 'below' }); open(null); }}>
          <strong>{t.pinyinBelow}</strong><em>{t.pinyinBelowHint}</em>
        </Choice>
      </Menu>

      <Menu id="text" label={t.menuText} value={`${settings.fontSize}px`} openId={openId} onOpen={open} wide>
        <div className="pr-pop-row">
          <label>{t.textSize}</label>
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
          <label>{t.textNextLines}</label>
          <input type="range" min={0} max={6} step={1} value={settings.contextAfter}
                 onChange={(e) => onChange({ contextAfter: Number(e.target.value) })} />
          <span className="pr-pop-value">{t.textCountUnit(settings.contextAfter)}</span>
        </div>
        <div className="pr-pop-row">
          <label>{t.textPrevLines}</label>
          <input type="range" min={0} max={4} step={1} value={settings.contextBefore}
                 onChange={(e) => onChange({ contextBefore: Number(e.target.value) })} />
          <span className="pr-pop-value">{t.textCountUnit(settings.contextBefore)}</span>
        </div>
        <p className="pr-pop-note">
          {t.shortcut} <kbd>+</kbd> {t.textKeysBig} <kbd>-</kbd> {t.textKeysSmall}
        </p>
      </Menu>

      <Menu id="more" label={t.menuMore} value={t.menuMoreValue} openId={openId} onOpen={open} wide>
        <div className="pr-pop-row">
          <label>{t.moreGap}</label>
          <input type="range" min={0} max={4000} step={100} value={settings.gapMs}
                 onChange={(e) => onChange({ gapMs: Number(e.target.value) })} />
          <span className="pr-pop-value">{t.moreGapUnit((settings.gapMs / 1000).toFixed(1))}</span>
        </div>

        <div className="pr-pop-modes">
          <span className="pr-pop-modes-label">{t.moreReadWhat}</span>
          {([
            ['chinese', t.readModeChinese, t.readModeChineseHint],
            ['chinese-english', t.readModeChineseEnglish, t.readModeChineseEnglishHint],
            ['raw', t.readModeRaw, t.readModeRawHint],
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
            {t.moreAutoAdvance}
          </label>

          <label className="pr-check">
            <input type="checkbox" checked={settings.splitLongSentences}
                   onChange={(e) => onChange({ splitLongSentences: e.target.checked })} />
            {t.moreSplitLong(settings.maxChars)}
          </label>
          <label className="pr-check" title={edgeAvailable ? '' : t.moreOfflineHint}>
            <input type="checkbox" checked={settings.engine === 'local'} disabled={!edgeAvailable}
                   onChange={(e) => onChange({ engine: e.target.checked ? 'local' : 'edge' })} />
            {t.moreOffline}
          </label>
        </div>

        <button
          className="pr-pop-reset"
          onClick={() => { onChange(DEFAULT_SETTINGS); open(null); }}
        >
          {t.moreReset}
        </button>
      </Menu>

      <span className="pr-menubar-voice">{settings.muted ? t.menubarMuted : voiceName(preset)}</span>
    </div>
  );
}
