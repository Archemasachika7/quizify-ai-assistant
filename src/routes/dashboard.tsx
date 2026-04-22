import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Plus, BookOpen, Trophy, Target, Sparkles, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

type Quiz = { id: string; title: string; description: string | null; question_count: number; created_at: string };
type Stats = { totalQuizzes: number; attempts: number; avgScore: number };

function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null);
  const [bestScores, setBestScores] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<Stats>({ totalQuizzes: 0, attempts: 0, avgScore: 0 });
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: qz }, { data: at }, { data: prof }] = await Promise.all([
        supabase.from("quizzes").select("*").order("created_at", { ascending: false }),
        supabase.from("attempts").select("quiz_id, percentage"),
        supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
      ]);
      setQuizzes(qz ?? []);
      const best: Record<string, number> = {};
      let total = 0;
      (at ?? []).forEach((a) => {
        const p = Number(a.percentage);
        best[a.quiz_id] = Math.max(best[a.quiz_id] ?? 0, p);
        total += p;
      });
      setBestScores(best);
      setStats({
        totalQuizzes: qz?.length ?? 0,
        attempts: at?.length ?? 0,
        avgScore: at && at.length ? Math.round(total / at.length) : 0,
      });
      setDisplayName(prof?.display_name ?? user.email?.split("@")[0] ?? "");
    })();
  }, [user]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: "Total quizzes", value: stats.totalQuizzes, icon: BookOpen },
    { label: "Attempts", value: stats.attempts, icon: Target },
    { label: "Average score", value: `${stats.avgScore}%`, icon: Trophy },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            Hello, <span className="text-gradient">{displayName}</span>
          </h1>
        </motion.div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {statCards.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="rounded-2xl border border-border gradient-card p-6 shadow-card"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{s.label}</span>
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary">
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 font-display text-4xl font-bold">{s.value}</div>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold">Your quizzes</h2>
        </div>

        {quizzes === null ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-44" /><Skeleton className="h-44" /><Skeleton className="h-44" />
          </div>
        ) : quizzes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="mt-6 grid place-items-center rounded-2xl border border-dashed border-border gradient-card p-16 text-center"
          >
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/15 text-primary">
              <Sparkles className="h-7 w-7" />
            </div>
            <h3 className="mt-5 font-display text-xl font-semibold">No quizzes yet</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">Upload your first PDF and we'll generate an interactive quiz with AI explanations.</p>
            <Button variant="hero" size="lg" className="mt-6" onClick={() => navigate({ to: "/upload" })}>
              <Plus className="h-4 w-4" /> Upload your first PDF
            </Button>
          </motion.div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((q, i) => {
              const best = bestScores[q.id] ?? 0;
              return (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -4 }}
                  className="group flex flex-col rounded-2xl border border-border gradient-card p-5 shadow-card transition-all hover:border-primary/40 hover:shadow-elevated"
                >
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-base font-semibold leading-snug">{q.title}</h3>
                      <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{q.question_count} Qs</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{q.description || "Generated from your PDF"}</p>
                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Best score</span>
                        <span className="font-medium text-foreground">{Math.round(best)}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                        <div className="h-full gradient-primary transition-all" style={{ width: `${best}%` }} />
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">{new Date(q.created_at).toLocaleDateString()}</p>
                  </div>
                  <Link
                    to="/quiz/$id" params={{ id: q.id }}
                    className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary/15 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                  >
                    Start <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating upload button */}
      <button
        onClick={() => navigate({ to: "/upload" })}
        className="fixed bottom-6 right-6 z-30 grid h-14 w-14 place-items-center rounded-full gradient-primary text-primary-foreground shadow-glow transition-transform hover:scale-110 active:scale-95"
        aria-label="Upload PDF"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
