import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, ScreenHeader } from "@/components/ui";
import { Spacing, Surface, Text as TextColor, Type } from "@/constants/theme";

// Placeholder — the exam result screen ships in Wave 11 Phase 2.
export default function ExamResultScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Result" onBack={() => router.back()} />
      <View style={styles.center}>
        <Text style={[Type.h3, { textAlign: "center" }]}>Exam result</Text>
        <Text style={[Type.body, { color: TextColor.secondary, textAlign: "center", marginTop: Spacing.sm }]}>
          The result screen arrives in the next update.
        </Text>
        <Button label="Go back" variant="secondary" style={{ marginTop: Spacing.xl }} onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Surface.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing["2xl"] },
});
