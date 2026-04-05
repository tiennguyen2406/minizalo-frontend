import React from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/shared/theme/colors";
import { useThemeStore, ThemeMode } from "@/shared/store/themeStore";

type ThemeOption = {
    key: ThemeMode;
    label: string;
};

const THEME_OPTIONS: ThemeOption[] = [
    { key: "light", label: "Sáng" },
    { key: "dark", label: "Tối" },
];

function ThemeCard({
    option,
    isSelected,
    onPress,
    colors,
}: {
    option: ThemeOption;
    isSelected: boolean;
    onPress: () => void;
    colors: ReturnType<typeof useThemeColors>;
}) {
    const isDark = option.key === "dark";

    const renderMockContent = (dark: boolean) => (
        <View style={{ flex: 1, justifyContent: "space-between" }}>
            {/* Top bar mock */}
            <View
                style={{
                    height: 6,
                    width: "70%",
                    borderRadius: 3,
                    backgroundColor: dark ? "#3a3a3c" : "#c7d0d9",
                }}
            />
            {/* Content mock */}
            <View style={{ gap: 4 }}>
                <View
                    style={{
                        height: 5,
                        width: "90%",
                        borderRadius: 2.5,
                        backgroundColor: dark ? "#3a3a3c" : "#c7d0d9",
                    }}
                />
                <View style={{ flexDirection: "row", gap: 4 }}>
                    <View
                        style={{
                            height: 5,
                            flex: 1,
                            borderRadius: 2.5,
                            backgroundColor: colors.primary,
                        }}
                    />
                    <View
                        style={{
                            height: 5,
                            flex: 1,
                            borderRadius: 2.5,
                            backgroundColor: dark ? "#3a3a3c" : "#c7d0d9",
                        }}
                    />
                </View>
            </View>
        </View>
    );

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={{
                alignItems: "center",
                flex: 1,
            }}
        >
            {/* Preview card */}
            <View
                style={{
                    width: 100,
                    height: 72,
                    borderRadius: 12,
                    backgroundColor: isDark ? "#1c1c1e" : "#f2f2f7",
                    borderWidth: isSelected ? 2.5 : 1,
                    borderColor: isSelected ? colors.primary : colors.border,
                    overflow: "hidden",
                }}
            >
                    <View style={{ flex: 1, padding: 8 }}>
                        {renderMockContent(isDark)}
                    </View>
            </View>

            {/* Radio + Label */}
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 10,
                    gap: 6,
                }}
            >
                <View
                    style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: isSelected ? colors.primary : colors.textSecondary,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    {isSelected && (
                        <View
                            style={{
                                width: 10,
                                height: 10,
                                borderRadius: 5,
                                backgroundColor: colors.primary,
                            }}
                        />
                    )}
                </View>
                <Text
                    style={{
                        color: colors.text,
                        fontSize: 14,
                        fontWeight: isSelected ? "600" : "400",
                    }}
                >
                    {option.label}
                </Text>
            </View>
        </TouchableOpacity>
    );
}

export default function AppearanceScreen() {
    const router = useRouter();
    const { theme, setTheme } = useThemeStore();
    const colors = useThemeColors();

    const handleSelect = (key: ThemeMode) => {
        setTheme(key);
    };

    const selectedKey = theme;

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={colors.statusBar} />
            <SafeAreaView
                style={{ backgroundColor: colors.headerBg }}
                edges={["top"]}
            >
                {/* Header */}
                <View
                    style={{
                        height: 52,
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        backgroundColor: colors.headerBg,
                    }}
                >
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={{ paddingRight: 8, paddingVertical: 4 }}
                        activeOpacity={0.8}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons
                            name="chevron-back"
                            size={26}
                            color={colors.headerText}
                        />
                    </TouchableOpacity>
                    <Text
                        style={{
                            fontSize: 18,
                            fontWeight: "600",
                            color: colors.headerText,
                        }}
                    >
                        Giao diện
                    </Text>
                </View>
            </SafeAreaView>

            <ScrollView
                style={{ flex: 1, backgroundColor: colors.background }}
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                {/* Section: Giao diện */}
                <Text
                    style={{
                        color: colors.primary,
                        fontSize: 14,
                        fontWeight: "600",
                        paddingHorizontal: 16,
                        paddingTop: 20,
                        paddingBottom: 16,
                    }}
                >
                    Giao diện
                </Text>

                {/* Theme Cards */}
                <View
                    style={{
                        flexDirection: "row",
                        paddingHorizontal: 16,
                        justifyContent: "center",
                        gap: 32,
                    }}
                >
                    {THEME_OPTIONS.map((opt) => (
                        <ThemeCard
                            key={opt.key}
                            option={opt}
                            isSelected={selectedKey === opt.key}
                            onPress={() => handleSelect(opt.key)}
                            colors={colors}
                        />
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}
