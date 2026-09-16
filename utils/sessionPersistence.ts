/**
 * 作業状態（セッション）の永続化
 *
 * 目的: ページ再読み込み・タブ破棄・Vite開発サーバー再接続などで React の state が消えても、
 *       競合調査 → 構成案 → 記事 の進捗を localStorage から復元し、初期画面に戻らないようにする。
 *
 * 保存対象は App.tsx のメインフロー state のみ（実行中フラグ・キュー状態・モーダル開閉は保存しない）。
 * 記事ドラフト（ArticleWriter）の自動保存とは別物（そちらは articleWriter_draft_* キー）。
 */
import type {
  SeoOutline,
  SeoOutlineV2,
  CompetitorResearchResult,
  GroundingChunk,
  StrategicKeywordList,
  TrendKeywordList,
} from "../types";

export const SESSION_STORAGE_KEY = "zeenbSeoSession_v1";
export const SESSION_MAX_AGE_HOURS = 48;
const SESSION_VERSION = 1;

export type SessionActiveTab =
  | "research"
  | "frequency"
  | "outline"
  | "article"
  | "references";

export interface PersistedGeneratedArticle {
  title: string;
  metaDescription: string;
  htmlContent: string;
  plainText: string;
}

export interface PersistedSession {
  version: number;
  savedAt: string;
  keyword: string;
  outline: SeoOutline | null;
  outlineV2: SeoOutlineV2 | null;
  competitorResearch: CompetitorResearchResult | null;
  sources: GroundingChunk[] | undefined;
  activeTab: SessionActiveTab;
  mainMode: "article" | "keyword";
  isV2Mode: boolean;
  writingMode: "v2" | "v3";
  generatedArticle: PersistedGeneratedArticle | null;
  strategicKeywords: StrategicKeywordList | null;
  trendKeywords: TrendKeywordList | null;
  selectedRefMaterialIds: string[];
  refMaterialContext: string;
}

export type SessionSnapshot = Omit<PersistedSession, "version" | "savedAt">;

function storageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch (e) {
    return false;
  }
}

/** 保存する価値がある進捗があるか（何もなければ保存しない＝空セッションで上書きしない） */
export function hasMeaningfulProgress(snapshot: SessionSnapshot): boolean {
  if (snapshot.outline || snapshot.outlineV2 || snapshot.competitorResearch) return true;
  if (snapshot.generatedArticle) return true;
  if (snapshot.strategicKeywords || snapshot.trendKeywords) return true;
  return false;
}

export function loadSession(): PersistedSession | null {
  if (!storageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    if (!parsed || parsed.version !== SESSION_VERSION || !parsed.savedAt) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    const ageHours =
      (Date.now() - new Date(parsed.savedAt).getTime()) / (1000 * 60 * 60);
    if (!(ageHours >= 0 && ageHours < SESSION_MAX_AGE_HOURS)) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch (e) {
    console.warn("⚠️ 作業状態の読み込みに失敗したため破棄します:", e);
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e2) {
      // noop
    }
    return null;
  }
}

export function saveSession(snapshot: SessionSnapshot): boolean {
  if (!storageAvailable()) return false;
  const data: PersistedSession = {
    ...snapshot,
    version: SESSION_VERSION,
    savedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    // 容量超過時は競合調査の詳細を落として再試行（構成案・記事を優先して残す）
    try {
      const slim: PersistedSession = {
        ...data,
        competitorResearch: null,
        sources: undefined,
      };
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(slim));
      console.warn("⚠️ 作業状態の保存: 容量不足のため競合調査結果を除いて保存しました");
      return true;
    } catch (e2) {
      console.warn("⚠️ 作業状態の保存に失敗しました（容量不足）");
      return false;
    }
  }
}

export function clearSession(): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (e) {
    // noop
  }
}

export function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => (n < 10 ? "0" + n : String(n));
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
