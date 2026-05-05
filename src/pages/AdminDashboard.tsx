import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tables } from "@/integrations/supabase/types";

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
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [logs, setLogs] = useState<TxLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("7d");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [now, setNow] = useState(Date.now());

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

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (methodFilter !== "all" && l.payment_method !== methodFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const blob = `${l.email || ""} ${l.phone_number || ""} ${l.first_name || ""} ${l.last_name || ""} ${l.hashid || ""} ${l.transaction_id || ""}`.toLowerCase();
        if (!blob.includes(s)) return false;
      }
      return true;
    });
  }, [logs, statusFilter, methodFilter, search]);

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
    const map = new Map<string, { count: number; revenue: number }>();
    filtered.forEach((l) => {
      const k = l.carrier_name || l.carrier_slug || (l.carrier_id ? `Carrier #${l.carrier_id}` : "Unknown");
      const cur = map.get(k) || { count: 0, revenue: 0 };
      cur.count += 1;
      if (l.status === "success") cur.revenue += Number(l.total) || Number(l.amount) || 0;
      map.set(k, cur);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].revenue - a[1].revenue);
  }, [filtered]);

  const byMethod = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    filtered.forEach((l) => {
      const k = l.payment_method || "unknown";
      const cur = map.get(k) || { count: 0, revenue: 0 };
      cur.count += 1;
      if (l.status === "success") cur.revenue += Number(l.total) || Number(l.amount) || 0;
      map.set(k, cur);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [filtered]);

  const methodOptions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => l.payment_method && set.add(l.payment_method));
    return Array.from(set);
  }, [logs]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
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
    <div className="min-h-screen bg-muted/20">
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">CellPay Admin</h1>
            <p className="text-xs text-muted-foreground">Live transaction dashboard</p>
          </div>
          <div className="flex gap-2">
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

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KpiCard title="Live visitors" value={String(liveVisitors.length)} sub="active in last 60s" />
          <KpiCard title="Revenue" value={fmt$(kpis.revenue)} sub={`${kpis.successCount} successful`} />
          <KpiCard title="Total attempts" value={String(kpis.total)} sub={`${kpis.pending} pending`} />
          <KpiCard title="Success rate" value={`${kpis.successRate.toFixed(1)}%`} sub={`${kpis.failed} failed`} />
          <KpiCard title="Avg order value" value={fmt$(kpis.aov)} sub="successful only" />
        </div>

        {/* Live visitors by page */}
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

        {/* Breakdowns */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">By carrier</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Carrier</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                <TableBody>
                  {byCarrier.slice(0, 10).map(([k, v]) => (
                    <TableRow key={k}><TableCell>{k}</TableCell><TableCell className="text-right">{v.count}</TableCell><TableCell className="text-right">{fmt$(v.revenue)}</TableCell></TableRow>
                  ))}
                  {byCarrier.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No data</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">By payment method</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Method</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                <TableBody>
                  {byMethod.map(([k, v]) => (
                    <TableRow key={k}><TableCell>{k}</TableCell><TableCell className="text-right">{v.count}</TableCell><TableCell className="text-right">{fmt$(v.revenue)}</TableCell></TableRow>
                  ))}
                  {byMethod.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No data</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Live feed */}
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
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Error / Hashid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.slice(0, 200).map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</TableCell>
                        <TableCell className="text-xs">{l.carrier_name || l.carrier_slug || "—"}</TableCell>
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
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No transactions match the filters.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
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
