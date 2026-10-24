# -*- coding: utf-8 -*-
import json
import re
import sys
from pathlib import Path

CANON = ['GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO','ECC','SNG','ISA','JER','LAM','EZK','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL','MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL','EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM','HEB','JAS','1PE','2PE','1JN','2JN','3JN','JUD','REV']
SOURCE_MAP = {'MAR':'MRK','EZE':'EZK','JOE':'JOL','JOH':'JHN','JAM':'JAS','PHI':'PHP','SOL':'SNG','NAH':'NAM','1JO':'1JN','2JO':'2JN','3JO':'3JN'}

def clean(text):
    return re.sub(r'\s+', ' ', text or '').strip()

def parse(path):
    books = {}
    for line in Path(path).read_text(encoding='utf-8-sig').splitlines():
        parts = line.split(' ', 2)
        if len(parts) != 3 or ':' not in parts[1]:
            continue
        book_id, ref, text = parts
        book_id = SOURCE_MAP.get(book_id, book_id)
        if book_id not in CANON:
            continue
        chapter, verse = ref.split(':')
        books.setdefault(book_id, {}).setdefault(chapter, {})[verse] = clean(text)
    return books

if len(sys.argv) != 5:
    raise SystemExit('usage: build-full-bible-data.py cmn.txt kor.txt web.txt output.json')
zh, ko, en = (parse(Path(p)) for p in sys.argv[1:4])
names = {'GEN':'창세기','EXO':'출애굽기','LEV':'레위기','NUM':'민수기','DEU':'신명기','JOS':'여호수아','JDG':'사사기','RUT':'룻기','1SA':'사무엘상','2SA':'사무엘하','1KI':'열왕기상','2KI':'열왕기하','1CH':'역대상','2CH':'역대하','EZR':'에스라','NEH':'느헤미야','EST':'에스더','JOB':'욥기','PSA':'시편','PRO':'잠언','ECC':'전도서','SNG':'아가','ISA':'이사야','JER':'예레미야','LAM':'예레미야애가','EZK':'에스겔','DAN':'다니엘','HOS':'호세아','JOL':'요엘','AMO':'아모스','OBA':'오바댜','JON':'요나','MIC':'미가','NAM':'나훔','HAB':'하박국','ZEP':'스바냐','HAG':'학개','ZEC':'스가랴','MAL':'말라기','MAT':'마태복음','MRK':'마가복음','LUK':'누가복음','JHN':'요한복음','ACT':'사도행전','ROM':'로마서','1CO':'고린도전서','2CO':'고린도후서','GAL':'갈라디아서','EPH':'에베소서','PHP':'빌립보서','COL':'골로새서','1TH':'데살로니가전서','2TH':'데살로니가후서','1TI':'디모데전서','2TI':'디모데후서','TIT':'디도서','PHM':'빌레몬서','HEB':'히브리서','JAS':'야고보서','1PE':'베드로전서','2PE':'베드로후서','1JN':'요한일서','2JN':'요한이서','3JN':'요한삼서','JUD':'유다서','REV':'요한계시록'}
result = []
for book_id in CANON:
    chapters = []
    for number in sorted(set(zh.get(book_id, {})), key=int):
        verses = []
        for verse in sorted(zh[book_id][number], key=int):
            verses.append({'number': int(verse), 'zh': zh[book_id][number][verse], 'ko': ko.get(book_id, {}).get(number, {}).get(verse, ''), 'en': en.get(book_id, {}).get(number, {}).get(verse, '')})
        if verses:
            chapters.append({'chapter': int(number), 'verses': verses})
    result.append({'id': book_id, 'name': names[book_id], 'chapters': chapters})
Path(sys.argv[4]).write_text(json.dumps({'version': 'public-domain-66', 'books': result}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
