'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  ClipboardCheck,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  FolderTree,
  LayoutGrid,
  Library,
  ListChecks,
  Loader2,
  Medal,
  PenLine,
  Video,
} from 'lucide-react';
import { QuestionBankAuthProvider, useQuestionBankAuth } from '@/lib/auth/question-bank-context';
import { QuestionBankProvider } from '@/lib/question-bank/context';
import { AppShell, type NavSection } from '@/components/shell/app-shell';

export default function QuestionBankLayout({ children }: { children: React.ReactNode }) {
  return (
    <QuestionBankAuthProvider>
      <QuestionBankLayoutInner>{children}</QuestionBankLayoutInner>
    </QuestionBankAuthProvider>
  );
}

function QuestionBankLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useQuestionBankAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  const isAdmin = user.role === 'admin';
  const isQuestionMaker = user.role === 'question_maker';
  // "Back to …" returns the operator to whichever portal they came from.
  // Question-makers have no other portal — only this workspace.
  const portalHref = isAdmin ? '/dashboard' : '/organizer-dashboard';

  // Question-makers get the author surface — taxonomy + questions + exam
  // blueprints (assembling approved questions into a paper is the natural
  // next step after authoring them). Everything else (review / grading /
  // results / paper / proctoring / certificates / medalists) is admin +
  // organizer only on the backend and would 403 if shown.
  const nav: NavSection[] = isQuestionMaker
    ? [
        {
          items: [
            { label: 'Questions', href: '/question-bank/questions', icon: FileText, exact: true },
            { label: 'Taxonomy', href: '/question-bank/taxonomy', icon: FolderTree },
            { label: 'Exams', href: '/question-bank/exams', icon: ClipboardList },
          ],
        },
      ]
    : [
        {
          items: [
            { label: 'Dashboard', href: '/question-bank', icon: LayoutGrid, exact: true },
            { label: 'Taxonomy', href: '/question-bank/taxonomy', icon: FolderTree },
            { label: 'Questions', href: '/question-bank/questions', icon: FileText },
            { label: 'Review', href: '/question-bank/review', icon: ClipboardCheck },
            { label: 'Exams', href: '/question-bank/exams', icon: ClipboardList },
            { label: 'Grading', href: '/question-bank/grading', icon: PenLine },
            { label: 'Results', href: '/question-bank/results', icon: ListChecks },
            { label: 'Paper Exams', href: '/question-bank/paper', icon: FileSpreadsheet },
            { label: 'Proctoring', href: '/question-bank/proctoring', icon: Video },
            { label: 'Certificates', href: '/question-bank/certificates', icon: Award },
            { label: 'Medalists', href: '/question-bank/medalists', icon: Medal },
          ],
        },
        {
          label: 'Portal',
          items: [
            {
              label: isAdmin ? 'Back to Admin' : 'Back to Organizer',
              href: portalHref,
              icon: ArrowLeft,
            },
          ],
        },
      ];

  return (
    <AppShell
      brand={{
        name: 'Competzy',
        tagline: isQuestionMaker ? 'Question Maker' : 'Question Bank',
        icon: Library,
      }}
      nav={nav}
      user={{
        name:
          user.full_name ||
          (isAdmin ? 'Admin' : isQuestionMaker ? 'Question Maker' : 'Organizer'),
        email: user.email,
        role: isAdmin
          ? 'Administrator'
          : isQuestionMaker
            ? 'Question Maker'
            : 'Organizer',
      }}
      onSignOut={async () => {
        await logout();
        router.replace('/');
      }}
    >
      <QuestionBankProvider>{children}</QuestionBankProvider>
    </AppShell>
  );
}
