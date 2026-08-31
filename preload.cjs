const { contextBridge, ipcRenderer } = require('electron');

// 읽기 연습 모드: 문장 낭독을 메인 프로세스에 위임한다
contextBridge.exposeInMainWorld('tts', {
  synth: (params) => ipcRenderer.invoke('tts:synth', params),
});

contextBridge.exposeInMainWorld('electronAPI', {
  getPinyin: (text) => '', // 메인 프로세스에서 변환 후 같이 보내주므로 빈 헬퍼 처리
  onTranslateText: (callback) => ipcRenderer.on('translate-text', (_event, value) => callback(value)),
  closePopup: () => ipcRenderer.send('close-popup'),
  setPinned: (pinned) => ipcRenderer.send('pin-popup', pinned),
  resize: (height) => ipcRenderer.send('resize-popup', height),
  requestAccessibility: () => ipcRenderer.send('request-accessibility'),
  // 설정 정보 읽기/쓰기를 위한 localStorage 연동
  getStorageItem: (key) => {
    return new Promise((resolve) => {
      // 팝업 창 내 로컬 스토리지는 격리되어 있으므로, 
      // 메인 창의 스토리지 대신 세션 정보나 기본 키 관리를 위한 헬퍼로 사용
      resolve(localStorage.getItem(key));
    });
  },
  setStorageItem: (key, value) => {
    localStorage.setItem(key, value);
  }
});
