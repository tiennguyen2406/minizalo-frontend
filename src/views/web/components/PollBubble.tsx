import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pollService } from '@/shared/services/pollService';
import { Poll, PollOption } from '@/shared/types';
import { useAuthStore } from '@/shared/store/authStore';
import { webSocketService } from '@/shared/services/WebSocketService';
import ConfirmModal from './ConfirmModal';

interface PollBubbleProps {
    pollId: string;
    roomId: string; // Cần roomId để pass vào API call
    messageId?: string; // messageId thật để ghim/scroll đúng
    mode?: 'inline' | 'preview';
}

const PollBubble: React.FC<PollBubbleProps> = ({ pollId, roomId, messageId, mode = 'inline' }) => {
    const queryClient = useQueryClient();
    const currentUserId = useAuthStore(s => s.user?.id);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [lastClosedPollId, setLastClosedPollId] = useState<string | null>(null);
    const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
    const [toast, setToast] = useState<{ message: string; tone?: 'success' | 'error' } | null>(null);
    
    // Fetch tất cả polls trong phòng, sau đó lọc theo pollId (Vì API hiện tại là lấy theo room)
    const { data: polls, isLoading, error } = useQuery({
        queryKey: ['polls', roomId],
        queryFn: () => pollService.getPollsInRoom(roomId),
        refetchInterval: 5000, // Long polling nhẹ để cập nhật realtime nếu WebSocket không gắn vào bubble
    });

    const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newOptionText, setNewOptionText] = useState('');
    const [isAddingOption, setIsAddingOption] = useState(false);

    const pushToast = (message: string, tone: 'success' | 'error' = 'success') => {
        setToast({ message, tone });
        window.setTimeout(() => setToast(null), 2500);
    };

    const ToastHost = () => {
        if (!toast) return null;
        const node = (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] px-4 pointer-events-none">
                <div
                    className={`rounded-full px-4 py-2 text-sm shadow-lg border ${
                        toast.tone === 'error'
                            ? 'bg-red-50 border-red-200 text-red-700'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    }`}
                >
                    {toast.message}
                </div>
            </div>
        );
        // Portal để không bị modal/container che hoặc bị ảnh hưởng bởi transform/overflow
        return typeof document !== 'undefined' ? createPortal(node, document.body) : node;
    };

    const poll = polls?.find((p: Poll) => p.id === pollId);
    const hasUserVoted = !!(
        poll &&
        currentUserId &&
        poll.options.some((o) => o.votes?.some((v) => v.userId === currentUserId))
    );

    /** Giai đoạn 1: chỉ xem phương án + số phiếu; bấm "Bình chọn" mới vào chọn và gửi */
    const [voteUiOpen, setVoteUiOpen] = useState(false);

    useEffect(() => {
        setVoteUiOpen(false);
    }, [pollId]);

    // Trong mode preview: khi mở modal thì đi thẳng vào UI bình chọn (để có nút "Gửi lựa chọn")
    useEffect(() => {
        if (mode === 'preview' && isModalOpen && poll && !poll.closed) {
            setVoteUiOpen(true);
        }
    }, [mode, isModalOpen, poll]);

    useEffect(() => {
        if (poll && !poll.closed && hasUserVoted) {
            setVoteUiOpen(true);
        }
    }, [poll, hasUserVoted]);

    // Initial selected options based on existing votes
    useEffect(() => {
        if (poll && currentUserId) {
            const myVotedOptionIds = poll.options
                .filter(opt => opt.votes?.some(v => v.userId === currentUserId))
                .map(opt => opt.id);
            setSelectedOptionIds(myVotedOptionIds);
        }
    }, [poll, currentUserId]);

    const handleToggleOption = (optionId: string) => {
        if (!poll?.allowMultipleChoices) {
            setSelectedOptionIds([optionId]);
        } else {
            setSelectedOptionIds(prev => 
                prev.includes(optionId) 
                    ? prev.filter(id => id !== optionId)
                    : [...prev, optionId]
            );
        }
    };

    const handleVote = async () => {
        if (!poll) return;
        setIsSubmitting(true);
        try {
            await pollService.votePoll(poll.id, selectedOptionIds);
            // Update cache
            queryClient.invalidateQueries({ queryKey: ['polls', roomId] });
            // Nếu đang bình chọn trong modal (mode preview) thì vote xong đóng modal luôn
            if (mode === 'preview' && isModalOpen) {
                setIsModalOpen(false);
                setShowSettingsMenu(false);
            }
        } catch (err) {
            console.error('Vote err', err);
            pushToast('Lỗi gửi bình chọn', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddOption = async () => {
        if (!poll || !newOptionText.trim()) return;
        setIsSubmitting(true);
        try {
            await pollService.addOptionToPoll(poll.id, newOptionText.trim());
            setNewOptionText('');
            setIsAddingOption(false);
            queryClient.invalidateQueries({ queryKey: ['polls', roomId] });
        } catch (err) {
            console.error('Add option err', err);
            pushToast('Lỗi thêm lựa chọn', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClosePollConfirmed = async () => {
        if (!poll) return;
        // Bảo đảm modal bình chọn đóng ngay khi khóa
        setIsModalOpen(false);
        setShowSettingsMenu(false);
        setIsSubmitting(true);
        try {
            await pollService.closePoll(poll.id);
            // Tạm lưu để hiển thị summary "Bạn khóa bình chọn ..." ngay sau khi đóng
            setLastClosedPollId(poll.id);
            queryClient.invalidateQueries({ queryKey: ['polls', roomId] });
            pushToast('Đã đóng bình chọn', 'success');
        } catch (err) {
            console.error('Close poll err', err);
            pushToast('Lỗi đóng bình chọn', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return mode === 'preview'
            ? <div className="w-[360px] max-w-[90vw] rounded-xl border border-gray-200 bg-white p-4 text-gray-500 text-sm">Đang tải bình chọn...</div>
            : <div className="p-3 min-w-[250px] text-gray-500 italic text-sm">Đang tải bình chọn...</div>;
    }

    if (error || !poll) {
        return mode === 'preview'
            ? <div className="w-[360px] max-w-[90vw] rounded-xl border border-gray-200 bg-white p-4 text-red-500 text-sm">Không thể tải nội dung bình chọn</div>
            : <div className="p-3 min-w-[250px] text-red-400 italic text-sm">Không thể tải nội dung bình chọn</div>;
    }

    const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.votes?.length || 0), 0);
    const isCreator = poll.createdById === currentUserId;
    const canShowClosePollButton = isCreator && !poll.closed && mode === 'inline';
    const canShowSettingsInModal = isCreator && !poll.closed;
    const showLockSummary = poll.closed && isCreator && lastClosedPollId === poll.id;
    const modalContentWidthClass = "w-full max-w-[420px] mx-auto";

    /** Chưa bầu & chưa mở UI chọn: chỉ xem phương án + số phiếu (trong luồng chat inline) */
    const showReadOnlyOverview =
        mode === 'inline' && !poll.closed && !voteUiOpen && !hasUserVoted;

    const pollHeader = (
        <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span className="text-sm font-semibold uppercase tracking-wide">Bình chọn</span>
            </div>
            <h4 className="text-gray-800 font-bold text-base mt-2 leading-snug">{poll.question}</h4>
            <div className="text-xs text-gray-500 mt-1">
                {poll.closed ? (
                    <span className="text-red-500 font-medium">Đã đóng</span>
                ) : poll.allowMultipleChoices ? (
                    'Chọn nhiều phương án'
                ) : (
                    'Chỉ chọn 1 phương án'
                )}
            </div>
        </div>
    );

    const simpleHeader = (
        <div className="px-4 pt-4 pb-1">
            <h4 className="text-gray-900 font-bold text-lg leading-snug tracking-tight">{poll.question}</h4>
            <p className="text-sm text-gray-500 mt-1.5">
                {poll.closed
                    ? 'Đã đóng'
                    : poll.allowMultipleChoices
                        ? 'Chọn nhiều phương án'
                        : 'Chỉ chọn 1 phương án'}
            </p>
        </div>
    );

    const interactiveOptionsBlock = (
        <>
            <div className={(mode === 'preview' ? "px-4 pb-1 pt-2" : "p-3") + " space-y-2"}>
                {poll.options.map((opt: PollOption) => {
                    const votesCount = opt.votes?.length || 0;
                    const percent = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
                    const isSelected = selectedOptionIds.includes(opt.id);

                    return (
                        <div
                            key={opt.id}
                            className={`relative rounded-lg ${
                                mode === 'preview' ? 'bg-[#f0f2f5] px-3.5 py-2.5' : 'border p-2.5'
                            } cursor-pointer transition-colors overflow-hidden ${
                                poll.closed ? 'cursor-default opacity-80' : 'hover:border-blue-400'
                            } ${
                                mode === 'preview'
                                    ? (isSelected ? 'ring-2 ring-[#0068ff] bg-[#e8f2ff]' : 'hover:bg-[#e9edf2]')
                                    : (isSelected ? 'border-blue-500 bg-blue-50/30' : 'border-gray-200 bg-white')
                            }`}
                            onClick={() => !poll.closed && handleToggleOption(opt.id)}
                        >
                            {mode !== 'preview' && (
                                <div
                                    className="absolute left-0 top-0 bottom-0 bg-blue-100/50 -z-10"
                                    style={{ width: `${percent}%`, transition: 'width 0.3s ease' }}
                                />
                            )}

                            <div className="flex items-start gap-3 z-10">
                                <div className="mt-0.5 shrink-0">
                                    <div className={`w-5 h-5 flex items-center justify-center border rounded-md transition-colors ${
                                        isSelected ? 'bg-[#0068ff] border-[#0068ff]' : 'border-gray-300 bg-white'
                                    }`}>
                                        {isSelected && (
                                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center gap-2">
                                        <span className={`text-sm font-medium truncate ${isSelected ? 'text-[#0b3a8a]' : 'text-gray-800'}`}>
                                            {opt.text}
                                        </span>
                                        <span className="text-xs font-semibold text-gray-500 shrink-0">
                                            {votesCount}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {!poll.closed && poll.allowAddOptions && voteUiOpen && (
                    <div className="mt-3">
                        {isAddingOption ? (
                            <div className="flex items-center gap-2">
                                <input
                                    className="flex-1 border border-blue-300 rounded p-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    placeholder="Thêm lựa chọn..."
                                    value={newOptionText}
                                    onChange={e => setNewOptionText(e.target.value)}
                                    autoFocus
                                    onKeyDown={e => e.key === 'Enter' && handleAddOption()}
                                />
                                <button
                                    onClick={handleAddOption}
                                    disabled={!newOptionText.trim() || isSubmitting}
                                    className="bg-blue-500 text-white rounded p-1.5 text-xs font-medium disabled:opacity-50"
                                >
                                    Thêm
                                </button>
                                <button
                                    onClick={() => { setIsAddingOption(false); setNewOptionText(''); }}
                                    className="bg-gray-100 text-gray-600 rounded p-1.5 text-xs font-medium"
                                >
                                    Hủy
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsAddingOption(true)}
                                className="text-blue-500 text-sm font-medium hover:underline flex items-center gap-1"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                                Thêm phương án
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className={(mode === 'preview' ? "px-4 pb-4 pt-3" : "px-3 pb-3 pt-1") + " flex flex-col gap-2 relative z-20"}>
                {!poll.closed && (voteUiOpen || mode === 'preview') && (
                    <button
                        className="w-full bg-[#0068ff] hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-[15px] transition-colors disabled:opacity-50"
                        onClick={(e) => { e.stopPropagation(); handleVote(); }}
                        disabled={isSubmitting || selectedOptionIds.length === 0}
                    >
                        {isSubmitting ? 'Đang gửi...' : 'Gửi lựa chọn'}
                    </button>
                )}

                {canShowClosePollButton && voteUiOpen && (
                    <button
                        className="w-full py-1.5 text-red-500 text-sm font-medium hover:underline transition-colors mt-1"
                        onClick={(e) => {
                            e.stopPropagation();
                            // Đóng modal/panel trước để không che thông báo xác nhận
                            setIsModalOpen(false);
                            setShowSettingsMenu(false);
                            setConfirmCloseOpen(true);
                        }}
                        disabled={isSubmitting}
                    >
                        Đóng bình chọn
                    </button>
                )}
            </div>
        </>
    );

    const InlineContent = (
        <div className="bg-white rounded-xl overflow-hidden min-w-[300px] max-w-[420px] border border-gray-200 relative w-full shadow-sm">
            {/* Trạng thái xem trước (Zalo): chỉ tiêu đề + gợi ý + thanh phương án + nút viền xanh — không banner xanh */}
            {!showReadOnlyOverview && pollHeader}

            {poll.closed ? (
                <>
                    {interactiveOptionsBlock}
                    {poll.closed && <div className="absolute inset-0 bg-white/20 pointer-events-none" />}
                </>
            ) : showReadOnlyOverview ? (
                <>
                    <div className="px-4 pt-4 pb-1">
                        <h4 className="text-gray-900 font-bold text-lg leading-snug tracking-tight">{poll.question}</h4>
                        <p className="text-sm text-gray-500 mt-1.5">
                            {poll.allowMultipleChoices ? 'Chọn nhiều phương án' : 'Chỉ chọn 1 phương án'}
                        </p>
                        <div className="mt-4 space-y-2">
                            {poll.options.map((opt: PollOption) => {
                                const votesCount = opt.votes?.length || 0;
                                return (
                                    <div
                                        key={opt.id}
                                        className="flex items-center justify-between gap-3 min-h-[40px] rounded-lg bg-[#f0f2f5] px-3.5 py-2.5 pointer-events-none select-none"
                                    >
                                        <span className="text-sm text-gray-800 truncate flex-1 min-w-0 text-left">
                                            {opt.text}
                                        </span>
                                        <span className="text-sm font-medium text-gray-600 tabular-nums shrink-0">
                                            {votesCount}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="px-4 pb-4 pt-3">
                        <button
                            type="button"
                            className="w-full border border-[#0068ff] text-[#0068ff] bg-white font-semibold py-2.5 rounded-lg text-[15px] transition-colors hover:bg-blue-50/80 active:bg-blue-50"
                            onClick={(e) => {
                                e.stopPropagation();
                                setVoteUiOpen(true);
                            }}
                        >
                            Bình chọn
                        </button>
                    </div>
                </>
            ) : (
                interactiveOptionsBlock
            )}
        </div>
    );

    const ModalVoteContent = (
        <div className="bg-white rounded-xl overflow-hidden min-w-[300px] max-w-[420px] border border-gray-200 relative w-full shadow-sm">
            {simpleHeader}
            {interactiveOptionsBlock}
        </div>
    );

    const PreviewContent = (
        <div className="w-[420px] max-w-[92vw] bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden relative">
            {/* Summary khi bạn tự khóa */}
            {showLockSummary && (
                <div className="mx-4 mt-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
                    <div className="text-sm font-medium truncate">
                        Bạn khóa bình chọn: <span className="font-semibold">{poll.question}</span>
                    </div>
                    <button
                        type="button"
                        className="shrink-0 text-sm font-semibold text-emerald-700 hover:text-emerald-900 underline"
                        onClick={() => { setVoteUiOpen(true); setIsModalOpen(true); }}
                    >
                        Xem
                    </button>
                </div>
            )}

            <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2 text-blue-600 mb-1">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span className="text-sm font-semibold uppercase tracking-wide">Bình chọn</span>
                </div>

                <h4 className="text-gray-800 font-bold text-base mt-2 leading-snug line-clamp-2">{poll.question}</h4>
                <div className="text-xs text-gray-500 mt-1">
                    {poll.closed ? <span className="text-red-500 font-medium">Đã đóng</span> : `${totalVotes} lượt bình chọn`}
                </div>

                <div className="text-xs text-gray-500 mt-2">
                    {poll.allowMultipleChoices ? 'Chọn nhiều phương án' : 'Chỉ chọn 1 phương án'}
                </div>
            </div>

            <div className="p-4">
                {poll.closed ? (
                    <>
                        <div className="flex items-center gap-2 text-sm text-gray-700 mb-3">
                            <span className="font-medium">Danh sách lựa chọn</span>
                            <span className="text-gray-400">({poll.options.length} phương án)</span>
                        </div>

                        <div className="space-y-2">
                            {poll.options.map((opt: PollOption) => {
                                const votesCount = opt.votes?.length || 0;
                                const percent = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
                                const isSelected = selectedOptionIds.includes(opt.id);
                                return (
                                    <div
                                        key={opt.id}
                                        className={`relative rounded-lg border px-3 py-2 overflow-hidden ${
                                            isSelected ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-white'
                                        }`}
                                    >
                                        <div
                                            className="absolute left-0 top-0 bottom-0 bg-blue-100/50 -z-10"
                                            style={{ width: `${percent}%` }}
                                        />
                                        <div className="flex items-center justify-between gap-3 relative z-10">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                                                    isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300 bg-white'
                                                }`}>
                                                    {isSelected ? (
                                                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    ) : null}
                                                </span>
                                                <span className="text-sm font-medium text-gray-800 truncate">{opt.text}</span>
                                            </div>
                                            <span className="text-xs font-semibold text-gray-600 shrink-0">{votesCount}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm transition-colors"
                            onClick={() => { setVoteUiOpen(true); setIsModalOpen(true); }}
                        >
                            Xem lựa chọn
                        </button>
                    </>
                ) : (
                    <>
                        <div className="space-y-2">
                            {poll.options.map((opt: PollOption) => {
                                const votesCount = opt.votes?.length || 0;
                                return (
                                    <div
                                        key={opt.id}
                                        className="flex items-center justify-between gap-3 min-h-[40px] rounded-lg bg-[#f0f2f5] px-3.5 py-2.5 select-none"
                                    >
                                        <span className="text-sm text-gray-800 truncate flex-1 min-w-0 text-left">
                                            {opt.text}
                                        </span>
                                        <span className="text-sm font-medium text-gray-600 tabular-nums shrink-0">
                                            {votesCount}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        <button
                            type="button"
                            className="w-full mt-4 border border-[#0068ff] text-[#0068ff] bg-white font-semibold py-2.5 rounded-lg text-[15px] transition-colors hover:bg-blue-50/80 active:bg-blue-50"
                            onClick={() => { setVoteUiOpen(true); setIsModalOpen(true); }}
                        >
                            Bình chọn
                        </button>
                    </>
                )}
            </div>
        </div>
    );

    // Preview mode: hiển thị 1 widget giữa màn hình, không chứa lựa chọn trong bubble.
    if (mode === 'preview') {
        return (
            <>
                {PreviewContent}
                <ToastHost />
                {isModalOpen && (
                    <div
                        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40"
                        onClick={() => setIsModalOpen(false)}
                    >
                        <div
                            className="bg-white rounded-2xl shadow-2xl w-[460px] max-w-[94vw] overflow-hidden relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                                <div className="flex flex-col">
                                    <span className="text-sm font-semibold text-gray-800">Bình chọn</span>
                                    <span className="text-xs text-gray-500 truncate max-w-[380px]">{poll.question}</span>
                                </div>
                                <button
                                    type="button"
                                    className="w-9 h-9 rounded-full hover:bg-gray-100 text-gray-500 flex items-center justify-center"
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    ×
                                </button>
                            </div>

                            <div className="p-4 pb-20">
                                {/* Nội dung chọn phương án */}
                                <div className={modalContentWidthClass}>
                                    {ModalVoteContent}
                                </div>
                            </div>

                            {/* Nút cài đặt ở góc dưới trái */}
                            {canShowSettingsInModal && (
                                <div className="absolute bottom-4 left-4 z-[140]">
                                    <button
                                        type="button"
                                        className="w-10 h-10 rounded-full bg-white/90 hover:bg-white border border-gray-200 shadow-sm flex items-center justify-center"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowSettingsMenu((v) => !v);
                                        }}
                                        aria-label="Cài đặt bình chọn"
                                    >
                                        <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </button>

                                    {showSettingsMenu && (
                                        <div className="absolute bottom-12 left-0 w-[220px] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                                            <button
                                                type="button"
                                                className="w-full px-4 py-3 text-left text-sm text-gray-800 hover:bg-gray-50 flex items-center gap-2"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (!messageId) {
                                                        pushToast('Không thể ghim: thiếu messageId', 'error');
                                                        return;
                                                    }
                                                    webSocketService.sendPin({
                                                        roomId,
                                                        messageId,
                                                        pin: true,
                                                        messageType: 'POLL',
                                                    });
                                                    setShowSettingsMenu(false);
                                                }}
                                            >
                                                <span>Ghim lên đầu trò chuyện</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Đóng modal bình chọn trước, rồi mới xác nhận khóa
                                                    setShowSettingsMenu(false);
                                                    setIsModalOpen(false);
                                                    setConfirmCloseOpen(true);
                                                }}
                                            >
                                                <span>Khóa bình chọn (kết thúc)</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                <ConfirmModal
                    isOpen={confirmCloseOpen}
                    onClose={() => setConfirmCloseOpen(false)}
                    onConfirm={() => handleClosePollConfirmed()}
                    title="Xác nhận"
                    message="Bạn có chắc muốn đóng bình chọn này?"
                    confirmText="Đóng bình chọn"
                    cancelText="Hủy"
                    isDanger
                />
            </>
        );
    }

    return (
        <>
            {InlineContent}
            <ToastHost />
            <ConfirmModal
                isOpen={confirmCloseOpen}
                onClose={() => setConfirmCloseOpen(false)}
                onConfirm={() => handleClosePollConfirmed()}
                title="Xác nhận"
                message="Bạn có chắc muốn đóng bình chọn này?"
                confirmText="Đóng bình chọn"
                cancelText="Hủy"
                isDanger
            />
        </>
    );
};

export default PollBubble;
