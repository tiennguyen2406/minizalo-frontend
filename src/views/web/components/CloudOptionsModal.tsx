import React, { useEffect, useMemo, useState } from "react";
import {
  aggregateCloudStorageFromMessages,
  CLOUD_STORAGE_QUOTA_BYTES,
  CLOUD_STORAGE_QUOTA_MB,
  EMPTY_CLOUD_STORAGE,
  fetchAllCloudRoomMessages,
  formatMegabytesFromBytes,
  type CloudStorageBreakdown,
} from "@/shared/utils/cloudStorageAggregate";
import type { Attachment, MessageDynamo } from "@/shared/services/chatService";
import { MessageService } from "@/shared/services/MessageService";
import { useChatStore } from "@/shared/store/useChatStore";

type CloudMediaItem = { id: string; url: string; messageId: string };
type CloudGalleryItem = CloudMediaItem & { kind: "photo" | "video" };
type CloudFileItem = CloudMediaItem & { label: string };
type CloudCleanupItem = CloudMediaItem & { kind: "photo" | "video" | "file"; label?: string };

function normalizeCloudUrl(url: string | undefined): string {
  const raw = (url || "").trim();
  if (!raw) return "";
  const withoutQuery = raw.split("?")[0] || raw;
  try {
    return decodeURIComponent(withoutQuery);
  } catch {
    return withoutQuery;
  }
}

function cloudUrlMatches(a: string | undefined, b: string | undefined): boolean {
  const left = normalizeCloudUrl(a);
  const right = normalizeCloudUrl(b);
  if (!left || !right) return false;
  if (left === right || left.endsWith(right) || right.endsWith(left)) return true;
  const leftName = left.slice(left.lastIndexOf("/") + 1);
  const rightName = right.slice(right.lastIndexOf("/") + 1);
  return !!leftName && leftName === rightName;
}

