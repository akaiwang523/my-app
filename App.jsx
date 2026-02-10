import { useState } from "react";

const STAFF = [
  { id: "host", name: "我（Host）", color: "#2D6A4F", emoji: "👑" },
  { id: "staff1", name: "小美", color: "#E07A5F", emoji: "🧹" },
  { id: "staff2", name: "阿明", color: "#3D405B", emoji: "🧹" },
  { id: "staff3", name: "小華", color: "#81B29A", emoji: "🧹" },
];

const STATUS_MAP = {
  unassigned: { label: "未指派", color: "#D4A373", bg: "#FEFAE0" },
  assigned: { label: "已指派", color: "#E07A5F", bg: "#FFF1EC" },
  confirmed: { label: "已確認完成", color: "#2D6A4F", bg: "#D8F3DC" },
};

const TODAY = "2026-02-09";
const TOMORROW = (() => { const d = new Date(TODAY); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const INITIAL_TASKS = [
  { id: 1, date: "2026-02-09", room: "A棟 201", checkIn: "15:00", status: "confirmed", assignee: "staff1", notes: "" },
  { id: 2, date: "2026-02-09", room: "B棟 102", checkIn: "16:00", status: "assigned", assignee: "staff2", notes: "" },
  { id: 3, date: "2026-02-09", room: "A棟 301", checkIn: "14:00", status: "unassigned", assignee: null, notes: "退房後需深度清潔" },
  { id: 4, date: "2026-02-10", room: "B棟 201", checkIn: "14:00", status: "unassigned", assignee: null, notes: "" },
  { id: 5, date: "2026-02-10", room: "A棟 201", checkIn: "15:00", status: "assigned", assignee: "host", notes: "" },
  { id: 6, date: "2026-02-11", room: "A棟 301", checkIn: "15:00", status: "unassigned", assignee: null, notes: "" },
  { id: 7, date: "2026-02-12", room: "B棟 201", checkIn: "14:00", status: "unassigned", assignee: null, notes: "" },
  { id: 8, date: "2026-02-13", room: "A棟 201", checkIn: "15:00", status: "assigned", assignee: "host", notes: "" },
  { id: 9, date: "2026-02-14", room: "A棟 301", checkIn: "15:00", status: "unassigned", assignee: null, notes: "情人節，需要特別佈置" },
  { id: 10, date: "2026-02-14", room: "B棟 102", checkIn: "16:00", status: "assigned", assignee: "staff1", notes: "" },
  { id: 11, date: "2026-02-15", room: "B棟 201", checkIn: "15:00", status: "unassigned", assignee: null, notes: "" },
];

const friendlyDate = (ds) => {
  if (ds === TODAY) return "今天";
  if (ds === TOMORROW) return "明天";
  const d = new Date(ds);
  return `${d.getMonth()+1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）`;
};
const fmtDate = (y, m, d) => `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

const css = `
@keyframes bellShake { 0%{transform:rotate(-8deg)} 100%{transform:rotate(8deg)} }
@keyframes slideDown { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
@keyframes pulseGlow { 0%{box-shadow:0 0 0 0 rgba(192,57,43,.25)} 70%{box-shadow:0 0 0 10px rgba(192,57,43,0)} 100%{box-shadow:0 0 0 0 rgba(192,57,43,0)} }
@keyframes fadeSlide { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
`;

function ReminderPanel({ tasks, onAssign, onConfirm, onJumpToDate }) {
  const [dismissed, setDismissed] = useState(false);
  const [reminderTime, setReminderTime] = useState("08:00");
  const [showSettings, setShowSettings] = useState(false);
  const [channels, setChannels] = useState({ app: true, line: false });

  const todayTasks = tasks.filter(t => t.date === TODAY);
  const tomorrowTasks = tasks.filter(t => t.date === TOMORROW);
  const todayUn = todayTasks.filter(t => t.status === "unassigned");
  const todayAs = todayTasks.filter(t => t.status === "assigned");
  const todayCo = todayTasks.filter(t => t.status === "confirmed");
  const tomUn = tomorrowTasks.filter(t => t.status === "unassigned");
  const allDone = todayTasks.length > 0 && todayTasks.every(t => t.status === "confirmed");
  const hasUrgent = todayUn.length > 0;

  const upcoming = [];
  for (let i = 2; i <= 7; i++) {
    const d = new Date(TODAY); d.setDate(d.getDate() + i);
    const ds = d.toISOString().slice(0, 10);
    const un = tasks.filter(t => t.date === ds && t.status === "unassigned");
    if (un.length > 0) upcoming.push({ date: ds, tasks: un });
  }

  if (dismissed) return (
    <button onClick={() => setDismissed(false)} style={{
      background: hasUrgent ? "#c0392b" : "#2D6A4F", color: "white", border: "none", borderRadius: 12,
      padding: "10px 18px", cursor: "pointer", fontWeight: 600, fontSize: 14, fontFamily: "inherit",
      display: "flex", alignItems: "center", gap: 8, boxShadow: "0 2px 8px rgba(0,0,0,.12)",
      animation: hasUrgent ? "pulseGlow 2s infinite" : "none", marginBottom: 16,
    }}>
      <span style={{ display: "inline-block", animation: hasUrgent ? "bellShake .6s ease-in-out infinite alternate" : "none", fontSize: 20 }}>🔔</span>
      {hasUrgent ? `⚠️ ${todayUn.length} 項今日未指派` : allDone ? "✅ 今日全部完成" : "查看今日提醒"}
    </button>
  );

  const headerBg = hasUrgent ? "linear-gradient(135deg,#c0392b,#e74c3c)" : allDone ? "linear-gradient(135deg,#2D6A4F,#52B788)" : "linear-gradient(135deg,#E07A5F,#F2A07B)";

  return (
    <div style={{ background: "white", borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,.08)", marginBottom: 20, overflow: "hidden", animation: "slideDown .3s ease-out" }}>
      <div style={{ background: headerBg, padding: "16px 20px", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ display: "inline-block", animation: hasUrgent ? "bellShake .6s ease-in-out infinite alternate" : "none", fontSize: 20 }}>🔔</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{allDone ? "🎉 今日清潔全部完成！" : hasUrgent ? "⚠️ 今日有未指派的清潔任務" : "📋 今日人力提醒"}</div>
            <div style={{ fontSize: 12, opacity: .9, marginTop: 2 }}>{TODAY}（{friendlyDate(TODAY)}）・共 {todayTasks.length} 項任務</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setShowSettings(!showSettings)} style={{ background: "rgba(255,255,255,.2)", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 14 }}>⚙️</button>
          <button onClick={() => setDismissed(true)} style={{ background: "rgba(255,255,255,.2)", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 13, color: "white", fontFamily: "inherit" }}>收起</button>
        </div>
      </div>

      {showSettings && (
        <div style={{ background: "#F8F5F0", padding: "14px 20px", borderBottom: "1px solid #eee", animation: "slideDown .2s ease-out" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 10 }}>🔔 提醒設定</div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13, color: "#666" }}>每日提醒時間</span>
              <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13, fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              {[{ k: "app", l: "📱 App 推播" }, { k: "line", l: "💬 LINE 通知" }].map(c => (
                <label key={c.k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer", color: "#555" }}>
                  <input type="checkbox" checked={channels[c.k]} onChange={() => setChannels(p => ({ ...p, [c.k]: !p[c.k] }))} style={{ accentColor: "#2D6A4F" }} />
                  {c.l}
                </label>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#999", marginTop: 8 }}>每日 {reminderTime} 自動發送當日與隔日任務提醒{channels.line ? "（含 LINE 群組通知）" : ""}</div>
        </div>
      )}

      <div style={{ padding: "16px 20px" }}>
        {/* Urgent unassigned */}
        {todayUn.length > 0 && (
          <div style={{ background: "#FFF5F5", border: "1px solid #FECACA", borderRadius: 12, padding: 14, marginBottom: 12, animation: "pulseGlow 2.5s infinite" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#c0392b", marginBottom: 10 }}>🚨 需立即指派（{todayUn.length}）</div>
            {todayUn.map((t, i) => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "white", borderRadius: 8, marginBottom: i < todayUn.length - 1 ? 8 : 0, border: "1px solid #fee", animation: `fadeSlide .3s ease-out ${i*.1}s both`, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{t.room}</span>
                  <span style={{ fontSize: 12, color: "#888", marginLeft: 8 }}>⏰ {t.checkIn} 入住</span>
                  {t.notes && <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>📝 {t.notes}</div>}
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {STAFF.map(s => (
                    <button key={s.id} onClick={() => onAssign(t.id, s.id)} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${s.color}44`, background: "white", cursor: "pointer", fontSize: 11, fontWeight: 500, fontFamily: "inherit", whiteSpace: "nowrap" }}>
                      {s.emoji} {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pending confirmation */}
        {todayAs.length > 0 && (
          <div style={{ background: "#FFF8F0", border: "1px solid #FDE8D0", borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#E07A5F", marginBottom: 10 }}>⏳ 等待確認完成（{todayAs.length}）</div>
            {todayAs.map((t, i) => {
              const staff = STAFF.find(s => s.id === t.assignee);
              return (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "white", borderRadius: 8, marginBottom: i < todayAs.length - 1 ? 8 : 0, border: "1px solid #fde8d0", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {staff && <div style={{ width: 28, height: 28, borderRadius: "50%", background: staff.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "white", flexShrink: 0 }}>{staff.emoji}</div>}
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{t.room}</span>
                      <span style={{ fontSize: 12, color: "#888", marginLeft: 8 }}>→ {staff?.name}</span>
                      <span style={{ fontSize: 12, color: "#aaa", marginLeft: 8 }}>⏰ {t.checkIn}</span>
                    </div>
                  </div>
                  <button onClick={() => onConfirm(t.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#2D6A4F", color: "white", cursor: "pointer", fontWeight: 600, fontSize: 12, fontFamily: "inherit", whiteSpace: "nowrap" }}>✅ 確認完成</button>
                </div>
              );
            })}
          </div>
        )}

        {/* Completed */}
        {todayCo.length > 0 && (
          <div style={{ background: "#F0FAF4", border: "1px solid #D8F3DC", borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#2D6A4F", marginBottom: 8 }}>✅ 已完成（{todayCo.length}）</div>
            {todayCo.map((t, i) => {
              const staff = STAFF.find(s => s.id === t.assignee);
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "white", borderRadius: 8, marginBottom: i < todayCo.length - 1 ? 6 : 0, border: "1px solid #d8f3dc", opacity: .75 }}>
                  <span>✅</span><span style={{ fontWeight: 600, fontSize: 13 }}>{t.room}</span>
                  {staff && <span style={{ fontSize: 12, color: "#888" }}>— {staff.name}</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* Tomorrow preview */}
        {tomorrowTasks.length > 0 && (
          <div style={{ borderTop: "1px solid #eee", paddingTop: 14, marginBottom: upcoming.length > 0 ? 14 : 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#3D405B", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              📆 明日預覽（{TOMORROW}）・{tomorrowTasks.length} 項
              {tomUn.length > 0 && <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 8 }}>{tomUn.length} 項未指派</span>}
            </div>
            {tomorrowTasks.map((t, i) => {
              const staff = t.assignee ? STAFF.find(s => s.id === t.assignee) : null;
              const st = STATUS_MAP[t.status];
              return (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: st.bg, borderRadius: 8, marginBottom: i < tomorrowTasks.length - 1 ? 6 : 0, borderLeft: `3px solid ${staff ? staff.color : st.color}`, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{t.room}</span>
                    <span style={{ fontSize: 11, color: "#888" }}>⏰ {t.checkIn}</span>
                    {staff && <span style={{ fontSize: 11, color: staff.color, fontWeight: 500 }}>→ {staff.name}</span>}
                  </div>
                  {!t.assignee ? (
                    <div style={{ display: "flex", gap: 3 }}>
                      {STAFF.map(s => <button key={s.id} onClick={() => onAssign(t.id, s.id)} style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid #ddd", background: "white", cursor: "pointer", fontSize: 10, fontFamily: "inherit" }}>{s.emoji}</button>)}
                    </div>
                  ) : <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 8, background: st.color, color: "white" }}>{st.label}</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* Upcoming week */}
        {upcoming.length > 0 && (
          <div style={{ borderTop: "1px solid #eee", paddingTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#888", marginBottom: 8 }}>📅 未來 7 天未指派提醒</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {upcoming.map(u => (
                <button key={u.date} onClick={() => onJumpToDate(u.date)} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid #FDE8D0", background: "#FFFBF5", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <span style={{ fontWeight: 600 }}>{friendlyDate(u.date)}</span>
                  <span style={{ background: "#D4A373", color: "white", borderRadius: 8, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{u.tasks.length}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {todayTasks.length === 0 && <div style={{ textAlign: "center", padding: "16px 0", color: "#aaa", fontSize: 14 }}>😴 今天沒有清潔任務，好好休息！</div>}
      </div>
    </div>
  );
}

function TaskCard({ task, onAssign, onConfirm, onUnconfirm, onDelete, showDate }) {
  const st = STATUS_MAP[task.status];
  const staff = task.assignee ? STAFF.find(s => s.id === task.assignee) : null;
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ border: `1px solid ${st.color}33`, borderLeft: `4px solid ${staff ? staff.color : st.color}`, borderRadius: 10, padding: "14px 16px", marginBottom: 10, background: st.bg }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{task.room}</span>
          {showDate && <span style={{ fontSize: 12, color: "#888", background: "rgba(0,0,0,.05)", borderRadius: 4, padding: "2px 8px" }}>{task.date}</span>}
          <span style={{ fontSize: 12, color: "#888" }}>⏰ {task.checkIn} 入住</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 12, background: st.color, color: "white" }}>{st.label}</span>
          <button onClick={() => setExpanded(!expanded)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 2 }}>{expanded ? "▲" : "▼"}</button>
        </div>
      </div>
      {staff && <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 22, height: 22, borderRadius: "50%", background: staff.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "white" }}>{staff.emoji}</div><span style={{ fontSize: 13, fontWeight: 500 }}>{staff.name}</span></div>}
      {task.notes && <div style={{ marginTop: 6, fontSize: 12, color: "#777", fontStyle: "italic" }}>📝 {task.notes}</div>}
      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,.08)" }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#666", marginBottom: 6 }}>指派人員</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {STAFF.map(s => <button key={s.id} onClick={() => onAssign(task.id, s.id)} style={{ padding: "6px 12px", borderRadius: 8, border: `2px solid ${task.assignee === s.id ? s.color : "#ddd"}`, background: task.assignee === s.id ? s.color + "22" : "white", cursor: "pointer", fontSize: 12, fontWeight: 500, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>{s.emoji} {s.name}</button>)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {task.status !== "confirmed" && task.assignee && <button onClick={() => onConfirm(task.id)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#2D6A4F", color: "white", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>✅ 確認完成</button>}
            {task.status === "confirmed" && <button onClick={() => onUnconfirm(task.id)} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #E07A5F", background: "white", color: "#E07A5F", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>↩ 取消完成</button>}
            <button onClick={() => onDelete(task.id)} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #ddd", background: "white", color: "#c0392b", cursor: "pointer", fontWeight: 500, fontSize: 13, fontFamily: "inherit" }}>🗑 刪除</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [month, setMonth] = useState(1);
  const [year, setYear] = useState(2026);
  const [selDate, setSelDate] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newTask, setNewTask] = useState({ room: "", checkIn: "15:00", notes: "" });
  const [view, setView] = useState("calendar");
  const [filter, setFilter] = useState("all");

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const forDate = (d) => tasks.filter(t => t.date === d);

  const assign = (id, sid) => setTasks(p => p.map(t => t.id === id ? { ...t, assignee: sid, status: sid ? "assigned" : "unassigned" } : t));
  const confirm = (id) => setTasks(p => p.map(t => t.id === id ? { ...t, status: "confirmed" } : t));
  const unconfirm = (id) => setTasks(p => p.map(t => t.id === id ? { ...t, status: t.assignee ? "assigned" : "unassigned" } : t));
  const addTask = () => {
    if (!selDate || !newTask.room) return;
    setTasks(p => [...p, { id: Math.max(...p.map(t => t.id), 0) + 1, date: selDate, room: newTask.room, checkIn: newTask.checkIn, status: "unassigned", assignee: null, notes: newTask.notes }]);
    setNewTask({ room: "", checkIn: "15:00", notes: "" }); setShowAdd(false);
  };
  const del = (id) => setTasks(p => p.filter(t => t.id !== id));
  const jumpTo = (d) => { const dt = new Date(d); setYear(dt.getFullYear()); setMonth(dt.getMonth()); setSelDate(d); setView("calendar"); };
  const prevM = () => { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); };
  const nextM = () => { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); };

  const stats = { total: tasks.length, unassigned: tasks.filter(t => t.status === "unassigned").length, assigned: tasks.filter(t => t.status === "assigned").length, confirmed: tasks.filter(t => t.status === "confirmed").length };
  const filtered = filter === "all" ? tasks : tasks.filter(t => t.status === filter);

  const btnStyle = (active, color = "#2D6A4F") => ({ padding: "8px 16px", borderRadius: 8, border: "none", background: active ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.2)", color: active ? color : "white", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" });

  return (
    <div style={{ fontFamily: "'Noto Sans TC','Helvetica Neue',sans-serif", background: "#FAF6F1", minHeight: "100vh", color: "#2C2C2C" }}>
      <style>{css}</style>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#2D6A4F,#40916C 50%,#52B788)", padding: "28px 32px 20px", color: "white" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 26, fontFamily: "'Playfair Display',serif", fontWeight: 700, letterSpacing: 1 }}>🏠 Airbnb 清潔排班</h1>
              <p style={{ margin: "6px 0 0", opacity: .85, fontSize: 14 }}>管理清潔任務 · 自動提醒 · 確認完成狀態</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setView("calendar")} style={btnStyle(view === "calendar")}>📅 月曆</button>
              <button onClick={() => setView("list")} style={btnStyle(view === "list")}>📋 列表</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
            {[{ l: "總任務", v: stats.total, b: "rgba(255,255,255,.2)" }, { l: "未指派", v: stats.unassigned, b: stats.unassigned > 0 ? "rgba(212,163,115,.5)" : "rgba(255,255,255,.15)" }, { l: "已指派", v: stats.assigned, b: "rgba(224,122,95,.4)" }, { l: "已完成", v: stats.confirmed, b: "rgba(129,178,154,.5)" }].map(s => (
              <div key={s.l} style={{ background: s.b, borderRadius: 10, padding: "10px 18px", minWidth: 80, textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{s.v}</div>
                <div style={{ fontSize: 11, opacity: .9, marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 40px" }}>
        <ReminderPanel tasks={tasks} onAssign={assign} onConfirm={confirm} onJumpToDate={jumpTo} />

        {/* Team */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          {STAFF.map(s => {
            const cnt = tasks.filter(t => t.assignee === s.id && t.status !== "confirmed").length;
            const done = tasks.filter(t => t.assignee === s.id && t.status === "confirmed").length;
            return (
              <div key={s.id} style={{ background: "white", borderRadius: 12, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 1px 4px rgba(0,0,0,.06)", border: `2px solid ${s.color}22`, flex: "1 1 180px" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: s.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{s.emoji}</div>
                <div><div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div><div style={{ fontSize: 11, color: "#888" }}>待做 {cnt} · 完成 {done}</div></div>
              </div>
            );
          })}
        </div>

        {view === "calendar" ? (<>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <button onClick={prevM} style={{ background: "white", border: "1px solid #ddd", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 16, fontFamily: "inherit" }}>←</button>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{year} 年 {month + 1} 月</h2>
            <button onClick={nextM} style={{ background: "white", border: "1px solid #ddd", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 16, fontFamily: "inherit" }}>→</button>
          </div>
          <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
              {WEEKDAYS.map(d => <div key={d} style={{ padding: "10px 4px", textAlign: "center", fontWeight: 600, fontSize: 12, color: "#888", background: "#F8F5F0", borderBottom: "1px solid #eee" }}>{d}</div>)}
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} style={{ minHeight: 90, background: "#FCFAF7", borderBottom: "1px solid #f0ece6" }} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1, date = fmtDate(year, month, day), dt = forDate(date);
                const isToday = date === TODAY, isSel = date === selDate, hasUn = dt.some(t => t.status === "unassigned");
                return (
                  <div key={day} onClick={() => setSelDate(date === selDate ? null : date)} style={{ minHeight: 90, padding: "6px 6px 4px", cursor: "pointer", borderBottom: "1px solid #f0ece6", background: isSel ? "#EDF6F0" : isToday ? "#FFFDE7" : "white", transition: "background .15s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: isToday ? "#2D6A4F" : "transparent", color: isToday ? "white" : "#555" }}>{day}</div>
                      {hasUn && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#c0392b" }} />}
                    </div>
                    {dt.map(t => { const s = STATUS_MAP[t.status], st = t.assignee ? STAFF.find(x => x.id === t.assignee) : null; return (
                      <div key={t.id} style={{ background: s.bg, borderLeft: `3px solid ${st ? st.color : s.color}`, borderRadius: 4, padding: "2px 5px", marginTop: 2, fontSize: 10, lineHeight: 1.4, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                        <span style={{ fontWeight: 600 }}>{t.room}</span>{t.status === "confirmed" && " ✅"}
                      </div>
                    ); })}
                    {dt.length === 0 && <div style={{ fontSize: 10, color: "#ccc", marginTop: 8, textAlign: "center" }}>—</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {selDate && (
            <div style={{ marginTop: 20, background: "white", borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>📅 {selDate}（{friendlyDate(selDate)}）</h3>
                <button onClick={() => setShowAdd(true)} style={{ background: "#2D6A4F", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>＋ 新增任務</button>
              </div>
              {forDate(selDate).length === 0 ? <p style={{ color: "#aaa", textAlign: "center", padding: 20 }}>此日無清潔任務</p> : forDate(selDate).map(t => <TaskCard key={t.id} task={t} onAssign={assign} onConfirm={confirm} onUnconfirm={unconfirm} onDelete={del} />)}
            </div>
          )}
        </>) : (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {["all", "unassigned", "assigned", "confirmed"].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ padding: "8px 16px", borderRadius: 20, border: "none", cursor: "pointer", background: filter === f ? "#2D6A4F" : "white", color: filter === f ? "white" : "#555", fontWeight: 600, fontSize: 13, fontFamily: "inherit", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
                  {f === "all" ? "全部" : STATUS_MAP[f].label}
                </button>
              ))}
            </div>
            <div style={{ background: "white", borderRadius: 14, padding: 16, boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
              {filtered.sort((a, b) => a.date.localeCompare(b.date)).map(t => <TaskCard key={t.id} task={t} onAssign={assign} onConfirm={confirm} onUnconfirm={unconfirm} onDelete={del} showDate />)}
              {filtered.length === 0 && <p style={{ color: "#aaa", textAlign: "center", padding: 20 }}>無符合條件的任務</p>}
            </div>
          </div>
        )}

        {/* Add Modal */}
        {showAdd && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }}>
            <div style={{ background: "white", borderRadius: 16, padding: 28, width: "100%", maxWidth: 400, boxShadow: "0 8px 30px rgba(0,0,0,.15)" }}>
              <h3 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 600 }}>新增清潔任務</h3>
              <p style={{ fontSize: 13, color: "#888", margin: "0 0 16px" }}>日期：{selDate}</p>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#555" }}>房間名稱 *</label>
              <input value={newTask.room} onChange={e => setNewTask({ ...newTask, room: e.target.value })} placeholder="例：A棟 201" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", marginTop: 4, marginBottom: 14, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
              <label style={{ fontSize: 13, fontWeight: 500, color: "#555" }}>入住時間</label>
              <input type="time" value={newTask.checkIn} onChange={e => setNewTask({ ...newTask, checkIn: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", marginTop: 4, marginBottom: 14, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
              <label style={{ fontSize: 13, fontWeight: 500, color: "#555" }}>備註</label>
              <textarea value={newTask.notes} onChange={e => setNewTask({ ...newTask, notes: e.target.value })} placeholder="特殊需求..." rows={2} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", marginTop: 4, marginBottom: 18, fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #ddd", background: "white", cursor: "pointer", fontWeight: 500, fontSize: 14, fontFamily: "inherit" }}>取消</button>
                <button onClick={addTask} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "#2D6A4F", color: "white", cursor: "pointer", fontWeight: 600, fontSize: 14, fontFamily: "inherit" }}>新增</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
