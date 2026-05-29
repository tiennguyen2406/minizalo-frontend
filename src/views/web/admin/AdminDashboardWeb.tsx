import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Database,
  FileText,
  Filter,
  Lock,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  Search,
  ServerCog,
  ShieldCheck,
  Users,
  UsersRound,
} from "lucide-react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/shared/services/apiClient";
import { adminService } from "@/shared/services/adminService";
import { AuthGuard } from "@/shared/guards/AuthGuard";
import { useAuthStore } from "@/shared/store/authStore";

type DailyPoint = { date: string; count: number; };
type OverviewStats = { totalUsers?: number; since?: string; };
type MessageStats = { totalMessages?: number; dailyVolume?: DailyPoint[]; };
type ActiveUserStats = { currentActiveUsers?: number; dailyActiveUsers?: DailyPoint[]; };
type ApiStatus = "ready" | "partial" | "missing";

type AdminSectionId = "dashboard" | "users" | "conversations" | "messages" | "media" | "groups" | "moderation" | "reports" | "audit" | "admins";

const sections: { id: AdminSectionId; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>; }[] = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "users", label: "Người dùng", icon: Users },
  { id: "conversations", label: "Cuộc trò chuyện", icon: MessageSquare },
  { id: "messages", label: "Tin nhắn", icon: FileText },
  { id: "media", label: "Tệp & Media", icon: Database },
  { id: "groups", label: "Nhóm & Kênh", icon: UsersRound },
  { id: "moderation", label: "Kiểm duyệt", icon: ShieldCheck },
  { id: "reports", label: "Báo cáo", icon: Activity },
  { id: "audit", label: "Audit Log", icon: Lock },
  { id: "admins", label: "Admin & Quyền", icon: ServerCog },
];

const endpointRows: { module: string; endpoint: string; status: ApiStatus; note: string; }[] = [
  { module: "Dashboard", endpoint: "GET /api/admin/dashboard/summary", status: "ready", note: "Tổng quan hệ thống" },
  { module: "Dashboard", endpoint: "GET /api/admin/dashboard/storage", status: "ready", note: "MinIO / media" },
  { module: "User", endpoint: "GET /api/admin/users", status: "ready", note: "Danh sách + phân trang" },
  { module: "User", endpoint: "PATCH /api/admin/users/{id}/lock", status: "ready", note: "Khóa tài khoản" },
  { module: "Chat room", endpoint: "GET /api/admin/rooms", status: "ready", note: "Danh sách phòng" },
  { module: "Messages", endpoint: "DELETE /api/admin/messages/{roomId}/{id}", status: "ready", note: "Xóa tin nhắn" },
  { module: "Groups", endpoint: "DELETE /api/admin/groups/{id}", status: "ready", note: "Giải tán nhóm" },
  { module: "Moderation", endpoint: "GET /api/admin/moderation/reports", status: "ready", note: "Báo cáo vi phạm" },
  { module: "Audit", endpoint: "GET /api/admin/audit-logs", status: "ready", note: "Admin audit log" },
  { module: "Admin", endpoint: "GET /api/admin/admins", status: "ready", note: "Danh sách admin" },
];

function formatNumber(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0";
  return new Intl.NumberFormat("vi-VN").format(value);
}

function statusMeta(status: ApiStatus) {
  if (status === "ready") return { label: "Sẵn sàng", className: "bg-green-100 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-400" };
  if (status === "partial") return { label: "Một phần", className: "bg-amber-100 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400" };
  return { label: "Thiếu API", className: "bg-rose-100 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-red-500/20 dark:text-rose-400" };
}

function normalizeSearch(value?: string) {
  return (value || "").trim().toLowerCase();
}

function matchesSearch(query: string, fields: (string | number | undefined | null)[]) {
  const keyword = normalizeSearch(query);
  if (!keyword) return true;
  return fields.some((field) => String(field ?? "").toLowerCase().includes(keyword));
}

const ROOM_TYPE_MAP: Record<string, string> = {
  "Cá nhân": "DIRECT",
  "Nhóm": "GROUP",
  "Cloud": "CLOUD",
};

const MESSAGE_TYPE_MAP: Record<string, string[]> = {
  "Tin nhắn text": ["TEXT"],
  "Hình ảnh": ["IMAGE"],
  "Tệp tin": ["FILE", "DOCUMENT", "VIDEO", "VOICE"],
};

const PAGE_SIZE = 10;

function buildPageNumbers(current: number, total: number): number[] {
  if (total <= 1) return [1];
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current, current - 1, current + 1, current - 2, current + 2]);
  return Array.from(pages)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
}

/** Hiển thị UUID đầy đủ (xuống dòng) + bấm để copy. */
function IdCell({ value }: { value?: string | null }) {
  const [copied, setCopied] = useState(false);
  const id = value?.trim() || "";
  if (!id) return <span className="text-slate-400 text-xs">—</span>;

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard không khả dụng */
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copyId()}
      title={copied ? "Đã copy ID" : `${id} — bấm để copy`}
      className="group block max-w-[11rem] sm:max-w-[13rem] text-left font-mono text-[11px] leading-[1.35] text-slate-600 break-all whitespace-normal hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
    >
      {id}
      <span className="mt-0.5 block text-[10px] font-sans font-medium text-slate-400 group-hover:text-blue-500 dark:group-hover:text-blue-400">
        {copied ? "Đã copy" : "Copy ID"}
      </span>
    </button>
  );
}

