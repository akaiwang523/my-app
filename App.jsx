import { useState, useRef } from "react";

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

var ORDER_SYSTEM = `你是一個 Airbnb/民宿訂單辨識助手。
任務：辨識圖片或文字中的訂單資訊，並提取為 JSON 格式。
規則：
1. 這是房務系統用的，重點是抓出「房號」、「日期」、「人數」。
2. 如果是單純的文字截圖，請根據語意提取資訊。
3. 如果無法辨識或不是訂單，請回傳空陣列 []。
4. 嚴格回傳 JSON 陣列，不要有 Markdown 標記 (如 \`\`\`json)。

回傳欄位格式範例：
[
  {
    "checkInDate": "${TODAY}",
    "nights": 1,
    "cleanDate": "${TODAY}",
    "room": "201",
    "checkInTime": "15:00",
    "guests": 2,
    "needsClean": true,
    "notes": "有小孩",
    "summary": "201房 2位入住",
    "confidence": "high"
  }
]`;

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
  function delTask(tid) {
