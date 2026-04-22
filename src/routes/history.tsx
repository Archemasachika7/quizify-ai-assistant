import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, History as HistoryIcon } from "lucide-react";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
});

type Row = { id: string; quiz_id: string; score: number; total: number; percentage: number; passed: boolean; completed_at: string; quizzes: { title: string } | null };

function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("attempts")
        .select("id,quiz_id,score,total,percentage,passed,completed_at,quizzes(title)")
        .order("completed_at", { ascending: false });
      setRows((data ?? []) as any);
    })();
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Attempt history</h1>
        <p className="mt-2 text-sm text-muted-foreground">All your past quiz attempts</p>

        {!rows ? (
          <div className="mt-8 space-y-2">
            <Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" />
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-12 grid place-items-center rounded-2xl border border-dashed border-border gradient-card p-16 text-center">
            <HistoryIcon className="h-10 w-10 text-muted-foreground" />
            <p className="mt-4 font-medium">No attempts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Take a quiz to see your history here.</p>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-2xl border border-border gradient-card">
            <div className="hidden border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:grid sm:grid-cols-[1fr_140px_120px_100px]">
              <span>Quiz</span><span>Date</span><span>Score</span><span>Result</span>
            </div>
            {rows.map((r, i) => (
              <motion.button
                key={r.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                onClick={() => navigate({ to: "/quiz/$id/results", params: { id: r.quiz_id }, search: { attempt: r.id } })}
                className="grid w-full grid-cols-[1fr_auto] items-center gap-3 border-t border-border px-5 py-4 text-left transition-colors hover:bg-white/[0.03] sm:grid-cols-[1fr_140px_120px_100px]"
              >
                <span className="font-medium">{r.quizzes?.title ?? "Untitled quiz"}</span>
                <span className="hidden text-sm text-muted-foreground sm:block">{new Date(r.completed_at).toLocaleDateString()}</span>
                <span className="text-sm font-semibold sm:text-base">{Math.round(Number(r.percentage))}%</span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${r.passed ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                  {r.passed ? <><CheckCircle2 className="h-3 w-3" /> Pass</> : <><XCircle className="h-3 w-3" /> Fail</>}
                </span>
              </motion.button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
