import React from "react";
import { Platform, Text, View } from "react-native";

const AdminLoginWeb = React.lazy(() => import("@/views/web/admin/AdminLoginWeb"));

export default function AdminLoginRoute() {
  if (Platform.OS !== "web") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>Trang đăng nhập admin chỉ hỗ trợ trên web.</Text>
      </View>
    );
  }

  return (
    <React.Suspense fallback={<Text>Loading...</Text>}>
      <AdminLoginWeb />
    </React.Suspense>
  );
}
