import { StyleSheet, Platform, StatusBar } from "react-native";
import { ThemeColors } from "@/shared/theme/colors";

// Màu chính của Zalo (cho các hằng số không đổi)
export const COLORS = {
    primary: "#0068FF",
    primaryDisabled: "#88b4ff",
    white: "#fff",
};

// Styles chung cho các form auth
export const createAuthStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        paddingBottom: 20,
    },
    headerContent: {
        paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
    },
    backButton: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButtonText: {
        fontSize: 24,
        color: colors.text,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        backgroundColor: colors.background,
    },
    titleContainer: {
        alignItems: "center",
        marginTop: 32,
        marginBottom: 40,
    },
    titleText: {
        fontSize: 28,
        fontWeight: "bold",
        color: colors.primary,
        textAlign: "center",
        lineHeight: 30,
    },
    inputContainer: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        marginBottom: 16,
        flexDirection: "row",
        alignItems: "center",
    },
    input: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 16,
        color: colors.text,
    },
    eyeIcon: {
        padding: 8,
    },
    submitButton: {
        backgroundColor: colors.primary,
        borderRadius: 25,
        paddingVertical: 14,
        alignItems: "center",
        marginTop: 16,
    },
    submitButtonDisabled: {
        backgroundColor: COLORS.primaryDisabled,
    },
    submitButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    linkContainer: {
        alignItems: "center",
        marginTop: 20,
    },
    linkText: {
        color: colors.textSecondary,
        fontSize: 14,
    },
});
