import React from "react";
import { Platform, View, Text } from "react-native";
import BlockedListScreen from "@/views/mobile/profile/BlockedListScreen";
import BlockedUsersScreen from "@/views/web/components/BlockedUsersScreen";

export default function BlockedRoute() {
    if (Platform.OS === "web") {
        return (
            <div
                style={{
                    display: "flex",
                    height: "100vh",
                    backgroundColor: "#e5e7eb",
                }}
            >
                <main
                    style={{
                        flex: 1,
                        minWidth: 0,
                        padding: 16,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "flex-start",
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            width: "100%",
                            maxWidth: 1500,
                            backgroundColor: "#fff",
                            borderRadius: 16,
                            boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "column",
                            height: "100%",
                            maxHeight: "calc(100vh - 32px)",
                        }}
                    >
                        <BlockedUsersScreen />
                    </div>
                </main>
            </div>
        );
    }

    return <BlockedListScreen />;
}
