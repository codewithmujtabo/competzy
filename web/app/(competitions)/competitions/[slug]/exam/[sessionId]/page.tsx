'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Camera, CameraOff, Clock, Loader2 } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TEXTAREA_CLS =
  'flex min-h-20 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

interface Period {
  id: string;
  number: number;
  type: string;
  questionContent: string;
  options: { id: string; content: string }[];
  answerId: string | null;
  shortAnswer: string | null;
}
interface SessionData {
  id: string;
  examName: string;
  finishedAt: string | null;
  remainingSeconds: number | null;
  periods: Period[];
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function ExamPlayerPage() {
  const router = useRouter();
  const { slug, sessionId } = useParams<{ slug: string; sessionId: string }>();
  const resultPath = `/competitions/${slug}/exam/${sessionId}/result`;

  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [mc, setMc] = useState<Record<string, string>>({});
  const [sa, setSa] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);
  // Webcam proctoring — best-effort.
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraOn, setCameraOn] = useState<boolean | null>(null);

  useEffect(() => {
    emcHttp
      .get<SessionData>(`/sessions/${sessionId}`)
      .then((s) => {
        if (s.finishedAt) {
          router.replace(resultPath);
          return;
        }
        setSession(s);
        setRemaining(s.remainingSeconds);
        setMc(Object.fromEntries(s.periods.filter((p) => p.answerId).map((p) => [p.id, p.answerId!])));
        setSa(
          Object.fromEntries(
            s.periods.filter((p) => p.shortAnswer != null).map((p) => [p.id, p.shortAnswer!]),
          ),
        );
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Draw the current webcam frame to a JPEG and upload it. Best-effort —
  // failures are swallowed so they never disrupt the exam.
  const captureSnapshot = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current || !video.videoWidth) return;
    canvas.width = 320;
    canvas.height = Math.round((320 * video.videoHeight) / video.videoWidth);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.7));
    if (!blob) return;
    const fd = new FormData();
    fd.append('image', blob, 'snapshot.jpg');
    try {
      await emcHttp.postFormData(`/sessions/${sessionId}/webcams`, fd);
    } catch {
      /* best-effort */
    }
  }, [sessionId]);

  const submit = useCallback(
    async (auto = false) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      try {
        await captureSnapshot();
        await emcHttp.post(`/sessions/${sessionId}/submit`, {});
        if (auto) toast.info('Time is up — your exam was submitted.');
        router.replace(resultPath);
      } catch (e) {
        submittedRef.current = false;
        setSubmitting(false);
        toast.error(e instanceof Error ? e.message : 'Failed to submit the exam');
      }
    },
    [sessionId, router, resultPath, captureSnapshot],
  );

  // Countdown — ticks every second; auto-submits at zero.
  useEffect(() => {
    if (remaining == null) return;
    if (remaining <= 0) {
      void submit(true);
      return;
    }
    const t = setTimeout(() => setRemaining((r) => (r == null ? r : r - 1)), 1000);
    return () => clearTimeout(t);
  }, [remaining, submit]);

  // Request the webcam once, report availability, and capture periodically.
  useEffect(() => {
    let cancelled = false;
    const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!md?.getUserMedia) {
      setCameraOn(false);
      emcHttp.put(`/sessions/${sessionId}/camera-status`, { available: false }).catch(() => {});
      return;
    }
    md.getUserMedia({ video: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setCameraOn(true);
        emcHttp.put(`/sessions/${sessionId}/camera-status`, { available: true }).catch(() => {});
      })
      .catch(() => {
        if (cancelled) return;
        setCameraOn(false);
        emcHttp.put(`/sessions/${sessionId}/camera-status`, { available: false }).catch(() => {});
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [sessionId]);

  // While the camera is on, snapshot every 30s (+ once shortly after start).
  useEffect(() => {
    if (cameraOn !== true) return;
    const first = setTimeout(() => void captureSnapshot(), 3000);
    const iv = setInterval(() => void captureSnapshot(), 30000);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, [cameraOn, captureSnapshot]);

  const saveAnswer = async (periodId: string, body: Record<string, unknown>) => {
    try {
      await emcHttp.put(`/sessions/${sessionId}/periods/${periodId}`, body);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save your answer');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <Card className="p-10 text-center">
          <p className="text-sm font-medium text-foreground">Exam session not found</p>
          <Button variant="outline" className="mt-4" onClick={() => router.replace(`/competitions/${slug}/dashboard`)}>
            Back to dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const answered = session.periods.filter(
    (p) => (p.type === 'short' ? sa[p.id]?.trim() : mc[p.id]),
  ).length;
  const lowTime = remaining != null && remaining <= 60;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Hidden webcam capture elements */}
      <video ref={videoRef} muted playsInline className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Sticky bar — exam name + camera + countdown */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-6 py-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary">Exam</p>
            <p className="truncate font-serif text-lg font-medium text-foreground">
              {session.examName}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {cameraOn != null && (
              <span
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs',
                  cameraOn
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'border-amber-300/50 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
                )}
                title={cameraOn ? 'Webcam proctoring is on' : 'No camera — your exam still continues'}
              >
                {cameraOn ? <Camera className="size-3.5" /> : <CameraOff className="size-3.5" />}
                {cameraOn ? 'Proctored' : 'No camera'}
              </span>
            )}
            {remaining != null && (
              <span
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-sm tabular-nums',
                  lowTime
                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                    : 'text-foreground',
                )}
              >
                <Clock className="size-4" />
                {fmt(remaining)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-4 p-6 lg:p-8">
        <p className="text-sm text-muted-foreground">
          {answered} of {session.periods.length} answered.
        </p>

        {session.periods.map((p) => (
          <Card key={p.id} className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-semibold text-primary">
                {p.number}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                {p.type === 'short' ? 'Short answer' : 'Multiple choice'}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
              {p.questionContent}
            </p>

            {p.type === 'short' ? (
              <textarea
                rows={3}
                className={TEXTAREA_CLS}
                placeholder="Type your answer…"
                value={sa[p.id] ?? ''}
                onChange={(e) => setSa((prev) => ({ ...prev, [p.id]: e.target.value }))}
                onBlur={() => saveAnswer(p.id, { shortAnswer: sa[p.id] ?? '' })}
              />
            ) : (
              <ul className="space-y-1.5">
                {p.options.map((o) => (
                  <li key={o.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors',
                        mc[p.id] === o.id
                          ? 'border-primary bg-primary/5'
                          : 'bg-card hover:bg-accent',
                      )}
                    >
                      <input
                        type="radio"
                        name={p.id}
                        className="size-4 accent-primary"
                        checked={mc[p.id] === o.id}
                        onChange={() => {
                          setMc((prev) => ({ ...prev, [p.id]: o.id }));
                          void saveAnswer(p.id, { answerId: o.id });
                        }}
                      />
                      <span className="text-foreground">{o.content}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}

        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm text-muted-foreground">
            Submitting ends the exam — you can&apos;t change answers afterwards.
          </p>
          <Button
            disabled={submitting}
            onClick={() => {
              if (confirm('Submit your exam? You will not be able to change your answers.')) {
                void submit(false);
              }
            }}
          >
            {submitting ? 'Submitting…' : 'Submit exam'}
          </Button>
        </Card>
      </div>
    </div>
  );
}
