// Google Drive 自動認証モジュール
const { google } = require('googleapis');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class DriveAutoAuth {
  constructor() {
    this.drive = null;
    this.lastAuthTime = null;
    this.AUTH_TIMEOUT = 50 * 60 * 1000; // 50分（1時間より少し短め）
  }

  /**
   * 認証状態を確認し、必要に応じて更新
   */
  async ensureAuthenticated() {
    const now = Date.now();
    
    // 初回認証または期限切れの場合
    if (!this.drive || !this.lastAuthTime || (now - this.lastAuthTime > this.AUTH_TIMEOUT)) {
      console.log('🔄 Google Drive認証を更新中...');
      
      try {
        // ADCトークンの有効性を確認
        await this.checkADCToken();
        
        // Drive APIクライアントを初期化
        await this.initializeDriveClient();
        
        this.lastAuthTime = now;
        console.log('✅ 認証成功（次回更新: ' + new Date(now + this.AUTH_TIMEOUT).toLocaleTimeString() + '）');
      } catch (error) {
        console.error('❌ 認証エラー:', error.message);
        
        // 認証が失敗した場合、再認証を試みる
        await this.reAuthenticate();
      }
    }
    
    return this.drive;
  }

  /**
   * ADCトークンの有効性を確認
   */
  async checkADCToken() {
    try {
      const { stdout } = await execPromise('gcloud auth application-default print-access-token');
      if (!stdout || stdout.trim().length === 0) {
        throw new Error('トークンが無効です');
      }
    } catch (error) {
      throw new Error('ADCトークンの確認に失敗: ' + error.message);
    }
  }

  /**
   * Drive APIクライアントを初期化
   */
  async initializeDriveClient() {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    
    const authClient = await auth.getClient();
    this.drive = google.drive({ version: 'v3', auth: authClient });
  }

  /**
   * 再認証を実行
   */
  async reAuthenticate() {
    console.log('🔐 再認証を実行中...');
    
    try {
      // gcloudコマンドで再認証
      const { stdout, stderr } = await execPromise(`
        gcloud auth application-default login \
          --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/drive.readonly,https://www.googleapis.com/auth/drive.file \
          --no-launch-browser
      `);
      
      console.log('📌 ブラウザで認証を完了してください');
      console.log(stdout);
      
      // 再度初期化を試みる
      await this.initializeDriveClient();
      this.lastAuthTime = Date.now();
      
    } catch (error) {
      console.error('❌ 再認証に失敗しました:', error.message);
      console.error('手動で以下のコマンドを実行してください:');
      console.error('gcloud auth application-default login');
      throw error;
    }
  }

  /**
   * CSVファイルを取得（自動認証付き）
   */
  async getCSVFile(folderId = process.env.COMPANY_DATA_FOLDER_ID || '', fileName = 'pdf_segments_index.csv') {
    // 認証を確認
    const drive = await this.ensureAuthenticated();
    
    try {
      // ファイルを検索
      const response = await drive.files.list({
        q: `'${folderId}' in parents and name='${fileName}'`,
        fields: 'files(id, name)',
        pageSize: 1
      });
      
      const files = response.data.files || [];
      if (files.length === 0) {
        throw new Error(`ファイルが見つかりません: ${fileName}`);
      }
      
      // ファイル内容を取得
      const fileId = files[0].id;
      const fileContent = await drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, {
        responseType: 'text'
      });
      
      return fileContent.data;
      
    } catch (error) {
      // 認証エラーの場合は再認証を試みる
      if (error.code === 401 || error.message.includes('authentication')) {
        console.log('⚠️ 認証エラーを検出。再認証を試みます...');
        this.drive = null;
        this.lastAuthTime = null;
        return await this.getCSVFile(folderId, fileName); // リトライ
      }
      
      throw error;
    }
  }
  
  /**
   * 複数のCSVファイルを統合して取得
   */
  async getAllSegments(folderId = process.env.COMPANY_DATA_FOLDER_ID || '') {
    console.log('📚 PDF & Video セグメントを統合取得中...');
    
    let allContent = '';
    
    try {
      // PDF segments を取得
      console.log('📄 PDF segments 取得中...');
      const pdfContent = await this.getCSVFile(folderId, 'pdf_segments_index.csv');
      allContent += pdfContent;
      console.log('✅ PDF segments 取得完了');
    } catch (error) {
      console.log('⚠️ PDF segments 取得失敗:', error.message);
    }
    
    try {
      // Video segments を取得
      console.log('🎥 Video segments 取得中...');
      const videoContent = await this.getCSVFile(folderId, 'video_segments.csv');
      if (videoContent) {
        allContent += '\n' + videoContent;
        console.log('✅ Video segments 取得完了');
      }
    } catch (error) {
      console.log('⚠️ Video segments 取得失敗:', error.message);
    }
    
    return allContent;
  }
}

// シングルトンインスタンスをエクスポート
module.exports = new DriveAutoAuth();