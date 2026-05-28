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

type DailyPoint = {
  date: string;
  count: number;
};

type OverviewStats = {
  totalUsers?: number;
  since?: string;
};

type MessageStats = {
  totalMessages?: number;
  dailyVolume?: DailyPoint[];
};

type ActiveUserStats = {
  currentActiveUsers?: number;
  dailyActiveUsers?: DailyPoint[];
};

type ApiStatus = "ready" | "partial" | "missing";

type AdminSectionId =
  | "dashboard"
  | "users"
  | "conversations"
  | "messages"
  | "media"
  | "groups"
  | "moderation"
  | "reports"
  | "audit"
  | "admins";

const sections: {
  id: AdminSectionId;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}[] = [
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

const endpointRows: {
  module: string;
  endpoint: string;
  status: ApiStatus;
  note: string;
}[] = [
  { module: "Dashboard", endpoint: "GET /api/analytics/overview", status: "ready", note: "Tổng user" },
  { module: "Dashboard", endpoint: "GET /api/analytics/messages", status: "ready", note: "Tin nhắn theo ngày" },
  { module: "Dashboard", endpoint: "GET /api/analytics/users/active", status: "ready", note: "Active users" },
  { module: "User", endpoint: "GET /api/users/search?q=", status: "partial", note: "Tìm user, chưa có list toàn hệ thống" },
  { module: "Chat room", endpoint: "GET /api/chat/rooms", status: "partial", note: "Room của user hiện tại" },
  { module: "Message", endpoint: "GET /api/chat/{roomId}/search", status: "partial", note: "Tìm trong room cụ thể" },
  { module: "Media", endpoint: "POST /api/files/upload", status: "partial", note: "Upload, chưa có media catalog" },
  { module: "Group", endpoint: "GET /api/group/my-groups", status: "partial", note: "Nhóm của user hiện tại" },
  { module: "Audit", endpoint: "GET /api/admin/audit-logs", status: "missing", note: "Cần bổ sung backend" },
  { module: "Admin", endpoint: "GET /api/admin/admins", status: "missing", note: "Cần bổ sung backend" },
];

const sampleUsers = [
  { id: "USR-001", name: "nguyen.an", email: "an@example.com", role: "ROLE_USER", state: "Online", messages: 128 },
  { id: "USR-002", name: "tran.binh", email: "binh@example.com", role: "ROLE_ADMIN", state: "Active", messages: 96 },
  { id: "USR-003", name: "le.chi", email: "chi@example.com", role: "ROLE_MODERATOR", state: "Locked", messages: 42 },
];

const sampleRooms = [
  { id: "ROOM-101", name: "Dev Team", type: "GROUP", members: 12, messages: 824, updatedAt: "Hôm nay" },
  { id: "ROOM-102", name: "Cloud của tôi", type: "CLOUD", members: 1, messages: 155, updatedAt: "Hôm qua" },
  { id: "ROOM-103", name: "Minh Anh", type: "DIRECT", members: 2, messages: 91, updatedAt: "2 ngày trước" },
];

const sampleAudit = [
  { time: "09:15", actor: "admin", action: "LOCK_USER", target: "USR-003", status: "Cần API" },
  { time: "10:40", actor: "moderator", action: "HIDE_MESSAGE", target: "MSG-201", status: "Cần API" },
  { time: "11:05", actor: "admin", action: "UPDATE_ROLE", target: "USR-002", status: "Cần API" },
];

function formatNumber(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0";
  return new Intl.NumberFormat("vi-VN").format(value);
}

function statusMeta(status: ApiStatus) {
  if (status === "ready") return { label: "Sẵn sàng", color: "#15803d", bg: "#dcfce7" };
  if (status === "partial") return { label: "Một phần", color: "#a16207", bg: "#fef3c7" };
  return { label: "Thiếu API", color: "#b91c1c", bg: "#fee2e2" };
}

export default function AdminDashboardWeb() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [activeSection, setActiveSection] = useState<AdminSectionId>("dashboard");
  const [overview, setOverview] = useState<OverviewStats>({});
  const [messageStats, setMessageStats] = useState<MessageStats>({});
  const [activeStats, setActiveStats] = useState<ActiveUserStats>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [range, setRange] = useState("30");

  const sinceIso = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - Number(range));
    return date.toISOString().slice(0, 19);
  }, [range]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, messagesRes, activeRes] = await Promise.all([
        api.get<OverviewStats>("/analytics/overview"),
        api.get<MessageStats>("/analytics/messages", { params: { since: sinceIso } }),
        api.get<ActiveUserStats>("/analytics/users/active", { params: { limit: 10 } }),
      ]);
      setOverview(overviewRes.data || {});
      setMessageStats(messagesRes.data || {});
      setActiveStats(activeRes.data || {});
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Không tải được dữ liệu analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAnalytics();
  }, [sinceIso]);

  if (Platform.OS !== "web") {
    return null;
  }

  const filteredEndpoints = endpointRows.filter((row) => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return true;
    return `${row.module} ${row.endpoint} ${row.note}`.toLowerCase().includes(keyword);
  });

  return (
    <AuthGuard mode="requireAuth">
      <div style={styles.shell}>
        <aside style={styles.sidebar}>
          <button style={styles.brandButton} type="button" onClick={() => router.push("/(tabs)")}>
            <ShieldCheck size={24} />
            <span style={styles.brandText}>MiniZalo Admin</span>
          </button>

          <nav style={styles.nav}>
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  title={section.label}
                  style={{ ...styles.navButton, ...(isActive ? styles.navButtonActive : null) }}
                  onClick={() => setActiveSection(section.id)}
                >
                  <Icon size={18} strokeWidth={2.2} />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main style={styles.main}>
          <header style={styles.header}>
            <div>
              <div style={styles.kicker}>Quản trị hệ thống nhắn tin</div>
              <h1 style={styles.title}>{sections.find((item) => item.id === activeSection)?.label}</h1>
            </div>

            <div style={styles.headerActions}>
              <div style={styles.searchBox}>
                <Search size={16} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm module, API, trạng thái"
                  style={styles.searchInput}
                />
              </div>
              <select value={range} onChange={(event) => setRange(event.target.value)} style={styles.select}>
                <option value="7">7 ngày</option>
                <option value="30">30 ngày</option>
                <option value="90">90 ngày</option>
              </select>
              <button type="button" title="Làm mới" style={styles.iconButton} onClick={loadAnalytics}>
                <RefreshCw size={17} />
              </button>
            </div>
          </header>

          {error && <div style={styles.errorBanner}>{error}</div>}

          {activeSection === "dashboard" && (
            <DashboardSection
              loading={loading}
              overview={overview}
              messageStats={messageStats}
              activeStats={activeStats}
            />
          )}
          {activeSection === "users" && <UsersSection />}
          {activeSection === "conversations" && <ConversationsSection />}
          {activeSection === "messages" && <MessagesSection />}
          {activeSection === "media" && <MediaSection />}
          {activeSection === "groups" && <GroupsSection />}
          {activeSection === "moderation" && <ModerationSection />}
          {activeSection === "reports" && (
            <ReportsSection messageStats={messageStats} activeStats={activeStats} endpoints={filteredEndpoints} />
          )}
          {activeSection === "audit" && <AuditSection />}
          {activeSection === "admins" && <AdminsSection currentUser={user?.username || user?.fullName || "Admin"} />}
        </main>
      </div>
    </AuthGuard>
  );
}

