"""보존한 eBible HTML에서 시범 본문을 추출합니다. --check는 JSON과 원문을 대조합니다."""
import json, re, sys
from html.parser import HTMLParser
from pathlib import Path

class BibleParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.verses = []
        self.headings = []
        self.current = None
        self.stack = []
        self.skip = 0
        self.heading = None
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = a.get('class', '')
        suppress = self.skip > 0 or cls in ('notemark','r','tnav','footnote','copyright')
        if tag not in ('meta', 'link', 'hr', 'br', 'img'):
            self.stack.append((tag, suppress))
            if suppress: self.skip += 1
        if suppress: return
        if cls == 's':
            self.current = None
            self.heading = {'start': len(self.verses)+1, 'title': ''}
            self.headings.append(self.heading)
        if cls == 'verse':
            self.heading = None
            self.current = {'number': int(a['id'][1:]), 'text': ''}
            self.verses.append(self.current)
    def handle_endtag(self, tag):
        if self.stack and self.stack[-1][0] == tag:
            _, suppressed = self.stack.pop()
            if suppressed: self.skip -= 1
        if tag == 'div': self.heading = None
    def handle_data(self, data):
        if self.skip: return
        if self.heading is not None:
            self.heading['title'] += data
        elif self.current is not None and not any(t == 'span' and not s for t,s in self.stack[-1:] if re.fullmatch(r'\d+\s*', data)):
            # 절 번호 span은 숫자만 담으므로 본문과 분리합니다.
            if self.stack and self.stack[-1][0] == 'span' and re.fullmatch(r'\d+\s*', data): return
            self.current['text'] += data

p = BibleParser()
p.feed(Path('docs/sources/cmn-cu89s-MRK01.html').read_text(encoding='utf-8-sig'))
for verse in p.verses: verse['text'] = re.sub(r'\s+', '', verse['text'])
for i,h in enumerate(p.headings):
    h['title'] = h['title'].strip()
    h['end'] = p.headings[i+1]['start']-1 if i+1 < len(p.headings) else len(p.verses)
    h['key'] = f'bibleHeading{i+1}'
assert [v['number'] for v in p.verses] == list(range(1,46))
assert [(h['start'],h['end']) for h in p.headings] == [(1,8),(9,11),(12,13),(14,15),(16,20),(21,28),(29,34),(35,39),(40,45)]
assert all(v['text'] and not re.search(r'[A-Za-z\d]',v['text']) for v in p.verses)
assert '有古卷' not in ''.join(v['text'] for v in p.verses)
result = {'version':'cmn-cu89s','book':'MRK','chapter':1,'source':'https://ebible.org/cmn-cu89s/MRK01.htm','verses':p.verses,'headings':p.headings}
out = Path('src/bible/mark1.json')
if '--check' in sys.argv:
    assert json.loads(out.read_text()) == result, 'Source content mismatch'
    print('Source match: 45 verses / 9 headings; no footnotes or cross-references')
else:
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    print('Imported 45 verses / 9 headings')
