import { StyleSheet, Platform, StatusBar } from "react-native";



export const profileStyles = StyleSheet.create({
    container: {
        flex: 1,
    },
    profileSection: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 20,
        gap: 16,
    },
    avatar: {
        width: 72,
        height: 72,
        borderRadius: 36,
    },
    avatarBadge: {
        position: "absolute",
        right: 0,
        bottom: 0,
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    nameRow: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    displayName: {
        fontSize: 20,
        fontWeight: "600",
    },
    list: {
    },
    listItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 12,
    },
    listItemIcon: {
        width: 28,
        height: 28,
        borderRadius: 6,
        opacity: 0.9,
        alignItems: "center",
        justifyContent: "center",
    },
    listItemContent: {
        flex: 1,
    },
    listItemTitle: {
        fontSize: 16,
        fontWeight: "500",
    },
    listItemSubtitle: {
        fontSize: 13,
        marginTop: 2,
    },
    listItemArrow: {
        fontSize: 16,
    },
});
