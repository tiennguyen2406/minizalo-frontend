import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  ImagePlus,
  Lock,
  MoreHorizontal,
  Plus,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useStoryStore, type Story } from "@/shared/store/storyStore";
import { useUserStore } from "@/shared/store/userStore";
import { useFriendStore } from "@/shared/store/friendStore";
import { showToast as toast } from "@/shared/utils/toast";
import { chatService } from "@/shared/services/chatService";
import { getImageUrl } from "@/shared/utils/mediaUtils";

type PrivacyMode = "ALL_FRIENDS" | "SPECIFIC" | "EXCLUDE";
type OverlayItem = {
  id: string;
  type: "music" | "text";
  x: number;
  y: number;
  rotation: number;
  scale: number;
  musicTitle?: string;
  musicArtist?: string;
  musicThumb?: string;
  textContent?: string;
  textStyle?: "normal" | "italic" | "bold";
};

const PHOTO_DURATION_MS = 5000;
const LOOP_DURATION_MS = 3000;
const BG_COLORS = ["#0068FF", "#111827", "#EF4444", "#22C55E", "#F59E0B", "#7C3AED"];
const REACTIONS = [
  { emoji: "♥", type: "heart" },
  { emoji: "👍", type: "like" },
  { emoji: "😂", type: "haha" },
  { emoji: "😮", type: "wow" },
  { emoji: "😢", type: "sad" },
  { emoji: "😡", type: "angry" },
];

