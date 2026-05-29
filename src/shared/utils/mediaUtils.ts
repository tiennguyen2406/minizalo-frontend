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

    // --- 1. Xử lý đường dẫn tương đối (ví dụ: minizalo-bucket/files/...) ---
    if (!finalUrl.startsWith("http") && !finalUrl.startsWith("file://") && !finalUrl.startsWith("data:")) {
        const apiFullUrl = process.env?.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:8080/api";
        
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
    if (finalUrl.startsWith("http")) {
        // Thay thế localhost hoặc 127.0.0.1
        if ((finalUrl.includes("localhost") || finalUrl.includes("127.0.0.1")) && process.env.EXPO_PUBLIC_API_URL) {
            const match = process.env.EXPO_PUBLIC_API_URL.match(/https?:\/\/([^:\/]+)/);
            if (match && match[1]) {
                finalUrl = finalUrl.replace("localhost", match[1]).replace("127.0.0.1", match[1]);
            }
        }

        // Xử lý IP address local network (192.168.x.x, 10.0.2.2, vv)
        if (process.env.EXPO_PUBLIC_API_URL) {
            const apiMatch = process.env.EXPO_PUBLIC_API_URL.match(/https?:\/\/([^:\/]+)/);
            if (apiMatch && apiMatch[1]) {
                const apiHost = apiMatch[1];
                
                // Đồng bộ host cho tất cả các request đến local network
                const urlMatch = finalUrl.match(/https?:\/\/([^:\/]+)(?::(\d+))?/);
                if (urlMatch && urlMatch[1] !== apiHost) {
                     // Nếu host hiện tại là một IP local hoặc localhost/127.0.0.1
                     if (/^(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.)/.test(urlMatch[1])) {
                        finalUrl = finalUrl.replace(urlMatch[1], apiHost);
                     }
                }
            }
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
