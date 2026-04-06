import { useState, useEffect, useCallback } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://qbckhowssqmvokjmzftf.supabase.co";
const SUPABASE_KEY = "sb_publishable_-uP-5OdXrzjlM8qmJSWD4Q_3VyOixDv";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const OWNERS = {
  pappa: { name: "Pappa", share: 0.5,  color: "#1a3a5c" },
  hala:  { name: "Hala",  share: 0.25, color: "#2d7d6f" },
  amir:  { name: "Amir",  share: 0.25, color: "#8b4513" },
};

const TOTAL_PROPERTY_VALUE = 5193000;
const LOAN_AMOUNT          = 4000000;
const KONTANT_INSATS       = TOTAL_PROPERTY_VALUE - LOAN_AMOUNT; // 1 193 000

const SHOULD_PAY = {
  pappa: KONTANT_INSATS * 0.50,
  hala:  KONTANT_INSATS * 0.25,
  amir:  KONTANT_INSATS * 0.25,
};
const ACTUAL_PAID  = { pappa: 771453, hala: 232000, amir: 190000 };
const INITIAL_DEBT = {
  pappa: 0,
  hala:  Math.max(0, SHOULD_PAY.hala - ACTUAL_PAID.hala),  // 66 250
  amir:  Math.max(0, SHOULD_PAY.amir - ACTUAL_PAID.amir),  // 108 250
};

const APARTMENTS = [
  { id: "apt1", label: "Lägenhet 1" },
  { id: "apt2", label: "Lägenhet 2" },
  { id: "apt3", label: "Lägenhet 3" },
];

const COST_CATEGORIES = [
  "Reparation",
  "Värme",
  "Vatten & avlopp",
  "Avfall",
  "Försäkring",
  "Skatt/avgift",
  "Förvaltning",
  "Övrigt",
];

const LOAN_TYPES = ["Ränta", "Amortering"];

function fmt(n) {
  return Math.round(n).toLocaleString("sv-SE") + " kr";
}

const now = new Date();
const defaultMonth = `${now.getMonth() + 1}-${now.getFullYear()}`;

// ── Stilar ───────────────────────────────────────────────
const cardStyle = {
  background: "white", borderRadius: 16, padding: "20px 24px",
  boxShadow: "0 2px 12px rgba(44,24,16,0.08)", border: "1px solid #ede5d8",
};
const inputStyle = {
  padding: "10px 14px", borderRadius: 10, border: "1.5px solid #d4c5a9",
  background: "#fdf8f0", fontSize: 14, color: "#2c1810", outline: "none",
  width: "100%", boxSizing: "border-box", fontFamily: "inherit",
};
const btnStyle = (bg, disabled) => ({
  padding: "12px", borderRadius: 10, border: "none",
  background: disabled ? "#ccc" : bg, color: "white", fontSize: 15,
  cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
  width: "100%", opacity: disabled ? 0.7 : 1,
});

// ── Hjälpkomponenter ─────────────────────────────────────
function MonthYearPicker({ value, onChange }) {
  const months = ["Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec"];
  const [m, y] = value.split("-").map(Number);
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <select value={m} onChange={e => onChange(`${e.target.value}-${y}`)} style={{ ...inputStyle, width: "50%" }}>
        {months.map((mn, i) => <option key={i} value={i+1}>{mn}</option>)}
      </select>
      <select value={y} onChange={e => onChange(`${m}-${e.target.value}`)} style={{ ...inputStyle, width: "50%" }}>
        {Array.from({ length: 10 }, (_, i) => 2024 + i).map(yr =>
          <option key={yr} value={yr}>{yr}</option>)}
      </select>
    </div>
  );
}

function InfoRow({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #f0e8d8", fontSize: 14 }}>
      <span style={{ color: "#5a4a3a" }}>{label}</span>
      <span style={{ fontWeight: "bold", color: color || "#2c1810" }}>{value}</span>
    </div>
  );
}

