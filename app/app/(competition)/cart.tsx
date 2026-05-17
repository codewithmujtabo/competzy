import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Card, EmptyState, ScreenHeader } from "@/components/ui";
import { Brand, Radius, Spacing, Surface, Text as TextColor, Type } from "@/constants/theme";
import { useCart } from "@/hooks/use-cart";
import { rupiah } from "@/services/commerce.service";

export default function CartScreen() {
  const { compId, compName } = useLocalSearchParams<{ compId: string; compName?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cart = useCart(compId!);

  const hasItems = cart.ready && cart.items.length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Cart" subtitle={compName} onBack={() => router.back()} />

      {!cart.ready ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : cart.items.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            icon={<Ionicons name="cart-outline" size={30} color={Brand.primary} />}
            title="Your cart is empty"
            message="Add items from the store to get started."
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {cart.items.map((it) => (
            <Card key={it.productId} variant="playful">
              <View style={styles.row}>
                {it.image ? (
                  <Image source={{ uri: it.image }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback]}>
                    <Ionicons name="image-outline" size={20} color={TextColor.tertiary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={Type.h3}>{it.name}</Text>
                  <Text style={[Type.bodySm, { color: TextColor.secondary, marginTop: 2 }]}>
                    {rupiah(it.price)} each
                  </Text>
                </View>
                <Pressable onPress={() => cart.remove(it.productId)} hitSlop={10}>
                  <Ionicons name="trash-outline" size={18} color={TextColor.tertiary} />
                </Pressable>
              </View>
              <View style={styles.qtyRow}>
                <View style={styles.stepper}>
                  <StepBtn icon="remove" onPress={() => cart.setQty(it.productId, it.quantity - 1)} />
                  <Text style={[Type.h3, styles.qtyValue]}>{it.quantity}</Text>
                  <StepBtn icon="add" onPress={() => cart.setQty(it.productId, it.quantity + 1)} />
                </View>
                <Text style={[Type.h3, { color: Brand.primary }]}>
                  {rupiah(it.price * it.quantity)}
                </Text>
              </View>
            </Card>
          ))}
        </ScrollView>
      )}

      {hasItems ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
          <View style={styles.totalRow}>
            <Text style={[Type.body, { color: TextColor.secondary }]}>Total</Text>
            <Text style={Type.h2}>{rupiah(cart.total)}</Text>
          </View>
          <Button
            label="Checkout"
            fullWidth
            onPress={() =>
              router.push({
                pathname: "/(competition)/checkout",
                params: { compId: compId!, compName },
              })
            }
          />
        </View>
      ) : null}
    </View>
  );
}

function StepBtn({ icon, onPress }: { icon: "remove" | "add"; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.55 }]}
    >
      <Ionicons name={icon} size={18} color={Brand.primary} />
    </Pressable>
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
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Surface.cardAlt,
  },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: Surface.border,
    backgroundColor: Surface.card,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyValue: { minWidth: 24, textAlign: "center" },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    backgroundColor: Surface.card,
    borderTopWidth: 1,
    borderTopColor: Surface.border,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
});
