import { create } from "zustand";
import userService from "@/shared/services/userService";
import type { UserProfile, UserProfileUpdateRequest } from "@/shared/services/types";

type UserState = {
    profile: UserProfile | null;
    loading: boolean;
    error: string | null;
    fetchProfile: () => Promise<void>;
    updateProfile: (data: UserProfileUpdateRequest) => Promise<void>;
    setProfile: (profile: UserProfile | null) => void;
    clear: () => void;
};

export const useUserStore = create<UserState>((set, get) => ({
    profile: null,
    loading: false,
    error: null,

    fetchProfile: async () => {
        set({ loading: true, error: null });
        try {
            const profile = await userService.getProfile();
            set({ profile, loading: false });
        } catch (e: unknown) {
            const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Không tải được thông tin tài khoản.";
            set({ profile: null, loading: false, error: message });
        }
    },

    updateProfile: async (data: UserProfileUpdateRequest) => {
        set({ loading: true, error: null });
        try {
            const updated = await userService.updateProfile(data);
            set((state) => {
                const prev = state.profile;
                const merged: UserProfile =
                    prev == null
                        ? updated
                        : {
                              ...prev,
                              ...updated,
                              allowMessagesFrom:
                                  updated.allowMessagesFrom ?? prev.allowMessagesFrom,
                              allowCallsFrom: updated.allowCallsFrom ?? prev.allowCallsFrom,
                              allowPhoneSearch:
                                  updated.allowPhoneSearch ?? prev.allowPhoneSearch,
                          };
                return { profile: merged, loading: false };
            });
        } catch (e: unknown) {
            const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Cập nhật thất bại.";
            set({ loading: false, error: message });
            throw e;
        }
    },

    setProfile: (profile) => set({ profile }),

    clear: () => set({ profile: null, error: null }),
}));
