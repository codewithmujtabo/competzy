import { apiRequest } from "./api";

// Exam delivery (EMC Wave 7 backend) — the student-facing online exam API.
// All endpoints are scoped to the authenticated student via the Bearer JWT.

export type ExamWindowStatus = "unscheduled" | "upcoming" | "open" | "closed";

export interface AvailableExam {
  examId: string;
  name: string;
  code: string;
  windowStatus: ExamWindowStatus;
  session: { id: string; state: "in_progress" | "finished" } | null;
}

// Multi-language content — the question stem and every MC option both carry
// the 6 columns content..content6. The mobile lib/exam-languages.ts has
// pickLang() that picks the active language with English fallback.
export interface LangContent {
  content: string;
  content2: string;
  content3: string;
  content4: string;
  content5: string;
  content6: string;
}

export interface ExamOption extends LangContent {
  id: string;
}

export interface ExamPeriod {
  id: string;
  number: number;
  type: string; // "choice" | "short"
  question: LangContent;
  options: ExamOption[];
  answerId: string | null;
  shortAnswer: string | null;
}

export interface ExamSection {
  choice?: number;
  short?: number;
}

export interface ExamResult {
  totalPoint: number;
  corrects: ExamSection;
  wrongs: ExamSection;
  blanks: ExamSection;
  awaitingGrading: boolean;
}

// GET /sessions/:id — the player view (periods + remaining time) plus, once
// the session is finished, the result block. Leak-safe: never returns answer
// keys or explanations mid-attempt.
export interface ExamSession {
  id: string;
  examName: string;
  /** ISO 639 code of the language the student picked at start, or null. */
  language: string | null;
  finishedAt: string | null;
  remainingSeconds: number | null;
  periods: ExamPeriod[];
  result?: ExamResult | null;
}

/** The student's grade-matched exams for a competition, with session state. */
export async function getAvailableExams(compId: string): Promise<AvailableExam[]> {
  return apiRequest<AvailableExam[]>(
    `/exams/available?compId=${encodeURIComponent(compId)}`
  );
}

/** Start (or resume) an attempt — returns the session id. */
export async function startSession(
  examId: string,
  language?: string,
): Promise<{ sessionId: string }> {
  return apiRequest<{ sessionId: string }>(`/exams/${examId}/sessions`, {
    method: "POST",
    body: language ? { language } : {},
  });
}

export async function getSession(sessionId: string): Promise<ExamSession> {
  return apiRequest<ExamSession>(`/sessions/${sessionId}`);
}

/** One-shot — lock in the student's exam language. Idempotent server-side. */
export async function setSessionLanguage(
  sessionId: string,
  language: string,
): Promise<{ language: string | null }> {
  return apiRequest<{ language: string | null }>(
    `/sessions/${sessionId}/language`,
    { method: "PUT", body: { language } },
  );
}

/** Autosave one answer — `answerId` for MC, `shortAnswer` for short-answer. */
export async function saveAnswer(
  sessionId: string,
  periodId: string,
  body: { answerId?: string | null; shortAnswer?: string | null }
): Promise<void> {
  await apiRequest(`/sessions/${sessionId}/periods/${periodId}`, {
    method: "PUT",
    body,
  });
}

export async function submitSession(sessionId: string): Promise<void> {
  await apiRequest(`/sessions/${sessionId}/submit`, { method: "POST", body: {} });
}
