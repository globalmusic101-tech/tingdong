import { useEffect, useRef, useState } from 'react';
import { readDocx } from './lib/readDocx';
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
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  /** 사용자가 원고를 눌러 위치를 정했는가 — 아니면 읽던 자리를 유지한다 */
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
        setError('워드 문서를 읽지 못했습니다. 손상되었거나 .doc(구버전) 형식일 수 있습니다.');
      }
      return;
    }

    if (!looksLikeText(file)) {
      const kind = file.name.split('.').pop()?.toUpperCase() ?? '이';
      setError(
        `${kind} 파일은 읽지 못합니다. 텍스트 파일(.txt·.md)이나 워드 문서(.docx)를 넣어주세요.`,
      );
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => setError('파일을 읽지 못했습니다.');
    reader.onload = () => {
      const content = String(reader.result ?? '');
      if (looksLikeBinary(content)) {
        setError('텍스트로 읽히지 않는 파일입니다. UTF-8 텍스트 파일인지 확인해주세요.');
        return;
      }
      onChange(content);
    };
    reader.readAsText(file, 'utf-8');
  };

  return (
    <div className="pr-input">
      <div className="pr-input-head">
        <h2>중국어 원고 붙여넣기</h2>
        <p>
          문장 부호(。！？)와 줄바꿈을 기준으로 문장을 나눕니다. 워드 문서(.docx)도 끌어다 놓을 수 있고,
          한국어·병음이 섞여 있으면 <strong>읽지 않고 건너뜁니다.</strong>
          원고를 눌러 커서를 두면 <strong>그 자리부터</strong> 읽습니다.
        </p>
      </div>

      <textarea
        ref={areaRef}
        className={`pr-textarea pr-font-sans${dragging ? ' is-dragging' : ''}`}
        lang="zh-CN"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onClick={() => { caretChosen.current = true; }}
        onKeyUp={() => { caretChosen.current = true; }}
        onSelect={() => { caretChosen.current = true; }}
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
          {text.length.toLocaleString()}자 · <strong>{sentenceCount}문장</strong>
          {readMode !== 'raw' && skippedLines > 0 && (
            <span className="pr-skipped" title="중국어가 없어 읽지 않는 줄입니다">
              · 건너뛴 줄 {skippedLines}
            </span>
          )}
          <select
            className="pr-count-select"
            value={readMode}
            onChange={(e) => onChangeReadMode(e.target.value as ReadMode)}
          >
            <option value="chinese">중국어만 읽기</option>
            <option value="chinese-english">중국어 + 영어 (괄호 제외)</option>
            <option value="raw">원고 그대로</option>
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
            파일 열기
          </button>
          <button
            className="pr-btn pr-btn-primary"
            onClick={() => onStart(caretChosen.current ? (areaRef.current?.selectionStart ?? null) : null)}
            disabled={sentenceCount === 0}
          >
            시작 →
          </button>
        </div>
      </div>
    </div>
  );
}
