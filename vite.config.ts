import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// クライアントバンドルに埋め込む「非機密のダミーGeminiキー」。
// 実キーではない。30文字以上・"PLACEHOLDER"を含まない（各サービスの起動時ガードを通すため）。
const GEMINI_CLIENT_PLACEHOLDER = "gemini-proxied-via-server-side-no-secret";

export default defineConfig(({ mode }) => {
  // Load environment variables from .env files
  const env = loadEnv(mode, process.cwd(), "");

  // Log for debugging (本番環境では出力しない)
  if (mode !== "production") {
    console.log("Vite config - Mode:", mode);
    console.log("Vite config - GEMINI_API_KEY loaded:", !!env.GEMINI_API_KEY);
    console.log(
      "Vite config - GEMINI_API_KEY value:",
      env.GEMINI_API_KEY ? "****" : "NOT FOUND"
    );
  }

  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: 5180,
      strictPort: true,
      proxy: {
        "/api": {
          target: "http://localhost:3003",
          changeOrigin: true,
          secure: false,
        },
      },
    },
    define: {
      // セキュリティ：Gemini APIキーはブラウザに焼き込まない。
      // 実キーはサーバー(/api/gemini-proxy)のみが保持する。
      // ここでは実キーの代わりに「非機密のダミー文字列」を注入する。
      //   - services/*.ts の起動時ガード（未設定チェック・30文字未満チェック等）を通すため
      //   - process.env.* を参照しているクライアントコードの ReferenceError を防ぐため
      // 実際のGemini呼び出しは services/geminiSdkShim.ts が全てプロキシ経由に差し替える。
      "process.env.GEMINI_API_KEY": JSON.stringify(GEMINI_CLIENT_PLACEHOLDER),
      "process.env.API_KEY": JSON.stringify(GEMINI_CLIENT_PLACEHOLDER),
      "import.meta.env.VITE_INTERNAL_API_KEY": JSON.stringify(
        env.VITE_INTERNAL_API_KEY || ""
      ),
      "import.meta.env.VITE_API_URL": JSON.stringify(env.VITE_API_URL || ""),
      // Gemini / Google Search APIキーはサーバー側でのみ使用（セキュリティのため）
    },
    resolve: {
      // 注意：@google/generative-ai は完全一致でのみ shim に差し替える。
      // deep import（.../dist/index.mjs）は shim 自身が実体を読むため除外する。
      alias: [
        {
          find: /^@google\/generative-ai$/,
          replacement: path.resolve(__dirname, "services/geminiSdkShim.ts"),
        },
        { find: "@", replacement: path.resolve(__dirname, ".") },
      ],
    },
  };
});