function DashboardSection({
  loading,
  overview,
  messageStats,
  activeStats,
}: {
  loading: boolean;
  overview: OverviewStats;
  messageStats: MessageStats;
  activeStats: ActiveUserStats;
}) {
  const totalMessages = messageStats.totalMessages || 0;
  const activeUsers = activeStats.currentActiveUsers || 0;
  const dailyMessages = messageStats.dailyVolume || [];
  const dailyActive = activeStats.dailyActiveUsers || [];

  return (
    <section style={styles.content}>
      <div style={styles.metricGrid}>
        <Metric title="Tổng người dùng" value={formatNumber(overview.totalUsers)} tone="blue" detail="GET /analytics/overview" />
        <Metric title="Tin nhắn trong kỳ" value={formatNumber(totalMessages)} tone="green" detail="MESSAGE_SENT activity" />
        <Metric title="Active users" value={formatNumber(activeUsers)} tone="amber" detail="24 giờ gần nhất" />
        <Metric title="API sẵn sàng" value="3/10" tone="red" detail="Theo guide admin" />
      </div>

      <div style={styles.twoColumns}>
        <Panel title="Tin nhắn theo ngày" action={loading ? "Đang tải" : `${dailyMessages.length} mốc`}>
          <MiniBars data={dailyMessages} color="#2563eb" />
        </Panel>
        <Panel title="Người dùng hoạt động" action={loading ? "Đang tải" : `${dailyActive.length} mốc`}>
          <MiniBars data={dailyActive} color="#16a34a" />
        </Panel>
      </div>

      <Panel title="Trạng thái API theo backend hiện tại" action="MVP">
        <EndpointTable rows={endpointRows} />
      </Panel>
    </section>
  );
}

