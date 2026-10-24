import { useEffect, useRef, useState } from 'react';
import { useLang } from '../lib/i18nContext';
import { type Bilingual, type GrammarItem, type VocabularyItem } from './lessons';
import type { WordReview } from './storage';
import { SentencePlayer } from '../prompter/lib/tts/player';
import { DEFAULT_SETTINGS } from '../prompter/lib/settings';

const LEARNING_VOICE_SETTINGS = { ...DEFAULT_SETTINGS, autoAdvance: false, gapMs: 0, pinyinMode: 'off' as const };

function useLearningAudio() {
  const playerRef = useRef<SentencePlayer | null>(null);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const player = new SentencePlayer({
      onStatus: () => {}, onEnded: () => setActive(null), onFallback: () => {}, onPace: () => {},
      onError: () => setActive(null),
    });
    playerRef.current = player;
    return () => { player.stop(); playerRef.current = null; };
  }, []);

  const play = (id: string, text: string) => {
    const player = playerRef.current;
    if (!player || !text) return;
    if (active === id) { player.stop(); setActive(null); return; }
    setActive(id);
    void player.play(text, LEARNING_VOICE_SETTINGS);
  };

  return { active, play };
}

function ListenButton({ id, text, active, onPlay }: { id: string; text: string; active: boolean; onPlay: (id: string, text: string) => void }) {
  const { t } = useLang();
  return <button type="button" className="bible-listen-text" aria-pressed={active} onClick={() => onPlay(id, text)}>
    {active ? t.bibleListeningText : t.bibleListenText}
  </button>;
}

export function BilingualMeaning({ meaning }: { meaning: Bilingual }) {
  const { t } = useLang();
  return <div className="bible-meanings">
    <div lang="ko"><span className="bible-language-label">{t.bibleKorean}</span><p>{meaning.ko}</p></div>
    <div lang="en"><span className="bible-language-label">{t.bibleEnglish}</span><p>{meaning.en}</p></div>
  </div>;
}

function WordCard({ item, review, active, onPlay, onReview }: { item: VocabularyItem; review?: WordReview;
  active: string | null; onPlay: (id: string, text: string) => void;
  onReview: (id: string, status: WordReview | undefined) => void }) {
  const { t } = useLang();
  const [visible, setVisible] = useState(true);
  return <section className="bible-learning-card bible-word-card" aria-label={item.word}>
    <header><div><h3 lang="zh-CN">{item.word}</h3><p className="bible-word-pinyin">{item.pinyin}</p></div>
      <ListenButton id={`${item.id}:word`} text={item.word} active={active === `${item.id}:word`} onPlay={onPlay} />
      <span className="bible-lesson-reference">{t.biblePassageRange(item.verse, item.verse)}</span></header>
    <p className="bible-context-label">{t.bibleContext}</p><div className="bible-audio-text"><blockquote lang="zh-CN">{item.quote}</blockquote>
      <ListenButton id={`${item.id}:quote`} text={item.quote} active={active === `${item.id}:quote`} onPlay={onPlay} /></div>
    {visible ? <BilingualMeaning meaning={item.meaning} /> : <p className="bible-answer-hidden">{t.bibleAnswerHidden}</p>}
    <div className="bible-word-actions"><button onClick={() => setVisible(v => !v)}>{visible ? t.bibleHideAnswer : t.bibleShowAnswer}</button>
      <button disabled={!visible} aria-pressed={review === 'known'} onClick={() => onReview(item.id, review === 'known' ? undefined : 'known')}>{t.bibleWordKnown}</button>
      <button disabled={!visible} aria-pressed={review === 'again'} onClick={() => onReview(item.id, review === 'again' ? undefined : 'again')}>{t.bibleWordAgain}</button>
    </div>
    <p className={`bible-review-state bible-review-${review ?? 'new'}`} role="status">
      {review === 'known' ? t.bibleWordKnownStatus : review === 'again' ? t.bibleWordAgainStatus : t.bibleWordUnmarked}
    </p>
  </section>;
}

export function VocabularyPanel({ items, reviews, onReview }: { items: VocabularyItem[];
  reviews: Record<string, WordReview>; onReview: (id: string, state: WordReview | undefined) => void }) {
  const { t } = useLang();
  const audio = useLearningAudio();
  const known = items.filter(item => reviews[item.id] === 'known').length;
  return <section className="bible-learning-panel" aria-label={t.bibleVocabularyTitle}>
    <header className="bible-learning-heading"><h3>{t.bibleVocabularyTitle}</h3><p>{t.bibleVocabularyHint}</p>
      <p className="bible-vocabulary-progress">{t.bibleWordProgress(known, items.length)}</p></header>
    {!items.length && <p>{t.bibleNoWords}</p>}
    <div className="bible-learning-cards">{items.map(item => <WordCard key={item.id} item={item} review={reviews[item.id]} active={audio.active} onPlay={audio.play} onReview={onReview} />)}</div>
  </section>;
}

export function GrammarPanel({ items }: { items: GrammarItem[] }) {
  const { t } = useLang();
  const audio = useLearningAudio();
  return <section className="bible-learning-panel" aria-label={t.bibleGrammarTitle}>
    <header className="bible-learning-heading"><h3>{t.bibleGrammarTitle}</h3><p>{t.bibleGrammarHint}</p></header>
    {!items.length && <p>{t.bibleNoGrammar}</p>}
    <div className="bible-learning-cards">{items.map(item => <section className="bible-learning-card bible-grammar-card" key={item.id}>
      <header><h3>{item.pattern}</h3><span className="bible-lesson-reference">{t.biblePassageRange(item.verse, item.verse)}</span></header>
      <p className="bible-context-label">{t.bibleContext}</p><div className="bible-audio-text"><blockquote lang="zh-CN">{item.quote}</blockquote>
        <ListenButton id={`${item.id}:quote`} text={item.quote} active={audio.active === `${item.id}:quote`} onPlay={audio.play} /></div>
      <p className="bible-context-label">{t.bibleBreakdown}</p><div className="bible-audio-text"><p className="bible-grammar-breakdown" lang="zh-CN">{item.breakdown}</p>
        <ListenButton id={`${item.id}:breakdown`} text={item.breakdown} active={audio.active === `${item.id}:breakdown`} onPlay={audio.play} /></div>
      <h4>{t.bibleExplanation}</h4><BilingualMeaning meaning={item.explanation} />
      <div className="bible-practice"><h4>{t.biblePracticeExample}</h4><div className="bible-audio-text"><p lang="zh-CN">{item.practice}</p>
        <ListenButton id={`${item.id}:practice`} text={item.practice} active={audio.active === `${item.id}:practice`} onPlay={audio.play} /></div><BilingualMeaning meaning={item.practiceMeaning} /></div>
    </section>)}</div>
  </section>;
}
