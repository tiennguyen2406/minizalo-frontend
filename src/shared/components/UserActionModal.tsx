import React from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    Image,
    StyleSheet,
    Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/shared/theme/colors";
import type { UserProfile } from "@/shared/services/types";

const { width } = Dimensions.get("window");

interface UserActionModalProps {
    visible: boolean;
    user: UserProfile | null;
    isFriend: boolean;
    isSentRequest?: boolean;
    onClose: () => void;
    onViewProfile: (user: UserProfile) => void;
    onMessage: (user: UserProfile) => void;
    onAddFriend: (user: UserProfile) => void;
}

export default function UserActionModal({
    visible,
    user,
    isFriend,
    isSentRequest,
    onClose,
    onViewProfile,
    onMessage,
    onAddFriend,
}: UserActionModalProps) {
    const colors = useThemeColors();

    if (!user) return null;

    const displayName = user.displayName || user.username || "Người dùng";
    const initial = (displayName.charAt(0).toUpperCase() || "?").toUpperCase();

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                activeOpacity={1}
                style={styles.overlay}
                onPress={onClose}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    style={[styles.container, { backgroundColor: colors.modalBg || colors.card }]}
                >
                    {/* User Info Section */}
                    <View style={styles.header}>
                        <View style={[styles.avatarContainer, { backgroundColor: colors.avatarBg || colors.searchBg }]}>
                            {user.avatarUrl ? (
                                <Image
                                    source={{ uri: user.avatarUrl }}
                                    style={styles.avatar}
                                />
                            ) : (
                                <Text style={[styles.avatarInitial, { color: colors.text }]}>
                                    {initial}
                                </Text>
                            )}
                        </View>
                        <View style={styles.nameRow}>
                          <Text style={[styles.name, { color: colors.text }]}>
                              {displayName}
                          </Text>
                          <TouchableOpacity style={styles.editIcon}>
                             <Ionicons name="pencil-outline" size={16} color={colors.textSecondary} />
                          </TouchableOpacity>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: colors.searchBg }]}
                            onPress={() => {
                                onClose();
                                onViewProfile(user);
                            }}
                        >
                            <View style={styles.btnIconContainer}>
                                <Ionicons name="person-circle-outline" size={24} color="#0068FF" />
                            </View>
                            <Text style={[styles.btnText, { color: colors.text }]}>Xem trang cá nhân</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: colors.searchBg }]}
                            onPress={() => {
                                onClose();
                                onMessage(user);
                            }}
                        >
                            <View style={styles.btnIconContainer}>
                                <Ionicons name="chatbubble-ellipses" size={24} color="#0068FF" />
                            </View>
                            <Text style={[styles.btnText, { color: colors.text }]}>Nhắn tin</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Description Section */}
                    <View style={styles.descriptionContainer}>
                        <Text style={[styles.description, { color: colors.textSecondary }]}>
                            {isFriend ? "Hai người đã là bạn bè" : "Có thể bạn quen người này"}
                        </Text>
                    </View>

                    {/* Footer Button (Add Friend) */}
                    {!isFriend && (
                        <TouchableOpacity
                            style={[
                                styles.footerBtn,
                                { backgroundColor: isSentRequest ? colors.searchBg : "#0068FF" }
                            ]}
                            onPress={() => !isSentRequest && onAddFriend(user)}
                        >
                            <Text style={[styles.footerBtnText, { color: isSentRequest ? colors.textSecondary : "#fff" }]}>
                                {isSentRequest ? "Đã gửi lời mời" : "Kết bạn"}
                            </Text>
                        </TouchableOpacity>
                    )}
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    container: {
        width: width * 0.85,
        borderRadius: 20,
        padding: 24,
        alignItems: "center",
    },
    header: {
        alignItems: "center",
        marginBottom: 24,
    },
    avatarContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        marginBottom: 12,
    },
    avatar: {
        width: 80,
        height: 80,
    },
    avatarInitial: {
        fontSize: 32,
        fontWeight: "bold",
    },
    nameRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    name: {
        fontSize: 20,
        fontWeight: "bold",
    },
    editIcon: {
        marginLeft: 8,
    },
    actionRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
        marginBottom: 20,
    },
    actionBtn: {
        flex: 1,
        height: 80,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        marginHorizontal: 6,
    },
    btnIconContainer: {
        marginBottom: 6,
    },
    btnText: {
        fontSize: 13,
    },
    descriptionContainer: {
        marginBottom: 24,
    },
    description: {
        fontSize: 14,
        textAlign: "center",
    },
    footerBtn: {
        width: "100%",
        height: 48,
        borderRadius: 24,
        justifyContent: "center",
        alignItems: "center",
    },
    footerBtnText: {
        fontSize: 16,
        fontWeight: "bold",
    },
});
