import { create } from "zustand";
import { api } from "@/shared/services/apiClient";

export interface TimelinePostMedia {
    id: string;
    mediaUrl: string;
    mediaType: "IMAGE" | "VIDEO";
    sortOrder: number;
}

export interface TimelinePostComment {
    id: string;
    userId: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
    content: string;
    createdAt: string;
}

export interface TimelinePostReaction {
    id: string;
    userId: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
    type: string;
    createdAt: string;
}

export interface TimelinePost {
    id: string;
    userId: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
    content: string | null;
    mediaUrl: string | null;
    mediaType: "IMAGE" | "VIDEO" | null;
    createdAt: string;
    privacy?: "ALL_FRIENDS" | "SPECIFIC" | "EXCLUDE";
    permittedUserIds?: string[];
    mediaItems?: TimelinePostMedia[];
    comments?: TimelinePostComment[];
    reactions?: TimelinePostReaction[];
}

interface PostState {
    posts: TimelinePost[];
    loading: boolean;
    fetchFeed: (options?: { silent?: boolean }) => Promise<void>;
    createPost: (content: string, files?: any[] | any) => Promise<void>;
    reactPost: (postId: string, type: string) => Promise<void>;
    removePostReaction: (postId: string) => Promise<void>;
    commentPost: (postId: string, content: string) => Promise<void>;
    deletePostComment: (postId: string, commentId: string) => Promise<void>;
    updatePostPrivacy: (postId: string, privacy: string, permittedUserIds?: string[]) => Promise<void>;
}

const inferMimeFromUri = (uri: string) => {
    const ext = (uri.split(".").pop() || "").split("?")[0].toLowerCase();
    if (["mp4", "mov", "m4v", "webm", "3gp"].includes(ext)) return `video/${ext === "mov" ? "quicktime" : ext}`;
    if (["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext)) return `image/${ext === "jpg" ? "jpeg" : ext}`;
    return "application/octet-stream";
};

export const usePostStore = create<PostState>((set, get) => ({
    posts: [],
    loading: false,

    fetchFeed: async (options) => {
        if (!options?.silent) set({ loading: true });
        try {
            const response = await api.get<TimelinePost[]>("/posts/feed");
            set({ posts: response.data, loading: false });
        } catch (error) {
            console.error("Fetch posts error:", error);
            if (!options?.silent) set({ loading: false });
        }
    },

    createPost: async (content: string, files?: any[] | any) => {
        const formData = new FormData();
        if (content.trim()) formData.append("content", content.trim());
        const uploadFiles = Array.isArray(files) ? files : files ? [files] : [];
        uploadFiles.forEach((file) => {
            if (typeof file === "string" || file?.uri) {
                const uri = typeof file === "string" ? file : file.uri;
                const filename = file?.fileName || file?.name || uri.split("/").pop() || "upload";
                const assetType = file?.mimeType || (file?.type === "video" ? "video/mp4" : file?.type === "image" ? "image/jpeg" : inferMimeFromUri(uri));
                formData.append("files", { uri, name: filename, type: assetType } as any);
            } else {
                formData.append("files", file);
            }
        });
        await api.post("/posts", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        await get().fetchFeed();
    },

    reactPost: async (postId: string, type: string) => {
        const response = await api.post<TimelinePost>(`/posts/${postId}/reactions`, null, {
            params: { type },
        });
        set((state) => ({
            posts: state.posts.map((post) => post.id === postId ? response.data : post),
        }));
    },

    removePostReaction: async (postId: string) => {
        const response = await api.delete<TimelinePost>(`/posts/${postId}/reactions`);
        set((state) => ({
            posts: state.posts.map((post) => post.id === postId ? response.data : post),
        }));
    },

    commentPost: async (postId: string, content: string) => {
        const cleanContent = content.trim();
        if (!cleanContent) return;
        const response = await api.post<TimelinePost>(`/posts/${postId}/comments`, null, {
            params: { content: cleanContent },
        });
        set((state) => ({
            posts: state.posts.map((post) => post.id === postId ? response.data : post),
        }));
    },

    deletePostComment: async (postId: string, commentId: string) => {
        const response = await api.delete<TimelinePost>(`/posts/${postId}/comments/${commentId}`);
        set((state) => ({
            posts: state.posts.map((post) => post.id === postId ? response.data : post),
        }));
    },

    updatePostPrivacy: async (postId: string, privacy: string, permittedUserIds?: string[]) => {
        const params = new URLSearchParams();
        params.append("privacy", privacy);
        permittedUserIds?.forEach((id) => params.append("permittedUserIds", id));
        const response = await api.put<TimelinePost>(`/posts/${postId}/privacy?${params.toString()}`);
        set((state) => ({
            posts: state.posts.map((post) => post.id === postId ? response.data : post),
        }));
    },
}));
