import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Card, ScreenHeader } from "@/components/ui";
import { Brand, Radius, Spacing, Surface, Text as TextColor, Type } from "@/constants/theme";
import { useCart } from "@/hooks/use-cart";
import * as commerce from "@/services/commerce.service";
import { rupiah } from "@/services/commerce.service";

type CheckoutState =
  | "form"
  | "loading"
  | "opening"
  | "success"
  | "pending"
  | "failed"
  | "cancelled"
  | "error";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

// An order whose status reads as settled.
const ORDER_PAID = ["paid", "shipped", "delivered"];

const STATE_CONTENT: Record<
  Exclude<CheckoutState, "form" | "loading" | "opening">,
  { icon: IoniconName; title: string; subtitle: string; accent: string; bg: string }
> = {
  success: {
    icon: "checkmark-circle",
    title: "Order Placed!",
    subtitle: "Your payment is confirmed and your order is on its way. Track it under My Orders.",
    accent: Brand.success,
    bg: Brand.successSoft,
  },
  pending: {
    icon: "time",
    title: "Payment Pending",
    subtitle: "Your payment is processing. The order will update under My Orders once it settles.",
    accent: Brand.warning,
    bg: Brand.warningSoft,
  },
  failed: {
    icon: "close-circle",
    title: "Payment Failed",
    subtitle: "The transaction was unsuccessful. Try again or use a different payment method.",
    accent: Brand.error,
    bg: Brand.errorSoft,
  },
  cancelled: {
    icon: "arrow-undo",
    title: "Payment Page Closed",
    subtitle: "If you already paid, the order updates automatically. Otherwise, try again.",
    accent: TextColor.secondary,
    bg: Surface.cardAlt,
  },
  error: {
    icon: "alert-circle",
    title: "Something Went Wrong",
    subtitle: "We couldn't complete the checkout. Try again in a moment.",
    accent: Brand.error,
    bg: Brand.errorSoft,
  },
};

