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
  const [photos, setPhotos] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [files, setFiles] = useState<{ url: string; label: string }[]>([]);

  const [showAll, setShowAll] = useState(false);
  const collectLimitEach = 60;
  const defaultPreviewLimit = 6;
  const previewLimit = showAll ? collectLimitEach : defaultPreviewLimit;

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
      setShowAll(false);
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
          const pushUrl = (arr: string[], kind: string, url: string | undefined, cap: number) => {
            if (!url || arr.length >= cap) return;
            const k = `${kind}|${url.split("?")[0]}`;
            if (seen.has(k)) return;
            seen.add(k);
            arr.push(url);
          };
          const pushFile = (arr: { url: string; label: string }[], url: string | undefined, label: string | undefined, cap: number) => {
            if (!url || arr.length >= cap) return;
            const k = `file|${url.split("?")[0]}`;
            if (seen.has(k)) return;
            seen.add(k);
            arr.push({ url, label: label?.trim() ? label : "Tệp" });
          };
          const isImage = (att: Attachment) => (att.type || "").toLowerCase().startsWith("image") || (att.type || "").toLowerCase() === "image";
          const isVideo = (att: Attachment) => {
            const t = (att.type || "").toLowerCase();
            return t.startsWith("video") || t === "video" || t.includes("mp4") || t.includes("webm");
          };

          const nextPhotos: string[] = [];
          const nextVideos: string[] = [];
          const nextLinks: string[] = [];
          const nextFiles: { url: string; label: string }[] = [];

          for (const msg of sorted) {
            const m = msg as MessageDynamo & { fileUrl?: string; fileName?: string; filename?: string };
            if ((m as any).recalled || (m as any).isRecalled) continue;
            const mt = String((m as any).type || "").toUpperCase();

            if (Array.isArray(m.attachments) && m.attachments.length) {
              m.attachments.forEach((att) => {
                if (isImage(att)) pushUrl(nextPhotos, "img", att.url, collectLimitEach);
                else if (isVideo(att)) pushUrl(nextVideos, "vid", att.url, collectLimitEach);
                else pushFile(nextFiles, att.url, att.filename || (att as any).name, collectLimitEach);
              });
            } else {
              const c = String((m as any).content || "").trim();
              const urlOnly = c.startsWith("http") ? c.split(/\s+/)[0] : "";
              const url = (m as any).fileUrl || urlOnly;
              if (url && url.startsWith("http")) {
                if (mt === "IMAGE") pushUrl(nextPhotos, "img", url, collectLimitEach);
                else if (mt === "VIDEO") pushUrl(nextVideos, "vid", url, collectLimitEach);
                else if (mt === "FILE" || mt === "DOCUMENT" || mt === "VOICE") pushFile(nextFiles, url, (m as any).fileName || (m as any).filename, collectLimitEach);
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
          setShowAll(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, roomId]);

  if (!open) return null;

  const usedMbStr = formatMegabytesFromBytes(stats.totalBytes);
  const pctFill =
    CLOUD_STORAGE_QUOTA_BYTES > 0
      ? Math.min(100, (stats.totalBytes / CLOUD_STORAGE_QUOTA_BYTES) * 100)
      : 0;
  const { photoBytes, videoBytes, fileBytes } = stats;
  const mediaSum = photoBytes + videoBytes + fileBytes;
  const hasAnyGrid = photos.length || videos.length || links.length || files.length;

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
            onClick={() => {}}
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
                  onClick={() => setShowAll((v) => !v)}
                >
                  {showAll ? "Thu gọn" : "Xem tất cả"}
                </button>
              ) : null}
            </div>

            <CloudGridSection title="Ảnh" items={photos} kind="photo" gridColStyle={gridColStyle} limit={previewLimit} />
            <CloudGridSection title="Video" items={videos} kind="video" gridColStyle={gridColStyle} limit={previewLimit} />
            <CloudGridSection title="Link" items={links} kind="link" gridColStyle={gridColStyle} limit={previewLimit} />
            <CloudGridSection title="Tệp tin" items={files} kind="file" gridColStyle={gridColStyle} limit={previewLimit} />

            {!loading && !hasAnyGrid ? (
              <div className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
                Chưa có nội dung nào trong Cloud.
              </div>
            ) : null}
          </div>

          <div
            className="mt-4 rounded-2xl p-4"
            style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <span style={{ color: "#0068ff", fontWeight: 800 }}>i</span>
              </div>
              <div className="min-w-0">
                <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  Nâng cấp dung lượng My Documents
                </div>
                <div className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                  Mở rộng dung lượng lên đến 100GB để lưu thêm tài liệu, ảnh, video và ghi âm trong Cloud của tôi.
                </div>
                <button
                  type="button"
                  className="mt-3 px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ backgroundColor: "#e6f0ff", color: "#0068ff" }}
                  onClick={() => {}}
                >
                  Thêm dung lượng
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
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
}: {
  title: string;
  items: any[];
  kind: "photo" | "video" | "link" | "file";
  gridColStyle: React.CSSProperties;
  limit: number;
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
          ? (items as { url: string; label: string }[]).slice(0, displayLimit).map((it) => (
              <a
                key={it.url}
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
          : (items as string[]).slice(0, displayLimit).map((url) =>
              kind === "photo" ? (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  style={cardStyle}
                  className="block aspect-square hover:opacity-90 transition-opacity"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </a>
              ) : kind === "video" ? (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...cardStyle, backgroundColor: "#141414" }}
                  className="block aspect-square flex items-center justify-center hover:opacity-90 transition-opacity"
                  title="Video"
                >
                  <div className="text-3xl" style={{ color: "rgba(255,255,255,0.75)" }}>
                    ▶
                  </div>
                </a>
              ) : (
                <a
                  key={url}
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
              ),
            )}
      </div>
    </div>
  );
}
