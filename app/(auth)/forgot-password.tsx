import { Platform } from "react-native";

const ForgotPasswordView = Platform.select({
    web: require("../../src/views/web/auth/ForgotPasswordWeb").default,
    default: () => null,
});

export default function ForgotPasswordRoute() {
    return <ForgotPasswordView />;
}
