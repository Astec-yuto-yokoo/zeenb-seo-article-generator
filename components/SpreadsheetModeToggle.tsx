import React, { useState } from "react";

interface SpreadsheetModeToggleProps {
  onModeChange: (isSpreadsheetMode: boolean) => void;
  disabled?: boolean;
}

export const SpreadsheetModeToggle: React.FC<SpreadsheetModeToggleProps> = ({
  onModeChange,
  disabled = false,
}) => {
  const [isSpreadsheetMode, setIsSpreadsheetMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);
    const newMode = !isSpreadsheetMode;

    try {
      setIsSpreadsheetMode(newMode);
      onModeChange(newMode);
    } catch (error) {
      console.error("モード変更エラー:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center space-x-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center">
        <input
          type="checkbox"
          id="spreadsheet-mode"
          checked={isSpreadsheetMode}
          onChange={handleToggle}
          disabled={disabled || isLoading}
          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
        />
        <label
          htmlFor="spreadsheet-mode"
          className="ml-2 text-sm font-medium text-gray-800 cursor-pointer"
        >
          スプレッドシートモード
        </label>
      </div>

      <div className="text-xs text-gray-500">
        {isSpreadsheetMode ? (
          <span className="text-blue-600 font-medium">
            Google Sheetsからキーワードを取得
          </span>
        ) : (
          <span className="text-gray-500">手動でキーワード入力</span>
        )}
      </div>

      {isLoading && (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
      )}
    </div>
  );
};
