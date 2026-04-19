import React, { useMemo } from "react";
import { View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type SafeViewEdge = "top" | "right" | "bottom" | "left";

/** Padding-only safe area — không dùng NativeSafeAreaView (tránh crash Fabric RNCSafeAreaViewShadowNode trên Android). */
export type SafeViewProps = ViewProps & {
    edges?: readonly SafeViewEdge[];
};

export function SafeView({ edges, style, ...rest }: SafeViewProps) {
    const insets = useSafeAreaInsets();

    const padStyle = useMemo(() => {
        const useAll = edges == null || edges.length === 0;
        return {
            paddingTop: useAll || edges.includes("top") ? insets.top : 0,
            paddingBottom: useAll || edges.includes("bottom") ? insets.bottom : 0,
            paddingLeft: useAll || edges.includes("left") ? insets.left : 0,
            paddingRight: useAll || edges.includes("right") ? insets.right : 0,
        };
    }, [insets, edges]);

    return <View style={[padStyle, style]} {...rest} />;
}
