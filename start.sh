#!/bin/bash

# SEO Content Generator 起動スクリプト
# PC再起動後にこのスクリプトを実行すると、全てのサーバーが起動します

# --- 起動元を必ずこのスクリプトのあるディレクトリに固定する ---
# 相対パス（server/... や ai-article-imager-for-wordpress）が別クローンを掴むのを防ぐ。
# どのディレクトリから実行しても、常にこの start.sh と同じ場所のプロジェクトを起動する。
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || { echo "❌ プロジェクトディレクトリへ移動できませんでした: $SCRIPT_DIR"; exit 1; }
echo "📂 起動ディレクトリ: $SCRIPT_DIR"

echo "🚀 SEO Content Generator を起動します..."

# 既存のプロセスを確認
echo "📍 既存のプロセスを確認中..."
lsof -i :5180 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "⚠️  ポート5180が使用中です。既存のプロセスを終了します..."
    kill $(lsof -t -i:5180) 2>/dev/null
    sleep 2
fi

lsof -i :3003 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "⚠️  ポート3001が使用中です。既存のプロセスを終了します..."
    kill $(lsof -t -i:3003) 2>/dev/null
    sleep 2
fi

lsof -i :5181 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "⚠️  ポート5181が使用中です。既存のプロセスを終了します..."
    kill $(lsof -t -i:5181) 2>/dev/null
    sleep 2
fi

# スクレイピングサーバーを起動（SearchAPI + Puppeteer統合）
echo "🔍 スクレイピングサーバー（SearchAPI + Puppeteer）を起動中..."
node server/scraping-server.js &
SCRAPING_PID=$!
sleep 3

# メインアプリケーションを起動
echo "🌐 メインアプリケーションを起動中..."
npm run dev &
APP_PID=$!

# 画像生成エージェントを起動
echo "🎨 画像生成エージェントを起動中..."
cd ai-article-imager-for-wordpress && npm run dev &
IMAGE_PID=$!
cd ..

# 起動完了メッセージ
echo ""
echo "✅ 起動完了！"
echo "📍 メインアプリ: http://localhost:5180"
echo "📍 スクレイピングサーバー: http://localhost:3003"
echo "📍 画像生成エージェント: http://localhost:5181"
echo "   - Google Search API: /api/google-search"
echo "   - Puppeteer Scraping: /api/scrape"
echo ""
echo "終了するには Ctrl+C を押してください"
echo ""

# 終了処理を設定
trap "echo ''; echo '⏹️  シャットダウン中...'; kill $SCRAPING_PID $APP_PID $IMAGE_PID 2>/dev/null; exit" INT

# プロセスの監視
wait $APP_PID $SCRAPING_PID $IMAGE_PID