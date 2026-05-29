import { Platform } from "react-native";

const ForgotPasswordView = Platform.select({
    web: require("../../src/views/web/auth/ForgotPasswordWeb").default,
    default: require("../../src/views/mobile/auth/screens/ForgotPasswordScreen").default,
});

export default function ForgotPasswordRoute() {
    return <ForgotPasswordView />;
}
