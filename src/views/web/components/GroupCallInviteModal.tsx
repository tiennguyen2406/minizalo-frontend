import React, { useMemo, useState } from "react";

type UserLite = {
  id: string;
  fullName?: string;
  username?: string;
  avatarUrl?: string;
};

export type GroupCallInviteModalProps = {
  open: boolean;
  title: string;
  members: UserLite[];
  myUserId: string;
  onClose: () => void;
  onConfirm: (receiverIds: string[]) => void;
};

export default function GroupCallInviteModal({
  open,
  title,
  members,
  myUserId,
  onClose,
  onConfirm,
}: GroupCallInviteModalProps) {
  const selectable = useMemo(
    () => members.filter((m) => String(m.id) !== String(myUserId)),
    [members, myUserId],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (!open) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirm = () => {
    onConfirm(Array.from(selected));
    setSelected(new Set());
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[520px] max-w-[92vw] rounded-2xl bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="text-lg font-semibold">{title}</div>
          <button
            className="rounded-lg px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>

        <div className="mt-3 max-h-[52vh] overflow-auto rounded-xl border border-gray-200">
          {selectable.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">
              Không có thành viên để thêm.
            </div>
          ) : (
            selectable.map((m) => {
              const label = m.fullName || m.username || "Người dùng";
              const checked = selected.has(String(m.id));
              return (
                <label
                  key={String(m.id)}
                  className="flex cursor-pointer items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(String(m.id))}
                  />
                  <img
                    src={
                      m.avatarUrl ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        label,
                      )}&background=0068FF&color=fff&size=64`
                    }
                    className="h-9 w-9 rounded-full object-cover"
                    alt={label}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{label}</div>
                    {m.username ? (
                      <div className="truncate text-xs text-gray-500">
                        @{m.username}
                      </div>
                    ) : null}
                  </div>
                </label>
              );
            })
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Đã chọn: <b>{selected.size}</b>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
              onClick={onClose}
            >
              Hủy
            </button>
            <button
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={selected.size === 0}
              onClick={confirm}
            >
              Gọi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

