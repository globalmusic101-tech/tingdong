#!/usr/bin/env python3
"""Convert public CUV USFM section headings into the app's context catalog."""

import json
import re
from pathlib import Path

USFM_DIR = Path('/private/tmp/cmn-cu89s_usfm')
FULL_BIBLE = Path('src/bible/bible-full.json')
OUTPUT = Path('src/bible/context-headings.json')


def clean(text: str) -> str:
    text = re.sub(r'\\f .*?\\f\*', '', text)
    text = re.sub(r'\\[+*][^ ]*', '', text)
    text = re.sub(r'\\[a-z0-9]+\*?', '', text)
    return re.sub(r'\s+', ' ', text).strip()


def parse(path: Path, book_name: str) -> dict[str, list[dict[str, object]]]:
    chapters: dict[str, dict[str, object]] = {}
    current: dict[str, object] | None = None
    for raw in path.read_text(encoding='utf-8').splitlines():
        line = raw.strip()
        chapter_match = re.match(r'^\\c\s+(\d+)', line)
        if chapter_match:
            current = {'verses': [], 'headings': []}
            chapters[chapter_match.group(1)] = current
            continue
        if current is None:
            continue
        heading_match = re.match(r'^\\s1\s+(.+?)\s*$', line)
        if heading_match:
            current['headings'].append({'start': None, 'title': clean(heading_match.group(1))})
            continue
        verse_match = re.match(r'^\\v\s+(\d+)\s+(.+)', line)
        if verse_match:
            number = int(verse_match.group(1))
            current['verses'].append(number)
            if current['headings'] and current['headings'][-1]['start'] is None:
                current['headings'][-1]['start'] = number
    result: dict[str, list[dict[str, object]]] = {}
    for number, current in chapters.items():
        verses = current['verses']
        headings = [h for h in current['headings'] if h['start'] is not None]
        if not verses:
            continue
        if not headings:
            headings = [{'start': verses[0], 'title': f'{book_name} {number}장'}]
        entries = []
        for index, heading in enumerate(headings):
            end = headings[index + 1]['start'] - 1 if index + 1 < len(headings) else verses[-1]
            entries.append({'start': heading['start'], 'end': end, 'title': heading['title'], 'key': ''})
        result[number] = entries
    return result


def main() -> None:
    full = json.loads(FULL_BIBLE.read_text(encoding='utf-8'))
    books = {}
    for book in full['books']:
        source = next(USFM_DIR.glob(f'*-{book["id"]}cmn-cu89s.usfm'))
        catalog = parse(source, book['name'])
        for chapter in book['chapters']:
            numbers = [verse['number'] for verse in chapter['verses']]
            for heading in catalog[str(chapter['chapter'])]:
                starts = [number for number in numbers if number >= heading['start']]
                ends = [number for number in numbers if number <= heading['end']]
                heading['start'] = starts[0] if starts else numbers[-1]
                heading['end'] = ends[-1] if ends else heading['start']
        books[book['id']] = catalog
    OUTPUT.write_text(json.dumps({'version': 1, 'source': 'https://ebible.org/Scriptures/cmn-cu89s_usfm.zip', 'books': books}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'generated {sum(len(chapters) for chapters in books.values())} chapters')


if __name__ == '__main__':
    main()
