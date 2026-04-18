import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useThemeColors } from "@/shared/theme/colors";

type Props = {
    displayName: string;
    avatarUrl?: string | null;
    coverPhotoUrl?: string | null;
};

/**
 * Preview hồ sơ người lạ khi chưa có tin nhắn (chat 1-1), layout tương tự Zalo.
 */
export default function StrangerProfilePreviewCard({
    displayName,
    avatarUrl,
    coverPhotoUrl,
}: Props) {
    const colors = useThemeColors();
    const initial = (displayName || "?").charAt(0).toUpperCase();

    return (
        <View
            style={[
                styles.card,
                {
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                },
            ]}
        >
            <View style={styles.coverWrap}>
                {coverPhotoUrl ? (
                    <Image source={{ uri: coverPhotoUrl }} style={styles.coverImg} resizeMode="cover" />
                ) : (
                    <View style={[styles.coverPlaceholder, { backgroundColor: "#6b9f7a" }]} />
                )}
            </View>
            <View style={[styles.body, { backgroundColor: colors.card }]}>
                <View style={styles.row}>
                    {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.avatarPh, { backgroundColor: `${colors.primary}33` }]}>
                            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.primary }}>{initial}</Text>
                        </View>
                    )}
                    <View style={styles.textCol}>
                        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                            {displayName}
                        </Text>
                        <Text style={[styles.warn, { color: colors.textSecondary }]}>
                            Người này chưa được thêm vào danh sách bạn bè.{"\n"}Hãy lưu ý khi gửi tin nhắn.
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: "hidden",
        marginTop: 6,
        marginBottom: 5,
        alignSelf: "center",
        width: "82%",
        maxWidth: 340,
    },
    coverWrap: {
        width: "100%",
        height: 88,
    },
    coverImg: {
        width: "100%",
        height: "100%",
    },
    coverPlaceholder: {
        flex: 1,
        width: "100%",
        height: "100%",
    },
    body: {
        paddingHorizontal: 11,
        paddingVertical: 11,
    },
    row: {
        flexDirection: "row",
        alignItems: "flex-start",
    },
    avatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
    },
    avatarPh: {
        alignItems: "center",
        justifyContent: "center",
    },
    textCol: {
        flex: 1,
        marginLeft: 10,
        minWidth: 0,
    },
    name: {
        fontSize: 15,
        fontWeight: "700",
        marginBottom: 4,
    },
    warn: {
        fontSize: 12,
        lineHeight: 17,
    },
});
