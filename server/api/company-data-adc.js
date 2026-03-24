// Google Drive API エンドポイント（ADC認証版）
const express = require('express');
const driveAuth = require('../../services/driveAutoAuth.cjs');

const router = express.Router();

// 実績データを取得
router.get('/api/company-data', async (req, res) => {
  console.log('📡 [API] Company data request received');
  
  try {
    // 自動認証モジュールを使用してCSVファイルを取得
    const csvContent = await driveAuth.getCSVFile(
      process.env.COMPANY_DATA_FOLDER_ID || '',
      'pdf_segments_index.csv'
    );
    
    if (!csvContent) {
      throw new Error('CSVファイルの取得に失敗しました');
    }
    
    console.log(`✅ [API] CSV data retrieved: ${csvContent.length} characters`);
    
    // 成功レスポンス
    res.json({
      success: true,
      csvContent: csvContent,
      source: 'google-drive-adc',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [API] Error:', error.message);
    
    // エラーレスポンス
    res.status(500).json({
      success: false,
      error: error.message,
      source: 'google-drive-adc',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;