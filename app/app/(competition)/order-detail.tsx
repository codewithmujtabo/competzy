import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Card, Pill, ScreenHeader } from "@/components/ui";
import { Brand, Spacing, Surface, Text as TextColor, Type } from "@/constants/theme";
import * as commerce from "@/services/commerce.service";
import { rupiah } from "@/services/commerce.service";

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

export default function OrderDetailScreen() {
  const { orderId, compName } = useLocalSearchParams<{ orderId: string; compName?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => commerce.getOrder(orderId!),
    enabled: !!orderId,
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={data ? `Order ${data.code}` : "Order"}
        subtitle={compName}
        onBack={() => router.back()}
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : isError || !data ? (
        <View style={styles.center}>
          <Text style={[Type.h3, { marginBottom: Spacing.lg }]}>Failed to load the order</Text>
          <Button label="Try again" onPress={() => refetch()} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Card variant="playful">
            <View style={styles.cardHead}>
              <Text style={[Type.label, { color: TextColor.secondary }]}>STATUS</Text>
              <Pill
                label={cap(data.status)}
                tone={STATUS_TONE[data.status] ?? "neutral"}
                size="sm"
              />
            </View>
            <Row label="Ordered" value={fmtDate(data.orderedAt ?? data.createdAt)} />
            {data.paidAt ? <Row label="Paid" value={fmtDate(data.paidAt)} /> : null}
            {data.shippedAt ? <Row label="Shipped" value={fmtDate(data.shippedAt)} /> : null}
            {data.deliveredAt ? <Row label="Delivered" value={fmtDate(data.deliveredAt)} /> : null}
            {data.trackingNumber ? <Row label="Tracking" value={data.trackingNumber} /> : null}
          </Card>

          <Card variant="playful">
            <Text style={[Type.label, { color: TextColor.secondary }]}>ITEMS</Text>
            {(data.items ?? []).map((it) => (
              <View key={it.id} style={styles.itemRow}>
                <Text style={[Type.bodySm, { flex: 1 }]} numberOfLines={2}>
                  {it.description} × {it.quantity}
                </Text>
                <Text style={Type.bodySm}>{rupiah(it.subtotal)}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <Row label="Subtotal" value={rupiah(data.subtotal)} />
            {data.discount > 0 ? <Row label="Discount" value={`- ${rupiah(data.discount)}`} /> : null}
            {data.shipping > 0 ? <Row label="Shipping" value={rupiah(data.shipping)} /> : null}
            <View style={styles.totalRow}>
              <Text style={Type.title}>Total</Text>
              <Text style={[Type.title, { color: Brand.primary }]}>{rupiah(data.total)}</Text>
            </View>
          </Card>

          <Card variant="playful">
            <Text style={[Type.label, { color: TextColor.secondary }]}>SHIP TO</Text>
            <Text style={[Type.body, { marginTop: Spacing.sm }]}>{data.customerName}</Text>
            <Text style={[Type.bodySm, { color: TextColor.secondary, marginTop: 2 }]}>
              {data.customerPhone}
            </Text>
            <Text style={[Type.bodySm, { color: TextColor.secondary, marginTop: 2 }]}>
              {data.customerAddress}
            </Text>
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={[Type.bodySm, { color: TextColor.secondary }]}>{label}</Text>
      <Text style={[Type.bodySm, { flexShrink: 1, textAlign: "right", marginLeft: Spacing.md }]}>
        {value}
      </Text>
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
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing["3xl"],
    gap: Spacing.lg,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: Surface.border,
    marginTop: Spacing.md,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
  },
});
