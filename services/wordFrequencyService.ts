// 頻出単語分析サービス
// H2/H3タグから単語を抽出してカウント

import type { ArticleAnalysis, FrequencyWord } from '../types';
import kuromoji from 'kuromoji';

// Kuromojiのトークナイザーをグローバルに保持
let tokenizer: any = null;
let tokenizerPromise: Promise<any> | null = null;

// トークナイザーの初期化
function initializeTokenizer(): Promise<any> {
  if (tokenizer) return Promise.resolve(tokenizer);
  if (tokenizerPromise) return tokenizerPromise;
  
  // Kuromojiは辞書ファイルが必要だが、現在は配置されていないため
  // 常にフォールバック処理を使用する
  console.log('Using fallback word extraction (Kuromoji disabled due to missing dictionary)');
  tokenizerPromise = Promise.resolve(null);
  
  return tokenizerPromise;
}

// ストップワード（無視する単語）- 助詞や一般的な動詞など
const STOP_WORDS = new Set([
  // 助詞
  'の', 'に', 'は', 'を', 'が', 'で', 'と', 'や', 'から', 'まで', 
  'も', 'て', 'し', 'へ', 'より', 'ば', 'ので', 'のに', 'けど',
  'けれど', 'だけ', 'しか', 'ほど', 'くらい', 'など', 'なり',
  'だの', 'とか', 'たり', 'ながら', 'つつ', 'ても', 'でも',
  // 助動詞・接尾辞
  'です', 'ます', 'でしょう', 'だ', 'だった', 'である', 'ございます',
  'れる', 'られる', 'せる', 'させる', 'たい', 'ない', 'ぬ', 'ん',
  // 代名詞
  'これ', 'それ', 'あれ', 'この', 'その', 'あの', 'こちら', 'そちら',
  'あちら', 'ここ', 'そこ', 'あそこ', 'どこ', 'どれ', 'どの',
  // 一般動詞
  'する', 'ある', 'いる', 'なる', 'できる', 'おる', 'くる', 'いく',
  'みる', 'よる', 'おく', 'いう', 'きく', 'もつ', 'とる', 'わかる',
  // 形式名詞
  'こと', 'もの', 'ため', 'よう', 'さ', 'み', 'わけ', 'はず',
  // 接続詞
  'また', 'および', 'または', 'ただし', 'しかし', 'そして', 'それで',
  'だから', 'けれども', 'ところが', 'なお', 'ちなみに', 'さて',
  // 副詞
  'もう', 'まだ', 'ずっと', 'すぐ', 'やはり', 'やっぱり', 'とても',
  'あまり', 'ほとんど', 'だいたい', 'かなり', 'けっこう', 'もっと',
  // その他
  'ください', 'という', 'といった', 'について', 'による', 'により',
  'において', 'における', 'に関する', 'に対する', 'に対して',
  // 数字・記号
  '１', '２', '３', '４', '５', '６', '７', '８', '９', '０',
  '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
  '、', '。', '！', '？', '（', '）', '「', '」', '『', '』'
]);

// 意味のある品詞のみを抽出
const VALID_POS = new Set([
  '名詞',        // 名詞全般
  '動詞',        // 動詞（ただし一般的すぎるものは除外）
  '形容詞',      // 形容詞
  '副詞',        // 副詞（ただし一般的すぎるものは除外）
]);

// より詳細な品詞フィルタ
const VALID_POS_DETAIL = new Set([
  '一般',        // 一般名詞
  '固有名詞',    // 固有名詞
  'サ変接続',    // サ変名詞（「対策」「実施」など）
  '形容動詞語幹', // 形容動詞語幹
  '自立',        // 自立語
]);

