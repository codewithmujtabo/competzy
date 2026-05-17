import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Card, EmptyState, ScreenHeader } from "@/components/ui";
import { Brand, Radius, Spacing, Surface, Text as TextColor, Type } from "@/constants/theme";
import { useCart } from "@/hooks/use-cart";
import * as commerce from "@/services/commerce.service";
import { rupiah, type StoreProduct } from "@/services/commerce.service";

export default function StoreScreen() {
  const { compId, compName } = useLocalSearchParams<{ compId: string; compName?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cart = useCart(compId!);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["storefront-products", compId],
    queryFn: () => commerce.getStorefrontProducts(compId!),
    enabled: !!compId,
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Store"
        subtitle={compName}
        onBack={() => router.back()}
        trailing={
          <Button
            label="My Orders"
            variant="ghost"
            size="sm"
            onPress={() =>
              router.push({
                pathname: "/(competition)/orders",
                params: { compId: compId!, compName },
              })
            }
          />
        }
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={[Type.h3, { marginBottom: Spacing.lg }]}>Failed to load the store</Text>
          <Button label="Try again" onPress={() => refetch()} />
        </View>
      ) : !data || data.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            icon={<Ionicons name="bag-handle-outline" size={30} color={Brand.primary} />}
            title="No products yet"
            message="This competition's store has no items for sale yet."
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {data.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onAdd={() =>
                cart.add({ productId: p.id, name: p.name, price: p.price, image: p.image })
              }
            />
          ))}
        </ScrollView>
      )}

      {cart.count > 0 ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
          <Button
            label={`View cart (${cart.count})   ·   ${rupiah(cart.total)}`}
            fullWidth
            onPress={() =>
              router.push({
                pathname: "/(competition)/cart",
                params: { compId: compId!, compName },
              })
            }
          />
        </View>
      ) : null}
    </View>
  );
}

function ProductCard({ product, onAdd }: { product: StoreProduct; onAdd: () => void }) {
  return (
    <Card variant="playful">
      {product.image ? (
        <Image source={{ uri: product.image }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.imageFallback]}>
          <Ionicons name="image-outline" size={28} color={TextColor.tertiary} />
        </View>
      )}
      <Text style={[Type.h3, { marginTop: Spacing.md }]}>{product.name}</Text>
      {product.description ? (
        <Text style={[Type.bodySm, { color: TextColor.secondary, marginTop: Spacing.xs }]}>
          {product.description}
        </Text>
      ) : null}
      <View style={styles.priceRow}>
        <Text style={[Type.h3, { color: Brand.primary }]}>{rupiah(product.price)}</Text>
        <Button
          label="Add"
          variant="secondary"
          size="sm"
          leadingIcon={<Ionicons name="add" size={16} color={Brand.primary} />}
          onPress={onAdd}
        />
      </View>
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
  image: {
    width: "100%",
    height: 160,
    borderRadius: Radius.lg,
    backgroundColor: Surface.cardAlt,
  },
  imageFallback: { alignItems: "center", justifyContent: "center" },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    backgroundColor: Surface.card,
    borderTopWidth: 1,
    borderTopColor: Surface.border,
  },
});
