export function formatTime(isoString: string): string {
    if (!isoString) return "";
    const date = new Date(isoString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        // Today → show HH:mm (e.g. "17:31")
        return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
    } else if (date.toDateString() === yesterday.toDateString()) {
        return "Hôm qua";
    } else {
        return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
    }
}
