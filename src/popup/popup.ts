/**
 * ⌘⇧F 선택 텍스트 팝업.
 *
 * 번역은 전부 ../lib/translate 한 벌에 맡긴다 — 예전에는 이 창이 자기 번역 코드를
 * 따로 갖고 있어서, 번역기 탭만 고치면 팝업은 옛 방식 그대로 남았다.
 */
import { loadEngineConfig, lookupWord, type EngineConfig } from '../lib/translate';

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
    warningText.innerHTML = '⚠️ 클립보드 자동 복사에 실패했습니다. macOS의 \'시스템 설정 > 개인정보 보호 및 보안 > 손쉬운 사용(Accessibility)\'에서 이 앱(또는 실행 중인 터미널)의 권한이 켜져 있는지 확인해 주세요. (미허용 시 직접 <b>Cmd+C</b> 복사 후 단축키를 눌러야 작동합니다.)';
    if (grantBtn) grantBtn.style.display = 'inline-block';
    copyWarning.style.display = 'block';
  } else if (data.copyFailed) {
    warningText.innerHTML = '⚠️ 선택된 텍스트가 없습니다. 마우스 드래그로 텍스트를 선택한 후 단축키를 눌러주세요.';
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
  await runLookup(text, cfg);
});

async function runLookup(text: string, cfg: EngineConfig) {
  translationText.textContent = '번역 엔진 호출 중...';
  posTag.style.display = 'none';
  usageBox.style.display = 'none';

  try {
    const { result, engine, usedFallback, fallbackReason } = await lookupWord(text, cfg);

    engineBadge.textContent = usedFallback ? `⚠️ ${engine} 실패 → Google 무료` : `🟢 ${engine}`;
    engineBadge.title = usedFallback && fallbackReason ? fallbackReason : '';

    currentTranslation = result.translation || '';
    translationText.textContent = result.translation || '번역 정보 없음';

    if (result.partOfSpeech) {
      posTag.textContent = result.partOfSpeech;
      posTag.style.display = 'inline-block';
    }
    if (result.exampleChinese && result.exampleKorean) {
      exampleZh.textContent = result.exampleChinese;
      exampleKo.textContent = result.exampleKorean;
      usageBox.style.display = 'flex';
    }
  } catch (err) {
    // 실패를 '번역 정보 없음'처럼 흘리지 않는다 — 왜 안 됐는지 보여준다
    console.error('팝업 번역 실패:', err);
    engineBadge.textContent = '❌ 번역 실패';
    translationText.textContent = `번역을 가져오지 못했습니다 — ${(err as Error)?.message ?? err}`;
  }
  updateHeight();
}
