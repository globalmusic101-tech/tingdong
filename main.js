import {
  app, BrowserWindow, globalShortcut, clipboard,
  screen, Tray, Menu, ipcMain, nativeImage, systemPreferences, dialog
} from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { exec, spawn } from 'child_process';
import { pinyin } from 'pinyin-pro';
import { registerTtsBridge } from './electron/ttsBridge.js';
import { validateLocalKoreanBible } from './electron/localBible.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/**
 * 껍데기(창 제목·트레이)의 언어.
 *
 * 렌더러의 언어 컨텍스트는 여기까지 닿지 않는다. 대신 기기 로케일을 따른다 —
 * 트레이에 있는 것은 앱 이름 수준의 문구뿐이라 이 정도로 충분하고,
 * 렌더러에서 언어를 바꾸면 트레이는 다음 실행에 반영된다. (03-architecture §8)
 */
const shellStrings = () => {
  const ko = (app.getLocale() || '').toLowerCase().startsWith('ko');
  return ko
    ? {
        appTitle: '띵동 (听懂)',
        openTranslator: '📖 번역기 열기',
        popupHint: '⌘⇧F — 선택 텍스트 팝업 번역',
        quit: '종료',
      }
    : {
        appTitle: 'Tingdong (听懂)',
        openTranslator: '📖 Open translator',
        popupHint: '⌘⇧F — look up the selected text',
        quit: 'Quit',
      };
};

// 터미널이 종료되어 표준 출력 스트림이 닫힌 상태(EPIPE)에서 console 출력 시 발생하는 크래시 방지
process.on('uncaughtException', (err) => {
  if (err.code === 'EPIPE') return;
  console.error('Uncaught Exception:', err);
});

let mainWindow   = null;
let popupWindow  = null;
let tray         = null;
let isPopupPinned = false;
let isQuitting    = false;

const getSelectionSrcPath = path.join(__dirname, 'GetSelection.swift');
const getSelectionBinPath = path.join(__dirname, 'GetSelection');

function compileGetSelectionIfNeeded() {
  return new Promise((resolve) => {
    if (fs.existsSync(getSelectionBinPath)) {
      resolve(true);
      return;
    }
    
    console.log('[selection] Compiling GetSelection.swift...');
    exec(`swiftc -O "${getSelectionSrcPath}" -o "${getSelectionBinPath}"`, (err) => {
      if (err) {
        console.error('[selection] Compilation failed:', err);
        resolve(false);
      } else {
        console.log('[selection] Compilation successful.');
        resolve(true);
      }
    });
  });
}


