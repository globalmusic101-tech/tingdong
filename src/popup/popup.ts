/**
 * ⌘⇧F 선택 텍스트 팝업.
 *
 * 번역은 전부 ../lib/translate 한 벌에 맡긴다 — 예전에는 이 창이 자기 번역 코드를
 * 따로 갖고 있어서, 번역기 탭만 고치면 팝업은 옛 방식 그대로 남았다.
 */
import { loadEngineConfig, lookupWord, type EngineConfig } from '../lib/translate';
import { loadUiLang, stringsFor } from '../lib/i18n';

/**
 * 팝업은 React 트리 밖이라 컨텍스트가 닿지 않는다 — 언어를 직접 읽는다.
 * 창이 뜰 때 한 번 고르고, 그 창이 사는 동안은 바뀌지 않는다.
 */
let t = stringsFor(loadUiLang());

const $ = (id: string) => document.getElementById(id)!;

const chineseText = $('chinese-text');
const pinyinText = $('pinyin-text');
const translationText = $('translation-text');
const posTag = $('pos-tag');
const usageBox = $('usage-box');
const exampleZh = $('example-zh');
const exampleKo = $('example-ko');
const engineBadge = $('engine-badge');

const speakBtn = $('speak-btn');
const copyBtn = $('copy-btn');
const pinBtn = $('pin-btn');
const closeBtn = $('close-btn');
const fullContent = $('full-content');
const copyWarning = $('copy-warning');
const warningText = $('warning-text');
const grantBtn = document.getElementById('grant-btn');

let currentText = '';
let currentTranslation = '';
let isPinned = false;

// ESC 닫기
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.electronAPI?.closePopup();
});

closeBtn.addEventListener('click', () => window.electronAPI?.closePopup());

pinBtn.addEventListener('click', () => {
  isPinned = !isPinned;
  pinBtn.classList.toggle('active', isPinned);
  window.electronAPI?.setPinned(isPinned);
});

speakBtn.addEventListener('click', () => {
  if (!currentText || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(currentText);
  utterance.lang = 'zh-CN';
  window.speechSynthesis.speak(utterance);
});

copyBtn.addEventListener('click', async () => {
  if (!currentText) return;
  try {
    await navigator.clipboard.writeText(`${currentText} [${pinyinText.textContent}] ${currentTranslation}`);
    const original = copyBtn.textContent;
    copyBtn.textContent = '✅';
    setTimeout(() => { copyBtn.textContent = original; }, 1000);
  } catch (err) {
    console.error('Copy failed:', err);
  }
});

grantBtn?.addEventListener('click', () => window.electronAPI?.requestAccessibility?.());

function updateHeight() {
  // 렌더링 완료 후 실제 카드의 전체 스크롤 영역에 맞춰 윈도우 크기를 동적으로 최적화
  setTimeout(() => {
    const card = document.querySelector('.card');
    if (card) window.electronAPI?.resize(card.scrollHeight + 8);
  }, 50);
}

window.electronAPI?.onTranslateText(async (data) => {
  const text = data.text;
  const isAccessibilityTrusted = data.isAccessibilityTrusted !== false;

  currentText = text;
  currentTranslation = '';
  chineseText.textContent = text;
  pinyinText.textContent = data.pinyin;

  if (!isAccessibilityTrusted) {
    warningText.innerHTML = t.popupWarnAccessibility;
    if (grantBtn) grantBtn.style.display = 'inline-block';
    copyWarning.style.display = 'block';
  } else if (data.copyFailed) {
    warningText.innerHTML = t.popupWarnNoSelection;
    if (grantBtn) grantBtn.style.display = 'none';
    copyWarning.style.display = 'block';
  } else {
    copyWarning.style.display = 'none';
  }

  // 초기 크기 (헤더만 노출)
  fullContent.style.display = 'none';
  window.electronAPI?.resize(90);
  fullContent.style.display = 'block';

  // 번역기 탭이 넘겨준 설정을 우선 쓴다. 창이 따로라 localStorage는 비어 있을 수 있다.
  const cfg: EngineConfig = data.engine ?? loadEngineConfig();
  // 본창이 언어를 함께 보냈으면 그쪽이 옳다 — 팝업의 문구도 그 언어로 맞춘다
  t = stringsFor(cfg.lang);
  applyStaticLabels();
  await runLookup(text, cfg);
});

/** 문서에 박혀 있는 라벨들을 지금 언어로 갈아끼운다 */
function applyStaticLabels() {
  speakBtn.title = t.popupSpeak;
  copyBtn.title = t.popupCopy;
  pinBtn.title = t.popupPin;
  closeBtn.title = t.popupClose;
  if (grantBtn) grantBtn.textContent = t.popupGrantBtn;
  $('dismiss-hint').textContent = t.popupDismissHint;
}

applyStaticLabels();

async function runLookup(text: string, cfg: EngineConfig) {
  translationText.textContent = t.popupCallingEngine;
  posTag.style.display = 'none';
  usageBox.style.display = 'none';

  try {
    const { result, engine, usedFallback, fallbackReason } = await lookupWord(text, cfg);

    engineBadge.textContent = usedFallback ? t.popupEngineFallback(engine) : `🟢 ${engine}`;
    engineBadge.title = usedFallback && fallbackReason ? fallbackReason : '';

    currentTranslation = result.translation || '';
    translationText.textContent = result.translation || t.popupNoTranslation;

    if (result.partOfSpeech) {
      posTag.textContent = result.partOfSpeech;
      posTag.style.display = 'inline-block';
    }
    if (result.exampleChinese && result.exampleTranslation) {
      exampleZh.textContent = result.exampleChinese;
      exampleKo.textContent = result.exampleTranslation;
      usageBox.style.display = 'flex';
    }
  } catch (err) {
    // 실패를 '번역 정보 없음'처럼 흘리지 않는다 — 왜 안 됐는지 보여준다
    console.error('팝업 번역 실패:', err);
    engineBadge.textContent = t.popupFailedBadge;
    translationText.textContent = t.popupFetchFailed(String((err as Error)?.message ?? err));
  }
  updateHeight();
}
