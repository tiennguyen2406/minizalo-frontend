import React, { useRef, useCallback, useEffect, useState } from "react";

interface OtpInputProps {
    length?: number;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    onResend?: () => void;
    cooldownSeconds?: number;
}

const COLORS = {
    primary: "#0068FF",
    border: "#e0e0e0",
    focusBorder: "#0068FF",
    text: "#333",
    textSecondary: "#666",
    disabledBg: "#f5f5f5",
};

export default function OtpInput({
    length = 6,
    value,
    onChange,
    disabled = false,
    onResend,
    cooldownSeconds = 60,
}: OtpInputProps) {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [countdown, setCountdown] = useState(cooldownSeconds);

    useEffect(() => {
        setCountdown(cooldownSeconds);
    }, [cooldownSeconds]);

    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
        return () => clearInterval(timer);
    }, [countdown]);

    const digits = value.split("").concat(Array(length).fill("")).slice(0, length);

    const focusInput = useCallback((idx: number) => {
        inputRefs.current[idx]?.focus();
    }, []);

    const handleChange = useCallback(
        (idx: number, char: string) => {
            if (!/^[0-9]?$/.test(char)) return;
            const arr = value.split("").concat(Array(length).fill("")).slice(0, length);
            arr[idx] = char;
            const next = arr.join("").replace(/\s/g, "");
            onChange(next.slice(0, length));
            if (char && idx < length - 1) {
                focusInput(idx + 1);
            }
        },
        [value, length, onChange, focusInput]
    );

    const handleKeyDown = useCallback(
        (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Backspace" && !digits[idx] && idx > 0) {
                focusInput(idx - 1);
            }
        },
        [digits, focusInput]
    );

    const handlePaste = useCallback(
        (e: React.ClipboardEvent<HTMLInputElement>) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
            if (pasted) {
                onChange(pasted);
                focusInput(Math.min(pasted.length, length - 1));
            }
        },
        [length, onChange, focusInput]
    );

    const handleResend = useCallback(() => {
        if (countdown > 0 || !onResend) return;
        onResend();
        setCountdown(cooldownSeconds);
    }, [countdown, onResend, cooldownSeconds]);

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", gap: 8 }}>
                {digits.map((d, i) => (
                    <input
                        key={i}
                        ref={(el) => { inputRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={d}
                        disabled={disabled}
                        onChange={(e) => handleChange(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        onPaste={i === 0 ? handlePaste : undefined}
                        onFocus={(e) => e.target.select()}
                        style={{
                            width: 48,
                            height: 56,
                            textAlign: "center",
                            fontSize: 24,
                            fontWeight: 600,
                            border: `2px solid ${d ? COLORS.focusBorder : COLORS.border}`,
                            borderRadius: 12,
                            outline: "none",
                            color: COLORS.text,
                            backgroundColor: disabled ? COLORS.disabledBg : "#fff",
                            transition: "border-color 0.2s",
                        }}
                    />
                ))}
            </div>
            {onResend && (
                <button
                    type="button"
                    onClick={handleResend}
                    disabled={countdown > 0}
                    style={{
                        background: "none",
                        border: "none",
                        color: countdown > 0 ? COLORS.textSecondary : COLORS.primary,
                        fontSize: 14,
                        cursor: countdown > 0 ? "default" : "pointer",
                        fontWeight: 500,
                        padding: 0,
                    }}
                >
                    {countdown > 0 ? `Gửi lại mã sau ${countdown}s` : "Gửi lại mã"}
                </button>
            )}
        </div>
    );
}