// ── 메인 번역기 창 ──────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    title: shellStrings().appTitle,
    icon: path.join(__dirname, 'icon.icns'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  // 문서의 <title>이 창 제목을 덮어쓰지 못하게 한다 — 앱 이름은 여기서 정한다
  mainWindow.on('page-title-updated', (e) => {
    e.preventDefault();
    mainWindow.setTitle(shellStrings().appTitle);
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // 창을 닫아도 트레이에서 계속 실행 (단, 완전히 앱을 종료하는 중이 아닐 때만)
  mainWindow.on('close', (e) => {
    if (!isQuitting && tray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// ── 팝업 번역 창 ────────────────────────────────────────────────
function createPopupWindow() {
  popupWindow = new BrowserWindow({
    width: 420,
    height: 90,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    popupWindow.loadURL('http://localhost:5173/popup.html');
  } else {
    popupWindow.loadFile(path.join(__dirname, 'dist/popup.html'));
  }

  // 포커스 잃으면 숨김 (고정 모드가 아닐 때)
  popupWindow.on('blur', () => {
    if (!isPopupPinned) {
      popupWindow.hide();
    }
  });
}

// ── 시스템 트레이 ────────────────────────────────────────────────
function createTray() {
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(path.join(__dirname, 'icon.icns'));
    trayIcon = trayIcon.resize({ width: 18, height: 18 });
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: shellStrings().openTranslator,
      click: () => { mainWindow?.show(); mainWindow?.focus(); },
    },
    { type: 'separator' },
    { label: shellStrings().popupHint, enabled: false },
    { type: 'separator' },
    {
      label: shellStrings().quit,
      click: () => { tray = null; app.quit(); },
    },
  ]);

  tray.setToolTip(shellStrings().appTitle);
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

// 번역기 탭이 마지막으로 알려준 엔진 설정. 팝업 창은 localStorage를 공유하지
// 못하므로, 여기에 받아 두었다가 팝업을 띄울 때 같이 넘겨준다.
let engineConfig = null;

// ── 팝업 번역 표시 공통 함수 ──────────────────────────────
function displayPopupWithText(selectedText, copySuccess = true) {
  if (!popupWindow) return;

  // 커서 위치 기준으로 팝업 위치 계산
  const cursorPos = screen.getCursorScreenPoint();
  const display   = screen.getDisplayNearestPoint(cursorPos);
  const pw = 420, ph = 340;

  let x = cursorPos.x + 14;
  let y = cursorPos.y + 22;

  if (x + pw > display.bounds.x + display.bounds.width)  x = cursorPos.x - pw - 14;
  if (y + ph > display.bounds.y + display.bounds.height) y = cursorPos.y - ph - 14;
  x = Math.max(display.bounds.x + 4, x);
  y = Math.max(display.bounds.y + 4, y);

  isPopupPinned = false;
  popupWindow.setBounds({ x, y, width: pw, height: 90 });
  popupWindow.show();
  popupWindow.focus();

  // 병음을 메인 프로세스(Node 영역)에서 변환해서 넘김
  const computedPinyin = pinyin(selectedText, { toneType: 'symbol' });
  
  const isMac = process.platform === 'darwin';
  const isTrusted = isMac ? systemPreferences.isTrustedAccessibilityClient(false) : true;

  popupWindow.webContents.send('translate-text', {
    text: selectedText,
    pinyin: computedPinyin,
    copyFailed: !copySuccess,
    isAccessibilityTrusted: isTrusted,
    engine: engineConfig
  });
}

// ── 팝업 번역 실행 (단축키용) ───────────────────────────────────
async function showTranslationPopup() {
  // 1. GetSelection swift 유틸을 통해 활성 윈도우의 드래그된 선택 단어 추출 시도
  let selectedText = '';
  try {
    selectedText = await new Promise((resolve) => {
      exec(`"${getSelectionBinPath}"`, (err, stdout) => {
        if (err) resolve('');
        else resolve(stdout.trim());
      });
    });
  } catch (e) {
    console.error('[selection] GetSelection execution failed:', e);
  }

  let copySuccess = true;

  // 2. 만약 Accessibility API를 통한 텍스트 추출이 실패했거나 없는 경우, 기존 클립보드 복사 시뮬레이션 폴백
  if (!selectedText) {
    await new Promise((r) => setTimeout(r, 150));
    const previousClipboard = clipboard.readText();
    clipboard.clear();

    await new Promise((resolve) => {
      exec(
        `osascript -e 'tell app "System Events" to keystroke "c" using {command down}'`,
        () => resolve()
      );
    });

    await new Promise((r) => setTimeout(r, 250));
    selectedText = clipboard.readText().trim();

    if (!selectedText) {
      copySuccess = false;
      clipboard.writeText(previousClipboard);
      selectedText = previousClipboard.trim();
    } else {
      setTimeout(() => {
        if (clipboard.readText().trim() === selectedText) {
          clipboard.writeText(previousClipboard);
        }
      }, 3000);
    }
  }

  if (!selectedText) {
    return;
  }

  displayPopupWithText(selectedText, copySuccess);
}

// ── IPC 핸들러 ──────────────────────────────────────────────────

ipcMain.on('close-popup', () => {
  isPopupPinned = false;
  popupWindow?.hide();
});

ipcMain.on('pin-popup', (_, pinned) => {
  isPopupPinned = pinned;
});

ipcMain.on('resize-popup', (_, height) => {
  if (popupWindow) {
    const b = popupWindow.getBounds();
    const newH = Math.max(90, Math.min(height, 480));
    popupWindow.setBounds({ ...b, height: newH });
  }
});

ipcMain.on('sync-engine-config', (_, cfg) => {
  engineConfig = cfg;
});

ipcMain.on('request-accessibility', () => {
  if (process.platform === 'darwin') {
    systemPreferences.isTrustedAccessibilityClient(true);
  }
});

function localKoreanBiblePath() {
  return path.join(app.getPath('userData'), 'private-bible', 'saehangul-mark1.json');
}

function readLocalKoreanBible() {
  try {
    const file = localKoreanBiblePath();
    if (!fs.existsSync(file)) return { ok: false, code: 'not-found' };
    const result = validateLocalKoreanBible(JSON.parse(fs.readFileSync(file, 'utf8')));
    return result.ok ? result : { ok: false, code: 'invalid', error: result.error };
  } catch { return { ok: false, code: 'invalid', error: 'Unable to read the local Bible file' }; }
}

ipcMain.handle('bible:load-local-korean', () => readLocalKoreanBible());
ipcMain.handle('bible:import-local-korean', async () => {
  const picked = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'], filters: [{ name: 'Tingdong Bible JSON', extensions: ['json'] }],
  });
  if (picked.canceled || !picked.filePaths[0]) return { ok: false, code: 'cancelled' };
  try {
    const result = validateLocalKoreanBible(JSON.parse(fs.readFileSync(picked.filePaths[0], 'utf8')));
    if (!result.ok) return { ok: false, code: 'invalid', error: result.error };
    const dir = path.dirname(localKoreanBiblePath());
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const temporary = `${localKoreanBiblePath()}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(result.data), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporary, localKoreanBiblePath());
    return result;
  } catch { return { ok: false, code: 'invalid', error: 'The selected file is not valid JSON' }; }
});

// ── 앱 초기화 ───────────────────────────────────────────────────
app.whenReady().then(async () => {
  registerTtsBridge(ipcMain);

  createWindow();
  createPopupWindow();
  createTray();

  await compileGetSelectionIfNeeded();

  const ok = globalShortcut.register('CommandOrControl+Shift+F', showTranslationPopup);
  if (!ok) console.error('[popup] 전역 단축키 등록 실패! 다른 앱이 사용 중일 수 있습니다.');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().every(w => !w.isVisible())) {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  // macOS: 트레이가 있으면 종료하지 않음
  if (process.platform !== 'darwin' || !tray) {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('before-quit', () => {
  isQuitting = true;
});
