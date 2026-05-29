import React, { useEffect, useState } from "react";
import { Redirect, useRouter } from "expo-router";
import { Platform } from "react-native";
import { ActivityIndicator, View } from "react-native";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/shared/store/authStore";
import { userService } from "@/shared/services/userService";

const ADMIN_ROLE = "ROLE_ADMIN";

export default function AdminLoginWeb() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);
  const { accessToken, user, isHydrated } = useAuthStore();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const checkExistingSession = async () => {
      if (!isHydrated) return;

      if (!accessToken) {
        setCheckingSession(false);
        return;
      }

      try {
        let roles = user?.roles || [];
        if (!user) {
          const profile = await userService.getProfile();
          setUser({
            id: profile.id,
            username: profile.username,
            fullName: profile.displayName || profile.username,
            avatarUrl: profile.avatarUrl || undefined,
            roles: profile.roles || [],
          });
          roles = profile.roles || [];
        }

        if (roles.includes(ADMIN_ROLE)) {
          router.replace("/admin");
          return;
        }
      } catch {
        // Session invalid — show login form
      } finally {
        setCheckingSession(false);
      }
    };

    void checkExistingSession();
  }, [isHydrated, accessToken, user, router, setUser]);

  const handleLogin = async () => {
    setError("");
    if (!username.trim()) {
      setError("Vui lòng nhập số điện thoại hoặc email");
      return;
    }
    if (!password) {
      setError("Vui lòng nhập mật khẩu");
      return;
    }

    setLoading(true);
    try {
      await login({ username: username.trim(), password });

      const profile = await userService.getProfile();
      const roles = profile.roles || [];

      setUser({
        id: profile.id,
        username: profile.username,
        fullName: profile.displayName || profile.username,
        avatarUrl: profile.avatarUrl || undefined,
        roles,
      });

      if (!roles.includes(ADMIN_ROLE)) {
        setError("Tài khoản này không có quyền quản trị (ROLE_ADMIN).");
        return;
      }

      router.replace("/admin");
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchAccount = async () => {
    setError("");
    setLoading(true);
    try {
      await logout();
      setUsername("");
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  if (Platform.OS !== "web") return null;

  if (!isHydrated || checkingSession) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0b1120" }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (user?.roles?.includes(ADMIN_ROLE) && accessToken) {
    return <Redirect href="/admin" />;
  }

  const loggedInAsNonAdmin = Boolean(accessToken && user && !user.roles?.includes(ADMIN_ROLE));

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#0b1120] text-gray-100 font-sans">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 mb-5">
            <ShieldCheck size={32} strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">MiniZalo Admin</h1>
          <p className="text-slate-400 text-sm">Đăng nhập để truy cập trang quản trị hệ thống</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#111827]/80 backdrop-blur-xl p-8 shadow-2xl">
          {loggedInAsNonAdmin && (
            <div className="mb-5 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm">
              Bạn đang đăng nhập tài khoản <strong>{user?.username}</strong> (không có quyền admin).
              <button
                type="button"
                onClick={handleSwitchAccount}
                disabled={loading}
                className="block mt-2 text-blue-400 hover:text-blue-300 font-semibold underline-offset-2 hover:underline disabled:opacity-50"
              >
                Đăng xuất và dùng tài khoản admin khác
              </button>
            </div>
          )}

          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">
                Số điện thoại hoặc email
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                placeholder="Nhập SĐT hoặc email"
                className="w-full h-11 px-4 rounded-xl border bg-slate-800/80 border-slate-700 text-white text-sm placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                onKeyDown={(e) => e.key === "Enter" && void handleLogin()}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">Mật khẩu</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  placeholder="Nhập mật khẩu"
                  className="w-full h-11 px-4 pr-11 rounded-xl border bg-slate-800/80 border-slate-700 text-white text-sm placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  onKeyDown={(e) => e.key === "Enter" && void handleLogin()}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 font-medium">{error}</p>
            )}

            <button
              type="button"
              onClick={() => void handleLogin()}
              disabled={loading}
              className="mt-2 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Đang đăng nhập..." : "Đăng nhập Admin"}
            </button>
          </div>
        </div>

        <p className="text-center mt-6 text-sm text-slate-500">
          Dùng ứng dụng chat?{" "}
          <button
            type="button"
            onClick={() => router.push("/(auth)/login")}
            className="text-blue-400 hover:text-blue-300 font-semibold"
          >
            Về trang đăng nhập người dùng
          </button>
        </p>
      </div>
    </div>
  );
}
