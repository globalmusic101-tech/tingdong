import JSZip from 'jszip';

/**
 * .docx에서 문단 텍스트만 꺼낸다. 표·이미지·머리말은 무시한다 —
 * 낭독에 필요한 건 문단 순서와 줄바꿈뿐이다.
 */
export async function readDocx(file: File | Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  const document = zip.file('word/document.xml');
  if (!document) throw new Error('워드 문서의 본문을 찾지 못했습니다.');

  const xml = await document.async('string');

  const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];

  return paragraphs
    .map((paragraph) => {
      const runs = paragraph.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) ?? [];
      const text = runs
        .map((run) => run.replace(/<[^>]+>/g, ''))
        .join('');
      return unescapeXml(text).trim();
    })
    .join('\n');
}

function unescapeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');   // 앰퍼샌드는 마지막에 — 먼저 풀면 이중 이스케이프가 깨진다
}
