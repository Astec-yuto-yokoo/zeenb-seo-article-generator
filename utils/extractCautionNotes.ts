// 要確認箇所（cautionNotes）を抽出する共通関数

export interface CautionNote {
  location: string;
  claim: string;
}

/**
 * マルチエージェント結果から要確認箇所を抽出
 * @param result マルチエージェントの結果
 * @returns 要確認箇所の配列
 */
export function extractCautionNotes(result: any): CautionNote[] {
  const cautionNotes: CautionNote[] = [];
  
  if (!result) {
    return cautionNotes;
  }
  
  // criticalIssuesから抽出
  if (result.criticalIssues && Array.isArray(result.criticalIssues)) {
    result.criticalIssues.forEach((issue: any) => {
      // actionTypeが'rephrase'でcautionNoteがある場合
      if (issue.actionType === 'rephrase' && issue.cautionNote) {
        cautionNotes.push({
          location: issue.location || issue.h3 || issue.h2 || '不明な箇所',
          claim: issue.cautionNote
        });
      }
      // 後方互換性のため、actionがrephrase-with-cautionの場合も確認
      if (issue.action === 'rephrase-with-caution' && issue.cautionNote) {
        cautionNotes.push({
          location: issue.location || issue.h3 || issue.h2 || '不明な箇所',
          claim: issue.cautionNote
        });
      }
    });
  }
  
  // majorIssuesからも抽出
  if (result.majorIssues && Array.isArray(result.majorIssues)) {
    result.majorIssues.forEach((issue: any) => {
      // actionTypeが'rephrase'でcautionNoteがある場合
      if (issue.actionType === 'rephrase' && issue.cautionNote) {
        cautionNotes.push({
          location: issue.location || issue.h3 || issue.h2 || '不明な箇所',
          claim: issue.cautionNote
        });
      }
      // 後方互換性のため、actionがrephrase-with-cautionの場合も確認
      if (issue.action === 'rephrase-with-caution' && issue.cautionNote) {
        cautionNotes.push({
          location: issue.location || issue.h3 || issue.h2 || '不明な箇所',
          claim: issue.cautionNote
        });
      }
    });
  }
  
  // 重複を除去（同じ場所・同じ主張は1つにまとめる）
  const uniqueCautionNotes = cautionNotes.reduce((acc: CautionNote[], current) => {
    const exists = acc.some(
      item => item.location === current.location && item.claim === current.claim
    );
    if (!exists) {
      acc.push(current);
    }
    return acc;
  }, []);
  
  console.log(`📝 要確認箇所を${uniqueCautionNotes.length}件抽出`);
  uniqueCautionNotes.forEach((note, index) => {
    console.log(`  [${index + 1}] ${note.location}: ${note.claim.substring(0, 50)}...`);
  });
  
  return uniqueCautionNotes;
}