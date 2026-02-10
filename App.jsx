import { useState, useRef, useCallback } from "react";

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

function friendly(ds) {
  if (ds === TODAY) return "今天";
  var t = new Date(TODAY);
  t.setDate(t.getDate() + 1);
  if (ds === t.toISOString().slice(0, 10)) return "明天";
  var d = new Date(ds);
  return (d.getMonth() + 1) + "/" + d.getDate() + "（" + WEEKDAYS[d.getDay()] + "）";
}

var ORDER_SYSTEM = "你是一個 Airbnb/民宿訂單辨識助手。分析以下訂單或描述（可能是文字或圖片），可能包含一筆或多筆訂單。回傳 JSON 陣列（不要任何其他文字、不要 markdown、不要 backticks）。今天日期是 " + TODAY + "。每個物件欄位：checkInDate(YYYY-MM-DD,預設" + TODAY + "), nights(預設1), cleanDate(退房日=checkInDate+nights天), room(預設\"未指定房間\"), checkInTime(HH:MM,預設\"15:00\"), guests(null if unknown), needsClean(boolean,有自助清潔/免清潔則false), notes(備註), summary(一句話摘要), confidence(\"high\"|\"medium\"|\"low\")。僅回傳JSON陣列。";

var DEFAULT_GEMINI_KEY = "";

var inputSt = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" };

