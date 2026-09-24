import { QueryClient } from "@tanstack/react-query";
import {
  PUBLIC_SUBSCRIPTION_CONFIG_QUERY_KEY,
  publicSubscriptionConfigQueryOptions,
} from "@/features/subscription/hooks/use-public-subscription-config";

const CONFIG_RESPONSE = {
  trialDays: 5,
  minQuestionsPerDay: 10,
  currency: "aud",
  freeQuotas: {
    practice: { limit: 10, period: "day" },
    sets: { limit: 1, period: "week" },
    mocks: { limit: 1, period: "month" },
    learn: { limit: 3, period: "week" },
    skill_trainer: { limit: 3, period: "week" },
  },
  planPrices: [],
  practiceDayDiscounts: [],
  unlimitedProductConfigured: false,
};

describe("public subscription config query", () => {
  it("keeps successful pricing data fresh for five minutes", async () => {
    const queryFn = jest.fn().mockResolvedValue(CONFIG_RESPONSE);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const options = {
      ...publicSubscriptionConfigQueryOptions,
      queryFn,
    };

    await queryClient.fetchQuery(options);
    await queryClient.fetchQuery(options);

    expect(PUBLIC_SUBSCRIPTION_CONFIG_QUERY_KEY).toEqual([
      "public-ucat-subscription-config",
    ]);
    expect(publicSubscriptionConfigQueryOptions.staleTime).toBe(5 * 60 * 1000);
    expect(publicSubscriptionConfigQueryOptions.gcTime).toBe(30 * 60 * 1000);
    expect(queryFn).toHaveBeenCalledTimes(1);
  });
});
