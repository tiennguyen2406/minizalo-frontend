import React from "react";
import GlobalSearchMobileScreen from "@/views/mobile/contacts/GlobalSearchMobileScreen";

/**
 * Màn hình tìm kiếm toàn cục (Native Stack).
 * Chuyển ra ngoài Tabs để xử lý điều hướng quay lại chính xác hơn trên iOS/Android.
 */
export default function SearchScreen() {
    return <GlobalSearchMobileScreen />;
}
