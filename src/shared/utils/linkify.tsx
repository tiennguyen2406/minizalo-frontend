import React from "react";

const URL_RE = /(https?:\/\/[^\s<>"']+)/gi;

export function linkifyText(text: string): React.ReactNode[] {
    if (!text) return [];
    const parts: React.ReactNode[] = [];
    let last = 0;
    const re = new RegExp(URL_RE.source, "gi");
    let m: RegExpExecArray | null;
    let key = 0;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) {
            parts.push(<React.Fragment key={`t-${key++}`}>{text.slice(last, m.index)}</React.Fragment>);
        }
        const href = m[0];
        parts.push(
            <a
                key={`a-${key++}`}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline break-all hover:text-blue-800"
                onClick={(e) => e.stopPropagation()}
            >
                {href}
            </a>
        );
        last = m.index + href.length;
    }
    if (last < text.length) {
        parts.push(<React.Fragment key={`t-${key++}`}>{text.slice(last)}</React.Fragment>);
    }
    return parts.length ? parts : [<React.Fragment key="e">{text}</React.Fragment>];
}

export function extractFirstHttpUrl(text: string): string | null {
    if (!text) return null;
    const re = new RegExp(URL_RE.source, "i");
    const m = text.match(re);
    return m ? m[0] : null;
}