export default function App() {
  var _s = useState("today"), tab = _s[0], setTab = _s[1];
  var _t = useState(initTasks), tasks = _t[0], setTasks = _t[1];
  var _st = useState(initStaff), staff = _st[0], setStaff = _st[1];
  var _m = useState(null), modal = _m[0], setModal = _m[1];
  var _et = useState(null), editTask = _et[0], setEditTask = _et[1];
  var _nt = useState({ date: TODAY, room: "", checkIn: "15:00", notes: "" }), newTask = _nt[0], setNewTask = _nt[1];
  var _nsn = useState(""), newStaffName = _nsn[0], setNewStaffName = _nsn[1];
  var _nse = useState("🧹"), newStaffEmoji = _nse[0], setNewStaffEmoji = _nse[1];
  var _es = useState(null), editingStaff = _es[0], setEditingStaff = _es[1];
  var _ot = useState(""), orderText = _ot[0], setOrderText = _ot[1];
  var _oi = useState([]), orderImages = _oi[0], setOrderImages = _oi[1];
  var _gk = useState(DEFAULT_GEMINI_KEY), geminiKey = _gk[0], setGeminiKey = _gk[1];
  var _ss = useState(false), showSettings = _ss[0], setShowSettings = _ss[1];
  var _or = useState(null), orderResult = _or[0], setOrderResult = _or[1];
  var _ol = useState(false), orderLoading = _ol[0], setOrderLoading = _ol[1];
  var _oe = useState(null), orderError = _oe[0], setOrderError = _oe[1];
  var _cm = useState(function () { var d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; }), calMonth = _cm[0], setCalMonth = _cm[1];
  var _cs = useState(null), calSel = _cs[0], setCalSel = _cs[1];
  var _f = useState("all"), filter = _f[0], setFilter = _f[1];
  var fileRef = useRef(null);

  var todayTasks = tasks.filter(function (t) { return t.date === TODAY; })
    .sort(function (a, b) { var o = { unassigned: 0, assigned: 1, confirmed: 2 }; return (o[a.status] - o[b.status]) || a.checkIn.localeCompare(b.checkIn); });
  var confirmedCount = todayTasks.filter(function (t) { return t.status === "confirmed"; }).length;
  var progress = todayTasks.length ? Math.round(confirmedCount / todayTasks.length * 100) : 0;

  function assign(tid, sid) {
    setTasks(function (p) { return p.map(function (t) {
      if (t.id !== tid) return t;
      if (t.assignee === sid) return Object.assign({}, t, { assignee: null, status: "unassigned" });
      return Object.assign({}, t, { assignee: sid, status: "assigned" });
    }); });
  }
  function toggleConfirm(tid) {
    setTasks(function (p) { return p.map(function (t) {
      if (t.id !== tid) return t;
      if (t.status === "confirmed") return Object.assign({}, t, { status: t.assignee ? "assigned" : "unassigned" });
      return Object.assign({}, t, { status: "confirmed" });
    }); });
  }
  function delTask(tid) { setTasks(function (p) { return p.filter(function (t) { return t.id !== tid; }); }); }

  function addTask() {
    if (!newTask.room) return;
    setTasks(function (p) { return p.concat([{ id: Date.now(), date: newTask.date, room: newTask.room, checkIn: newTask.checkIn, status: "unassigned", assignee: null, notes: newTask.notes }]); });
    setNewTask({ date: TODAY, room: "", checkIn: "15:00", notes: "" });
    setModal(null);
  }
  function saveEditTask() {
    if (!editTask) return;
    var et = editTask;
    setTasks(function (p) { return p.map(function (t) { return t.id === et.id ? et : t; }); });
    setEditTask(null); setModal(null);
  }
  function addStaffMember() {
    if (!newStaffName) return;
    var colors = ["#E07A5F", "#3D405B", "#81B29A", "#F2CC8F", "#6D597A", "#B56576", "#355070", "#E56B6F"];
    var nm = newStaffName, em = newStaffEmoji || "🧹";
    setStaff(function (p) { return p.concat([{ id: "s" + Date.now(), name: nm, emoji: em, color: colors[p.length % colors.length] }]); });
    setNewStaffName(""); setNewStaffEmoji("🧹");
  }
  function delStaff(sid) {
    setStaff(function (p) { return p.filter(function (s) { return s.id !== sid; }); });
    setTasks(function (p) { return p.map(function (t) { return t.assignee === sid ? Object.assign({}, t, { assignee: null, status: "unassigned" }) : t; }); });
  }
  function saveStaffEdit() {
    if (!editingStaff) return;
    var es = editingStaff;
    setStaff(function (p) { return p.map(function (s) { return s.id === es.id ? es : s; }); });
    setEditingStaff(null);
  }

  function handleImageUpload(e) {
    var files = Array.from(e.target.files || []);
    files.forEach(function (file) {
      if (!file.type.startsWith("image/")) return;
      var reader = new FileReader();
      reader.onload = function () {
        var base64 = reader.result.split(",")[1];
        setOrderImages(function (p) { return p.concat([{ name: file.name, type: file.type, base64: base64, preview: reader.result }]); });
      };
      reader.readAsDataURL(file);
    });
    if (fileRef.current) fileRef.current.value = "";
  }
  function removeImage(idx) { setOrderImages(function (p) { return p.filter(function (_, i) { return i !== idx; }); }); }

  function parseOrder() {
    var txt = orderText.trim();
    if (!txt && orderImages.length === 0) return;
    setOrderLoading(true); setOrderError(null); setOrderResult(null);

    var key = geminiKey;
    var imgs = orderImages.slice();

    var tryGemini = function () {
      var parts = [];
      imgs.forEach(function (img) {
        parts.push({ inline_data: { mime_type: img.type, data: img.base64 } });
      });
      parts.push({ text: txt || "請辨識圖片中的訂單資訊" });
      var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + key;
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: ORDER_SYSTEM }] },
          contents: [{ parts: parts }],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        }),
      }).then(function (r) { return r.json(); }).then(function (data) {
        var raw = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts || []).map(function (p) { return p.text || ""; }).join("");
        return JSON.parse(raw.replace(/```json|```/g, "").trim());
      });
    };

    var tryClaude = function () {
      var content = [];
      imgs.forEach(function (img) {
        content.push({ type: "image", source: { type: "base64", media_type: img.type, data: img.base64 } });
      });
      content.push({ type: "text", text: txt || "請辨識圖片中的訂單資訊" });
      return fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          system: ORDER_SYSTEM,
          messages: [{ role: "user", content: content }],
        }),
      }).then(function (r) { return r.json(); }).then(function (data) {
        var raw = (data.content || []).map(function (c) { return c.text || ""; }).join("");
        return JSON.parse(raw.replace(/```json|```/g, "").trim());
      });
    };

    tryGemini().catch(function (err) {
      console.warn("Gemini failed:", err);
      return tryClaude();
    }).then(function (parsed) {
      setOrderResult(Array.isArray(parsed) ? parsed : [parsed]);
    }).catch(function (err) {
      setOrderError("辨識失敗：" + err.message);
    }).finally(function () {
      setOrderLoading(false);
    });
  }

  function importOrder(r, idx) {
    var notes = [r.guests ? r.guests + "位房客" : null, r.nights ? "住" + r.nights + "晚" : null, r.notes || null].filter(Boolean).join("・");
    setTasks(function (p) { return p.concat([{ id: Date.now() + idx, date: r.cleanDate, room: r.room, checkIn: r.checkInTime || "15:00", status: "unassigned", assignee: null, notes: notes }]); });
    setOrderResult(function (p) { return p ? p.filter(function (_, i) { return i !== idx; }) : null; });
  }
  function importAllOrders() {
    if (!orderResult) return;
    var nw = orderResult.filter(function (r) { return r.needsClean; }).map(function (r, i) {
      var notes = [r.guests ? r.guests + "位房客" : null, r.nights ? "住" + r.nights + "晚" : null, r.notes || null].filter(Boolean).join("・");
      return { id: Date.now() + i, date: r.cleanDate, room: r.room, checkIn: r.checkInTime || "15:00", status: "unassigned", assignee: null, notes: notes };
    });
    setTasks(function (p) { return p.concat(nw); });
    setOrderResult(null); setOrderText(""); setOrderImages([]); setModal(null);
  }

  var daysInMonth = new Date(calMonth.y, calMonth.m + 1, 0).getDate();
  var firstDay = new Date(calMonth.y, calMonth.m, 1).getDay();
  function fmtD(d) { return calMonth.y + "-" + String(calMonth.m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0"); }
  var calTasks = calSel ? tasks.filter(function (t) { return t.date === calSel; }).sort(function (a, b) { var o = { unassigned: 0, assigned: 1, confirmed: 2 }; return o[a.status] - o[b.status]; }) : [];

  function renderTask(t, showDate) {
    var st = STATUS[t.status];
    var person = t.assignee ? staff.find(function (s) { return s.id === t.assignee; }) : null;
    return (
      <div key={t.id} style={{ background: st.bg, borderLeft: "4px solid " + (person ? person.color : st.color), borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{t.room}</span>
            {showDate && <span style={{ fontSize: 11, color: "#999", background: "rgba(0,0,0,.05)", borderRadius: 4, padding: "2px 7px" }}>{friendly(t.date)}</span>}
            <span style={{ fontSize: 12, color: "#888" }}>{"⏰ " + t.checkIn}</span>
            {t.notes && <span style={{ fontSize: 11, color: "#999", fontStyle: "italic" }}>{"— " + t.notes}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 10, background: st.color, color: "#fff" }}>{st.label}</span>
            <button onClick={function () { setEditTask(Object.assign({}, t)); setModal("editTask"); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 2 }}>{"✏️"}</button>
            <button onClick={function () { delTask(t.id); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 2 }}>{"🗑"}</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          {staff.map(function (s) {
            return (
              <button key={s.id} onClick={function () { assign(t.id, s.id); }} style={{
                padding: "5px 12px", borderRadius: 8, fontSize: 12, fontFamily: "inherit", cursor: "pointer", fontWeight: 600,
                border: t.assignee === s.id ? "2px solid " + s.color : "1px solid #ddd",
                background: t.assignee === s.id ? s.color + "22" : "#fff",
                color: t.assignee === s.id ? s.color : "#666",
              }}>{s.emoji + " " + s.name}</button>
            );
          })}
          {t.assignee && (
            <button onClick={function () { toggleConfirm(t.id); }} style={{
              marginLeft: "auto", padding: "5px 14px", borderRadius: 8, fontSize: 12, fontFamily: "inherit",
              cursor: "pointer", fontWeight: 700, border: "none",
              background: t.status === "confirmed" ? "#E07A5F" : "#2D6A4F", color: "#fff",
            }}>{t.status === "confirmed" ? "↩ 取消完成" : "✅ 完成"}</button>
          )}
        </div>
      </div>
    );
  }

  var needsCleanCount = orderResult ? orderResult.filter(function (r) { return r.needsClean; }).length : 0;
  var canParse = orderLoading || (!orderText.trim() && orderImages.length === 0) || !geminiKey.trim();

  return (
    <div style={{ fontFamily: "'Noto Sans TC','Helvetica Neue',sans-serif", background: "#FAF6F1", minHeight: "100vh", color: "#2C2C2C" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&display=swap" rel="stylesheet" />
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>

      <div style={{ background: "linear-gradient(135deg,#2D6A4F,#52B788)", padding: "22px 20px 14px", color: "#fff" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{"🏠 清潔排班管理"}</h1>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={function () { setShowSettings(!showSettings); }} style={{ background: "rgba(255,255,255,.2)", border: "none", borderRadius: 8, padding: "7px 14px", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>{"⚙️"}</button>
              <button onClick={function () { setModal("editStaff"); }} style={{ background: "rgba(255,255,255,.2)", border: "none", borderRadius: 8, padding: "7px 14px", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>{"👥 人員"}</button>
              <button onClick={function () { setOrderText(""); setOrderImages([]); setOrderResult(null); setOrderError(null); setModal("importOrder"); }} style={{ background: "rgba(255,255,255,.25)", border: "none", borderRadius: 8, padding: "7px 14px", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>{"📦 匯入訂單"}</button>
            </div>
          </div>

          {showSettings && (
            <div style={{ background: "rgba(0,0,0,.15)", borderRadius: 12, padding: "14px 16px", marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "rgba(255,255,255,.9)" }}>{"🔑 API 設定"}</div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 12, color: "rgba(255,255,255,.7)", display: "block", marginBottom: 4 }}>{"Google Gemini API Key"}</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={geminiKey} onChange={function (e) { setGeminiKey(e.target.value); }} placeholder="輸入你的 Gemini API Key"
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "none", fontSize: 13, fontFamily: "inherit", background: "rgba(255,255,255,.9)" }} />
                  {geminiKey !== DEFAULT_GEMINI_KEY && (
                    <button onClick={function () { setGeminiKey(DEFAULT_GEMINI_KEY); }} style={{ background: "rgba(255,255,255,.2)", border: "none", borderRadius: 8, padding: "8px 12px", color: "#fff", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>{"重置"}</button>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", marginTop: 6 }}>{"到 aistudio.google.com 取得免費 API Key"}</div>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>
                {geminiKey ? "✅ 已設定 Gemini Key" : "⚠️ 未設定 Key，將使用 Claude 備援"}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            {[["today", "📋 今日"], ["calendar", "📅 月曆"], ["list", "📄 全部"]].map(function (item) {
              return (
                <button key={item[0]} onClick={function () { setTab(item[0]); }} style={{
                  padding: "8px 18px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit",
                  background: tab === item[0] ? "#fff" : "rgba(255,255,255,.15)", color: tab === item[0] ? "#2D6A4F" : "rgba(255,255,255,.85)",
                }}>{item[1]}</button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px 16px 40px" }}>

        {tab === "today" && (
          <div>
            <div style={{ background: "#fff", borderRadius: 14, padding: "16px 20px", marginBottom: 14, boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{"📋 今日進度"}</span>
                <span style={{ fontSize: 13, color: "#888" }}>{confirmedCount + "/" + todayTasks.length + " 完成"}</span>
              </div>
              <div style={{ background: "#eee", borderRadius: 8, height: 8, overflow: "hidden" }}>
                <div style={{ width: progress + "%", height: "100%", background: progress === 100 ? "#2D6A4F" : "#E07A5F", borderRadius: 8, transition: "width .4s" }} />
              </div>
              {progress === 100 && todayTasks.length > 0 && <div style={{ marginTop: 8, textAlign: "center", fontSize: 14, color: "#2D6A4F", fontWeight: 600 }}>{"🎉 全部完成！"}</div>}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {staff.map(function (s) {
                var pending = todayTasks.filter(function (t) { return t.assignee === s.id && t.status !== "confirmed"; }).length;
                var done = todayTasks.filter(function (t) { return t.assignee === s.id && t.status === "confirmed"; }).length;
                return (
                  <div key={s.id} style={{ background: "#fff", borderRadius: 10, padding: "7px 14px", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 1px 4px rgba(0,0,0,.05)", border: "2px solid " + s.color + "22", flex: "1 1 130px", minWidth: 0 }}>
                    <span style={{ fontSize: 16 }}>{s.emoji}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                      <div style={{ fontSize: 10, color: "#888" }}>{pending + " 待做・" + done + " 完成"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {todayTasks.length > 0 ? todayTasks.map(function (t) { return renderTask(t, false); }) : <div style={{ textAlign: "center", padding: 40, color: "#aaa", fontSize: 15 }}>{"😴 今天沒有清潔任務"}</div>}
            <button onClick={function () { setNewTask({ date: TODAY, room: "", checkIn: "15:00", notes: "" }); setModal("addTask"); }}
              style={{ width: "100%", marginTop: 8, padding: "13px", borderRadius: 12, border: "2px dashed #ccc", background: "transparent", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#888", fontFamily: "inherit" }}>{"＋ 新增今日任務"}</button>
          </div>
        )}

        {tab === "calendar" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <button onClick={function () { setCalMonth(function (p) { return p.m === 0 ? { y: p.y - 1, m: 11 } : { y: p.y, m: p.m - 1 }; }); }} style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 16 }}>{"←"}</button>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{calMonth.y + " 年 " + (calMonth.m + 1) + " 月"}</h2>
              <button onClick={function () { setCalMonth(function (p) { return p.m === 11 ? { y: p.y + 1, m: 0 } : { y: p.y, m: p.m + 1 }; }); }} style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 16 }}>{"→"}</button>
            </div>
            <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
                {WEEKDAYS.map(function (d) { return <div key={d} style={{ padding: "8px 4px", textAlign: "center", fontWeight: 600, fontSize: 12, color: "#888", background: "#F8F5F0", borderBottom: "1px solid #eee" }}>{d}</div>; })}
                {Array.from({ length: firstDay }).map(function (_, i) { return <div key={"e" + i} style={{ minHeight: 80, background: "#FCFAF7", borderBottom: "1px solid #f0ece6" }} />; })}
                {Array.from({ length: daysInMonth }).map(function (_, i) {
                  var day = i + 1, date = fmtD(day), dt = tasks.filter(function (t) { return t.date === date; });
                  var isToday = date === TODAY, isSel = date === calSel, hasUn = dt.some(function (t) { return t.status === "unassigned"; });
                  return (
                    <div key={day} onClick={function () { setCalSel(date === calSel ? null : date); }} style={{ minHeight: 80, padding: "5px 4px", cursor: "pointer", borderBottom: "1px solid #f0ece6", background: isSel ? "#EDF6F0" : isToday ? "#FFFDE7" : "#fff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: isToday ? "#2D6A4F" : "transparent", color: isToday ? "#fff" : "#555" }}>{day}</div>
                        {hasUn && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#c0392b" }} />}
                      </div>
                      {dt.slice(0, 3).map(function (t) {
                        var s = STATUS[t.status], p = t.assignee ? staff.find(function (x) { return x.id === t.assignee; }) : null;
                        return <div key={t.id} style={{ background: s.bg, borderLeft: "3px solid " + (p ? p.color : s.color), borderRadius: 3, padding: "1px 4px", marginTop: 2, fontSize: 9, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{t.room + (t.status === "confirmed" ? " ✅" : "")}</div>;
                      })}
                      {dt.length > 3 && <div style={{ fontSize: 9, color: "#999", marginTop: 1, textAlign: "center" }}>{"+" + (dt.length - 3)}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
            {calSel && (
              <div style={{ marginTop: 16, background: "#fff", borderRadius: 14, padding: 18, boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{"📅 " + calSel + "（" + friendly(calSel) + "）"}</h3>
                  <button onClick={function () { setNewTask({ date: calSel, room: "", checkIn: "15:00", notes: "" }); setModal("addTask"); }}
                    style={{ background: "#2D6A4F", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>{"＋ 新增"}</button>
                </div>
                {calTasks.length === 0 ? <p style={{ color: "#aaa", textAlign: "center", padding: 16 }}>{"此日無任務"}</p> : calTasks.map(function (t) { return renderTask(t, false); })}
              </div>
            )}
          </div>
        )}

        {tab === "list" && (
          <div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {[["all", "全部"], ["unassigned", "未指派"], ["assigned", "已指派"], ["confirmed", "已完成"]].map(function (item) {
                return (
                  <button key={item[0]} onClick={function () { setFilter(item[0]); }} style={{
                    padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit",
                    background: filter === item[0] ? "#2D6A4F" : "#f0ece6", color: filter === item[0] ? "#fff" : "#666",
                  }}>{item[1]}</button>
                );
              })}
              <button onClick={function () { setNewTask({ date: TODAY, room: "", checkIn: "15:00", notes: "" }); setModal("addTask"); }}
                style={{ marginLeft: "auto", padding: "8px 16px", borderRadius: 10, border: "none", background: "#2D6A4F", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>{"＋ 新增"}</button>
            </div>
            <div style={{ background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
              {(filter === "all" ? tasks : tasks.filter(function (t) { return t.status === filter; }))
                .sort(function (a, b) { return a.date.localeCompare(b.date) || a.checkIn.localeCompare(b.checkIn); })
                .map(function (t) { return renderTask(t, true); })}
              {(filter === "all" ? tasks : tasks.filter(function (t) { return t.status === filter; })).length === 0 && <p style={{ color: "#aaa", textAlign: "center", padding: 20 }}>{"無任務"}</p>}
            </div>
          </div>
        )}
      </div>

      {modal === "addTask" && (
        <div onClick={function () { setModal(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 16 }}>
          <div onClick={function (e) { e.stopPropagation(); }} style={{ background: "#fff", borderRadius: 18, padding: 28, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,.18)" }}>
            <h3 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 700 }}>{"📝 新增清潔任務"}</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>{"日期"}</label>
              <input type="date" value={newTask.date} onChange={function (e) { setNewTask(function (p) { return Object.assign({}, p, { date: e.target.value }); }); }} style={inputSt} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>{"房間名稱 *"}</label>
              <input value={newTask.room} onChange={function (e) { setNewTask(function (p) { return Object.assign({}, p, { room: e.target.value }); }); }} placeholder="例：A棟 201" style={inputSt} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>{"入住時間"}</label>
              <input type="time" value={newTask.checkIn} onChange={function (e) { setNewTask(function (p) { return Object.assign({}, p, { checkIn: e.target.value }); }); }} style={inputSt} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>{"備註"}</label>
              <textarea value={newTask.notes} onChange={function (e) { setNewTask(function (p) { return Object.assign({}, p, { notes: e.target.value }); }); }} rows={2} placeholder="特殊需求..." style={Object.assign({}, inputSt, { resize: "vertical" })} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={function () { setModal(null); }} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14, fontFamily: "inherit" }}>{"取消"}</button>
              <button onClick={addTask} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: "#2D6A4F", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: "inherit" }}>{"新增"}</button>
            </div>
          </div>
        </div>
      )}

      {modal === "editTask" && editTask && (
        <div onClick={function () { setModal(null); setEditTask(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 16 }}>
          <div onClick={function (e) { e.stopPropagation(); }} style={{ background: "#fff", borderRadius: 18, padding: 28, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,.18)" }}>
            <h3 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 700 }}>{"✏️ 編輯任務"}</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>{"日期"}</label>
              <input type="date" value={editTask.date} onChange={function (e) { setEditTask(function (p) { return Object.assign({}, p, { date: e.target.value }); }); }} style={inputSt} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>{"房間名稱"}</label>
              <input value={editTask.room} onChange={function (e) { setEditTask(function (p) { return Object.assign({}, p, { room: e.target.value }); }); }} style={inputSt} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>{"入住時間"}</label>
              <input type="time" value={editTask.checkIn} onChange={function (e) { setEditTask(function (p) { return Object.assign({}, p, { checkIn: e.target.value }); }); }} style={inputSt} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 }}>{"備註"}</label>
              <textarea value={editTask.notes} onChange={function (e) { setEditTask(function (p) { return Object.assign({}, p, { notes: e.target.value }); }); }} rows={2} style={Object.assign({}, inputSt, { resize: "vertical" })} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={function () { setModal(null); setEditTask(null); }} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14, fontFamily: "inherit" }}>{"取消"}</button>
              <button onClick={saveEditTask} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: "#2D6A4F", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: "inherit" }}>{"儲存"}</button>
            </div>
          </div>
        </div>
      )}

      {modal === "editStaff" && (
        <div onClick={function () { setModal(null); setEditingStaff(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 16 }}>
          <div onClick={function (e) { e.stopPropagation(); }} style={{ background: "#fff", borderRadius: 18, padding: 28, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,.18)" }}>
            <h3 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 700 }}>{"👥 人員管理"}</h3>
            {staff.map(function (s) {
              var isEditing = editingStaff && editingStaff.id === s.id;
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#f9f7f4", borderRadius: 10, marginBottom: 8 }}>
                  {isEditing ? (
                    <>
                      <input value={editingStaff.emoji} onChange={function (e) { setEditingStaff(function (p) { return Object.assign({}, p, { emoji: e.target.value }); }); }}
                        style={{ width: 36, textAlign: "center", padding: "6px", borderRadius: 6, border: "1px solid #ddd", fontSize: 16 }} />
                      <input value={editingStaff.name} onChange={function (e) { setEditingStaff(function (p) { return Object.assign({}, p, { name: e.target.value }); }); }}
                        style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 14, fontFamily: "inherit" }} />
                      <button onClick={saveStaffEdit} style={{ background: "#2D6A4F", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>{"✓"}</button>
                      <button onClick={function () { setEditingStaff(null); }} style={{ background: "#eee", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>{"✕"}</button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 20, width: 32, textAlign: "center" }}>{s.emoji}</span>
                      <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{s.name}</span>
                      <div style={{ width: 14, height: 14, borderRadius: "50%", background: s.color }} />
                      <button onClick={function () { setEditingStaff(Object.assign({}, s)); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>{"✏️"}</button>
                      <button onClick={function () { delStaff(s.id); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>{"🗑"}</button>
                    </>
                  )}
                </div>
              );
            })}
            <div style={{ borderTop: "1px solid #eee", paddingTop: 14, marginTop: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#888", marginBottom: 8 }}>{"新增人員"}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={newStaffEmoji} onChange={function (e) { setNewStaffEmoji(e.target.value); }} placeholder="😀"
                  style={{ width: 44, textAlign: "center", padding: "8px", borderRadius: 8, border: "1px solid #ddd", fontSize: 16 }} />
                <input value={newStaffName} onChange={function (e) { setNewStaffName(e.target.value); }} placeholder="姓名"
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, fontFamily: "inherit" }} />
                <button onClick={addStaffMember} style={{ background: "#2D6A4F", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: "inherit" }}>{"＋"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal === "importOrder" && (
        <div onClick={function () { setModal(null); setOrderResult(null); setOrderError(null); setOrderText(""); setOrderImages([]); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 16 }}>
          <div onClick={function (e) { e.stopPropagation(); }} style={{ background: "#fff", borderRadius: 18, padding: 28, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,.18)" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700 }}>{"📦 匯入訂單"}</h3>
            <p style={{ fontSize: 13, color: "#888", margin: "0 0 14px", lineHeight: 1.6 }}>{"貼上訂單文字、直接輸入描述、或上傳訂單截圖，AI 自動辨識"}</p>

            <div style={{ background: "#f4f1ec", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#555", marginBottom: 8 }}>{"🔑 AI 辨識 API Key"}</div>
              <input value={geminiKey} onChange={function (e) { setGeminiKey(e.target.value); }} placeholder="輸入 Google Gemini API Key"
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", background: "#fff" }} />
              <div style={{ fontSize: 11, color: "#999", marginTop: 6, lineHeight: 1.5 }}>
                {geminiKey ? "✅ 已設定" : "⚠️ 請先輸入 API Key 才能使用 AI 辨識"}
                {" — 到 aistudio.google.com 免費取得"}
              </div>
            </div>

            <textarea value={orderText} onChange={function (e) { setOrderText(e.target.value); setOrderResult(null); setOrderError(null); }} rows={4}
              placeholder={"支援任何格式，例如：\n• 2/15 入住 A棟201，2位住2晚\n• 明天有客人住B棟102三天\n• 或上傳訂單截圖"}
              style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #ddd", fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", marginBottom: 10, background: "#fafafa" }} />

            <div style={{ marginBottom: 12 }}>
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: "none" }} />
              <button onClick={function () { if (fileRef.current) fileRef.current.click(); }} style={{
                width: "100%", padding: "12px", borderRadius: 10, border: "2px dashed #ccc", background: "#fafafa",
                cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#888", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>{"📷 上傳訂單截圖（可多張）"}</button>
              {orderImages.length > 0 && (
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {orderImages.map(function (img, idx) {
                    return (
                      <div key={idx} style={{ position: "relative", width: 80, height: 80, borderRadius: 8, overflow: "hidden", border: "1px solid #ddd" }}>
                        <img src={img.preview} alt={img.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button onClick={function () { removeImage(idx); }} style={{
                          position: "absolute", top: 2, right: 2, width: 20, height: 20, borderRadius: "50%",
                          background: "rgba(0,0,0,.6)", color: "#fff", border: "none", cursor: "pointer",
                          fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
                        }}>{"✕"}</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button onClick={parseOrder} disabled={canParse} style={{
              width: "100%", padding: "12px", borderRadius: 10, border: "none",
              background: orderLoading ? "#999" : canParse ? "#ccc" : "#3D405B",
              color: "#fff", cursor: canParse ? "default" : "pointer",
              fontWeight: 700, fontSize: 14, fontFamily: "inherit", marginBottom: 12,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              {orderLoading ? (
                <>
                  <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .6s linear infinite" }} />
                  {"AI 辨識中..."}
                </>
              ) : ("🤖 AI 辨識" + (orderImages.length > 0 ? "（含 " + orderImages.length + " 張圖片）" : ""))}
            </button>

            {orderError && (
              <div style={{ background: "#FFF5F5", border: "1px solid #FECACA", borderRadius: 10, padding: 14, marginBottom: 10, fontSize: 13, color: "#c0392b" }}>{"⚠️ " + orderError}</div>
            )}

            {orderResult && orderResult.length > 0 && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#3D405B" }}>{"辨識到 " + orderResult.length + " 筆訂單"}</span>
                  {needsCleanCount > 1 && (
                    <button onClick={importAllOrders} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "#2D6A4F", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: "inherit" }}>
                      {"全部加入排班 (" + needsCleanCount + ")"}
                    </button>
                  )}
                </div>
                {orderResult.map(function (r, idx) {
                  var confBg = r.confidence === "high" ? "#D8F3DC" : r.confidence === "medium" ? "#FEF3C7" : "#FECACA";
                  var confColor = r.confidence === "high" ? "#2D6A4F" : r.confidence === "medium" ? "#92400E" : "#c0392b";
                  var confLabel = r.confidence === "high" ? "高信心" : r.confidence === "medium" ? "中信心" : "低信心";
                  return (
                    <div key={idx} style={{ background: r.needsClean ? "#FFF8F0" : "#F0FAF4", border: "1px solid " + (r.needsClean ? "#FDE8D0" : "#D8F3DC"), borderRadius: 14, padding: 16, marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 20 }}>{r.needsClean ? "🧹" : "✅"}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: r.needsClean ? "#E07A5F" : "#2D6A4F" }}>
                            {r.needsClean ? "需要安排清潔" : "不需要清潔"}
                          </div>
                          {r.confidence && (
                            <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6, display: "inline-block", background: confBg, color: confColor }}>{confLabel}</span>
                          )}
                        </div>
                        <span style={{ fontSize: 12, color: "#aaa", fontWeight: 600 }}>{"#" + (idx + 1)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "#555", lineHeight: 1.9 }}>
                        <div>{"🏠 房間："}<strong>{r.room}</strong></div>
                        {r.checkInDate && <div>{"📅 入住：" + r.checkInDate}</div>}
                        <div>{"🧹 清潔日："}<strong>{r.cleanDate + "（" + friendly(r.cleanDate) + "）"}</strong></div>
                        <div>{"⏰ 入住時間：" + r.checkInTime}</div>
                        {r.nights && <div>{"🌙 住 " + r.nights + " 晚"}</div>}
                        {r.guests && <div>{"👥 " + r.guests + " 位房客"}</div>}
                        {r.notes && <div style={{ fontSize: 12, color: "#888", fontStyle: "italic" }}>{"📝 " + r.notes}</div>}
                      </div>
                      {r.summary && <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(0,0,0,.03)", borderRadius: 8, fontSize: 12, color: "#666" }}>{"💡 " + r.summary}</div>}
                      {r.needsClean && (
                        <button onClick={function () { importOrder(r, idx); }} style={{ marginTop: 10, width: "100%", padding: "10px", borderRadius: 10, border: "none", background: "#2D6A4F", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>{"＋ 加入清潔排班"}</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {orderResult && orderResult.length === 0 && (
              <div style={{ background: "#FFF5F5", border: "1px solid #FECACA", borderRadius: 10, padding: 14, fontSize: 13, color: "#c0392b" }}>{"⚠️ 無法辨識任何訂單"}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