function UsersSection() {
  return (
    <section style={styles.content}>
      <Toolbar title="Quản lý người dùng" filters={["Role", "Trạng thái", "Ngày tạo"]} />
      <Panel title="Danh sách người dùng" action="Cần GET /api/admin/users">
        <DataTable
          headers={["ID", "Username", "Email", "Role", "Trạng thái", "Tin nhắn", ""]}
          rows={sampleUsers.map((user) => [
            user.id,
            user.name,
            user.email,
            user.role,
            <StatePill key="state" label={user.state} />,
            formatNumber(user.messages),
            <MoreHorizontal key="more" size={18} />,
          ])}
        />
      </Panel>
      <CapabilityGrid
        items={[
          ["Dùng được", "Tìm user bằng GET /api/users/search?q=..."],
          ["Dùng được", "Xem profile bằng GET /api/users/profile/{userId}"],
          ["Cần API", "Danh sách toàn hệ thống, phân trang, khóa/mở khóa, đổi role"],
        ]}
      />
    </section>
  );
}

function ConversationsSection() {
  return (
    <section style={styles.content}>
      <Toolbar title="Quản lý cuộc trò chuyện" filters={["DIRECT", "GROUP", "CLOUD"]} />
      <Panel title="Cuộc trò chuyện" action="Dữ liệu mẫu">
        <DataTable
          headers={["ID", "Tên", "Loại", "Thành viên", "Tin nhắn", "Cập nhật", ""]}
          rows={sampleRooms.map((room) => [
            room.id,
            room.name,
            <TypePill key="type" label={room.type} />,
            room.members,
            formatNumber(room.messages),
            room.updatedAt,
            <MoreHorizontal key="more" size={18} />,
          ])}
        />
      </Panel>
      <CapabilityGrid
        items={[
          ["Một phần", "GET /api/chat/rooms chỉ trả room của user hiện tại"],
          ["Một phần", "GET /api/chat/history/{roomId} xem lịch sử theo room"],
          ["Cần API", "GET /api/admin/chat/rooms để xem toàn hệ thống"],
        ]}
      />
    </section>
  );
}

