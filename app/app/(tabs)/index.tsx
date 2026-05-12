import { Redirect } from "expo-router";
import { useUser } from "@/context/AuthContext";
import { ActivityIndicator, View } from "react-native";

/** Redirect to appropriate tab based on user role. */
export default function HomeIndex() {
  const { user } = useUser();
  const userRole = (user as any)?.role;

  // Wait for user data to load
  if (!userRole) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Redirect based on role
  if (userRole === "admin") {
    return <Redirect href="/(tabs)/web-portal-redirect" />;
  }

  if (userRole === "teacher") {
    return <Redirect href="/(tabs)/teacher-dashboard" />;
  }

  if (userRole === "parent") {
    return <Redirect href="/(tabs)/children" />;
  }

  if (userRole === "school_admin") {
    return <Redirect href="/(tabs)/profile" />;
  }

  // Default: students go to competitions
  return <Redirect href="/(tabs)/competitions" />;
}
