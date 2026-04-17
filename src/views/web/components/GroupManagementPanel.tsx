import React, { useEffect, useState } from 'react';
import { useGroupStore } from '@/shared/store/useGroupStore';
import { groupService } from '@/shared/services/groupService';
import { ToggleSwitch, ActionButton } from './ChatInfoHelpers';

const GroupManagementPanel: React.FC = () => {
    const { currentGroupDetail, closeGroupManagement, updateCurrentGroupDetail } = useGroupStore();
    const [settings, setSettings] = useState(currentGroupDetail?.settings ?? null);
    const [loading, setLoading] = useState(false);
    const [settingsError, setSettingsError] = useState<string | null>(null);

    useEffect(() => {
        if (!currentGroupDetail?.id) return;

        if (currentGroupDetail?.settings) {
            setSettings(currentGroupDetail.settings);
            setSettingsError(null);
            return;
        }

        setLoading(true);
        setSettingsError(null);
        groupService
            .getGroupSettings(currentGroupDetail.id)
            .then(setSettings)
            .catch((err) => {
                console.error('Failed to load group settings:', err);
                setSettingsError('Không tải được cấu hình nhóm');
            })
            .finally(() => setLoading(false));
    }, [currentGroupDetail?.id, currentGroupDetail?.settings]);

    if (!currentGroupDetail) return null;

    const handleToggle = async (key: keyof typeof settings, value: boolean) => {
        if (!settings) return;
        setLoading(true);
        try {
            const newSettings = await groupService.updateGroupSettings({
                groupId: currentGroupDetail.id,
                [key]: value
            });
            setSettings(newSettings);
            updateCurrentGroupDetail({ ...currentGroupDetail, settings: newSettings });
        } catch (error) {
            console.error('Failed to update group settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefreshLink = async () => {
        setLoading(true);
        try {
            const newLink = await groupService.refreshJoinLink(currentGroupDetail.id);
            const updatedSettings = { ...settings, joinLink: newLink };
            setSettings(updatedSettings);
            updateCurrentGroupDetail({ ...currentGroupDetail, settings: updatedSettings });
            alert('Đã tạo link mới thành công!');
        } catch (error) {
            console.error('Failed to refresh join link:', error);
            alert('Lỗi tạo link mới');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-y-0 right-0 w-80 bg-gray-50 border-l border-gray-200 shadow-xl flex flex-col z-40 transform transition-transform duration-300">
            {/* Header */}
            <div className="flex items-center px-4 py-3 bg-white border-b border-gray-200">
                <button onClick={closeGroupManagement} className="p-2 hover:bg-gray-100 rounded-full mr-2">
                    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h2 className="font-semibold text-gray-800 text-lg">Quản lý nhóm</h2>
            </div>

            <div className="flex-1 overflow-y-auto w-full styled-scrollbar pb-6">
                {loading && !settings && (
                    <div className="px-4 py-6 text-sm text-gray-500">Đang tải cấu hình nhóm...</div>
                )}

                {settingsError && !settings && (
                    <div className="px-4 py-6 text-sm text-red-500">{settingsError}</div>
                )}

                {settings && (
                    <>
                        {/* Permissions Section */}
                        <div className="mt-2 bg-white px-4 py-3">
                            <h3 className="text-sm font-semibold text-blue-600 mb-3 uppercase">Quyền của thành viên</h3>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-sm">Sửa thông tin nhóm</span>
                                <ToggleSwitch checked={settings.allowMemberChangeName} onChange={() => handleToggle('allowMemberChangeName', !settings.allowMemberChangeName)} />
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-sm">Ghim tin nhắn</span>
                                <ToggleSwitch checked={settings.allowMemberPin} onChange={() => handleToggle('allowMemberPin', !settings.allowMemberPin)} />
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-sm">Tạo bình chọn</span>
                                <ToggleSwitch checked={settings.allowMemberCreatePoll} onChange={() => handleToggle('allowMemberCreatePoll', !settings.allowMemberCreatePoll)} />
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-sm">Gửi tin nhắn</span>
                                <ToggleSwitch checked={settings.allowMemberSendMessage} onChange={() => handleToggle('allowMemberSendMessage', !settings.allowMemberSendMessage)} />
                            </div>
                        </div>

                        {/* Admission Section */}
                        <div className="mt-2 bg-white px-4 py-3">
                            <h3 className="text-sm font-semibold text-blue-600 mb-3 uppercase">Quản lý thành viên mới</h3>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-sm">Phê duyệt thành viên mới</span>
                                <ToggleSwitch checked={settings.requireApproval} onChange={() => handleToggle('requireApproval', !settings.requireApproval)} />
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <div className="flex flex-col">
                                    <span className="text-sm">Xem lịch sử trò chuyện</span>
                                    <span className="text-xs text-gray-500">Cho phép thành viên mới xem tin nhắn cũ</span>
                                </div>
                                <ToggleSwitch checked={settings.allowNewMemberReadHistory} onChange={() => handleToggle('allowNewMemberReadHistory', !settings.allowNewMemberReadHistory)} />
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-sm">Tham gia bằng Link</span>
                                <ToggleSwitch checked={settings.allowJoinByLink} onChange={() => handleToggle('allowJoinByLink', !settings.allowJoinByLink)} />
                            </div>
                            
                            {settings.allowJoinByLink && (
                                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <p className="text-xs text-gray-500 mb-1">Link tham gia nhóm:</p>
                                    <div className="flex items-center justify-between bg-white px-2 py-1 border border-gray-300 rounded text-sm text-blue-600 font-mono break-all">
                                        {settings.joinLink}
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <button className="flex-1 text-xs bg-gray-200 hover:bg-gray-300 py-1.5 rounded" onClick={() => navigator.clipboard.writeText(settings.joinLink)}>Copy Link</button>
                                        <button className="flex-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 py-1.5 rounded" onClick={handleRefreshLink} disabled={loading}>Đổi Link</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Danger Zone */}
                        <div className="mt-2 bg-white px-4 py-3 flex flex-col gap-2">
                            <ActionButton icon={<span className="text-xl mr-1">🤝</span>} label="Chuyển nhượng quyền trưởng nhóm" onClick={() => {}} />
                            <ActionButton icon={<span className="text-xl mr-1">🚫</span>} label="Danh sách thành viên bị chặn" onClick={() => {}} />
                            <ActionButton icon={<span className="text-xl mr-1">💥</span>} label="Giải tán nhóm" onClick={() => {}} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default GroupManagementPanel;
