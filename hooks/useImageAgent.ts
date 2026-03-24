/**
 * useImageAgent - 画像生成エージェント起動用の共通フック
 *
 * iframe埋め込みと別タブフォールバックの両方をサポート
 */

import { useCallback, useRef, useState } from "react";

export interface ArticleDataForImageAgent {
  title: string;
  content: string;  // htmlContent として送信される
  keyword: string;
  autoMode?: boolean;  // autoExecute として送信される
  spreadsheetRow?: number;
  queueIndex?: number;
  // 追加フィールド
  metaDescription?: string;
  slug?: string;
  isTestMode?: boolean;
  plainText?: string;
  score?: number;
}

export interface ImageAgentEmbedState {
  url: string;
  articleData: ArticleDataForImageAgent;
  isLoading: boolean;
  error: string | null;
}

export interface UseImageAgentOptions {
  /** iframe表示時のコールバック */
  onIframeOpen?: () => void;
  /** iframe閉じる時のコールバック */
  onIframeClose?: () => void;
  /** エラー時のコールバック */
  onError?: (error: string) => void;
  /** 完了時のコールバック */
  onComplete?: (success: boolean, data?: { row?: number; keyword?: string }) => void;
  /** タイムアウト（ミリ秒） - デフォルト5分 */
  timeout?: number;
}

export interface UseImageAgentReturn {
  /** iframe埋め込み状態 */
  embedState: ImageAgentEmbedState | null;
  /** iframeのref */
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  /** iframeで開く */
  openInIframe: (articleData: ArticleDataForImageAgent) => void;
  /** 別タブで開く（フォールバック） */
  openInNewTab: (articleData: ArticleDataForImageAgent) => Window | null;
  /** iframeを閉じる */
  closeIframe: () => void;
  /** iframeにデータを送信 */
  sendDataToIframe: () => void;
  /** 別タブで開き直す */
  reopenInNewTab: () => void;
  /** ローディング状態 */
  isLoading: boolean;
}

const DEFAULT_TIMEOUT = 5 * 60 * 1000; // 5分

