import { Button, Card } from "@/components/ui";
import {
  Brand,
  Radius,
  Shadow,
  Spacing,
  Surface,
  Text as TextColor,
  Type,
} from "@/constants/theme";
import { useUser } from "@/context/AuthContext";
import * as paymentsService from "@/services/payments.service";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type PaymentState =
  | "selecting"
  | "loading"
  | "opening"
  | "success"
  | "pending"
  | "failed"
  | "cancelled"
  | "error";

type PayerKind = "self" | "parent" | "school" | "sponsor";

const PAYER_OPTIONS: Array<{ value: PayerKind; emoji: string; label: string; subtitle: string }> = [
  { value: "self",    emoji: "🙋", label: "Myself",    subtitle: "Payment in my name" },
  { value: "parent",  emoji: "👨‍👩‍👧", label: "Parent / Guardian", subtitle: "Receipt issued in the parent name" },
  { value: "school",  emoji: "🏫", label: "School",          subtitle: "School covers the fee" },
  { value: "sponsor", emoji: "🤝", label: "Sponsor",          subtitle: "Third party (foundation, company)" },
];

const STATE_CONTENT: Record<
  Exclude<PaymentState, "selecting" | "loading" | "opening">,
  { emoji: string; title: string; subtitle: string; accent: string; bg: string }
> = {
  success: {
    emoji: "🎉",
    title: "Payment Completed!",
    subtitle:
      "Your payment has been confirmed. Your spot is secured! Head to My Competitions to track your registration.",
    accent: Brand.success,
    bg: Brand.successSoft,
  },
  pending: {
    emoji: "⏳",
    title: "Payment Pending",
    subtitle:
      "Your payment is being processed. We will notify you once confirmed. You can close this screen.",
    accent: Brand.warning,
    bg: Brand.warningSoft,
  },
  failed: {
    emoji: "❌",
    title: "Payment Failed",
    subtitle:
      "Transaction was unsuccessful. Try again or use a different payment method.",
    accent: Brand.error,
    bg: Brand.errorSoft,
  },
  cancelled: {
    emoji: "↩️",
    title: "Page Closed",
    subtitle:
      "Payment page was closed. If you already paid, status will update automatically. If not, try again.",
    accent: TextColor.secondary,
    bg: Surface.cardAlt,
  },
  error: {
    emoji: "😕",
    title: "An Error Occurred",
    subtitle: "Unable to load payment page. Try again in a moment.",
    accent: Brand.error,
    bg: Brand.errorSoft,
  },
};

