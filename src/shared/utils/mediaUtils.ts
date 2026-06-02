/**
 * Chuyển đổi URL ảnh từ backend thành URL có thể truy cập được trên mobile/web.
 * Xử lý: 
 * 1. Thay thế localhost/127.0.0.1 bằng IP thực tế của API (nếu có EXPO_PUBLIC_API_URL).
 * 2. Xử lý đường dẫn tương đối từ MinIO (ví dụ: minizalo-bucket/stories/...) thành URL tuyệt đối.
 * 3. Encode URI để tránh lỗi với các ký tự đặc biệt/khoảng trắng.
 */
export const getImageUrl = (url: string | null | undefined): string => {
    if (!url) return "";
    
    let finalUrl = url.trim();

    // --- 0. Special rewrite for AWS S3 bucket (production) ---
    const bucketMatch = finalUrl.match(/(minizalo-bucket-nhomcodex-[a-zA-Z0-9-]+)/);
    if (bucketMatch) {
        const matchedBucket = bucketMatch[1];
        const idx = finalUrl.indexOf(matchedBucket);
        if (idx !== -1) {
            const relativePath = finalUrl.substring(idx + matchedBucket.length).replace(/^\/+/, "");
            return `https://s3.ap-southeast-1.amazonaws.com/${matchedBucket}/${relativePath}`;
        }
    }

    // --- 1. Xử lý đường dẫn tương đối (ví dụ: minizalo-bucket/files/...) ---
    if (!finalUrl.startsWith("http") && !finalUrl.startsWith("file://") && !finalUrl.startsWith("data:")) {
        const apiFullUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:8080/api";
        
        // Cố gắng suy luận URL MinIO: thay thế port 8080 bằng 9000 nếu có
        let minioBase = apiFullUrl.replace("/api", "").replace(":8080", ":9000");
        
        if (!minioBase.includes(":9000") && !minioBase.includes(":443") && !minioBase.includes(":80")) {
            // Nếu không có port, thử lấy host và thêm :9000
            const urlObj = apiFullUrl.split("/");
            if (urlObj.length >= 3) {
                const hostPart = urlObj[2].split(":")[0];
                minioBase = `${urlObj[0]}//${hostPart}:9000`;
            }
        }
        
        // Xử lý dấu gạch chéo ở đầu URL tương đối để tránh double slash
        const sanitizedUrl = finalUrl.startsWith("/") ? finalUrl.substring(1) : finalUrl;
        finalUrl = `${minioBase.replace(/\/+$/, "")}/${sanitizedUrl}`;
    }

    // --- 2. Xử lý host tuyệt đối (localhost/IP fixes cho Mobile) ---
    if (finalUrl.startsWith("http") && process.env.EXPO_PUBLIC_API_URL) {
        try {
            const apiUri = new URL(process.env.EXPO_PUBLIC_API_URL);
            const apiProtocol = apiUri.protocol; // "http:" hoặc "https:"
            const apiHostname = apiUri.hostname; // ví dụ: "minizalo-api.vercel.app" hoặc "192.168.1.147"
            
            const finalUri = new URL(finalUrl);
            const finalHostname = finalUri.hostname;
            
            // Kiểm tra xem URL đích có phải IP cục bộ hoặc localhost không
            const isLocalHost = /^(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.)/.test(finalHostname);
            
            if (isLocalHost && finalHostname !== apiHostname) {
                // Thay thế host cục bộ bằng host từ EXPO_PUBLIC_API_URL
                finalUri.hostname = apiHostname;
                
                // Nếu apiHost là domain ngoài (không phải IP local), đổi sang https và xóa cổng (:9000 / :8080)
                const isApiLocal = /^(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.)/.test(apiHostname);
                if (!isApiLocal && apiProtocol === "https:") {
                    finalUri.protocol = "https:";
                    finalUri.port = ""; // Bỏ cổng để trỏ qua HTTPS chuẩn
                }
                
                finalUrl = finalUri.toString();
            }
        } catch (e) {
            console.error("Lỗi parse URL trong getImageUrl:", e);
        }
    }

    // --- 3. Encode URI ---
    try {
        // Chỉ encode nếu chứa ký tự không hợp lệ cho URL
        if (/[^a-zA-Z0-9$_.+!*'(),;/?:@&=%-]/.test(finalUrl)) {
            return encodeURI(finalUrl);
        }
    } catch (e) {
        console.error("Encoding error in getImageUrl:", e);
    }

    return finalUrl;
};
