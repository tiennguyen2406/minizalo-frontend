import React from "react";
import { Platform, Text, View } from "react-native";

const AdminDashboardWeb = React.lazy(() => import("@/views/web/admin/AdminDashboardWeb"));

export default function AdminRoute() {
  if (Platform.OS !== "web") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>Trang admin chỉ hỗ trợ trên web.</Text>
      </View>
    );
  }

  return (
    <React.Suspense fallback={<Text>Loading admin...</Text>}>
      <AdminDashboardWeb />
    </React.Suspense>
  );
}
