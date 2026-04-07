import React, { useState } from 'react';
import type { SeoOutlineV2, OutlineSectionV2 } from '../types';
import { countCharacters } from '../utils/characterCounter';
import { reviseOutlineSection, reviseFullOutline } from '../services/outlineGeneratorV2';
import {
  TitleIcon,
  TargetIcon,
  IntroIcon,
  OutlineIcon,
  ConclusionIcon,
  KeywordIcon,
  ImageIcon,
  CharacterCountIcon,
  ClipboardIcon
} from './icons';

interface OutlineDisplayV2Props {
  outline: SeoOutlineV2;
  keyword: string;
  onOutlineUpdate?: (updatedOutline: SeoOutlineV2) => void; // 構成案更新コールバック
  onStartWriting?: () => void; // Ver.2執筆
  onStartWritingV1?: () => void; // Ver.1執筆
  onStartWritingV3?: () => void; // Ver.3執筆（Gemini Pro + Grounding）
}

const Card: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all duration-300 hover:border-blue-300 hover:shadow-md">
    <div className="flex items-center gap-3 mb-4">
      <div className="bg-blue-50 p-2 rounded-full">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-blue-700">{title}</h3>
    </div>
    <div className="prose prose-gray prose-p:text-gray-600 prose-li:text-gray-600 max-w-none">
      {children}
    </div>
  </div>
);

