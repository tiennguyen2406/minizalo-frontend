import React, { useEffect, useState } from 'react';
import { useStoryStore, Story } from '@/shared/store/storyStore';
import { useUserStore } from '@/shared/store/userStore';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/shared/theme/colors';
import { showToast as toast } from '@/shared/utils/toast';

export default function StoryFeed() {
    const { feed, fetchFeed, uploadStory, viewStory } = useStoryStore();
    const { profile } = useUserStore();
    const colors = useThemeColors();
    const [selectedStory, setSelectedStory] = useState<Story | null>(null);

    useEffect(() => {
        fetchFeed();
    }, []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                await uploadStory(file, "");
                toast.success("Đã đăng Story thành công!");
            } catch (err) {
                toast.error("Lỗi khi đăng Story");
            }
        }
    };

    // Group stories by user
    const groupedStories = feed.reduce((acc, story) => {
        if (!acc[story.userId]) {
            acc[story.userId] = [];
        }
        acc[story.userId].push(story);
        return acc;
    }, {} as Record<string, Story[]>);

    const userIds = Object.keys(groupedStories);

    return (
        <div style={{ padding: '20px 0', borderBottom: `1px solid ${colors.border}`, marginBottom: 20 }}>
            <div style={{ display: 'flex', overflowX: 'auto', gap: 16, paddingBottom: 10, scrollbarWidth: 'none' }}>
                {/* My Story Creator */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 70 }}>
                    <label style={{ cursor: 'pointer', position: 'relative' }}>
                        <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFileChange} />
                        <div style={{ 
                            width: 60, 
                            height: 60, 
                            borderRadius: '50%', 
                            backgroundColor: colors.card,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: `2px dashed ${colors.primary}`,
                            overflow: 'hidden'
                        }}>
                            {profile?.avatarUrl ? (
                                <img src={profile.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} />
                            ) : (
                                <Ionicons name="add" size={30} color={colors.primary} />
                            )}
                            <div style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: colors.primary, borderRadius: '50%', padding: 2 }}>
                                <Ionicons name="add" size={14} color="white" />
                            </div>
                        </div>
                    </label>
                    <span style={{ fontSize: 12, marginTop: 6, color: colors.text, textAlign: 'center' }}>Tạo tin</span>
                </div>

                {/* Friend Stories */}
                {userIds.map(userId => {
                    const userStories = groupedStories[userId];
                    const latestStory = userStories[0];
                    return (
                        <div 
                            key={userId} 
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 70, cursor: 'pointer' }}
                            onClick={() => {
                                setSelectedStory(latestStory);
                                viewStory(latestStory.userId, latestStory.createdAt);
                            }}
                        >
                            <div style={{ 
                                width: 60, 
                                height: 60, 
                                borderRadius: '50%', 
                                padding: 2,
                                border: `2px solid ${colors.primary}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <img 
                                    src={latestStory.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(latestStory.displayName)}&background=random`} 
                                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                                />
                            </div>
                            <span style={{ 
                                fontSize: 12, 
                                marginTop: 6, 
                                color: colors.text, 
                                width: 70, 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis', 
                                whiteSpace: 'nowrap',
                                textAlign: 'center'
                            }}>
                                {latestStory.displayName}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Story Viewer Modal */}
            {selectedStory && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div style={{ position: 'absolute', top: 20, right: 20, cursor: 'pointer' }} onClick={() => setSelectedStory(null)}>
                        <Ionicons name="close" size={40} color="white" />
                    </div>

                    <div style={{ width: '100%', maxWidth: 400, height: '80vh', position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
                        {selectedStory.mediaType === 'VIDEO' ? (
                            <video src={selectedStory.mediaUrl} autoPlay style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                            <img src={selectedStory.mediaUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        )}
                        
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: 20, background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)', display: 'flex', alignItems: 'center' }}>
                            <img src={selectedStory.avatarUrl} style={{ width: 40, height: 40, borderRadius: '50%', marginRight: 12 }} />
                            <div>
                                <div style={{ color: 'white', fontWeight: 'bold' }}>{selectedStory.displayName}</div>
                                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{new Date(selectedStory.createdAt).toLocaleString()}</div>
                            </div>
                        </div>

                        {selectedStory.caption && (
                            <div style={{ position: 'absolute', bottom: 40, left: 0, right: 0, textAlign: 'center', padding: 20 }}>
                            <div style={{ color: 'white', fontSize: 16, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>{selectedStory.caption}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
