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

export interface ExamPeriod {
  id: string;
  number: number;
  type: string; // "choice" | "short"
  questionContent: string;
  options: { id: string; content: string }[];
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
export async function startSession(examId: string): Promise<{ sessionId: string }> {
  return apiRequest<{ sessionId: string }>(`/exams/${examId}/sessions`, {
    method: "POST",
    body: {},
  });
}

export async function getSession(sessionId: string): Promise<ExamSession> {
  return apiRequest<ExamSession>(`/sessions/${sessionId}`);
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