const OutlineDisplayV2: React.FC<OutlineDisplayV2Props> = ({ outline, keyword, onOutlineUpdate, onStartWriting, onStartWritingV1, onStartWritingV3 }) => {
  const [copyButtonText, setCopyButtonText] = useState('Markdownコピー');
  const [revisionPrompts, setRevisionPrompts] = useState<Record<number, string>>({});
  const [revisingSection, setRevisingSection] = useState<number | null>(null);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [fullRevisionPrompt, setFullRevisionPrompt] = useState('');
  const [isRevisingFull, setIsRevisingFull] = useState(false);
  const [fullRevisionError, setFullRevisionError] = useState<string | null>(null);

  const handleReviseSection = async (sectionIndex: number) => {
    const prompt = revisionPrompts[sectionIndex];
    if (!prompt || !prompt.trim()) return;
    if (!onOutlineUpdate) return;

    setRevisingSection(sectionIndex);
    setRevisionError(null);

    try {
      const revisedSection = await reviseOutlineSection(outline, sectionIndex, prompt.trim(), keyword);
      const updatedSections = [...outline.outline];
      updatedSections[sectionIndex] = revisedSection;
      const updatedOutline = { ...outline, outline: updatedSections };
      onOutlineUpdate(updatedOutline);

      // 成功したらプロンプトをクリア
      setRevisionPrompts(prev => {
        const next = { ...prev };
        delete next[sectionIndex];
        return next;
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : '修正に失敗しました';
      setRevisionError(`H2-${sectionIndex + 1}: ${msg}`);
    } finally {
      setRevisingSection(null);
    }
  };

  const handleReviseFullOutline = async () => {
    if (!fullRevisionPrompt.trim() || !onOutlineUpdate) return;

    setIsRevisingFull(true);
    setFullRevisionError(null);

    try {
      const revisedOutline = await reviseFullOutline(outline, fullRevisionPrompt.trim(), keyword);
      onOutlineUpdate(revisedOutline);
      setFullRevisionPrompt('');
    } catch (error) {
      const msg = error instanceof Error ? error.message : '構成案の修正に失敗しました';
      setFullRevisionError(msg);
    } finally {
      setIsRevisingFull(false);
    }
  };

  const handleFullRevisionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleReviseFullOutline();
    }
  };

  const handleCopyAsMarkdown = () => {
    const markdown = `
# 「${keyword}」の構成案

## キーワード
${keyword}

## 検索意図（主/副）
- 主: ${outline.searchIntent.primary}
${outline.searchIntent.secondary ? `- 副: ${outline.searchIntent.secondary}` : ''}

## タイトル（${countCharacters(outline.title)}文字）
${outline.title}

## メタディスクリプション（${countCharacters(outline.metaDescription)}文字）
${outline.metaDescription}

## 目標文字数
${outline.characterCountAnalysis ? `約${Math.round(outline.characterCountAnalysis.average / 100) * 100}文字（競合平均: ${outline.characterCountAnalysis.average.toLocaleString()}文字）` : '未設定'}

## ターゲット読者
${outline.targetAudience}

## 導入文（共感型）
${outline.introductions.empathy}

## 構成本体

${outline.outline.map((section, index) => `
### H2-${index + 1}：${section.heading}
- 画像提案：${section.imageSuggestion}
- 執筆メモ：${section.writingNote}
${section.subheadings.map((sub, subIndex) => `
  - **H3-${subIndex + 1}**：${sub.text} — 執筆メモ：${sub.writingNote || '未設定'}`).join('\n')}
`).join('\n')}

## 競合比較サマリ（上位10記事）
- **総H2/H3数**
  - 競合平均: H2=${outline.competitorComparison.averageH2Count} / H3=${outline.competitorComparison.averageH3Count}
  - サービス訴求追加後: H2=${outline.competitorComparison.averageH2Count + 1} / H3=${outline.competitorComparison.averageH3Count + 2}
  - 自案: H2=${outline.competitorComparison.ourH2Count} / H3=${outline.competitorComparison.ourH3Count}
  - 差分: H2=${outline.competitorComparison.ourH2Count - (outline.competitorComparison.averageH2Count + 1) >= 0 ? '+' : ''}${outline.competitorComparison.ourH2Count - (outline.competitorComparison.averageH2Count + 1)} / H3=${outline.competitorComparison.ourH3Count - (outline.competitorComparison.averageH3Count + 2) >= 0 ? '+' : ''}${outline.competitorComparison.ourH3Count - (outline.competitorComparison.averageH3Count + 2)}

- **鮮度リスク**
${outline.competitorComparison.freshnessRisks.length > 0
  ? outline.competitorComparison.freshnessRisks.map(risk => `  - ${risk}`).join('\n')
  : '  - なし'}

- **わたしたちの差分3点**
${outline.competitorComparison.differentiators.map((diff, i) => `  ${i + 1}) ${diff}`).join('\n')}

## チェックリスト
- [${countCharacters(outline.title) <= 50 ? 'x' : ' '}] タイトル≤50全角（現在: ${countCharacters(outline.title)}文字）
- [${countCharacters(outline.metaDescription) >= 100 && countCharacters(outline.metaDescription) <= 150 ? 'x' : ' '}] メタディスクリプション100-150全角（現在: ${countCharacters(outline.metaDescription)}文字）
- [x] H2順序＝上位3多数派
- [${outline.outline.every(s => s.subheadings.length === 0 || s.subheadings.length >= 2) ? 'x' : ' '}] H3は0 or 2以上
- [x] -10%ルール適合（H2/H3）
- [${!outline.freshnessData?.hasOutdatedInfo ? 'x' : ' '}] 鮮度NGゼロ
- [${outline.competitorComparison.differentiators.length >= 3 ? 'x' : ' '}] 差分3点の明示
`.trim();

    navigator.clipboard.writeText(markdown).then(() => {
      setCopyButtonText('コピーしました！');
      setTimeout(() => {
        setCopyButtonText('Markdownコピー');
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  // チェックリストの状態を計算
  const checklistStatus = {
    titleOk: countCharacters(outline.title) <= 50,
    metaOk: countCharacters(outline.metaDescription) >= 100 && countCharacters(outline.metaDescription) <= 150,
    h3RuleOk: outline.outline.every(s => s.subheadings.length === 0 || s.subheadings.length >= 2),
    freshnessOk: !outline.freshnessData?.hasOutdatedInfo,
    differentiatorOk: outline.competitorComparison.differentiators.length >= 3
  };

  return (
    <div className="animate-fade-in space-y-8">
      {/* ヘッダー */}
      <div className="space-y-4">
        <div className="relative text-center">
          <span className="absolute top-0 left-0 px-3 py-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-bold rounded-full">
            Ver.2
          </span>
          <h2 className="text-3xl font-bold text-gray-800 py-2">
            「<span className="text-blue-600">{keyword}</span>」の構成案
          </h2>
        </div>

        {/* アクションボタン */}
        <div className="flex justify-center gap-2 flex-wrap">
          <button
            onClick={handleCopyAsMarkdown}
            className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 ease-in-out text-sm shadow-sm"
          >
            <ClipboardIcon className="w-5 h-5" />
            {copyButtonText}
          </button>
          {onStartWritingV1 && (
            <button
              onClick={onStartWritingV1}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 ease-in-out text-sm shadow-sm"
            >
              執筆開始（Ver.1）
            </button>
          )}
          {onStartWritingV3 && (
            <button
              onClick={onStartWritingV3}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 ease-in-out text-sm shadow-md"
            >
              執筆開始（Ver.3 Pro）
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded">NEW</span>
            </button>
          )}
        </div>
      </div>

      {/* チェックリストステータス */}
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">品質チェック</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className={`flex items-center gap-2 ${checklistStatus.titleOk ? 'text-green-600' : 'text-red-500'}`}>
            <span>{checklistStatus.titleOk ? '✅' : '❌'}</span>
            <span className="text-sm">タイトル{countCharacters(outline.title)}/50</span>
          </div>
          <div className={`flex items-center gap-2 ${checklistStatus.metaOk ? 'text-green-600' : 'text-red-500'}`}>
            <span>{checklistStatus.metaOk ? '✅' : '❌'}</span>
            <span className="text-sm">メタ{countCharacters(outline.metaDescription)}/100-150</span>
          </div>
          <div className={`flex items-center gap-2 ${checklistStatus.h3RuleOk ? 'text-green-600' : 'text-red-500'}`}>
            <span>{checklistStatus.h3RuleOk ? '✅' : '❌'}</span>
            <span className="text-sm">H3ルール</span>
          </div>
          <div className={`flex items-center gap-2 ${checklistStatus.freshnessOk ? 'text-green-600' : 'text-amber-500'}`}>
            <span>{checklistStatus.freshnessOk ? '✅' : '⚠️'}</span>
            <span className="text-sm">鮮度</span>
          </div>
        </div>
      </div>

      {/* 基本情報 */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card icon={<TitleIcon className="w-6 h-6 text-blue-500" />} title="タイトル案">
            <p className="text-lg font-semibold text-gray-800">{outline.title}</p>
            <p className="text-sm text-gray-500 mt-2">
              文字数: {countCharacters(outline.title)} / 50
            </p>
          </Card>
          <Card icon={<TargetIcon className="w-6 h-6 text-blue-500" />} title="メタディスクリプション">
            <p className="text-gray-700">{outline.metaDescription}</p>
            <p className="text-sm text-gray-500 mt-2">
              文字数: {countCharacters(outline.metaDescription)} / 100-150（推奨125）
            </p>
          </Card>
        </div>

        {/* 目標文字数 */}
        {outline.characterCountAnalysis && (
          <Card icon={<CharacterCountIcon className="w-6 h-6 text-blue-500" />} title="目標文字数">
            <p className="text-lg font-semibold text-gray-800">
              約 {Math.round(outline.characterCountAnalysis.average / 100) * 100} 文字
            </p>
            <p className="text-sm text-gray-500 mt-2">
              競合上位記事の平均: {outline.characterCountAnalysis.average.toLocaleString()} 文字
            </p>
          </Card>
        )}
      </div>

      {/* ターゲット読者 */}
      <Card icon={<TargetIcon className="w-6 h-6 text-blue-500" />} title="ターゲット読者">
        <p className="text-gray-700">{outline.targetAudience}</p>
      </Card>

      {/* 導入文 */}
      <Card icon={<IntroIcon className="w-6 h-6 text-blue-500" />} title="導入文（共感型）">
        <p className="text-gray-700">{outline.introductions.empathy}</p>
      </Card>

      {/* 構成本体 */}
      <Card icon={<OutlineIcon className="w-6 h-6 text-blue-500" />} title="記事構成案">
        <div className="space-y-6">
          {outline.outline.map((section, index) => (
            <div key={index} className="border-l-4 border-blue-400 pl-4 space-y-3">
              <div>
                <h4 className="font-bold text-lg text-gray-800">
                  <span className="text-blue-600 mr-2">H2-{index + 1}:</span>
                  {section.heading}
                </h4>

                {/* 画像提案 */}
                {section.imageSuggestion && (
                  <div className="mt-2 p-3 bg-blue-50 rounded-lg flex items-start gap-3">
                    <ImageIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                    <div>
                      <p className="font-semibold text-sm text-blue-700">画像提案</p>
                      <p className="text-gray-600 text-sm">{section.imageSuggestion}</p>
                    </div>
                  </div>
                )}

                {/* 執筆メモ */}
                <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">執筆メモ:</span> {section.writingNote}
                  </p>
                </div>
              </div>

              {/* H3 */}
              {section.subheadings.length > 0 && (
                <ul className="ml-6 space-y-2">
                  {section.subheadings.map((sub, subIndex) => (
                    <li key={subIndex} className="space-y-1">
                      <div className="flex items-start gap-2">
                        <span className="text-blue-600 font-semibold">H3-{subIndex + 1}:</span>
                        <span className="text-gray-700">{sub.text}</span>
                      </div>
                      {sub.writingNote && (
                        <div className="ml-8 p-2 bg-gray-50 rounded text-sm text-gray-500">
                          執筆メモ: {sub.writingNote}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* H2ブロック修正プロンプト */}
              {onOutlineUpdate && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex gap-2">
                    <textarea
                      value={revisionPrompts[index] || ''}
                      onChange={(e) => setRevisionPrompts(prev => ({ ...prev, [index]: e.target.value }))}
                      placeholder={`H2-${index + 1} の修正指示を入力...`}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      rows={2}
                      disabled={revisingSection === index}
                    />
                    <button
                      onClick={() => handleReviseSection(index)}
                      disabled={revisingSection === index || !revisionPrompts[index] || !(revisionPrompts[index] || '').trim()}
                      className="self-end px-4 py-2 text-sm font-semibold text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >
                      {revisingSection === index ? '修正中...' : 'AI修正'}
                    </button>
                  </div>
                  {revisionError && revisionError.startsWith(`H2-${index + 1}:`) && (
                    <p className="mt-1 text-sm text-red-500">{revisionError}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* 競合比較サマリ */}
      <Card icon={<CharacterCountIcon className="w-6 h-6 text-blue-500" />} title="競合比較サマリ">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-semibold text-blue-700 mb-2">H2/H3数の比較</h4>
            <div className="space-y-1 text-sm">
              <p className="text-gray-700">競合平均: H2={outline.competitorComparison.averageH2Count} / H3={outline.competitorComparison.averageH3Count}</p>
              <p className="text-gray-500">サービス訴求追加後: H2={outline.competitorComparison.averageH2Count + 1} / H3={outline.competitorComparison.averageH3Count + 2}</p>
              <p className="text-gray-700">自案: H2={outline.competitorComparison.ourH2Count} / H3={outline.competitorComparison.ourH3Count}</p>
              <p className="font-semibold text-blue-600">
                差分: H2={outline.competitorComparison.ourH2Count - (outline.competitorComparison.averageH2Count + 1) >= 0 ? '+' : ''}{outline.competitorComparison.ourH2Count - (outline.competitorComparison.averageH2Count + 1)} /
                H3={outline.competitorComparison.ourH3Count - (outline.competitorComparison.averageH3Count + 2) >= 0 ? '+' : ''}{outline.competitorComparison.ourH3Count - (outline.competitorComparison.averageH3Count + 2)}
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-blue-700 mb-2">鮮度リスク</h4>
            {outline.competitorComparison.freshnessRisks.length > 0 ? (
              <ul className="space-y-1 text-sm text-amber-600">
                {outline.competitorComparison.freshnessRisks.map((risk, i) => (
                  <li key={i}>⚠️ {risk}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-green-600">✅ 鮮度リスクなし</p>
            )}
          </div>

          <div>
            <h4 className="font-semibold text-blue-700 mb-2">差分ポイント</h4>
            <ol className="space-y-1 text-sm text-gray-700">
              {outline.competitorComparison.differentiators.map((diff, i) => (
                <li key={i}>{i + 1}. {diff}</li>
              ))}
            </ol>
          </div>
        </div>
      </Card>

      {/* キーワード */}
      <Card icon={<KeywordIcon className="w-6 h-6 text-blue-500" />} title="含めるべきキーワード">
        <div className="flex flex-wrap gap-2">
          {outline.keywords.map((kw, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full"
            >
              {kw}
            </span>
          ))}
        </div>
      </Card>

      {/* 構成案全体の余白（フローティングUIと被らないように） */}
      {onOutlineUpdate && <div className="h-28" />}

      {/* フローティング：構成案全体修正 */}
      {onOutlineUpdate && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-gray-300 shadow-[0_-4px_12px_rgba(0,0,0,0.1)] px-4 py-3">
          <div className="max-w-4xl mx-auto">
            {fullRevisionError && (
              <p className="text-sm text-red-500 mb-2">{fullRevisionError}</p>
            )}
            <div className="flex gap-3 items-end">
              <textarea
                value={fullRevisionPrompt}
                onChange={(e) => setFullRevisionPrompt(e.target.value)}
                onKeyDown={handleFullRevisionKeyDown}
                placeholder="構成案全体への修正指示を入力（例：H2を1つ追加して、○○の内容を盛り込んで）… Ctrl+Enterで送信"
                className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                rows={2}
                disabled={isRevisingFull}
              />
              <button
                onClick={handleReviseFullOutline}
                disabled={isRevisingFull || !fullRevisionPrompt.trim()}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl hover:from-indigo-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap shadow-sm"
              >
                {isRevisingFull ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    修正中...
                  </span>
                ) : '構成案を修正'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutlineDisplayV2;