export default function AdminDashboardWeb() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [activeSection, setActiveSection] = useState<AdminSectionId>("dashboard");
  const [overview, setOverview] = useState<OverviewStats>({});
  const [dashboardSummary, setDashboardSummary] = useState<any>({});
  const [messageStats, setMessageStats] = useState<MessageStats>({});
  const [activeStats, setActiveStats] = useState<ActiveUserStats>({});
  const [users, setUsers] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [mediaStats, setMediaStats] = useState<any>({});
  const [topRooms, setTopRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [range, setRange] = useState("30");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [userFilter, setUserFilter] = useState("Tất cả");
  const [roomFilter, setRoomFilter] = useState("Tất cả");
  const [messageFilter, setMessageFilter] = useState("Tất cả");
  const [mediaFilter, setMediaFilter] = useState("Tất cả");
  const [groupFilter, setGroupFilter] = useState("Tất cả");
  const [moderationFilter, setModerationFilter] = useState("Tất cả");
  const [auditFilter, setAuditFilter] = useState("Tất cả");
  const [adminFilter, setAdminFilter] = useState("Tất cả");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const sinceIso = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - Number(range));
    return date.toISOString().slice(0, 19);
  }, [range]);

  const loadUsers = async () => {
    const locked = userFilter === "Bị khóa" ? true : undefined;
    const role = userFilter === "ROLE_USER" || userFilter === "ROLE_ADMIN" ? userFilter : undefined;
    const res = await adminService.getUsers({
      q: debouncedQuery || undefined,
      role,
      locked,
      page: 0,
      size: 200,
    }).catch(() => ({ data: { content: [] } }));
    setUsers(res.data?.content || []);
  };

  const loadReports = async () => {
    const status = moderationFilter !== "Tất cả" ? moderationFilter : undefined;
    const res = await adminService.getReports({ status, page: 0, size: 100 }).catch(() => ({ data: { content: [] } }));
    setReports(res.data?.content || []);
  };

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, overviewRes, messagesRes, activeRes, roomsRes, groupsRes, auditsRes, adminsRes, mediaRes, topRoomsRes] = await Promise.all([
        adminService.getDashboardSummary().catch(() => ({ data: {} })),
        api.get<OverviewStats>("/analytics/overview"),
        api.get<MessageStats>("/analytics/messages", { params: { since: sinceIso } }),
        api.get<ActiveUserStats>("/analytics/users/active", { params: { limit: 10 } }),
        adminService.getRooms({ page: 0, size: 200 }).catch(() => ({ data: { content: [] } })),
        adminService.getGroups({ page: 0, size: 200 }).catch(() => ({ data: { content: [] } })),
        adminService.getAuditLogs({ page: 0, size: 100 }).catch(() => ({ data: { content: [] } })),
        adminService.getAdmins().catch(() => ({ data: [] })),
        adminService.getMediaStats().catch(() => ({ data: {} })),
        adminService.getAnalyticsTopRooms(10).catch(() => ({ data: { topRooms: [] } })),
      ]);
      setDashboardSummary(summaryRes.data || {});
      setOverview(overviewRes.data || {});
      setMessageStats(messagesRes.data || {});
      setActiveStats(activeRes.data || {});
      setRooms(roomsRes.data?.content || []);
      setGroups(groupsRes.data?.content || []);
      setAudits(auditsRes.data?.content || []);
      setAdmins(adminsRes.data || []);
      setMediaStats(mediaRes.data || {});
      setTopRooms(topRoomsRes.data?.topRooms || []);
      await Promise.all([loadUsers(), loadReports()]);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const handleLockUser = async (userId: string, locked: boolean) => {
    try {
      if (locked) await adminService.unlockUser(userId);
      else await adminService.lockUser(userId);
      await loadAnalytics();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không thể cập nhật trạng thái user");
    }
  };

  const handleDisbandGroup = async (groupId: string) => {
    if (!confirm("Giải tán nhóm này? Hành động không thể hoàn tác.")) return;
    try {
      await adminService.disbandGroup(groupId);
      await loadAnalytics();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không thể giải tán nhóm");
    }
  };

  const handleResolveReport = async (reportId: string) => {
    try {
      await adminService.resolveReport(reportId, "Đã xử lý bởi admin");
      await loadAnalytics();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không thể xử lý báo cáo");
    }
  };

  useEffect(() => {
    void loadAnalytics();
  }, [sinceIso]);

  useEffect(() => {
    void loadUsers();
  }, [debouncedQuery, userFilter]);

  useEffect(() => {
    void loadReports();
  }, [moderationFilter]);

  const filteredRooms = useMemo(() => {
    const type = ROOM_TYPE_MAP[roomFilter];
    return rooms.filter((room) => {
      if (type && room.type !== type) return false;
      return matchesSearch(debouncedQuery, [room.id, room.name, room.type]);
    });
  }, [rooms, roomFilter, debouncedQuery]);

  const filteredGroups = useMemo(() => {
    return groups.filter((group) => {
      if (groupFilter === "Có Link" && !group.name) return false;
      if (groupFilter === "Công khai" && (group.members ?? 0) < 2) return false;
      if (groupFilter === "Kín" && (group.members ?? 0) >= 50) return false;
      return matchesSearch(debouncedQuery, [group.id, group.name, group.members, group.messages]);
    });
  }, [groups, groupFilter, debouncedQuery]);

  const filteredAudits = useMemo(() => {
    return audits.filter((row) => {
      if (auditFilter !== "Tất cả" && row.action !== auditFilter) return false;
      return matchesSearch(debouncedQuery, [row.action, row.target, row.targetType, row.time]);
    });
  }, [audits, auditFilter, debouncedQuery]);

  const filteredAdmins = useMemo(() => {
    return admins.filter((admin) => {
      if (adminFilter === "ROLE_ADMIN" && admin.role !== "ROLE_ADMIN") return false;
      return matchesSearch(debouncedQuery, [admin.name, admin.email, admin.phone, admin.id]);
    });
  }, [admins, adminFilter, debouncedQuery]);

  const filteredTopRooms = useMemo(() => {
    return topRooms.filter((room) => matchesSearch(debouncedQuery, [room.name, room.roomId, room.type]));
  }, [topRooms, debouncedQuery]);

  const filteredReportsList = useMemo(() => {
    return reports.filter((r) => matchesSearch(debouncedQuery, [r.targetType, r.targetId, r.reason, r.details, r.reporter, r.status]));
  }, [reports, debouncedQuery]);

  const searchPlaceholder = useMemo(() => {
    const map: Record<AdminSectionId, string> = {
      dashboard: "Tìm phòng, user...",
      users: "Tìm tên, email, SĐT...",
      conversations: "Tìm tên phòng, mã phòng...",
      messages: "Tìm nội dung tin nhắn...",
      media: "Tìm endpoint, tính năng...",
      groups: "Tìm tên nhóm...",
      moderation: "Tìm báo cáo, người báo...",
      reports: "Tìm API, module...",
      audit: "Tìm hành động, mục tiêu...",
      admins: "Tìm admin, email, SĐT...",
    };
    return map[activeSection];
  }, [activeSection]);

  if (Platform.OS !== "web") return null;

  const filteredEndpoints = endpointRows.filter((row) => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return true;
    return `${row.module} ${row.endpoint} ${row.note}`.toLowerCase().includes(keyword);
  });

  const listResetKey = `${activeSection}-${debouncedQuery}-${userFilter}-${roomFilter}-${messageFilter}-${mediaFilter}-${groupFilter}-${moderationFilter}-${auditFilter}-${adminFilter}`;

  return (
    <AuthGuard
      mode="requireAuth"
      allowedRoles={["ROLE_ADMIN"]}
      loginPath="/admin-login"
      homePath="/admin-login"
    >
      <div className="h-screen w-screen flex overflow-hidden font-sans transition-colors duration-300 bg-[#f4f7fb] text-slate-900 dark:bg-[#0b1120] dark:text-gray-100">
        
        {/* Sidebar */}
        <aside className="w-[260px] min-w-[260px] flex flex-col p-5 gap-6 backdrop-blur-xl border-r transition-colors duration-300 z-10 bg-white/80 border-slate-200/50 dark:bg-[#111827]/80 dark:border-white/5">
          <button 
            className="flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-300 group bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 dark:from-blue-900/40 dark:to-blue-800/20 dark:border-blue-500/30 dark:hover:border-blue-400/50 dark:hover:from-blue-800/40"
          >
            <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-sm dark:bg-blue-500/20 dark:text-blue-400">
              <ShieldCheck size={20} />
            </div>
            <span className="font-bold text-[15px] tracking-tight text-slate-900 dark:text-white">MiniZalo Admin</span>
          </button>

          <nav className="flex flex-col gap-1.5 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              const activeClass = "bg-blue-600 text-white shadow-[0_4px_20px_-4px_rgba(37,99,235,0.4)] dark:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.5)]";
              const inactiveClass = "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200";

              return (
                <button
                  key={section.id}
                  type="button"
                  title={section.label}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-all duration-300 text-[14px] font-medium ${isActive ? activeClass : inactiveClass}`}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className={isActive ? "" : "opacity-80"} />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 h-screen overflow-y-auto relative">
          <div className="max-w-[1200px] mx-auto p-8 pb-24">
            
            {/* Header Sticky */}
            <header className="sticky top-0 z-40 -mx-8 px-8 py-5 mb-8 backdrop-blur-2xl border-b transition-all duration-300 flex justify-between items-center bg-[#f4f7fb]/80 border-slate-200 dark:bg-[#0b1120]/80 dark:border-white/5">
              <div>
                <div className="text-[12px] font-bold uppercase tracking-widest text-blue-500 mb-1.5">Trang Quản Trị Hệ Thống</div>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {sections.find((item) => item.id === activeSection)?.label}
                </h1>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2.5 px-4 h-11 rounded-full border transition-all duration-300 focus-within:ring-2 focus-within:ring-blue-500/50 bg-white border-slate-200 shadow-sm dark:bg-[#1e293b] dark:border-slate-700">
                  <Search size={16} className="text-slate-400 dark:text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && activeSection === "users") void loadUsers();
                      if (event.key === "Enter" && activeSection === "moderation") void loadReports();
                    }}
                    placeholder={searchPlaceholder}
                    className="bg-transparent outline-none border-none text-[14px] w-48 transition-all focus:w-64 text-slate-900 placeholder-slate-400 dark:text-white dark:placeholder-slate-500"
                  />
                </div>
                
                <select 
                  value={range} 
                  onChange={(event) => setRange(event.target.value)} 
                  className="h-11 rounded-full px-4 text-[14px] font-medium border appearance-none outline-none cursor-pointer transition-all bg-white border-slate-200 text-slate-700 shadow-sm focus:border-blue-500 dark:bg-[#1e293b] dark:border-slate-700 dark:text-slate-200 dark:focus:border-blue-500"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px', paddingRight: '36px' }}
                >
                  <option value="7">7 ngày qua</option>
                  <option value="30">30 ngày qua</option>
                  <option value="90">90 ngày qua</option>
                </select>
                
                <button 
                  type="button" 
                  title="Làm mới" 
                  onClick={loadAnalytics}
                  className="w-11 h-11 rounded-full flex items-center justify-center border transition-all duration-300 hover:rotate-180 bg-white border-slate-200 text-slate-600 shadow-sm hover:text-blue-600 dark:bg-[#1e293b] dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </header>

            {error && (
              <div className="mb-6 p-4 rounded-2xl border flex items-center gap-3 bg-red-50 border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400">
                <Activity size={20} />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <div className="flex flex-col gap-6 opacity-0 animate-[fadeIn_0.4s_ease-out_forwards]">
              {activeSection === "dashboard" && <DashboardSection loading={loading} overview={overview} dashboardSummary={dashboardSummary} messageStats={messageStats} activeStats={activeStats} topRooms={filteredTopRooms} range={range} listResetKey={listResetKey} />}
              {activeSection === "users" && <UsersSection users={users} loading={loading} onToggleLock={handleLockUser} activeFilter={userFilter} onFilterChange={setUserFilter} listResetKey={listResetKey} />}
              {activeSection === "conversations" && <ConversationsSection rooms={filteredRooms} loading={loading} setActiveSection={setActiveSection} setSelectedRoomId={setSelectedRoomId} activeFilter={roomFilter} onFilterChange={setRoomFilter} listResetKey={listResetKey} />}
              {activeSection === "messages" && <MessagesSection roomId={selectedRoomId} setRoomId={setSelectedRoomId} searchQuery={debouncedQuery} typeFilter={messageFilter} onTypeFilterChange={setMessageFilter} />}
              {activeSection === "media" && <MediaSection mediaStats={mediaStats} activeFilter={mediaFilter} onFilterChange={setMediaFilter} searchQuery={debouncedQuery} />}
              {activeSection === "groups" && <GroupsSection groups={filteredGroups} loading={loading} onDisband={handleDisbandGroup} activeFilter={groupFilter} onFilterChange={setGroupFilter} listResetKey={listResetKey} />}
              {activeSection === "moderation" && <ModerationSection reports={filteredReportsList} loading={loading} onResolve={handleResolveReport} activeFilter={moderationFilter} onFilterChange={setModerationFilter} listResetKey={listResetKey} />}
              {activeSection === "reports" && <ReportsSection messageStats={messageStats} activeStats={activeStats} endpoints={filteredEndpoints} dashboardSummary={dashboardSummary} listResetKey={listResetKey} />}
              {activeSection === "audit" && <AuditSection audits={filteredAudits} loading={loading} activeFilter={auditFilter} onFilterChange={setAuditFilter} listResetKey={listResetKey} />}
              {activeSection === "admins" && <AdminsSection currentUser={user?.username || user?.fullName || "Admin"} admins={filteredAdmins} onRefresh={loadAnalytics} activeFilter={adminFilter} onFilterChange={setAdminFilter} listResetKey={listResetKey} />}
            </div>

          </div>
        </main>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 4px; }
          html.dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
          .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); }
          html.dark .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); }
        `}} />
      </div>
    </AuthGuard>
  );
}

