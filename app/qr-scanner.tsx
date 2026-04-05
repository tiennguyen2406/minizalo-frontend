import { Platform } from "react-native";

const QrScannerView = Platform.select({
    default: require("../src/views/mobile/auth/screens/QrScannerScreen").default,
    web: () => null,
});

export default function QrScannerRoute() {
    return <QrScannerView />;
}