export function useImageAgent(options: UseImageAgentOptions = {}): UseImageAgentReturn {
  const {
    onIframeOpen,
    onIframeClose,
    onError,
    onComplete,
    timeout = DEFAULT_TIMEOUT,
  } = options;

  const [embedState, setEmbedState] = useState<ImageAgentEmbedState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentArticleDataRef = useRef<ArticleDataForImageAgent | null>(null);

  // 画像生成エージェントのURL取得
  const getImageGenUrl = useCallback(() => {
    return (
      import.meta.env.VITE_IMAGE_GEN_URL ||
      "http://localhost:5177"
    );
  }, []);

  // タイムアウトをクリア
  const clearTimeoutTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // タイムアウトを設定
  const setTimeoutTimer = useCallback(() => {
    clearTimeoutTimer();
    timeoutRef.current = setTimeout(() => {
      console.warn("⏰ 画像生成エージェントがタイムアウトしました");
      if (onError) {
        onError("画像生成エージェントがタイムアウトしました（5分経過）");
      }
      // タイムアウト時は完了扱いで次へ進む
      if (onComplete) {
        onComplete(false, {
          row: currentArticleDataRef.current?.spreadsheetRow,
          keyword: currentArticleDataRef.current?.keyword,
        });
      }
    }, timeout);
  }, [clearTimeoutTimer, onError, onComplete, timeout]);

  // iframeで開く
  const openInIframe = useCallback(
    (articleData: ArticleDataForImageAgent) => {
      const url = getImageGenUrl();
      console.log("🖼️ 画像生成エージェントをiframeで開きます:", url);

      currentArticleDataRef.current = articleData;
      setIsLoading(true);
      setEmbedState({
        url,
        articleData,
        isLoading: true,
        error: null,
      });

      if (onIframeOpen) {
        onIframeOpen();
      }

      // タイムアウト設定
      setTimeoutTimer();
    },
    [getImageGenUrl, onIframeOpen, setTimeoutTimer]
  );

  // 別タブで開く（フォールバック）
  const openInNewTab = useCallback(
    (articleData: ArticleDataForImageAgent): Window | null => {
      const url = getImageGenUrl();
      console.log("🔗 画像生成エージェントを別タブで開きます:", url);

      currentArticleDataRef.current = articleData;

      const newWindow = window.open(
        url,
        "_blank",
        "width=1200,height=800,scrollbars=yes,resizable=yes"
      );

      if (newWindow) {
        // 3秒後にデータ送信
        setTimeout(() => {
          console.log("📤 記事データを画像生成エージェントに送信中...");
          // 画像生成エージェントが期待する形式: { type: "ARTICLE_DATA", data: { htmlContent, ... } }
          const messageData = {
            type: "ARTICLE_DATA",
            data: {
              title: articleData.title,
              htmlContent: articleData.content, // content → htmlContent
              keyword: articleData.keyword,
              autoExecute: articleData.autoMode, // autoMode → autoExecute
              spreadsheetRow: articleData.spreadsheetRow,
              queueIndex: articleData.queueIndex,
              metaDescription: articleData.metaDescription,
              slug: articleData.slug,
              isTestMode: articleData.isTestMode,
              plainText: articleData.plainText,
              score: articleData.score,
            },
          };
          newWindow.postMessage(messageData, url);
          console.log("✅ 記事データ送信完了！");
        }, 3000);
      } else {
        console.error("❌ 画像生成エージェントの起動に失敗しました");
        if (onError) {
          onError("ポップアップがブロックされました。ブラウザの設定を確認してください。");
        }
      }

      return newWindow;
    },
    [getImageGenUrl, onError]
  );

  // iframeにデータを送信
  const sendDataToIframe = useCallback(() => {
    if (!iframeRef.current || !embedState) {
      console.warn("⚠️ iframeまたはembedStateが存在しません");
      return;
    }

    const contentWindow = iframeRef.current.contentWindow;
    if (!contentWindow) {
      console.warn("⚠️ iframeのcontentWindowが取得できません");
      return;
    }

    // 画像生成エージェントが期待する形式に変換
    // { type: "ARTICLE_DATA", data: { htmlContent, title, keyword, ... } }
    const articleData = embedState.articleData;
    const messageData = {
      type: "ARTICLE_DATA",
      data: {
        title: articleData.title,
        htmlContent: articleData.content, // content → htmlContent
        keyword: articleData.keyword,
        autoExecute: articleData.autoMode, // autoMode → autoExecute
        spreadsheetRow: articleData.spreadsheetRow,
        queueIndex: articleData.queueIndex,
        // 追加フィールド
        metaDescription: articleData.metaDescription,
        slug: articleData.slug,
        isTestMode: articleData.isTestMode,
        plainText: articleData.plainText,
        score: articleData.score,
      },
    };

    console.log("📤 iframeに記事データを送信中...", messageData);
    contentWindow.postMessage(messageData, embedState.url);
    console.log("✅ iframeへのデータ送信完了！");

    setEmbedState((prev) =>
      prev ? { ...prev, isLoading: false } : null
    );
    setIsLoading(false);
  }, [embedState]);

  // iframeを閉じる
  const closeIframe = useCallback(() => {
    console.log("🚪 iframeを閉じます");
    clearTimeoutTimer();
    setEmbedState(null);
    setIsLoading(false);
    currentArticleDataRef.current = null;

    if (onIframeClose) {
      onIframeClose();
    }
  }, [clearTimeoutTimer, onIframeClose]);

  // 別タブで開き直す
  const reopenInNewTab = useCallback(() => {
    if (!currentArticleDataRef.current) {
      console.warn("⚠️ 送信するデータがありません");
      return;
    }

    const articleData = currentArticleDataRef.current;
    closeIframe();
    openInNewTab(articleData);
  }, [closeIframe, openInNewTab]);

  return {
    embedState,
    iframeRef,
    openInIframe,
    openInNewTab,
    closeIframe,
    sendDataToIframe,
    reopenInNewTab,
    isLoading,
  };
}

export default useImageAgent;
