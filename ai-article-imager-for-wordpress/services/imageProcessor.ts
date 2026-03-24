/**
 * 写真風の後処理を適用する。
 *
 * 参考画像トーン: 明るく爽やかな日本のストックフォト風
 *
 * 1. 明度微増 + 彩度微増 + コントラスト微増 — 明るく鮮やかに
 * 2. フィルムグレイン（控えめ）             — デジタル臭さを軽減
 * 3. ビネット（ごく軽く）                   — 自然なレンズ感
 *
 * Canvas API のみで完結するためブラウザ上で動作する。
 */
export const applyPhotoPostProcessing = (imageBase64: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        var img = new Image();
        img.onload = function () {
            var w = img.width;
            var h = img.height;

            var canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext("2d");

            if (!ctx) {
                return reject(new Error("Could not get canvas context for post-processing"));
            }

            // === 元画像を描画 ===
            ctx.drawImage(img, 0, 0);

            // === 1. 明度微増 + 彩度微増 + コントラスト微増 ===
            // brightness: 1.02 (2%明るく — 白飛び防止), saturate: 1.02, contrast: 1.01
            ctx.filter = "brightness(1.02) saturate(1.02) contrast(1.01)";
            ctx.drawImage(canvas, 0, 0);
            ctx.filter = "none";

            // === 2. フィルムグレイン（控えめ） ===
            var imageData = ctx.getImageData(0, 0, w, h);
            var pixels = imageData.data;
            var grainIntensity = 6; // 控えめなノイズ

            for (var i = 0; i < pixels.length; i += 4) {
                var noise = (Math.random() - 0.5) * 2 * grainIntensity;
                pixels[i] = Math.min(255, Math.max(0, pixels[i] + noise));         // R
                pixels[i + 1] = Math.min(255, Math.max(0, pixels[i + 1] + noise)); // G
                pixels[i + 2] = Math.min(255, Math.max(0, pixels[i + 2] + noise)); // B
            }
            ctx.putImageData(imageData, 0, 0);

            // === 3. ビネット（ごく軽く） ===
            var centerX = w / 2;
            var centerY = h / 2;
            var radius = Math.sqrt(centerX * centerX + centerY * centerY);

            var gradient = ctx.createRadialGradient(
                centerX, centerY, radius * 0.6,  // 内側（透明開始）— 広めに取る
                centerX, centerY, radius          // 外側
            );
            gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
            gradient.addColorStop(1, "rgba(0, 0, 0, 0.10)"); // 0.25 → 0.10 に大幅軽減

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, w, h);

            console.log("🎞️ 写真後処理完了 (" + w + "x" + h + ")");
            resolve(canvas.toDataURL("image/jpeg", 0.92));
        };
        img.onerror = function () {
            reject(new Error("Failed to load image for post-processing."));
        };
        img.src = imageBase64;
    });
};

export const ensure16x9 = (imageBase64: string, targetWidth: number, targetHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                return reject(new Error('Could not get canvas context'));
            }

            const w = img.width;
            const h = img.height;
            const targetRatio = targetWidth / targetHeight;
            const currentRatio = w / h;

            let sx = 0, sy = 0, sWidth = w, sHeight = h;

            if (Math.abs(currentRatio - targetRatio) > 1e-3) {
                if (currentRatio > targetRatio) { // Image is wider than target
                    sWidth = h * targetRatio;
                    sx = (w - sWidth) / 2;
                } else { // Image is taller than target
                    sHeight = w / targetRatio;
                    sy = (h - sHeight) / 2;
                }
            }
            
            ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
            resolve(canvas.toDataURL('image/jpeg', 0.92));
        };
        img.onerror = () => {
            reject(new Error('Failed to load image for processing.'));
        };
        img.src = imageBase64;
    });
};
