import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Card, EmptyState, Pill, ScreenHeader } from "@/components/ui";
import { Brand, Radius, Spacing, Surface, Text as TextColor, Type } from "@/constants/theme";
import * as marketingService from "@/services/marketing.service";
import type { Announcement } from "@/services/marketing.service";

function fmtDate(s: string | null) {
  if (!s) return "";
  return new Date(s).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function AnnouncementsScreen() {
  const { compId, compName } = useLocalSearchParams<{ compId: string; compName?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["announcements", compId],
    queryFn: () => marketingService.getAnnouncements(compId!),
    enabled: !!compId,
  });

  const featured = (data ?? []).filter((a) => a.isFeatured);
  const rest = (data ?? []).filter((a) => !a.isFeatured);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Announcements" subtitle={compName} onBack={() => router.back()} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={[Type.h3, { marginBottom: Spacing.lg }]}>Failed to load announcements</Text>
          <Button label="Try again" onPress={() => refetch()} />
        </View>
      ) : !data || data.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            icon={<Ionicons name="megaphone-outline" size={30} color={Brand.primary} />}
            title="No announcements yet"
            message="News about this competition will appear here."
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {featured.map((a) => (
            <AnnouncementCard key={a.id} a={a} featured />
          ))}
          {rest.map((a) => (
            <AnnouncementCard key={a.id} a={a} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function AnnouncementCard({ a, featured }: { a: Announcement; featured?: boolean }) {
  return (
    <Card variant={featured ? "tinted" : "playful"} tint={featured ? Brand.sunshineSoft : undefined}>
      <View style={styles.badges}>
        {featured ? <Pill label="Featured" tone="warning" size="sm" /> : null}
        {a.type ? <Pill label={a.type} tone="brand" size="sm" /> : null}
        {a.compId === null ? <Pill label="Platform" tone="neutral" size="sm" /> : null}
        <Text style={[Type.caption, { marginLeft: "auto" }]}>{fmtDate(a.publishedAt)}</Text>
      </View>
      <Text style={[Type.h3, { marginTop: Spacing.sm }]}>{a.title}</Text>
      {a.image ? (
        <Image source={{ uri: a.image }} style={styles.image} resizeMode="cover" />
      ) : null}
      {a.body ? (
        <Text style={[Type.body, { marginTop: Spacing.sm, color: TextColor.secondary }]}>
          {a.body}
        </Text>
      ) : null}
      {a.file ? (
        <View style={{ marginTop: Spacing.md, alignSelf: "flex-start" }}>
          <Button
            label="Open attachment"
            variant="secondary"
            size="sm"
            leadingIcon={<Ionicons name="download-outline" size={16} color={Brand.primary} />}
            onPress={() => WebBrowser.openBrowserAsync(a.file!)}
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
    gap: Spacing.lg,
  },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  image: {
    width: "100%",
    height: 160,
    borderRadius: Radius.lg,
    marginTop: Spacing.md,
    backgroundColor: Surface.cardAlt,
  },
});
