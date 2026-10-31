import { useEffect, useRef, useState } from 'react';
import { readDocx } from './lib/readDocx';
import { useLang } from '../lib/i18nContext';
import type { ReadMode } from './lib/extractChinese';

const TEXT_EXTENSIONS = ['.txt', '.md', '.markdown', '.text'];

function looksLikeText(file: File): boolean {
  if (file.type.startsWith('text/')) return true;
  const name = file.name.toLowerCase();
  return TEXT_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/**
 * 확장자가 맞아도 내용이 텍스트가 아닐 수 있다. 널 바이트나 깨진 문자가 많으면
 * 원고가 아니라 바이너리를 읽은 것이다 — 조용히 넣으면 엉터리 문장이 만들어진다.
 */
function looksLikeBinary(text: string): boolean {
  const sample = text.slice(0, 2000);
  if (sample.includes('\u0000')) return true;
  const broken = (sample.match(/\uFFFD/g) ?? []).length;
  return broken > sample.length * 0.02;
}

type Props = {
  text: string;
  sentenceCount: number;
  skippedLines: number;
  readMode: ReadMode;
  onChangeReadMode: (mode: ReadMode) => void;
  onChange: (text: string) => void;
  /** 커서를 놓아둔 곳이 있으면 그 위치를 함께 넘긴다 — 거기부터 읽기 시작한다 */
  onStart: (caret: number | null) => void;
  /** 읽던 문장이 원고의 어디였는지 — 돌아왔을 때 그 자리를 보여준다 */
  focusRange: { start: number; end: number } | null;
};

export function ScriptInput({
  text, sentenceCount, skippedLines, readMode,
  onChangeReadMode, onChange, onStart, focusRange,
}: Props) {
  const { t } = useLang();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  /** 사용자가 textarea를 직접 눌러 시작 위치를 정했는가 */
  const caretChosen = useRef(false);

  // 읽다가 돌아오면 그 문장을 골라 보여준다
  useEffect(() => {
    const area = areaRef.current;
    if (!area || !focusRange) return;

    area.focus();
    area.setSelectionRange(focusRange.start, focusRange.end);
    caretChosen.current = false;

    // 선택한 곳이 화면 밖일 수 있다. 줄바꿈만 세면 줄이 접힐 때 어긋나므로,
    // 그 지점까지의 내용만 잠깐 넣어 실제 높이를 재서 스크롤한다.
    const full = area.value;
    area.value = full.slice(0, focusRange.start);
    const offset = area.scrollHeight;
    area.value = full;
    area.setSelectionRange(focusRange.start, focusRange.end);
    area.scrollTop = Math.max(0, offset - area.clientHeight / 2);
  }, [focusRange]);

  const readFile = async (file: File) => {
    setError(null);

    if (file.name.toLowerCase().endsWith('.docx')) {
      try {
        onChange(await readDocx(file));
      } catch {
        setError(t.errDocx);
      }
      return;
    }

    if (!looksLikeText(file)) {
      const kind = file.name.split('.').pop()?.toUpperCase() ?? t.errUnknownKind;
      setError(t.errFileKind(kind));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => setError(t.errFileRead);
    reader.onload = () => {
      const content = String(reader.result ?? '');
      if (looksLikeBinary(content)) {
        setError(t.errNotText);
        return;
      }
      onChange(content);
    };
    reader.readAsText(file, 'utf-8');
  };

  return (
    <div className="pr-input">
      <div className="pr-input-head">
        <h2>{t.scriptHeading}</h2>
        <p>{t.scriptIntro}</p>
      </div>

      <textarea
        ref={areaRef}
        className={`pr-textarea pr-font-sans${dragging ? ' is-dragging' : ''}`}
        lang="zh-CN"
        value={text}
        onChange={(e) => {
          // 입력·붙여넣기로 생긴 마지막 caret은 시작 위치 선택으로 보지 않는다.
          caretChosen.current = false;
          onChange(e.target.value);
        }}
        onClick={() => { caretChosen.current = true; }}
        onPaste={() => { caretChosen.current = false; }}
        placeholder="大家好，很高兴见到大家！&#10;今天我想和大家一起聊聊这个话题。"
        spellCheck={false}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void readFile(file);
        }}
      />

      {error && <div className="pr-input-error">{error}</div>}

      <div className="pr-input-foot">
        <span className="pr-count">
          {t.scriptCount(text.length.toLocaleString(), sentenceCount)}
          {readMode !== 'raw' && skippedLines > 0 && (
            <span className="pr-skipped" title={t.scriptSkippedHint}>
              {' '}{t.scriptSkipped(skippedLines)}
            </span>
          )}
          <select
            className="pr-count-select"
            value={readMode}
            onChange={(e) => onChangeReadMode(e.target.value as ReadMode)}
          >
            <option value="chinese">{t.readModeChinese}</option>
            <option value="chinese-english">{t.readModeChineseEnglish}</option>
            <option value="raw">{t.readModeRaw}</option>
          </select>
        </span>
        <div className="pr-input-actions">
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.md,.docx,text/plain"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readFile(file);
              e.target.value = '';
            }}
          />
          <button className="pr-btn" onClick={() => inputRef.current?.click()}>
            {t.openFile}
          </button>
          <button
            className="pr-btn pr-btn-primary"
            onClick={() => onStart(caretChosen.current ? (areaRef.current?.selectionStart ?? null) : null)}
            disabled={sentenceCount === 0}
          >
            {t.start}
          </button>
        </div>
      </div>
    </div>
  );
}