// ---------------- UI COMPONENTS ----------------

function DashboardSection({ loading, overview, dashboardSummary, messageStats, activeStats, topRooms, range, listResetKey }: any) {
  const totalMessages = messageStats.totalMessages || dashboardSummary.messagesLast30Days || 0;
  const activeUsers = activeStats.currentActiveUsers || dashboardSummary.activeUsersLast24h || 0;
  const dailyMessages = messageStats.dailyVolume || [];
  const dailyActive = activeStats.dailyActiveUsers || [];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <Metric title="Tổng người dùng" value={formatNumber(dashboardSummary.totalUsers ?? overview.totalUsers)} tone="blue" detail="Toàn hệ thống" />
        <Metric title="Tin nhắn" value={formatNumber(totalMessages)} tone="indigo" detail={`${range} ngày qua`} />
        <Metric title="Người dùng Online" value={formatNumber(activeUsers)} tone="emerald" detail="Trong 24 giờ qua" />
        <Metric title="Tài khoản bị khóa" value={formatNumber(dashboardSummary.lockedUsers)} tone="rose" detail={`${formatNumber(dashboardSummary.pendingReports)} báo cáo chờ`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Metric title="Tổng phòng chat" value={formatNumber(dashboardSummary.totalRooms)} tone="blue" detail={`${formatNumber(dashboardSummary.totalGroups)} nhóm`} />
        <Metric title="Chat cá nhân" value={formatNumber(dashboardSummary.totalDirectChats)} tone="indigo" detail="DIRECT" />
        <Metric title="Zalo Cloud" value={formatNumber(dashboardSummary.totalCloudRooms)} tone="emerald" detail="CLOUD" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Biểu đồ tin nhắn" action={loading ? "Đang tải" : `${dailyMessages.length} ngày`}>
          <MiniBars data={dailyMessages} tone="blue" />
        </Panel>
        <Panel title="Hoạt động người dùng" action={loading ? "Đang tải" : `${dailyActive.length} ngày`}>
          <MiniBars data={dailyActive} tone="emerald" />
        </Panel>
      </div>

      <Panel title="Top phòng chat hoạt động" action={`${topRooms.length} phòng`}>
        <PaginatedDataTable
          resetKey={`top-${listResetKey}-${topRooms.length}`}
          headers={["Tên phòng", "Loại", "Tin nhắn"]}
          rows={topRooms.map((room: any) => [
            <strong key="n">{room.name || room.roomId?.slice(0, 8)}</strong>,
            <TypePill key="t" label={room.type} />,
            formatNumber(room.messages),
          ])}
        />
      </Panel>

      <Panel title="Tình trạng API Backend" action="Kiểm tra hệ thống">
        <EndpointTable rows={endpointRows} resetKey="api-endpoints" />
      </Panel>
    </div>
  );
}