const parseOverlayItems = (backgroundConfig?: string): OverlayItem[] => {
  if (!backgroundConfig || !backgroundConfig.includes("|||")) return [];
  try {
    const [, raw] = backgroundConfig.split("|||");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const parseBgColor = (backgroundConfig?: string): string => {
  if (!backgroundConfig) return "#0068FF";
  const color = backgroundConfig.split("|||")[0];
  return color?.startsWith("#") || color?.startsWith("rgb") ? color : "#0068FF";
};

const formatStoryTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ`;
  return date.toLocaleDateString("vi-VN");
};

const getStoryDuration = (story: Story | null) => {
  if (!story) return PHOTO_DURATION_MS;
  if (story.storyType === "LOOP") return LOOP_DURATION_MS;
  return PHOTO_DURATION_MS;
};

const getAvatarUrl = (name?: string | null, avatarUrl?: string | null) =>
  (avatarUrl ? getImageUrl(avatarUrl) : "") || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "U")}&background=0D8BFF&color=fff`;

export default function StoryFeed() {
  const {
    feed,
    loading,
    fetchFeed,
    uploadStory,
    deleteStory,
    viewStory,
    addReaction,
    updateStoryPrivacy,
  } = useStoryStore();
  const { profile, fetchProfile } = useUserStore();
  const friends = useFriendStore((s) => s.friends);
  const fetchFriends = useFriendStore((s) => s.fetchFriends);

  const [isComposerOpen, setComposerOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [textStory, setTextStory] = useState("");
  const [bgColor, setBgColor] = useState(BG_COLORS[0]);
  const [privacy, setPrivacy] = useState<PrivacyMode>("ALL_FRIENDS");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isPosting, setPosting] = useState(false);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [isMenuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void fetchFeed();
    void fetchFriends();
    if (!profile) void fetchProfile();
  }, [fetchFeed, fetchFriends, fetchProfile, profile]);

  const groupedStories = useMemo(() => {
    const groups = new Map<string, Story[]>();
    [...feed]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .forEach((story) => {
        const list = groups.get(story.userId) ?? [];
        list.push(story);
        groups.set(story.userId, list);
      });
    return groups;
  }, [feed]);

  const userIds = useMemo(() => {
    const ids = Array.from(groupedStories.keys());
    if (!profile?.id) return ids;
    return ids.sort((a, b) => (a === profile.id ? -1 : b === profile.id ? 1 : 0));
  }, [groupedStories, profile?.id]);

  const currentUserStories = selectedStory ? groupedStories.get(selectedStory.userId) ?? [] : [];
  const overlayItems = useMemo(
    () => parseOverlayItems(selectedStory?.backgroundConfig),
    [selectedStory?.backgroundConfig],
  );
  const isOwnStory = !!selectedStory && selectedStory.userId === profile?.id;

  useEffect(() => {
    if (!selectedStory) {
      setProgress(0);
      return;
    }
    setProgress(0);
    const duration = getStoryDuration(selectedStory);
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      const next = Math.min((Date.now() - startedAt) / duration, 1);
      setProgress(next);
      if (next >= 1) {
        window.clearInterval(id);
        goNext();
      }
    }, 80);
    return () => window.clearInterval(id);
  }, [selectedStory, currentIndex]);

  useEffect(() => {
    if (!selectedStory || isOwnStory) return;
    void viewStory(selectedStory.userId, selectedStory.createdAt);
  }, [selectedStory, isOwnStory, viewStory]);

  const friendOptions = useMemo(() => {
    const myId = profile?.id;
    return friends
      .map((item) => {
        const candidate = item.user?.id === myId ? item.friend : item.user;
        return candidate;
      })
      .filter(Boolean);
  }, [friends, profile?.id]);

  const openStory = (story: Story) => {
    const list = groupedStories.get(story.userId) ?? [];
    setCurrentIndex(Math.max(0, list.findIndex((item) => item.createdAt === story.createdAt)));
    setSelectedStory(story);
    setMenuOpen(false);
    setReplyText("");
  };

  const syncSelectedStory = (index: number, userId = selectedStory?.userId) => {
    if (!userId) return;
    const list = groupedStories.get(userId) ?? [];
    const next = list[index];
    if (!next) return;
    setCurrentIndex(index);
    setSelectedStory(next);
    setMenuOpen(false);
  };

  const goNext = () => {
    if (!selectedStory) return;
    const list = groupedStories.get(selectedStory.userId) ?? [];
    if (currentIndex < list.length - 1) {
      syncSelectedStory(currentIndex + 1);
      return;
    }
    const userIndex = userIds.indexOf(selectedStory.userId);
    const nextUserId = userIds[userIndex + 1];
    if (nextUserId) {
      syncSelectedStory(0, nextUserId);
      return;
    }
    setSelectedStory(null);
  };

  const goPrev = () => {
    if (!selectedStory) return;
    if (currentIndex > 0) {
      syncSelectedStory(currentIndex - 1);
      return;
    }
    const userIndex = userIds.indexOf(selectedStory.userId);
    const prevUserId = userIds[userIndex - 1];
    if (prevUserId) {
      const prevStories = groupedStories.get(prevUserId) ?? [];
      syncSelectedStory(Math.max(prevStories.length - 1, 0), prevUserId);
    }
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setFile(null);
    setCaption("");
    setTextStory("");
    setBgColor(BG_COLORS[0]);
    setPrivacy("ALL_FRIENDS");
    setSelectedUserIds([]);
  };

  const handlePostStory = async () => {
    if (!file && !textStory.trim()) {
      toast.error("Chọn ảnh/video hoặc nhập nội dung story.");
      return;
    }
    setPosting(true);
    try {
      if (file) {
        await uploadStory(file, caption.trim(), {
          storyType: file.type.startsWith("video/") ? "VIDEO" : "PHOTO",
          privacy,
          permittedUserIds: selectedUserIds,
        });
      } else {
        await uploadStory(null, textStory.trim(), {
          storyType: "STATUS",
          privacy,
          permittedUserIds: selectedUserIds,
          backgroundConfig: bgColor,
        });
      }
      toast.success("Đã đăng story.");
      closeComposer();
    } catch {
      toast.error("Không thể đăng story.");
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedStory || !window.confirm("Xóa story này?")) return;
    await deleteStory(selectedStory.createdAt);
    toast.success("Đã xóa story.");
    setSelectedStory(null);
  };

  const handlePrivacyUpdate = async (nextPrivacy: PrivacyMode) => {
    if (!selectedStory) return;
    setMenuOpen(false);
    try {
      await updateStoryPrivacy(selectedStory.createdAt, nextPrivacy, selectedStory.permittedUserIds ?? []);
      setSelectedStory({ ...selectedStory, privacy: nextPrivacy });
      toast.success("Đã cập nhật quyền riêng tư.");
    } catch {
      toast.error("Không thể cập nhật quyền riêng tư.");
    }
  };

  const handleReaction = async (type: string) => {
    if (!selectedStory) return;
    await addReaction(selectedStory.userId, selectedStory.createdAt, type);
    toast.success("Đã thả cảm xúc.");
  };

  const handleReply = async () => {
    if (!selectedStory || !replyText.trim()) return;
    try {
      const room = await chatService.createPrivateRoom(selectedStory.userId);
      const payload = JSON.stringify({
        type: "STORY_REPLY",
        text: replyText.trim(),
        mediaUrl: selectedStory.mediaUrl || null,
        mediaType: selectedStory.mediaType || selectedStory.storyType,
        caption: selectedStory.caption || "",
        storyId: selectedStory.createdAt,
        authorId: selectedStory.userId,
      });
      await chatService.sendMessage(room.id || (room as any).roomId, payload, undefined, "TEXT");
      setReplyText("");
      toast.success("Đã gửi tin nhắn.");
    } catch {
      toast.error("Không thể gửi tin nhắn.");
    }
  };

  const toggleSelectedFriend = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const showFriendPicker = privacy !== "ALL_FRIENDS";

  return (
    <div
      style={{
        border: "1px solid var(--border-primary)",
        borderRadius: 8,
        background: "var(--bg-primary)",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "10px 12px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, overflowX: "auto", scrollbarWidth: "none" }}>
          <button
            type="button"
            title="Tạo story"
            onClick={() => setComposerOpen(true)}
            style={{
              width: 64,
              minWidth: 64,
              border: "none",
              background: "transparent",
              color: "var(--text-primary)",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                margin: "0 auto",
                borderRadius: "50%",
                border: "2px dashed var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                overflow: "hidden",
                background: "var(--bg-tertiary)",
              }}
            >
              <img
                src={getAvatarUrl(profile?.displayName || profile?.username, profile?.avatarUrl)}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.55 }}
              />
              <span
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: 0,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 0 2px var(--bg-primary)",
                }}
              >
                <Plus size={13} />
              </span>
            </div>
            <div style={{ fontSize: 12, marginTop: 5, whiteSpace: "nowrap" }}>Tạo mới</div>
          </button>

          {loading && userIds.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Đang tải story...</div>
          ) : (
            userIds.map((userId) => {
              const stories = groupedStories.get(userId) ?? [];
              const latest = stories[0];
              if (!latest) return null;
              const allViewed = !!profile?.id && stories.every((story) => story.viewers?.includes(profile.id));
              const isMe = latest.userId === profile?.id;
              return (
                <button
                  type="button"
                  key={userId}
                  title={isMe ? "Story của tôi" : latest.displayName}
                  onClick={() => openStory(latest)}
                  style={{
                    width: 64,
                    minWidth: 64,
                    border: "none",
                    background: "transparent",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      margin: "0 auto",
                      borderRadius: "50%",
                      padding: 2,
                      background: allViewed
                        ? "var(--border-primary)"
                        : "linear-gradient(135deg, #0068FF, #22C55E)",
                    }}
                  >
                    <img
                      src={getAvatarUrl(latest.displayName, latest.avatarUrl)}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "2px solid var(--bg-primary)",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      marginTop: 5,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: allViewed ? "var(--text-tertiary)" : "var(--text-primary)",
                    }}
                  >
                    {isMe ? "Tôi" : latest.displayName}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {isComposerOpen && (
        <div style={styles.overlay}>
          <div style={styles.composer}>
            <div style={styles.composerHeader}>
              <div>
                <div style={styles.modalTitle}>Tạo story</div>
                <div style={styles.modalSub}>Story sẽ tự hết hạn sau 24 giờ.</div>
              </div>
              <button type="button" title="Đóng" style={styles.iconButton} onClick={closeComposer}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 16, minHeight: 320 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button type="button" style={styles.actionButton} onClick={() => fileInputRef.current?.click()}>
                  <ImagePlus size={18} /> Ảnh hoặc video
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  style={{ display: "none" }}
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
                <button type="button" style={styles.actionButton} onClick={() => setFile(null)}>
                  <Users size={18} /> Story chữ
                </button>
                <div style={styles.privacyBox}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                    <Lock size={16} /> Quyền riêng tư
                  </div>
                  <select
                    value={privacy}
                    onChange={(event) => setPrivacy(event.target.value as PrivacyMode)}
                    style={styles.select}
                  >
                    <option value="ALL_FRIENDS">Bạn bè Zalo</option>
                    <option value="SPECIFIC">Một số bạn bè</option>
                    <option value="EXCLUDE">Ngoại trừ...</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ ...styles.preview, background: file ? "#0f172a" : bgColor }}>
                  {file ? (
                    file.type.startsWith("video/") ? (
                      <video src={URL.createObjectURL(file)} controls style={styles.previewMedia} />
                    ) : (
                      <img src={URL.createObjectURL(file)} alt="" style={styles.previewMedia} />
                    )
                  ) : (
                    <textarea
                      value={textStory}
                      onChange={(event) => setTextStory(event.target.value)}
                      placeholder="Nhập nội dung..."
                      style={styles.textStoryInput}
                    />
                  )}
                </div>
                {!file && (
                  <div style={{ display: "flex", gap: 8 }}>
                    {BG_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        title={color}
                        onClick={() => setBgColor(color)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          border: bgColor === color ? "3px solid var(--accent)" : "1px solid var(--border-primary)",
                          background: color,
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </div>
                )}
                {file && (
                  <input
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    placeholder="Thêm chú thích..."
                    style={styles.input}
                  />
                )}
                {showFriendPicker && (
                  <div style={styles.friendPicker}>
                    {friendOptions.map((friend) => (
                      <label key={friend.id} style={styles.friendRow}>
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(friend.id)}
                          onChange={() => toggleSelectedFriend(friend.id)}
                        />
                        <img src={getAvatarUrl(friend.displayName || friend.username, friend.avatarUrl)} alt="" style={styles.friendAvatar} />
                        <span>{friend.displayName || friend.username}</span>
                      </label>
                    ))}
                    {friendOptions.length === 0 && (
                      <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Chưa có danh sách bạn bè.</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button type="button" style={styles.secondaryButton} onClick={closeComposer}>Hủy</button>
              <button type="button" style={styles.primaryButton} onClick={handlePostStory} disabled={isPosting}>
                {isPosting ? "Đang đăng..." : "Đăng story"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedStory && (
        <div style={styles.viewerOverlay}>
          <button type="button" title="Đóng" style={styles.closeButton} onClick={() => setSelectedStory(null)}>
            <X size={28} />
          </button>
          <button type="button" title="Trước" style={{ ...styles.navButton, left: 28 }} onClick={goPrev}>
            <ChevronLeft size={34} />
          </button>
          <button type="button" title="Sau" style={{ ...styles.navButton, right: 28 }} onClick={goNext}>
            <ChevronRight size={34} />
          </button>

          <div style={styles.viewerFrame}>
            <div style={styles.progressRow}>
              {currentUserStories.map((story, index) => (
                <div key={story.createdAt} style={styles.progressTrack}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${index < currentIndex ? 100 : index === currentIndex ? progress * 100 : 0}%`,
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={styles.viewerHeader}>
              <img src={getAvatarUrl(selectedStory.displayName, selectedStory.avatarUrl)} alt="" style={styles.viewerAvatar} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#fff", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selectedStory.displayName}
                </div>
                <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 12 }}>{formatStoryTime(selectedStory.createdAt)}</div>
              </div>
              {isOwnStory && (
                <button type="button" title="Tùy chọn" style={styles.viewerIconButton} onClick={() => setMenuOpen((v) => !v)}>
                  <MoreHorizontal size={22} />
                </button>
              )}
              {isMenuOpen && (
                <div style={styles.storyMenu}>
                  <button type="button" style={styles.menuItem} onClick={() => void handlePrivacyUpdate("ALL_FRIENDS")}>Bạn bè Zalo</button>
                  <button type="button" style={styles.menuItem} onClick={() => void handlePrivacyUpdate("SPECIFIC")}>Một số bạn bè</button>
                  <button type="button" style={styles.menuItem} onClick={() => void handlePrivacyUpdate("EXCLUDE")}>Ngoại trừ...</button>
                  <button type="button" style={{ ...styles.menuItem, color: "var(--danger)" }} onClick={handleDelete}>
                    <Trash2 size={15} /> Xóa story
                  </button>
                </div>
              )}
            </div>

            <div style={{ ...styles.storyCanvas, background: parseBgColor(selectedStory.backgroundConfig) }} onClick={goNext}>
              {selectedStory.mediaType === "TEXT" || selectedStory.storyType === "STATUS" ? (
                <div style={styles.textStoryView}>{selectedStory.caption}</div>
              ) : selectedStory.mediaType === "VIDEO" || selectedStory.storyType === "VIDEO" ? (
                <video src={getImageUrl(selectedStory.mediaUrl)} autoPlay controls style={styles.storyMedia} />
              ) : (
                <img src={getImageUrl(selectedStory.mediaUrl)} alt="" style={styles.storyMedia} />
              )}

              {overlayItems.map((item) => {
                const transform = `rotate(${item.rotation}deg) scale(${item.scale})`;
                if (item.type === "music") {
                  return (
                    <div key={item.id} style={{ ...styles.overlayPill, left: item.x, top: item.y, transform }}>
                      {item.musicThumb && <img src={item.musicThumb} alt="" style={styles.musicThumb} />}
                      <div style={{ minWidth: 0 }}>
                        <div style={styles.musicTitle}>{item.musicTitle}</div>
                        <div style={styles.musicArtist}>{item.musicArtist}</div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={item.id} style={{ ...styles.textPill, left: item.x, top: item.y, transform }}>
                    {item.textContent}
                  </div>
                );
              })}
            </div>

            <div style={styles.viewerFooter}>
              {isOwnStory ? (
                <button type="button" style={styles.viewerCount}>
                  <Eye size={18} /> {selectedStory.viewers?.length || 0} lượt xem
                </button>
              ) : (
                <>
                  <div style={styles.replyBar}>
                    <input
                      value={replyText}
                      onChange={(event) => setReplyText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void handleReply();
                      }}
                      placeholder="Gửi tin nhắn..."
                      style={styles.replyInput}
                    />
                    <button type="button" title="Gửi" style={styles.sendButton} onClick={() => void handleReply()}>
                      <Send size={18} />
                    </button>
                  </div>
                  <div style={styles.reactions}>
                    {REACTIONS.map((reaction) => (
                      <button
                        key={reaction.type}
                        type="button"
                        style={styles.reactionButton}
                        onClick={() => void handleReaction(reaction.type)}
                      >
                        {reaction.emoji}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9000,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  composer: {
    width: "min(760px, 96vw)",
    maxHeight: "90vh",
    overflow: "auto",
    background: "var(--bg-modal)",
    color: "var(--text-primary)",
    borderRadius: 8,
    boxShadow: "var(--shadow-lg)",
    padding: 18,
  },
  composerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: 700 },
  modalSub: { fontSize: 13, color: "var(--text-tertiary)", marginTop: 3 },
  iconButton: {
    width: 36,
    height: 36,
    border: "none",
    borderRadius: 8,
    background: "var(--bg-tertiary)",
    color: "var(--text-primary)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButton: {
    height: 38,
    border: "1px solid var(--border-primary)",
    borderRadius: 8,
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 10px",
    fontWeight: 600,
  },
  privacyBox: {
    border: "1px solid var(--border-primary)",
    borderRadius: 8,
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  select: {
    height: 34,
    borderRadius: 6,
    border: "1px solid var(--border-primary)",
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
    padding: "0 8px",
  },
  preview: {
    height: 320,
    borderRadius: 8,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  previewMedia: { width: "100%", height: "100%", objectFit: "contain" },
  textStoryInput: {
    width: "100%",
    height: "100%",
    border: "none",
    outline: "none",
    resize: "none",
    background: "transparent",
    color: "#fff",
    fontSize: 28,
    fontWeight: 700,
    textAlign: "center",
    padding: 36,
  },
  input: {
    height: 38,
    borderRadius: 8,
    border: "1px solid var(--border-primary)",
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
    padding: "0 12px",
  },
  friendPicker: {
    maxHeight: 140,
    overflow: "auto",
    border: "1px solid var(--border-primary)",
    borderRadius: 8,
    padding: 8,
  },
  friendRow: { display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", fontSize: 13 },
  friendAvatar: { width: 24, height: 24, borderRadius: "50%", objectFit: "cover" },
  secondaryButton: {
    height: 38,
    border: "1px solid var(--border-primary)",
    borderRadius: 8,
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
    padding: "0 16px",
    cursor: "pointer",
  },
  primaryButton: {
    height: 38,
    border: "none",
    borderRadius: 8,
    background: "var(--accent)",
    color: "#fff",
    padding: "0 18px",
    cursor: "pointer",
    fontWeight: 700,
  },
  viewerOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9500,
    background: "rgba(0,0,0,0.93)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: 24,
    boxSizing: "border-box",
    overflowY: "auto",
    overflowX: "hidden",
    overscrollBehavior: "contain",
  },
  closeButton: {
    position: "absolute",
    top: 20,
    right: 24,
    width: 42,
    height: 42,
    border: "none",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  navButton: {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 46,
    height: 46,
    border: "none",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerFrame: {
    height: 760,
    width: "auto",
    aspectRatio: "9 / 16",
    maxWidth: "min(430px, calc(100vw - 96px))",
    borderRadius: 8,
    margin: "auto 0",
    overflow: "hidden",
    position: "relative",
    background: "#000",
    boxShadow: "0 20px 70px rgba(0,0,0,0.45)",
  },
  progressRow: { position: "absolute", top: 10, left: 12, right: 12, zIndex: 4, display: "flex", gap: 4 },
  progressTrack: { flex: 1, height: 3, borderRadius: 3, background: "rgba(255,255,255,0.35)", overflow: "hidden" },
  progressFill: { height: "100%", background: "#fff", transition: "width 80ms linear" },
  viewerHeader: {
    position: "absolute",
    top: 22,
    left: 0,
    right: 0,
    zIndex: 4,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    background: "linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)",
  },
  viewerAvatar: { width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(255,255,255,0.35)" },
  viewerIconButton: {
    width: 34,
    height: 34,
    border: "none",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.14)",
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  storyMenu: {
    position: "absolute",
    right: 12,
    top: 62,
    width: 180,
    background: "var(--bg-modal)",
    color: "var(--text-primary)",
    borderRadius: 8,
    boxShadow: "var(--shadow-lg)",
    padding: 6,
  },
  menuItem: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: "inherit",
    height: 34,
    borderRadius: 6,
    cursor: "pointer",
    textAlign: "left",
    padding: "0 10px",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  storyCanvas: {
    width: "100%",
    height: "100%",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  storyMedia: { width: "100%", height: "100%", objectFit: "contain" },
  textStoryView: { color: "#fff", fontSize: 30, fontWeight: 800, textAlign: "center", padding: 42, lineHeight: 1.25 },
  overlayPill: {
    position: "absolute",
    display: "flex",
    alignItems: "center",
    gap: 8,
    maxWidth: 220,
    padding: "8px 10px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.55)",
    color: "#fff",
    pointerEvents: "none",
  },
  musicThumb: { width: 30, height: 30, borderRadius: "50%", objectFit: "cover" },
  musicTitle: { fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  musicArtist: { fontSize: 11, opacity: 0.78, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  textPill: {
    position: "absolute",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.55)",
    color: "#fff",
    fontWeight: 700,
    pointerEvents: "none",
  },
  viewerFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
    padding: "16px 14px",
    background: "linear-gradient(to top, rgba(0,0,0,0.68), transparent)",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  viewerCount: {
    height: 38,
    border: "none",
    borderRadius: 999,
    background: "rgba(255,255,255,0.16)",
    color: "#fff",
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  replyBar: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    background: "rgba(255,255,255,0.14)",
    display: "flex",
    alignItems: "center",
    paddingLeft: 14,
  },
  replyInput: { flex: 1, border: "none", outline: "none", background: "transparent", color: "#fff", minWidth: 0 },
  sendButton: {
    width: 36,
    height: 36,
    border: "none",
    borderRadius: "50%",
    background: "transparent",
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  reactions: { display: "flex", gap: 4 },
  reactionButton: {
    width: 34,
    height: 34,
    border: "none",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.16)",
    cursor: "pointer",
    fontSize: 17,
  },
};
