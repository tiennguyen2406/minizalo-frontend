import type { PrivacyAudience } from "@/shared/services/types";

export const PRIVACY_AUDIENCE_OPTIONS: { value: PrivacyAudience; label: string }[] = [
    { value: "EVERYONE", label: "Tất cả mọi người" },
    { value: "FRIENDS", label: "Bạn bè" },
];

export function labelForPrivacyAudience(v: PrivacyAudience | string | null | undefined): string {
    const found = PRIVACY_AUDIENCE_OPTIONS.find((o) => o.value === v);
    return found?.label ?? PRIVACY_AUDIENCE_OPTIONS[0].label;
}

/** NO_ONE đã bỏ khỏi UI; dữ liệu cũ map sang FRIENDS. */
export function normalizePrivacyAudience(v: string | null | undefined): PrivacyAudience {
    const u = typeof v === "string" ? v.trim().toUpperCase() : "";
    if (u === "FRIENDS" || u === "EVERYONE") return u;
    if (u === "NO_ONE") return "FRIENDS";
    return "EVERYONE";
}