export default function PayScreen() {
  const { registrationId } = useLocalSearchParams<{ registrationId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshRegistrations } = useUser();

  const [paymentState, setPaymentState] = useState<PaymentState>("selecting");
  const [loadingMessage, setLoadingMessage] = useState("Preparing payment...");
  const [errorDetail, setErrorDetail] = useState("");
  const [payerKind, setPayerKind] = useState<PayerKind>("self");

  const started = useRef(false);

  const POST_PAYMENT_STATUSES = ["pending_review", "approved", "paid"] as const;
  const pollVerify = useCallback(
    async (regId: string, attempts = 6, delayMs = 3000): Promise<boolean> => {
      for (let i = 0; i < attempts; i++) {
        if (i > 0) await new Promise((res) => setTimeout(res, delayMs));
        try {
          const { status } = await paymentsService.verifyPayment(regId);
          if (POST_PAYMENT_STATUSES.includes(status as typeof POST_PAYMENT_STATUSES[number])) return true;
        } catch {}
      }
      return false;
    },
    []
  );

  const startPayment = useCallback(async () => {
    if (!registrationId) {
      setPaymentState("error");
      setErrorDetail("Registration ID not found.");
      return;
    }
    try {
      setLoadingMessage("Preparing payment...");
      setPaymentState("loading");
      const { redirectUrl } = await paymentsService.createSnapToken(registrationId, payerKind);

      setPaymentState("opening");
      WebBrowser.dismissAuthSession();
      const result = await WebBrowser.openAuthSessionAsync(redirectUrl, "competzy://");

      setLoadingMessage("Verifying payment status...");
      setPaymentState("loading");

      if (result.type === "success" && result.url) {
        const urlObj = new URL(result.url);
        const txStatus = urlObj.searchParams.get("transaction_status");
        if (txStatus === "pending") {
          await refreshRegistrations();
          setPaymentState("pending");
          return;
        }
        if (["deny", "cancel", "expire", "failure"].includes(txStatus ?? "")) {
          setPaymentState("failed");
          return;
        }
        const paid = await pollVerify(registrationId);
        await refreshRegistrations();
        setPaymentState(paid ? "success" : "cancelled");
      } else {
        const paid = await pollVerify(registrationId);
        await refreshRegistrations();
        setPaymentState(paid ? "success" : "cancelled");
      }
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes("already paid")) {
        await refreshRegistrations();
        setPaymentState("success");
        return;
      }
      console.error("Payment error:", err);
      setErrorDetail(err?.message || "");
      setPaymentState("error");
    }
  }, [registrationId, refreshRegistrations, pollVerify, payerKind]);

  // ─── Selecting payer ───────────────────────────────────────────────────────
  if (paymentState === "selecting") {
    return (
      <View
        style={[styles.container, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }]}
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.xl }} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: "center", marginVertical: Spacing.xl }}>
            <View style={styles.heroEmoji}>
              <Text style={{ fontSize: 40 }}>💳</Text>
            </View>
            <Text style={[Type.displayMd, { marginTop: Spacing.lg, textAlign: "center" }]}>
              Paid By
            </Text>
            <Text
              style={[Type.body, { color: TextColor.secondary, marginTop: Spacing.sm, textAlign: "center" }]}
            >
              Choose who covers the fee. Receipt will be sent in the payer name.
            </Text>
          </View>

          <View style={{ gap: Spacing.md }}>
            {PAYER_OPTIONS.map((opt) => {
              const selected = payerKind === opt.value;
              return (
                <Card
                  key={opt.value}
                  onPress={() => setPayerKind(opt.value)}
                  style={
                    selected
                      ? { borderWidth: 2, borderColor: Brand.primary, backgroundColor: Brand.primarySoft }
                      : { borderWidth: 2, borderColor: "transparent" }
                  }
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={[styles.payerEmojiTile, { backgroundColor: selected ? "#FFFFFF" : Brand.primarySoft }]}>
                      <Text style={{ fontSize: 24 }}>{opt.emoji}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: Spacing.md }}>
                      <Text style={[Type.title, { color: selected ? Brand.primary : TextColor.primary }]}>
                        {opt.label}
                      </Text>
                      <Text style={[Type.bodySm, { marginTop: 2 }]}>{opt.subtitle}</Text>
                    </View>
                    <View style={[styles.radioOuter, selected && { borderColor: Brand.primary }]}>
                      {selected ? <View style={styles.radioInner} /> : null}
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <Button
            label="Continue to Payment"
            onPress={() => {
              if (started.current) return;
              started.current = true;
              startPayment();
            }}
            fullWidth
            size="lg"
          />
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.7 }]}>
            <Text style={[Type.label, { color: TextColor.secondary }]}>Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── Loading / opening ────────────────────────────────────────────────────
  if (paymentState === "loading" || paymentState === "opening") {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <View style={styles.heroEmoji}>
          <Text style={{ fontSize: 40 }}>⏳</Text>
        </View>
        <ActivityIndicator size="large" color={Brand.primary} style={{ marginTop: Spacing.lg }} />
        <Text style={[Type.body, { color: TextColor.secondary, textAlign: "center", marginTop: Spacing.lg }]}>
          {paymentState === "opening" ? "Opening payment page..." : loadingMessage}
        </Text>
      </View>
    );
  }

  // ─── Result state ─────────────────────────────────────────────────────────
  const content = STATE_CONTENT[paymentState];

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl, justifyContent: "center" },
      ]}
    >
      <View style={{ paddingHorizontal: Spacing.xl }}>
        <Card padding="2xl" style={{ alignItems: "center" }}>
          <View style={[styles.statusEmoji, { backgroundColor: content.bg }]}>
            <Text style={{ fontSize: 56 }}>{content.emoji}</Text>
          </View>
          <Text
            style={[
              Type.h1,
              { color: content.accent, marginTop: Spacing.lg, textAlign: "center" },
            ]}
          >
            {content.title}
          </Text>
          <Text
            style={[
              Type.body,
              { color: TextColor.secondary, textAlign: "center", marginTop: Spacing.md },
            ]}
          >
            {content.subtitle}
          </Text>
          {paymentState === "error" && errorDetail ? (
            <Text style={[Type.caption, { color: Brand.error, marginTop: Spacing.md, textAlign: "center" }]}>
              {errorDetail}
            </Text>
          ) : null}
        </Card>

        <View style={{ marginTop: Spacing.xl, gap: Spacing.md }}>
          {paymentState === "success" || paymentState === "pending" ? (
            <Button
              label="View Competitionku"
              onPress={() => router.replace("/(tabs)/my-competitions")}
              fullWidth
              size="lg"
            />
          ) : (
            <Button label="Try Again" onPress={startPayment} fullWidth size="lg" />
          )}
          {paymentState === "cancelled" ? (
            <Button label="Pay Now" variant="secondary" onPress={startPayment} fullWidth />
          ) : null}
          <Button label="Back" variant="ghost" onPress={() => router.back()} fullWidth />
        </View>
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
    backgroundColor: Surface.background,
    paddingHorizontal: Spacing.xl,
  },
  heroEmoji: {
    width: 96,
    height: 96,
    borderRadius: Radius["2xl"],
    backgroundColor: Brand.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.md,
  },
  statusEmoji: {
    width: 112,
    height: 112,
    borderRadius: Radius["3xl"],
    alignItems: "center",
    justifyContent: "center",
  },
  payerEmojiTile: {
    width: 56,
    height: 56,
    borderRadius: Radius.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Surface.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Brand.primary,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    backgroundColor: Surface.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Surface.divider,
    gap: Spacing.sm,
  },
  backLink: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
});
