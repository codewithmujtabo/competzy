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
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const PAYER_OPTIONS: Array<{ value: PayerKind; icon: IoniconName; label: string; subtitle: string }> = [
  { value: "self",    icon: "person",    label: "Myself",            subtitle: "Payment in my name" },
  { value: "parent",  icon: "people",    label: "Parent / Guardian", subtitle: "Receipt issued in the parent name" },
  { value: "school",  icon: "business",  label: "School",            subtitle: "School covers the fee" },
  { value: "sponsor", icon: "briefcase", label: "Sponsor",           subtitle: "Third party (foundation, company)" },
];

const STATE_CONTENT: Record<
  Exclude<PaymentState, "selecting" | "loading" | "opening">,
  { icon: IoniconName; title: string; subtitle: string; accent: string; bg: string }
> = {
  success: {
    icon: "checkmark-circle",
    title: "Payment Completed!",
    subtitle:
      "Your payment has been confirmed. Your spot is secured! Head to My Competitions to track your registration.",
    accent: Brand.success,
    bg: Brand.successSoft,
  },
  pending: {
    icon: "time",
    title: "Payment Pending",
    subtitle:
      "Your payment is being processed. We will notify you once confirmed. You can close this screen.",
    accent: Brand.warning,
    bg: Brand.warningSoft,
  },
  failed: {
    icon: "close-circle",
    title: "Payment Failed",
    subtitle:
      "Transaction was unsuccessful. Try again or use a different payment method.",
    accent: Brand.error,
    bg: Brand.errorSoft,
  },
  cancelled: {
    icon: "arrow-undo",
    title: "Page Closed",
    subtitle:
      "Payment page was closed. If you already paid, status will update automatically. If not, try again.",
    accent: TextColor.secondary,
    bg: Surface.cardAlt,
  },
  error: {
    icon: "alert-circle",
    title: "An Error Occurred",
    subtitle: "Unable to load payment page. Try again in a moment.",
    accent: Brand.error,
    bg: Brand.errorSoft,
  },
};

// Rupiah formatting — manual thousands separator (Hermes has limited Intl).
function rupiah(n: number): string {
  return "Rp " + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export default function PayScreen() {
  const { registrationId } = useLocalSearchParams<{ registrationId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshRegistrations } = useUser();

  const [paymentState, setPaymentState] = useState<PaymentState>("selecting");
  const [loadingMessage, setLoadingMessage] = useState("Preparing payment...");
  const [errorDetail, setErrorDetail] = useState("");
  const [payerKind, setPayerKind] = useState<PayerKind>("self");

  // Registration-fee voucher (Wave 11 Phase 3).
  const [voucherInput, setVoucherInput] = useState("");
  const [voucher, setVoucher] = useState<paymentsService.VoucherValidation | null>(null);
  const [checkingVoucher, setCheckingVoucher] = useState(false);

  const started = useRef(false);

  const applyVoucher = useCallback(async () => {
    const code = voucherInput.trim();
    if (!code || !registrationId) return;
    setCheckingVoucher(true);
    try {
      setVoucher(await paymentsService.validateVoucher(registrationId, code));
    } catch {
      setVoucher({
        valid: false,
        message: "Could not check that voucher. Try again.",
        originalFee: 0,
        discountedFee: null,
      });
    } finally {
      setCheckingVoucher(false);
    }
  }, [voucherInput, registrationId]);

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
      const appliedVoucher = voucher?.valid ? voucherInput.trim() : undefined;
      const snap = await paymentsService.createSnapToken(
        registrationId,
        payerKind,
        appliedVoucher
      );

      // A voucher that fully covers the fee settles server-side — no Midtrans.
      if (snap.covered) {
        await refreshRegistrations();
        setPaymentState("success");
        return;
      }
      if (!snap.redirectUrl) {
        setErrorDetail("Could not start the payment. Please try again.");
        setPaymentState("error");
        return;
      }

      setPaymentState("opening");
      WebBrowser.dismissAuthSession();
      const result = await WebBrowser.openAuthSessionAsync(snap.redirectUrl, "competzy://");

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
  }, [registrationId, refreshRegistrations, pollVerify, payerKind, voucher, voucherInput]);

  // ─── Selecting payer ───────────────────────────────────────────────────────
  if (paymentState === "selecting") {
    return (
      <View
        style={[styles.container, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }]}
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.xl }} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: "center", marginVertical: Spacing.xl }}>
            <View style={styles.heroIcon}>
              <Ionicons name="card" size={40} color={Brand.primary} />
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
                    <View style={[styles.payerIconTile, { backgroundColor: selected ? "#FFFFFF" : Brand.primarySoft }]}>
                      <Ionicons name={opt.icon} size={24} color={Brand.primary} />
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

          {/* Registration-fee voucher */}
          <Card style={{ marginTop: Spacing.lg }}>
            <Text style={[Type.label, { color: TextColor.secondary }]}>HAVE A VOUCHER?</Text>
            {voucher?.valid ? (
              <View style={{ marginTop: Spacing.md }}>
                <View style={styles.voucherApplied}>
                  <Ionicons name="checkmark-circle" size={18} color={Brand.success} />
                  <Text style={[Type.bodySm, { flex: 1, color: Brand.success }]}>
                    Voucher applied
                  </Text>
                  <Pressable
                    onPress={() => {
                      setVoucher(null);
                      setVoucherInput("");
                    }}
                  >
                    <Text style={[Type.label, { color: TextColor.secondary }]}>REMOVE</Text>
                  </Pressable>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.md }}>
                  <Text style={[Type.bodySm]}>Registration fee</Text>
                  <Text style={[Type.bodySm, { textDecorationLine: "line-through" }]}>
                    {rupiah(voucher.originalFee)}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.xs }}>
                  <Text style={[Type.title]}>You pay</Text>
                  <Text style={[Type.title, { color: Brand.primary }]}>
                    {rupiah(voucher.discountedFee ?? voucher.originalFee)}
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md }}>
                  <TextInput
                    value={voucherInput}
                    onChangeText={(t) => setVoucherInput(t.toUpperCase())}
                    placeholder="VG-XXX-XXXXXX"
                    placeholderTextColor={TextColor.tertiary}
                    autoCapitalize="characters"
                    style={styles.voucherInput}
                  />
                  <Button
                    label={checkingVoucher ? "..." : "Apply"}
                    variant="secondary"
                    loading={checkingVoucher}
                    disabled={!voucherInput.trim()}
                    onPress={applyVoucher}
                  />
                </View>
                {voucher && !voucher.valid ? (
                  <Text style={[Type.bodySm, { color: Brand.error, marginTop: Spacing.sm }]}>
                    {voucher.message ?? "That voucher is not valid."}
                  </Text>
                ) : null}
              </>
            )}
          </Card>
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
        <View style={styles.heroIcon}>
          <Ionicons name="time" size={40} color={Brand.primary} />
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
          <View style={[styles.statusIcon, { backgroundColor: content.bg }]}>
            <Ionicons name={content.icon} size={56} color={content.accent} />
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
              label="View My Competitions"
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
  heroIcon: {
    width: 96,
    height: 96,
    borderRadius: Radius["2xl"],
    backgroundColor: Brand.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.md,
  },
  statusIcon: {
    width: 112,
    height: 112,
    borderRadius: Radius["3xl"],
    alignItems: "center",
    justifyContent: "center",
  },
  payerIconTile: {
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
  voucherApplied: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  voucherInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Surface.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Surface.card,
    ...Type.body,
  },
});
