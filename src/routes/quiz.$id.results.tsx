import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, ChevronDown, RotateCcw, UploadCloud, Sparkles } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({ attempt: z.string().optional() });

export const Route = createFileRoute("/quiz/$id/results")({
  validateSearch: (s) => searchSchema.parse(s),
  component: ResultsPage,
});

type Q = { id: string; question_text: string; options: string[]; correct_index: number; explanation: string | null; position: number };
type A = { question_id: string; selected_index: number | null; is_correct: boolean };

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const dur = 1100;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{v}{suffix}</>;
}

function ResultsPage() {
  const { id } = Route.useParams();
  const { attempt } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Q[] | null>(null);
  const [answers, setAnswers] = useState<A[]>([]);
  const [score, setScore] = useState({ correct: 0, total: 0, pct: 0, passed: false });
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user || !attempt) return;
    (async () => {
      const [{ data: at }, { data: ans }, { data: qs }] = await Promise.all([
        supabase.from("attempts").select("score,total,percentage,passed").eq("id", attempt).maybeSingle(),
        supabase.from("attempt_answers").select("question_id,selected_index,is_correct").eq("attempt_id", attempt),
        supabase.from("questions").select("*").eq("quiz_id", id).order("position"),
      ]);
      if (at) setScore({ correct: at.score, total: at.total, pct: Math.round(Number(at.percentage)), passed: at.passed });
      setAnswers((ans ?? []) as any);
      setQuestions((qs ?? []) as any);
    })();
  }, [user, attempt, id]);

  if (!questions) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
          <Skeleton className="h-40" /><Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const ansMap: Record<string, A> = {};
  answers.forEach((a) => (ansMap[a.question_id] = a));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
          className="overflow-hidden rounded-3xl border border-border gradient-card p-8 text-center shadow-elevated sm:p-12"
        >
          <div className={`mx-auto inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${score.passed ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
            {score.passed ? <><CheckCircle2 className="h-3.5 w-3.5" /> Passed</> : <><XCircle className="h-3.5 w-3.5" /> Keep practicing</>}
          </div>
          <div className="mt-6 font-display text-7xl font-bold sm:text-8xl">
            <span className="text-gradient"><CountUp to={score.pct} suffix="%" /></span>
          </div>
          <p className="mt-3 text-muted-foreground">
            You got <span className="font-semibold text-foreground">{score.correct}</span> out of{" "}
            <span className="font-semibold text-foreground">{score.total}</span> correct
          </p>
          <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl border border-border bg-surface-elevated/50 p-3">
              <div className="text-xs text-muted-foreground">Correct</div>
              <div className="mt-1 font-display text-2xl font-semibold text-success">{score.correct}</div>
            </div>
            <div className="rounded-xl border border-border bg-surface-elevated/50 p-3">
              <div className="text-xs text-muted-foreground">Incorrect</div>
              <div className="mt-1 font-display text-2xl font-semibold text-destructive">{score.total - score.correct}</div>
            </div>
            <div className="rounded-xl border border-border bg-surface-elevated/50 p-3">
              <div className="text-xs text-muted-foreground">Marks</div>
              <div className="mt-1 font-display text-2xl font-semibold">{score.correct}/{score.total}</div>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button variant="hero" onClick={() => navigate({ to: "/quiz/$id", params: { id } })}>
              <RotateCcw className="h-4 w-4" /> Retake quiz
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/upload" })}>
              <UploadCloud className="h-4 w-4" /> Upload new PDF
            </Button>
          </div>
        </motion.div>

        <h2 className="mt-12 font-display text-2xl font-semibold">Review answers</h2>
        <div className="mt-4 space-y-3">
          {questions.map((q, idx) => {
            const a = ansMap[q.id];
            const isOpen = open[q.id];
            return (
              <motion.div
                key={q.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
                className="rounded-2xl border border-border gradient-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {a?.is_correct ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />}
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">Question {idx + 1}</div>
                      <p className="mt-1 font-medium leading-snug">{q.question_text}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {q.options.map((opt, i) => {
                    const isCorrect = i === Number(q.correct_index);
                    const isSelected = a?.selected_index !== null && a?.selected_index !== undefined && Number(a.selected_index) === i;
                    const cls = isCorrect
                      ? "border-success/60 bg-success/10 text-foreground"
                      : isSelected
                      ? "border-destructive/60 bg-destructive/10 text-foreground"
                      : "border-border bg-surface-elevated/40 text-muted-foreground";
                    return (
                      <div key={i} className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm ${cls}`}>
                        {isCorrect ? <CheckCircle2 className="h-4 w-4 text-success" /> :
                         isSelected ? <XCircle className="h-4 w-4 text-destructive" /> :
                         <span className="h-4 w-4" />}
                        <span>{opt}</span>
                      </div>
                    );
                  })}
                </div>
                {q.explanation && (
                  <button onClick={() => setOpen((o) => ({ ...o, [q.id]: !o[q.id] }))} className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                    <Sparkles className="h-3.5 w-3.5" /> AI explanation
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                )}
                {isOpen && q.explanation && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground"
                  >
                    {q.explanation}
                  </motion.p>
                )}
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
