import { api } from "./apiClient";

export type ReportTargetType = "USER" | "GROUP" | "MESSAGE";

export interface CreateReportPayload {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details?: string;
}

export const REPORT_REASON_OPTIONS = [
  { value: "Spam / Quấy rối", label: "Spam / Quấy rối" },
  { value: "Nội dung không phù hợp", label: "Nội dung không phù hợp" },
  { value: "Lừa đảo / Gia mạo", label: "Lừa đảo / Gia mạo" },
  { value: "Bạo lực / Thù hận", label: "Bạo lực / Thù hận" },
  { value: "Khác", label: "Khác" },
] as const;

export const reportService = {
  submitReport: (payload: CreateReportPayload) =>
    api.post<{ success: boolean; reportId: string }>("/reports", payload),
};