function MessagesSection() {
  return (
    <section style={styles.content}>
      <Toolbar title="Quản lý tin nhắn" filters={["Room", "Người gửi", "Khoảng ngày", "Loại tin"]} />
      <Panel title="Luồng tin nhắn & kiểm duyệt" action="Dựa trên MessageDynamo">
        <DataTable
          headers={["Room", "Message", "Sender", "Loại", "Trạng thái", "API"]}
          rows={[
            ["ROOM-101", "MSG-001", "nguyen.an", "TEXT", <StatePill key="s" label="Pinned" />, "GET /api/chat/{roomId}/pins"],
            ["ROOM-102", "MSG-002", "tran.binh", "IMAGE", <StatePill key="s" label="Recalled" />, "POST /api/messages/recall"],
            ["ROOM-103", "MSG-003", "le.chi", "FILE", <StatePill key="s" label="Cloud" />, "DELETE /api/messages/cloud/..."],
          ]}
        />
      </Panel>
      <CapabilityGrid
        items={[
          ["Dùng được", "Tìm trong room: GET /api/chat/{roomId}/search"],
          ["Dùng được", "Tìm toàn cục theo user hiện tại: GET /api/messages/search"],
          ["Cần API", "Ẩn/xóa tin nhắn vi phạm bởi admin và report queue"],
        ]}
      />
    </section>
  );
}

function MediaSection() {
  return (
    <section style={styles.content}>
      <Toolbar title="Quản lý tệp & media" filters={["Ảnh", "Video", "Tài liệu", "Dung lượng"]} />
      <Panel title="Tệp & media" action="Cần media metadata">
        <DataTable
          headers={["Nguồn", "API", "Loại", "Giới hạn", "Trạng thái"]}
          rows={[
            ["Upload file", "POST /api/files/upload", "multipart", "Theo MinIO", <StatePill key="s" label="Sẵn sàng" />],
            ["Avatar", "PUT /api/users/avatar", "JPEG/PNG/GIF", "5MB", <StatePill key="s" label="Sẵn sàng" />],
            ["Presigned URL", "POST /api/media/presigned-url", "object", "Theo request", <StatePill key="s" label="Sẵn sàng" />],
          ]}
        />
      </Panel>
      <CapabilityGrid
        items={[
          ["Dùng được", "Upload file và tạo presigned URL"],
          ["Một phần", "Attachment nằm trong MessageDynamo"],
          ["Cần API", "Catalog media toàn hệ thống và thống kê storage"],
        ]}
      />
    </section>
  );
}

function GroupsSection() {
  return (
    <section style={styles.content}>
      <Toolbar title="Quản lý nhóm & kênh" filters={["Role", "Cài đặt", "Link tham gia"]} />
      <Panel title="Nhóm chat" action="Kênh chưa có backend">
        <DataTable
          headers={["Nhóm", "Thành viên", "Tin nhắn", "Cài đặt", "API"]}
          rows={[
            ["Dev Team", 12, 824, "allowMemberSendMessage", "GET /api/group/{groupId}/settings"],
            ["Đồ án CNM", 5, 231, "allowJoinByLink", "POST /api/group/{groupId}/refresh-link"],
            ["Thông báo lớp", 38, 129, "requireApproval", "PUT /api/group/settings"],
          ]}
        />
      </Panel>
      <CapabilityGrid
        items={[
          ["Dùng được", "Tạo nhóm, thêm/xóa thành viên, đổi role, chuyển quyền"],
          ["Dùng được", "Chặn thành viên, xem blocked list, group events"],
          ["Cần API", "Danh sách nhóm toàn hệ thống cho admin"],
        ]}
      />
    </section>
  );
}

function ModerationSection() {
  return (
    <section style={styles.content}>
      <Toolbar title="Kiểm duyệt & bảo mật" filters={["Tin nhắn", "User", "Nhóm", "Rủi ro"]} />
      <Panel title="Hàng đợi kiểm duyệt" action="Cần report workflow">
        <DataTable
          headers={["Loại", "Đối tượng", "Hành động hiện có", "Cần bổ sung"]}
          rows={[
            ["Tin nhắn", "MSG-201", "Recall, delete Cloud", "Ẩn/xóa bởi admin"],
            ["Người dùng", "USR-003", "Tự khóa tài khoản", "Ban/unban bởi admin"],
            ["Nhóm", "ROOM-101", "Block member, disband", "Moderation report"],
          ]}
        />
      </Panel>
      <CapabilityGrid
        items={[
          ["Dùng được", "JWT, BCrypt, refresh token, WebSocket auth"],
          ["Dùng được", "Block friend và block member trong group"],
          ["Cần API", "Report, warning, rate limit, admin login events"],
        ]}
      />
    </section>
  );
}

