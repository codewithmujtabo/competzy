// Where each role lands after authenticating — shared by the unified login
// page and the super-admin impersonation flow (so "impersonate" drops the
// super-admin onto the target user's home, exactly as a real login would).
export function destinationFor(role: string): string {
  switch (role) {
    case 'admin':
    case 'manager':
      return '/dashboard';
    case 'organizer':
      return '/organizer-dashboard';
    case 'school_admin':
    case 'teacher':
      return '/school-dashboard';
    case 'student':
    case 'parent':
      return '/competitions';
    case 'country_representative':
      return '/rep-portal';
    case 'question_maker':
      // Question-makers only see the narrow author workspace; the QB dashboard
      // route still has the operator-only KPI cards, so land them on Questions.
      return '/question-bank/questions';
    default:
      return '/dashboard';
  }
}
