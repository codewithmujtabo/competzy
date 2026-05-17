import { Button, Card, EmptyState, Pill, ScreenHeader } from "@/components/ui";
import {
  Brand,
  FontFamily,
  Radius,
  Shadow,
  Spacing,
  Surface,
  Text as TextColor,
  Type,
} from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import * as historicalService from "@/services/historical.service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Tab = "claimed" | "search";

function ResultPill({ result }: { result: string | null }) {
  if (!result) return null;
  const passed = result === "PASSED";
  return <Pill label={passed ? "Passed" : "Failed"} tone={passed ? "success" : "danger"} size="sm" />;
}

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>("claimed");
  const [searchName, setSearchName] = useState("");
  const [searchSchool, setSearchSchool] = useState("");
  const [searchCompName, setSearchCompName] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const { data: claimed = [], isLoading: isLoadingClaimed, refetch: refetchClaimed } = useQuery({
    queryKey: ["historicalMyRecords"],
    queryFn: () => historicalService.getMyRecords(),
  });

  const {
    data: searchResults = [],
    isLoading: isSearching,
    refetch: runSearch,
  } = useQuery({
    queryKey: ["historicalSearch", searchName, searchSchool, searchCompName],
    queryFn: () =>
      historicalService.search({
        name: searchName.trim(),
        school: searchSchool.trim() || undefined,
        compName: searchCompName.trim() || undefined,
      }),
    enabled: false,
  });

  const claimMutation = useMutation({
    mutationFn: (id: string) => historicalService.claim(id),
    onSuccess: () => {
      Alert.alert("Success", "Record added to your history.");
      queryClient.invalidateQueries({ queryKey: ["historicalMyRecords"] });
      queryClient.invalidateQueries({ queryKey: ["historicalSearch"] });
    },
    onError: (err: any) => Alert.alert("Error", err.message || "Failed to add."),
  });

  const unclaimMutation = useMutation({
    mutationFn: (id: string) => historicalService.unclaim(id),
    onSuccess: () => {
      Alert.alert("Removed", "Record removed from your history.");
      refetchClaimed();
    },
    onError: (err: any) => Alert.alert("Error", err.message || "Failed to remove."),
  });

  const handleSearch = () => {
    if (searchName.trim().length < 3) {
      Alert.alert("Too short", "Name must be at least 3 characters.");
      return;
    }
    setHasSearched(true);
    runSearch();
  };

  const handleUnclaim = (id: string, compName: string | null) => {
    Alert.alert("Remove Record", `Remove "${compName ?? "this record"}" from history?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => unclaimMutation.mutate(id) },
    ]);
  };

  const claimedIds = new Set(claimed.map((r) => r.id));

  const renderClaimedCard = ({ item }: { item: historicalService.ClaimedRecord }) => (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: Spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text style={Type.title}>{item.compName ?? "Competition"}</Text>
          <Text style={[Type.bodySm, { marginTop: 4 }]}>
            {[item.compYear, item.compCategory, item.eventPart].filter(Boolean).join(" · ")}
          </Text>
          {item.schoolName ? (
            <Text style={[Type.caption, { marginTop: 2 }]}>{item.schoolName}</Text>
          ) : null}
        </View>
        <ResultPill result={item.result} />
      </View>
      <View style={{ alignSelf: "flex-start", marginTop: Spacing.md }}>
        <Button label="Remove" variant="ghost" size="sm" onPress={() => handleUnclaim(item.id, item.compName)} disabled={unclaimMutation.isPending} />
      </View>
    </Card>
  );

  const renderSearchCard = (item: historicalService.HistoricalRecord) => {
    const already = claimedIds.has(item.id);
    return (
      <Card key={item.id}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: Spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={Type.title}>{item.fullName}</Text>
            <Text style={[Type.bodySm, { color: Brand.primary, marginTop: 2 }]}>
              {item.compName ?? "Competition"}
            </Text>
            <Text style={[Type.caption, { marginTop: 4 }]}>
              {[item.compYear, item.compCategory, item.eventPart].filter(Boolean).join(" · ")}
            </Text>
            {item.schoolName ? (
              <Text style={[Type.caption, { marginTop: 2 }]}>{item.schoolName}</Text>
            ) : null}
          </View>
          <ResultPill result={item.result} />
        </View>
        <View style={{ marginTop: Spacing.md, alignSelf: "flex-start" }}>
          {already ? (
            <Pill label="In your history" tone="success" />
          ) : (
            <Button
              label="Add to History"
              size="sm"
              onPress={() => claimMutation.mutate(item.id)}
              loading={claimMutation.isPending}
            />
          )}
        </View>
      </Card>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Competition History" />

      <View style={styles.tabBar}>
        {(["claimed", "search"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={({ pressed }) => [styles.tab, tab === t && styles.tabActive, pressed && { opacity: 0.85 }]}
            onPress={() => setTab(t)}
          >
            <Text style={{ ...Type.label, color: tab === t ? Brand.primary : TextColor.tertiary, fontSize: 14 }}>
              {t === "claimed" ? `My Records${claimed.length > 0 ? ` (${claimed.length})` : ""}` : "Find & Claim"}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "claimed" ? (
        isLoadingClaimed ? (
          <ActivityIndicator style={{ marginTop: Spacing["3xl"] }} color={Brand.primary} />
        ) : claimed.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="trophy-outline" size={44} color={Brand.primary} />}
            title="No history yet"
            message="Your past competition records will appear here after auto-linking, or search in the Find & Claim tab."
          />
        ) : (
          <FlatList
            data={claimed}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={renderSep}
            renderItem={renderClaimedCard}
          />
        )
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
          <Card variant="tinted" tint={Brand.infoSoft}>
            <Text style={[Type.body, { color: Brand.info, lineHeight: 22 }]}>
              Search your name as it appears in past competition records to find and claim your history.
            </Text>
          </Card>

          <View style={{ marginTop: Spacing.lg, gap: Spacing.md }}>
            <TextInput
              style={styles.input}
              placeholder="Your name (min 3 chars)"
              placeholderTextColor={TextColor.tertiary}
              value={searchName}
              onChangeText={setSearchName}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            <TextInput
              style={styles.input}
              placeholder="School name (optional)"
              placeholderTextColor={TextColor.tertiary}
              value={searchSchool}
              onChangeText={setSearchSchool}
            />
            <TextInput
              style={styles.input}
              placeholder="Competition name e.g. EMC (optional)"
              placeholderTextColor={TextColor.tertiary}
              value={searchCompName}
              onChangeText={setSearchCompName}
            />
            <Button
              label={isSearching ? "Searching..." : "Search"}
              onPress={handleSearch}
              loading={isSearching}
              fullWidth
              size="lg"
            />
          </View>

          {hasSearched && !isSearching && searchResults.length === 0 ? (
            <View style={{ marginTop: Spacing["2xl"] }}>
              <EmptyState
                icon={<Ionicons name="search-outline" size={44} color={Brand.primary} />}
                title="Not found"
                message="Try a different name spelling or leave school/competition blank."
              />
            </View>
          ) : null}

          <View style={{ marginTop: Spacing.lg, gap: Spacing.md }}>
            {searchResults.map(renderSearchCard)}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const renderSep = () => <View style={{ height: Spacing.md }} />;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Surface.background },
  tabBar: {
    flexDirection: "row",
    backgroundColor: Surface.cardAlt,
    borderRadius: Radius.lg,
    padding: 4,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: Surface.card,
    ...Shadow.sm,
  },
  listContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing["3xl"],
  },
  input: {
    backgroundColor: Surface.card,
    borderWidth: 1,
    borderColor: Surface.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
    fontSize: 15,
    fontFamily: FontFamily.bodyRegular,
    color: TextColor.primary,
    ...Shadow.sm,
  },
});