function ProgressBar({ pct, color }) {
  return (
    <div style={{ height: 10, background: "#f0e8d8", borderRadius: 6, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, pct))}%`, background: color, borderRadius: 6, transition: "width 0.6s" }} />
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
      <div style={{ width: 32, height: 32, border: "3px solid #ede5d8", borderTop: "3px solid #1a3a5c", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: type === "error" ? "#c0392b" : "#2d7d6f",
      color: "white", padding: "12px 24px", borderRadius: 12,
      fontSize: 14, zIndex: 1000, boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
      maxWidth: "90vw", textAlign: "center",
    }}>{msg}</div>
  );
}

// ── Huvud-app ────────────────────────────────────────────
export default function App() {
  const [tab, setTab]   = useState("oversikt");
  const [incomes, setIncomes]       = useState([]);
  const [costs, setCosts]           = useState([]);
  const [loanPayments, setLoanPayments] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState(null);

  const [newIncome, setNewIncome] = useState({ aptId: "apt1", amount: "", month: defaultMonth, note: "" });
  const [newCost,   setNewCost]   = useState({ category: "Reparation", amount: "", month: defaultMonth, note: "" });
  const [newLoan,   setNewLoan]   = useState({ type: "Ränta", amount: "", month: defaultMonth, note: "" });

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: i }, { data: c }, { data: l }] = await Promise.all([
        supabase.from("incomes").select("*").order("created_at", { ascending: false }),
        supabase.from("costs").select("*").order("created_at", { ascending: false }),
        supabase.from("loan_payments").select("*").order("created_at", { ascending: false }),
      ]);
      setIncomes(i || []);
      setCosts(c || []);
      setLoanPayments(l || []);
    } catch { showToast("⚠️ Kunde inte hämta data", "error"); }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Beräkningar ──────────────────────────────────────────
  const totalIncome       = incomes.reduce((s, r) => s + Number(r.amount), 0);
  const totalCosts        = costs.reduce((s, r) => s + Number(r.amount), 0);
  const totalLoanPayments = loanPayments.reduce((s, r) => s + Number(r.amount), 0);
  const totalAmortized    = loanPayments.filter(r => r.type === "Amortering").reduce((s, r) => s + Number(r.amount), 0);
  const totalLoanRemain   = LOAN_AMOUNT - totalAmortized;

  // Nettovinst efter ALLA utgifter
  const netProfit = totalIncome - totalCosts - totalLoanPayments;

  // Varje ägares andel av nettovinsten
  const profitShare = {
    pappa: netProfit * 0.5,
    hala:  netProfit * 0.25,
    amir:  netProfit * 0.25,
  };

  // Barnens skuld minskar med deras vinstdel (om positiv)
  // När skulden är noll — resten är ren vinst
  const childStatus = (key) => {
    const debt       = INITIAL_DEBT[key];
    const share      = Math.max(0, profitShare[key]);
    const debtLeft   = Math.max(0, debt - share);
    const actualProfit = share > debt ? share - debt : 0;
    const pct        = debt > 0 ? Math.min(100, (share / debt) * 100) : 100;
    return { debt, share, debtLeft, actualProfit, pct };
  };

  // Månadsvis gruppering för översikt
  const getMonthlyNet = () => {
    const months = {};
    incomes.forEach(r => {
      months[r.month] = (months[r.month] || { income: 0, cost: 0, loan: 0 });
      months[r.month].income += Number(r.amount);
    });
    costs.forEach(r => {
      months[r.month] = months[r.month] || { income: 0, cost: 0, loan: 0 };
      months[r.month].cost += Number(r.amount);
    });
    loanPayments.forEach(r => {
      months[r.month] = months[r.month] || { income: 0, cost: 0, loan: 0 };
      months[r.month].loan += Number(r.amount);
    });
    return Object.entries(months)
      .sort((a, b) => {
        const [am, ay] = a[0].split("-").map(Number);
        const [bm, by] = b[0].split("-").map(Number);
        return by !== ay ? by - ay : bm - am;
      })
      .map(([month, v]) => ({ month, ...v, net: v.income - v.cost - v.loan }));
  };

  // ── Handlers ─────────────────────────────────────────────
  const addIncome = async () => {
    if (!newIncome.amount || isNaN(Number(newIncome.amount))) return;
    setSaving(true);
    const { error } = await supabase.from("incomes").insert([{
      apt_id: newIncome.aptId, amount: Number(newIncome.amount),
      month: newIncome.month, note: newIncome.note || null,
    }]);
    if (error) showToast("⚠️ " + error.message, "error");
    else { showToast("✅ Intäkt sparad!"); setNewIncome({ aptId: "apt1", amount: "", month: defaultMonth, note: "" }); await loadAll(); }
    setSaving(false);
  };

  const addCost = async () => {
    if (!newCost.amount || isNaN(Number(newCost.amount))) return;
    setSaving(true);
    const { error } = await supabase.from("costs").insert([{
      category: newCost.category, amount: Number(newCost.amount),
      month: newCost.month, note: newCost.note || null,
    }]);
    if (error) showToast("⚠️ " + error.message, "error");
    else { showToast("✅ Kostnad sparad!"); setNewCost({ category: "Reparation", amount: "", month: defaultMonth, note: "" }); await loadAll(); }
    setSaving(false);
  };

  const addLoan = async () => {
    if (!newLoan.amount || isNaN(Number(newLoan.amount))) return;
    setSaving(true);
    const { error } = await supabase.from("loan_payments").insert([{
      type: newLoan.type, amount: Number(newLoan.amount),
      month: newLoan.month, note: newLoan.note || null,
    }]);
    if (error) showToast("⚠️ " + error.message, "error");
    else { showToast("✅ Låneutgift sparad!"); setNewLoan({ type: "Ränta", amount: "", month: defaultMonth, note: "" }); await loadAll(); }
    setSaving(false);
  };

  const deleteRow = async (table, id) => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) showToast("⚠️ Kunde inte radera", "error");
    else { showToast("🗑️ Raderad"); await loadAll(); }
  };

  const tabs = [
    { id: "oversikt",  label: "📊 Översikt" },
    { id: "intakter",  label: "💰 Intäkter" },
    { id: "kostnader", label: "🔧 Kostnader" },
    { id: "lan",       label: "🏦 Lån" },
    { id: "vinst",     label: "📈 Vinst" },
  ];

  const monthlyData = getMonthlyNet();

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #f5ede0 0%, #fdf8f0 60%, #e8f0e8 100%)", fontFamily: "'Georgia', 'Times New Roman', serif", paddingBottom: 48 }}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1a3a5c 0%, #2d5a8e 100%)", padding: "28px 24px 22px", color: "white", marginBottom: 24 }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", opacity: 0.65, marginBottom: 4 }}>Familjeägd fastighet</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: "normal", letterSpacing: 1 }}>🏠 Fastighetsportfölj</h1>
            <button onClick={loadAll} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>🔄</button>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 16, fontSize: 13, opacity: 0.75, flexWrap: "wrap" }}>
            <span>Fastighetsvärde: <b style={{ opacity: 1 }}>{fmt(TOTAL_PROPERTY_VALUE)}</b></span>
            <span>Bolån: <b style={{ opacity: 1 }}>{fmt(LOAN_AMOUNT)}</b></span>
            <span>Kontantinsats: <b style={{ opacity: 1 }}>{fmt(KONTANT_INSATS)}</b></span>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.6 }}>☁️ Delas i realtid med alla familjemedlemmar</div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>

        {/* Tabbar */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24, background: "white", borderRadius: 14, padding: 6, boxShadow: "0 2px 8px rgba(44,24,16,0.07)", overflowX: "auto" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: "0 0 auto", padding: "10px 14px", borderRadius: 9, border: "none",
              background: tab === t.id ? "#1a3a5c" : "transparent",
              color: tab === t.id ? "white" : "#7a6a5a",
              fontFamily: "inherit", fontSize: 13, cursor: "pointer",
              fontWeight: tab === t.id ? "bold" : "normal", transition: "all 0.2s",
              whiteSpace: "nowrap",
            }}>{t.label}</button>
          ))}
        </div>

        {loading ? <Spinner /> : <>

        {/* ── ÖVERSIKT ── */}
        {tab === "oversikt" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Nyckeltal */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "Totala intäkter", val: fmt(totalIncome), color: "#2d7d6f" },
                { label: "Driftkostnader", val: fmt(totalCosts), color: "#8b4513" },
                { label: "Låneutgifter", val: fmt(totalLoanPayments), color: "#5a3a8e" },
                { label: "Nettovinst", val: fmt(netProfit), color: netProfit >= 0 ? "#2d7d6f" : "#c0392b" },
              ].map(c => (
                <div key={c.label} style={{ ...cardStyle, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#9a8a7a", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>{c.label}</div>
                  <div style={{ fontSize: 17, fontWeight: "bold", color: c.color }}>{c.val}</div>
                </div>
              ))}
            </div>

            {/* Bolån */}
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#2c1810" }}>🏦 Bolånestatus</h3>
              <InfoRow label="Ursprungligt bolån" value={fmt(LOAN_AMOUNT)} />
              <InfoRow label="Amorterat" value={fmt(totalAmortized)} color="#2d7d6f" />
              <InfoRow label="Kvar på lånet" value={fmt(totalLoanRemain)} color={totalLoanRemain > 0 ? "#8b4513" : "#2d7d6f"} />
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9a8a7a", marginBottom: 6 }}>
                  <span>Amorteringsgrad</span><span>{((totalAmortized / LOAN_AMOUNT) * 100).toFixed(1)}%</span>
                </div>
                <ProgressBar pct={(totalAmortized / LOAN_AMOUNT) * 100} color="#5a3a8e" />
              </div>
            </div>

            {/* Intäkter per lägenhet */}
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#2c1810" }}>🏘️ Intäkter per lägenhet</h3>
              {APARTMENTS.map(apt => {
                const aptInc = incomes.filter(r => r.apt_id === apt.id).reduce((s, r) => s + Number(r.amount), 0);
                return (
                  <div key={apt.id} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 5 }}>
                      <span style={{ color: "#5a4a3a" }}>{apt.label}</span>
                      <span style={{ fontWeight: "bold", color: aptInc > 0 ? "#2d7d6f" : "#9a8a7a" }}>{fmt(aptInc)}</span>
                    </div>
                    <ProgressBar pct={totalIncome > 0 ? (aptInc / totalIncome) * 100 : 0} color="#2d7d6f" />
                  </div>
                );
              })}
            </div>

            {/* Månadsöversikt */}
            {monthlyData.length > 0 && (
              <div style={cardStyle}>
                <h3 style={{ margin: "0 0 14px", fontSize: 15, color: "#2c1810" }}>📅 Månadsöversikt</h3>
                {monthlyData.map(m => (
                  <div key={m.month} style={{ padding: "10px 0", borderBottom: "1px solid #f0e8d8" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontWeight: "bold", fontSize: 14, color: "#2c1810" }}>
                        {["","Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec"][Number(m.month.split("-")[0])]} {m.month.split("-")[1]}
                      </span>
                      <span style={{ fontWeight: "bold", fontSize: 14, color: m.net >= 0 ? "#2d7d6f" : "#c0392b" }}>{fmt(m.net)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#9a8a7a" }}>
                      <span>Intäkt: <b style={{ color: "#2d7d6f" }}>{fmt(m.income)}</b></span>
                      <span>Kostnad: <b style={{ color: "#8b4513" }}>{fmt(m.cost)}</b></span>
                      <span>Lån: <b style={{ color: "#5a3a8e" }}>{fmt(m.loan)}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── INTÄKTER ── */}
        {tab === "intakter" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 16px", fontSize: 15, color: "#2c1810" }}>Registrera hyresintäkt</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <select value={newIncome.aptId} onChange={e => setNewIncome({ ...newIncome, aptId: e.target.value })} style={inputStyle}>
                  {APARTMENTS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
                <input type="number" placeholder="Belopp (kr)" value={newIncome.amount}
                  onChange={e => setNewIncome({ ...newIncome, amount: e.target.value })} style={inputStyle} />
                <MonthYearPicker value={newIncome.month} onChange={m => setNewIncome({ ...newIncome, month: m })} />
                <input type="text" placeholder="Notering (valfritt)" value={newIncome.note}
                  onChange={e => setNewIncome({ ...newIncome, note: e.target.value })} style={inputStyle} />
                <button onClick={addIncome} disabled={saving} style={btnStyle("#2d7d6f", saving)}>
                  {saving ? "Sparar..." : "+ Lägg till intäkt"}
                </button>
              </div>
            </div>
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 14px", fontSize: 15, color: "#2c1810" }}>Historik · Totalt {fmt(totalIncome)}</h3>
              {incomes.length === 0 && <div style={{ color: "#9a8a7a", fontSize: 14, textAlign: "center", padding: "24px 0" }}>Inga intäkter registrerade ännu</div>}
              {incomes.map(r => (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f0e8d8" }}>
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: 14, color: "#2c1810" }}>{APARTMENTS.find(a => a.id === r.apt_id)?.label}</div>
                    <div style={{ fontSize: 12, color: "#9a8a7a" }}>
                      {["","Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec"][Number(r.month?.split("-")[0])]} {r.month?.split("-")[1]}
                      {r.note && ` · ${r.note}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontWeight: "bold", color: "#2d7d6f", fontSize: 15 }}>{fmt(r.amount)}</span>
                    <button onClick={() => deleteRow("incomes", r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#c0392b", fontSize: 20 }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── KOSTNADER ── */}
        {tab === "kostnader" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 16px", fontSize: 15, color: "#2c1810" }}>Registrera kostnad</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <select value={newCost.category} onChange={e => setNewCost({ ...newCost, category: e.target.value })} style={inputStyle}>
                  {COST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="number" placeholder="Belopp (kr)" value={newCost.amount}
                  onChange={e => setNewCost({ ...newCost, amount: e.target.value })} style={inputStyle} />
                <MonthYearPicker value={newCost.month} onChange={m => setNewCost({ ...newCost, month: m })} />
                <input type="text" placeholder="Notering (valfritt)" value={newCost.note}
                  onChange={e => setNewCost({ ...newCost, note: e.target.value })} style={inputStyle} />
                <button onClick={addCost} disabled={saving} style={btnStyle("#8b4513", saving)}>
                  {saving ? "Sparar..." : "+ Lägg till kostnad"}
                </button>
              </div>
            </div>

            {/* Summering per kategori */}
            {costs.length > 0 && (
              <div style={cardStyle}>
                <h3 style={{ margin: "0 0 14px", fontSize: 15, color: "#2c1810" }}>Per kategori</h3>
                {COST_CATEGORIES.map(cat => {
                  const total = costs.filter(r => r.category === cat).reduce((s, r) => s + Number(r.amount), 0);
                  if (total === 0) return null;
                  return (
                    <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f0e8d8", fontSize: 14 }}>
                      <span style={{ color: "#5a4a3a" }}>{cat}</span>
                      <span style={{ fontWeight: "bold", color: "#8b4513" }}>{fmt(total)}</span>
                    </div>
                  );
                })}
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, fontSize: 15, fontWeight: "bold" }}>
                  <span>Totalt</span><span style={{ color: "#8b4513" }}>{fmt(totalCosts)}</span>
                </div>
              </div>
            )}

            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 14px", fontSize: 15, color: "#2c1810" }}>Historik · Totalt {fmt(totalCosts)}</h3>
              {costs.length === 0 && <div style={{ color: "#9a8a7a", fontSize: 14, textAlign: "center", padding: "24px 0" }}>Inga kostnader registrerade ännu</div>}
              {costs.map(r => (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f0e8d8" }}>
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: 14, color: "#2c1810" }}>{r.category}</div>
                    <div style={{ fontSize: 12, color: "#9a8a7a" }}>
                      {["","Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec"][Number(r.month?.split("-")[0])]} {r.month?.split("-")[1]}
                      {r.note && ` · ${r.note}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontWeight: "bold", color: "#8b4513", fontSize: 15 }}>{fmt(r.amount)}</span>
                    <button onClick={() => deleteRow("costs", r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#c0392b", fontSize: 20 }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── LÅN ── */}
        {tab === "lan" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ ...cardStyle, background: "linear-gradient(135deg, #2d1b6e, #5a3a8e)", color: "white", border: "none" }}>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>Ursprungligt bolån</div>
              <div style={{ fontSize: 28, fontWeight: "bold" }}>{fmt(LOAN_AMOUNT)}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 4 }}>AMORTERAT</div>
                  <div style={{ fontSize: 16, fontWeight: "bold" }}>{fmt(totalAmortized)}</div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 4 }}>KVAR PÅ LÅNET</div>
                  <div style={{ fontSize: 16, fontWeight: "bold" }}>{fmt(totalLoanRemain)}</div>
                </div>
              </div>
              <div style={{ marginTop: 12, height: 8, background: "rgba(255,255,255,0.2)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100,(totalAmortized/LOAN_AMOUNT)*100)}%`, background: "rgba(255,255,255,0.7)", borderRadius: 4 }} />
              </div>
            </div>

            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 16px", fontSize: 15, color: "#2c1810" }}>Registrera låneutgift</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {LOAN_TYPES.map(t => (
                    <button key={t} onClick={() => setNewLoan({ ...newLoan, type: t })} style={{
                      flex: 1, padding: "10px", borderRadius: 10, border: "none",
                      background: newLoan.type === t ? "#5a3a8e" : "#f0e8d8",
                      color: newLoan.type === t ? "white" : "#5a4a3a",
                      fontFamily: "inherit", fontSize: 14, cursor: "pointer", fontWeight: "bold",
                    }}>{t}</button>
                  ))}
                </div>
                <input type="number" placeholder="Belopp (kr)" value={newLoan.amount}
                  onChange={e => setNewLoan({ ...newLoan, amount: e.target.value })} style={inputStyle} />
                <MonthYearPicker value={newLoan.month} onChange={m => setNewLoan({ ...newLoan, month: m })} />
                <input type="text" placeholder="Notering (valfritt)" value={newLoan.note}
                  onChange={e => setNewLoan({ ...newLoan, note: e.target.value })} style={inputStyle} />
                <button onClick={addLoan} disabled={saving} style={btnStyle("#5a3a8e", saving)}>
                  {saving ? "Sparar..." : `+ Lägg till ${newLoan.type.toLowerCase()}`}
                </button>
              </div>
            </div>

            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 14px", fontSize: 15, color: "#2c1810" }}>Historik · Totalt {fmt(totalLoanPayments)}</h3>
              {loanPayments.length === 0 && <div style={{ color: "#9a8a7a", fontSize: 14, textAlign: "center", padding: "24px 0" }}>Inga låneutgifter registrerade ännu</div>}
              {loanPayments.map(r => (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f0e8d8" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: "bold", fontSize: 14, color: "#2c1810" }}>{r.type}</span>
                      <span style={{ fontSize: 11, background: r.type === "Amortering" ? "#e8f0ff" : "#f0e8ff", color: r.type === "Amortering" ? "#2d5a8e" : "#5a3a8e", padding: "2px 8px", borderRadius: 20 }}>{r.type}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#9a8a7a" }}>
                      {["","Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec"][Number(r.month?.split("-")[0])]} {r.month?.split("-")[1]}
                      {r.note && ` · ${r.note}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontWeight: "bold", color: "#5a3a8e", fontSize: 15 }}>{fmt(r.amount)}</span>
                    <button onClick={() => deleteRow("loan_payments", r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#c0392b", fontSize: 20 }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── VINST ── */}
        {tab === "vinst" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Total nettovinst */}
            <div style={{ ...cardStyle, background: netProfit >= 0 ? "linear-gradient(135deg, #1a5c3a, #2d8e5a)" : "linear-gradient(135deg, #5c1a1a, #8e2d2d)", color: "white", border: "none" }}>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>Total nettovinst (ackumulerad)</div>
              <div style={{ fontSize: 32, fontWeight: "bold" }}>{fmt(netProfit)}</div>
              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
                Intäkter {fmt(totalIncome)} − Kostnader {fmt(totalCosts)} − Lån {fmt(totalLoanPayments)}
              </div>
            </div>

            {/* Pappas andel */}
            <div style={{ ...cardStyle, borderLeft: "4px solid #1a3a5c" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 17, color: "#2c1810" }}>Pappa</h3>
                <span style={{ fontSize: 12, color: "#9a8a7a", background: "#f5ede0", padding: "4px 10px", borderRadius: 20 }}>50%</span>
              </div>
              <div style={{ background: "#f0faf5", border: "1.5px solid #90d0b0", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 12, color: "#2d7d6f", marginBottom: 4, fontWeight: "bold" }}>💰 Din vinstandel</div>
                <div style={{ fontSize: 26, fontWeight: "bold", color: profitShare.pappa >= 0 ? "#1a5c3a" : "#c0392b" }}>{fmt(profitShare.pappa)}</div>
              </div>
            </div>

            {/* Barnens andel */}
            {["hala", "amir"].map(key => {
              const owner  = OWNERS[key];
              const status = childStatus(key);
              return (
                <div key={key} style={{ ...cardStyle, borderLeft: `4px solid ${owner.color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 17, color: "#2c1810" }}>{owner.name}</h3>
                    <span style={{ fontSize: 12, color: "#9a8a7a", background: "#f5ede0", padding: "4px 10px", borderRadius: 20 }}>25%</span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                    <div style={{ background: "#fdf8f0", borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ fontSize: 10, color: "#9a8a7a", marginBottom: 4, textTransform: "uppercase" }}>Skuld vid köp</div>
                      <div style={{ fontSize: 15, fontWeight: "bold", color: "#8b4513" }}>{fmt(status.debt)}</div>
                    </div>
                    <div style={{ background: "#fdf8f0", borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ fontSize: 10, color: "#9a8a7a", marginBottom: 4, textTransform: "uppercase" }}>Vinstandel totalt</div>
                      <div style={{ fontSize: 15, fontWeight: "bold", color: "#2d7d6f" }}>{fmt(status.share)}</div>
                    </div>
                  </div>

                  {/* Skuld status */}
                  <div style={{
                    background: status.debtLeft > 0 ? "#fff5f0" : "#f0faf5",
                    border: `1.5px solid ${status.debtLeft > 0 ? "#f0a090" : "#90d0b0"}`,
                    borderRadius: 12, padding: "14px 16px", marginBottom: 14,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: "bold", color: status.debtLeft > 0 ? "#8b4513" : "#2d7d6f", marginBottom: 4 }}>
                      {status.debtLeft > 0 ? "⏳ Återstående skuld till pappa" : "✅ Skulden är fullt återbetald!"}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: "bold", color: status.debtLeft > 0 ? "#c0392b" : "#2d7d6f" }}>
                      {fmt(status.debtLeft)}
                    </div>
                  </div>

                  {/* Ren vinst efter skulden är betald */}
                  {status.actualProfit > 0 && (
                    <div style={{ background: "#f0faf5", border: "1.5px solid #90d0b0", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: "bold", color: "#2d7d6f", marginBottom: 4 }}>🎉 Ren vinst (efter skulden)</div>
                      <div style={{ fontSize: 24, fontWeight: "bold", color: "#1a5c3a" }}>{fmt(status.actualProfit)}</div>
                    </div>
                  )}

                  <div style={{ fontSize: 12, color: "#9a8a7a", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                    <span>Återbetalningsprogress</span>
                    <span>{status.pct.toFixed(1)}% av {fmt(status.debt)}</span>
                  </div>
                  <ProgressBar pct={status.pct} color={owner.color} />
                </div>
              );
            })}

            {/* Sammanfattning */}
            <div style={{ ...cardStyle, background: "#f5f9f5" }}>
              <h3 style={{ margin: "0 0 6px", fontSize: 15, color: "#2c1810" }}>Sammanfattning</h3>
              <InfoRow label="Nettovinst totalt" value={fmt(netProfit)} color={netProfit >= 0 ? "#2d7d6f" : "#c0392b"} />
              <InfoRow label="Pappas andel (50%)" value={fmt(profitShare.pappa)} color="#1a3a5c" />
              <InfoRow label="Halas andel (25%)" value={fmt(profitShare.hala)} color="#2d7d6f" />
              <InfoRow label="Amirs andel (25%)" value={fmt(profitShare.amir)} color="#8b4513" />
              <InfoRow label="Halas kvar att betala" value={fmt(childStatus("hala").debtLeft)} color={childStatus("hala").debtLeft > 0 ? "#c0392b" : "#2d7d6f"} />
              <InfoRow label="Amirs kvar att betala" value={fmt(childStatus("amir").debtLeft)} color={childStatus("amir").debtLeft > 0 ? "#c0392b" : "#2d7d6f"} />
            </div>
          </div>
        )}

        </>}
      </div>
    </div>
  );
}
