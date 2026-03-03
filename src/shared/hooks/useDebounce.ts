import { useState, useEffect } from "react";

/**
 * Trả về giá trị debounced của `value` sau `delay` ms.
 * Dùng để tránh gọi API liên tục khi user đang gõ.
 *
 * @example
 * const debouncedQuery = useDebounce(query, 350);
 * useEffect(() => { if (debouncedQuery) fetchResults(debouncedQuery); }, [debouncedQuery]);
 */
export function useDebounce<T>(value: T, delay: number = 350): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}
