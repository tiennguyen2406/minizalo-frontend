import React, { useEffect, useState } from "react";
import { chatService, LinkPreviewDto } from "@/shared/services/chatService";

const previewCache = new Map<string, LinkPreviewDto>();
const MAX_CACHE = 40;

function cacheSet(url: string, v: LinkPreviewDto) {
    previewCache.set(url, v);
    while (previewCache.size > MAX_CACHE) {
        const first = previewCache.keys().next().value;
        if (first !== undefined) previewCache.delete(first);
    }
}

interface LinkPreviewCardProps {
    url: string;
}

const LinkPreviewCard: React.FC<LinkPreviewCardProps> = ({ url }) => {
    const [data, setData] = useState<LinkPreviewDto | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            const cached = previewCache.get(url);
            if (cached && cached !== "loading" && cached !== "error") {
                if (!cancelled) {
                    setData(cached);
                    setLoading(false);
                }
                return;
            }
            try {
                const d = await chatService.getLinkPreview(url);
                cacheSet(url, d);
                if (!cancelled) setData(d);
            } catch {
                if (!cancelled) setData(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [url]);

    if (loading) {
        return (
            <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                Đang tải xem trước liên kết…
            </div>
        );
    }
    if (!data || (!data.title && !data.description && !data.imageUrl)) {
        return null;
    }

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex max-w-full overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-sm transition hover:bg-gray-50 no-underline"
            onClick={(e) => e.stopPropagation()}
        >
            {data.imageUrl ? (
                <img
                    src={data.imageUrl}
                    alt=""
                    className="h-20 w-28 shrink-0 object-cover"
                    onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                    }}
                />
            ) : null}
            <div className="min-w-0 flex-1 p-2">
                {data.title ? (
                    <div className="line-clamp-2 text-sm font-semibold text-gray-900">{data.title}</div>
                ) : null}
                {data.description ? (
                    <div className="mt-0.5 line-clamp-2 text-xs text-gray-600">{data.description}</div>
                ) : null}
                <div className="mt-1 truncate text-[11px] text-gray-400">{url}</div>
            </div>
        </a>
    );
};

export default LinkPreviewCard;
