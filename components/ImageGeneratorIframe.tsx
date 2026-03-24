/**
 * ImageGeneratorIframe - 画像生成エージェントのiframe埋め込みコンポーネント
 *
 * 同一タブ内で画像生成エージェントを表示し、postMessageで通信
 */

import React, { useEffect, useCallback } from "react";
import type { ImageAgentEmbedState } from "../hooks/useImageAgent";

interface ImageGeneratorIframeProps {
  /** 埋め込み状態 */
  embedState: ImageAgentEmbedState;
  /** iframeのref */
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  /** iframe読み込み完了時のコールバック */
  onLoad: () => void;
  /** エラー時のコールバック */
  onError: (error: string) => void;
  /** 閉じるボタンのコールバック */
  onClose: () => void;
  /** 別タブで開き直すコールバック */
  onReopenInNewTab: () => void;
  /** 高さ（デフォルト: 70vh） */
  height?: string;
}

export const ImageGeneratorIframe: React.FC<ImageGeneratorIframeProps> = ({
  embedState,
  iframeRef,
  onLoad,
  onError,
  onClose,
  onReopenInNewTab,
  height = "70vh",
}) => {
  // iframe読み込み完了ハンドラ
  const handleIframeLoad = useCallback(() => {
    console.log("✅ iframeの読み込みが完了しました");
    // 少し待ってからデータ送信（iframeのJSが初期化されるのを待つ）
    setTimeout(() => {
      onLoad();
    }, 2000);
  }, [onLoad]);

  // iframeエラーハンドラ
  const handleIframeError = useCallback(() => {
    console.error("❌ iframeの読み込みに失敗しました");
    onError("画像生成エージェントの読み込みに失敗しました");
  }, [onError]);

  // ESCキーで閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex flex-col">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-lg font-semibold text-gray-900">
            画像生成エージェント
          </span>
          {embedState.isLoading && (
            <span className="flex items-center text-sm text-blue-600">
              <svg
                className="animate-spin h-4 w-4 mr-2"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              読み込み中...
            </span>
          )}
          {embedState.articleData.autoMode && (
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
              自動実行モード
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* 別タブで開き直すボタン */}
          <button
            onClick={onReopenInNewTab}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors flex items-center"
            title="別タブで開き直す"
          >
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            別タブで開く
          </button>

          {/* 閉じるボタン */}
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-white hover:bg-red-500 rounded-md transition-colors flex items-center"
            title="閉じる (ESC)"
          >
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            閉じる
          </button>
        </div>
      </div>

      {/* エラー表示 */}
      {embedState.error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-red-700 text-sm">
          {embedState.error}
        </div>
      )}

      {/* iframe */}
      <div className="flex-1 bg-white overflow-hidden">
        <iframe
          ref={iframeRef}
          src={embedState.url}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          className="w-full h-full border-0"
          style={{ height }}
          title="画像生成エージェント"
          allow="clipboard-write"
        />
      </div>

      {/* フッター（キーワード情報） */}
      <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 text-sm text-gray-600">
        <span className="font-medium">処理中のキーワード:</span>{" "}
        {embedState.articleData.keyword}
        {embedState.articleData.spreadsheetRow && (
          <span className="ml-4">
            <span className="font-medium">行番号:</span>{" "}
            {embedState.articleData.spreadsheetRow}
          </span>
        )}
      </div>
    </div>
  );
};

export default ImageGeneratorIframe;
