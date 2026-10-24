"""영어판에 한글이 남았는지 기계로 본다 (01-prd F11-4).

주석은 걷어낸다 — 소스 주석은 한국어로 두기로 했다. 남는 것은
문자열 리터럴과 JSX 텍스트뿐이고, 거기 한글이 있으면 그건 새는 자리다.
"""
import re, sys, pathlib

KO = re.compile(r'[가-힣]')

def strip_comments(src: str) -> str:
    src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)          # /* */ 와 JSDoc
    src = re.sub(r'\{/\*.*?\*/\}', '', src, flags=re.S)      # JSX 주석
    src = re.sub(r'(?<!:)//[^\n]*', '', src)                 # // (URL의 // 는 제외)
    src = re.sub(r'<!--.*?-->', '', src, flags=re.S)         # HTML 주석
    src = re.sub(r'console\.[a-z]+\(.*?\);', '', src, flags=re.S)  # 개발자용 로그(여러 줄 포함)
    return src

# 한글이 남아 있는 것이 옳은 자리. 이유 없이는 늘리지 않는다.
ALLOWED = {
    # 언어 선택기는 각 언어를 그 언어의 이름으로 보여준다 — 영어 화면에서도 '한국어'다
    ('src/AppShell.tsx', "{next === 'ko' ? '한국어' : 'English'}"),
    # Provider 없이 쓴 개발자를 향한 오류 — 사용자 화면에 닿지 않는다
    ('src/lib/i18nContext.tsx', "if (!value) throw new Error('useLang은 LangProvider 안에서만 쓸 수 있습니다');"),
}

def scan(path: pathlib.Path):
    body = strip_comments(path.read_text())
    return [(i + 1, l.strip()) for i, l in enumerate(body.splitlines()) if KO.search(l)]

FILES = [
    'src/bible/LearningPanels.tsx',
    'src/bible/BibleStudy.tsx', 'src/bible/model.ts', 'src/bible/playback.ts', 'src/bible/storage.ts',
    'src/App.tsx', 'src/AppShell.tsx', 'src/main.tsx', 'src/popup/popup.ts',
    'src/prompter/PrompterApp.tsx', 'src/prompter/PrompterView.tsx',
    'src/prompter/ScriptInput.tsx', 'src/prompter/MenuBar.tsx',
    'src/prompter/lib/tts/voiceMap.ts', 'src/prompter/lib/wordLookup.ts',
    'src/lib/translate.ts', 'src/lib/matchHighlight.ts', 'src/lib/i18nContext.tsx',
    'popup.html', 'index.html',
]

# F13 사용자 요청: lessons.ts의 한국어/영어 학습 자료는 양 언어에서 함께 보입니다.
# UI 문자열 예외를 늘리지 않고, 콘텐츠는 lessons.test.ts에서 양언어·출처·범위를 검사합니다.

total = 0
for name in FILES:
    p = pathlib.Path(name)
    if not p.exists():
        print(f"  ? {name} — 없음"); continue
    hits = [(n, txt) for n, txt in scan(p) if (name, txt) not in ALLOWED]
    total += len(hits)
    mark = '✅' if not hits else '❌'
    print(f"  {mark} {name}: {len(hits)}")
    for line, text in hits:
        print(f"       {line}: {text[:100]}")

# 영어 문자열표에는 한글이 한 글자도 없어야 한다
i18n = pathlib.Path('src/lib/i18n.ts').read_text()
en_block = strip_comments(i18n[i18n.index('const en = {'):i18n.index('export type Strings')])
en_hits = [l.strip() for l in en_block.splitlines() if KO.search(l)]
print(f"\n  {'✅' if not en_hits else '❌'} i18n.ts 영어 표: 한글 {len(en_hits)}건")
for l in en_hits: print(f"       {l[:100]}")

total += len(en_hits)
print(f"\n합계: {total}건" + (" — 통과" if total == 0 else " — 남아 있음"))
sys.exit(1 if total else 0)
