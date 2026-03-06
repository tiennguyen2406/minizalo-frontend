import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, TextInputProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { createAuthStyles, COLORS } from "../styles";
import { useThemeColors } from "@/shared/theme/colors";

// Header với nút back
interface AuthHeaderProps {
    onBack: () => void;
}

export const AuthHeader: React.FC<AuthHeaderProps> = ({ onBack }) => {
    const colors = useThemeColors();
    return (
        <SafeAreaView style={{ backgroundColor: colors.background }} edges={["top"]}>
            <View style={{ height: 52, justifyContent: "center", paddingHorizontal: 16 }}>
                <TouchableOpacity
                    onPress={onBack}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ width: 40, height: 40, justifyContent: 'center' }}
                    activeOpacity={0.7}
                >
                    <Ionicons name="chevron-back" size={26} color={colors.text} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

// Title
interface AuthTitleProps {
    title: string;
}

export const AuthTitle: React.FC<AuthTitleProps> = ({ title }) => {
    const colors = useThemeColors();
    const authStyles = createAuthStyles(colors);
    return (
        <View style={authStyles.titleContainer}>
            <Text style={[authStyles.titleText, { color: colors.primary }]}>{title}</Text>
        </View>
    );
};

// Input field
interface AuthInputProps extends TextInputProps {
    disabled?: boolean;
    error?: string; // Error message or boolean to trigger red border
    isPassword?: boolean; // Flag to enable password toggle
}

export const AuthInput: React.FC<AuthInputProps> = ({ disabled, error, isPassword, ...props }) => {
    const colors = useThemeColors();
    const authStyles = createAuthStyles(colors);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    // Determine if we should secure text entry
    // Only secure if it IS a password field AND not visible
    const secureTextEntry = isPassword && !isPasswordVisible;

    return (
        <View style={{ marginBottom: 16 }}>
            <View style={[
                authStyles.inputContainer,
                { marginBottom: 0, borderBottomColor: colors.border }, // We handle margin in the wrapper View
                error ? { borderBottomColor: 'red' } : {}
            ]}>
                <TextInput
                    style={[authStyles.input, { color: colors.text }]}
                    placeholderTextColor={colors.textSecondary}
                    editable={!disabled}
                    secureTextEntry={secureTextEntry}
                    {...props}
                />
                {isPassword && (
                    <TouchableOpacity
                        onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                        style={{ padding: 8 }}
                    >
                        <Ionicons
                            name={isPasswordVisible ? "eye-off" : "eye"}
                            size={24}
                            color={colors.textSecondary}
                        />
                    </TouchableOpacity>
                )}
            </View>
            {error && <Text style={{ color: 'red', fontSize: 12, marginTop: 4, marginLeft: 0 }}>{error}</Text>}
        </View>
    );
};

// Submit button
interface AuthButtonProps {
    title: string;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
    style?: object;
}

export const AuthButton: React.FC<AuthButtonProps> = ({ title, onPress, loading, disabled, style }) => {
    const colors = useThemeColors();
    const authStyles = createAuthStyles(colors);
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            style={[
                authStyles.submitButton,
                { backgroundColor: colors.primary },
                (loading || disabled) && { backgroundColor: COLORS.primaryDisabled },
                style
            ]}
            disabled={loading || disabled}
        >
            {loading ? (
                <ActivityIndicator color="#fff" />
            ) : (
                <Text style={authStyles.submitButtonText}>{title}</Text>
            )}
        </TouchableOpacity>
    );
};

// Link text
interface AuthLinkProps {
    text: string;
    onPress?: () => void;
}

export const AuthLink: React.FC<AuthLinkProps> = ({ text, onPress }) => {
    const colors = useThemeColors();
    const authStyles = createAuthStyles(colors);
    return (
        <View style={authStyles.linkContainer}>
            <TouchableOpacity onPress={onPress}>
                <Text style={[authStyles.linkText, { color: colors.textSecondary }]}>{text}</Text>
            </TouchableOpacity>
        </View>
    );
};
