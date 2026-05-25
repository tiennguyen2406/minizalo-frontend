import { create } from 'zustand';
import { api } from '@/shared/services/apiClient';
import { useAuthStore } from './authStore';

export interface Story {
    storyId: string;
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    mediaUrl: string;
    mediaType: 'IMAGE' | 'VIDEO' | 'TEXT';
    storyType: 'STATUS' | 'PHOTO' | 'VIDEO' | 'LOOP';
    caption: string;
    privacy: 'ALL_FRIENDS' | 'SPECIFIC' | 'EXCLUDE';
    permittedUserIds: string[];
    createdAt: string;
    expiresAt: number;
    viewers: string[];
    reactions: string[];
    backgroundConfig?: string;
}

interface StoryState {
    feed: Story[];
    myStories: Story[];
    loading: boolean;
    fetchFeed: () => Promise<void>;
    fetchMyStories: () => Promise<void>;
    uploadStory: (file: any, caption: string, options?: { 
        storyType?: string, 
        privacy?: string, 
        permittedUserIds?: string[],
        backgroundConfig?: string 
    }) => Promise<void>;
    deleteStory: (createdAt: string) => Promise<void>;
    viewStory: (userId: string, createdAt: string) => Promise<void>;
    addReaction: (userId: string, createdAt: string, type: string) => Promise<void>;
    updateStoryPrivacy: (createdAt: string, privacy: string, permittedUserIds?: string[]) => Promise<void>;
    applyRealtimeStoryViewed: (userId: string, createdAt: string, viewerId: string) => void;
    applyRealtimeStoryReaction: (userId: string, createdAt: string, reactionUserId: string, type: string) => void;
}

const updateStory = (
    stories: Story[],
    userId: string,
    createdAt: string,
    updater: (story: Story) => Story,
) => stories.map(story => story.userId === userId && story.createdAt === createdAt ? updater(story) : story);

const inferMimeFromUri = (uri: string) => {
    const ext = (uri.split('.').pop() || '').split('?')[0].toLowerCase();
    if (['mp4', 'mov', 'm4v', 'webm', '3gp'].includes(ext)) {
        return `video/${ext === 'mov' ? 'quicktime' : ext}`;
    }
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) {
        return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    }
    return 'application/octet-stream';
};