// 単語を抽出（Kuromojiによる形態素解析）
async function extractWords(text: string): Promise<string[]> {
  // HTMLタグ除去
  const cleanText = text.replace(/<[^>]*>/g, '');
  
  try {
    // トークナイザーを初期化
    const tokenizer = await initializeTokenizer();
    
    // tokenizerがnullの場合はフォールバックを使用
    if (!tokenizer) {
      return extractWordsFallback(cleanText);
    }
    
    // 形態素解析
    const tokens = tokenizer.tokenize(cleanText);
    
    const words: string[] = [];
    const compoundBuffer: string[] = []; // 複合語バッファ
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const surface = token.surface_form; // 表層形
      const pos = token.pos;              // 品詞
      const posDetail = token.pos_detail_1; // 品詞細分類
      const baseForm = token.basic_form || surface; // 基本形
      
      // 品詞の判定
      const mainPos = pos.split(',')[0];
      
      // 名詞の場合
      if (mainPos === '名詞') {
        // 一般名詞、固有名詞、サ変接続などを含む
        if (posDetail === '一般' || posDetail === '固有名詞' || 
            posDetail === 'サ変接続' || posDetail === '形容動詞語幹') {
          
          // ストップワードチェック
          if (!STOP_WORDS.has(baseForm) && baseForm.length >= 2) {
            // 複合名詞の処理（連続する名詞を結合）
            compoundBuffer.push(baseForm);
            
            // 次のトークンも名詞でない場合、バッファを処理
            const nextToken = tokens[i + 1];
            if (!nextToken || nextToken.pos.split(',')[0] !== '名詞') {
              if (compoundBuffer.length > 1) {
                // 複合名詞として結合
                const compound = compoundBuffer.join('');
                if (!STOP_WORDS.has(compound)) {
                  words.push(compound);
                }
              }
              // 個別の名詞も追加
              compoundBuffer.forEach(word => {
                if (!STOP_WORDS.has(word) && word.length >= 2) {
                  words.push(word);
                }
              });
              compoundBuffer.length = 0; // バッファをクリア
            }
          }
        } else if (posDetail === '数' || posDetail === '非自立') {
          // 数詞や非自立名詞は基本的にスキップ
          compoundBuffer.length = 0; // 複合語バッファをクリア
        }
      }
      // 動詞の場合（重要な動詞のみ）
      else if (mainPos === '動詞' && posDetail === '自立') {
        compoundBuffer.length = 0; // 複合語バッファをクリア
        const verb = baseForm;
        // 一般的すぎる動詞は除外
        if (!STOP_WORDS.has(verb) && verb.length >= 2) {
          // サ変名詞化できる動詞は名詞形で追加
          const nounForm = verb.replace(/する$/, '');
          if (nounForm !== verb && nounForm.length >= 2) {
            words.push(nounForm);
          }
        }
      }
      // 形容詞の場合
      else if (mainPos === '形容詞' && posDetail === '自立') {
        compoundBuffer.length = 0; // 複合語バッファをクリア
        if (!STOP_WORDS.has(baseForm) && baseForm.length >= 2) {
          words.push(baseForm);
        }
      }
      else {
        // その他の品詞の場合、複合語バッファをクリア
        if (compoundBuffer.length > 0) {
          // バッファに残っている名詞を処理
          if (compoundBuffer.length > 1) {
            const compound = compoundBuffer.join('');
            if (!STOP_WORDS.has(compound)) {
              words.push(compound);
            }
          }
          compoundBuffer.forEach(word => {
            if (!STOP_WORDS.has(word) && word.length >= 2) {
              words.push(word);
            }
          });
          compoundBuffer.length = 0;
        }
      }
    }
    
    // 最後のバッファ処理
    if (compoundBuffer.length > 0) {
      if (compoundBuffer.length > 1) {
        const compound = compoundBuffer.join('');
        if (!STOP_WORDS.has(compound)) {
          words.push(compound);
        }
      }
      compoundBuffer.forEach(word => {
        if (!STOP_WORDS.has(word) && word.length >= 2) {
          words.push(word);
        }
      });
    }
    
    // 英単語も追加（SEO、CTRなど）
    const englishWords = cleanText.match(/[A-Za-z]{2,}/gi) || [];
    englishWords.forEach(word => {
      const upper = word.toUpperCase();
      if (!STOP_WORDS.has(upper) && upper.length >= 2) {
        words.push(upper);
      }
    });
    
    return words.filter(word => word.length >= 2);
    
  } catch (error) {
    console.error('形態素解析エラー:', error);
    // フォールバック: 簡易的な分割
    return extractWordsFallback(cleanText);
  }
}

