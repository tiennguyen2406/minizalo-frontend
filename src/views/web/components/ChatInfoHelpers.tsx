import React, { useState, useRef, useEffect } from 'react';

interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    badge?: string | number;
}

/** Section có thể thu/mở với animation mượt kiểu Zalo */
export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
    title, children, defaultOpen = true, badge,
}) => {
    const [open, setOpen] = useState(defaultOpen);
    const contentRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState<number | string>(defaultOpen ? 'auto' : 0);

    useEffect(() => {
        const el = contentRef.current;
        if (!el) return;
        if (open) {
            // measure real height then animate to it
            el.style.height = 'auto';
            const h = el.scrollHeight;
            el.style.height = '0px';
            // trigger reflow
            void el.offsetHeight;
            el.style.height = `${h}px`;
            // After transition, set to auto so it handles dynamic content
            const tid = setTimeout(() => { el.style.height = 'auto'; }, 280);
            return () => clearTimeout(tid);
        } else {
            const h = contentRef.current?.scrollHeight ?? 0;
            el.style.height = `${h}px`;
            void el.offsetHeight;
            el.style.height = '0px';
        }
    }, [open]);

    return (
        <div className="border-b border-gray-100">
            <button
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">{title}</span>
                    {badge !== undefined && (
                        <span className="text-xs text-gray-400 font-normal">({badge})</span>
                    )}
                </div>
                <svg
                    className="w-4 h-4 text-gray-400 transition-transform duration-250"
                    style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            <div
                ref={contentRef}
                style={{
                    overflow: 'hidden',
                    transition: 'height 260ms cubic-bezier(0.4,0,0.2,1)',
                    height: defaultOpen ? 'auto' : 0,
                }}
            >
                <div className="pb-2">{children}</div>
            </div>
        </div>
    );
};

interface ActionButtonProps {
    icon: React.ReactNode;
    label: React.ReactNode;
    onClick?: () => void;
    danger?: boolean;
    active?: boolean;
}

/** Nút hành động tròn với nhãn bên dưới — dùng trong 2 panel */
export const ActionButton: React.FC<ActionButtonProps> = ({ icon, label, onClick, danger, active }) => (
    <button
        onClick={onClick}
        className="flex flex-col items-center gap-1.5 group"
    >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            danger
                ? 'bg-red-50 group-hover:bg-red-100 text-red-500'
                : active
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 group-hover:bg-gray-200 text-gray-600'
        }`}>
            {icon}
        </div>
        <span
            className={`text-xs text-center leading-tight ${danger ? 'text-red-500' : 'text-gray-600'}`}
            style={{ maxWidth: 64 }}
        >
            {label}
        </span>
    </button>
);

/** Hàng action button — dùng trong 2 panel */
export const ActionButtonRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex items-start justify-around px-4 py-4 border-b border-gray-100">
        {children}
    </div>
);

/** Toggle switch nhỏ gọn */
export const ToggleSwitch: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
    <button
        onClick={onChange}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${
            checked ? 'bg-blue-500' : 'bg-gray-300'
        }`}
        role="switch"
        aria-checked={checked}
    >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`} />
    </button>
);
