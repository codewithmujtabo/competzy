import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Card, EmptyState, Pill, ScreenHeader } from "@/components/ui";
import { Brand, Spacing, Surface, Text as TextColor, Type } from "@/constants/theme";
import * as commerce from "@/services/commerce.service";
import { rupiah, type Order } from "@/services/commerce.service";

type PillTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const STATUS_TONE: Record<string, PillTone> = {
  ordered: "warning",
  paid: "info",
  shipped: "brand",
  delivered: "success",
  canceled: "neutral",
};

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function OrdersScreen() {
  const { compName } = useLocalSearchParams<{ compId?: string; compName?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => commerce.getMyOrders(),
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="My Orders" subtitle={compName} onBack={() => router.back()} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={[Type.h3, { marginBottom: Spacing.lg }]}>Failed to load your orders</Text>
          <Button label="Try again" onPress={() => refetch()} />
        </View>
      ) : !data || data.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            icon={<Ionicons name="receipt-outline" size={30} color={Brand.primary} />}
            title="No orders yet"
            message="Orders you place from a competition store will appear here."
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {data.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              onPress={() =>
                router.push({
                  pathname: "/(competition)/order-detail",
                  params: { orderId: o.id, compName: o.compName ?? compName },
                })
              }
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function OrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
  return (
    <Card variant="playful" onPress={onPress}>
      <View style={styles.head}>
        <Text style={[Type.bodySm, { color: TextColor.secondary, fontVariant: ["tabular-nums"] }]}>
          {order.code}
        </Text>
        <Pill label={cap(order.status)} tone={STATUS_TONE[order.status] ?? "neutral"} size="sm" />
      </View>
      {order.compName ? (
        <Text style={[Type.h3, { marginTop: Spacing.xs }]}>{order.compName}</Text>
      ) : null}
      <View style={styles.metaRow}>
        <Text style={[Type.bodySm, { color: TextColor.secondary }]}>
          {(order.itemCount ?? 0)} item{(order.itemCount ?? 0) === 1 ? "" : "s"} ·{" "}
          {fmtDate(order.orderedAt ?? order.createdAt)}
        </Text>
        <Text style={[Type.title, { color: Brand.primary }]}>{rupiah(order.total)}</Text>
      </View>
      {order.trackingNumber ? (
        <Text style={[Type.caption, { color: TextColor.secondary, marginTop: Spacing.xs }]}>
          Tracking: {order.trackingNumber}
        </Text>
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
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
});
