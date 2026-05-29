import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFriendStore } from "@/shared/store/friendStore";
import { usePostStore } from "@/shared/store/postStore";
import { useThemeStore } from "@/shared/store/themeStore";
import friendCategoryService from "@/shared/services/friendCategoryService";
import type { FriendResponseDto } from "@/shared/services/types";
import { getImageUrl } from "@/shared/utils/mediaUtils";
import WebSearchInputBar, {
  WEB_SEARCH_PLACEHOLDER,
} from "@/views/web/components/WebSearchInputBar";

function getFriendUser(item: FriendResponseDto, currentUserId?: string | null) {
  if (!currentUserId) return item.friend;
  return item.user.id === currentUserId ? item.friend : item.user;
}

type FriendsListScreenProps = {
  currentUserId?: string | null;
  onOpenChat?: (userId: string) => void;
  searchText?: string;
  onSearchChange?: (value: string) => void;
  /** Ẩn ô tìm (khi trang Danh bạ đã có thanh tìm chung bên sidebar) */
  hideSearchField?: boolean;
};

export default function FriendsListScreen({
  currentUserId,
  onOpenChat,
  searchText,
  onSearchChange,
  hideSearchField = false,
}: FriendsListScreenProps) {
  const {
    friends,
    loading,
    error,
    fetchFriends,
    removeFriend,
    blockUser,
    clearError,
  } = useFriendStore();
  const isDark = useThemeStore((s) => s.theme === "dark");
  const posts = usePostStore((s) => s.posts);
  const fetchPostFeed = usePostStore((s) => s.fetchFeed);
  const [internalSearch, setInternalSearch] = useState("");
  const search = searchText ?? internalSearch;
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  // friendType: UI + danh sách phân loại (logic lọc cụ thể sẽ bổ sung sau)
  type FriendCategory = { id: string; name: string; color: string };
  const DEFAULT_CATEGORIES: FriendCategory[] = [
    { id: "customers", name: "Khách hàng", color: "#ef4444" },
    { id: "family", name: "Gia đình", color: "#22c55e" },
    { id: "work", name: "Công việc", color: "#f97316" },
    { id: "friends", name: "Bạn bè", color: "#8b5cf6" },
    { id: "reply_later", name: "Trả lời sau", color: "#eab308" },
    { id: "colleagues", name: "Đồng nghiệp", color: "#3b82f6" },
  ];

  const [categories, setCategories] =
    useState<FriendCategory[]>(DEFAULT_CATEGORIES);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const selectedCategoryLabel = useMemo(() => {
    if (selectedCategoryId === "all") return "Tất cả";
    return (
      categories.find((c) => c.id === selectedCategoryId)?.name ?? "Tất cả"
    );
  }, [categories, selectedCategoryId]);

  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const categoryMenuRef = useRef<HTMLDivElement | null>(null);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<any | null>(null);
  const [categorySubmenuOpenFor, setCategorySubmenuOpenFor] = useState<
    string | null
  >(null);

  // Gán phân loại cho từng bạn bè: friendId -> categoryId
  const [friendCategoryMap, setFriendCategoryMap] = useState<
    Record<string, string>
  >({});
  const [toast, setToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    void fetchPostFeed({ silent: true });
  }, [fetchPostFeed]);

  const viewingProfileMedia = useMemo(() => {
    if (!viewingProfile?.id) return [];
    return posts
      .filter((post) => post.userId === viewingProfile.id)
      .flatMap((post) => {
        const items = Array.isArray(post.mediaItems) && post.mediaItems.length > 0
          ? post.mediaItems
          : post.mediaUrl
            ? [{ id: post.id, mediaUrl: post.mediaUrl, mediaType: post.mediaType, sortOrder: 0 }]
            : [];
        return items.filter((item) => item.mediaUrl && (item.mediaType === "IMAGE" || item.mediaType === "VIDEO"));
      });
  }, [posts, viewingProfile?.id]);

  // Load categories + assignments từ backend
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cats, assigns] = await Promise.all([
          friendCategoryService.listCategories(),
          friendCategoryService.listAssignments(),
        ]);
        if (cancelled) return;

        // Nếu BE chưa có categories (user mới), seed mặc định lên BE để đồng bộ
        let finalCats = cats;
        if (!finalCats.length) {
          finalCats = await Promise.all(
            DEFAULT_CATEGORIES.map((c) =>
              friendCategoryService.createCategory({
                name: c.name,
                color: c.color,
              }),
            ),
          );
        }
        if (cancelled) return;
        setCategories(finalCats);

        const map: Record<string, string> = {};
        assigns.forEach((a) => {
          if (a.categoryId) map[a.targetUserId] = a.categoryId;
        });
        setFriendCategoryMap(map);
      } catch {
        // Nếu lỗi mạng, fallback giữ default (UI vẫn chạy)
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup toast timeout
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }
    };
  }, []);

  // Đóng menu khi click ra ngoài
  useEffect(() => {
    if (!categoryMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const el = categoryMenuRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setCategoryMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [categoryMenuOpen]);
  const [confirmDelete, setConfirmDelete] = useState<{
    friendId: string;
    friendName: string;
  } | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<{
    userId: string;
    userName: string;
  } | null>(null);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const handleRemoveClick = (friendId: string, friendName: string) => {
    setConfirmDelete({ friendId, friendName });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    try {
      await removeFriend(confirmDelete.friendId);
      setConfirmDelete(null);
    } catch {
      // lỗi đã được lưu trong store
    }
  };

  const handleCancelDelete = () => {
    setConfirmDelete(null);
  };

  const openManageCategories = () => {
    setCategoryMenuOpen(false);
    setCategorySubmenuOpenFor(null);
    setManageCategoriesOpen(true);
  };

  const randomColor = () => {
    const palette = [
      "#ef4444",
      "#22c55e",
      "#f97316",
      "#8b5cf6",
      "#eab308",
      "#3b82f6",
    ];
    return palette[Math.floor(Math.random() * palette.length)];
  };

  const slugifyId = (name: string) => {
    const base = name
      .trim()
      .toLowerCase()
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const id = base || "category";
    let finalId = id;
    let i = 1;
    while (categories.some((c) => c.id === finalId) || finalId === "all") {
      finalId = `${id}_${i++}`;
    }
    return finalId;
  };

  const addCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    const color = randomColor();
    const tempId = slugifyId(name);

    // Optimistic UI
    setCategories((prev) => [...prev, { id: tempId, name, color }]);
    setNewCategoryName("");

    // Persist lên BE
    friendCategoryService
      .createCategory({ name, color })
      .then((created) => {
        setCategories((prev) =>
          prev.map((c) => (c.id === tempId ? created : c)),
        );
      })
      .catch(() => {
        setCategories((prev) => prev.filter((c) => c.id !== tempId));
      });
  };

  const startEdit = (c: FriendCategory) => {
    setEditingId(c.id);
    setEditingName(c.name);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) return;
    setCategories((prev) =>
      prev.map((c) => (c.id === editingId ? { ...c, name } : c)),
    );
    const id = editingId;
    const color = categories.find((c) => c.id === id)?.color ?? "#3b82f6";
    friendCategoryService.updateCategory(id, { name, color }).catch(() => {
      // ignore
    });
    setEditingId(null);
    setEditingName("");
  };

  const deleteCategory = (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    if (selectedCategoryId === id) setSelectedCategoryId("all");
    if (editingId === id) {
      setEditingId(null);
      setEditingName("");
    }
    setFriendCategoryMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((friendId) => {
        if (next[friendId] === id) delete next[friendId];
      });
      return next;
    });
    friendCategoryService.deleteCategory(id).catch(() => {
      // ignore
    });
  };

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 3000);
  };

  // Lọc & nhóm theo chữ cái đầu (giống Zalo A, B, C,...)
  const groupedFriends = useMemo(() => {
    const items = friends
      .map((item) => {
        const u = getFriendUser(item, currentUserId);
        return {
          raw: item,
          user: u,
          name: (u.displayName || u.username || "").trim(),
        };
      })
      // Lọc theo ô "Tìm bạn"
      .filter(({ name }) =>
        search.trim()
          ? name.toLowerCase().includes(search.trim().toLowerCase())
          : true,
      )
      // Lọc theo thẻ phân loại
      .filter(({ user }) => {
        if (selectedCategoryId === "all") return true; // không lọc
        const catId = friendCategoryMap[user.id]; // friendCategoryMap: friendId -> categoryId
        return catId === selectedCategoryId;
      })
      // Sắp xếp theo tên
      .sort((a, b) => {
        const cmp = a.name.localeCompare(b.name, "vi", { sensitivity: "base" });
        return sortOrder === "asc" ? cmp : -cmp;
      });

    const groups: Record<string, typeof items> = {};
    for (const it of items) {
      const letter = it.name.charAt(0).toUpperCase() || "#";
      const key =
        /[A-ZÁÀÂÃĂẠẢẤẦẨẪẬẮẰẲẴẶÉÈẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴ]/.test(
          letter,
        )
          ? letter
          : "#";
      if (!groups[key]) groups[key] = [];
      groups[key].push(it);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [
    friends,
    currentUserId,
    search,
    sortOrder,
    selectedCategoryId,
    friendCategoryMap,
  ]);

  return (
    <div
      onClick={() => {
        setActionMenuOpenId(null);
        setCategorySubmenuOpenFor(null);
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: isDark ? "var(--bg-secondary)" : "#f7f9fb",
        color: "var(--text-primary)",
        transition: "background-color 0.3s ease",
      }}
    >
      <div
        style={{
          padding: "12px 16px 8px",
          borderBottom: `1px solid ${isDark ? "var(--border-primary)" : "#e3e6ea"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Danh sách bạn bè
          </h2>
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              color: "var(--text-tertiary)",
            }}
          >
            {friends.length > 0 ? `Bạn bè (${friends.length})` : ""}
          </div>
        </div>
      </div>

      {/* Thanh tìm kiếm + sắp xếp + phân loại */}
      <div
        style={{
          padding: "8px 16px 12px",
          borderBottom: `1px solid ${isDark ? "var(--border-primary)" : "#e5e7eb"}`,
          backgroundColor: isDark ? "var(--bg-primary)" : "#f9fafb",
          display: "flex",
          alignItems: "center",
          gap: 8,
          transition: "background-color 0.3s ease",
        }}
      >
        {!hideSearchField ? (
          <div style={{ flex: 1, minWidth: 0 }}>
            <WebSearchInputBar
              value={search}
              onValueChange={(v) =>
                onSearchChange ? onSearchChange(v) : setInternalSearch(v)
              }
              placeholder={WEB_SEARCH_PLACEHOLDER}
            />
          </div>
        ) : null}

        {/* Sắp xếp theo tên A-Z / Z-A */}
        <button
          type="button"
          onClick={() =>
            setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
          }
          style={{
            padding: "6px 14px",
            borderRadius: 999,
            border: `1px solid ${isDark ? "var(--border-secondary)" : "#e5e7eb"}`,
            backgroundColor: isDark ? "var(--bg-tertiary)" : "#f3f4f6",
            fontSize: 12,
            color: "var(--text-primary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span style={{ fontSize: 14 }}>⇅</span>
          <span>{sortOrder === "asc" ? "Tên (A-Z)" : "Tên (Z-A)"}</span>
          <span style={{ fontSize: 10 }}>▾</span>
        </button>

        {/* Phân loại bạn bè theo loại (UI trước, logic sau) */}
        <div style={{ position: "relative" }} ref={categoryMenuRef}>
          <button
            type="button"
            onClick={() => setCategoryMenuOpen((v) => !v)}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: `1px solid ${isDark ? "var(--border-secondary)" : "#e5e7eb"}`,
              backgroundColor: isDark ? "var(--bg-tertiary)" : "#f3f4f6",
              fontSize: 12,
              color: "var(--text-primary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              minWidth: 150,
              justifyContent: "space-between",
            }}
          >
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span style={{ fontSize: 14 }}>⏷</span>
              <span>{selectedCategoryLabel}</span>
            </span>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
              ▾
            </span>
          </button>

          {categoryMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: 240,
                backgroundColor: "var(--bg-primary)",
                border: `1px solid ${isDark ? "var(--border-secondary)" : "#e5e7eb"}`,
                borderRadius: 12,
                boxShadow: "var(--shadow-lg)",
                overflow: "hidden",
                zIndex: 50,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryId("all");
                  setCategoryMenuOpen(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  border: "none",
                  backgroundColor: "transparent",
                  cursor: "pointer",
                  textAlign: "left" as const,
                  fontSize: 14,
                  color: "var(--text-primary)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDark
                    ? "var(--bg-hover)"
                    : "#f9fafb";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                {/* Không cần ô màu, hoặc dùng màu xám nhạt */}
                <span style={{ flex: 1 }}>Tất cả</span>
              </button>

              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId(c.id);
                    setCategoryMenuOpen(false);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    border: "none",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    textAlign: "left" as const,
                    fontSize: 14,
                    color: "var(--text-primary)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDark
                      ? "var(--bg-hover)"
                      : "#f9fafb";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: c.color,
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1 }}>{c.name}</span>
                </button>
              ))}

              <div
                style={{
                  height: 1,
                  backgroundColor: isDark ? "var(--border-primary)" : "#e5e7eb",
                }}
              />
              <button
                type="button"
                onClick={openManageCategories}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "none",
                  backgroundColor: "transparent",
                  cursor: "pointer",
                  fontSize: 14,
                  color: "var(--text-primary)",
                  textAlign: "center" as const,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDark
                    ? "var(--bg-hover)"
                    : "#f9fafb";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                Quản lý thẻ phân loại
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div
          style={{
            padding: "16px 20px",
            backgroundColor: isDark ? "rgba(239, 68, 68, 0.1)" : "#fef2f2",
            borderLeft: "4px solid var(--danger)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--danger)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                Lỗi tải dữ liệu
              </span>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {error}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchFriends}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "none",
              backgroundColor: "var(--danger)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          backgroundColor: isDark ? "var(--bg-secondary)" : "#f9fafb",
          transition: "background-color 0.3s ease",
        }}
      >
        {/* Loading state */}
        {loading && (
          <div
            style={{
              padding: 40,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                border: "3px solid var(--border-primary)",
                borderTop: "3px solid var(--accent)",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                marginBottom: 16,
              }}
            />
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
            <span
              style={{
                color: "var(--text-secondary)",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Đang tải danh sách bạn bè...
            </span>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && friends.length === 0 && (
          <div
            style={{
              padding: "60px 24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                backgroundColor: isDark ? "var(--bg-tertiary)" : "#f3f4f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              <svg
                width="60"
                height="60"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <h3
              style={{
                margin: "0 0 8px 0",
                fontSize: 18,
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              Chưa có bạn bè
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: "var(--text-secondary)",
                maxWidth: 300,
                lineHeight: 1.5,
              }}
            >
              Tìm kiếm bạn bè bằng số điện thoại để kết nối và trò chuyện cùng
              nhau.
            </p>
          </div>
        )}

        {/* Search Not found state */}
        {!loading &&
          !error &&
          friends.length > 0 &&
          search &&
          groupedFriends.length === 0 && (
            <div
              style={{
                padding: "40px 24px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  backgroundColor: isDark ? "var(--bg-tertiary)" : "#f3f4f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-muted)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: "var(--text-secondary)",
                }}
              >
                Không tìm thấy ai có tên "
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {search}
                </span>
                "
              </p>
            </div>
          )}
        {groupedFriends.map(([letter, items]) => (
          <div key={letter}>
            {/* Header chữ cái */}
            <div
              style={{
                padding: "6px 16px",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
              }}
            >
              {letter}
            </div>
            {items.map(({ raw, user: friendUser }) => {
              const initial =
                (friendUser.displayName || friendUser.username || "?")
                  .charAt(0)
                  .toUpperCase() || "?";
              return (
                <div
                  key={raw.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "8px 16px",
                    backgroundColor: "var(--bg-primary)",
                    borderBottom: `1px solid ${isDark ? "var(--border-primary)" : "#f3f4f6"}`,
                    cursor: "pointer",
                    transition: "background-color 0.15s ease",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      overflow: "hidden",
                      marginRight: 12,
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.1)"
                        : "#e3e7ed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 600,
                      color: isDark ? "var(--text-secondary)" : "#344767",
                      flexShrink: 0,
                    }}
                  >
                    {friendUser.avatarUrl ? (
                      <img
                        src={friendUser.avatarUrl}
                        alt={friendUser.displayName || friendUser.username}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      initial
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {friendUser.displayName || friendUser.username}
                    </div>
                    {/* Thẻ phân loại (hiển thị sau khi gán) */}
                    {(() => {
                      const catId = friendCategoryMap[friendUser.id];
                      if (!catId) return null;
                      const cat = categories.find((c) => c.id === catId);
                      if (!cat) return null;
                      return (
                        <div
                          style={{
                            marginTop: 4,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                            color: "var(--text-secondary)",
                          }}
                        >
                          <span
                            style={{
                              width: 12,
                              height: 8,
                              borderRadius: 999,
                              backgroundColor: cat.color,
                              display: "inline-block",
                            }}
                          />
                          <span>{cat.name}</span>
                        </div>
                      );
                    })()}
                    {friendUser.statusMessage && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-tertiary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {friendUser.statusMessage}
                      </div>
                    )}
                  </div>
                  <div style={{ position: "relative", marginLeft: 8 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionMenuOpenId((prev) => {
                          const next =
                            prev === friendUser.id ? null : friendUser.id;
                          if (next === null) setCategorySubmenuOpenFor(null);
                          return next;
                        });
                      }}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        border: `1px solid ${isDark ? "var(--border-secondary)" : "#e5e7eb"}`,
                        backgroundColor: isDark
                          ? "var(--bg-tertiary)"
                          : "#f9fafb",
                        color: "var(--text-secondary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        fontSize: 16,
                      }}
                    >
                      ⋯
                    </button>

                    {actionMenuOpenId === friendUser.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: "absolute",
                          top: "calc(100% + 4px)",
                          right: 0,
                          width: 220,
                          backgroundColor: "var(--bg-primary)",
                          borderRadius: 12,
                          border: `1px solid ${isDark ? "var(--border-secondary)" : "#e5e7eb"}`,
                          boxShadow: "var(--shadow-lg)",
                          // cần overflow visible để submenu "Phân loại" không bị cắt
                          overflow: "visible",
                          zIndex: 60,
                        }}
                      >
                        <button
                          type="button"
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            border: "none",
                            backgroundColor: "transparent",
                            textAlign: "left",
                            fontSize: 14,
                            color: "var(--text-primary)",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = isDark
                              ? "var(--bg-hover)"
                              : "#f9fafb";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                              "transparent";
                          }}
                          // TODO: mở panel xem thông tin chi tiết
                          onClick={() => {
                            setActionMenuOpenId(null);
                            setViewingProfile(friendUser);
                          }}
                        >
                          Xem thông tin
                        </button>

                        <button
                          type="button"
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            border: "none",
                            backgroundColor: "transparent",
                            textAlign: "left",
                            fontSize: 14,
                            color: "var(--text-primary)",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = isDark
                              ? "var(--bg-hover)"
                              : "#f9fafb";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                              "transparent";
                          }}
                          onClick={() => {
                            // toggle submenu phân loại
                            setCategorySubmenuOpenFor((prev) =>
                              prev === friendUser.id ? null : friendUser.id,
                            );
                          }}
                        >
                          Phân loại &gt;
                        </button>

                        {/* Submenu phân loại */}
                        {categorySubmenuOpenFor === friendUser.id && (
                          <div
                            style={{
                              position: "absolute",
                              top: 44,
                              right: 220,
                              width: 240,
                              backgroundColor: "var(--bg-primary)",
                              borderRadius: 12,
                              border: `1px solid ${isDark ? "var(--border-secondary)" : "#e5e7eb"}`,
                              boxShadow: "var(--shadow-lg)",
                              overflow: "hidden",
                              zIndex: 61,
                            }}
                          >
                            {categories.map((c) => {
                              const isSelected =
                                friendCategoryMap[friendUser.id] === c.id;
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    setFriendCategoryMap((prev) => {
                                      const current = prev[friendUser.id];
                                      // Click lại đúng thẻ đang chọn => hủy phân loại
                                      if (current === c.id) {
                                        const next = { ...prev };
                                        delete next[friendUser.id];
                                        return next;
                                      }
                                      return {
                                        ...prev,
                                        [friendUser.id]: c.id,
                                      };
                                    });
                                    // Persist lên BE: nếu click lại thẻ đang chọn => gửi null để hủy
                                    friendCategoryService
                                      .assignCategory(
                                        friendUser.id,
                                        isSelected ? null : c.id,
                                      )
                                      .catch(() => {
                                        // ignore
                                      });
                                    showToast("Cập nhật phân loại thành công");
                                    setCategorySubmenuOpenFor(null);
                                    setActionMenuOpenId(null);
                                  }}
                                  style={{
                                    width: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    padding: "10px 12px",
                                    border: "none",
                                    backgroundColor: "transparent",
                                    cursor: "pointer",
                                    textAlign: "left" as const,
                                    fontSize: 14,
                                    color: "var(--text-primary)",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                      "#f9fafb";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                      "transparent";
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 18,
                                      height: 12,
                                      borderRadius: 6,
                                      backgroundColor: c.color,
                                      display: "inline-block",
                                      flexShrink: 0,
                                    }}
                                  />
                                  <span style={{ flex: 1 }}>{c.name}</span>
                                  {isSelected && (
                                    <span
                                      style={{ fontSize: 14, color: "#10b981" }}
                                    >
                                      ✓
                                    </span>
                                  )}
                                </button>
                              );
                            })}

                            <div
                              style={{
                                height: 1,
                                backgroundColor: isDark
                                  ? "var(--border-primary)"
                                  : "#e5e7eb",
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                openManageCategories();
                              }}
                              style={{
                                width: "100%",
                                padding: "10px 12px",
                                border: "none",
                                backgroundColor: "transparent",
                                cursor: "pointer",
                                fontSize: 14,
                                color: "var(--text-primary)",
                                textAlign: "center" as const,
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "#f9fafb";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "transparent";
                              }}
                            >
                              Quản lý thẻ phân loại
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            border: "none",
                            backgroundColor: "transparent",
                            textAlign: "left",
                            fontSize: 14,
                            color: "var(--text-primary)",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = isDark
                              ? "var(--bg-hover)"
                              : "#f9fafb";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                              "transparent";
                          }}
                          // TODO: đặt tên gợi nhớ
                          onClick={() => {
                            setActionMenuOpenId(null);
                          }}
                        >
                          Đặt tên gợi nhớ
                        </button>

                        <div
                          style={{
                            height: 1,
                            backgroundColor: isDark
                              ? "var(--border-primary)"
                              : "#e5e7eb",
                          }}
                        />

                        <button
                          type="button"
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            border: "none",
                            backgroundColor: "transparent",
                            textAlign: "left",
                            fontSize: 14,
                            color: "var(--text-primary)",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = isDark
                              ? "var(--bg-hover)"
                              : "#f9fafb";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                              "transparent";
                          }}
                          onClick={() => {
                            setActionMenuOpenId(null);
                            setConfirmBlock({
                              userId: friendUser.id,
                              userName:
                                friendUser.displayName ||
                                friendUser.username ||
                                "người này",
                            });
                          }}
                        >
                          Chặn người này
                        </button>

                        <button
                          type="button"
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            border: "none",
                            backgroundColor: "transparent",
                            textAlign: "left",
                            fontSize: 14,
                            color: "#dc2626",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = isDark
                              ? "rgba(239, 68, 68, 0.1)"
                              : "#fef2f2";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                              "transparent";
                          }}
                          onClick={() => {
                            setActionMenuOpenId(null);
                            handleRemoveClick(
                              friendUser.id,
                              friendUser.displayName ||
                                friendUser.username ||
                                "người này",
                            );
                          }}
                        >
                          Xóa bạn
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Modal xác nhận chặn người dùng */}
      {confirmBlock && (
        <div
          onClick={() => setConfirmBlock(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: isDark ? "var(--bg-primary)" : "#fff",
              borderRadius: 16,
              padding: 24,
              maxWidth: 420,
              width: "90%",
              boxShadow:
                "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                backgroundColor: "#fef2f2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
                fontSize: 28,
              }}
            >
              🚫
            </div>
            <h3
              style={{
                margin: "0 0 8px 0",
                fontSize: 18,
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              Xác nhận chặn
            </h3>
            <p
              style={{
                margin: "0 0 24px 0",
                fontSize: 14,
                color: "var(--text-tertiary)",
                lineHeight: 1.6,
              }}
            >
              Bạn có chắc chắn muốn chặn{" "}
              <strong>"{confirmBlock.userName}"</strong>?
              <br />
              <span style={{ fontSize: 13 }}>
                Người này sẽ không thể nhắn tin cho bạn và bạn cũng không thể
                nhắn tin cho họ. Bạn bè vẫn được giữ nguyên trong danh sách.
              </span>
            </p>
            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => setConfirmBlock(null)}
                style={{
                  padding: "8px 20px",
                  borderRadius: 10,
                  border: `1px solid ${isDark ? "var(--border-secondary)" : "#d1d5db"}`,
                  backgroundColor: isDark ? "var(--bg-tertiary)" : "#fff",
                  color: "var(--text-secondary)",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await blockUser(confirmBlock.userId);
                    setConfirmBlock(null);
                    showToast("Đã chặn thành công.");
                  } catch {
                    // error already in store
                  }
                }}
                style={{
                  padding: "8px 20px",
                  borderRadius: 10,
                  border: "none",
                  backgroundColor: "#dc2626",
                  color: "var(--text-inverse)",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Chặn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal xác nhận xóa bạn bè */}
      {confirmDelete && (
        <div
          onClick={handleCancelDelete}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: isDark ? "var(--bg-primary)" : "#fff",
              borderRadius: 16,
              padding: 24,
              maxWidth: 400,
              width: "90%",
              boxShadow:
                "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
          >
            <h3
              style={{
                margin: "0 0 12px 0",
                fontSize: 18,
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              Xác nhận xóa bạn bè
            </h3>
            <p
              style={{
                margin: "0 0 24px 0",
                fontSize: 14,
                color: "var(--text-tertiary)",
                lineHeight: 1.5,
              }}
            >
              Bạn có chắc chắn muốn xóa{" "}
              <strong>"{confirmDelete.friendName}"</strong> khỏi danh sách bạn
              bè không?
            </p>
            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={handleCancelDelete}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: `1px solid ${isDark ? "var(--border-secondary)" : "#d1d5db"}`,
                  backgroundColor: isDark ? "var(--bg-tertiary)" : "#fff",
                  color: "var(--text-secondary)",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: "#e11d48",
                  color: "var(--text-inverse)",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal quản lý thẻ phân loại */}
      {manageCategoriesOpen && (
        <div
          onClick={() => setManageCategoriesOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: isDark ? "var(--bg-primary)" : "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 520,
              boxShadow: "0 20px 40px rgba(15,23,42,0.18)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: `1px solid ${isDark ? "var(--border-primary)" : "#e5e7eb"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                Quản lý thẻ phân loại
              </div>
              <button
                type="button"
                onClick={() => setManageCategoriesOpen(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 18,
                  color: "var(--text-tertiary)",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {/* Add */}
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Thêm phân loại mới..."
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: `1px solid ${isDark ? "var(--border-primary)" : "#e5e7eb"}`,
                    outline: "none",
                    fontSize: 14,
                  }}
                />
                <button
                  type="button"
                  onClick={addCategory}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "none",
                    backgroundColor: "#0068FF",
                    color: "var(--text-inverse)",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Thêm
                </button>
              </div>

              {/* List */}
              <div
                style={{
                  border: `1px solid ${isDark ? "var(--border-primary)" : "#e5e7eb"}`,
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {categories.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderTop: "1px solid #f3f4f6",
                    }}
                  >
                    <span
                      style={{
                        width: 18,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: c.color,
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />

                    {editingId === c.id ? (
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        style={{
                          flex: 1,
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: `1px solid ${isDark ? "var(--border-primary)" : "#e5e7eb"}`,
                          outline: "none",
                          fontSize: 14,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          flex: 1,
                          fontSize: 14,
                          color: "var(--text-primary)",
                        }}
                      >
                        {c.name}
                      </div>
                    )}

                    {editingId === c.id ? (
                      <>
                        <button
                          type="button"
                          onClick={saveEdit}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 10,
                            border: "none",
                            backgroundColor: "#10b981",
                            color: "var(--text-inverse)",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Lưu
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditingName("");
                          }}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 10,
                            border: `1px solid ${isDark ? "var(--border-primary)" : "#e5e7eb"}`,
                            backgroundColor: isDark
                              ? "var(--bg-primary)"
                              : "#fff",
                            color: "var(--text-secondary)",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Hủy
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 10,
                            border: `1px solid ${isDark ? "var(--border-primary)" : "#e5e7eb"}`,
                            backgroundColor: isDark
                              ? "var(--bg-primary)"
                              : "#fff",
                            color: "var(--text-secondary)",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCategory(c.id)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 10,
                            border: `1px solid ${isDark ? "var(--danger)" : "#fecaca"}`,
                            backgroundColor: isDark
                              ? "rgba(239, 68, 68, 0.1)"
                              : "#fff",
                            color: "var(--danger)",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Xóa
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Info Modal */}
      {viewingProfile && (
        <div
          onClick={() => setViewingProfile(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "var(--bg-modal-overlay, rgba(0, 0, 0, 0.5))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "var(--bg-primary)",
              borderRadius: 8,
              width: "100%",
              maxWidth: 400,
              boxShadow: "var(--shadow-lg)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header: Thông tin tài khoản */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: `1px solid ${isDark ? "var(--border-primary)" : "#e5e7eb"}`,
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                Thông tin tài khoản
              </span>
              <button
                onClick={() => setViewingProfile(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  fontSize: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ overflowY: "auto", maxHeight: "80vh" }}>
              {/* Cover photo */}
              <div
                style={{
                  height: 140,
                  backgroundColor: "var(--bg-message-own)",
                  backgroundImage:
                    "url('https://camo.githubusercontent.com/6a17b08ed55cc0d68f23df2a875cfccae5f0c431ab68eab11db428ce0a969eef/68747470733a2f2f7062732e7477696d672e636f6d2f70726f66696c655f62616e6e6572732f313134373436353930353037383038373638302f313436363030383838332f3135303078353030')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  position: "relative",
                  opacity: 0.8,
                }}
              />

              {/* Avatar and Name */}
              <div
                style={{
                  position: "relative",
                  padding: "0 16px",
                  marginTop: -40,
                  display: "flex",
                  alignItems: "flex-end",
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    backgroundColor: "var(--border-primary)",
                    border: "3px solid var(--bg-primary)",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                    fontWeight: "bold",
                    color: "var(--text-secondary)",
                    flexShrink: 0,
                  }}
                >
                  {viewingProfile.avatarUrl ? (
                    <img
                      src={viewingProfile.avatarUrl}
                      alt={
                        viewingProfile.displayName || viewingProfile.username
                      }
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    (
                      viewingProfile.displayName ||
                      viewingProfile.username ||
                      "?"
                    )
                      .charAt(0)
                      .toUpperCase()
                  )}
                </div>
                <div
                  style={{
                    marginLeft: 16,
                    marginBottom: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 500,
                      color: "var(--text-primary)",
                    }}
                  >
                    {viewingProfile.displayName || viewingProfile.username}
                  </h3>
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-secondary)",
                      padding: 0,
                      display: "flex",
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 20h9"></path>
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Action Buttons: Gọi điện, Nhắn tin */}
              <div style={{ display: "flex", gap: 12, padding: "16px" }}>
                <button
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 6,
                    backgroundColor: isDark ? "var(--bg-tertiary)" : "#eaedf0",
                    color: "var(--text-primary)",
                    border: "none",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  Gọi điện
                </button>
                <button
                  onClick={() => {
                    setViewingProfile(null);
                    if (onOpenChat) onOpenChat(viewingProfile.id);
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 6,
                    backgroundColor: isDark
                      ? "rgba(137,180,250,0.15)"
                      : "#e5efff",
                    color: "var(--accent)",
                    border: "none",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  Nhắn tin
                </button>
              </div>

              {/* Divider */}
              <div
                style={{
                  height: 8,
                  backgroundColor: isDark ? "var(--bg-secondary)" : "#f3f4f6",
                }}
              />

              {/* Section: Thông tin cá nhân */}
              <div style={{ padding: "16px" }}>
                <h4
                  style={{
                    margin: "0 0 16px 0",
                    fontSize: 15,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  Thông tin cá nhân
                </h4>

                <div
                  style={{ display: "flex", marginBottom: 12, fontSize: 14 }}
                >
                  <div style={{ width: 100, color: "var(--text-tertiary)" }}>
                    Giới tính
                  </div>
                  <div style={{ color: "var(--text-primary)" }}>
                    {viewingProfile.gender === "MALE"
                      ? "Nam"
                      : viewingProfile.gender === "FEMALE"
                        ? "Nữ"
                        : viewingProfile.gender || "Chưa cập nhật"}
                  </div>
                </div>

                <div
                  style={{ display: "flex", marginBottom: 12, fontSize: 14 }}
                >
                  <div style={{ width: 100, color: "var(--text-tertiary)" }}>
                    Ngày sinh
                  </div>
                  <div style={{ color: "var(--text-primary)" }}>
                    {viewingProfile.dateOfBirth
                      ? (() => {
                          try {
                            const d = new Date(viewingProfile.dateOfBirth);
                            return d.toLocaleDateString("vi-VN", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            });
                          } catch {
                            return viewingProfile.dateOfBirth;
                          }
                        })()
                      : "••/••/••••"}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    marginBottom: viewingProfile.businessDescription ? 12 : 0,
                    fontSize: 14,
                  }}
                >
                  <div style={{ width: 100, color: "var(--text-tertiary)" }}>
                    Điện thoại
                  </div>
                  <div style={{ color: "var(--text-primary)" }}>
                    {viewingProfile.phone || viewingProfile.username}
                  </div>
                </div>

                {viewingProfile.businessDescription && (
                  <div
                    style={{ display: "flex", marginBottom: 0, fontSize: 14 }}
                  >
                    <div style={{ width: 100, color: "var(--text-tertiary)" }}>
                      Mô tả
                    </div>
                    <div
                      style={{
                        color: "var(--text-primary)",
                        flex: 1,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {viewingProfile.businessDescription}
                    </div>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div
                style={{
                  height: 8,
                  backgroundColor: isDark ? "var(--bg-secondary)" : "#f3f4f6",
                }}
              />

              {/* Section: Hình ảnh */}
              <div style={{ padding: "16px" }}>
                <h4
                  style={{
                    margin: "0 0 16px 0",
                    fontSize: 15,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  Hình ảnh
                </h4>
                {viewingProfileMedia.length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {viewingProfileMedia.map((item) => {
                      const uri = getImageUrl(item.mediaUrl);
                      return (
                        <div key={item.id} style={{ aspectRatio: "1 / 1", borderRadius: 8, overflow: "hidden", backgroundColor: "#000" }}>
                          {item.mediaType === "VIDEO" ? (
                            <video src={uri} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <img src={uri} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "20px 0",
                      color: "var(--text-tertiary)",
                      fontSize: 14,
                    }}
                  >
                    Chưa có ảnh nào được chia sẻ
                  </div>
                )}
              </div>

              {/* Divider */}
              <div
                style={{
                  height: 8,
                  backgroundColor: isDark ? "var(--bg-secondary)" : "#f3f4f6",
                }}
              />

              {/* Section: List Actions */}
              <div style={{ padding: "8px 0" }}>
                <button
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-primary)",
                    fontSize: 14,
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = isDark
                      ? "var(--bg-hover)"
                      : "#f9fafb")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                  onClick={() => {
                    setViewingProfile(null);
                    setConfirmBlock({
                      userId: viewingProfile.id,
                      userName:
                        viewingProfile.displayName ||
                        viewingProfile.username ||
                        "người này",
                    });
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                  </svg>
                  Chặn liên hệ này
                </button>

                <button
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-primary)",
                    fontSize: 14,
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = isDark
                      ? "var(--bg-hover)"
                      : "#f9fafb")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                  onClick={() => {
                    if (
                      window.confirm(
                        `Xóa ${viewingProfile.displayName || viewingProfile.username} khỏi danh sách bạn bè?`,
                      )
                    ) {
                      setViewingProfile(null);
                      removeFriend(viewingProfile.id);
                    }
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                  Xóa khỏi danh sách bạn bè
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast thông báo (tự ẩn sau ~3s) */}
      {toast && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: 32,
            transform: "translateX(-50%)",
            backgroundColor: "rgba(17,24,39,0.92)",
            color: "var(--text-inverse)",
            padding: "12px 18px",
            borderRadius: 12,
            boxShadow: "0 12px 28px rgba(15,23,42,0.25)",
            fontSize: 14,
            fontWeight: 500,
            zIndex: 2000,
            maxWidth: "calc(100vw - 32px)",
            textAlign: "center",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
