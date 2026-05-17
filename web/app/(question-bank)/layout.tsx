'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FolderTree,
  LayoutGrid,
  Library,
  Loader2,
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
  // "Back to …" returns the operator to whichever portal they came from.
  const portalHref = isAdmin ? '/dashboard' : '/organizer-dashboard';

  const nav: NavSection[] = [
    {
      items: [
        { label: 'Dashboard', href: '/question-bank', icon: LayoutGrid, exact: true },
        { label: 'Taxonomy', href: '/question-bank/taxonomy', icon: FolderTree },
        { label: 'Questions', href: '/question-bank/questions', icon: FileText },
        { label: 'Review', href: '/question-bank/review', icon: ClipboardCheck },
        { label: 'Exams', href: '/question-bank/exams', icon: ClipboardList },
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
      brand={{ name: 'Competzy', tagline: 'Question Bank', icon: Library }}
      nav={nav}
      user={{
        name: user.full_name || (isAdmin ? 'Admin' : 'Organizer'),
        email: user.email,
        role: isAdmin ? 'Administrator' : 'Organizer',
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
