import React from "react";
import { View, Text, TextInput, TouchableOpacity, StatusBar } from "react-native";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";

export default function LoginWeb() {
    const [phone, setPhone] = React.useState("");
    const [password, setPassword] = React.useState("");

    const handleLogin = () => {
        console.log("Login Web:", { phone, password });
        // TODO: Implement login logic
    };

    return (
        <SafeAreaView className="flex-1 bg-zalo-blue-primary">
            <StatusBar barStyle="light-content" backgroundColor="#0068FF" />
            <View className="flex-1 justify-center items-center px-5">
                {/* Login Card */}
                <View className="bg-white rounded-2xl p-10 w-full max-w-md shadow-lg">
                    <Text className="text-zalo-blue-primary text-4xl font-bold mb-2 text-center">
                        MiniZalo
                    </Text>
                    <Text className="text-gray-500 text-sm mb-8 text-center">
                        Đăng nhập để tiếp tục
                    </Text>

                    {/* Phone Input */}
                    <TextInput
                        placeholder="Số điện thoại"
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 text-base"
                        placeholderTextColor="#999"
                    />

                    {/* Password Input */}
                    <TextInput
                        placeholder="Mật khẩu"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        className="border border-gray-300 rounded-lg px-4 py-3 mb-6 text-base"
                        placeholderTextColor="#999"
                    />

                    {/* Login Button */}
                    <TouchableOpacity
                        onPress={handleLogin}
                        activeOpacity={0.8}
                        className="bg-zalo-blue-primary rounded-lg py-3.5 items-center"
                    >
                        <Text className="text-white font-semibold text-base">Đăng nhập</Text>
                    </TouchableOpacity>

                    {/* Register Link */}
                    <View className="mt-4 flex-row justify-center">
                        <Text className="text-gray-500 text-sm">Chưa có tài khoản? </Text>
                        <TouchableOpacity>
                            <Text className="text-zalo-blue-primary font-semibold text-sm">Đăng ký ngay</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}
