import { PoolClient } from "pg";

// Default per-competition step-flows, seeded when a competition is created.
// `kind` picks the shape: a native competition runs the exam in-app and ends
// in exam → results; an affiliated competition hands the student off to an
// external site and ends in an `external_access` step (rendered specially on
// the dashboard — it shows the issued credentials + link). The native steps
// mirror the Wave 4 seed in 1749000000000_competition-flows.sql.

export type CompetitionKind = "native" | "affiliated";

interface FlowStepSeed {
  key: string;
  title: string;
  description: string;
  check: "profile" | "documents" | "payment" | "approval" | "none";
}

const COMMON_STEPS: FlowStepSeed[] = [
  { key: "profile",   title: "Complete your profile",     description: "Fill in your name, contact details, school and grade.",  check: "profile" },
  { key: "documents", title: "Upload required documents", description: "Upload every document the competition asks for.",        check: "documents" },
  { key: "review",    title: "Registration review",       description: "An organizer reviews and confirms your registration.",   check: "approval" },
  { key: "payment",   title: "Pay the registration fee",  description: "Complete payment to lock in your seat.",                 check: "payment" },
];

const NATIVE_STEPS: FlowStepSeed[] = [
  ...COMMON_STEPS,
  { key: "exam",    title: "Sit the exam",        description: "Take the exam on the scheduled date.",                  check: "none" },
  { key: "results", title: "View your results",   description: "Results and your certificate arrive after grading.",    check: "none" },
];

const AFFILIATED_STEPS: FlowStepSeed[] = [
  ...COMMON_STEPS,
  {
    key: "external_access",
    title: "Access the competition platform",
    description: "Use the login details below to enter the organizer's competition site.",
    check: "none",
  },
];

/**
 * Seeds the default step-flow for a freshly-created competition. Runs inside
 * the caller's transaction (pass the same `client`). A new competition has no
 * flow yet, so this is a plain INSERT.
 */
export async function seedDefaultFlow(
  client: PoolClient,
  compId: string,
  kind: CompetitionKind
): Promise<void> {
  const steps = kind === "affiliated" ? AFFILIATED_STEPS : NATIVE_STEPS;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    await client.query(
      `INSERT INTO competition_flows (comp_id, step_order, step_key, title, description, check_type)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [compId, i + 1, s.key, s.title, s.description, s.check]
    );
  }
}
