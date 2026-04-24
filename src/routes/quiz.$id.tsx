import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Circle, Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/quiz/$id")({
  component: QuizPage,
});

type Question = {
  id: string;
  position: number;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
};

function QuizPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: q }, { data: qs }] = await Promise.all([
        supabase.from("quizzes").select("title").eq("id", id).maybeSingle(),
        supabase.from("questions").select("*").eq("quiz_id", id).order("position"),
      ]);
      if (!q) { toast.error("Quiz not found"); navigate({ to: "/dashboard" }); return; }
      setTitle(q.title);
      setQuestions((qs ?? []) as any);
    })();
  }, [user, id, navigate]);

  const submit = async () => {
    if (!questions || !user) return;
    setSubmitting(true);
    try {
      let score = 0;
      const rows = questions.map((q) => {
        const sel = answers[q.id];
        const correct = sel === q.correct_index;
        if (correct) score++;
        return { question_id: q.id, selected_index: sel ?? null, is_correct: correct };
      });
      const total = questions.length;
      const pct = (score / total) * 100;
      const { data: attempt, error } = await supabase
        .from("attempts")
        .insert({
          user_id: user.id, quiz_id: id, score, total,
          percentage: pct, passed: pct >= 60,
        })
        .select("id")
        .single();
      if (error) throw error;
      const ansRows = rows.map((r) => ({ ...r, attempt_id: attempt.id }));
      const { error: aErr } = await supabase.from("attempt_answers").insert(ansRows);
      if (aErr) throw aErr;
      navigate({ to: "/quiz/$id/results", params: { id }, search: { attempt: attempt.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to submit");
      setSubmitting(false);
    }
  };

  if (!questions) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <p className="text-muted-foreground">This quiz has no questions.</p>
        </div>
      </div>
    );
  }

  const q = questions[current];
  const answeredCount = Object.keys(revealed).length;
  const allAnswered = answeredCount === questions.length;
  const isLast = current === questions.length - 1;
  const isCurrentRevealed = revealed[q.id] ?? false;
  const progress = ((current + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{title}</span>
          <span>{answeredCount} / {questions.length} answered</span>
        </div>
        <div className="mb-6 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
            <motion.div
              className="h-full gradient-primary"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <span className="text-xs font-medium text-foreground">{current + 1}/{questions.length}</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={q.id}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl border border-border gradient-card p-6 shadow-card sm:p-8"
          >
            <div className="text-xs font-medium uppercase tracking-wider text-primary">Question {current + 1}</div>
            <h2 className="mt-2 font-display text-xl font-semibold leading-snug sm:text-2xl">{q.question_text}</h2>
            <div className="mt-6 space-y-3">
              {q.options.map((opt, i) => {
                const selected = answers[q.id] === i;
                const isCorrectOption = i === q.correct_index;

                let optionClass: string;
                let Icon = Circle;

                if (isCurrentRevealed) {
                  if (isCorrectOption) {
                    optionClass = "border-success/60 bg-success/10 text-foreground cursor-default";
                    Icon = CheckCircle2;
                  } else if (selected) {
                    optionClass = "border-destructive/60 bg-destructive/10 text-foreground cursor-default";
                    Icon = XCircle;
                  } else {
                    optionClass = "border-border bg-surface-elevated/40 text-muted-foreground cursor-default opacity-60";
                  }
                } else if (selected) {
                  optionClass = "border-primary bg-primary/15 text-foreground shadow-glow";
                  Icon = CheckCircle2;
                } else {
                  optionClass = "border-border bg-surface-elevated/40 text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground";
                }

                return (
                  <button
                    key={i}
                    disabled={isCurrentRevealed}
                    onClick={() => {
                      setAnswers((a) => ({ ...a, [q.id]: i }));
                      setRevealed((r) => ({ ...r, [q.id]: true }));
                    }}
                    className={`group flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition-all duration-200 ${optionClass}`}
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${
                      isCurrentRevealed && isCorrectOption ? "text-success" :
                      isCurrentRevealed && selected ? "text-destructive" :
                      selected ? "text-primary" : ""
                    }`} />
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
            {isCurrentRevealed && q.explanation && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground"
              >
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{q.explanation}</span>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" disabled={current === 0} onClick={() => setCurrent((c) => Math.max(0, c - 1))}>
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          {isLast ? (
            <Button variant="hero" size="lg" disabled={!allAnswered || submitting} onClick={submit}>
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : "Submit quiz"}
            </Button>
          ) : (
            <Button variant="teal" onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
