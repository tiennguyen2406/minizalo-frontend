import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pollService } from '@/shared/services/pollService';
import { Poll, PollOption } from '@/shared/types';
import { useAuthStore } from '@/shared/store/authStore';
import { webSocketService } from '@/shared/services/WebSocketService';

interface PollBubbleProps {
    pollId: string;
    roomId: string; // Cần roomId để pass vào API call
    mode?: 'inline' | 'preview';
}

const PollBubble: React.FC<PollBubbleProps> = ({ pollId, roomId, mode = 'inline' }) => {
    const queryClient = useQueryClient();
    const currentUserId = useAuthStore(s => s.user?.id);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [lastClosedPollId, setLastClosedPollId] = useState<string | null>(null);
    
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

    const poll = polls?.find((p: Poll) => p.id === pollId);

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
        } catch (err) {
            console.error('Vote err', err);
            alert('Lỗi gửi bình chọn');
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
            alert('Lỗi thêm lựa chọn');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClosePoll = async () => {
        if (!poll || !window.confirm('Bạn có chắc muốn đóng bình chọn này?')) return;
        setIsSubmitting(true);
        try {
            await pollService.closePoll(poll.id);
            // Tạm lưu để hiển thị summary "Bạn khóa bình chọn ..." ngay sau khi đóng
            setLastClosedPollId(poll.id);
            queryClient.invalidateQueries({ queryKey: ['polls', roomId] });
            setIsModalOpen(false);
            setShowSettingsMenu(false);
        } catch (err) {
            console.error('Close poll err', err);
            alert('Lỗi đóng bình chọn');
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

    const InlineContent = (
        <div className="bg-white rounded-xl overflow-hidden min-w-[300px] max-w-[420px] border border-gray-200 relative w-full">
            {/* Header / Question */}
            <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
                <div className="flex items-center gap-2 text-blue-600 mb-1">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span className="text-sm font-semibold uppercase tracking-wide">Bình chọn</span>
                </div>
                <h4 className="text-gray-800 font-bold text-base mt-2 leading-snug">{poll.question}</h4>
                <div className="text-xs text-gray-500 mt-1">
                    {poll.closed
                        ? <span className="text-red-500 font-medium">Đã đóng</span>
                        : (poll.allowMultipleChoices ? 'Có thể chọn nhiều phương án' : 'Chỉ chọn 1 phương án')}
                </div>
            </div>

            {/* Options */}
            <div className="p-3 space-y-2">
                {poll.options.map((opt: PollOption) => {
                    const votesCount = opt.votes?.length || 0;
                    const percent = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
                    const isSelected = selectedOptionIds.includes(opt.id);

                    return (
                        <div
                            key={opt.id}
                            className={`relative rounded-lg border p-2.5 cursor-pointer transition-colors overflow-hidden ${
                                poll.closed ? 'cursor-default opacity-80' : 'hover:border-blue-400'
                            } ${isSelected ? 'border-blue-500 bg-blue-50/30' : 'border-gray-200 bg-white'}`}
                            onClick={() => !poll.closed && handleToggleOption(opt.id)}
                        >
                            {/* Progress bar background */}
                            <div
                                className="absolute left-0 top-0 bottom-0 bg-blue-100/50 -z-10"
                                style={{ width: `${percent}%`, transition: 'width 0.3s ease' }}
                            />

                            <div className="flex items-start gap-3 z-10">
                                <div className="mt-0.5 shrink-0">
                                    <div className={`w-5 h-5 flex items-center justify-center border rounded-md transition-colors ${
                                        isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'
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
                                        <span className={`text-sm font-medium truncate ${isSelected ? 'text-blue-800' : 'text-gray-700'}`}>
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

                {/* Add new option input */}
                {!poll.closed && poll.allowAddOptions && (
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

            {/* Footer actions */}
            <div className="px-3 pb-3 pt-1 flex flex-col gap-2 relative z-20">
                {!poll.closed && (
                    <button
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                        onClick={(e) => { e.stopPropagation(); handleVote(); }}
                        disabled={isSubmitting || selectedOptionIds.length === 0}
                    >
                        {isSubmitting ? 'Đang gửi...' : 'Bình chọn'}
                    </button>
                )}

                {canShowClosePollButton && (
                    <button
                        className="w-full py-1.5 text-red-500 text-sm font-medium hover:underline transition-colors mt-1"
                        onClick={(e) => { e.stopPropagation(); handleClosePoll(); }}
                        disabled={isSubmitting}
                    >
                        Đóng bình chọn
                    </button>
                )}
            </div>
            {/* Overlay if closed */}
            {poll.closed && <div className="absolute inset-0 bg-white/20 pointer-events-none" />}
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
                        onClick={() => setIsModalOpen(true)}
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
                            onClick={() => setIsModalOpen(true)}
                        >
                            Xem lựa chọn
                        </button>
                    </>
                ) : (
                    <button
                        type="button"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm transition-colors"
                        onClick={() => setIsModalOpen(true)}
                    >
                        Bình chọn
                    </button>
                )}
            </div>
        </div>
    );

    // Preview mode: hiển thị 1 widget giữa màn hình, không chứa lựa chọn trong bubble.
    if (mode === 'preview') {
        return (
            <>
                {PreviewContent}
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
                                    {InlineContent}
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
                                                    // Chức năng ghim tin nhắn dùng messageId; poll hiện chỉ có pollId nên ghim có thể không đúng.
                                                    try {
                                                        webSocketService.sendPin({
                                                            roomId,
                                                            messageId: poll.id, // fallback: nếu backend sử dụng cùng id
                                                            pin: true,
                                                            messageType: 'POLL',
                                                        });
                                                    } catch {
                                                        // ignore
                                                    }
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
                                                    setShowSettingsMenu(false);
                                                    handleClosePoll();
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
            </>
        );
    }

    return (
        InlineContent
    );
};

export default PollBubble;