export const useStoryStore = create<StoryState>((set, get) => ({
    feed: [],
    myStories: [],
    loading: false,

    fetchFeed: async () => {
        set({ loading: true });
        try {
            const response = await api.get('/stories/feed');
            set({ feed: response.data, loading: false });
        } catch (error) {
            console.error('Fetch story feed error:', error);
            set({ loading: false });
        }
    },

    fetchMyStories: async () => {
        try {
            const response = await api.get('/stories/me');
            set({ myStories: response.data });
        } catch (error) {
            console.error('Fetch my stories error:', error);
        }
    },

    uploadStory: async (file: any, caption: string, options?: { 
        storyType?: string, 
        privacy?: string, 
        permittedUserIds?: string[],
        backgroundConfig?: string 
    }) => {
        const formData = new FormData();
        // Handle React Native vs Web file object
        if (file) {
            if (typeof file === 'string' || file?.uri) {
                // Assume URI for mobile
                const uri = typeof file === 'string' ? file : file.uri;
                const filename = file?.fileName || file?.name || uri.split('/').pop() || 'upload';
                const inferredType = inferMimeFromUri(filename) || inferMimeFromUri(uri);
                const type = file?.mimeType
                    || (file?.type === 'video' && inferredType === 'application/octet-stream' ? 'video/mp4' : null)
                    || (file?.type === 'image' && inferredType === 'application/octet-stream' ? 'image/jpeg' : null)
                    || inferredType;
                formData.append('file', { uri, name: filename, type } as any);
            } else {
                formData.append('file', file);
            }
        }
        
        if (caption) formData.append('caption', caption);
        if (options?.storyType) formData.append('storyType', options.storyType);
        if (options?.privacy) formData.append('privacy', options.privacy);
        if (options?.permittedUserIds) {
            options.permittedUserIds.forEach(id => formData.append('permittedUserIds', id));
        }
        if (options?.backgroundConfig) formData.append('backgroundConfig', options.backgroundConfig);

        try {
            await api.post('/stories', formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data'
                }
            });
            get().fetchFeed();
            get().fetchMyStories();
        } catch (error) {
            console.error('Upload story error:', error);
            throw error;
        }
    },

    deleteStory: async (createdAt: string) => {
        try {
            await api.delete('/stories', {
                params: { createdAt }
            });
            get().fetchFeed();
            get().fetchMyStories();
        } catch (error) {
            console.error('Delete story error:', error);
        }
    },

    updateStoryPrivacy: async (createdAt: string, privacy: string, permittedUserIds?: string[]) => {
        try {
            const params = new URLSearchParams();
            params.append('createdAt', createdAt);
            params.append('privacy', privacy);
            if (permittedUserIds && permittedUserIds.length > 0) {
                permittedUserIds.forEach(id => params.append('permittedUserIds', id));
            }
            await api.put(`/stories/privacy?${params.toString()}`);
            get().fetchFeed();
            get().fetchMyStories();
        } catch (error) {
            console.error('Update story privacy error:', error);
            throw error;
        }
    },

    viewStory: async (userId: string, createdAt: string) => {
        const currentUserId = useAuthStore.getState().user?.id;
        if (!currentUserId) return;

        // Optimistically update local state
        set(state => ({
            feed: state.feed.map(s => {
                if (s.userId === userId && s.createdAt === createdAt) {
                    const viewers = s.viewers ? [...new Set([...s.viewers, currentUserId])] : [currentUserId];
                    return { ...s, viewers };
                }
                return s;
            }),
            myStories: state.myStories.map(s => {
                if (s.userId === userId && s.createdAt === createdAt) {
                    const viewers = s.viewers ? [...new Set([...s.viewers, currentUserId])] : [currentUserId];
                    return { ...s, viewers };
                }
                return s;
            })
        }));

        try {
            await api.post('/stories/view', null, {
                params: { userId, createdAt }
            });
        } catch (error) {
            console.error('View story error:', error);
        }
    },

    addReaction: async (userId: string, createdAt: string, type: string) => {
        try {
            await api.post('/stories/reaction', null, {
                params: { userId, createdAt, type }
            });
            // Update local state to reflect reaction immediately
            set(state => ({
                feed: state.feed.map(s => {
                    if (s.userId === userId && s.createdAt === createdAt) {
                        const currentUserId = useAuthStore.getState().user?.id; // Assuming user.id exists
                        const newReaction = `${currentUserId}:${type}`;
                        const reactions = s.reactions ? [...s.reactions.filter(r => !r.startsWith(currentUserId + ":")), newReaction] : [newReaction];
                        return { ...s, reactions };
                    }
                    return s;
                })
            }));
        } catch (error) {
            console.error('Add reaction error:', error);
        }
    },

    applyRealtimeStoryViewed: (userId: string, createdAt: string, viewerId: string) => {
        if (!viewerId) return;
        set(state => ({
            feed: updateStory(state.feed, userId, createdAt, story => ({
                ...story,
                viewers: story.viewers ? [...new Set([...story.viewers, viewerId])] : [viewerId],
            })),
            myStories: updateStory(state.myStories, userId, createdAt, story => ({
                ...story,
                viewers: story.viewers ? [...new Set([...story.viewers, viewerId])] : [viewerId],
            })),
        }));
    },

    applyRealtimeStoryReaction: (userId: string, createdAt: string, reactionUserId: string, type: string) => {
        if (!reactionUserId || !type) return;
        set(state => ({
            feed: updateStory(state.feed, userId, createdAt, story => ({
                ...story,
                reactions: story.reactions
                    ? [...story.reactions.filter(r => !r.startsWith(reactionUserId + ":")), `${reactionUserId}:${type}`]
                    : [`${reactionUserId}:${type}`],
            })),
            myStories: updateStory(state.myStories, userId, createdAt, story => ({
                ...story,
                reactions: story.reactions
                    ? [...story.reactions.filter(r => !r.startsWith(reactionUserId + ":")), `${reactionUserId}:${type}`]
                    : [`${reactionUserId}:${type}`],
            })),
        }));
    }
}));