function UsersSection({ users, loading, onToggleLock, activeFilter, onFilterChange, listResetKey }: any) {
  return (
    <div className="flex flex-col gap-6">
      <Toolbar title="Quản lý người dùng" filters={["Tất cả", "ROLE_USER", "Bị khóa"]} activeFilter={activeFilter} onFilterChange={onFilterChange} />
      <Panel title="Danh sách tài khoản" action={loading ? "Đang tải..." : `${users.length} tài khoản`}>
        {users.length === 0 && !loading ? (
          <div className="p-12 text-center text-slate-500">Không tìm thấy người dùng phù hợp.</div>
        ) : (
        <PaginatedDataTable
          resetKey={listResetKey}
          columnClasses={["align-top min-w-[8.5rem]"]}
          headers={["ID", "Tên đăng nhập", "Email", "Quyền", "Trạng thái", "Tin nhắn", "Thao tác"]}
          rows={users.map((u: any) => [
            <IdCell key="id" value={u.id} />,
            <strong key="n" className="text-slate-800 dark:text-slate-200">{u.name}</strong>,
            u.email,
            <span key="r" className="font-semibold text-blue-600 dark:text-blue-400 text-[12px]">{u.role}</span>,
            <StatePill key="state" label={u.state} />,
            formatNumber(u.messages),
            <button
              key="lock"
              type="button"
              onClick={() => void onToggleLock(u.id, u.state === "Locked")}
              className={`px-3 py-1 rounded-lg text-xs font-bold ${u.state === "Locked" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
            >
              {u.state === "Locked" ? "Mở khóa" : "Khóa"}
            </button>,
          ])}
        />
        )}
      </Panel>
    </div>
  );
}

function ConversationsSection({ rooms, loading, setActiveSection, setSelectedRoomId, activeFilter, onFilterChange, listResetKey }: any) {
  return (
    <div className="flex flex-col gap-6">
      <Toolbar title="Giám sát phòng chat" filters={["Tất cả", "Cá nhân", "Nhóm", "Cloud"]} activeFilter={activeFilter} onFilterChange={onFilterChange} />
      <Panel title="Danh sách phòng hiện tại" action={loading ? "Đang tải..." : `${rooms.length} phòng`}>
        {rooms.length === 0 && !loading ? (
          <div className="p-12 text-center text-slate-500">Không tìm thấy phòng phù hợp.</div>
        ) : (
        <PaginatedDataTable
          resetKey={listResetKey}
          columnClasses={["align-top min-w-[8.5rem]"]}
          headers={["Mã phòng", "Tên", "Phân loại", "Số lượng", "Tương tác", "Lần cuối", ""]}
          rows={rooms.map((room: any) => [
            <IdCell key="id" value={room.id} />,
            <strong key="n" className="text-slate-800 dark:text-slate-200">{room.name}</strong>,
            <TypePill key="type" label={room.type} />,
            room.members, formatNumber(room.messages), 
            <span key="t" className="text-slate-500 dark:text-slate-400 text-xs">{room.updatedAt?.slice(0, 10)}</span>,
            <button 
              key="more" 
              onClick={() => {
                setSelectedRoomId(room.id);
                setActiveSection("messages");
              }}
              title="Xem tin nhắn"
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 dark:text-slate-400 dark:hover:bg-white/10"
            >
              <MoreHorizontal size={18} />
            </button>
          ])}
        />
        )}
      </Panel>
    </div>
  );
}

function MessagesSection({ roomId, setRoomId, searchQuery, typeFilter, onTypeFilterChange }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [allMessages, setAllMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputRoom, setInputRoom] = useState(roomId || "");
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const applyLocalFilters = (items: any[], q?: string, type?: string) => {
    let result = items;
    const types = type && type !== "Tất cả" ? MESSAGE_TYPE_MAP[type] : null;
    if (types) {
      result = result.filter((msg) => types.includes(String(msg.type || "").toUpperCase()));
    }
    if (q?.trim()) {
      const keyword = q.trim().toLowerCase();
      result = result.filter((msg) =>
        matchesSearch(keyword, [msg.content, msg.senderName, msg.senderId, msg.messageId, msg.type])
      );
    }
    return result;
  };

  const fetchMessages = async (targetId: string, q?: string) => {
    if (!targetId.trim()) return;
    setLoading(true);
    setError(null);
    setActionMsg(null);
    try {
      const res = q?.trim()
        ? await adminService.searchMessages({ roomId: targetId, q: q.trim(), limit: 100 })
        : await adminService.getMessages(targetId, 100);
      const loaded = res.data?.messages || res.data || [];
      setAllMessages(loaded);
      setMessages(applyLocalFilters(loaded, searchQuery, typeFilter));
      setRoomId(targetId);
    } catch (err: any) {
      setError(err.response?.data?.message || "Không tìm thấy phòng hoặc lỗi máy chủ");
      setMessages([]);
      setAllMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMessages(applyLocalFilters(allMessages, searchQuery, typeFilter));
  }, [allMessages, searchQuery, typeFilter]);

  useEffect(() => {
    if (searchQuery && roomId && allMessages.length === 0) {
      void fetchMessages(roomId, searchQuery);
    }
  }, [searchQuery]);

  const handleHide = async (msg: any) => {
    if (!roomId || !msg.messageId) return;
    try {
      await adminService.hideMessage(roomId, msg.messageId);
      setActionMsg("Đã ẩn tin nhắn");
      await fetchMessages(roomId, searchQuery);
    } catch (err: any) {
      setError(err.response?.data?.message || "Không thể ẩn tin nhắn");
    }
  };

  const handleDelete = async (msg: any) => {
    if (!roomId || !msg.messageId || !confirm("Xóa tin nhắn này?")) return;
    try {
      await adminService.deleteMessage(roomId, msg.messageId);
      setActionMsg("Đã xóa tin nhắn");
      await fetchMessages(roomId, searchQuery);
    } catch (err: any) {
      setError(err.response?.data?.message || "Không thể xóa tin nhắn");
    }
  };

  useEffect(() => {
    if (roomId) {
      setInputRoom(roomId);
      void fetchMessages(roomId);
    }
  }, [roomId]);

  return (
    <div className="flex flex-col gap-6">
      <Toolbar title="Quản trị nội dung" filters={["Tất cả", "Tin nhắn text", "Hình ảnh", "Tệp tin"]} activeFilter={typeFilter} onFilterChange={onTypeFilterChange} />

      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={inputRoom}
          onChange={(e) => setInputRoom(e.target.value)}
          placeholder="Room ID..."
          className="flex-1 min-w-[200px] h-11 px-4 rounded-xl border bg-white border-slate-200 text-[14px] shadow-sm focus:outline-none focus:border-blue-500 dark:bg-[#1e293b] dark:border-slate-700 dark:text-white"
        />
        <button
          onClick={() => fetchMessages(inputRoom, searchQuery)}
          disabled={loading}
          className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-[14px] disabled:opacity-50"
        >
          {loading ? "Đang tìm..." : "Tải tin nhắn"}
        </button>
      </div>

      {searchQuery && (
        <p className="text-sm text-slate-500">Đang lọc theo tìm kiếm header: <strong>{searchQuery}</strong></p>
      )}

      {error && <div className="p-4 rounded-xl bg-red-50 text-red-600 border border-red-200 text-[14px] dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400">{error}</div>}
      {actionMsg && <div className="p-4 rounded-xl bg-green-50 text-green-700 border border-green-200 text-[14px]">{actionMsg}</div>}

      <Panel title={`Luồng tin nhắn (Phòng: ${roomId || "Trống"})`} action={`${messages.length} tin`}>
        {messages.length === 0 && !loading && !error && (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">Hãy nhập Room ID để tải danh sách tin nhắn.</div>
        )}
        {messages.length > 0 && (
          <PaginatedDataTable
            resetKey={`msg-${messages.length}-${searchQuery}-${typeFilter}`}
            headers={["Mã TN", "Người gửi", "Loại", "Nội dung", "Thời gian", "Thao tác"]}
            rows={messages.map((msg: any) => [
              <span key="id" className="text-slate-500 text-xs font-mono">{msg.messageId?.slice(0, 8)}...</span>,
              <strong key="sender">{msg.senderName || msg.senderId}</strong>,
              <TypePill key="type" label={msg.type} />,
              <div key="content" className="max-w-xs truncate" title={msg.content}>{msg.content || "(Đính kèm/File)"}</div>,
              <span key="time" className="text-slate-500 text-xs">{msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ""}</span>,
              <div key="actions" className="flex gap-2">
                <button type="button" onClick={() => void handleHide(msg)} className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800">Ẩn</button>
                <button type="button" onClick={() => void handleDelete(msg)} className="text-xs px-2 py-1 rounded bg-rose-100 text-rose-800">Xóa</button>
              </div>,
            ])}
          />
        )}
      </Panel>
    </div>
  );
}

function MediaSection({ mediaStats, activeFilter, onFilterChange, searchQuery }: any) {
  const rows = [
    { label: "Upload file", endpoint: mediaStats.uploadEndpoint || "POST /api/files/upload", status: "Sẵn sàng", note: "Multipart", category: "Tài liệu" },
    { label: "Presigned URL", endpoint: mediaStats.presignedEndpoint || "POST /api/media/presigned-url", status: "Sẵn sàng", note: "MinIO", category: "Tài liệu" },
    { label: "Avatar", endpoint: mediaStats.avatarEndpoint || "PUT /api/users/avatar", status: "Sẵn sàng", note: "JPG/PNG ≤5MB", category: "Hình ảnh" },
  ].filter((row) => {
    if (activeFilter !== "Tất cả" && row.category !== activeFilter) return false;
    return matchesSearch(searchQuery, [row.label, row.endpoint, row.note, row.category]);
  });

  return (
    <div className="flex flex-col gap-6">
      <Toolbar title="Lưu trữ & Tệp đính kèm" filters={["Tất cả", "Hình ảnh", "Video", "Tài liệu"]} activeFilter={activeFilter} onFilterChange={onFilterChange} />
      <Panel title="Thống kê lưu trữ" action={mediaStats.status || "MinIO"}>
        {rows.length === 0 ? (
          <div className="p-12 text-center text-slate-500">Không có mục phù hợp bộ lọc.</div>
        ) : (
        <PaginatedDataTable
          resetKey={`media-${rows.length}-${activeFilter}-${searchQuery}`}
          headers={["Tính năng", "Endpoint", "Trạng thái", "Ghi chú"]}
          rows={rows.map((row) => [
            row.label,
            row.endpoint,
            <StatePill key={`s-${row.label}`} label={row.status} />,
            row.note,
          ])}
        />
        )}
        {mediaStats.note && <p className="px-6 pb-4 text-sm text-slate-500">{mediaStats.note}</p>}
      </Panel>
    </div>
  );
}

function GroupsSection({ groups, loading, onDisband, activeFilter, onFilterChange, listResetKey }: any) {
  return (
    <div className="flex flex-col gap-6">
      <Toolbar title="Tổ chức & Cộng đồng" filters={["Tất cả", "Công khai", "Kín", "Có Link"]} activeFilter={activeFilter} onFilterChange={onFilterChange} />
      <Panel title="Danh bạ Nhóm" action={loading ? "Đang tải..." : `${groups.length} Nhóm`}>
        {groups.length === 0 && !loading ? (
          <div className="p-12 text-center text-slate-500">Không tìm thấy nhóm phù hợp.</div>
        ) : (
        <PaginatedDataTable
          resetKey={listResetKey}
          headers={["Tên nhóm", "Thành viên", "Tin nhắn", "Lần cuối", "Thao tác"]}
          rows={groups.map((room: any) => [
            <strong key="n" className="text-slate-800 dark:text-slate-200">{room.name}</strong>,
            room.members,
            room.messages,
            <span key="t" className="text-slate-500 text-xs">{room.updatedAt?.slice(0, 10)}</span>,
            <button key="d" type="button" onClick={() => void onDisband(room.id)} className="text-xs px-3 py-1 rounded-lg bg-rose-100 text-rose-700 font-bold">Giải tán</button>,
          ])}
        />
        )}
      </Panel>
    </div>
  );
}

function ModerationSection({ reports, loading, onResolve, activeFilter, onFilterChange, listResetKey }: any) {
  return (
    <div className="flex flex-col gap-6">
      <Toolbar title="An ninh & Báo cáo" filters={["Tất cả", "PENDING", "RESOLVED", "DISMISSED"]} activeFilter={activeFilter} onFilterChange={onFilterChange} />
      <Panel title="Hàng đợi Kiểm Duyệt" action={loading ? "Đang tải..." : `${reports.length} báo cáo`}>
        {reports.length === 0 ? (
          <div className="p-12 text-center text-slate-500">Chưa có báo cáo nào. Bảng content_reports sẽ hiển thị tại đây.</div>
        ) : (
          <PaginatedDataTable
            resetKey={listResetKey}
            headers={["Loại", "Mục tiêu", "Lý do", "Người báo", "Trạng thái", "Thao tác"]}
            rows={reports.map((r: any) => [
              r.targetType,
              <code key="id" className="text-xs">{r.targetId?.slice(0, 12)}</code>,
              r.reason || r.details || "—",
              r.reporter,
              <StatePill key="s" label={r.status} />,
              r.status === "PENDING" ? (
                <button key="a" type="button" onClick={() => void onResolve(r.id)} className="text-xs px-3 py-1 rounded-lg bg-blue-100 text-blue-700 font-bold">Xử lý</button>
              ) : "—",
            ])}
          />
        )}
      </Panel>
    </div>
  );
}

function ReportsSection({ messageStats, activeStats, endpoints, dashboardSummary, listResetKey }: any) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Metric title="Tổng nhóm" value={formatNumber(dashboardSummary.totalGroups)} tone="blue" detail="GROUP rooms" />
        <Metric title="Phòng chat" value={formatNumber(dashboardSummary.totalRooms)} tone="indigo" detail="Toàn hệ thống" />
        <Metric title="Báo cáo chờ" value={formatNumber(dashboardSummary.pendingReports)} tone="rose" detail="Moderation queue" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Lưu lượng Truyền tải" action="GET /analytics/messages">
          <MiniBars data={messageStats.dailyVolume || []} tone="violet" />
        </Panel>
        <Panel title="Chỉ số Năng động" action="GET /analytics/users/active">
          <MiniBars data={activeStats.dailyActiveUsers || []} tone="teal" />
        </Panel>
      </div>
      <Panel title="Danh sách Cổng kết nối API" action={`${endpoints.length} Routes`}>
        <EndpointTable rows={endpoints} resetKey={`reports-api-${listResetKey}-${endpoints.length}`} />
      </Panel>
    </div>
  );
}

function AuditSection({ audits, loading, activeFilter, onFilterChange, listResetKey }: any) {
  return (
    <div className="flex flex-col gap-6">
      <Toolbar title="Nhật ký Admin (Audit)" filters={["Tất cả", "LOCK_USER", "UNLOCK_USER", "DELETE_MESSAGE", "GRANT_ROLE"]} activeFilter={activeFilter} onFilterChange={onFilterChange} />
      <Panel title="Dấu vết Thao tác Admin" action={loading ? "Đang tải..." : `${audits.length} bản ghi`}>
        {audits.length === 0 ? (
          <div className="p-12 text-center text-slate-500">Chưa có audit log admin. Các thao tác khóa user, xóa tin, cấp quyền sẽ được ghi tại đây.</div>
        ) : (
          <PaginatedDataTable
            resetKey={listResetKey}
            headers={["Thời điểm", "Hành động", "Loại", "Mục tiêu", "Trạng thái"]}
            rows={audits.map((row: any) => [
              <span key="t" className="text-slate-500 text-[12px]">{row.time?.slice(0, 19).replace("T", " ")}</span>,
              <span key="act" className="font-semibold text-blue-600">{row.action}</span>,
              row.targetType || "—",
              <code key="tgt" className="text-xs">{row.target?.slice(0, 16)}</code>,
              <StatePill key="s" label={row.status} />,
            ])}
          />
        )}
      </Panel>
    </div>
  );
}

function AdminsSection({ currentUser, admins, onRefresh, activeFilter, onFilterChange, listResetKey }: { currentUser: string; admins: any[]; onRefresh: () => void; activeFilter: string; onFilterChange: (v: string) => void; listResetKey: string }) {
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("ROLE_ADMIN");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleGrantRole = async () => {
    if (!phone) {
      setMessage({ type: "error", text: "Vui lòng nhập số điện thoại" });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await adminService.grantRole(phone, role);
      setMessage({ type: "success", text: res.data?.message || "Cấp quyền thành công" });
      setPhone("");
      onRefresh();
    } catch (err: any) {
      setMessage({ type: "error", text: err?.response?.data?.message || err?.message || "Lỗi khi cấp quyền" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Toolbar title="Cấu hình Phân Quyền" filters={["Tất cả", "ROLE_ADMIN"]} activeFilter={activeFilter} onFilterChange={onFilterChange} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Danh sách Admin hiện tại" action={`${admins.length} admin`}>
          <PaginatedDataTable
            resetKey={listResetKey}
            headers={["Tên", "Email", "SĐT", "Thao tác"]}
            rows={admins.map((a: any) => [
              <strong key="n">{a.name}</strong>,
              a.email,
              a.phone || "—",
              <button key="r" type="button" onClick={async () => { try { await adminService.revokeAdmin(a.id); onRefresh(); } catch (e: any) { setMessage({ type: "error", text: e?.response?.data?.message || "Lỗi" }); } }} className="text-xs px-2 py-1 rounded bg-rose-100 text-rose-700">Thu hồi</button>,
            ])}
          />
        </Panel>

        <Panel title="Danh sách Vai trò Hệ thống" action={`Bạn là: ${currentUser}`}>
          <PaginatedDataTable
            resetKey="roles-static"
            headers={["Định danh Quyền", "Quyền hạn", "Triển khai"]}
            rows={[
              [<strong key="1" className="text-slate-800 dark:text-slate-200">ROLE_USER</strong>, "Giao tiếp, kết bạn, tham gia nhóm", <StatePill key="s" label="Hoàn tất" />],
              [<strong key="2" className="text-slate-800 dark:text-slate-200">ROLE_MODERATOR</strong>, "Hỗ trợ Kiểm duyệt nội dung", <StatePill key="s" label="Một phần" />],
              [<strong key="3" className="text-slate-800 dark:text-slate-200">ROLE_ADMIN</strong>, "Quyền năng tối thượng", <StatePill key="s" label="Hoàn tất" />],
            ]}
          />
        </Panel>

        <Panel title="Cấp quyền truy cập (API)" action="Mới">
          <div className="p-6">
            <p className="text-sm text-slate-500 mb-6 dark:text-slate-400">
              Chỉ những tài khoản mang quyền <strong>ROLE_ADMIN</strong> mới có thể thấy trang quản trị này và sử dụng các tính năng đặc quyền.
            </p>
            
            {message && (
              <div className={`mb-4 p-3 rounded-xl border text-sm font-medium flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-400' : 'bg-red-50 border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400'}`}>
                {message.type === 'success' ? <CheckCircle2 size={16} /> : <Activity size={16} />}
                {message.text}
              </div>
            )}

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Số điện thoại người dùng</label>
                <input 
                  type="text" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="VD: 0352359401"
                  className="w-full h-11 px-4 rounded-xl border bg-slate-50 border-slate-200 text-sm focus:border-blue-500 outline-none transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Chọn Quyền</label>
                <select 
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border bg-slate-50 border-slate-200 text-sm focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="ROLE_ADMIN">ROLE_ADMIN (Toàn quyền)</option>
                  <option value="ROLE_MODERATOR">ROLE_MODERATOR (Sắp ra mắt)</option>
                </select>
              </div>

              <button 
                type="button" 
                onClick={handleGrantRole}
                disabled={loading}
                className="mt-2 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Đang xử lý..." : "Cấp Quyền Ngay"}
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ---------------- UI COMPONENTS ----------------

function Metric({ title, value, detail, tone }: any) {
  const tones = {
    blue: "from-blue-50 to-white text-blue-600 border-blue-100 dark:from-blue-900/30 dark:to-blue-800/10 dark:text-blue-400 dark:border-blue-800/50",
    indigo: "from-indigo-50 to-white text-indigo-600 border-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/10 dark:text-indigo-400 dark:border-indigo-800/50",
    emerald: "from-emerald-50 to-white text-emerald-600 border-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/10 dark:text-emerald-400 dark:border-emerald-800/50",
    rose: "from-rose-50 to-white text-rose-600 border-rose-100 dark:from-rose-900/30 dark:to-rose-800/10 dark:text-rose-400 dark:border-rose-800/50",
  }[tone as "blue" | "indigo" | "emerald" | "rose"];

  return (
    <div className={`p-6 rounded-3xl border bg-gradient-to-br shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${tones} dark:bg-[#1e293b]/50 dark:backdrop-blur-sm`}>
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-[14px] font-semibold text-slate-600 dark:text-slate-300">{title}</h3>
        <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm border border-white/10 shadow-sm text-current">
          <Activity size={18} />
        </div>
      </div>
      <div className="text-4xl font-extrabold tracking-tight mb-2 text-slate-900 dark:text-white">{value}</div>
      <div className="text-[13px] font-medium text-slate-500 dark:text-slate-400">{detail}</div>
    </div>
  );
}

function Panel({ title, action, children }: any) {
  return (
    <div className="rounded-3xl border shadow-sm overflow-hidden transition-colors duration-300 bg-white border-slate-200 dark:bg-[#1e293b]/80 dark:border-slate-700/80 dark:backdrop-blur-xl">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 dark:border-slate-700/80 dark:bg-slate-800/50">
        <h2 className="text-[16px] font-bold text-slate-800 dark:text-slate-200">{title}</h2>
        {action && <span className="text-[13px] font-medium px-3 py-1 rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">{action}</span>}
      </div>
      <div className="p-1">{children}</div>
    </div>
  );
}

function Toolbar({ title, filters, activeFilter, onFilterChange }: { title: string; filters: string[]; activeFilter?: string; onFilterChange?: (value: string) => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl border shadow-sm bg-white border-slate-200 dark:bg-[#1e293b]/80 dark:border-slate-700/80 dark:backdrop-blur-xl">
      <h2 className="text-[18px] font-bold text-slate-900 dark:text-white">{title}</h2>
      <div className="flex flex-wrap gap-2.5">
        {filters.map((filter: string) => {
          const isActive = (activeFilter || "Tất cả") === filter;
          return (
          <button
            key={filter}
            type="button"
            onClick={() => onFilterChange?.(filter)}
            className={`inline-flex items-center gap-2 h-9 px-4 rounded-xl border text-[13px] font-semibold transition-all duration-200 hover:shadow-md ${
              isActive
                ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:border-slate-500"
            }`}
          >
            <Filter size={14} className={isActive ? "opacity-100" : "opacity-70"} />
            {filter}
          </button>
        );})}
      </div>
    </div>
  );
}

function MiniBars({ data, tone }: any) {
  const normalized = data.length ? data : [{ date: "N/A", count: 0 }];
  const max = Math.max(...normalized.map((p: any) => Number(p.count) || 0), 1);
  
  const bgColors = {
    blue: "bg-blue-500",
    emerald: "bg-emerald-500",
    violet: "bg-violet-500",
    teal: "bg-teal-500",
  }[tone as "blue" | "emerald" | "violet" | "teal"];

  return (
    <div className="flex items-end h-[240px] gap-2.5 p-6 overflow-x-auto custom-scrollbar">
      {normalized.slice(-14).map((point: any, index: number) => {
        const height = Math.max(12, Math.round(((Number(point.count) || 0) / max) * 160));
        return (
          <div key={`${point.date}-${index}`} className="flex-1 min-w-[28px] flex flex-col items-center justify-end gap-3 group relative cursor-pointer" title={`${point.date}: ${point.count}`}>
            <div className={`w-full rounded-t-md opacity-80 group-hover:opacity-100 transition-all duration-300 group-hover:-translate-y-1 ${bgColors}`} style={{ height }} />
            <span className="text-[11px] font-medium whitespace-nowrap text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200">{String(point.date).slice(5, 10)}</span>
          </div>
        );
      })}
    </div>
  );
}

function EndpointTable({ rows, resetKey }: { rows: any[]; resetKey?: string }) {
  return (
    <PaginatedDataTable
      resetKey={resetKey}
      headers={["Module", "Cổng kết nối (API)", "Đánh giá", "Mô tả"]}
      rows={rows.map((row: any) => {
        const meta = statusMeta(row.status);
        return [
          <span key="mod" className="font-semibold text-slate-800 dark:text-slate-200">{row.module}</span>,
          <code key="end" className="font-mono text-[12px] px-2 py-1 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{row.endpoint}</code>,
          <span key="st" className={`inline-flex items-center h-6 px-3 rounded-full text-[12px] font-bold border ${meta.className}`}>{meta.label}</span>,
          <span key="nt" className="text-[13px] text-slate-500 dark:text-slate-400">{row.note}</span>,
        ];
      })}
    />
  );
}

function PaginatedDataTable({
  headers,
  rows,
  resetKey,
  columnClasses,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  resetKey?: string | number;
  columnClasses?: string[];
}) {
  const [page, setPage] = useState(1);
  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const safePage = Math.min(page, totalPages);
  const paginatedRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
      <DataTable headers={headers} rows={paginatedRows} columnClasses={columnClasses} />
      <Pagination page={safePage} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
    </>
  );
}

function Pagination({
  page,
  totalPages,
  totalItems,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  const start = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, totalItems);
  const pageNumbers = buildPageNumbers(page, totalPages);

  const pageButtons: React.ReactNode[] = [];
  let prev = 0;
  pageNumbers.forEach((pageNum) => {
    if (prev && pageNum - prev > 1) {
      pageButtons.push(
        <span key={`ellipsis-${pageNum}`} className="px-1.5 text-slate-400 text-sm select-none">
          …
        </span>
      );
    }
    const isActive = pageNum === page;
    pageButtons.push(
      <button
        key={pageNum}
        type="button"
        onClick={() => onPageChange(pageNum)}
        className={`min-w-[36px] h-9 px-2 rounded-lg text-sm font-semibold transition-colors ${
          isActive
            ? "bg-blue-600 text-white shadow-sm"
            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
        }`}
      >
        {pageNum}
      </button>
    );
    prev = pageNum;
  });

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700/80 bg-slate-50/30 dark:bg-slate-800/30">
      <span className="text-[13px] text-slate-500 dark:text-slate-400">
        Hiển thị <strong className="text-slate-700 dark:text-slate-200">{start}–{end}</strong> / {totalItems} mục
        <span className="mx-2 text-slate-300">·</span>
        {PAGE_SIZE} mục/trang
      </span>
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="h-9 px-3 rounded-lg border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
        >
          Trước
        </button>
        {pageButtons}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="h-9 px-3 rounded-lg border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
        >
          Sau
        </button>
      </div>
    </div>
  );
}

function DataTable({
  headers,
  rows,
  columnClasses,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  columnClasses?: string[];
}) {
  return (
    <div className="overflow-x-auto w-full pb-2">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr>
            {headers.map((header: string, i: number) => (
              <th
                key={header + i}
                className={`py-4 px-6 text-[13px] font-bold uppercase tracking-wider border-b text-slate-500 border-slate-100 bg-slate-50/50 dark:text-slate-400 dark:border-slate-700/80 dark:bg-slate-800/30 ${columnClasses?.[i] ?? "whitespace-nowrap"}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: React.ReactNode[], index: number) => (
            <tr key={index} className="transition-colors duration-200 border-b last:border-b-0 border-slate-50 hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-700/20">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`py-3.5 px-6 text-[14px] font-medium text-slate-700 dark:text-slate-200 ${columnClasses?.[cellIndex] ?? "whitespace-nowrap"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CapabilityGrid({ items }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map(([label, text]: string[], index: number) => {
        const isReady = label.includes("Đã") || label.includes("Sẵn sàng") || label.includes("Hoạt động") || label.includes("Toàn diện");
        const dotColor = isReady ? "bg-green-500" : "bg-amber-500";
        return (
          <div key={index} className="flex items-start gap-3 p-4 rounded-2xl border transition-all duration-300 hover:shadow-md bg-white border-slate-200 hover:border-slate-300 dark:bg-[#1e293b]/60 dark:border-slate-700/80 dark:hover:bg-[#1e293b]">
            <div className="mt-1 rounded-full p-0.5 border-2 border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-800">
               <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
            </div>
            <div>
              <div className="text-[14px] font-bold mb-0.5 text-slate-800 dark:text-slate-200">{label}</div>
              <div className="text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{text}</div>
            </div>
          </div>
        )
      })}
    </div>
  );
}

function StatePill({ label }: { label: string }) {
  if (!label) return null;
  const lower = label.toLowerCase();
  const isErr = lower.includes("cần") || lower.includes("locked") || lower.includes("bị") || lower.includes("chưa");
  const isWarn = lower.includes("một") || lower.includes("chờ") || lower.includes("đang");
  
  let styles = "bg-green-100 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-400";
  
  if (isErr) {
    styles = "bg-rose-100 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400";
  } else if (isWarn) {
    styles = "bg-amber-100 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400";
  }

  return <span className={`inline-flex items-center h-6 px-3 rounded-full text-[12px] font-bold border ${styles}`}>{label}</span>;
}

function TypePill({ label }: { label: string }) {
  const styles = label === "GROUP" 
    ? "bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-500/15 dark:border-blue-500/30 dark:text-blue-400" 
    : label === "CLOUD" 
      ? "bg-purple-100 border-purple-200 text-purple-700 dark:bg-purple-500/15 dark:border-purple-500/30 dark:text-purple-400" 
      : "bg-sky-100 border-sky-200 text-sky-700 dark:bg-sky-500/15 dark:border-sky-500/30 dark:text-sky-400";
  return <span className={`inline-flex items-center h-6 px-3 rounded-full text-[12px] font-bold border tracking-wider ${styles}`}>{label}</span>;
}
