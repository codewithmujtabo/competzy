import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState, ScreenHeader } from "@/components/ui";
import { Brand, Spacing, Surface } from "@/constants/theme";

// Placeholder — the real order history ships in Wave 13 Phase 3.
export default function OrdersScreen() {
  const { compName } = useLocalSearchParams<{ compName?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="My Orders" subtitle={compName} onBack={() => router.back()} />
      <View style={styles.center}>
        <EmptyState
          icon={<Ionicons name="receipt-outline" size={30} color={Brand.primary} />}
          title="Order history coming soon"
          message="Your orders will appear here in the next update."
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Surface.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
  },
});
