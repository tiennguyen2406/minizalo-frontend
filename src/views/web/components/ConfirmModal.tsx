import React from 'react';
import { Modal } from 'zmp-ui';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Xác nhận',
    cancelText = 'Không',
    isDanger = true,
}) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="bg-[color:var(--bg-primary)] rounded-lg flex flex-col overflow-hidden shadow-xl"
                style={{ width: 400, maxWidth: '90vw' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-[color:var(--border-primary)]">
                    <span className="text-base font-semibold text-[color:var(--text-primary)]">{title}</span>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[color:var(--bg-secondary)] text-[color:var(--text-secondary)]"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-5">
                    <p className="text-[color:var(--text-secondary)] text-sm whitespace-pre-line">{message}</p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end px-5 py-4 gap-3 bg-[color:var(--bg-hover)] border-t border-[color:var(--border-primary)]">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-md font-medium text-[color:var(--text-secondary)] transition-colors"
                        style={{ backgroundColor: '#E5E7EB' }}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`px-6 py-2 rounded-md font-medium text-white transition-colors opacity-90 hover:opacity-100`}
                        style={{ backgroundColor: isDanger ? '#DC2626' : '#0068FF' }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
