import React, { useState } from 'react';
import { insertSourcesAfterRevision } from '../services/articleRevisionService';

export const TestSourceInsertion: React.FC = () => {
  const [result, setResult] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [testCase, setTestCase] = useState<'basic' | 'complex' | 'edge'>('basic');
  
  // 基本テスト用の記事HTML
  const basicTestArticle = `
<h2>AIの市場規模</h2>
<p>AIの市場は急成長しています。2030年までに世界市場は200兆円規模に達すると予測されています。</p>

<h3>国内市場</h3>
<p>日本のAI市場は2025年に1兆円規模になる見込みです。特に製造業での活用が進んでいます。</p>

<h3>海外市場</h3>
<p>世界のAI市場は更に大きく、米国と中国が市場をリードしています。</p>

<h2><b>導入事例</b></h2>
<p>様々な企業がAIを導入しています。業務効率化や新サービス開発に活用されています。</p>

<h3>製造業の事例</h3>
<p>トヨタ自動車では品質検査にAIを活用し、不良品率を50%削減しました。</p>

<h2>今後の展望</h2>
<p>AIは今後も進化を続け、私たちの生活をより豊かにしていくでしょう。</p>
`;

  // 複雑なパターンのテスト記事
  const complexTestArticle = `
<h2>AI&amp;機械学習の最新動向</h2>
<p>AI（人工知能）と機械学習の技術は急速に進化しています。</p>

<h3>2025年の市場予測（最新版）</h3>
<p>最新の調査によると、2025年の市場規模は驚異的な成長を遂げる見込みです。</p>

<h3>技術トレンド＆イノベーション</h3>
<p>生成AI、大規模言語モデル（LLM）などが注目を集めています。</p>

<h2><b><i>企業の導入事例</i></b></h2>
<p>多くの企業が<strong>AI技術</strong>を活用し始めています。</p>

<h3>トヨタ・ホンダ・日産の取り組み</h3>
<p>日本の自動車メーカー各社も積極的にAIを導入しています。</p>

<h2 class="heading-style" id="future">将来性と課題</h2>
<p>AIの将来は明るいが、倫理的な課題も存在します。</p>
`;

  // エッジケースのテスト記事
  const edgeTestArticle = `
<h2></h2>
<p>空の見出しのテスト</p>

<h2>見出し1</h2>
<h3>サブ見出し1-1</h3>
<h3>サブ見出し1-2</h3>
<h3>サブ見出し1-3</h3>
<p>H3が連続している場合</p>

<h2>見出し2</h2>
<p>H3がない場合のテスト。このセクションにはH3がありません。</p>
<p>複数の段落があります。</p>
<p>3つ目の段落です。</p>

<h2>見出し3</h2>
<h3>サブ見出し3-1</h3>
<h2>見出し4</h2>
<p>前のセクションにコンテンツがない場合</p>

<h2>特殊文字テスト「引用符」『かぎ括弧』</h2>
<p>特殊文字を含む見出しのテスト</p>

<h3>100%成功率・売上1,000万円達成！</h3>
<p>数字と記号を含むケース</p>
`;

  // 各テストケース用の出典データ
  const basicTestSources = [
    {
      h2: "AIの市場規模",
      h3: "国内市場",
      url: "https://example.com/japan-ai-market",
      heading: "国内市場",
      title: "日本のAI市場レポート2025"
    },
    {
      h2: "AIの市場規模",
      h3: "海外市場",
      url: "https://example.com/global-ai-market",
      heading: "海外市場",
      title: "世界AI市場動向"
    },
    {
      h2: "導入事例",
      h3: "",  // H2直下に挿入するパターン
      url: "https://example.com/ai-cases",
      heading: "導入事例",
      title: "AI導入事例集"
    },
    {
      h2: "導入事例",  // <b>タグ付きの見出しにマッチするか
      h3: "製造業の事例",
      url: "https://example.com/toyota-case",
      heading: "製造業の事例",
      title: "トヨタのAI活用事例"
    },
    {
      h2: "今後の展望",
      h3: "",  // H3なしパターン
      url: "https://example.com/ai-future",
      heading: "今後の展望",
      title: "AI技術の未来予測"
    }
  ];

  // 複雑なテスト用の出典データ
  const complexTestSources = [
    {
      h2: "AI&機械学習の最新動向",
      h3: "2025年の市場予測（最新版）",
      url: "https://example.com/market-2025",
      heading: "2025年の市場予測（最新版）",
      title: "市場予測レポート"
    },
    {
      h2: "AI&機械学習の最新動向",
      h3: "技術トレンド＆イノベーション",
      url: "https://example.com/tech-trends",
      heading: "技術トレンド＆イノベーション",
      title: "技術動向分析"
    },
    {
      h2: "企業の導入事例",
      h3: "",
      url: "https://example.com/enterprise-cases",
      heading: "企業の導入事例",
      title: "企業AI導入事例集"
    },
    {
      h2: "企業の導入事例",
      h3: "トヨタ・ホンダ・日産の取り組み",
      url: "https://example.com/auto-makers",
      heading: "トヨタ・ホンダ・日産の取り組み",
      title: "自動車業界のAI活用"
    },
    {
      h2: "将来性と課題",
      h3: "",
      url: "https://example.com/future-challenges",
      heading: "将来性と課題",
      title: "AI倫理と課題"
    }
  ];

  // エッジケース用の出典データ
  const edgeTestSources = [
    {
      h2: "",  // 空の見出し
      h3: "",
      url: "https://example.com/empty",
      heading: "",
      title: "空見出しテスト"
    },
    {
      h2: "見出し1",
      h3: "サブ見出し1-3",  // 最後のH3
      url: "https://example.com/last-h3",
      heading: "サブ見出し1-3",
      title: "連続H3テスト"
    },
    {
      h2: "見出し2",
      h3: "",
      url: "https://example.com/no-h3",
      heading: "見出し2",
      title: "H3なしテスト"
    },
    {
      h2: "特殊文字テスト「引用符」『かぎ括弧』",
      h3: "",
      url: "https://example.com/special-chars",
      heading: "特殊文字テスト「引用符」『かぎ括弧』",
      title: "特殊文字対応"
    },
    {
      h2: "特殊文字テスト「引用符」『かぎ括弧』",
      h3: "100%成功率・売上1,000万円達成！",
      url: "https://example.com/numbers",
      heading: "100%成功率・売上1,000万円達成！",
      title: "数字記号テスト"
    }
  ];

  // テストケースに応じたデータを選択
  const getTestData = () => {
    switch (testCase) {
      case 'basic':
        return { article: basicTestArticle, sources: basicTestSources };
      case 'complex':
        return { article: complexTestArticle, sources: complexTestSources };
      case 'edge':
        return { article: edgeTestArticle, sources: edgeTestSources };
      default:
        return { article: basicTestArticle, sources: basicTestSources };
    }
  };
  
  const runTest = async () => {
    setIsRunning(true);
    const { article, sources } = getTestData();
    
    console.log(`🧪 出典挿入テスト開始 - ${testCase.toUpperCase()}モード`);
    console.log('=====================================');
    console.log('📄 元の記事:');
    console.log(article);
    console.log('=====================================');
    console.log('📌 挿入する出典:', sources.length, '件');
    sources.forEach((source, idx) => {
      console.log(`  [${idx + 1}] ${source.h2}${source.h3 ? ' > ' + source.h3 : '（H2直下）'} → ${source.url}`);
    });
    console.log('=====================================');
    
    try {
      // insertSourcesAfterRevision関数を直接呼び出し
      const modifiedArticle = await insertSourcesAfterRevision(
        article,
        sources
      );
      
      console.log('✅ 出典挿入完了');
      console.log('=====================================');
      console.log('📄 修正後の記事:');
      console.log(modifiedArticle);
      console.log('=====================================');
      
      // 挿入された出典の数を確認（半角括弧に対応）
      const insertedCount = (modifiedArticle.match(/（出典：/g) || []).length;
      console.log(`📊 結果: ${insertedCount}/${sources.length}件の出典を挿入`);
      
      // 各出典が正しい位置に挿入されたか確認
      sources.forEach((source, idx) => {
        const searchText = source.h3 || source.h2 || '（空の見出し）';
        // 空の見出しの場合は特別な処理
        if (!source.h3 && !source.h2) {
          const hasSource = modifiedArticle.includes(source.url);
          console.log(`  [${idx + 1}] ${searchText}: ${hasSource ? '✅ 挿入成功' : '❌ 挿入失敗'}`);
        } else {
          const beforeSection = modifiedArticle.split(searchText)[1]?.split('<h')[0];
          const hasSource = beforeSection?.includes(source.url);
          console.log(`  [${idx + 1}] ${searchText}: ${hasSource ? '✅ 挿入成功' : '❌ 挿入失敗'}`);
        }
      });
      
      setResult(modifiedArticle);
    } catch (error) {
      console.error('❌ テストエラー:', error);
      setResult('エラーが発生しました');
    } finally {
      setIsRunning(false);
    }
  };
  
  return (
    <div className="bg-white rounded-xl p-6 mb-6 border border-gray-200 shadow-sm">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        🧪 出典挿入テスト
      </h2>

      <div className="mb-4">
        <label className="text-gray-800 font-semibold mb-2 block">テストケース選択:</label>
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTestCase('basic')}
            className={`px-4 py-2 rounded-xl transition-all ${
              testCase === 'basic'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
            }`}
          >
            基本テスト
          </button>
          <button
            onClick={() => setTestCase('complex')}
            className={`px-4 py-2 rounded-xl transition-all ${
              testCase === 'complex'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
            }`}
          >
            複雑パターン
          </button>
          <button
            onClick={() => setTestCase('edge')}
            className={`px-4 py-2 rounded-xl transition-all ${
              testCase === 'edge'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
            }`}
          >
            エッジケース
          </button>
        </div>

        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
          <h3 className="text-gray-800 font-semibold mb-2">
            {testCase === 'basic' && '基本テストシナリオ:'}
            {testCase === 'complex' && '複雑パターンテスト:'}
            {testCase === 'edge' && 'エッジケーステスト:'}
          </h3>
          <ul className="text-gray-600 text-sm space-y-1">
            {testCase === 'basic' && (
              <>
                <li>✓ H3がある場合の挿入（国内市場、海外市場）</li>
                <li>✓ H2直下の挿入（導入事例、今後の展望）</li>
                <li>✓ &lt;b&gt;タグ付き見出しへの対応</li>
                <li>✓ 複数出典の一括挿入</li>
              </>
            )}
            {testCase === 'complex' && (
              <>
                <li>✓ 特殊文字を含む見出し（&amp;、（）、＆など）</li>
                <li>✓ ネストされたタグ（&lt;b&gt;&lt;i&gt;など）</li>
                <li>✓ 日本語の特殊記号（・、「」、『』）</li>
                <li>✓ class属性やid属性付きの見出し</li>
              </>
            )}
            {testCase === 'edge' && (
              <>
                <li>✓ 空の見出し</li>
                <li>✓ H3が連続する場合</li>
                <li>✓ H3がないセクション</li>
                <li>✓ 数字と記号を含む見出し（%、円、万など）</li>
              </>
            )}
          </ul>
        </div>
      </div>

      <button
        onClick={runTest}
        disabled={isRunning}
        className={`px-6 py-3 rounded-xl font-medium transition-all ${
          isRunning
            ? 'bg-gray-200 cursor-not-allowed text-gray-500'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
      >
        {isRunning ? '🔄 テスト実行中...' : '🚀 テスト実行'}
      </button>

      {result && (
        <div className="mt-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">
            📋 テスト結果：
          </h3>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="text-gray-600 text-sm">
              <div dangerouslySetInnerHTML={{ __html: result }} />
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <p className="text-blue-700 text-sm">
              💡 ヒント: ブラウザのコンソール（F12）で詳細なログを確認できます
            </p>
          </div>
        </div>
      )}
    </div>
  );
};