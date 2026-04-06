import { ReactNode, useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useAuthStore } from "@/shared/store/authStore";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { userService } from "@/shared/services/userService";

type AuthGuardMode = "requireAuth" | "guestOnly";

interface AuthGuardProps {
    mode: AuthGuardMode;
    children: ReactNode;
    loginPath?: string;
    homePath?: string;
}

/**
 * Auth Router Guard - dùng chung cho Web & Mobile.
 * - requireAuth: redirect sang login nếu chưa đăng nhập.
 * - guestOnly: redirect sang home nếu đã đăng nhập.
 */
export function AuthGuard({
    mode,
    children,
    loginPath = "/(auth)/login",
    homePath = "/(tabs)",
}: AuthGuardProps) {
    const { accessToken, refreshToken, isHydrated, refreshAuth, clear, user, setUser } = useAuthStore();
    const [isValidating, setIsValidating] = useState(false);
    const [isTokenValid, setIsTokenValid] = useState<boolean | null>(null);

    const isAccessTokenExpired = (token: string | null): boolean => {
        if (!token) return true;
        try {
            const parts = token.split(".");
            if (parts.length < 2) return true;
            const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
            const pad = payload.length % 4;
            const padded = pad ? payload + "=".repeat(4 - pad) : payload;
            const json = typeof atob !== "undefined" ? atob(padded) : Buffer.from(padded, "base64").toString("utf-8");
            const data = JSON.parse(json);
            if (typeof data.exp !== "number") return true;
            return data.exp * 1000 <= Date.now();
        } catch {
            return true;
        }
    };

    // Validate token with server when app loads
    useEffect(() => {
        const validateToken = async () => {
            if (isHydrated && refreshToken && isTokenValid === null) {
                setIsValidating(true);

                // If access token exists and is NOT expired, skip refresh entirely.
                // The proactive-refresh scheduler in authStore already handles
                // pre-emptive renewal before expiry.  Calling refreshAuth() here
                // when the token is still valid causes a race condition: the
                // backend rotates the session row, immediately invalidating the
                // current access-token's embedded session-token (st claim) for
                // any concurrent request that is already in-flight.
                if (accessToken && !isAccessTokenExpired(accessToken)) {
                    setIsTokenValid(true);
                    setIsValidating(false);

                    // Fetch user profile if not already loaded
                    if (!user) {
                        try {
                            const profile = await userService.getProfile();
                            setUser({
                                id: profile.id,
                                username: profile.username,
                                fullName: profile.displayName || profile.username,
                                avatarUrl: profile.avatarUrl || undefined,
                            });
                        } catch {
                            // Profile fetch failed but auth is still valid
                        }
                    }
                    return;
                }

                // Access token is missing or expired — try refreshing
                try {
                    const success = await refreshAuth();
                    setIsTokenValid(success);
                    if (success) {
                        // Fetch user profile if not already loaded
                        if (!user) {
                            try {
                                const profile = await userService.getProfile();
                                setUser({
                                    id: profile.id,
                                    username: profile.username,
                                    fullName: profile.displayName || profile.username,
                                    avatarUrl: profile.avatarUrl || undefined,
                                });
                            } catch {
                                // Profile fetch failed but auth is still valid
                            }
                        }
                    } else {
                        clear();
                    }
                } catch {
                    setIsTokenValid(false);
                    clear();
                }
                setIsValidating(false);
            } else if (isHydrated && !refreshToken) {
                // If no refresh token but access token still valid, allow temporarily.
                // API layer will eventually force relogin when token expires.
                setIsTokenValid(accessToken ? !isAccessTokenExpired(accessToken) : false);
            }
        };
        validateToken();
    }, [isHydrated, refreshToken]);


    // Show loading while hydrating or validating
    if (!isHydrated || (refreshToken && isValidating)) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0068FF" />
            </View>
        );
    }

    if (mode === "requireAuth") {
        if (!accessToken || isTokenValid === false) {
            return <Redirect href={loginPath as any} />;
        }
    }

    if (mode === "guestOnly") {
        if (accessToken && isTokenValid !== false) {
            return <Redirect href={homePath as any} />;
        }
    }

    return <>{children}</>;
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#fff",
    },
});
