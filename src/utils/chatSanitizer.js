// clear text
function tryParseJsonObjectFromString(s) {
    if (!s) return null;

    // tìm đoạn {...} đầu tiên có vẻ là json
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;

    const candidate = s.slice(start, end + 1);

    // thử parse thẳng
    try {
        return JSON.parse(candidate);
    } catch {
        // fallback: đôi khi key dùng 'image_url' ok, nhưng có trailing comma... -> thử vá nhẹ
        try {
            const repaired = candidate
                .replace(/,\s*}/g, "}")
                .replace(/,\s*]/g, "]");
            return JSON.parse(repaired);
        } catch {
            return null;
        }
    }
}

function cleanLines(text) {
    const lines = String(text || "")
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((l) => l.trim());

    const cleaned = [];
    for (const line of lines) {
        if (!line) continue; // ✅ bỏ dòng trống

        // ✅ bỏ các dòng time/meta
        if (/^time\s*:/i.test(line)) continue;
        if (/asia\/ho_chi_minh/i.test(line)) continue;

        // ✅ bỏ dòng chỉ có 1 ký tự kiểu "P"
        if (/^[A-Za-zÀ-ỹ]$/.test(line)) continue;

        // ✅ bỏ các dòng label UI
        if (/^(page|user|assistant|bot)$/i.test(line)) continue;

        // ✅ bỏ dòng timestamp kiểu "• 20:49 17-12" / "20:49 17-12" / "20:49"
        if (/^•?\s*\d{1,2}:\d{2}(\s+\d{1,2}-\d{1,2})?$/i.test(line)) continue;

        // ✅ bỏ dấu ngoặc đơn/khối JSON đơn độc
        if (line === "{" || line === "}" || line === "[]") continue;

        cleaned.push(line);
    }

    // gộp lại, và nén nhiều dòng trống thành 1 dòng (đã bỏ trống rồi nên chỉ join)
    return cleaned.join("\n").trim();
}

/**
 * ✅ Hàm chính: nhận rawText -> trả { text, imageUrl }
 * - bóc JSON nếu có { "text": "...", "image_url": [...] }
 * - loại bỏ dòng Time..., meta lines, {},...
 */
export function extractCleanTextAndImage(rawText) {
    let s = String(rawText || "").replace(/^"+|"+$/g, "").trim();
    if (!s) return { text: "", imageUrl: "" };

    // 1) nếu có JSON -> parse lấy text + image_url
    const obj = tryParseJsonObjectFromString(s);
    if (obj && (typeof obj.text === "string" || obj.image_url != null || obj.imageUrl != null)) {
        const t = typeof obj.text === "string" ? obj.text : "";
        const arr =
            Array.isArray(obj.image_url) ? obj.image_url :
                Array.isArray(obj.imageUrl) ? obj.imageUrl :
                    Array.isArray(obj.images) ? obj.images :
                        [];

        const imageUrl = arr.find((x) => typeof x === "string" && x.trim())?.trim() || "";
        return {
            text: cleanLines(t),
            imageUrl,
        };
    }

    // 2) không có JSON -> dọn dòng meta trực tiếp
    // bỏ citations kiểu 【...】
    s = s.replace(/【.*?】/g, "").trim();

    // nếu text có lẫn { } mà không parse được, cắt bỏ phần từ "{" trở đi để khỏi lòi json
    const brace = s.indexOf("{");
    if (brace !== -1) s = s.slice(0, brace).trim();

    return { text: cleanLines(s), imageUrl: "" };
}

//