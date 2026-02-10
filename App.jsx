import { useState } from "react";

const WEEKDAYS = ["日","一","二","三","四","五","六"];
const TODAY = new Date().toISOString().slice(0,10);
const STATUS = {
  unassigned: { label: "未指派", color: "#D4A373", bg: "#FEFAE0" },
  assigned: { label: "已指派", color: "#E07A5F", bg: "#FFF1EC" },
  confirmed: { label: "已完成", color: "#2D6A4F", bg: "#D8F3DC" },
};

const initStaff = [
  { id: "s1", name: "我（Host）", emoji: "👑", color: "#2D6A4F" },
  { id: "s2", name: "小美", emoji: "🧹", color: "#E07A5F" },
  { id: "s3", name: "阿明", emoji: "🔧", color: "#3D405B" },
];

const initTasks = [
  { id: 1, date: TODAY, room: "A棟 201", checkIn: "15:00", status: "unassigned", assignee: null, notes: "" },
  { id: 2, date: TODAY, room: "B棟 102", checkIn: "16:00", status: "assigned", assignee: "s2", notes: "需深度清潔" },
  { id: 3, date: TODAY, room: "A棟 301", checkIn: "14:00", status: "confirmed", assignee: "s1", notes: "" },
];

const friendly = (ds) => {
  if (ds === TODAY) return "今天";
  const t = new Date(TODAY); t.setDate(t.getDate()+1);
  if (ds === t.toISOString().slice(0,10)) return "明天";
  const d = new Date(ds);
  return `${d.getMonth()+1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）`;
};

const ORDER_PROMPT = `你是一個 Airbnb/民宿訂單辨識助手。請分析以下訂單或描述文字，可能包含一筆或多筆訂單。請回傳 JSON 陣列（不要任何其他文字、不要 markdown 格式）。

今天日期是 ${TODAY}。

規則：
- 回傳一個 JSON 陣列，每筆訂單一個物件
- 即使只有一筆也要用陣列格式 [{}]
- 每個物件欄位如下：
  - checkInDate：入住日期 YYYY-MM-DD（若無法判斷用 "${TODAY}"）
  - nights：住幾晚（預設 1）
  - cleanDate：需要清潔的日期 = 退房日 = checkInDate + nights 天，格式 YYYY-MM-DD
  - room：房間名稱（若無法判斷用 "未指定房間"）
  - checkInTime：入住時間 HH:MM（預設 "15:00"）
  - guests：房客人數（若無法判斷用 null）
  - needsClean：是否需要清潔（布林值，若有「自助清潔」「免清潔」「self-clean」等關鍵字則 false，否則 true）
  - notes：任何值得注意的備註（字串）
  - summary：一句話摘要說明辨識結果
  - confidence：辨識信心 "high" | "medium" | "low"

回傳格式範例（僅回傳 JSON 陣列，不要加任何其他內容）：
[{"checkInDate":"2026-02-15","nights":2,"cleanDate":"2026-02-17","room":"A棟 201","checkInTime":"15:00","guests":2,"needsClean":true,"notes":"情人節入住","summary":"2/15 入住 A棟201，住2晚，2/17 需安排清潔","confidence":"high"},{"checkInDate":"2026-02-16","nights":1,"cleanDate":"2026-02-17","room":"B棟 102","checkInTime":"16:00","guests":1,"needsClean":true,"notes":"","summary":"2/16 入住 B棟102，住1晚，2/17 需清潔","confidence":"high"}]`;

