export const getImageUrl = (url: string | null | undefined): string => {
    if (!url) return "";
    
    // Nếu URL chứa localhost hoặc các dải IP nội bộ, và có EXPO_PUBLIC_API_URL, ta sẽ thay thế host
    if (process.env.EXPO_PUBLIC_API_URL) {
        const match = process.env.EXPO_PUBLIC_API_URL.match(/https?:\/\/([^:\/]+)/);
        if (match && match[1]) {
            const apiHost = match[1];
            // Thay thế localhost hoặc các dải IP nội bộ thành IP hiện tại của API
            return url.replace(/(https?:\/\/)(localhost|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+)/, `$1${apiHost}`);
        }
    }
    return url;
};
