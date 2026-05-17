import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Card, EmptyState, Pill, ScreenHeader } from "@/components/ui";
import { Brand, Spacing, Surface, Text as TextColor, Type } from "@/constants/theme";
import * as marketingService from "@/services/marketing.service";
import type { Material } from "@/services/marketing.service";

export default function MaterialsScreen() {
  const { compId, compName } = useLocalSearchParams<{ compId: string; compName?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["materials", compId],
    queryFn: () => marketingService.getMaterials(compId!),
    enabled: !!compId,
  });

  // Group by category — the API already orders by category.
  const groups = new Map<string, Material[]>();
  for (const m of data ?? []) {
    const key = m.category || "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Study Materials" subtitle={compName} onBack={() => router.back()} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={[Type.h3, { marginBottom: Spacing.lg }]}>Failed to load materials</Text>
          <Button label="Try again" onPress={() => refetch()} />
        </View>
      ) : !data || data.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            icon={<Ionicons name="book-outline" size={30} color={Brand.primary} />}
            title="No materials yet"
            message="Study materials for this competition will appear here."
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {[...groups.entries()].map(([category, mats]) => (
            <View key={category} style={{ gap: Spacing.sm }}>
              <Text style={[Type.label, { color: TextColor.secondary }]}>
                {category.toUpperCase()}
              </Text>
              {mats.map((m) => (
                <MaterialCard key={m.id} m={m} />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function MaterialCard({ m }: { m: Material }) {
  const grades = m.grades.length ? m.grades : ["All grades"];
  return (
    <Card variant="playful">
      <Text style={Type.h3}>{m.title}</Text>
      {m.body ? (
        <Text style={[Type.bodySm, { marginTop: Spacing.xs }]}>{m.body}</Text>
      ) : null}
      <View style={styles.badges}>
        {m.compId === null ? <Pill label="Platform" tone="neutral" size="sm" /> : null}
        {grades.map((g) => (
          <Pill key={g} label={g} tone="brand" size="sm" />
        ))}
      </View>
      {m.file ? (
        <View style={{ marginTop: Spacing.md, alignSelf: "flex-start" }}>
          <Button
            label="Download"
            variant="secondary"
            size="sm"
            leadingIcon={<Ionicons name="download-outline" size={16} color={Brand.primary} />}
            onPress={() => WebBrowser.openBrowserAsync(m.file!)}
          />
        </View>
      ) : null}
    </Card>
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
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing["3xl"],
    gap: Spacing.xl,
  },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
});
