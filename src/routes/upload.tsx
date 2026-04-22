import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UploadCloud, FileText, Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

export const Route = createFileRoute("/upload")({
  component: UploadPage,
});

type Stage = "idle" | "uploading" | "extracting" | "generating" | "done" | "error";

async function readPdfText(file: File): Promise<string> {
  // Lazy load pdfjs and bundle the worker locally via Vite (?url) to avoid CDN/version mismatches
  const pdfjs: any = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let text = "";
  const pageCount = Math.min(doc.numPages, 50);
  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: any) => it.str).join(" ") + "\n\n";
  }
  return text;
}

function UploadPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const handleFile = (f: File | null) => {
    setError(null);
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a PDF file"); setStage("error"); return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError("File too large (max 20MB)"); setStage("error"); return;
    }
    setFile(f); setStage("idle");
  };

  const startProcessing = async () => {
    if (!file || !user) return;
    setError(null);
    try {
      setStage("uploading");
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("pdfs").upload(path, file);
      if (upErr) throw upErr;

      setStage("extracting");
      const text = await readPdfText(file);
      if (!text.trim() || text.trim().length < 200) {
        throw new Error("Couldn't extract enough text from this PDF. Try a text-based (not scanned) PDF.");
      }

      setStage("generating");
      const title = file.name.replace(/\.pdf$/i, "");
      const { data, error: fnErr } = await supabase.functions.invoke("generate-quiz", {
        body: { text, title },
      });
      if (fnErr) throw fnErr;
      if ((data as any)?.error) throw new Error((data as any).error);

      const quiz = data as { title: string; description: string; questions: any[] };
      if (!quiz?.questions?.length) throw new Error("AI returned no questions");

      const { data: inserted, error: qErr } = await supabase
        .from("quizzes")
        .insert({
          user_id: user.id,
          title: quiz.title || title,
          description: quiz.description ?? null,
          pdf_path: path,
          question_count: quiz.questions.length,
        })
        .select("id")
        .single();
      if (qErr) throw qErr;

      const rows = quiz.questions.map((q, i) => ({
        quiz_id: inserted.id,
        position: i,
        question_text: q.question_text,
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation,
      }));
      const { error: insErr } = await supabase.from("questions").insert(rows);
      if (insErr) throw insErr;

      setStage("done");
      toast.success("Quiz ready!");
      setTimeout(() => navigate({ to: "/quiz/$id", params: { id: inserted.id } }), 600);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Something went wrong");
      setStage("error");
    }
  };

  const stages: { key: Stage; label: string }[] = [
    { key: "uploading", label: "Uploading PDF" },
    { key: "extracting", label: "Extracting text" },
    { key: "generating", label: "Generating quiz with AI" },
  ];

  const stageIndex = stages.findIndex((s) => s.key === stage);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-bold tracking-tight">Upload a PDF</h1>
          <p className="mt-2 text-muted-foreground">Drop a study PDF (max 20MB). We'll extract MCQs and generate explanations.</p>
        </motion.div>

        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0] ?? null); }}
          className={`mt-8 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
            stage === "error" ? "border-destructive/60 bg-destructive/5" :
            dragOver ? "border-primary bg-primary/10" :
            file ? "border-primary/40 bg-primary/5" :
            "border-border bg-surface/40 hover:border-primary/40 hover:bg-primary/5"
          }`}
        >
          <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
          <motion.div
            animate={{ scale: file ? 1 : [1, 1.08, 1] }}
            transition={{ duration: 2, repeat: file ? 0 : Infinity }}
            className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/15 text-primary"
          >
            {file ? <FileText className="h-7 w-7" /> : <UploadCloud className="h-7 w-7" />}
          </motion.div>
          {file ? (
            <>
              <p className="mt-4 font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </>
          ) : (
            <>
              <p className="mt-4 font-medium text-foreground">Drop your PDF here</p>
              <p className="text-sm text-muted-foreground">or click to browse</p>
            </>
          )}
        </label>

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        <AnimatePresence>
          {stage !== "idle" && stage !== "error" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6 space-y-3 rounded-2xl border border-border gradient-card p-5">
              {stages.map((s, idx) => {
                const active = stageIndex === idx && stage !== "done";
                const complete = stageIndex > idx || stage === "done";
                return (
                  <div key={s.key} className="flex items-center gap-3 text-sm">
                    {complete ? <CheckCircle2 className="h-5 w-5 text-primary" /> :
                     active ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> :
                     <div className="h-5 w-5 rounded-full border-2 border-border" />}
                    <span className={complete || active ? "text-foreground" : "text-muted-foreground"}>{s.label}</span>
                  </div>
                );
              })}
              {stage === "done" && (
                <div className="flex items-center gap-2 pt-2 text-sm text-primary">
                  <Sparkles className="h-4 w-4" /> Redirecting to your quiz…
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 flex justify-end">
          <Button variant="hero" size="lg" disabled={!file || (stage !== "idle" && stage !== "error")} onClick={startProcessing}>
            {stage === "idle" || stage === "error" ? "Generate quiz" : <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>}
          </Button>
        </div>
      </main>
    </div>
  );
}
