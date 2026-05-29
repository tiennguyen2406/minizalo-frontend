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
  { module: "Dashboard", endpoint: "GET /api/analytics/overview", status: "ready", note: "Tổng user" },
  { module: "Dashboard", endpoint: "GET /api/analytics/messages", status: "ready", note: "Tin nhắn theo ngày" },
  { module: "Dashboard", endpoint: "GET /api/analytics/users/active", status: "ready", note: "Active users" },
  { module: "User", endpoint: "GET /api/admin/users", status: "ready", note: "Danh sách toàn hệ thống" },
  { module: "Chat room", endpoint: "GET /api/admin/rooms", status: "ready", note: "Danh sách phòng" },
  { module: "Audit", endpoint: "GET /api/admin/audit-logs", status: "ready", note: "Ghi log thao tác" },
];

function formatNumber(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0";
  return new Intl.NumberFormat("vi-VN").format(value);
}

function statusMeta(status: ApiStatus) {
  if (status === "ready") return { label: "Sẵn sàng", className: "bg-green-100 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-400" };
  if (status === "partial") return { label: "Một phần", className: "bg-amber-100 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400" };
  return { label: "Thiếu API", className: "bg-rose-100 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400" };
}

export default function AdminDashboardWeb() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [activeSection, setActiveSection] = useState<AdminSectionId>("dashboard");
  const [overview, setOverview] = useState<OverviewStats>({});
  const [messageStats, setMessageStats] = useState<MessageStats>({});
  const [activeStats, setActiveStats] = useState<ActiveUserStats>({});
  const [users, setUsers] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [range, setRange] = useState("30");
  const [selectedRoomId, setSelectedRoomId] = useState("");

  const sinceIso = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - Number(range));
    return date.toISOString().slice(0, 19);
  }, [range]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, messagesRes, activeRes, usersRes, roomsRes, auditsRes] = await Promise.all([
        api.get<OverviewStats>("/analytics/overview"),
        api.get<MessageStats>("/analytics/messages", { params: { since: sinceIso } }),
        api.get<ActiveUserStats>("/analytics/users/active", { params: { limit: 10 } }),
        api.get("/admin/users").catch(() => ({ data: [] })),
        api.get("/admin/rooms").catch(() => ({ data: [] })),
        api.get("/admin/audit-logs").catch(() => ({ data: [] })),
      ]);
      setOverview(overviewRes.data || {});
      setMessageStats(messagesRes.data || {});
      setActiveStats(activeRes.data || {});
      setUsers(usersRes.data || []);
      setRooms(roomsRes.data || []);
      setAudits(auditsRes.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAnalytics();
  }, [sinceIso]);

  if (Platform.OS !== "web") return null;

  const filteredEndpoints = endpointRows.filter((row) => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return true;
    return `${row.module} ${row.endpoint} ${row.note}`.toLowerCase().includes(keyword);
  });

  return (
    <AuthGuard mode="requireAuth" allowedRoles={["ROLE_ADMIN"]}>
      <div className="h-screen w-screen flex overflow-hidden font-sans transition-colors duration-300 bg-[#f4f7fb] text-slate-900 dark:bg-[#0b1120] dark:text-gray-100">
        
        {/* Sidebar */}
        <aside className="w-[260px] min-w-[260px] flex flex-col p-5 gap-6 backdrop-blur-xl border-r transition-colors duration-300 z-10 bg-white/80 border-slate-200/50 dark:bg-[#111827]/80 dark:border-white/5">
          <button 
            type="button" 
            onClick={() => router.push("/(tabs)")}
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
                    placeholder="Tìm kiếm..."
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
              {activeSection === "dashboard" && <DashboardSection loading={loading} overview={overview} messageStats={messageStats} activeStats={activeStats} />}
              {activeSection === "users" && <UsersSection users={users} loading={loading} />}
              {activeSection === "conversations" && <ConversationsSection rooms={rooms} loading={loading} setActiveSection={setActiveSection} setSelectedRoomId={setSelectedRoomId} />}
              {activeSection === "messages" && <MessagesSection roomId={selectedRoomId} setRoomId={setSelectedRoomId} />}
              {activeSection === "media" && <MediaSection />}
              {activeSection === "groups" && <GroupsSection rooms={rooms} loading={loading} />}
              {activeSection === "moderation" && <ModerationSection />}
              {activeSection === "reports" && <ReportsSection messageStats={messageStats} activeStats={activeStats} endpoints={filteredEndpoints} />}
              {activeSection === "audit" && <AuditSection audits={audits} loading={loading} />}
              {activeSection === "admins" && <AdminsSection currentUser={user?.username || user?.fullName || "Admin"} />}
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

function DashboardSection({ loading, overview, messageStats, activeStats }: any) {
  const totalMessages = messageStats.totalMessages || 0;
  const activeUsers = activeStats.currentActiveUsers || 0;
  const dailyMessages = messageStats.dailyVolume || [];
  const dailyActive = activeStats.dailyActiveUsers || [];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <Metric title="Tổng người dùng" value={formatNumber(overview.totalUsers)} tone="blue" detail="Tăng trưởng định kỳ" />
        <Metric title="Tin nhắn gửi đi" value={formatNumber(totalMessages)} tone="indigo" detail="Hoạt động gần đây" />
        <Metric title="Người dùng Online" value={formatNumber(activeUsers)} tone="emerald" detail="Trong 24 giờ qua" />
        <Metric title="API Kết nối" value="6/10" tone="rose" detail="Trạng thái tích hợp" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Biểu đồ tin nhắn" action={loading ? "Đang tải" : `${dailyMessages.length} ngày`}>
          <MiniBars data={dailyMessages} tone="blue" />
        </Panel>
        <Panel title="Hoạt động người dùng" action={loading ? "Đang tải" : `${dailyActive.length} ngày`}>
          <MiniBars data={dailyActive} tone="emerald" />
        </Panel>
      </div>

      <Panel title="Tình trạng API Backend (MVP)" action="Kiểm tra hệ thống">
        <EndpointTable rows={endpointRows} />
      </Panel>
    </div>
  );
}