function ReportsSection({
  messageStats,
  activeStats,
  endpoints,
}: {
  messageStats: MessageStats;
  activeStats: ActiveUserStats;
  endpoints: typeof endpointRows;
}) {
  return (
    <section style={styles.content}>
      <div style={styles.twoColumns}>
        <Panel title="Message volume" action="GET /analytics/messages">
          <MiniBars data={messageStats.dailyVolume || []} color="#7c3aed" />
        </Panel>
        <Panel title="Daily active users" action="GET /analytics/users/active">
          <MiniBars data={activeStats.dailyActiveUsers || []} color="#0f766e" />
        </Panel>
      </div>
      <Panel title="Ma trận API" action={`${endpoints.length} dòng`}>
        <EndpointTable rows={endpoints} />
      </Panel>
    </section>
  );
}

function AuditSection() {
  return (
    <section style={styles.content}>
      <Toolbar title="Audit log" filters={["Admin", "Action", "Target", "Status"]} />
      <Panel title="Nhật ký quản trị" action="Cần AdminAuditLog">
        <DataTable
          headers={["Thời gian", "Actor", "Action", "Target", "Trạng thái"]}
          rows={sampleAudit.map((row) => [row.time, row.actor, row.action, row.target, <StatePill key="s" label={row.status} />])}
        />
      </Panel>
      <CapabilityGrid
        items={[
          ["Một phần", "UserActivity đang ghi activityType, details, timestamp"],
          ["Cần API", "AdminAuditLog với beforeData, afterData, IP, user agent"],
          ["Cần API", "Export audit log CSV/JSON"],
        ]}
      />
    </section>
  );
}

function AdminsSection({ currentUser }: { currentUser: string }) {
  return (
    <section style={styles.content}>
      <Toolbar title="Quản lý admin & quyền hạn" filters={["ROLE_USER", "ROLE_MODERATOR", "ROLE_ADMIN"]} />
      <Panel title="Role hiện có" action={currentUser}>
        <DataTable
          headers={["Role", "Phạm vi", "Trạng thái backend"]}
          rows={[
            ["ROLE_USER", "Chat, friend, group, post, story", <StatePill key="s" label="Sẵn sàng" />],
            ["ROLE_MODERATOR", "Dành cho kiểm duyệt sau này", <StatePill key="s" label="Một phần" />],
            ["ROLE_ADMIN", "Quản trị tổng quát", <StatePill key="s" label="Cần /api/admin" />],
          ]}
        />
      </Panel>
      <CapabilityGrid
        items={[
          ["Dùng được", "Role lưu trong bảng roles và user_roles"],
          ["Cần API", "Danh sách admin, cấp/thu hồi role"],
          ["Cần API", "Permission chi tiết và audit cho hành động nhạy cảm"],
        ]}
      />
    </section>
  );
}

function Metric({ title, value, detail, tone }: { title: string; value: string; detail: string; tone: "blue" | "green" | "amber" | "red" }) {
  const colors = {
    blue: ["#eff6ff", "#1d4ed8"],
    green: ["#ecfdf5", "#047857"],
    amber: ["#fffbeb", "#b45309"],
    red: ["#fef2f2", "#b91c1c"],
  }[tone];
  return (
    <div style={styles.metric}>
      <div style={{ ...styles.metricIcon, background: colors[0], color: colors[1] }}>
        <Activity size={18} />
      </div>
      <div style={styles.metricTitle}>{title}</div>
      <div style={styles.metricValue}>{value}</div>
      <div style={styles.metricDetail}>{detail}</div>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <h2 style={styles.panelTitle}>{title}</h2>
        {action && <span style={styles.panelAction}>{action}</span>}
      </div>
      {children}
    </div>
  );
}

