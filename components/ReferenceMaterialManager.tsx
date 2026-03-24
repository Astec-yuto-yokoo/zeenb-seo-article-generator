import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ReferenceMaterial,
  uploadMaterial,
  listMaterials,
  getExtractedText,
  deleteMaterial,
  formatFileSize,
} from "../services/referenceMaterialService";

/**
 * 参考資料管理タブ
 * アップロード・一覧・プレビュー・削除
 */
export default function ReferenceMaterialManager() {
  const [materials, setMaterials] = useState<ReferenceMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>("");
  const [previewText, setPreviewText] = useState<string>("");
  const [previewTitle, setPreviewTitle] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // アップロードフォーム
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 一覧取得
  const fetchMaterials = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listMaterials();
      setMaterials(data);
      setError("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError("一覧の取得に失敗しました: " + msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  // アップロード処理
  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      setError("");

      const tags = uploadTags
        ? uploadTags.split(",").map(function (t) {
            return t.trim();
          })
        : [];

      await uploadMaterial(
        file,
        uploadTitle || undefined,
        uploadDescription || undefined,
        tags.length > 0 ? tags : undefined
      );

      // フォームリセット
      setUploadTitle("");
      setUploadDescription("");
      setUploadTags("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await fetchMaterials();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError("アップロードに失敗しました: " + msg);
    } finally {
      setUploading(false);
    }
  };

  // ファイル選択
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleUpload(files[0]);
    }
  };

  // ドラッグ&ドロップ
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleUpload(files[0]);
    }
  };

  // プレビュー
  const handlePreview = async (id: string) => {
    try {
      const data = await getExtractedText(id);
      setPreviewTitle(data.title || data.originalFileName);
      setPreviewText(data.extractedText);
      setShowPreview(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError("プレビューの取得に失敗しました: " + msg);
    }
  };

  // 削除
  const handleDelete = async (id: string, fileName: string) => {
    if (!confirm(fileName + " を削除しますか？")) return;

    try {
      await deleteMaterial(id);
      await fetchMaterials();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError("削除に失敗しました: " + msg);
    }
  };

  // ファイルタイプのアイコン
  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case "pdf":
        return "\uD83D\uDCC4";
      case "csv":
        return "\uD83D\uDCCA";
      default:
        return "\uD83D\uDCDD";
    }
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">
          参考資料（独自情報ソース）
        </h2>
        <span className="text-sm text-gray-500">
          {materials.length} 件の資料
        </span>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
          <button
            onClick={() => setError("")}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            x
          </button>
        </div>
      )}

      {/* アップロードエリア */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          資料をアップロード
        </h3>

        {/* タイトル・説明・タグ入力 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <input
            type="text"
            placeholder="タイトル（任意）"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="text"
            placeholder="説明（任意）"
            value={uploadDescription}
            onChange={(e) => setUploadDescription(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="text"
            placeholder="タグ（カンマ区切り、任意）"
            value={uploadTags}
            onChange={(e) => setUploadTags(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* ドラッグ&ドロップエリア */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={
            "border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 " +
            (dragActive
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-gray-400 bg-gray-50")
          }
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="text-sm text-gray-600">アップロード中...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <span className="text-3xl">
                {dragActive ? "\uD83D\uDCE5" : "\uD83D\uDCC1"}
              </span>
              <p className="text-sm text-gray-600">
                ファイルをドラッグ&ドロップ、または
              </p>
              <label className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-blue-600 transition-colors">
                ファイルを選択
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-gray-400">
                対応形式: PDF, TXT, CSV（最大20MB）
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 資料一覧 */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">読み込み中...</div>
      ) : materials.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center">
          <span className="text-4xl block mb-3">{"\uD83D\uDCDA"}</span>
          <p className="text-gray-600 font-medium">
            参考資料がまだ登録されていません
          </p>
          <p className="text-sm text-gray-400 mt-1">
            PDF、テキスト、CSVファイルをアップロードして、記事生成時に活用できます
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {materials.map(function (m) {
            return (
              <div
                key={m.id}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl flex-shrink-0">
                      {getFileIcon(m.fileType)}
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-medium text-gray-800 text-sm truncate">
                        {m.title}
                      </h4>
                      <p className="text-xs text-gray-400 truncate">
                        {m.originalFileName}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-500 flex-shrink-0">
                    {m.fileType.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                  <span>{formatFileSize(m.fileSize)}</span>
                  <span>{m.extractedTextLength.toLocaleString()} 文字</span>
                  <span>
                    {new Date(m.uploadedAt).toLocaleDateString("ja-JP")}
                  </span>
                </div>

                {m.tags && m.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {m.tags.map(function (tag, idx) {
                      return (
                        <span
                          key={idx}
                          className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded"
                        >
                          {tag}
                        </span>
                      );
                    })}
                  </div>
                )}

                {m.description && (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                    {m.description}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handlePreview(m.id)}
                    className="flex-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    プレビュー
                  </button>
                  <button
                    onClick={() => handleDelete(m.id, m.originalFileName)}
                    className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    削除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* プレビューモーダル */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-800">{previewTitle}</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                x
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
                {previewText.length > 5000
                  ? previewText.substring(0, 5000) + "\n\n...（以下省略）"
                  : previewText}
              </pre>
            </div>
            <div className="p-4 border-t text-right">
              <span className="text-xs text-gray-400 mr-4">
                {previewText.length.toLocaleString()} 文字
              </span>
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