// フォールバック用の簡易分割
function extractWordsFallback(text: string): string[] {
  const words: string[] = [];
  
  // カタカナの専門用語を抽出
  const katakanaWords = text.match(/[ァ-ヴー]{2,}/g) || [];
  words.push(...katakanaWords);
  
  // 英単語を抽出
  const englishWords = text.match(/[A-Za-z]{2,}/gi) || [];
  words.push(...englishWords.map(w => w.toUpperCase()));
  
  // 漢字の連続を抽出
  const kanjiWords = text.match(/[一-龯]{2,}/g) || [];
  words.push(...kanjiWords);
  
  return words
    .filter(word => word.length >= 2)
    .filter(word => !STOP_WORDS.has(word));
}

// 記事から単語を抽出
async function extractWordsFromArticle(article: ArticleAnalysis): Promise<string[]> {
  const allWords: string[] = [];
  
  // H1から単語抽出
  const h1Words = await extractWords(article.headingStructure.h1);
  allWords.push(...h1Words);
  
  // H2とH3から単語抽出
  for (const h2Item of article.headingStructure.h2Items) {
    const h2Words = await extractWords(h2Item.text);
    allWords.push(...h2Words);
    
    for (const h3 of h2Item.h3Items) {
      const h3Words = await extractWords(h3);
      allWords.push(...h3Words);
    }
  }
  
  return allWords;
}

// 頻出単語を分析
export async function analyzeWordFrequency(articles: ArticleAnalysis[]): Promise<FrequencyWord[]> {
  const wordMap = new Map<string, {
    count: number;
    articles: Set<number>;
  }>();
  
  // 各記事から単語を抽出してカウント
  for (const article of articles) {
    const words = await extractWordsFromArticle(article);
    const uniqueWords = new Set(words); // 記事内の重複を除去
    
    // 各単語の出現回数をカウント
    words.forEach(word => {
      const normalizedWord = word.trim();
      if (!normalizedWord) return;
      
      if (!wordMap.has(normalizedWord)) {
        wordMap.set(normalizedWord, {
          count: 0,
          articles: new Set()
        });
      }
      
      const entry = wordMap.get(normalizedWord)!;
      entry.count++;
    });
    
    // どの記事で使用されているかを記録
    uniqueWords.forEach(word => {
      const normalizedWord = word.trim();
      if (wordMap.has(normalizedWord)) {
        wordMap.get(normalizedWord)!.articles.add(article.rank);
      }
    });
  }
  
  // FrequencyWord配列に変換してソート
  const frequencyWords: FrequencyWord[] = Array.from(wordMap.entries())
    .map(([word, data]) => ({
      word,
      count: data.count,
      articleCount: data.articles.size,
      articles: Array.from(data.articles).sort((a, b) => a - b)
    }))
    .sort((a, b) => {
      // まず出現記事数で降順ソート、同じ場合は出現回数で降順ソート
      if (b.articleCount !== a.articleCount) {
        return b.articleCount - a.articleCount;
      }
      return b.count - a.count;
    })
    .slice(0, 20); // 上位20件
  
  return frequencyWords;
}

// 頻出単語を競合分析結果に追加
export function addFrequencyWordsToResult(
  result: any,
  frequencyWords: FrequencyWord[]
): any {
  return {
    ...result,
    frequencyWords
  };
}