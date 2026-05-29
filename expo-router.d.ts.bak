declare module "expo-router" {
  import type { ComponentType } from "react";

  export function useRouter(): {
    push: (href: string) => void;
    replace: (href: string) => void;
    back: () => void;
  };

  export const Redirect: ComponentType<{ href: string }>;
  export const Slot: ComponentType<Record<string, unknown>>;
}
