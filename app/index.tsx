import { Redirect } from "expo-router";
import { useAuthStore } from "@/shared/store/authStore";

/**
 * Trang gốc "/": chưa hydrate hoặc chưa đăng nhập → login;
 * đã đăng nhập → (tabs). Đảm bảo mở web luôn đi đúng trang.
 */
export default function Index() {
    const { accessToken, isHydrated } = useAuthStore();

    if (!isHydrated) {
        return null;
    }
    if (accessToken) {
        return <Redirect href="/(tabs)" />;
    }
    return <Redirect href="/(auth)/login" />;
}