export default function App() {
  const [tab, setTab] = useState("today");
  const [tasks, setTasks] = useState(initTasks);
  const [staff, setStaff] = useState(initStaff);
  const [modal, setModal] = useState(null);
  const [editTask, setEditTask] = useState(null);
  const [newTask, setNewTask] = useState({ date: TODAY, room: "", checkIn: "15:00", notes: "" });
  const [newStaff, setNewStaff] = useState({ name: "", emoji: "🧹" });
  const [editingStaff, setEditingStaff] = useState(null);
  const [orderText, setOrderText] = useState("");
  const [orderResult, setOrderResult] = useState(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState(null);
  const [geminiKey, setGeminiKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [aiModel, setAiModel] = useState("claude"); // "claude" | "gemini"
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [calSel, setCalSel] = useState(null);
  const [filter, setFilter] = useState("all");

  const todayTasks = tasks.filter(t => t.date === TODAY)
    .sort((a,b) => {
      const ord = { unassigned: 0, assigned: 1, confirmed: 2 };
      return (ord[a.status] - ord[b.status]) || a.checkIn.localeCompare(b.checkIn);
    });
  const confirmed = todayTasks.filter(t => t.status === "confirmed");
  const progress = todayTasks.length ? Math.round(confirmed.length / todayTasks.length * 100) : 0;

  const assign = (tid, sid) => setTasks(p => p.map(t => {
    if (t.id !== tid) return t;
    if (t.assignee === sid) return { ...t, assignee: null, status: "unassigned" };
    return { ...t, assignee: sid, status: "assigned" };
  }));
  const toggleConfirm = (tid) => setTasks(p => p.map(t => {
    if (t.id !== tid) return t;
    if (t.status === "confirmed") return { ...t, status: t.assignee ? "assigned" : "unassigned" };
    return { ...t, status: "confirmed" };
  }));
  const delTask = (tid) => setTasks(p => p.filter(t => t.id !== tid));
  const addTask = () => {
    if (!newTask.room) return;
    setTasks(p => [...p, { id: Date.now(), date: newTask.date, room: newTask.room, checkIn: newTask.checkIn, status: "unassigned", assignee: null, notes: newTask.notes }]);
    setNewTask({ date: TODAY, room: "", checkIn: "15:00", notes: "" });
    setModal(null);
  };
  const saveEditTask = () => {
    if (!editTask) return;
    setTasks(p => p.map(t => t.id === editTask.id ? editTask : t));
    setEditTask(null); setModal(null);
  };
  const addStaffMember = () => {
    if (!newStaff.name) return;
    const colors = ["#E07A5F","#3D405B","#81B29A","#F2CC8F","#6D597A","#B56576","#355070","#E56B6F"];
    setStaff(p => [...p, { id: "s" + Date.now(), name: newStaff.name, emoji: newStaff.emoji || "🧹", color: colors[p.length % colors.length] }]);
    setNewStaff({ name: "", emoji: "🧹" });
  };
  const delStaff = (sid) => {
    setStaff(p => p.filter(s => s.id !== sid));
    setTasks(p => p.map(t => t.assignee === sid ? { ...t, assignee: null, status: "unassigned" } : t));
  };
  const saveStaffEdit = () => {
    if (!editingStaff) return;
    setStaff(p => p.map(s => s.id === editingStaff.id ? editingStaff : s));
    setEditingStaff(null);
  };

  // AI order parsing — dual model support
  const callClaude = async (txt) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: ORDER_PROMPT,
        messages: [{ role: "user", content: txt }],
      }),
    });
    const data = await res.json();
    return data.content?.map(c => c.text || "").join("") || "";
  };

  const callGemini = async (txt) => {
    if (!geminiKey) throw new Error("請先設定 Google Gemini API Key");
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: ORDER_PROMPT + "\n\n以下是訂單內容：\n" + txt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
        }),
      }
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || "Gemini API 錯誤");
    return data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
  };

  const parseOrder = async () => {
    const txt = orderText.trim();
    if (!txt) return;
    setOrderLoading(true);
    setOrderError(null);
    setOrderResult(null);
    try {
      let raw;
      if (aiModel === "gemini") {
        raw = await callGemini(txt);
      } else {
        raw = await callClaude(txt);
      }
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setOrderResult(Array.isArray(parsed) ? parsed : [parsed]);
    } catch (err) {
      // Auto-fallback: if primary fails, try the other
      try {
        let raw;
        if (aiModel === "gemini") {
          raw = await callClaude(txt);
        } else if (geminiKey) {
          raw = await callGemini(txt);
        } else {
          throw err;
        }
        const clean = raw.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        setOrderResult(Array.isArray(parsed) ? parsed : [parsed]);
        setOrderError(`主模型失敗，已自動切換至${aiModel === "gemini" ? "Claude" : "Gemini"}完成辨識`);
      } catch (err2) {
        console.error(err, err2);
        setOrderError("辨識失敗：" + err.message);
      }
    } finally {
      setOrderLoading(false);
    }
  };

  const importOrder = (r, idx) => {
    const notes = [r.guests ? `${r.guests}位房客` : null, r.nights ? `住${r.nights}晚` : null, r.notes || null].filter(Boolean).join("・");
    setTasks(p => [...p, { id: Date.now() + idx, date: r.cleanDate, room: r.room, checkIn: r.checkInTime || "15:00", status: "unassigned", assignee: null, notes }]);
    setOrderResult(p => p ? p.filter((_, i) => i !== idx) : null);
  };
  const importAllOrders = () => {
    if (!orderResult) return;
    const newTasks = orderResult.filter(r => r.needsClean).map((r, i) => {
      const notes = [r.guests ? `${r.guests}位房客` : null, r.nights ? `住${r.nights}晚` : null, r.notes || null].filter(Boolean).join("・");
      return { id: Date.now() + i, date: r.cleanDate, room: r.room, checkIn: r.checkInTime || "15:00", status: "unassigned", assignee: null, notes };
    });
    setTasks(p => [...p, ...newTasks]);
    setOrderResult(null); setOrderText(""); setModal(null);
  };

  // Calendar
  const daysInMonth = new Date(calMonth.y, calMonth.m + 1, 0).getDate();
  const firstDay = new Date(calMonth.y, calMonth.m, 1).getDay();
  const fmtD = (d) => `${calMonth.y}-${String(calMonth.m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const prevM = () => setCalMonth(p => p.m === 0 ? { y: p.y-1, m: 11 } : { ...p, m: p.m-1 });
  const nextM = () => setCalMonth(p => p.m === 11 ? { y: p.y+1, m: 0 } : { ...p, m: p.m+1 });
  const calTasks = calSel ? tasks.filter(t => t.date === calSel).sort((a,b) => { const o = { unassigned:0, assigned:1, confirmed:2 }; return o[a.status]-o[b.status]; }) : [];

  const Overlay = ({ children, onClose }) => (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999, padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:"#fff", borderRadius:18, padding:28, width:"100%", maxWidth:460, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 12px 40px rgba(0,0,0,.18)" }}>
        {children}
      </div>
    </div>
  );

  const StatusDot = ({ status }) => {
    const s = STATUS[status];
    return <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:10, background:s.color, color:"#fff" }}>{s.label}</span>;
  };

  const TaskRow = ({ t, showDate }) => {
    const st = STATUS[t.status];
    const person = t.assignee ? staff.find(s => s.id === t.assignee) : null;
    return (
      <div style={{ background: st.bg, borderLeft: `4px solid ${person ? person.color : st.color}`, borderRadius: 12, padding: "12px 14px", marginBottom: 10, transition: "all .15s" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:6 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <span style={{ fontWeight:700, fontSize:15 }}>{t.room}</span>
            {showDate && <span style={{ fontSize:11, color:"#999", background:"rgba(0,0,0,.05)", borderRadius:4, padding:"2px 7px" }}>{friendly(t.date)}</span>}
            <span style={{ fontSize:12, color:"#888" }}>⏰ {t.checkIn}</span>
            {t.notes && <span style={{ fontSize:11, color:"#999", fontStyle:"italic" }}>— {t.notes}</span>}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <StatusDot status={t.status} />
            <button onClick={() => { setEditTask({...t}); setModal("editTask"); }} style={{ background:"none", border:"none", cursor:"pointer", fontSize:14, padding:2 }}>✏️</button>
            <button onClick={() => delTask(t.id)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:14, padding:2 }}>🗑</button>
          </div>
        </div>
        <div style={{ display:"flex", gap:6, marginTop:10, flexWrap:"wrap", alignItems:"center" }}>
          {staff.map(s => (
            <button key={s.id} onClick={() => assign(t.id, s.id)} style={{
              padding:"5px 12px", borderRadius:8, fontSize:12, fontFamily:"inherit", cursor:"pointer", fontWeight:600,
              border: t.assignee === s.id ? `2px solid ${s.color}` : "1px solid #ddd",
              background: t.assignee === s.id ? s.color + "22" : "#fff",
              color: t.assignee === s.id ? s.color : "#666", transition: "all .12s",
            }}>
              {s.emoji} {s.name}
            </button>
          ))}
          {t.assignee && (
            <button onClick={() => toggleConfirm(t.id)} style={{
              marginLeft: "auto", padding: "5px 14px", borderRadius: 8, fontSize: 12, fontFamily: "inherit",
              cursor: "pointer", fontWeight: 700, border: "none",
              background: t.status === "confirmed" ? "#E07A5F" : "#2D6A4F", color: "#fff",
            }}>
              {t.status === "confirmed" ? "↩ 取消完成" : "✅ 完成"}
            </button>
          )}
        </div>
      </div>
    );
  };

  const InputField = ({ label, children }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize:13, fontWeight:600, color:"#555", display:"block", marginBottom:4 }}>{label}</label>
      {children}
    </div>
  );
  const inputStyle = { width:"100%", padding:"10px 12px", borderRadius:8, border:"1px solid #ddd", fontSize:14, fontFamily:"inherit", boxSizing:"border-box" };

  return (
    <div style={{ fontFamily:"'Noto Sans TC','Helvetica Neue',sans-serif", background:"#FAF6F1", minHeight:"100vh", color:"#2C2C2C" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#2D6A4F,#52B788)", padding:"22px 20px 14px", color:"#fff" }}>
        <div style={{ maxWidth:800, margin:"0 auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
            <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>🏠 清潔排班管理</h1>
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={() => setModal("editStaff")} style={{ background:"rgba(255,255,255,.2)", border:"none", borderRadius:8, padding:"7px 14px", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"inherit" }}>👥 人員</button>
              <button onClick={() => { setOrderText(""); setOrderResult(null); setOrderError(null); setModal("importOrder"); }} style={{ background:"rgba(255,255,255,.25)", border:"none", borderRadius:8, padding:"7px 14px", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"inherit" }}>📦 匯入訂單</button>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, marginTop:14 }}>
            {[["today","📋 今日"],["calendar","📅 月曆"],["list","📄 全部"]].map(([k,l]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                padding:"8px 18px", borderRadius:10, border:"none", cursor:"pointer", fontWeight:600, fontSize:13, fontFamily:"inherit",
                background: tab === k ? "#fff" : "rgba(255,255,255,.15)", color: tab === k ? "#2D6A4F" : "rgba(255,255,255,.85)",
              }}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:800, margin:"0 auto", padding:"16px 16px 40px" }}>

        {/* ===== TODAY ===== */}
        {tab === "today" && (
          <div>
            {/* Progress bar */}
            <div style={{ background:"#fff", borderRadius:14, padding:"16px 20px", marginBottom:14, boxShadow:"0 2px 10px rgba(0,0,0,.05)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <span style={{ fontWeight:700, fontSize:15 }}>📋 今日進度</span>
                <span style={{ fontSize:13, color:"#888" }}>{confirmed.length}/{todayTasks.length} 完成</span>
              </div>
              <div style={{ background:"#eee", borderRadius:8, height:8, overflow:"hidden" }}>
                <div style={{ width: progress + "%", height:"100%", background: progress === 100 ? "#2D6A4F" : "#E07A5F", borderRadius:8, transition:"width .4s ease" }} />
              </div>
              {progress === 100 && todayTasks.length > 0 && <div style={{ marginTop:8, textAlign:"center", fontSize:14, color:"#2D6A4F", fontWeight:600 }}>🎉 全部完成！</div>}
            </div>

            {/* Staff chips */}
            <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
              {staff.map(s => {
                const pending = todayTasks.filter(t => t.assignee === s.id && t.status !== "confirmed").length;
                const done = todayTasks.filter(t => t.assignee === s.id && t.status === "confirmed").length;
                return (
                  <div key={s.id} style={{ background:"#fff", borderRadius:10, padding:"7px 14px", display:"flex", alignItems:"center", gap:8, boxShadow:"0 1px 4px rgba(0,0,0,.05)", border:`2px solid ${s.color}22`, flex:"1 1 130px", minWidth:0 }}>
                    <span style={{ fontSize:16 }}>{s.emoji}</span>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</div>
                      <div style={{ fontSize:10, color:"#888" }}>{pending} 待做・{done} 完成</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* All tasks in one list */}
            {todayTasks.length > 0 ? todayTasks.map(t => <TaskRow key={t.id} t={t} />) : (
              <div style={{ textAlign:"center", padding:40, color:"#aaa", fontSize:15 }}>😴 今天沒有清潔任務</div>
            )}

            <button onClick={() => { setNewTask({ date: TODAY, room: "", checkIn: "15:00", notes: "" }); setModal("addTask"); }}
              style={{ width:"100%", marginTop:8, padding:"13px", borderRadius:12, border:"2px dashed #ccc", background:"transparent", cursor:"pointer", fontSize:14, fontWeight:600, color:"#888", fontFamily:"inherit" }}>
              ＋ 新增今日任務
            </button>
          </div>
        )}

        {/* ===== CALENDAR ===== */}
        {tab === "calendar" && (
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <button onClick={prevM} style={{ background:"#fff", border:"1px solid #ddd", borderRadius:8, padding:"8px 14px", cursor:"pointer", fontSize:16 }}>←</button>
              <h2 style={{ margin:0, fontSize:18, fontWeight:600 }}>{calMonth.y} 年 {calMonth.m+1} 月</h2>
              <button onClick={nextM} style={{ background:"#fff", border:"1px solid #ddd", borderRadius:8, padding:"8px 14px", cursor:"pointer", fontSize:16 }}>→</button>
            </div>
            <div style={{ background:"#fff", borderRadius:14, overflow:"hidden", boxShadow:"0 2px 10px rgba(0,0,0,.05)" }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)" }}>
                {WEEKDAYS.map(d => <div key={d} style={{ padding:"8px 4px", textAlign:"center", fontWeight:600, fontSize:12, color:"#888", background:"#F8F5F0", borderBottom:"1px solid #eee" }}>{d}</div>)}
                {Array.from({ length: firstDay }).map((_,i) => <div key={`e${i}`} style={{ minHeight:80, background:"#FCFAF7", borderBottom:"1px solid #f0ece6" }} />)}
                {Array.from({ length: daysInMonth }).map((_,i) => {
                  const day = i+1, date = fmtD(day), dt = tasks.filter(t => t.date === date);
                  const isToday = date === TODAY, isSel = date === calSel, hasUn = dt.some(t => t.status === "unassigned");
                  return (
                    <div key={day} onClick={() => setCalSel(date === calSel ? null : date)} style={{
                      minHeight:80, padding:"5px 4px", cursor:"pointer", borderBottom:"1px solid #f0ece6",
                      background: isSel ? "#EDF6F0" : isToday ? "#FFFDE7" : "#fff", transition:"background .12s",
                    }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <div style={{ fontSize:12, fontWeight: isToday ? 700 : 400, width:22, height:22, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", background: isToday ? "#2D6A4F" : "transparent", color: isToday ? "#fff" : "#555" }}>{day}</div>
                        {hasUn && <div style={{ width:6, height:6, borderRadius:"50%", background:"#c0392b" }} />}
                      </div>
                      {dt.slice(0,3).map(t => {
                        const s = STATUS[t.status]; const p = t.assignee ? staff.find(x => x.id === t.assignee) : null;
                        return <div key={t.id} style={{ background:s.bg, borderLeft:`3px solid ${p ? p.color : s.color}`, borderRadius:3, padding:"1px 4px", marginTop:2, fontSize:9, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{t.room}{t.status==="confirmed"?" ✅":""}</div>;
                      })}
                      {dt.length > 3 && <div style={{ fontSize:9, color:"#999", marginTop:1, textAlign:"center" }}>+{dt.length-3}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
            {calSel && (
              <div style={{ marginTop:16, background:"#fff", borderRadius:14, padding:18, boxShadow:"0 2px 10px rgba(0,0,0,.05)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:8 }}>
                  <h3 style={{ margin:0, fontSize:16, fontWeight:600 }}>📅 {calSel}（{friendly(calSel)}）</h3>
                  <button onClick={() => { setNewTask({ date: calSel, room: "", checkIn: "15:00", notes: "" }); setModal("addTask"); }}
                    style={{ background:"#2D6A4F", color:"#fff", border:"none", borderRadius:8, padding:"7px 14px", cursor:"pointer", fontWeight:600, fontSize:13, fontFamily:"inherit" }}>＋ 新增</button>
                </div>
                {calTasks.length === 0 ? <p style={{ color:"#aaa", textAlign:"center", padding:16 }}>此日無任務</p> : calTasks.map(t => <TaskRow key={t.id} t={t} />)}
              </div>
            )}
          </div>
        )}

        {/* ===== LIST ===== */}
        {tab === "list" && (
          <div>
            <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
              {[["all","全部"],["unassigned","未指派"],["assigned","已指派"],["confirmed","已完成"]].map(([k,l]) => (
                <button key={k} onClick={() => setFilter(k)} style={{
                  padding:"8px 16px", borderRadius:10, border:"none", cursor:"pointer", fontWeight:600, fontSize:13, fontFamily:"inherit",
                  background: filter === k ? "#2D6A4F" : "#f0ece6", color: filter === k ? "#fff" : "#666",
                }}>{l}</button>
              ))}
              <button onClick={() => { setNewTask({ date: TODAY, room: "", checkIn: "15:00", notes: "" }); setModal("addTask"); }}
                style={{ marginLeft:"auto", padding:"8px 16px", borderRadius:10, border:"none", background:"#2D6A4F", color:"#fff", cursor:"pointer", fontWeight:600, fontSize:13, fontFamily:"inherit" }}>＋ 新增</button>
            </div>
            <div style={{ background:"#fff", borderRadius:14, padding:16, boxShadow:"0 2px 10px rgba(0,0,0,.05)" }}>
              {(filter === "all" ? tasks : tasks.filter(t => t.status === filter))
                .sort((a,b) => a.date.localeCompare(b.date) || a.checkIn.localeCompare(b.checkIn))
                .map(t => <TaskRow key={t.id} t={t} showDate />)}
              {(filter === "all" ? tasks : tasks.filter(t => t.status === filter)).length === 0 &&
                <p style={{ color:"#aaa", textAlign:"center", padding:20 }}>無任務</p>}
            </div>
          </div>
        )}
      </div>

      {/* ===== MODALS ===== */}
      {modal === "addTask" && (
        <Overlay onClose={() => setModal(null)}>
          <h3 style={{ margin:"0 0 18px", fontSize:18, fontWeight:700 }}>📝 新增清潔任務</h3>
          <InputField label="日期"><input type="date" value={newTask.date} onChange={e => setNewTask(p => ({...p, date: e.target.value}))} style={inputStyle} /></InputField>
          <InputField label="房間名稱 *"><input value={newTask.room} onChange={e => setNewTask(p => ({...p, room: e.target.value}))} placeholder="例：A棟 201" style={inputStyle} /></InputField>
          <InputField label="入住時間"><input type="time" value={newTask.checkIn} onChange={e => setNewTask(p => ({...p, checkIn: e.target.value}))} style={inputStyle} /></InputField>
          <InputField label="備註"><textarea value={newTask.notes} onChange={e => setNewTask(p => ({...p, notes: e.target.value}))} rows={2} placeholder="特殊需求..." style={{...inputStyle, resize:"vertical"}} /></InputField>
          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            <button onClick={() => setModal(null)} style={{ flex:1, padding:"11px", borderRadius:10, border:"1px solid #ddd", background:"#fff", cursor:"pointer", fontWeight:600, fontSize:14, fontFamily:"inherit" }}>取消</button>
            <button onClick={addTask} style={{ flex:1, padding:"11px", borderRadius:10, border:"none", background:"#2D6A4F", color:"#fff", cursor:"pointer", fontWeight:700, fontSize:14, fontFamily:"inherit" }}>新增</button>
          </div>
        </Overlay>
      )}

      {modal === "editTask" && editTask && (
        <Overlay onClose={() => { setModal(null); setEditTask(null); }}>
          <h3 style={{ margin:"0 0 18px", fontSize:18, fontWeight:700 }}>✏️ 編輯任務</h3>
          <InputField label="日期"><input type="date" value={editTask.date} onChange={e => setEditTask(p => ({...p, date: e.target.value}))} style={inputStyle} /></InputField>
          <InputField label="房間名稱"><input value={editTask.room} onChange={e => setEditTask(p => ({...p, room: e.target.value}))} style={inputStyle} /></InputField>
          <InputField label="入住時間"><input type="time" value={editTask.checkIn} onChange={e => setEditTask(p => ({...p, checkIn: e.target.value}))} style={inputStyle} /></InputField>
          <InputField label="備註"><textarea value={editTask.notes} onChange={e => setEditTask(p => ({...p, notes: e.target.value}))} rows={2} style={{...inputStyle, resize:"vertical"}} /></InputField>
          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            <button onClick={() => { setModal(null); setEditTask(null); }} style={{ flex:1, padding:"11px", borderRadius:10, border:"1px solid #ddd", background:"#fff", cursor:"pointer", fontWeight:600, fontSize:14, fontFamily:"inherit" }}>取消</button>
            <button onClick={saveEditTask} style={{ flex:1, padding:"11px", borderRadius:10, border:"none", background:"#2D6A4F", color:"#fff", cursor:"pointer", fontWeight:700, fontSize:14, fontFamily:"inherit" }}>儲存</button>
          </div>
        </Overlay>
      )}

      {modal === "editStaff" && (
        <Overlay onClose={() => { setModal(null); setEditingStaff(null); }}>
          <h3 style={{ margin:"0 0 18px", fontSize:18, fontWeight:700 }}>👥 人員管理</h3>
          {staff.map(s => (
            <div key={s.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:"#f9f7f4", borderRadius:10, marginBottom:8 }}>
              {editingStaff?.id === s.id ? (<>
                <input value={editingStaff.emoji} onChange={e => setEditingStaff(p => ({...p, emoji: e.target.value}))}
                  style={{ width:36, textAlign:"center", padding:"6px", borderRadius:6, border:"1px solid #ddd", fontSize:16 }} />
                <input value={editingStaff.name} onChange={e => setEditingStaff(p => ({...p, name: e.target.value}))}
                  style={{ flex:1, padding:"6px 10px", borderRadius:6, border:"1px solid #ddd", fontSize:14, fontFamily:"inherit" }} />
                <button onClick={saveStaffEdit} style={{ background:"#2D6A4F", color:"#fff", border:"none", borderRadius:6, padding:"6px 12px", cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"inherit" }}>✓</button>
                <button onClick={() => setEditingStaff(null)} style={{ background:"#eee", border:"none", borderRadius:6, padding:"6px 10px", cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>✕</button>
              </>) : (<>
                <span style={{ fontSize:20, width:32, textAlign:"center" }}>{s.emoji}</span>
                <span style={{ flex:1, fontWeight:600, fontSize:14 }}>{s.name}</span>
                <div style={{ width:14, height:14, borderRadius:"50%", background:s.color }} />
                <button onClick={() => setEditingStaff({...s})} style={{ background:"none", border:"none", cursor:"pointer", fontSize:14 }}>✏️</button>
                <button onClick={() => delStaff(s.id)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:14 }}>🗑</button>
              </>)}
            </div>
          ))}
          <div style={{ borderTop:"1px solid #eee", paddingTop:14, marginTop:10 }}>
            <div style={{ fontSize:13, fontWeight:600, color:"#888", marginBottom:8 }}>新增人員</div>
            <div style={{ display:"flex", gap:8 }}>
              <input value={newStaff.emoji} onChange={e => setNewStaff(p => ({...p, emoji: e.target.value}))} placeholder="😀"
                style={{ width:44, textAlign:"center", padding:"8px", borderRadius:8, border:"1px solid #ddd", fontSize:16 }} />
              <input value={newStaff.name} onChange={e => setNewStaff(p => ({...p, name: e.target.value}))} placeholder="姓名"
                style={{ flex:1, padding:"8px 12px", borderRadius:8, border:"1px solid #ddd", fontSize:14, fontFamily:"inherit" }} />
              <button onClick={addStaffMember} style={{ background:"#2D6A4F", color:"#fff", border:"none", borderRadius:8, padding:"8px 16px", cursor:"pointer", fontWeight:700, fontSize:14, fontFamily:"inherit" }}>＋</button>
            </div>
          </div>
        </Overlay>
      )}

      {modal === "importOrder" && (
        <Overlay onClose={() => { setModal(null); setOrderResult(null); setOrderError(null); setOrderText(""); }}>
          <h3 style={{ margin:"0 0 4px", fontSize:18, fontWeight:700 }}>📦 匯入訂單</h3>
          <p style={{ fontSize:13, color:"#888", margin:"0 0 14px", lineHeight:1.6 }}>貼上訂單內容或直接輸入描述，AI 自動辨識是否需要清潔</p>

          {/* Model selector */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, flexWrap:"wrap" }}>
            <span style={{ fontSize:12, color:"#888", fontWeight:600 }}>AI 模型：</span>
            {[["claude","🟣 Claude"],["gemini","🔵 Gemini"]].map(([k,l]) => (
              <button key={k} onClick={() => setAiModel(k)} style={{
                padding:"5px 14px", borderRadius:8, fontSize:12, fontFamily:"inherit", cursor:"pointer", fontWeight:600,
                border: aiModel === k ? "2px solid #3D405B" : "1px solid #ddd",
                background: aiModel === k ? "#3D405B" : "#fff", color: aiModel === k ? "#fff" : "#666",
              }}>{l}</button>
            ))}
            {aiModel === "gemini" && (
              <button onClick={() => setShowKeyInput(!showKeyInput)} style={{
                fontSize:11, color:"#888", background:"none", border:"none", cursor:"pointer", textDecoration:"underline", fontFamily:"inherit",
              }}>{geminiKey ? "🔑 已設定" : "⚙️ 設定 Key"}</button>
            )}
          </div>
          {showKeyInput && aiModel === "gemini" && (
            <div style={{ marginBottom:12, padding:12, background:"#f9f7f4", borderRadius:10 }}>
              <label style={{ fontSize:11, color:"#888", fontWeight:600 }}>Google Gemini API Key</label>
              <input type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} placeholder="AIzaSy..."
                style={{ width:"100%", padding:"8px 10px", borderRadius:6, border:"1px solid #ddd", fontSize:13, fontFamily:"inherit", boxSizing:"border-box", marginTop:4 }} />
              <div style={{ fontSize:10, color:"#aaa", marginTop:4 }}>Key 僅存於當前瀏覽器記憶體，關閉頁面即消失</div>
            </div>
          )}

          <textarea value={orderText} onChange={e => { setOrderText(e.target.value); setOrderResult(null); setOrderError(null); }} rows={5}
            placeholder={"支援任何格式，例如：\n\n• 2/15 入住 A棟201，2位房客住2晚\n• 直接貼上 Airbnb 訂單通知信內容\n• 「明天有客人住B棟102三天」"}
            style={{ width:"100%", padding:"12px", borderRadius:10, border:"1px solid #ddd", fontSize:14, fontFamily:"inherit", resize:"vertical", boxSizing:"border-box", marginBottom:12, background:"#fafafa" }} />

          <button onClick={parseOrder} disabled={orderLoading || !orderText.trim()} style={{
            width:"100%", padding:"12px", borderRadius:10, border:"none",
            background: orderLoading ? "#999" : !orderText.trim() ? "#ccc" : "#3D405B",
            color:"#fff", cursor: orderLoading || !orderText.trim() ? "default" : "pointer",
            fontWeight:700, fontSize:14, fontFamily:"inherit", marginBottom:12,
            display:"flex", alignItems:"center", justifyContent:"center", gap:8,
          }}>
            {orderLoading ? (
              <><span style={{ display:"inline-block", width:16, height:16, border:"2px solid rgba(255,255,255,.3)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin .6s linear infinite" }} /> AI 辨識中...</>
            ) : "🤖 AI 辨識訂單"}
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

          {orderError && (
            <div style={{ background:"#FFF5F5", border:"1px solid #FECACA", borderRadius:10, padding:14, marginBottom:10, fontSize:13, color:"#c0392b" }}>
              ⚠️ {orderError}
            </div>
          )}

          {orderResult && orderResult.length > 0 && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <span style={{ fontSize:14, fontWeight:700, color:"#3D405B" }}>辨識到 {orderResult.length} 筆訂單</span>
                {orderResult.filter(r => r.needsClean).length > 1 && (
                  <button onClick={importAllOrders} style={{
                    padding:"7px 16px", borderRadius:8, border:"none", background:"#2D6A4F", color:"#fff",
                    cursor:"pointer", fontWeight:700, fontSize:12, fontFamily:"inherit",
                  }}>全部加入排班 ({orderResult.filter(r => r.needsClean).length})</button>
                )}
              </div>
              {orderResult.map((r, idx) => (
                <div key={idx} style={{
                  background: r.needsClean ? "#FFF8F0" : "#F0FAF4",
                  border: `1px solid ${r.needsClean ? "#FDE8D0" : "#D8F3DC"}`,
                  borderRadius:14, padding:16, marginBottom:10,
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                    <span style={{ fontSize:20 }}>{r.needsClean ? "🧹" : "✅"}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14, color: r.needsClean ? "#E07A5F" : "#2D6A4F" }}>
                        {r.needsClean ? "需要安排清潔" : "不需要清潔"}
                      </div>
                      {r.confidence && (
                        <span style={{
                          fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:6, display:"inline-block",
                          background: r.confidence === "high" ? "#D8F3DC" : r.confidence === "medium" ? "#FEF3C7" : "#FECACA",
                          color: r.confidence === "high" ? "#2D6A4F" : r.confidence === "medium" ? "#92400E" : "#c0392b",
                        }}>
                          {r.confidence === "high" ? "高信心" : r.confidence === "medium" ? "中信心" : "低信心"}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize:12, color:"#aaa", fontWeight:600 }}>#{idx+1}</span>
                  </div>
                  <div style={{ fontSize:13, color:"#555", lineHeight:1.9 }}>
                    <div>🏠 房間：<strong>{r.room}</strong></div>
                    {r.checkInDate && <div>📅 入住：{r.checkInDate}</div>}
                    <div>🧹 清潔日：<strong>{r.cleanDate}（{friendly(r.cleanDate)}）</strong></div>
                    <div>⏰ 入住時間：{r.checkInTime}</div>
                    {r.nights && <div>🌙 住 {r.nights} 晚</div>}
                    {r.guests && <div>👥 {r.guests} 位房客</div>}
                    {r.notes && <div style={{ fontSize:12, color:"#888", fontStyle:"italic" }}>📝 {r.notes}</div>}
                  </div>
                  {r.summary && (
                    <div style={{ marginTop:8, padding:"8px 12px", background:"rgba(0,0,0,.03)", borderRadius:8, fontSize:12, color:"#666" }}>
                      💡 {r.summary}
                    </div>
                  )}
                  {r.needsClean && (
                    <button onClick={() => importOrder(r, idx)} style={{
                      marginTop:10, width:"100%", padding:"10px", borderRadius:10, border:"none",
                      background:"#2D6A4F", color:"#fff", cursor:"pointer", fontWeight:700, fontSize:13, fontFamily:"inherit",
                    }}>
                      ＋ 加入清潔排班
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {orderResult && orderResult.length === 0 && (
            <div style={{ background:"#FFF5F5", border:"1px solid #FECACA", borderRadius:10, padding:14, fontSize:13, color:"#c0392b" }}>
              ⚠️ 無法辨識任何訂單，請確認內容後重試
            </div>
          )}
        </Overlay>
      )}
    </div>
  );
}
