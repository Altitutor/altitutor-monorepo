import {
  useCallback,
  useLayoutEffect,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import Constants from "expo-constants";
import { AppState, Linking } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useIAP,
  getAvailablePurchases,
  restorePurchases,
  showManageSubscriptionsIOS,
  finishTransaction,
  isUserCancelledError,
  type Purchase,
} from "expo-iap";
import {
  UCAT_APPLE_PRODUCTS,
  type UcatAppleBillingState,
} from "@altitutor/shared";
import { useAuth } from "@/features/auth/auth-provider";
import { api } from "@/lib/api";
import { ApplePurchaseContext } from "./purchase-context";
import {
  settleApplePurchase,
  launchBoundApplePurchase,
} from "./purchase-workflow";
import { createAppleBillingApi } from "./purchase-api";

const appleApi = createAppleBillingApi(api);

export function ApplePurchasesProvider(
  props: PropsWithChildren<{ ready: boolean }>,
) {
  // Expo Go does not include StoreKit's native module. Ordinary browsing still works.
  return Constants.appOwnership === "expo" ? (
    props.children
  ) : (
    <StorePurchases {...props} />
  );
}
function StorePurchases({
  children,
  ready,
}: PropsWithChildren<{ ready: boolean }>) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const currentUser = useRef(userId);
  useLayoutEffect(() => {
    currentUser.current = userId;
    return () => {
      currentUser.current = undefined;
    };
  }, [userId]);
  const active = useRef(true);
  const pending = useRef(new Set<string>());
  const purchaseOwner = useRef<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queries = useQueryClient();
  const state = useQuery({
    queryKey: ["apple-billing", userId],
    queryFn: () => api<UcatAppleBillingState>("/apple"),
    enabled: ready,
    staleTime: 0,
  });
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const showError = useCallback((value: unknown) => {
    if (active.current)
      setError(
        value instanceof Error
          ? value.message
          : "Unable to complete purchase. Please try Restore purchases.",
      );
  }, []);
  const confirm = useCallback(
    async (purchase: Purchase) => {
      const owner = currentUser.current;
      if (!owner || !ready || pending.current.has(purchase.id)) return;
      if (!UCAT_APPLE_PRODUCTS.some((p) => p.id === purchase.productId)) return;
      pending.current.add(purchase.id);
      try {
        await settleApplePurchase({
          purchase,
          userId: owner,
          currentUserId: () => currentUser.current,
          verify: appleApi.verify,
          finish: (purchase) =>
            finishTransaction({ purchase, isConsumable: false }),
        });
        if (currentUser.current === owner) {
          await queries.invalidateQueries({
            queryKey: ["apple-billing", owner],
          });
          await queries.invalidateQueries({ queryKey: ["quota"] });
        }
      } catch (value) {
        if (currentUser.current === owner) showError(value);
        throw value;
      } finally {
        pending.current.delete(purchase.id);
        if (active.current && currentUser.current === owner) setBusy(false);
      }
    },
    [queries, ready, showError],
  );
  const iap = useIAP({
    onPurchaseSuccess: (purchase) => {
      void confirm(purchase).catch(() => {});
    },
    onPurchaseError: (value) => {
      if (active.current) setBusy(false);
      if (isUserCancelledError(value)) {
        if (purchaseOwner.current === currentUser.current)
          void appleApi.release().catch(showError);
        return;
      }
      showError(value);
    },
    onError: showError,
  });
  const refetch = state.refetch;
  const reconcile = useCallback(async () => {
    const purchases = await getAvailablePurchases({
      onlyIncludeActiveItemsIOS: true,
      alsoPublishToEventListenerIOS: false,
    });
    for (const purchase of purchases) await confirm(purchase);
    await refetch();
  }, [confirm, refetch]);
  const { connected, fetchProducts } = iap;
  useEffect(() => {
    if (!ready || !connected || !state.data?.configured) return;
    setLoadingProducts(true);
    void fetchProducts({
      skus: UCAT_APPLE_PRODUCTS.map((p) => p.id),
      type: "subs",
    })
      .catch(showError)
      .finally(() => {
        if (active.current) setLoadingProducts(false);
      });
    void reconcile().catch(showError);
    const listener = AppState.addEventListener("change", (value) => {
      if (value === "active") void reconcile().catch(showError);
    });
    return () => listener.remove();
  }, [
    ready,
    connected,
    userId,
    state.data?.configured,
    fetchProducts,
    reconcile,
    showError,
  ]);
  const run = async (action: () => Promise<void>) => {
    if (!ready || !connected || !state.data?.configured)
      throw new Error("Purchases are temporarily unavailable.");
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (value) {
      showError(value);
      throw value;
    } finally {
      if (active.current) setBusy(false);
      await refetch();
    }
  };
  return (
    <ApplePurchaseContext
      value={{
        supported: true,
        connected,
        busy,
        loadingProducts,
        refresh: async () => {
          setError(null);
          await iap.reconnect();
          await refetch();
        },
        state: state.data,
        error: error ?? state.error?.message ?? null,
        products: iap.subscriptions.map((p) => ({
          id: p.id,
          displayPrice: p.displayPrice,
        })),
        buy: async (productId) => {
          if (!state.data?.canPurchase)
            throw new Error(
              "Your account already has access or an existing subscription.",
            );
          const owner = currentUser.current;
          if (!owner) throw new Error("Sign in to continue.");
          purchaseOwner.current = owner;
          await run(async () => {
            try {
              await launchBoundApplePurchase({
                userId: owner,
                currentUserId: () => currentUser.current,
                prepare: () => appleApi.prepare(productId),
                request: (accountToken) =>
                  iap.requestPurchase({
                    type: "subs",
                    request: {
                      apple: {
                        sku: productId,
                        appAccountToken: accountToken,
                        andDangerouslyFinishTransactionAutomatically: false,
                      },
                    },
                  }),
              });
            } catch (value) {
              if (!isUserCancelledError(value)) throw value;
              if (owner === currentUser.current) await appleApi.release();
            }
          });
        },
        restore: () =>
          run(async () => {
            await restorePurchases();
            await reconcile();
          }),
        clearCancelledCheckout: async () => {
          if (!ready) throw new Error("Sign in to continue.");
          // Recover any completed purchase before releasing an abandoned reservation.
          if (connected && state.data?.configured) await reconcile();
          await appleApi.release();
          await refetch();
        },
        manage: async () => {
          // Billing management must remain reachable while our server is unavailable.
          try {
            await showManageSubscriptionsIOS();
          } catch {
            await Linking.openURL(
              "https://apps.apple.com/account/subscriptions",
            );
          }
          if (ready && connected && state.data?.configured)
            await reconcile().catch(showError);
        },
      }}
    >
      {children}
    </ApplePurchaseContext>
  );
}