export default function CloudOptionsModal({
  open,
  onClose,
  roomId,
}: {
  open: boolean;
  onClose: () => void;
  roomId: string | null;
}) {
  const [stats, setStats] = useState<CloudStorageBreakdown>(EMPTY_CLOUD_STORAGE);
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<CloudMediaItem[]>([]);
  const [videos, setVideos] = useState<CloudMediaItem[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [files, setFiles] = useState<CloudFileItem[]>([]);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [mediaPreviewIndex, setMediaPreviewIndex] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const collectLimitEach = 60;
  const defaultPreviewLimit = 6;
  const previewLimit = defaultPreviewLimit;

  const gridColStyle = useMemo(
    () =>
      ({
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 10,
      }) as React.CSSProperties,
    [],
  );

  useEffect(() => {
    if (!open || !roomId) {
      setStats(EMPTY_CLOUD_STORAGE);
      setLoading(false);
      setPhotos([]);
      setVideos([]);
      setLinks([]);
      setFiles([]);
      setShowGalleryModal(false);
      setShowCleanupModal(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const messages = await fetchAllCloudRoomMessages(roomId);
        if (!cancelled) {
          setStats(aggregateCloudStorageFromMessages(messages));
          const sorted = [...messages].sort(
            (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );

          const seen = new Set<string>();
          const pushUrl = (arr: CloudMediaItem[], kind: string, url: string | undefined, messageId: string | undefined, cap: number) => {
            if (!url || arr.length >= cap) return;
            const k = `${kind}|${url.split("?")[0]}`;
            if (seen.has(k)) return;
            seen.add(k);
            arr.push({ id: `${messageId || "msg"}-${kind}-${url}`, url, messageId: messageId || "" });
          };
          const pushFile = (arr: CloudFileItem[], url: string | undefined, label: string | undefined, messageId: string | undefined, cap: number) => {
            if (!url || arr.length >= cap) return;
            const k = `file|${url.split("?")[0]}`;
            if (seen.has(k)) return;
            seen.add(k);
            arr.push({ id: `${messageId || "msg"}-file-${url}`, url, messageId: messageId || "", label: label?.trim() ? label : "Tệp" });
          };
          const isImage = (att: Attachment) => (att.type || "").toLowerCase().startsWith("image") || (att.type || "").toLowerCase() === "image";
          const isVideo = (att: Attachment) => {
            const t = (att.type || "").toLowerCase();
            return t.startsWith("video") || t === "video" || t.includes("mp4") || t.includes("webm");
          };

          const nextPhotos: CloudMediaItem[] = [];
          const nextVideos: CloudMediaItem[] = [];
          const nextLinks: string[] = [];
          const nextFiles: CloudFileItem[] = [];

          for (const msg of sorted) {
            const m = msg as MessageDynamo & { fileUrl?: string; fileName?: string; filename?: string };
            if ((m as any).recalled || (m as any).isRecalled) continue;
            const mt = String((m as any).type || "").toUpperCase();

            if (Array.isArray(m.attachments) && m.attachments.length) {
              m.attachments.forEach((att) => {
                if (isImage(att)) pushUrl(nextPhotos, "img", att.url, m.messageId, collectLimitEach);
                else if (isVideo(att)) pushUrl(nextVideos, "vid", att.url, m.messageId, collectLimitEach);
                else pushFile(nextFiles, att.url, att.filename || (att as any).name, m.messageId, collectLimitEach);
              });
            } else {
              const c = String((m as any).content || "").trim();
              const urlOnly = c.startsWith("http") ? c.split(/\s+/)[0] : "";
              const url = (m as any).fileUrl || urlOnly;
              if (url && url.startsWith("http")) {
                if (mt === "IMAGE") pushUrl(nextPhotos, "img", url, m.messageId, collectLimitEach);
                else if (mt === "VIDEO") pushUrl(nextVideos, "vid", url, m.messageId, collectLimitEach);
                else if (mt === "FILE" || mt === "DOCUMENT" || mt === "VOICE") pushFile(nextFiles, url, (m as any).fileName || (m as any).filename, m.messageId, collectLimitEach);
              }
            }

            if (String((m as any).content || "").includes("http")) {
              const re = /(https?:\/\/[^\s<]+)/g;
              let match: RegExpExecArray | null;
              while ((match = re.exec(String((m as any).content || ""))) !== null) {
                const u = match[1];
                if (nextLinks.length >= collectLimitEach) break;
                const k = `lnk|${u}`;
                if (seen.has(k)) continue;
                seen.add(k);
                nextLinks.push(u);
              }
            }

            if (
              nextPhotos.length >= collectLimitEach &&
              nextVideos.length >= collectLimitEach &&
              nextFiles.length >= collectLimitEach &&
              nextLinks.length >= collectLimitEach
            ) {
              break;
            }
          }

          setPhotos(nextPhotos);
          setVideos(nextVideos);
          setLinks(nextLinks);
          setFiles(nextFiles);
        }
      } catch {
        if (!cancelled) {
          setStats(EMPTY_CLOUD_STORAGE);
          setPhotos([]);
          setVideos([]);
          setLinks([]);
          setFiles([]);
          setShowGalleryModal(false);
          setShowCleanupModal(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, roomId, reloadNonce]);

  if (!open) return null;

  const usedMbStr = formatMegabytesFromBytes(stats.totalBytes);
  const pctFill =
    CLOUD_STORAGE_QUOTA_BYTES > 0
      ? Math.min(100, (stats.totalBytes / CLOUD_STORAGE_QUOTA_BYTES) * 100)
      : 0;
  const { photoBytes, videoBytes, fileBytes } = stats;
  const mediaSum = photoBytes + videoBytes + fileBytes;
  const hasAnyGrid = photos.length || videos.length || links.length || files.length;
  const allMedia = [
    ...photos.map((item) => ({ ...item, kind: "photo" as const })),
    ...videos.map((item) => ({ ...item, kind: "video" as const })),
  ];

  const patchDeletedItemsInChat = (items: CloudMediaItem[]) => {
    if (!roomId || items.length === 0) return;
    const store = useChatStore.getState();
    const currentMessages = store.messages[roomId] || [];
    if (!currentMessages.length) return;
    const nextMessages = currentMessages.map((message) => {
      const selectedForMessage = items.filter((item) => item.messageId === message.id);
      if (!selectedForMessage.length) return message;
      const nextAttachments = (message.attachments || []).filter(
        (attachment: any) => !selectedForMessage.some((item) => cloudUrlMatches(attachment?.url, item.url)),
      );
      if ((message.attachments || []).length > 0) {
        if (nextAttachments.length === 0) {
          return { ...message, attachments: [], fileUrl: undefined, fileName: undefined, fileSize: undefined, isRecall: true, content: "[Tin nhắn đã thu hồi]" };
        }
        const first = nextAttachments[0] as any;
        return {
          ...message,
          attachments: nextAttachments,
          fileUrl: first?.url,
          fileName: first?.name || first?.filename,
          fileSize: first?.size,
        };
      }
      const shouldRecallLegacy = selectedForMessage.some((item) => cloudUrlMatches(message.fileUrl || message.content, item.url));
      return shouldRecallLegacy
        ? { ...message, fileUrl: undefined, fileName: undefined, fileSize: undefined, isRecall: true, content: "[Tin nhắn đã thu hồi]" }
        : message;
    });
    store.setMessages(roomId, nextMessages);
  };

  const deleteMediaItems = async (items: CloudMediaItem[]) => {
    if (!roomId || items.length === 0) return;
    setDeletingId("bulk");
    setDeleteError(null);
    try {
      await MessageService.deleteCloudMediaItems(
        roomId,
        items.map((item) => ({ messageId: item.messageId, url: item.url })),
      );
      patchDeletedItemsInChat(items);
      setReloadNonce((v) => v + 1);
    } catch (error: any) {
      const serverMessage = error?.response?.data?.message || error?.response?.data?.error;
      setDeleteError(serverMessage || "Không thể xóa nội dung này. Vui lòng thử lại.");
      throw error;
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/40 overflow-y-auto overscroll-contain"
      onClick={onClose}
    >
      <div className="min-h-full flex items-center justify-center p-4 sm:p-6">
        <div
          className="w-[640px] max-w-[94vw] h-[min(88vh,calc(100dvh-2rem))] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
          style={{ backgroundColor: "var(--bg-primary)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="shrink-0 px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--border-primary)" }}
          >
            <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
              Thông tin hội thoại
            </div>
            <button
              type="button"
              className="w-9 h-9 rounded-full hover:bg-gray-100/60 transition-colors flex items-center justify-center"
              onClick={onClose}
              title="Đóng"
            >
              <span style={{ color: "var(--text-muted)", fontSize: 18 }}>✕</span>
            </button>
          </div>

          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-5 py-6 touch-pan-y"
            style={{ WebkitOverflowScrolling: "touch" as const }}
          >
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
              <span className="text-2xl">📁</span>
            </div>
            <div className="mt-3 font-bold text-xl" style={{ color: "var(--text-primary)" }}>
              My Documents
            </div>
            <div className="mt-2 text-sm max-w-[520px]" style={{ color: "var(--text-muted)" }}>
              Lưu trữ và truy cập nhanh những nội dung quan trọng của bạn ngay trên Zalo
            </div>
          </div>

          <div
            className="mt-6 rounded-2xl p-4"
            style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>
                Dung lượng lưu trữ
              </div>
              <div className="text-sm text-right" style={{ color: "var(--text-muted)" }}>
                {loading ? "Đang tính…" : `${usedMbStr} MB / ${CLOUD_STORAGE_QUOTA_MB.toLocaleString("vi-VN")} MB`}
              </div>
            </div>
            <div className="mt-3 h-3 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-tertiary)" }}>
              {!loading && mediaSum > 0 && pctFill > 0 ? (
                <div
                  className="h-full flex rounded-full overflow-hidden"
                  style={{ width: `${pctFill}%`, maxWidth: "100%" }}
                >
                  {photoBytes > 0 ? (
                    <div className="min-w-[2px] h-full" style={{ flex: photoBytes, backgroundColor: "#60a5fa" }} />
                  ) : null}
                  {videoBytes > 0 ? (
                    <div className="min-w-[2px] h-full" style={{ flex: videoBytes, backgroundColor: "#34d399" }} />
                  ) : null}
                  {fileBytes > 0 ? (
                    <div className="min-w-[2px] h-full" style={{ flex: fileBytes, backgroundColor: "#f59e0b" }} />
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
              <LegendDot color="#60a5fa" label={`Ảnh — ${formatMegabytesFromBytes(photoBytes)} MB`} />
              <LegendDot color="#34d399" label={`Video — ${formatMegabytesFromBytes(videoBytes)} MB`} />
              <LegendDot color="#f59e0b" label={`File & thoại — ${formatMegabytesFromBytes(fileBytes)} MB`} />
            </div>
          </div>

          <button
            type="button"
            className="mt-4 w-full py-3 rounded-2xl font-semibold"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-primary)",
              color: "var(--text-primary)",
            }}
            onClick={() => setShowCleanupModal(true)}
          >
            Xem và dọn dẹp My Documents
          </button>

          {/* Nội dung trong Cloud (giống mobile) */}
          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                Nội dung trong Cloud
              </div>
              {hasAnyGrid && !loading ? (
                <button
                  type="button"
                  className="text-sm font-semibold hover:opacity-80 transition-opacity"
                  style={{ color: "var(--text-link)" }}
                  onClick={() => {
                    setShowGalleryModal(true);
                    setMediaPreviewIndex(0);
                  }}
                >
                  Xem tất cả
                </button>
              ) : null}
            </div>

            <CloudGridSection
              title="Ảnh"
              items={photos}
              kind="photo"
              gridColStyle={gridColStyle}
              limit={previewLimit}
              onOpenMedia={(item) => {
                const index = allMedia.findIndex((media) => media.id === item.id);
                if (index >= 0) setMediaPreviewIndex(index);
              }}
            />
            <CloudGridSection
              title="Video"
              items={videos}
              kind="video"
              gridColStyle={gridColStyle}
              limit={previewLimit}
              onOpenMedia={(item) => {
                const index = allMedia.findIndex((media) => media.id === item.id);
                if (index >= 0) setMediaPreviewIndex(index);
              }}
            />
            <CloudGridSection title="Link" items={links} kind="link" gridColStyle={gridColStyle} limit={previewLimit} />
            <CloudGridSection title="Tệp tin" items={files} kind="file" gridColStyle={gridColStyle} limit={previewLimit} />

            {!loading && !hasAnyGrid ? (
              <div className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
                Chưa có nội dung nào trong Cloud.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>

      {mediaPreviewIndex !== null ? (
        <CloudMediaModal
          items={allMedia}
          initialIndex={mediaPreviewIndex}
          onClose={() => {
            setShowGalleryModal(false);
            setMediaPreviewIndex(null);
          }}
        />
      ) : null}

      {showCleanupModal ? (
        <CloudCleanupModal
          photos={photos}
          videos={videos}
          files={files}
          deletingId={deletingId}
          error={deleteError}
          onClearError={() => setDeleteError(null)}
          onOpen={(item) => {
            const index = allMedia.findIndex((media) => media.id === item.id);
            if (index >= 0) setMediaPreviewIndex(index);
          }}
          onDelete={deleteMediaItems}
          onClose={() => {
            setDeleteError(null);
            setShowCleanupModal(false);
          }}
        />
      ) : null}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}

function CloudGridSection({
  title,
  items,
  kind,
  gridColStyle,
  limit,
  onOpenMedia,
}: {
  title: string;
  items: any[];
  kind: "photo" | "video" | "link" | "file";
  gridColStyle: React.CSSProperties;
  limit: number;
  onOpenMedia?: (item: CloudMediaItem) => void;
}) {
  const cardStyle: React.CSSProperties = {
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-primary)",
    borderRadius: 14,
    overflow: "hidden",
  };
  const labelStyle: React.CSSProperties = { color: "var(--text-primary)" };

  if (!items?.length) return null;
  const displayLimit = Math.max(1, limit || 6);

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold" style={labelStyle}>
          {title}
        </div>
        {items.length > displayLimit ? (
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            +{items.length - displayLimit}
          </div>
        ) : null}
      </div>

      <div style={gridColStyle}>
        {kind === "file"
          ? (items as CloudFileItem[]).slice(0, displayLimit).map((it) => (
              <a
                key={it.id || it.url}
                href={it.url}
                target="_blank"
                rel="noreferrer"
                style={cardStyle}
                className="p-3 flex flex-col gap-2 hover:opacity-90 transition-opacity"
                title={it.label}
              >
                <div className="text-xl">📄</div>
                <div className="text-xs line-clamp-2" style={{ color: "var(--text-muted)" }}>
                  {it.label}
                </div>
              </a>
            ))
          : (items as (string | CloudMediaItem)[]).slice(0, displayLimit).map((raw) => {
              const url = typeof raw === "string" ? raw : raw.url;
              const key = typeof raw === "string" ? raw : raw.id;
              return (
              kind === "photo" ? (
                <button
                  type="button"
                  key={key}
                  style={cardStyle}
                  className="block aspect-square hover:opacity-90 transition-opacity"
                  onClick={() => {
                    if (typeof raw !== "string") onOpenMedia?.(raw);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ) : kind === "video" ? (
                <button
                  type="button"
                  key={key}
                  style={{ ...cardStyle, backgroundColor: "#141414" }}
                  className="block aspect-square flex items-center justify-center hover:opacity-90 transition-opacity"
                  title="Video"
                  onClick={() => {
                    if (typeof raw !== "string") onOpenMedia?.(raw);
                  }}
                >
                  <div className="text-3xl" style={{ color: "rgba(255,255,255,0.75)" }}>
                    ▶
                  </div>
                </button>
              ) : (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  style={cardStyle}
                  className="p-3 flex items-center justify-center text-xs hover:opacity-90 transition-opacity"
                  title={url}
                >
                  <div className="line-clamp-4 text-center" style={{ color: "var(--text-muted)" }}>
                    {url.replace(/^https?:\/\//, "")}
                  </div>
                </a>
              )
              );
            })}
      </div>
    </div>
  );
}

function CloudMediaModal({
  items,
  initialIndex,
  onClose,
}: {
  items: CloudGalleryItem[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(() => Math.min(Math.max(initialIndex, 0), Math.max(items.length - 1, 0)));
  const item = items[index];
  const goPrev = () => setIndex((value) => (value <= 0 ? items.length - 1 : value - 1));
  const goNext = () => setIndex((value) => (value >= items.length - 1 ? 0 : value + 1));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [items.length, onClose]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="relative w-[min(980px,96vw)] h-[min(720px,92vh)] rounded-2xl overflow-hidden shadow-2xl flex flex-col bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute left-0 right-0 top-0 z-10 px-4 py-3 flex items-center justify-between bg-black/45">
          <div className="text-sm font-semibold text-white">
            {index + 1}/{items.length}
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full bg-white/15 text-white hover:bg-white/25">
            ×
          </button>
        </div>

        <div className="flex-1 min-h-0 flex items-center justify-center">
          {item.kind === "video" ? (
            <video src={item.url} controls autoPlay className="max-h-full max-w-full" />
          ) : (
            <img src={item.url} alt="" className="max-h-full max-w-full object-contain" />
          )}
        </div>

        {items.length > 1 ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/15 text-2xl text-white hover:bg-white/25"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={goNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/15 text-2xl text-white hover:bg-white/25"
            >
              ›
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function CloudCleanupModal({
  photos,
  videos,
  files,
  deletingId,
  error,
  onClearError,
  onOpen,
  onDelete,
  onClose,
}: {
  photos: CloudMediaItem[];
  videos: CloudMediaItem[];
  files: CloudFileItem[];
  deletingId: string | null;
  error: string | null;
  onClearError: () => void;
  onOpen: (item: CloudGalleryItem) => void;
  onDelete: (items: CloudMediaItem[]) => Promise<void>;
  onClose: () => void;
}) {
  const items: CloudCleanupItem[] = [
    ...photos.map((item) => ({ ...item, kind: "photo" as const })),
    ...videos.map((item) => ({ ...item, kind: "video" as const })),
    ...files.map((item) => ({ ...item, kind: "file" as const })),
  ];
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const selectedItems = items.filter((item) => selectedIds.has(item.id));
  const isDeleting = deletingId === "bulk";

  const toggleSelected = (id: string) => {
    onClearError();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmDelete = async () => {
    if (!selectedItems.length) return;
    try {
      await onDelete(selectedItems);
      setSelectedIds(new Set());
      setConfirmOpen(false);
    } catch {
      // Error is surfaced in this modal; keep the confirm dialog open.
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-[760px] max-w-[96vw] max-h-[86vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ backgroundColor: "var(--bg-primary)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: "var(--border-primary)" }}>
          <div>
            <div className="font-semibold" style={{ color: "var(--text-primary)" }}>Xem và dọn dẹp My Documents</div>
            <div className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {selectedItems.length ? `Đã chọn ${selectedItems.length} mục` : "Chọn một hoặc nhiều ảnh/video để xóa"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedItems.length ? (
              <button
                type="button"
                onClick={() => {
                  onClearError();
                  setConfirmOpen(true);
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: "#ef4444" }}
                disabled={isDeleting}
              >
                {isDeleting ? "Đang xóa" : `Xóa (${selectedItems.length})`}
              </button>
            ) : null}
            <button type="button" onClick={onClose} className="w-9 h-9 rounded-full hover:bg-gray-100/60">×</button>
          </div>
        </div>
        <div className="p-5 overflow-y-auto">
          {items.length ? (
            <div className="grid grid-cols-4 max-sm:grid-cols-2 gap-3">
              {items.map((item) => {
                const selected = selectedIds.has(item.id);
                return (
                <div key={item.id} className="aspect-square rounded-xl overflow-hidden bg-black relative group">
                  <button
                    type="button"
                    onClick={() => {
                      if (item.kind === "file") {
                        window.open(item.url, "_blank", "noopener,noreferrer");
                      } else {
                        onOpen(item as CloudGalleryItem);
                      }
                    }}
                    className="absolute inset-0"
                    title="Xem"
                  >
                  {item.kind === "video" ? (
                    <>
                      <video src={item.url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/15">
                        <span className="h-10 w-10 rounded-full bg-black/60 text-white flex items-center justify-center">▶</span>
                      </div>
                    </>
                  ) : item.kind === "photo" ? (
                    <img src={item.url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center gap-2 bg-[color:var(--bg-secondary)] p-3">
                      <div className="text-3xl">📄</div>
                      <div className="line-clamp-3 text-center text-xs" style={{ color: "var(--text-primary)" }}>
                        {item.label || "Tệp"}
                      </div>
                    </div>
                  )}
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => {
                      toggleSelected(item.id);
                    }}
                    className="absolute right-2 top-2 h-7 w-7 rounded-full border-2 border-white shadow disabled:opacity-60"
                    style={{ backgroundColor: selected ? "#2563eb" : "rgba(0,0,0,0.45)" }}
                    title={selected ? "Bỏ chọn" : "Chọn"}
                  >
                    <span className="text-sm font-bold text-white">{selected ? "✓" : ""}</span>
                  </button>
                </div>
              );
              })}
            </div>
          ) : (
            <div className="py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>Không có ảnh/video để dọn dẹp.</div>
          )}
        </div>
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-[100] bg-black/55 flex items-center justify-center p-4" onClick={() => setConfirmOpen(false)}>
          <div
            className="w-[360px] max-w-[92vw] rounded-2xl p-5 shadow-2xl"
            style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-primary)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Xóa nội dung
            </div>
            <div className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              Bạn có chắc chắn muốn xóa {selectedItems.length} mục đã chọn khỏi My Documents?
            </div>
            {error ? (
              <div className="mt-3 rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}>
                {error}
              </div>
            ) : null}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                onClick={() => setConfirmOpen(false)}
                disabled={isDeleting}
              >
                Hủy
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: "#ef4444" }}
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Đang xóa" : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
