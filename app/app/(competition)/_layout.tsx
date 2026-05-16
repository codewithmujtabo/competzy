import { Stack } from "expo-router";

// Per-competition student surfaces (EMC Wave 11) — exam delivery,
// announcements, materials and feedback. Pushed onto the tabs navigator from
// my-registration-details; each screen reads its scope from route params.
export default function CompetitionLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
