import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tables } from "@/integrations/supabase/types";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Users, Activity, BarChart3, Eye, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";

type Section = "overview" | "insights" | "visitors" | "breakdowns" | "customers" | "transactions";
const NAV: { id: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "insights", label: "Insights", icon: TrendingUp },
  { id: "visitors", label: "Live visitors", icon: Eye },
  { id: "breakdowns", label: "Breakdowns", icon: BarChart3 },
  { id: "customers", label: "Customers", icon: Users },
  { id: "transactions", label: "Transactions", icon: Activity },
];
const isSection = (value: string | undefined): value is Section =>
  !!value && NAV.some((item) => item.id === value);

// Fallback mapping for carrier_id -> friendly name when carrier_name is missing in older logs
const CARRIER_ID_NAMES: Record<string, string> = {
  "3": "AT&T",
  "6": "Cricket",
  "14": "Verizon",
  "15": "Simple Mobile",
  "25": "Ultra Mobile",
  "29": "Lyca Mobile",
  "36": "Boost",
  "38": "Metro PCS",
  "43": "T-Mobile",
  "45": "Tracfone",
};
const carrierLabel = (l: { carrier_name?: string | null; carrier_slug?: string | null; carrier_id?: string | null }) =>
  l.carrier_name ||
  (l.carrier_id && CARRIER_ID_NAMES[l.carrier_id]) ||
  l.carrier_slug ||
  (l.carrier_id ? `Carrier #${l.carrier_id}` : "Unknown");

type TxLog = Tables<"transaction_logs">;
type Visitor = { session_id: string; path: string; last_seen: string };

