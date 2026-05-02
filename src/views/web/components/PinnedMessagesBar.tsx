import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { pollService } from "@/shared/services/pollService";
import type { Message, Poll, User } from "@/shared/types";
import { getPinnedBarPreview, pinnedKindLabel } from "./pinnedBarUtils";

function ChatPinIcon({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <div
      className={`rounded-full bg-[#0068ff] flex items-center justify-center shrink-0 text-white shadow-sm ${className}`}
    >
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    </div>
  );
}

export interface PinnedMessagesBarProps {
  roomId: string;
  pinnedMessagesSorted: Message[];
  participantMap: Record<string, User>;
  scrollToMessageHighlight: (messageId: string) => void;
  handleTogglePin: (messageId: string, currentPinned: boolean) => void;
  isGroupRoom?: boolean;
  onOpenGroupInfo?: () => void;
}

export default function PinnedMessagesBar({
  roomId,
  pinnedMessagesSorted,
  participantMap,
  scrollToMessageHighlight,
  handleTogglePin,
  isGroupRoom,
  onOpenGroupInfo,
}: PinnedMessagesBarProps) {
  const needsPoll = pinnedMessagesSorted.some((m) => m.type === "POLL");
  const { data: polls } = useQuery({
    queryKey: ["polls", roomId],
    queryFn: () => pollService.getPollsInRoom(roomId),
    enabled: !!roomId && needsPoll,
    refetchInterval: 5000,
  });

  const pollById = useMemo(() => {
    const map = new Map<string, Poll>();
    (polls || []).forEach((p) => map.set(p.id, p));
    return map;
  }, [polls]);

  const [expanded, setExpanded] = useState(false);
  const [heroMenuOpen, setHeroMenuOpen] = useState(false);
  const [rowMenuFor, setRowMenuFor] = useState<string | null>(null);

  useEffect(() => {
    setExpanded(false);
    setHeroMenuOpen(false);
    setRowMenuFor(null);
  }, [roomId]);

  const hero = pinnedMessagesSorted[0];
  const extraPins = pinnedMessagesSorted.slice(1);

  if (!hero) return null;

  const heroPoll =
    hero.type === "POLL" && hero.content
      ? pollById.get(hero.content)
      : undefined;
  const heroPreview = getPinnedBarPreview(hero, participantMap, heroPoll);
  const heroKind = pinnedKindLabel(hero);

  const copyForMessage = (m: Message) => {
    const pol =
      m.type === "POLL" && m.content ? pollById.get(m.content) : undefined;
    if (m.type === "POLL" && pol?.question) return pol.question;
    if (
      m.type === "FILE" ||
      m.type === "IMAGE" ||
      m.type === "VIDEO" ||
      m.type === "DOCUMENT" ||
      m.type === "VOICE"
    )
      return getPinnedBarPreview(m, participantMap, pol);
    return m.content || getPinnedBarPreview(m, participantMap, pol);
  };

  const renderExpandedRow = (msg: Message) => {
    const pol =
      msg.type === "POLL" && msg.content ? pollById.get(msg.content) : null;
    const kind = pinnedKindLabel(msg);
    const menuOpen = rowMenuFor === String(msg.id);

    return (
      <div
        key={msg.id}
        className="flex gap-3 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50/80 transition-colors"
      >
        <button
          type="button"
          className="flex flex-1 min-w-0 gap-3 text-left rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40 -m-1 p-1"
          onClick={() => scrollToMessageHighlight(String(msg.id))}
        >
          <ChatPinIcon className="h-9 w-9" />
          <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-gray-800">{kind}</p>
          {msg.type === "POLL" && pol ? (
            <p className="text-[13px] font-semibold text-gray-900 mt-1 leading-snug">
              {pol.question}
            </p>
          ) : msg.type === "POLL" && !pol ? (
            <p className="text-sm text-gray-500 mt-1 italic">
              Đang tải bình chọn…
            </p>
          ) : (
            <p className="text-[13px] text-gray-700 mt-1 line-clamp-3 break-words">
              {getPinnedBarPreview(msg, participantMap)}
            </p>
          )}
          </div>
        </button>
        <div
          className="relative shrink-0 self-start pt-1"
          data-pin-menu
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="p-1 rounded-full text-gray-500 hover:bg-gray-200/80"
            aria-label="Tùy chọn"
            onClick={(e) => {
              e.stopPropagation();
              setRowMenuFor(menuOpen ? null : String(msg.id));
            }}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setRowMenuFor(null)}
              />
              <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-100 py-1.5 min-w-[150px]">
                <button
                  type="button"
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                  onClick={() => {
                    void navigator.clipboard.writeText(copyForMessage(msg));
                    setRowMenuFor(null);
                  }}
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="w-full text-left px-4 py-2 hover:bg-red-50 text-sm text-red-600"
                  onClick={() => {
                    handleTogglePin(String(msg.id), true);
                    setRowMenuFor(null);
                  }}
                >
                  Bỏ ghim
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {!expanded ? (
        <div className="w-full min-w-0 flex items-stretch gap-2 px-3 py-2 bg-[#f7f8fa] border-b border-gray-200/90 shrink-0">
          <div
            role="button"
            tabIndex={0}
            className="flex flex-1 min-w-0 items-start gap-2.5 cursor-pointer rounded-lg px-1 py-0.5 hover:bg-gray-100/90 transition-colors"
            title="Xem trong cuộc trò chuyện"
            onClick={() => scrollToMessageHighlight(String(hero.id))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                scrollToMessageHighlight(String(hero.id));
              }
            }}
          >
            <div className="text-[#0068ff] shrink-0 pt-0.5">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <div className="flex flex-col min-w-0 text-left">
              <span className="text-[11px] font-semibold text-gray-800 leading-tight">
                {heroKind}
              </span>
              <span className="text-[13px] text-gray-600 truncate leading-snug">
                {heroPreview}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 self-center">
            {extraPins.length > 0 && (
              <button
                type="button"
                title="Xem danh sách ghim đầy đủ"
                className="flex items-center gap-0.5 pl-2.5 pr-2 py-1.5 rounded-md border border-gray-300 bg-white text-xs font-semibold text-gray-900 shadow-sm hover:bg-gray-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(true);
                  setHeroMenuOpen(false);
                }}
              >
                +{extraPins.length} ghim
                <svg
                  className="w-4 h-4 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setHeroMenuOpen((v) => !v);
                }}
                className="p-1.5 rounded-full text-gray-500 hover:bg-gray-200/80 transition-colors"
                title="Tùy chọn"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
              </button>

              {heroMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setHeroMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-100 py-1.5 min-w-[150px]">
                    <button
                      type="button"
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center gap-2 text-gray-700"
                      onClick={() => {
                        void navigator.clipboard.writeText(
                          copyForMessage(hero),
                        );
                        setHeroMenuOpen(false);
                      }}
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      className="w-full text-left px-4 py-2 hover:bg-red-50 hover:text-red-600 text-sm flex items-center gap-2 text-gray-700"
                      onClick={() => {
                        handleTogglePin(String(hero.id), true);
                        setHeroMenuOpen(false);
                      }}
                    >
                      Bỏ ghim
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full min-w-0 shrink-0 bg-[#eef0f2] border-b border-gray-200/90">
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="text-sm font-semibold text-gray-800">
              Danh sách ghim ({pinnedMessagesSorted.length})
            </span>
            <button
              type="button"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1"
              onClick={() => setExpanded(false)}
            >
              Thu gọn
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 15l7-7 7 7"
                />
              </svg>
            </button>
          </div>

          <div className="px-3 pb-3">
            <div className="bg-white rounded-xl border border-gray-200/90 shadow-sm overflow-hidden">
              {pinnedMessagesSorted.map((msg) => renderExpandedRow(msg))}
            </div>

            {isGroupRoom && onOpenGroupInfo && (
              <button
                type="button"
                className="w-full mt-2 py-2 text-center text-sm text-[#0068ff] font-medium hover:underline"
                onClick={() => {
                  onOpenGroupInfo();
                  setExpanded(false);
                }}
              >
                Xem tất cả ở bảng tin nhóm ›
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
