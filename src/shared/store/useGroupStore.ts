import { create } from 'zustand';
import { GroupDetail } from '../types';

interface GroupState {
    currentGroupDetail: GroupDetail | null;
    isGroupInfoOpen: boolean;
    isCreateGroupOpen: boolean;
    isAddMembersOpen: boolean;
    isLoading: boolean;
    error: string | null;
    createGroupPreselectedIds: string[];

    /**
     * Callback được HomeWeb (hoặc bất kỳ screen nào) đăng ký.
     * Gọi sau khi tạo nhóm thành công để chuyển vào phòng mà KHÔNG dùng router.push
     * (tránh mất WebSidebar xanh).
     */
    onGroupCreated: ((roomId: string) => void) | null;

    // ─── Actions ───
    setCurrentGroupDetail: (group: GroupDetail | null) => void;
    updateCurrentGroupDetail: (group: GroupDetail) => void;

    openGroupInfo: () => void;
    closeGroupInfo: () => void;

    openCreateGroup: (preSelectedIds?: string[]) => void;
    closeCreateGroup: () => void;

    openAddMembers: () => void;
    closeAddMembers: () => void;

    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;

    registerOnGroupCreated: (cb: (roomId: string) => void) => void;
    unregisterOnGroupCreated: () => void;
    clear: () => void;
}

export const useGroupStore = create<GroupState>((set) => ({
    currentGroupDetail: null,
    isGroupInfoOpen: false,
    isCreateGroupOpen: false,
    isAddMembersOpen: false,
    isLoading: false,
    error: null,
    onGroupCreated: null,
    createGroupPreselectedIds: [],

    setCurrentGroupDetail: (group) => set({ currentGroupDetail: group }),
    updateCurrentGroupDetail: (group) => set({ currentGroupDetail: group }),

    openGroupInfo: () => set({ isGroupInfoOpen: true }),
    closeGroupInfo: () => set({ isGroupInfoOpen: false, isAddMembersOpen: false }),

    openCreateGroup: (preSelectedIds) => set({
        isCreateGroupOpen: true,
        createGroupPreselectedIds: Array.isArray(preSelectedIds) ? preSelectedIds.filter(Boolean) : [],
    }),
    closeCreateGroup: () => set({ isCreateGroupOpen: false, createGroupPreselectedIds: [] }),

    openAddMembers: () => set({ isAddMembersOpen: true }),
    closeAddMembers: () => set({ isAddMembersOpen: false }),

    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),

    registerOnGroupCreated: (cb) => set({ onGroupCreated: cb }),
    unregisterOnGroupCreated: () => set({ onGroupCreated: null }),

    clear: () => set({
        currentGroupDetail: null,
        isGroupInfoOpen: false,
        isCreateGroupOpen: false,
        isAddMembersOpen: false,
        isLoading: false,
        error: null,
        createGroupPreselectedIds: [],
    })
}));
