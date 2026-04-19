/**
 * Chạy trước expo-router.
 * - LogBox: ẩn overlay vàng trên thiết bị.
 * - console.warn: Metro vẫn in WARN từ RN core / dependency dù đã dùng safe-area-context;
 *   lọc các chuỗi đã biết để terminal sạch hơn khi dev.
 */
const { LogBox } = require("react-native");

const IGNORE_WARN_SUBSTRINGS = [
    "SafeAreaView has been deprecated",
    "[expo-av]: Expo AV has been deprecated",
];

LogBox.ignoreLogs(IGNORE_WARN_SUBSTRINGS);

if (typeof __DEV__ !== "undefined" && __DEV__) {
    const originalWarn = console.warn;
    console.warn = (...args) => {
        const first = args[0];
        const msg = typeof first === "string" ? first : "";
        if (IGNORE_WARN_SUBSTRINGS.some((s) => msg.includes(s))) {
            return;
        }
        originalWarn.apply(console, args);
    };
}