function Toolbar({ title, filters }: { title: string; filters: string[] }) {
  return (
    <div style={styles.toolbar}>
      <h2 style={styles.toolbarTitle}>{title}</h2>
      <div style={styles.filterGroup}>
        {filters.map((filter) => (
          <button key={filter} type="button" style={styles.filterButton}>
            <Filter size={14} />
            {filter}
          </button>
        ))}
      </div>
    </div>
  );
}

function MiniBars({ data, color }: { data: DailyPoint[]; color: string }) {
  const normalized = data.length ? data : [{ date: "N/A", count: 0 }];
  const max = Math.max(...normalized.map((point) => Number(point.count) || 0), 1);
  return (
    <div style={styles.chart}>
      {normalized.slice(-14).map((point, index) => {
        const height = Math.max(8, Math.round(((Number(point.count) || 0) / max) * 150));
        return (
          <div key={`${point.date}-${index}`} style={styles.barColumn} title={`${point.date}: ${point.count}`}>
            <div style={{ ...styles.bar, height, background: color }} />
            <span style={styles.barLabel}>{String(point.date).slice(5, 10)}</span>
          </div>
        );
      })}
    </div>
  );
}

function EndpointTable({ rows }: { rows: typeof endpointRows }) {
  return (
    <DataTable
      headers={["Module", "Endpoint", "Trạng thái", "Ghi chú"]}
      rows={rows.map((row) => {
        const meta = statusMeta(row.status);
        return [
          row.module,
          <code key="endpoint" style={styles.code}>{row.endpoint}</code>,
          <span key="status" style={{ ...styles.status, color: meta.color, background: meta.bg }}>{meta.label}</span>,
          row.note,
        ];
      })}
    />
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} style={styles.th}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} style={styles.tr}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} style={styles.td}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CapabilityGrid({ items }: { items: [string, string][] }) {
  return (
    <div style={styles.capabilityGrid}>
      {items.map(([label, text]) => (
        <div key={`${label}-${text}`} style={styles.capability}>
          <CheckCircle2 size={16} />
          <strong>{label}</strong>
          <span>{text}</span>
        </div>
      ))}
    </div>
  );
}

function StatePill({ label }: { label: string }) {
  const lower = label.toLowerCase();
  const bg = lower.includes("cần") || lower.includes("locked") ? "#fee2e2" : lower.includes("một") ? "#fef3c7" : "#dcfce7";
  const color = lower.includes("cần") || lower.includes("locked") ? "#b91c1c" : lower.includes("một") ? "#a16207" : "#15803d";
  return <span style={{ ...styles.status, background: bg, color }}>{label}</span>;
}