export default function CheckoutScreen() {
  const { compId, compName } = useLocalSearchParams<{ compId: string; compName?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cart = useCart(compId!);

  const [state, setState] = useState<CheckoutState>("form");
  const [loadingMsg, setLoadingMsg] = useState("Placing your order...");
  const [errorDetail, setErrorDetail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [formError, setFormError] = useState("");

  // The order id, once created — kept so a retry re-pays it rather than
  // creating a duplicate order.
  const orderId = useRef<string | null>(null);
  const busy = useRef(false);

  const pollVerify = async (id: string, attempts = 6, delayMs = 3000): Promise<boolean> => {
    for (let i = 0; i < attempts; i++) {
      if (i > 0) await new Promise((res) => setTimeout(res, delayMs));
      try {
        const { status } = await commerce.verifyOrder(id);
        if (ORDER_PAID.includes(status)) return true;
      } catch {
        /* keep polling */
      }
    }
    return false;
  };

  const placeOrder = async () => {
    if (busy.current) return;
    if (!compId) {
      setErrorDetail("Competition not found.");
      setState("error");
      return;
    }
    if (orderId.current === null) {
      if (cart.items.length === 0) return;
      if (!name.trim() || !phone.trim() || !address.trim()) {
        setFormError("Please fill in your name, phone, and shipping address.");
        return;
      }
    }
    busy.current = true;
    setFormError("");
    try {
      setLoadingMsg("Placing your order...");
      setState("loading");

      // Create the order once; a retry re-pays the existing one.
      if (orderId.current === null) {
        const order = await commerce.createOrder({
          compId,
          items: cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
        });
        orderId.current = order.id;
      }
      const id = orderId.current;

      setLoadingMsg("Starting payment...");
      const pay = await commerce.payOrder(id);

      // A zero-total order settles server-side — no Midtrans.
      if (pay.covered) {
        cart.clear();
        setState("success");
        return;
      }
      if (!pay.redirectUrl) {
        setErrorDetail("Could not start the payment. Please try again.");
        setState("error");
        return;
      }

      setState("opening");
      WebBrowser.dismissAuthSession();
      const result = await WebBrowser.openAuthSessionAsync(pay.redirectUrl, "competzy://");

      setLoadingMsg("Verifying payment...");
      setState("loading");

      if (result.type === "success" && result.url) {
        const tx = new URL(result.url).searchParams.get("transaction_status");
        if (tx === "pending") {
          setState("pending");
          return;
        }
        if (["deny", "cancel", "expire", "failure"].includes(tx ?? "")) {
          setState("failed");
          return;
        }
      }
      const paid = await pollVerify(id);
      if (paid) {
        cart.clear();
        setState("success");
      } else {
        setState("cancelled");
      }
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes("already")) {
        // The order is already paid (a webhook beat the verify poll).
        cart.clear();
        setState("success");
        return;
      }
      setErrorDetail(err?.message || "");
      setState("error");
    } finally {
      busy.current = false;
    }
  };

  // ── Loading / opening ─────────────────────────────────────────────────
  if (state === "loading" || state === "opening") {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Brand.primary} />
        <Text style={[Type.body, { color: TextColor.secondary, marginTop: Spacing.lg }]}>
          {state === "opening" ? "Opening payment page..." : loadingMsg}
        </Text>
      </View>
    );
  }

  // ── Result state ──────────────────────────────────────────────────────
  if (state !== "form") {
    const content = STATE_CONTENT[state];
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScreenHeader title="Checkout" subtitle={compName} onBack={() => router.back()} />
        <View style={styles.resultWrap}>
          <Card padding="2xl" style={{ alignItems: "center" }}>
            <View style={[styles.statusIcon, { backgroundColor: content.bg }]}>
              <Ionicons name={content.icon} size={52} color={content.accent} />
            </View>
            <Text style={[Type.h1, { color: content.accent, marginTop: Spacing.lg, textAlign: "center" }]}>
              {content.title}
            </Text>
            <Text
              style={[Type.body, { color: TextColor.secondary, textAlign: "center", marginTop: Spacing.md }]}
            >
              {content.subtitle}
            </Text>
            {state === "error" && errorDetail ? (
              <Text style={[Type.caption, { color: Brand.error, marginTop: Spacing.md, textAlign: "center" }]}>
                {errorDetail}
              </Text>
            ) : null}
          </Card>
          <View style={{ marginTop: Spacing.xl, gap: Spacing.md }}>
            {state === "success" || state === "pending" ? (
              <Button
                label="View My Orders"
                fullWidth
                onPress={() =>
                  router.replace({
                    pathname: "/(competition)/orders",
                    params: { compId: compId!, compName },
                  })
                }
              />
            ) : (
              <Button label="Try Again" fullWidth onPress={placeOrder} />
            )}
            <Button label="Back" variant="ghost" fullWidth onPress={() => router.back()} />
          </View>
        </View>
      </View>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Checkout" subtitle={compName} onBack={() => router.back()} />

      {!cart.ready ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : cart.items.length === 0 ? (
        <View style={styles.center}>
          <Text style={[Type.h3, { marginBottom: Spacing.lg }]}>Your cart is empty</Text>
          <Button label="Back to store" onPress={() => router.back()} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Card variant="playful">
              <Text style={[Type.label, { color: TextColor.secondary }]}>ORDER SUMMARY</Text>
              {cart.items.map((it) => (
                <View key={it.productId} style={styles.summaryRow}>
                  <Text style={[Type.bodySm, { flex: 1 }]} numberOfLines={1}>
                    {it.name} × {it.quantity}
                  </Text>
                  <Text style={Type.bodySm}>{rupiah(it.price * it.quantity)}</Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={Type.title}>Total</Text>
                <Text style={[Type.title, { color: Brand.primary }]}>{rupiah(cart.total)}</Text>
              </View>
            </Card>

            <Card variant="playful">
              <Text style={[Type.label, { color: TextColor.secondary }]}>SHIPPING DETAILS</Text>
              <Field label="Recipient name" value={name} onChangeText={setName} placeholder="Full name" />
              <Field
                label="Phone"
                value={phone}
                onChangeText={setPhone}
                placeholder="+62…"
                keyboardType="phone-pad"
              />
              <Field
                label="Shipping address"
                value={address}
                onChangeText={setAddress}
                placeholder="Street, city, postal code"
                multiline
              />
              {formError ? (
                <Text style={[Type.bodySm, { color: Brand.error, marginTop: Spacing.sm }]}>
                  {formError}
                </Text>
              ) : null}
            </Card>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
            <Button
              label={`Place order & pay  ·  ${rupiah(cart.total)}`}
              fullWidth
              onPress={placeOrder}
            />
          </View>
        </>
      )}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  keyboardType?: "phone-pad";
  multiline?: boolean;
}) {
  return (
    <View style={{ marginTop: Spacing.md }}>
      <Text style={[Type.bodySm, { color: TextColor.secondary, marginBottom: Spacing.xs }]}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={TextColor.tertiary}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline && { height: 76, textAlignVertical: "top" }]}
      />
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
    backgroundColor: Surface.background,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing["3xl"],
    gap: Spacing.lg,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Surface.border,
  },
  input: {
    borderWidth: 1,
    borderColor: Surface.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Surface.card,
    ...Type.body,
    color: TextColor.primary,
  },
  resultWrap: { flex: 1, justifyContent: "center", paddingHorizontal: Spacing.xl },
  statusIcon: {
    width: 104,
    height: 104,
    borderRadius: Radius["3xl"],
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    backgroundColor: Surface.card,
    borderTopWidth: 1,
    borderTopColor: Surface.border,
  },
});
