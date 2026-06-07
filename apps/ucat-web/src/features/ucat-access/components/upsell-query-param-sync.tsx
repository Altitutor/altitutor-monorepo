"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUpsellDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import {
  hasTruthySearchParam,
  IN_PERSON_SEARCH_PARAM,
  stripUpsellSearchParams,
  UPGRADE_SEARCH_PARAM,
} from "@/features/ucat-access/lib/upsell-query-params";

/**
 * Opens plan-picker / in-person upsell dialogs from `?upgrade=1` and `?inPerson=1`.
 * Strips the param when the dialog closes.
 */
export function UpsellQueryParamSync() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    openPlanPicker,
    openInPersonUpsell,
    planPickerOpen,
    inPersonUpsellOpen,
  } = useUpsellDialog();
  const openedFromParamsRef = useRef<"upgrade" | "inPerson" | null>(null);

  useEffect(() => {
    const wantsUpgrade = hasTruthySearchParam(searchParams, UPGRADE_SEARCH_PARAM);
    const wantsInPerson = hasTruthySearchParam(
      searchParams,
      IN_PERSON_SEARCH_PARAM,
    );

    if (wantsUpgrade) {
      openedFromParamsRef.current = "upgrade";
      openPlanPicker();
      return;
    }

    if (wantsInPerson) {
      openedFromParamsRef.current = "inPerson";
      openInPersonUpsell();
    }
  }, [searchParams, openPlanPicker, openInPersonUpsell]);

  useEffect(() => {
    const source = openedFromParamsRef.current;
    if (!source) return;

    const isOpen =
      source === "upgrade" ? planPickerOpen : inPersonUpsellOpen;
    if (isOpen) return;

    openedFromParamsRef.current = null;
    const nextParams = stripUpsellSearchParams(searchParams);
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [planPickerOpen, inPersonUpsellOpen, pathname, router, searchParams]);

  return null;
}