function TypePill({ label }: { label: string }) {
  const bg = label === "GROUP" ? "#dbeafe" : label === "CLOUD" ? "#f3e8ff" : "#e0f2fe";
  const color = label === "GROUP" ? "#1d4ed8" : label === "CLOUD" ? "#7e22ce" : "#0369a1";
  return <span style={{ ...styles.status, background: bg, color }}>{label}</span>;
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    height: "100vh",
    width: "100vw",
    display: "flex",
    background: "#f6f7fb",
    color: "#111827",
    overflow: "hidden",
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  sidebar: {
    width: 248,
    minWidth: 248,
    height: "100vh",
    background: "#0f172a",
    color: "#e5e7eb",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  brandButton: {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    height: 48,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 12px",
    cursor: "pointer",
  },
  brandText: { fontWeight: 700, fontSize: 15 },
  nav: { display: "flex", flexDirection: "column", gap: 4 },
  navButton: {
    height: 40,
    border: "none",
    borderRadius: 8,
    background: "transparent",
    color: "#cbd5e1",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 10px",
    cursor: "pointer",
    fontSize: 14,
    textAlign: "left",
  },
  navButtonActive: { background: "#2563eb", color: "#fff" },
  main: {
    flex: 1,
    height: "100vh",
    overflow: "auto",
    padding: 24,
  },
  header: {
    minHeight: 72,
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    marginBottom: 18,
  },
  kicker: { color: "#64748b", fontSize: 13, marginBottom: 4 },
  title: { margin: 0, fontSize: 28, lineHeight: 1.15, letterSpacing: 0, color: "#0f172a" },
  headerActions: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  searchBox: {
    height: 38,
    minWidth: 280,
    border: "1px solid #dbe2ea",
    borderRadius: 8,
    background: "#fff",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 10px",
    color: "#64748b",
  },
  searchInput: {
    border: "none",
    outline: "none",
    minWidth: 0,
    flex: 1,
    fontSize: 14,
    color: "#111827",
    background: "transparent",
  },
  select: {
    height: 38,
    borderRadius: 8,
    border: "1px solid #dbe2ea",
    background: "#fff",
    color: "#111827",
    padding: "0 10px",
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    border: "1px solid #dbe2ea",
    background: "#fff",
    color: "#111827",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  errorBanner: {
    marginBottom: 16,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
  },
  content: { display: "flex", flexDirection: "column", gap: 16 },
  metricGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(160px, 1fr))", gap: 14 },
  metric: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 16,
    minHeight: 132,
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
  },
  metricIcon: { width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" },
  metricTitle: { marginTop: 12, fontSize: 13, color: "#64748b" },
  metricValue: { marginTop: 6, fontSize: 26, fontWeight: 750, color: "#0f172a", letterSpacing: 0 },
  metricDetail: { marginTop: 4, fontSize: 12, color: "#94a3b8" },
  twoColumns: { display: "grid", gridTemplateColumns: "repeat(2, minmax(240px, 1fr))", gap: 16 },
  panel: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
    overflow: "hidden",
  },
  panelHeader: {
    height: 48,
    borderBottom: "1px solid #eef2f7",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 14px",
    gap: 12,
  },
  panelTitle: { margin: 0, fontSize: 15, color: "#111827", fontWeight: 700 },
  panelAction: { color: "#64748b", fontSize: 12, whiteSpace: "nowrap" },
  chart: { height: 220, display: "flex", alignItems: "flex-end", gap: 8, padding: "18px 14px 12px", overflowX: "auto" },
  barColumn: { flex: "1 0 22px", minWidth: 22, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  bar: { width: "100%", borderRadius: "5px 5px 2px 2px", minHeight: 8 },
  barLabel: { fontSize: 11, color: "#94a3b8" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", color: "#64748b", fontWeight: 650, background: "#f8fafc", padding: "10px 12px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid #eef2f7" },
  td: { padding: "11px 12px", color: "#1f2937", whiteSpace: "nowrap", verticalAlign: "middle" },
  code: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: 12, color: "#334155" },
  status: { display: "inline-flex", alignItems: "center", height: 24, borderRadius: 999, padding: "0 9px", fontSize: 12, fontWeight: 650 },
  toolbar: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toolbarTitle: { margin: 0, fontSize: 16, color: "#0f172a" },
  filterGroup: { display: "flex", gap: 8, flexWrap: "wrap" },
  filterButton: {
    height: 32,
    borderRadius: 8,
    border: "1px solid #dbe2ea",
    background: "#fff",
    color: "#334155",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "0 10px",
    cursor: "pointer",
    fontSize: 13,
  },
  capabilityGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(180px, 1fr))", gap: 12 },
  capability: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 12,
    display: "grid",
    gridTemplateColumns: "18px auto",
    columnGap: 8,
    rowGap: 4,
    color: "#475569",
    fontSize: 13,
  },
};
