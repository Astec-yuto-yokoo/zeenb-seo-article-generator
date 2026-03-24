#!/bin/bash

# Google Drive API 常時アクセス設定スクリプト

echo "🔧 Google Drive API アクセス設定"
echo "================================"

# 1. ADC認証の確認と更新
check_and_refresh_auth() {
    echo "📌 認証状態を確認中..."
    
    # 現在の認証を確認
    if gcloud auth application-default print-access-token &>/dev/null; then
        echo "✅ 認証は有効です"
    else
        echo "🔄 認証を更新します..."
        gcloud auth application-default login \
            --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/drive.readonly,https://www.googleapis.com/auth/drive.file
        echo "✅ 認証が更新されました"
    fi
}

# 2. 環境変数の設定
setup_env() {
    echo "📝 環境変数を設定中..."
    
    # .envファイルが存在しない場合は作成
    if [ ! -f .env ]; then
        echo "⚠️  .envファイルが見つかりません。作成します..."
        touch .env
    fi
    
    # Google Cloud Projectの設定を確認
    PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
    if [ -z "$PROJECT_ID" ]; then
        echo "⚠️  Google Cloud Projectが設定されていません"
        echo "   以下のコマンドで設定してください："
        echo "   gcloud config set project YOUR_PROJECT_ID"
    else
        echo "✅ Project ID: $PROJECT_ID"
    fi
}

# 3. 接続テスト
test_connection() {
    echo "🧪 Google Drive API接続テスト..."
    
    # Node.jsスクリプトでテスト
    node test-drive-safe.cjs
    
    if [ $? -eq 0 ]; then
        echo "✅ 接続テスト成功！"
    else
        echo "❌ 接続テスト失敗"
        echo "   認証を再実行してください"
    fi
}

# メイン処理
main() {
    echo "開始時刻: $(date)"
    echo ""
    
    check_and_refresh_auth
    echo ""
    
    setup_env
    echo ""
    
    test_connection
    echo ""
    
    echo "================================"
    echo "🎉 設定完了！"
    echo ""
    echo "📌 今後のアクセス方法："
    echo "   1. このスクリプトを定期的に実行（週1回程度）"
    echo "   2. または、エラーが出た時に実行"
    echo ""
    echo "💡 自動更新を設定する場合："
    echo "   crontabに以下を追加："
    echo "   0 9 * * MON cd $(pwd) && ./scripts/setup-drive-access.sh"
    echo ""
}

# 実行
main