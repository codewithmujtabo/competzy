// English message catalogue — the SINGLE SOURCE OF TRUTH for UI copy.
//
// Keys are flat, dot-namespaced strings (`area.thing`). `useT()` looks a key up
// in the active locale first, then falls back to English here, then to the key
// itself — so a not-yet-translated string still renders in English rather than
// breaking. Add new copy HERE first, then (optionally) translate it in `id.ts`.
//
// Interpolation: write `{name}` in the value and pass `t('key', { name })`.

export const en = {
  // ── Common / chrome ────────────────────────────────────────────────
  'common.signIn': 'Sign In',
  'common.signOut': 'Sign out',
  'common.signUp': 'Sign Up',
  'common.getStarted': 'Get Started',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.loading': 'Loading…',
  'common.back': 'Back',
  'common.accountSettings': 'Account Settings',
  'common.notifications': 'Notifications',
  'common.darkMode': 'Switch to dark mode',
  'common.lightMode': 'Switch to light mode',
  'common.language': 'Language',

  // ── Student sidebar nav ────────────────────────────────────────────
  'nav.allCompetitions': 'All Competitions',
  'nav.myAccount': 'My Account',
  'nav.profile': 'Profile',
  'nav.myCompetitions': 'My Competitions',
  'nav.myAchievements': 'My Achievements',
  'nav.announcements': 'Announcements',

  // ── Login page ─────────────────────────────────────────────────────
  'login.eyebrow': 'Competzy · Web Portal',
  'login.welcomeBack': 'Welcome back.',
  'login.subtitle': 'Sign in to continue to your workspace.',
  'login.tabEmail': 'Email',
  'login.tabPhone': 'Phone',
  'login.emailLabel': 'Email',
  'login.passwordLabel': 'Password',
  'login.phoneLabel': 'Phone number',
  'login.forgotPassword': 'Forgot password?',
  'login.signInButton': 'Sign In',
  'login.signingIn': 'Signing in…',
  'login.sendCode': 'Send code',
  'login.sendingCode': 'Sending…',
  'login.otpLabel': 'Verification code',
  'login.verifyButton': 'Verify & Sign In',
  'login.verifying': 'Verifying…',
  'login.resendCode': 'Resend code',
  'login.useDifferentNumber': 'Use a different number',
  'login.newToCompetzy': 'New to Competzy?',
  'login.checkingSession': 'Checking your session…',
  'login.emailMismatch':
    "That email and password don't match. Try again, or use Forgot password.",
  'login.codeSent': 'Code sent. Check your phone — it can take a moment.',
  'login.codeInvalid': 'That code is incorrect or has expired. Request a new one.',
  'login.footerPrivacy': 'Privacy',
  'login.footerTerms': 'Terms',
  'login.footerContact': 'Contact',

  // ── Catalog (/competitions) ────────────────────────────────────────
  'catalog.welcomeBack': 'Welcome back',
  'catalog.greeting': 'Hey {name}!',
  'catalog.subtitle': 'Pick a competition to register or check on your progress.',
  'catalog.completeProfile': 'Complete your profile',
  'catalog.profileAllSet': 'All set 🎉',
  'catalog.profileAlmost': 'Almost there',
  'catalog.kpiRegistrations': 'Registrations',
  'catalog.kpiRegistrationsHint': 'Join your first competition',
  'catalog.kpiCertificates': 'Certificates',
  'catalog.kpiCertificatesHint': 'Finish an exam to earn one',
  'catalog.kpiBestScore': 'Best score',
  'catalog.kpiBestScoreHint': 'Sit your first exam',
  'catalog.kpiSaved': 'Saved',
  'catalog.kpiSavedHint': 'Competitions you bookmarked',
  'catalog.continueTitle': 'Continue where you left off',
  'catalog.allCompetitions': 'All competitions',
  'catalog.allCompetitionsHint': 'Tap one to learn more.',
  'catalog.loading': 'Loading competitions…',
  'catalog.empty': 'No competitions yet',
  'catalog.portalComingSoon': 'Portal coming soon',
  'catalog.registrationCloses': 'Registration closes {date}',
  'catalog.achievementsTitle': 'Your achievements',
  'catalog.achievementsHint': 'Recently earned — tap a certificate to verify.',
  'catalog.achievementsEmpty': 'No certificates yet — start a competition above.',
  'catalog.international': 'International',

  // ── Competition dashboard ──────────────────────────────────────────
  'dashboard.backToAll': 'All competitions',
  'dashboard.loadingRegistration': 'Loading your registration…',
  'dashboard.notAvailableTitle': "This competition isn't available to your account.",
  'dashboard.notAvailableBody':
    'Check the catalog for competitions you can register for. If you think this is a mistake, contact the organizer.',
  'dashboard.browseCompetitions': 'Browse competitions',
  'dashboard.welcomeTo': 'Welcome to {name}',
  'dashboard.noRegistration': "You don't have a registration yet. Enroll now to claim your spot.",
  'dashboard.registerFor': 'Register for {name}',
  'dashboard.enrolling': 'Enrolling…',
  'dashboard.competitionRounds': 'Competition rounds',
  'dashboard.roundsSubtitle': 'Register and pay for each round of {name} you want to enter.',
  'dashboard.registerRound': 'Register for this round',
  'dashboard.registering': 'Registering…',
  'dashboard.payRoundFee': 'Pay round fee',
  'dashboard.pay': 'Pay {amount}',
  'dashboard.missed': 'Missed',
  'dashboard.missedNote': "You didn't register before this round closed.",
  'dashboard.fee': 'Fee',
  'dashboard.free': 'Free',
  'dashboard.mode': 'Mode',
  'dashboard.exam': 'Exam',
  'dashboard.closes': 'Closes',
  'dashboard.yourExams': 'Your exams',
  'dashboard.examsHint': "Exams unlock once you've registered and paid for their round.",
  'dashboard.yourCertificates': 'Your certificates',
  'dashboard.activityTimeline': 'Activity timeline',
  'dashboard.timelineSubtitle': 'Your journey through {name}.',
  'dashboard.status': 'Status',
  // hero stat labels
  'dashboard.heroParticipantId': 'Participant ID',
  'dashboard.heroCategory': 'Category',
  'dashboard.heroTestCenter': 'Test Center',
  'dashboard.heroTrack': 'Track',
  'dashboard.heroStatus': 'Status',
  'dashboard.heroGrade': 'Grade {n}',
  'dashboard.nextAction': 'Next action',
  'dashboard.competitionPath': 'Competition path',
  'dashboard.gradeLevels': 'Grade levels',
  'dashboard.roundsJoined': '{joined} of {total} rounds joined',
  'dashboard.notJoined': 'Not joined',
  // step badges
  'dashboard.badgeDone': 'Done',
  'dashboard.badgeActionNeeded': 'Action needed',
  'dashboard.badgeUpcoming': 'Upcoming',
  // countdown
  'dashboard.cdDays': 'Days',
  'dashboard.cdWeeks': 'Weeks',
  'dashboard.cdToEvent': 'To event',
  // step CTAs / hints
  'dashboard.fillRegForm': 'Fill registration form',
  'dashboard.completeRegForm': 'Complete registration form',
  'dashboard.payRegistrationFee': 'Pay registration fee',
  'dashboard.uploadDocuments': 'Upload documents',
  'dashboard.hintProfile': 'Complete your profile to move forward.',
  'dashboard.hintDocuments': 'Upload the documents this competition requires.',
  'dashboard.hintPayment': 'Pay your registration fee to continue.',
  'dashboard.hintApproval': 'An organizer is reviewing your registration — no action needed.',

  // ── Registration status enum ───────────────────────────────────────
  'status.notRegistered': 'Not registered',
  'status.pending_payment': 'Pending payment',
  'status.pending_review': 'Pending review',
  'status.registered': 'Registered',
  'status.paid': 'Paid',
  'status.approved': 'Approved',
  'status.rejected': 'Rejected',
  'status.completed': 'Completed',
  'status.submitted': 'Submitted',

  // ── Competition in-page tabs ───────────────────────────────────────
  'tabs.overview': 'Overview',
  'tabs.announcements': 'Announcements',
  'tabs.materials': 'Materials',
  'tabs.store': 'Store',
  'tabs.certificates': 'Certificates',
  'tabs.feedback': 'Feedback',

  // ── Komodo creature card ───────────────────────────────────────────
  'creature.title': 'Komodo creature',
  'creature.addDob': 'Add your date of birth to see your creature',
  'creature.addDobBody':
    "Komodo brackets students by age. Once we know your birthday, you'll unlock your creature for every round.",
  'creature.completeProfile': 'Complete profile',
  'creature.outOfBracket': 'Out of bracket',
  'creature.ageAtCutoff': 'Age {age} at cutoff',
} as const;

export type MessageKey = keyof typeof en;
