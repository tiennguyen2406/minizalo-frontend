import React, { useEffect, useState } from 'react';
import {
    View, Text, FlatList, ActivityIndicator,
    TouchableOpacity, Alert, Linking, Image
} from 'react-native';
import * as Contacts from 'expo-contacts';
import { useThemeColors } from '@/shared/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/shared/services/apiClient';
import { useFriendStore } from '@/shared/store/friendStore';
import type { UserProfile } from '@/shared/services/types';
import UserActionModal from '@/shared/components/UserActionModal';
import { useRouter } from 'expo-router';
import { useChatStore } from '@/shared/store/useChatStore';

interface MatchedContact {
    user: UserProfile;
    contactName: string;
    phoneNumber: string;
}

export default function PhonebookListMobile() {
    const colors = useThemeColors();
    const [matchedContacts, setMatchedContacts] = useState<MatchedContact[]>([]);
    const [loading, setLoading] = useState(true);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const [sendingRequestTo, setSendingRequestTo] = useState<Set<string>>(new Set());
    const [sentIds, setSentIds] = useState<Set<string>>(new Set());
    const { sendRequest, friends, sentRequests, fetchSentRequests } = useFriendStore();
    const router = useRouter();
    const { rooms } = useChatStore();

    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const friendIds = new Set(friends.map(f => f.friend?.id || f.user?.id));

    useEffect(() => {
        loadAndSync();
        fetchSentRequests();
    }, []);

    // Đồng bộ sentIds từ store khi sentRequests thay đổi
    useEffect(() => {
        const ids = new Set(
            sentRequests
                .map(r => r.friend?.id || r.user?.id)
                .filter((id): id is string => Boolean(id))
        );
        setSentIds(ids);
    }, [sentRequests]);

    const loadAndSync = async () => {
        try {
            setLoading(true);
            const { status } = await Contacts.requestPermissionsAsync();
            if (status !== 'granted') {
                setPermissionDenied(true);
                return;
            }

            // Lấy tất cả danh bạ có số điện thoại
            const { data } = await Contacts.getContactsAsync({
                fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
            });

            const validContacts = data.filter(c => c.phoneNumbers && c.phoneNumbers.length > 0 && c.name);

            // Tập hợp số điện thoại để gửi lên server
            const phoneMap = new Map<string, { name: string; phone: string }>();
            for (const contact of validContacts) {
                for (const pn of (contact.phoneNumbers || [])) {
                    const raw = pn.number?.replace(/[\s\-()]/g, '') || '';
                    if (raw) {
                        phoneMap.set(raw, { name: contact.name || 'Không tên', phone: raw });
                    }
                }
            }

            const phoneNumbers = Array.from(phoneMap.keys());
            if (phoneNumbers.length === 0) {
                setMatchedContacts([]);
                return;
            }

            // Gửi lên backend để đối chiếu
            const response = await api.post<UserProfile[]>('/users/sync-contacts', { phoneNumbers });
            const matchedUsers = response.data;

            // Ghép user tìm được với tên danh bạ gốc
            const result: MatchedContact[] = matchedUsers.map(user => {
                // Tìm tên trong danh bạ có số khớp
                let contactName = user.displayName || user.username || '';
                let phoneNumber = user.phone || '';

                // Tìm tên danh bạ gốc từ số điện thoại của user
                const userPhone = user.phone || '';
                const variants = [
                    userPhone,
                    userPhone.startsWith('0') ? '+84' + userPhone.substring(1) : '',
                    userPhone.startsWith('+84') ? '0' + userPhone.substring(3) : '',
                ].filter(Boolean);

                for (const variant of variants) {
                    const found = phoneMap.get(variant);
                    if (found) {
                        contactName = found.name;
                        phoneNumber = found.phone;
                        break;
                    }
                }

                return { user, contactName, phoneNumber };
            });

            setMatchedContacts(result);
        } catch (err) {
            console.log('Error syncing contacts:', err);
            Alert.alert('Lỗi', 'Không thể đồng bộ danh bạ. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddFriend = async (userId: string, contactName: string) => {
        setSendingRequestTo(prev => new Set(prev).add(userId));
        try {
            await sendRequest(userId);
            // Đánh dấu đã gửi
            setSentIds(prev => new Set(prev).add(userId));
            Alert.alert('Thành công', `Đã gửi lời mời kết bạn đến ${contactName}.`);
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Không thể gửi lời mời. Vui lòng thử lại.';
            Alert.alert('Lỗi', msg);
        } finally {
            setSendingRequestTo(prev => {
                const next = new Set(prev);
                next.delete(userId);
                return next;
            });
        }
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Đang đồng bộ danh bạ...</Text>
            </View>
        );
    }

    if (permissionDenied) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 24 }}>
                <Ionicons name="people-outline" size={56} color={colors.textSecondary} style={{ marginBottom: 16 }} />
                <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600', textAlign: 'center', marginBottom: 8 }}>
                    Cần quyền truy cập danh bạ
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
                    Cho phép MiniZalo đọc danh bạ để tìm bạn bè đang sử dụng ứng dụng.
                </Text>
                <TouchableOpacity
                    style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}
                    onPress={() => Linking.openSettings()}
                >
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Mở Cài đặt</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (matchedContacts.length === 0) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 24 }}>
                <Ionicons name="search-outline" size={56} color={colors.textSecondary} style={{ marginBottom: 16 }} />
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 8 }}>
                    Không tìm thấy bạn bè
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
                    Không có ai trong danh bạ của bạn đang dùng MiniZalo.
                </Text>
                <TouchableOpacity
                    style={{ marginTop: 20, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
                    onPress={loadAndSync}
                >
                    <Text style={{ color: colors.primary, fontWeight: '500' }}>Thử lại</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <FlatList
            data={matchedContacts}
            keyExtractor={(item) => item.user.id}
            contentContainerStyle={{ backgroundColor: colors.background }}
            ListHeaderComponent={
                <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                        Tìm thấy {matchedContacts.length} người trong danh bạ đang dùng MiniZalo
                    </Text>
                </View>
            }
            renderItem={({ item }) => {
                const isFriend = friendIds.has(item.user.id);
                const isSending = sendingRequestTo.has(item.user.id);

                return (
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderBottomWidth: 0.5,
                        borderBottomColor: colors.border,
                    }}>
                        {item.user.avatarUrl ? (
                            <Image
                                source={{ uri: item.user.avatarUrl }}
                                style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }}
                            />
                        ) : (
                            <View style={{
                                width: 48, height: 48, borderRadius: 24,
                                backgroundColor: colors.searchBg,
                                justifyContent: 'center', alignItems: 'center',
                                marginRight: 12
                            }}>
                                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '600' }}>
                                    {item.contactName.charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity 
                            style={{ flex: 1 }}
                            onPress={() => {
                                setSelectedUser(item.user);
                                setModalVisible(true);
                            }}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>
                                    {item.contactName}
                                </Text>
                                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                                    {item.user.displayName !== item.contactName ? item.user.displayName + ' · ' : ''}
                                    {item.phoneNumber}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {isFriend ? (
                            <View style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.searchBg }}>
                                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Bạn bè</Text>
                            </View>
                        ) : sentIds.has(item.user.id) ? (
                            <View style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.searchBg }}>
                                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Đã gửi</Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={() => handleAddFriend(item.user.id, item.contactName)}
                                disabled={isSending}
                                style={{
                                    paddingHorizontal: 14,
                                    paddingVertical: 6,
                                    borderRadius: 8,
                                    backgroundColor: isSending ? colors.searchBg : colors.primary,
                                }}
                            >
                                {isSending ? (
                                    <ActivityIndicator size="small" color={colors.primary} />
                                ) : (
                                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '500' }}>Kết bạn</Text>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                );
            }}
            ListFooterComponent={
              <UserActionModal 
                visible={modalVisible}
                user={selectedUser}
                isFriend={selectedUser ? friendIds.has(selectedUser.id) : false}
                isSentRequest={selectedUser ? sentIds.has(selectedUser.id) : false}
                onClose={() => setModalVisible(false)}
                onViewProfile={(u) => {
                  router.push({
                    pathname: "/(tabs)/friend-profile",
                    params: {
                      userId: u.id,
                      displayName: u.displayName || u.username,
                      avatarUrl: u.avatarUrl || "",
                      coverPhotoUrl: u.coverPhotoUrl || "",
                      businessDescription: u.businessDescription || "",
                      statusMessage: u.statusMessage || "",
                      phone: u.phone || "",
                    },
                  } as any);
                }}
                onMessage={(u) => {
                  setModalVisible(false);
                  const isFriend = friendIds.has(u.id);
                  const existingRoom = rooms.find(r =>
                      r.type === 'PRIVATE' &&
                      r.participants.some(p => p.id === u.id)
                  );
                  
                  if (existingRoom) {
                      router.push({
                          pathname: "/chat/[id]",
                          params: { 
                              id: existingRoom.id,
                              name: u.displayName || u.username,
                              type: 'DIRECT',
                              isStranger: isFriend ? "false" : "true",
                              targetUserId: u.id
                          }
                      } as any);
                  } else {
                      router.push({
                          pathname: "/chat/[id]",
                          params: { 
                              id: "new", 
                              targetUserId: u.id,
                              name: u.displayName || u.username,
                              type: 'DIRECT',
                              avatarUrl: u.avatarUrl || "",
                              isStranger: isFriend ? "false" : "true"
                          }
                      } as any);
                  }
                }}
                onAddFriend={(u) => {
                  handleAddFriend(u.id, u.displayName || u.username || "");
                }}
              />
            }
        />
    );
}