function UsersSection({ users, loading }: any) {
  return (
    <div className="flex flex-col gap-6">
      <Toolbar title="Quản lý người dùng" filters={["Tất cả", "ROLE_USER", "Bị khóa"]} />
      <Panel title="Danh sách tài khoản" action={loading ? "Đang tải..." : `${users.length} tài khoản`}>
        <DataTable
          headers={["ID", "Tên đăng nhập", "Email", "Quyền", "Trạng thái", "Tin nhắn", ""]}
          rows={users.map((u: any) => [
            <span key="id" className="text-slate-500 dark:text-slate-400 text-xs font-mono">{u.id?.slice(0, 8)}...</span>,
            <strong key="n" className="text-slate-800 dark:text-slate-200">{u.name}</strong>,
            u.email,
            <span key="r" className="font-semibold text-blue-600 dark:text-blue-400 text-[12px]">{u.role}</span>,
            <StatePill key="state" label={u.state} />,
            formatNumber(u.messages),
            <button key="more" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 dark:text-slate-400 dark:hover:bg-white/10"><MoreHorizontal size={18} /></button>
          ])}
        />
      </Panel>
    </div>
  );
}

function ConversationsSection({ rooms, loading, setActiveSection, setSelectedRoomId }: any) {
  return (
    <div className="flex flex-col gap-6">
      <Toolbar title="Giám sát phòng chat" filters={["Cá nhân", "Nhóm", "Cloud"]} />
      <Panel title="Danh sách phòng hiện tại" action={loading ? "Đang tải..." : `${rooms.length} phòng`}>
        <DataTable
          headers={["Mã phòng", "Tên", "Phân loại", "Số lượng", "Tương tác", "Lần cuối", ""]}
          rows={rooms.map((room: any) => [
            <span key="id" className="text-slate-500 dark:text-slate-400 text-xs font-mono">{room.id?.slice(0, 8)}...</span>,
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
      </Panel>
    </div>
  );
}

function MessagesSection({ roomId, setRoomId }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputRoom, setInputRoom] = useState(roomId || "");
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = async (targetId: string) => {
    if (!targetId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/admin/messages/${targetId}`);
      setMessages(res.data || []);
      setRoomId(targetId);
    } catch (err: any) {
      setError(err.response?.data?.message || "Không tìm thấy phòng hoặc lỗi máy chủ");
      setMessages([]);
    } finally {
      setLoading(false);
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
      <Toolbar title="Quản trị nội dung" filters={["Tin nhắn text", "Hình ảnh", "Tệp tin"]} />
      
      <div className="flex items-center gap-3">
        <input 
          type="text" 
          value={inputRoom}
          onChange={(e) => setInputRoom(e.target.value)}
          placeholder="Nhập Room ID để xem tin nhắn..."
          className="flex-1 h-11 px-4 rounded-xl border bg-white border-slate-200 text-[14px] shadow-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:bg-[#1e293b] dark:border-slate-700 dark:text-white"
        />
        <button 
          onClick={() => fetchMessages(inputRoom)}
          disabled={loading}
          className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-[14px] transition-colors shadow-sm shadow-blue-500/20 disabled:opacity-50"
        >
          {loading ? "Đang tìm..." : "Tìm kiếm"}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 text-red-600 border border-red-200 text-[14px] dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400">
          {error}
        </div>
      )}

      <Panel title={`Luồng tin nhắn (Phòng: ${roomId || "Trống"})`} action="Nền tảng DynamoDB">
        {messages.length === 0 && !loading && !error && (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            Hãy nhập Room ID để tải danh sách tin nhắn.
          </div>
        )}
        
        {messages.length > 0 && (
          <DataTable
            headers={["Mã TN", "Người gửi", "Loại", "Nội dung", "Thời gian"]}
            rows={messages.map((msg: any) => [
              <span key="id" className="text-slate-500 dark:text-slate-400 text-xs font-mono">{msg.messageId?.slice(0, 8)}...</span>,
              <strong key="sender" className="text-slate-800 dark:text-slate-200">{msg.senderName || msg.senderId}</strong>,
              <TypePill key="type" label={msg.type} />,
              <div key="content" className="max-w-xs truncate" title={msg.content}>{msg.content || "(Đính kèm/File)"}</div>,
              <span key="time" className="text-slate-500 dark:text-slate-400 text-xs">{msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ""}</span>
            ])}
          />
        )}
      </Panel>
    </div>
  );
}

function MediaSection() {
  return (
    <div className="flex flex-col gap-6">
      <Toolbar title="Lưu trữ & Tệp đính kèm" filters={["Hình ảnh", "Video", "Tài liệu"]} />
      <Panel title="Cấu hình MinIO" action="Thông tin kết nối">
        <DataTable
          headers={["Tính năng", "Đầu cuối", "Định dạng", "Dung lượng", "Trạng thái"]}
          rows={[
            ["Tải lên Tệp", "POST /api/files/upload", "Multipart", "Không giới hạn", <StatePill key="s" label="Sẵn sàng" />],
            ["Đổi Ảnh đại diện", "PUT /api/users/avatar", "JPG/PNG", "Dưới 5MB", <StatePill key="s" label="Sẵn sàng" />],
            ["URL Sinh tự động", "POST /presigned", "Đối tượng", "Theo token", <StatePill key="s" label="Sẵn sàng" />],
          ]}
        />
      </Panel>
    </div>
  );
}

function GroupsSection({ rooms, loading }: any) {
  const groups = rooms.filter((r: any) => r.type === "GROUP");
  return (
    <div className="flex flex-col gap-6">
      <Toolbar title="Tổ chức & Cộng đồng" filters={["Công khai", "Kín", "Có Link"] } />
      <Panel title="Danh bạ Nhóm" action={loading ? "Đang tải..." : `${groups.length} Nhóm`}>
        <DataTable
          headers={["Tên nhóm", "Thành viên", "Tin nhắn", "Lần cuối", "Tương tác API"]}
          rows={groups.map((room: any) => [
            <strong key="n" className="text-slate-800 dark:text-slate-200">{room.name}</strong>,
            room.members,
            room.messages,
            <span key="t" className="text-slate-500 dark:text-slate-400 text-xs">{room.updatedAt?.slice(0, 10)}</span>,
            "Cấp quyền Admin"
          ])}
        />
      </Panel>
    </div>
  );
}

function ModerationSection() {
  return (
    <div className="flex flex-col gap-6">
      <Toolbar title="An ninh & Báo cáo" filters={["Đang chờ xử lý", "Nguy cơ cao", "Đã khóa"]} />
      <Panel title="Hàng đợi Kiểm Duyệt" action="Workflow xử lý">
        <DataTable
          headers={["Phân loại", "Định danh", "Biện pháp bảo vệ", "Nghiệp vụ yêu cầu"]}
          rows={[
            ["Tin nhắn xấu", "MSG-201", "Chức năng thu hồi cá nhân", "Phím tắt xóa quyền Admin"],
            ["Spammer", "USR-003", "Báo xấu & Cắt kết bạn", "Cấm vĩnh viễn IP/Tài khoản"],
            ["Nhóm rác", "ROOM-101", "Chặn mời vào nhóm", "Giải tán nhóm hàng loạt"],
          ]}
        />
      </Panel>
    </div>
  );
}

function ReportsSection({ messageStats, activeStats, endpoints }: any) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Lưu lượng Truyền tải" action="GET /messages">
          <MiniBars data={messageStats.dailyVolume || []} tone="violet" />
        </Panel>
        <Panel title="Chỉ số Năng động" action="GET /active">
          <MiniBars data={activeStats.dailyActiveUsers || []} tone="teal" />
        </Panel>
      </div>
      <Panel title="Danh sách Cổng kết nối API" action={`${endpoints.length} Routes`}>
        <EndpointTable rows={endpoints} />
      </Panel>
    </div>
  );
}

function AuditSection({ audits, loading }: any) {
  return (
    <div className="flex flex-col gap-6">
      <Toolbar title="Nhật ký Hệ thống (Audit)" filters={["Hôm nay", "Cảnh báo", "Truy cập"]} />
      <Panel title="Dấu vết Thao tác" action={loading ? "Đang tải..." : `${audits.length} bản ghi`}>
        <DataTable
          headers={["Thời điểm", "Thực thi bởi", "Hành động", "Mục tiêu", "Hậu quả"]}
          rows={audits.map((row: any, i: number) => [
            <span key="t" className="text-slate-500 dark:text-slate-400 text-[12px]">{row.time?.slice(0, 19).replace('T', ' ')}</span>,
            <span key="actor" className="font-mono text-[13px] font-bold text-blue-600 dark:text-blue-400">{row.actor}</span>, 
            <span key="act" className="font-semibold text-slate-800 dark:text-slate-200">{row.action}</span>,
            <code key="tgt" className="px-2 py-0.5 rounded text-[12px] bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border dark:border-slate-700">{row.target}</code>, 
            <StatePill key="s" label={row.status} />
          ])}
        />
      </Panel>
    </div>
  );
}

function AdminsSection({ currentUser }: { currentUser: string }) {
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
      const res = await api.post("/admin/grant-role", { phone, role });
      setMessage({ type: "success", text: res.data?.message || "Cấp quyền thành công" });
      setPhone("");
    } catch (err: any) {
      setMessage({ type: "error", text: err?.response?.data?.message || err?.message || "Lỗi khi cấp quyền" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Toolbar title="Cấu hình Phân Quyền" filters={["Tất cả", "ROLE_ADMIN"]} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Danh sách Vai trò Hệ thống" action={`Bạn là: ${currentUser}`}>
          <DataTable
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

function Toolbar({ title, filters }: any) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl border shadow-sm bg-white border-slate-200 dark:bg-[#1e293b]/80 dark:border-slate-700/80 dark:backdrop-blur-xl">
      <h2 className="text-[18px] font-bold text-slate-900 dark:text-white">{title}</h2>
      <div className="flex flex-wrap gap-2.5">
        {filters.map((filter: string) => (
          <button key={filter} type="button" className="inline-flex items-center gap-2 h-9 px-4 rounded-xl border text-[13px] font-semibold transition-all duration-200 hover:shadow-md bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:border-slate-500">
            <Filter size={14} className="opacity-70" />
            {filter}
          </button>
        ))}
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

function EndpointTable({ rows }: any) {
  return (
    <DataTable
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

function DataTable({ headers, rows }: any) {
  return (
    <div className="overflow-x-auto w-full pb-2">
      <table className="w-full text-left border-collapse whitespace-nowrap">
        <thead>
          <tr>
            {headers.map((header: string, i: number) => (
              <th key={header + i} className="py-4 px-6 text-[13px] font-bold uppercase tracking-wider border-b text-slate-500 border-slate-100 bg-slate-50/50 dark:text-slate-400 dark:border-slate-700/80 dark:bg-slate-800/30">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: React.ReactNode[], index: number) => (
            <tr key={index} className="transition-colors duration-200 border-b last:border-b-0 border-slate-50 hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-700/20">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="py-3.5 px-6 text-[14px] font-medium text-slate-700 dark:text-slate-200">
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
