import React, { useState, useRef } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Platform,
    StatusBar as RNStatusBar,
    Modal,
    TouchableWithoutFeedback,
    Animated,
    TextInput,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useThemeColors } from "@/shared/theme/colors";

export const ChatListHeader = () => {
    const router = useRouter();
    const colors = useThemeColors();
    const [searchText, setSearchText] = useState("");
    const [menuVisible, setMenuVisible] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const openMenu = () => {
        setMenuVisible(true);
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
        }).start();
    };

    const closeMenu = () => {
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
        }).start(() => setMenuVisible(false));
    };

    const handleCreateGroup = () => {
        closeMenu();
        setTimeout(() => {
            router.push("/create-group" as any);
        }, 120);
    };

    return (
        <SafeAreaView
            style={{ backgroundColor: colors.headerBg }}
            edges={["top"]}
        >
            <StatusBar style={colors.statusBar} />
            <View
                style={{
                    height: 52,
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    backgroundColor: colors.headerBg,
                    borderBottomWidth: colors.headerBg === "#0068FF" ? 0 : 0.5,
                    borderBottomColor: colors.border,
                    gap: 12,
                }}
            >
                {/* Search bar */}
                <View
                    style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        borderRadius: 10,
                        backgroundColor: colors.headerSearchBg,
                        paddingHorizontal: 10,
                        height: 36,
                    }}
                >
                    <Ionicons
                        name="search"
                        size={18}
                        color={colors.headerIcon}
                        style={{ marginRight: 6 }}
                    />
                    <TextInput
                        value={searchText}
                        onChangeText={setSearchText}
                        placeholder="Tìm kiếm"
                        placeholderTextColor={colors.headerIcon}
                        style={{
                            flex: 1,
                            color: colors.headerText,
                            fontSize: 15,
                            paddingVertical: 0,
                        }}
                        showSoftInputOnFocus={false}
                        onFocus={(e) => {
                            e.target.blur();
                            setSearchText("");
                            router.push({
                                pathname: "/(tabs)/contacts-search",
                                params: { from: "chat", t: Date.now() },
                            });
                        }}
                    />
                    {searchText ? (
                        <TouchableOpacity
                            onPress={() => setSearchText("")}
                            style={{ paddingLeft: 6 }}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name="close-circle"
                                size={18}
                                color={colors.headerIcon}
                            />
                        </TouchableOpacity>
                    ) : null}
                </View>

                {/* QR Code button */}
                <TouchableOpacity
                    activeOpacity={0.6}
                    style={{ padding: 4 }}
                >
                    <Ionicons
                        name="qr-code-outline"
                        size={22}
                        color={colors.headerIcon}
                    />
                </TouchableOpacity>

                {/* "+" button */}
                <TouchableOpacity
                    activeOpacity={0.6}
                    style={{ padding: 4 }}
                    onPress={openMenu}
                >
                    <Ionicons name="add" size={28} color={colors.headerIcon} />
                </TouchableOpacity>
            </View>

            {/* ── Dropdown Menu ── */}
            <Modal
                transparent
                visible={menuVisible}
                animationType="none"
                onRequestClose={closeMenu}
            >
                <TouchableWithoutFeedback onPress={closeMenu}>
                    <View style={{ flex: 1 }}>
                        <Animated.View
                            style={{
                                position: "absolute",
                                top: Platform.OS === "android"
                                    ? (RNStatusBar.currentHeight || 0) + 48
                                    : 90,
                                right: 12,
                                backgroundColor: colors.card,
                                borderRadius: 12,
                                paddingVertical: 4,
                                minWidth: 200,
                                opacity: fadeAnim,
                                transform: [
                                    {
                                        translateY: fadeAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [-8, 0],
                                        }),
                                    },
                                ],
                                // Shadow
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 8,
                                elevation: 8,
                                borderWidth: 1,
                                borderColor: colors.border,
                            }}
                        >
                            {/* Tạo nhóm */}
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={handleCreateGroup}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingHorizontal: 16,
                                    paddingVertical: 12,
                                }}
                            >
                                <Ionicons
                                    name="people-outline"
                                    size={20}
                                    color={colors.textSecondary}
                                    style={{ marginRight: 12 }}
                                />
                                <Text
                                    style={{
                                        fontSize: 15,
                                        color: colors.text,
                                    }}
                                >
                                    Tạo nhóm
                                </Text>
                            </TouchableOpacity>

                            {/* Divider */}
                            <View
                                style={{
                                    height: 0.5,
                                    backgroundColor: colors.border,
                                    marginHorizontal: 12,
                                }}
                            />

                            {/* Thêm bạn */}
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => {
                                    closeMenu();
                                    router.push("/(tabs)/contacts-add");
                                }}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingHorizontal: 16,
                                    paddingVertical: 12,
                                }}
                            >
                                <Ionicons
                                    name="person-add-outline"
                                    size={20}
                                    color={colors.textSecondary}
                                    style={{ marginRight: 12 }}
                                />
                                <Text
                                    style={{
                                        fontSize: 15,
                                        color: colors.text,
                                    }}
                                >
                                    Thêm bạn
                                </Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </SafeAreaView>
    );
};
