import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";
import { useThemeColors } from "@/shared/theme/colors";

const GUIDE_ITEMS = [
    {
        icon: "chatbubbles-outline" as const,
        title: "Nhắn tin và gửi tệp",
        body: "Vào tab Tin nhắn, chọn cuộc trò chuyện rồi dùng nút ảnh, tệp hoặc ghi âm để gửi nội dung. Với tin quan trọng, bạn có thể lưu vào My Documents thông qua Cloud của tôi.",
    },
    {
        icon: "cloud-outline" as const,
        title: "My Documents",
        body: "My Documents mở cuộc trò chuyện Cloud của tôi. Đây là nơi lưu tin nhắn, hình ảnh và tài liệu cá nhân để bạn xem lại nhanh trên các thiết bị.",
    },
    {
        icon: "people-outline" as const,
        title: "Bạn bè và nhóm",
        body: "Dùng tab Danh bạ để tìm bạn, xem lời mời kết bạn hoặc tạo nhóm. Trong nhóm, bạn có thể đổi thông tin, quản lý thành viên và ghim nội dung cần nhớ.",
    },
    {
        icon: "newspaper-outline" as const,
        title: "Bài viết và quyền xem",
        body: "Khi đăng bài, hãy chọn đối tượng xem phù hợp. Bạn có thể đổi quyền riêng tư hoặc xóa bài viết của mình trong menu ba chấm của từng bài.",
    },
    {
        icon: "shield-checkmark-outline" as const,
        title: "Bảo mật tài khoản",
        body: "Vào Tài khoản và bảo mật để đổi mật khẩu hoặc kiểm tra các tùy chọn an toàn. Nếu gặp lỗi đăng nhập, hãy thử đăng xuất rồi đăng nhập lại.",
    },
];

export default function SupportScreen() {
    const router = useRouter();
    const colors = useThemeColors();

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <StatusBar style={colors.statusBar} />
            <SafeAreaView style={{ backgroundColor: colors.headerBg }} edges={["top"]}>
                <View
                    style={[
                        styles.header,
                        {
                            backgroundColor: colors.headerBg,
                            borderBottomColor: colors.border,
                            borderBottomWidth: colors.headerBg === "#0068FF" ? 0 : 0.5,
                        },
                    ]}
                >
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backButton}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="chevron-back" size={26} color={colors.headerText} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.headerText }]}>Trung tâm trợ giúp</Text>
                </View>
            </SafeAreaView>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentInner}
                showsVerticalScrollIndicator={false}
            >
                <View style={[styles.intro, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="help-circle-outline" size={30} color={colors.primary} />
                    <View style={styles.introTextWrap}>
                        <Text style={[styles.introTitle, { color: colors.text }]}>Hướng dẫn sử dụng MiniZalo</Text>
                        <Text style={[styles.introText, { color: colors.textSecondary }]}>
                            Các thao tác thường dùng được tóm tắt bên dưới để bạn xử lý nhanh khi cần.
                        </Text>
                    </View>
                </View>

                {GUIDE_ITEMS.map((item) => (
                    <View key={item.title} style={[styles.guideCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={[styles.guideIcon, { backgroundColor: colors.separator }]}>
                            <Ionicons name={item.icon} size={22} color={colors.primary} />
                        </View>
                        <View style={styles.guideBody}>
                            <Text style={[styles.guideTitle, { color: colors.text }]}>{item.title}</Text>
                            <Text style={[styles.guideText, { color: colors.textSecondary }]}>{item.body}</Text>
                        </View>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    header: {
        height: 52,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        gap: 12,
    },
    backButton: {
        paddingVertical: 8,
        paddingRight: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "600",
    },
    content: {
        flex: 1,
    },
    contentInner: {
        padding: 16,
        paddingBottom: 28,
        gap: 12,
    },
    intro: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 0.5,
        borderRadius: 12,
        padding: 14,
        gap: 12,
    },
    introTextWrap: {
        flex: 1,
    },
    introTitle: {
        fontSize: 16,
        fontWeight: "700",
    },
    introText: {
        marginTop: 4,
        fontSize: 13,
        lineHeight: 18,
    },
    guideCard: {
        flexDirection: "row",
        borderWidth: 0.5,
        borderRadius: 12,
        padding: 14,
        gap: 12,
    },
    guideIcon: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
    },
    guideBody: {
        flex: 1,
    },
    guideTitle: {
        fontSize: 15,
        fontWeight: "700",
    },
    guideText: {
        marginTop: 5,
        fontSize: 13,
        lineHeight: 19,
    },
});
