import { Alert, Linking, Platform } from "react-native";
import { Action, Copy, Group, Loading } from "@/components/ui";
import { UCAT_APPLE_PRODUCTS } from "@altitutor/shared";
import { openPrivacyPolicy } from "@/features/settings/open-privacy-policy";
import { useApplePurchases } from "./purchase-context";

export function ApplePlanActions() {
  const purchases = useApplePurchases();
  if (Platform.OS !== "ios") return null;
  const perform = (action: () => Promise<void>) => {
    void action().catch((error: unknown) =>
      Alert.alert(
        "Subscription",
        error instanceof Error ? error.message : "Please try again.",
      ),
    );
  };
  if (!purchases.supported)
    return (
      <Group>
        <Copy muted>Purchases are available in the installed iOS app.</Copy>
      </Group>
    );
  if (!purchases.state && !purchases.error) return <Loading variant="card" />;
  const state = purchases.state;
  return (
    <>
      {state?.provider === "stripe" && (
        <Group title="Subscription">
          <Copy>
            Your subscription is billed through the website. It includes
            Unlimited access across web and app.
          </Copy>
        </Group>
      )}
      {(state?.provider === "apple" || state?.apple) && (
        <Group title="Apple subscription">
          <Copy>
            {state.provider === "apple"
              ? "Billed by Apple."
              : "Your previous Apple subscription has ended."}
          </Copy>
          {state.apple?.accessUntil && state.provider === "apple" && (
            <Copy muted>
              Access until{" "}
              {new Date(state.apple.accessUntil).toLocaleDateString()}.
            </Copy>
          )}
          {state.apple?.status === 3 && (
            <Copy muted>
              There is a payment issue. Review your Apple subscription to
              continue.
            </Copy>
          )}
        </Group>
      )}
      {state?.canPurchase && (
        <Group title="Get UCAT Unlimited">
          <Copy>
            Unlimited practice, sets, mocks, learning and analytics across web
            and app.
          </Copy>
          {purchases.loadingProducts ? (
            <Loading variant="card" />
          ) : (
            UCAT_APPLE_PRODUCTS.map((product) => {
              const storeProduct = purchases.products.find(
                (p) => p.id === product.id,
              );
              return storeProduct ? (
                <Action
                  key={product.id}
                  title={`${storeProduct.displayPrice} / ${product.interval}`}
                  disabled={purchases.busy || !purchases.connected}
                  onPress={() => perform(() => purchases.buy(product.id))}
                />
              ) : null;
            })
          )}
          {!purchases.loadingProducts && purchases.products.length === 0 && (
            <Copy muted>Subscriptions could not be loaded. Please retry.</Copy>
          )}
          <Copy muted>
            Payment is charged to your Apple Account. Subscriptions renew
            automatically until cancelled. Apple manages billing and
            cancellation.
          </Copy>
          <Copy muted>
            Apple subscriptions use fixed pricing. Practice-day bill discounts
            and referral billing rewards are not included.
          </Copy>
          <Action
            title="Terms of use"
            secondary
            onPress={() =>
              perform(() =>
                Linking.openURL(
                  "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/",
                ).then(() => {}),
              )
            }
          />
          <Action
            title="Privacy policy"
            secondary
            onPress={() => perform(openPrivacyPolicy)}
          />
        </Group>
      )}
      {state && !state.configured && (
        <Copy muted>Subscriptions are temporarily unavailable.</Copy>
      )}
      {purchases.error && <Copy muted>{purchases.error}</Copy>}
      {state?.pendingAppleCheckout && (
        <Group title="Unfinished Apple purchase">
          <Copy muted>
            Restore purchases first if you completed payment. A pending purchase
            or approval can still complete through Apple.
          </Copy>
          <Action
            title="Clear cancelled checkout"
            secondary
            disabled={purchases.busy}
            onPress={() =>
              Alert.alert(
                "Clear cancelled checkout?",
                "Only continue if you cancelled the purchase with Apple and have no pending approval. Clearing this checkout does not cancel an Apple subscription. Check Apple before buying another plan to avoid duplicate billing.",
                [
                  { text: "Keep checkout", style: "cancel" },
                  {
                    text: "Clear checkout",
                    onPress: () => perform(purchases.clearCancelledCheckout),
                  },
                ],
              )
            }
          />
        </Group>
      )}
      <Action
        title="Manage Apple subscription"
        secondary
        disabled={purchases.busy}
        onPress={() => perform(purchases.manage)}
      />
      <Action
        title="Restore purchases"
        secondary
        disabled={purchases.busy || !purchases.connected || !state?.configured}
        onPress={() => perform(purchases.restore)}
      />
      <Action
        title="Refresh subscription"
        secondary
        disabled={purchases.busy}
        onPress={() => perform(purchases.refresh)}
      />
    </>
  );
}
