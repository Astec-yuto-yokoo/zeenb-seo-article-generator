import React, { useState, useEffect } from "react";
import {
  ReferenceMaterial,
  listMaterials,
  formatFileSize,
} from "../services/referenceMaterialService";

interface ReferenceMaterialSelectorProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

/**
 * 参考資料選択ウィジェット
 * 構成生成・執筆画面に埋め込む
 */
export default function ReferenceMaterialSelector({
  selectedIds,
  onSelectionChange,
}: ReferenceMaterialSelectorProps) {
  const [materials, setMaterials] = useState<ReferenceMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await listMaterials();
        setMaterials(data);
        setError("");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError("参考資料の取得に失敗: " + msg);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleToggle = (id: string) => {
    const isSelected = selectedIds.indexOf(id) !== -1;
    if (isSelected) {
      onSelectionChange(
        selectedIds.filter(function (sid) {
          return sid !== id;
        })
      );
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === materials.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(
        materials.map(function (m) {
          return m.id;
        })
      );
    }
  };

  if (loading) {
    return (
      <div className="text-xs text-gray-400 py-2">参考資料を確認中...</div>
    );
  }

  if (materials.length === 0) {
    return null;
  }

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
    <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
      {/* ヘッダー（折りたたみトグル） */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-blue-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{"\uD83D\uDCDA"}</span>
          <span className="text-sm font-medium text-blue-800">
            参考資料を選択
          </span>
          {selectedIds.length > 0 && (
            <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
              {selectedIds.length}件選択中
            </span>
          )}
        </div>
        <span className="text-blue-500 text-xs">
          {expanded ? "\u25B2" : "\u25BC"}
        </span>
      </button>

      {/* 展開時のコンテンツ */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-blue-200">
          {error && (
            <p className="text-xs text-red-500 py-2">{error}</p>
          )}

          {/* 全選択/解除 */}
          <div className="py-2 border-b border-blue-100">
            <button
              onClick={handleSelectAll}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              {selectedIds.length === materials.length
                ? "すべて解除"
                : "すべて選択"}
            </button>
          </div>

          {/* 資料リスト */}
          <div className="max-h-48 overflow-y-auto">
            {materials.map(function (m) {
              var isSelected = selectedIds.indexOf(m.id) !== -1;
              return (
                <label
                  key={m.id}
                  className={
                    "flex items-center gap-3 py-2 px-1 rounded cursor-pointer hover:bg-blue-100 transition-colors " +
                    (isSelected ? "bg-blue-100" : "")
                  }
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggle(m.id)}
                    className="rounded border-blue-300 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm">{getFileIcon(m.fileType)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{m.title}</p>
                    <p className="text-xs text-gray-400">
                      {formatFileSize(m.fileSize)} /{" "}
                      {m.extractedTextLength.toLocaleString()} 文字
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