const RANGES = [
  { label: "Last 24h", value: "1d", hours: 24 },
  { label: "Last 7 days", value: "7d", hours: 24 * 7 },
  { label: "Last 30 days", value: "30d", hours: 24 * 30 },
  { label: "All time", value: "all", hours: 0 },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeSection = location.pathname.match(/^\/admin\/?([^/]*)/)?.[1];
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [logs, setLogs] = useState<TxLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("7d");
  const [section, setSection] = useState<Section>(() => isSection(routeSection) ? routeSection : "overview");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [carrierFilter, setCarrierFilter] = useState<string>("all");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [now, setNow] = useState(Date.now());
  const [detailLog, setDetailLog] = useState<TxLog | null>(null);
  const [periodVisitors, setPeriodVisitors] = useState<number>(0);

  useEffect(() => {
    setSection(isSection(routeSection) ? routeSection : "overview");
  }, [routeSection]);

  // Auth + admin check
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/admin/login"); return; }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      const admin = !!roles?.some((r) => r.role === "admin");
      if (!mounted) return;
      setIsAdmin(admin);
      setAuthChecked(true);
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate("/admin/login");
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [navigate]);

  // Fetch logs based on range
  useEffect(() => {
    if (!isAdmin) return;
    const fetchLogs = async () => {
      setLoading(true);
      const r = RANGES.find((x) => x.value === range)!;
      let q = supabase.from("transaction_logs").select("*").order("created_at", { ascending: false }).limit(1000);
      if (r.hours > 0) {
        const since = new Date(Date.now() - r.hours * 3600 * 1000).toISOString();
        q = q.gte("created_at", since);
      }
      const { data } = await q;
      setLogs((data as TxLog[]) || []);
      // Unique visitor sessions in the same range (approx funnel top)
      let vq = supabase.from("page_visitors").select("session_id", { count: "exact", head: true });
      if (r.hours > 0) {
        const since = new Date(Date.now() - r.hours * 3600 * 1000).toISOString();
        vq = vq.gte("last_seen", since);
      }
      const { count: vCount } = await vq;
      setPeriodVisitors(vCount || 0);
      setLoading(false);
    };
    fetchLogs();
  }, [isAdmin, range]);

  // Realtime updates
  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase
      .channel("admin-tx-logs")
      .on("postgres_changes", { event: "*", schema: "public", table: "transaction_logs" }, (payload) => {
        setLogs((prev) => {
          if (payload.eventType === "INSERT") {
            return [payload.new as TxLog, ...prev].slice(0, 1000);
          }
          if (payload.eventType === "UPDATE") {
            return prev.map((l) => (l.id === (payload.new as TxLog).id ? (payload.new as TxLog) : l));
          }
          if (payload.eventType === "DELETE") {
            return prev.filter((l) => l.id !== (payload.old as TxLog).id);
          }
          return prev;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin]);

  // Live visitors (presence) — refresh every 10s
  useEffect(() => {
    if (!isAdmin) return;
    const fetchVisitors = async () => {
      const since = new Date(Date.now() - 60_000).toISOString();
      const { data } = await supabase
        .from("page_visitors")
        .select("session_id, path, last_seen")
        .gte("last_seen", since)
        .order("last_seen", { ascending: false });
      setVisitors((data as Visitor[]) || []);
      setNow(Date.now());
    };
    fetchVisitors();
    const t = window.setInterval(fetchVisitors, 10_000);
    return () => window.clearInterval(t);
  }, [isAdmin]);

  const liveVisitors = useMemo(() => {
    const cutoff = now - 60_000;
    return visitors.filter((v) => new Date(v.last_seen).getTime() >= cutoff);
  }, [visitors, now]);

  const visitorsByPath = useMemo(() => {
    const map = new Map<string, number>();
    liveVisitors.forEach((v) => map.set(v.path, (map.get(v.path) || 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [liveVisitors]);

  const domainOf = (l: TxLog): string => {
    const m = (l.metadata as Record<string, unknown> | null) || {};
    const h = typeof m.caller_host === "string" ? m.caller_host.toLowerCase() : "";
    if (!h) return "unknown";
    if (h.includes("lovable")) return "preview";
    return h.replace(/^www\./, "");
  };

  const domainOptions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => set.add(domainOf(l)));
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (methodFilter !== "all" && l.payment_method !== methodFilter) return false;
      if (carrierFilter !== "all" && carrierLabel(l) !== carrierFilter) return false;
      if (domainFilter !== "all" && domainOf(l) !== domainFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const blob = `${l.email || ""} ${l.phone_number || ""} ${l.first_name || ""} ${l.last_name || ""} ${l.hashid || ""} ${l.transaction_id || ""}`.toLowerCase();
        if (!blob.includes(s)) return false;
      }
      return true;
    });
  }, [logs, statusFilter, methodFilter, carrierFilter, domainFilter, search]);

  // For breakdowns we ignore the status filter so success/failed columns are always visible
  const filteredForBreakdowns = useMemo(() => {
    return logs.filter((l) => {
      if (methodFilter !== "all" && l.payment_method !== methodFilter) return false;
      if (carrierFilter !== "all" && carrierLabel(l) !== carrierFilter) return false;
      if (domainFilter !== "all" && domainOf(l) !== domainFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const blob = `${l.email || ""} ${l.phone_number || ""} ${l.first_name || ""} ${l.last_name || ""} ${l.hashid || ""} ${l.transaction_id || ""}`.toLowerCase();
        if (!blob.includes(s)) return false;
      }
      return true;
    });
  }, [logs, methodFilter, carrierFilter, domainFilter, search]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const success = filtered.filter((l) => l.status === "success");
    const failed = filtered.filter((l) => l.status === "failed").length;
    const pending = filtered.filter((l) => l.status === "pending").length;
    const revenue = success.reduce((s, l) => s + (Number(l.total) || Number(l.amount) || 0), 0);
    const aov = success.length ? revenue / success.length : 0;
    const successRate = total ? (success.length / total) * 100 : 0;
    return { total, successCount: success.length, failed, pending, revenue, aov, successRate };
  }, [filtered]);

  const byCarrier = useMemo(() => {
    const map = new Map<string, { success: number; failed: number; pending: number; revenue: number }>();
    filteredForBreakdowns.forEach((l) => {
      const k = carrierLabel(l);
      const cur = map.get(k) || { success: 0, failed: 0, pending: 0, revenue: 0 };
      if (l.status === "success") {
        cur.success += 1;
        cur.revenue += Number(l.total) || Number(l.amount) || 0;
      } else if (l.status === "failed") {
        cur.failed += 1;
      } else {
        cur.pending += 1;
      }
      map.set(k, cur);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].revenue - a[1].revenue);
  }, [filteredForBreakdowns]);

  const byMethod = useMemo(() => {
    const map = new Map<string, { success: number; failed: number; pending: number; revenue: number }>();
    filteredForBreakdowns.forEach((l) => {
      const k = l.payment_method || "unknown";
      const cur = map.get(k) || { success: 0, failed: 0, pending: 0, revenue: 0 };
      if (l.status === "success") {
        cur.success += 1;
        cur.revenue += Number(l.total) || Number(l.amount) || 0;
      } else if (l.status === "failed") {
        cur.failed += 1;
      } else {
        cur.pending += 1;
      }
      map.set(k, cur);
    });
    return Array.from(map.entries()).sort((a, b) => (b[1].success + b[1].failed) - (a[1].success + a[1].failed));
  }, [filteredForBreakdowns]);

  // Customers = only successful transactions (paying customers for marketing)
  const byCustomer = useMemo(() => {
    type Agg = {
      email: string;
      phone: string;
      name: string;
      carriers: Set<string>;
      methods: Set<string>;
      orders: number;
      totalSpend: number;
      firstSeen: string;
      lastSeen: string;
    };
    const map = new Map<string, Agg>();
    logs
      .filter((l) => l.status === "success")
      .forEach((l) => {
        const key = (l.email || l.phone_number || "").toLowerCase();
        if (!key) return;
        const cur = map.get(key) || {
          email: l.email || "",
          phone: l.phone_number || "",
          name: [l.first_name, l.last_name].filter(Boolean).join(" "),
          carriers: new Set<string>(),
          methods: new Set<string>(),
          orders: 0,
          totalSpend: 0,
          firstSeen: l.created_at,
          lastSeen: l.created_at,
        };
        cur.orders += 1;
        cur.totalSpend += Number(l.total) || Number(l.amount) || 0;
        const carrierName = carrierLabel(l);
        if (carrierName) cur.carriers.add(carrierName);
        if (l.payment_method) cur.methods.add(l.payment_method);
        if (!cur.email && l.email) cur.email = l.email;
        if (!cur.phone && l.phone_number) cur.phone = l.phone_number;
        if (!cur.name) cur.name = [l.first_name, l.last_name].filter(Boolean).join(" ");
        if (new Date(l.created_at) > new Date(cur.lastSeen)) cur.lastSeen = l.created_at;
        if (new Date(l.created_at) < new Date(cur.firstSeen)) cur.firstSeen = l.created_at;
        map.set(key, cur);
      });
    return Array.from(map.values()).sort((a, b) => b.totalSpend - a.totalSpend);
  }, [logs]);

  const customerCarrierOptions = useMemo(() => {
    const set = new Set<string>();
    byCustomer.forEach((c) => c.carriers.forEach((x) => set.add(x)));
    return Array.from(set).sort();
  }, [byCustomer]);

  const [customerSearch, setCustomerSearch] = useState("");
  const [customerCarrierFilter, setCustomerCarrierFilter] = useState<string>("all");
  const [customerRepeatOnly, setCustomerRepeatOnly] = useState(false);
  const filteredCustomers = useMemo(() => {
    const s = customerSearch.toLowerCase().trim();
    return byCustomer.filter((c) => {
      if (customerCarrierFilter !== "all" && !c.carriers.has(customerCarrierFilter)) return false;
      if (customerRepeatOnly && c.orders < 2) return false;
      if (s && !`${c.email} ${c.phone} ${c.name} ${Array.from(c.carriers).join(" ")}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [byCustomer, customerSearch, customerCarrierFilter, customerRepeatOnly]);

  const customerKpis = useMemo(() => {
    const total = filteredCustomers.length;
    const revenue = filteredCustomers.reduce((s, c) => s + c.totalSpend, 0);
    const orders = filteredCustomers.reduce((s, c) => s + c.orders, 0);
    const repeat = filteredCustomers.filter((c) => c.orders >= 2).length;
    const withEmail = filteredCustomers.filter((c) => !!c.email).length;
    const withPhone = filteredCustomers.filter((c) => !!c.phone).length;
    const avgSpend = total ? revenue / total : 0;
    return { total, revenue, orders, repeat, withEmail, withPhone, avgSpend };
  }, [filteredCustomers]);

  // ===== Marketing & funnel insights =====
  const insights = useMemo(() => {
    const success = logs.filter((l) => l.status === "success");
    const failed = logs.filter((l) => l.status === "failed");
    const attempts = success.length + failed.length;

    const visitorToAttempt = periodVisitors ? (attempts / periodVisitors) * 100 : 0;
    const attemptToSuccess = attempts ? (success.length / attempts) * 100 : 0;
    const visitorToSuccess = periodVisitors ? (success.length / periodVisitors) * 100 : 0;

    const customerKeys = new Map<string, number>();
    success.forEach((l) => {
      const k = (l.email || l.phone_number || "").toLowerCase();
      if (!k) return;
      customerKeys.set(k, (customerKeys.get(k) || 0) + 1);
    });
    const repeatCustomers = Array.from(customerKeys.values()).filter((n) => n >= 2).length;
    const newCustomers = Array.from(customerKeys.values()).filter((n) => n === 1).length;
    const repeatRate = customerKeys.size ? (repeatCustomers / customerKeys.size) * 100 : 0;

    const totalRevenue = success.reduce((s, l) => s + (Number(l.total) || Number(l.amount) || 0), 0);
    const clv = customerKeys.size ? totalRevenue / customerKeys.size : 0;
    const avgOrdersPerCustomer = customerKeys.size ? success.length / customerKeys.size : 0;

    const failMap = new Map<string, number>();
    failed.forEach((l) => {
      const reason = (l.error_message || "Unknown").slice(0, 80);
      failMap.set(reason, (failMap.get(reason) || 0) + 1);
    });
    const topFailures = Array.from(failMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

    const hourly = new Array(24).fill(0) as number[];
    success.forEach((l) => { hourly[new Date(l.created_at).getHours()] += 1; });
    const peakHour = hourly.indexOf(Math.max(...hourly));

    const dowNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dow = new Array(7).fill(0) as number[];
    success.forEach((l) => { dow[new Date(l.created_at).getDay()] += 1; });
    const peakDay = dowNames[dow.indexOf(Math.max(...dow))];

    const planMap = new Map<string, { count: number; revenue: number }>();
    success.forEach((l) => {
      const k = `${carrierLabel(l)} • plan ${l.plan_id || "—"}`;
      const cur = planMap.get(k) || { count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += Number(l.total) || Number(l.amount) || 0;
      planMap.set(k, cur);
    });
    const topPlans = Array.from(planMap.entries()).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10);

    const methodStats = new Map<string, { ok: number; fail: number }>();
    [...success, ...failed].forEach((l) => {
      const k = l.payment_method || "unknown";
      const cur = methodStats.get(k) || { ok: 0, fail: 0 };
      if (l.status === "success") cur.ok += 1; else cur.fail += 1;
      methodStats.set(k, cur);
    });
    const methodConv = Array.from(methodStats.entries())
      .map(([k, v]) => ({ method: k, rate: v.ok + v.fail ? (v.ok / (v.ok + v.fail)) * 100 : 0, total: v.ok + v.fail }))
      .sort((a, b) => b.total - a.total);

    const carrierStats = new Map<string, { ok: number; fail: number; revenue: number }>();
    [...success, ...failed].forEach((l) => {
      const k = carrierLabel(l);
      const cur = carrierStats.get(k) || { ok: 0, fail: 0, revenue: 0 };
      if (l.status === "success") { cur.ok += 1; cur.revenue += Number(l.total) || Number(l.amount) || 0; }
      else cur.fail += 1;
      carrierStats.set(k, cur);
    });
    const carrierConv = Array.from(carrierStats.entries())
      .map(([k, v]) => ({ carrier: k, rate: v.ok + v.fail ? (v.ok / (v.ok + v.fail)) * 100 : 0, total: v.ok + v.fail, revenue: v.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const uniqueEmails = new Set(success.map((l) => (l.email || "").toLowerCase()).filter(Boolean)).size;
    const uniquePhones = new Set(success.map((l) => l.phone_number).filter(Boolean)).size;

    const domainMap = new Map<string, number>();
    success.forEach((l) => {
      const d = (l.email || "").split("@")[1]?.toLowerCase();
      if (d) domainMap.set(d, (domainMap.get(d) || 0) + 1);
    });
    const topDomains = Array.from(domainMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

    const areaMap = new Map<string, number>();
    success.forEach((l) => {
      const digits = (l.phone_number || "").replace(/\D/g, "");
      const area = digits.length >= 10 ? digits.slice(-10, -7) : "";
      if (area) areaMap.set(area, (areaMap.get(area) || 0) + 1);
    });
    const topAreas = Array.from(areaMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

    return {
      visitorToAttempt, attemptToSuccess, visitorToSuccess,
      newCustomers, repeatCustomers, repeatRate, clv, avgOrdersPerCustomer,
      topFailures, hourly, peakHour, dow, peakDay, dowNames,
      topPlans, methodConv, carrierConv,
      uniqueEmails, uniquePhones, topDomains, topAreas,
      attempts, successCount: success.length, failedCount: failed.length,
    };
  }, [logs, periodVisitors]);

  const exportCustomersCSV = () => {
    const rows = [
      ["Name", "Email", "Phone", "Carriers", "Payment Methods", "Orders", "Total Spend", "Avg Order", "First Order", "Last Order"],
      ...filteredCustomers.map((c) => [
        c.name,
        c.email,
        c.phone,
        Array.from(c.carriers).join("; "),
        Array.from(c.methods).join("; "),
        String(c.orders),
        c.totalSpend.toFixed(2),
        (c.orders ? c.totalSpend / c.orders : 0).toFixed(2),
        new Date(c.firstSeen).toISOString(),
        new Date(c.lastSeen).toISOString(),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const methodOptions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => l.payment_method && set.add(l.payment_method));
    return Array.from(set);
  }, [logs]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  const handleSectionChange = (next: Section) => {
    setSection(next);
    navigate(next === "overview" ? "/admin" : `/admin/${next}`);
  };

  if (!authChecked) {
    return <div className="p-8"><Skeleton className="h-32 w-full" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="text-muted-foreground max-w-md">
          Your account is signed in but does not have admin privileges. Ask an existing admin to grant you the admin role.
        </p>
        <Button onClick={handleLogout} variant="outline">Sign out</Button>
      </div>
    );
  }

  const fmt$ = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/20">
        <Sidebar collapsible="icon">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>CellPay Admin</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV.map((n) => (
                    <SidebarMenuItem key={n.id}>
                      <SidebarMenuButton isActive={section === n.id} onClick={() => handleSectionChange(n.id)}>
                        <n.icon className="h-4 w-4" />
                        <span>{n.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="bg-background border-b sticky top-0 z-10">
            <div className="px-4 py-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                <div>
                  <h1 className="text-xl font-bold">{NAV.find((n) => n.id === section)?.label}</h1>
                  <p className="text-xs text-muted-foreground">Live transaction dashboard</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate("/")}>← Back to site</Button>
                <Select value={range} onValueChange={setRange}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RANGES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={handleLogout}>Sign out</Button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 space-y-6 max-w-7xl w-full mx-auto">
            {section === "overview" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  <KpiCard title="Live visitors" value={String(liveVisitors.length)} sub="active in last 60s" />
                  <KpiCard title="Visitors (range)" value={periodVisitors.toLocaleString()} sub="unique sessions" />
                  <KpiCard title="Revenue" value={fmt$(kpis.revenue)} sub={`${kpis.successCount} successful`} />
                  <KpiCard title="Conversion" value={`${insights.visitorToSuccess.toFixed(2)}%`} sub="visitor → paid" />
                  <KpiCard title="Checkout success" value={`${insights.attemptToSuccess.toFixed(1)}%`} sub={`${kpis.failed} failed`} />
                  <KpiCard title="Avg order value" value={fmt$(kpis.aov)} sub="successful only" />
                  <KpiCard title="Repeat rate" value={`${insights.repeatRate.toFixed(1)}%`} sub={`${insights.repeatCustomers} repeat`} />
                </div>
              </>
            )}

            {section === "insights" && (
              <div className="space-y-6">
                {/* Funnel */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Conversion funnel</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <FunnelStep label="Visitors" value={periodVisitors.toLocaleString()} sub="unique sessions in range" />
                      <FunnelStep label="Checkout attempts" value={insights.attempts.toLocaleString()} sub={`${insights.visitorToAttempt.toFixed(2)}% of visitors`} />
                      <FunnelStep label="Paid customers" value={insights.successCount.toLocaleString()} sub={`${insights.visitorToSuccess.toFixed(2)}% of visitors • ${insights.attemptToSuccess.toFixed(1)}% of attempts`} />
                    </div>
                  </CardContent>
                </Card>

                {/* Customer KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  <KpiCard title="New customers" value={insights.newCustomers.toLocaleString()} sub="1 order in range" />
                  <KpiCard title="Repeat customers" value={insights.repeatCustomers.toLocaleString()} sub={`${insights.repeatRate.toFixed(1)}% of buyers`} />
                  <KpiCard title="Customer LTV" value={fmt$(insights.clv)} sub="avg spend / buyer" />
                  <KpiCard title="Orders / customer" value={insights.avgOrdersPerCustomer.toFixed(2)} sub="repeat purchase index" />
                  <KpiCard title="Reachable emails" value={insights.uniqueEmails.toLocaleString()} sub="unique buyer emails" />
                  <KpiCard title="Reachable phones" value={insights.uniquePhones.toLocaleString()} sub="unique buyer phones" />
                </div>

                {/* When customers buy */}
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Best time of day <span className="text-xs font-normal text-muted-foreground">(peak {insights.peakHour}:00)</span></CardTitle></CardHeader>
                    <CardContent>
                      <BarRow items={insights.hourly.map((v, i) => ({ label: `${i}:00`, value: v }))} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Best day of week <span className="text-xs font-normal text-muted-foreground">(peak {insights.peakDay})</span></CardTitle></CardHeader>
                    <CardContent>
                      <BarRow items={insights.dow.map((v, i) => ({ label: insights.dowNames[i], value: v }))} />
                    </CardContent>
                  </Card>
                </div>

                {/* Plans + Carrier conversion */}
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Top refill plans by revenue</CardTitle></CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader><TableRow><TableHead>Plan</TableHead><TableHead className="text-right">Sold</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {insights.topPlans.map(([k, v]) => (
                            <TableRow key={k}><TableCell className="text-xs">{k}</TableCell><TableCell className="text-right text-xs">{v.count}</TableCell><TableCell className="text-right text-xs font-semibold">{fmt$(v.revenue)}</TableCell></TableRow>
                          ))}
                          {insights.topPlans.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No data</TableCell></TableRow>}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Carrier conversion</CardTitle></CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader><TableRow><TableHead>Carrier</TableHead><TableHead className="text-right">Attempts</TableHead><TableHead className="text-right">Conv %</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {insights.carrierConv.map((c) => (
                            <TableRow key={c.carrier}><TableCell className="text-xs">{c.carrier}</TableCell><TableCell className="text-right text-xs">{c.total}</TableCell><TableCell className="text-right text-xs">{c.rate.toFixed(1)}%</TableCell><TableCell className="text-right text-xs font-semibold">{fmt$(c.revenue)}</TableCell></TableRow>
                          ))}
                          {insights.carrierConv.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No data</TableCell></TableRow>}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>

                {/* Payment method conversion + failure reasons */}
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Payment method conversion</CardTitle></CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader><TableRow><TableHead>Method</TableHead><TableHead className="text-right">Attempts</TableHead><TableHead className="text-right">Success %</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {insights.methodConv.map((m) => (
                            <TableRow key={m.method}><TableCell className="text-xs">{m.method}</TableCell><TableCell className="text-right text-xs">{m.total}</TableCell><TableCell className="text-right text-xs">{m.rate.toFixed(1)}%</TableCell></TableRow>
                          ))}
                          {insights.methodConv.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No data</TableCell></TableRow>}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Top failure reasons</CardTitle></CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader><TableRow><TableHead>Reason</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {insights.topFailures.map(([k, v]) => (
                            <TableRow key={k}><TableCell className="text-xs">{k}</TableCell><TableCell className="text-right text-xs">{v}</TableCell></TableRow>
                          ))}
                          {insights.topFailures.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No failures 🎉</TableCell></TableRow>}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>

                {/* Geo & email domain */}
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Top email domains</CardTitle></CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader><TableRow><TableHead>Domain</TableHead><TableHead className="text-right">Customers</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {insights.topDomains.map(([k, v]) => (
                            <TableRow key={k}><TableCell className="text-xs">{k}</TableCell><TableCell className="text-right text-xs">{v}</TableCell></TableRow>
                          ))}
                          {insights.topDomains.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No data</TableCell></TableRow>}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Top US area codes <span className="text-xs font-normal text-muted-foreground">(geo signal from phone)</span></CardTitle></CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader><TableRow><TableHead>Area code</TableHead><TableHead className="text-right">Customers</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {insights.topAreas.map(([k, v]) => (
                            <TableRow key={k}><TableCell className="text-xs">{k}</TableCell><TableCell className="text-right text-xs">{v}</TableCell></TableRow>
                          ))}
                          {insights.topAreas.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No data</TableCell></TableRow>}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {section === "visitors" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Visitors by page <span className="text-xs font-normal text-muted-foreground">(live, last 60s)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Page</TableHead><TableHead className="text-right">People</TableHead></TableRow></TableHeader>
              <TableBody>
                {visitorsByPath.map(([path, count]) => (
                  <TableRow key={path}><TableCell className="font-mono text-xs">{path}</TableCell><TableCell className="text-right">{count}</TableCell></TableRow>
                ))}
                {visitorsByPath.length === 0 && (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No one online right now</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
            )}

            {section === "breakdowns" && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">By carrier <span className="text-xs font-normal text-muted-foreground">(click a row to view transactions)</span></CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Carrier</TableHead><TableHead className="text-right">Success</TableHead><TableHead className="text-right">Failed</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                <TableBody>
                  {byCarrier.slice(0, 20).map(([k, v]) => (
                    <TableRow key={k} className="cursor-pointer" onClick={() => { setCarrierFilter(k); setMethodFilter("all"); setStatusFilter("all"); setSearch(""); handleSectionChange("transactions"); }}>
                      <TableCell>{k}</TableCell>
                      <TableCell className="text-right text-green-600 font-medium">{v.success}</TableCell>
                      <TableCell className="text-right text-red-600 font-medium">{v.failed}</TableCell>
                      <TableCell className="text-right">{fmt$(v.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  {byCarrier.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No data</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">By payment method <span className="text-xs font-normal text-muted-foreground">(click a row to view transactions)</span></CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Method</TableHead><TableHead className="text-right">Success</TableHead><TableHead className="text-right">Failed</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                <TableBody>
                  {byMethod.map(([k, v]) => (
                    <TableRow key={k} className="cursor-pointer" onClick={() => { setMethodFilter(k); setCarrierFilter("all"); setStatusFilter("all"); setSearch(""); handleSectionChange("transactions"); }}>
                      <TableCell>{k}</TableCell>
                      <TableCell className="text-right text-green-600 font-medium">{v.success}</TableCell>
                      <TableCell className="text-right text-red-600 font-medium">{v.failed}</TableCell>
                      <TableCell className="text-right">{fmt$(v.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  {byMethod.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No data</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
            )}

            {section === "customers" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: "Customers", value: customerKpis.total.toLocaleString() },
              { label: "Revenue", value: fmt$(customerKpis.revenue) },
              { label: "Orders", value: customerKpis.orders.toLocaleString() },
              { label: "Avg Spend", value: fmt$(customerKpis.avgSpend) },
              { label: "Repeat Buyers", value: `${customerKpis.repeat} (${customerKpis.total ? Math.round((customerKpis.repeat / customerKpis.total) * 100) : 0}%)` },
              { label: "With Email", value: customerKpis.withEmail.toLocaleString() },
              { label: "With Phone", value: customerKpis.withPhone.toLocaleString() },
            ].map((k) => (
              <Card key={k.label}>
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">{k.label}</div>
                  <div className="text-lg font-semibold mt-1">{k.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
                <CardTitle className="text-base">
                  Paying Customers <span className="text-xs font-normal text-muted-foreground">({filteredCustomers.length} unique • successful orders only)</span>
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Input
                    placeholder="Search name, email, phone, carrier..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-[260px]"
                  />
                  <Select value={customerCarrierFilter} onValueChange={setCustomerCarrierFilter}>
                    <SelectTrigger className="w-[160px]"><SelectValue placeholder="Carrier" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All carriers</SelectItem>
                      {customerCarrierOptions.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant={customerRepeatOnly ? "default" : "outline"}
                    onClick={() => setCustomerRepeatOnly((v) => !v)}
                  >
                    Repeat only
                  </Button>
                  <Button variant="outline" onClick={exportCustomersCSV}>Export CSV</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Carriers</TableHead>
                      <TableHead>Methods</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Total Spend</TableHead>
                      <TableHead className="text-right">Avg</TableHead>
                      <TableHead>Last Order</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.slice(0, 500).map((c) => (
                      <TableRow key={`${c.email}-${c.phone}`}>
                        <TableCell className="text-xs">{c.name || "—"}</TableCell>
                        <TableCell className="text-xs">{c.email || "—"}</TableCell>
                        <TableCell className="text-xs">{c.phone || "—"}</TableCell>
                        <TableCell className="text-xs max-w-[180px] truncate" title={Array.from(c.carriers).join(", ")}>
                          {Array.from(c.carriers).join(", ") || "—"}
                        </TableCell>
                        <TableCell className="text-xs">{Array.from(c.methods).join(", ") || "—"}</TableCell>
                        <TableCell className="text-right text-xs">{c.orders}</TableCell>
                        <TableCell className="text-right text-xs font-semibold">{fmt$(c.totalSpend)}</TableCell>
                        <TableCell className="text-right text-xs">{fmt$(c.orders ? c.totalSpend / c.orders : 0)}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{new Date(c.lastSeen).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No paying customers in this range.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
            )}

            {section === "transactions" && (
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
              <CardTitle className="text-base">Live transactions <span className="text-xs font-normal text-muted-foreground">(realtime)</span></CardTitle>
              <div className="flex flex-wrap gap-2">
                <Input placeholder="Search phone, email, hashid..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-[260px]" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={methodFilter} onValueChange={setMethodFilter}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Method" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All methods</SelectItem>
                    {methodOptions.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={carrierFilter} onValueChange={setCarrierFilter}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Carrier" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All carriers</SelectItem>
                    {byCarrier.map(([k]) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <TxScrollTable>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead>Refill</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Error / Hashid</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.slice(0, 200).map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</TableCell>
                        <TableCell className="text-xs">{carrierLabel(l)}</TableCell>
                        <TableCell className="text-xs font-mono">
                          <div>plan: {l.plan_id || "—"}</div>
                          <div className="text-muted-foreground">carrier: {l.carrier_id || "—"}</div>
                        </TableCell>
                        <TableCell className="text-xs">{l.phone_number || "—"}</TableCell>
                        <TableCell className="text-xs">
                          <div>{[l.first_name, l.last_name].filter(Boolean).join(" ") || "—"}</div>
                          <div className="text-muted-foreground">{l.email}</div>
                        </TableCell>
                        <TableCell className="text-xs">{l.payment_method}{l.card_type ? ` (${l.card_type})` : ""}</TableCell>
                        <TableCell className="text-right text-xs">{fmt$(Number(l.total) || Number(l.amount) || 0)}</TableCell>
                        <TableCell><StatusBadge status={l.status} /></TableCell>
                        <TableCell className="text-xs max-w-[260px] truncate" title={l.error_message || l.hashid || ""}>
                          {l.status === "success" ? (l.hashid || l.transaction_id || "") : (l.error_message || "")}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => setDetailLog(l)}>View JSON</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No transactions match the filters.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TxScrollTable>
            )}
          </CardContent>
        </Card>
            )}
          </main>
        </div>

        <Dialog open={!!detailLog} onOpenChange={(o) => !o && setDetailLog(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Transaction details</DialogTitle>
            </DialogHeader>
            {detailLog && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Info label="Time" value={new Date(detailLog.created_at).toLocaleString()} />
                  <Info label="Status" value={detailLog.status} />
                  <Info label="Method" value={detailLog.payment_method || "—"} />
                  <Info label="Card" value={detailLog.card_type || "—"} />
                  <Info label="Carrier" value={carrierLabel(detailLog)} />
                  <Info label="Carrier ID" value={detailLog.carrier_id || "—"} />
                  <Info label="Plan ID" value={detailLog.plan_id || "—"} />
                  <Info label="Phone" value={detailLog.phone_number || "—"} />
                  <Info label="Email" value={detailLog.email || "—"} />
                  <Info label="Name" value={[detailLog.first_name, detailLog.last_name].filter(Boolean).join(" ") || "—"} />
                  <Info label="Amount" value={fmt$(Number(detailLog.amount) || 0)} />
                  <Info label="Total" value={fmt$(Number(detailLog.total) || 0)} />
                  <Info label="Hashid" value={detailLog.hashid || "—"} />
                  <Info label="Txn ID" value={detailLog.transaction_id || "—"} />
                  <Info label="Source IP" value={detailLog.source_ip || "—"} />
                </div>
                {detailLog.error_message && (
                  <JsonBlock title="Error" value={detailLog.error_message} />
                )}
                <JsonBlock title="Request / Metadata" value={JSON.stringify(detailLog.metadata ?? {}, null, 2)} />
                <JsonBlock title="Raw Response" value={JSON.stringify(detailLog.raw_response ?? {}, null, 2)} />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </SidebarProvider>
  );
}

function KpiCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    success: "bg-green-500/15 text-green-700 border-green-500/30",
    failed: "bg-red-500/15 text-red-700 border-red-500/30",
    pending: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  };
  return <Badge variant="outline" className={map[status] || ""}>{status}</Badge>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded p-2 bg-muted/30">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono break-all">{value}</div>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: string }) {
  const copy = () => navigator.clipboard.writeText(value);
  return (
    <div className="border rounded">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <span className="font-semibold">{title}</span>
        <Button size="sm" variant="ghost" onClick={copy}>Copy</Button>
      </div>
      <pre className="text-[11px] p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto">{value || "—"}</pre>
    </div>
  );
}

function TxScrollTable({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const getScroller = (): HTMLElement | null => {
    const outer = ref.current;
    if (!outer) return null;
    // shadcn <Table> wraps the table in its own div with overflow-auto.
    const inner = outer.querySelector<HTMLElement>(":scope > div");
    return inner || outer;
  };
  const scroll = (dir: "left" | "right") => {
    const el = getScroller();
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -400 : 400, behavior: "smooth" });
  };
  return (
    <div className="relative">
      <div className="flex justify-end gap-2 mb-2">
        <Button size="sm" variant="outline" onClick={() => scroll("left")} aria-label="Scroll left">
          <ChevronLeft className="h-4 w-4" /> Left
        </Button>
        <Button size="sm" variant="outline" onClick={() => scroll("right")} aria-label="Scroll right">
          Right <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div ref={ref} className="overflow-x-auto rounded-md border">
        {children}
      </div>
    </div>
  );
}

function FunnelStep({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function BarRow({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-1">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-2 text-xs">
          <div className="w-12 text-muted-foreground">{i.label}</div>
          <div className="flex-1 h-3 bg-muted rounded overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
          <div className="w-10 text-right tabular-nums">{i.value}</div>
        </div>
      ))}
    </div>
  );
}
