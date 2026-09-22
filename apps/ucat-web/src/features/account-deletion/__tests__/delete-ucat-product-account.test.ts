import {
  confirmedFullNameMatches,
  deleteUcatProductAccount,
  type ProductAccountDeletionStore,
} from "@/features/account-deletion/delete-ucat-product-account";

function store(
  overrides: Partial<ProductAccountDeletionStore> = {},
): ProductAccountDeletionStore & {
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    loadStudent: jest.fn(async () => {
      calls.push("loadStudent");
      return {
        id: "student-1",
        firstName: "Ada",
        lastName: "Lovelace",
        inPersonStatus: null,
      };
    }),
    hasStaffLogin: jest.fn(async () => {
      calls.push("hasStaffLogin");
      return false;
    }),
    loadManageableSubscriptions: jest.fn(async () => {
      calls.push("loadManageableSubscriptions");
      return [{ id: "sub-row-1", stripeSubscriptionId: "sub_123" }];
    }),
    markSubscriptionCanceled: jest.fn(async () => {
      calls.push("markSubscriptionCanceled");
    }),
    deleteLearningData: jest.fn(async () => {
      calls.push("deleteLearningData");
    }),
    unlinkLogin: jest.fn(async () => {
      calls.push("unlinkLogin");
    }),
    relinkLogin: jest.fn(async () => {
      calls.push("relinkLogin");
    }),
    ...overrides,
  };
}

describe("confirmedFullNameMatches", () => {
  it("matches the student full name ignoring case and extra spaces", () => {
    expect(
      confirmedFullNameMatches("Ada", "Lovelace", "  ada   lovelace "),
    ).toBe(true);
  });

  it("rejects a different name", () => {
    expect(confirmedFullNameMatches("Ada", "Lovelace", "Ada Byron")).toBe(
      false,
    );
  });
});

describe("deleteUcatProductAccount", () => {
  it("cancels the subscription, deletes UCAT learning data, and removes the login when there is no in-person relationship", async () => {
    const order: string[] = [];
    const deletionStore = store({
      deleteLearningData: jest.fn(async () => {
        order.push("deleteLearningData");
      }),
      unlinkLogin: jest.fn(async () => {
        order.push("unlinkLogin");
      }),
    });
    const cancelStripeSubscription = jest.fn(async () => {
      order.push("cancelStripeSubscription");
    });
    const deleteAuthUser = jest.fn(async () => {
      order.push("deleteAuthUser");
    });

    const result = await deleteUcatProductAccount({
      userId: "user-1",
      fullName: "Ada Lovelace",
      store: deletionStore,
      cancelStripeSubscription,
      deleteAuthUser,
    });

    expect(result).toEqual({ ok: true, loginRemoved: true });
    expect(cancelStripeSubscription).toHaveBeenCalledWith("sub_123");
    expect(deletionStore.markSubscriptionCanceled).toHaveBeenCalledWith(
      "sub-row-1",
      expect.any(String),
    );
    expect(order).toEqual([
      "cancelStripeSubscription",
      "deleteLearningData",
      "unlinkLogin",
      "deleteAuthUser",
    ]);
  });

  it("keeps the login when an in-person relationship exists", async () => {
    const deletionStore = store({
      loadStudent: jest.fn(async () => ({
        id: "student-1",
        firstName: "Ada",
        lastName: "Lovelace",
        inPersonStatus: "DISCONTINUED",
      })),
    });
    const deleteAuthUser = jest.fn(async () => undefined);

    const result = await deleteUcatProductAccount({
      userId: "user-1",
      fullName: "Ada Lovelace",
      store: deletionStore,
      cancelStripeSubscription: jest.fn(async () => undefined),
      deleteAuthUser,
    });

    expect(result).toEqual({ ok: true, loginRemoved: false });
    expect(deletionStore.deleteLearningData).toHaveBeenCalledWith("student-1");
    expect(deletionStore.unlinkLogin).not.toHaveBeenCalled();
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });

  it("keeps the login when the same person is staff", async () => {
    const deletionStore = store({
      hasStaffLogin: jest.fn(async () => true),
    });
    const deleteAuthUser = jest.fn(async () => undefined);

    const result = await deleteUcatProductAccount({
      userId: "user-1",
      fullName: "Ada Lovelace",
      store: deletionStore,
      cancelStripeSubscription: jest.fn(async () => undefined),
      deleteAuthUser,
    });

    expect(result).toEqual({ ok: true, loginRemoved: false });
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });

  it("does not delete learning data when the typed name does not match", async () => {
    const deletionStore = store();

    const result = await deleteUcatProductAccount({
      userId: "user-1",
      fullName: "Someone Else",
      store: deletionStore,
      cancelStripeSubscription: jest.fn(),
      deleteAuthUser: jest.fn(),
    });

    expect(result).toEqual({ ok: false, error: "name_mismatch" });
    expect(deletionStore.deleteLearningData).not.toHaveBeenCalled();
    expect(deletionStore.unlinkLogin).not.toHaveBeenCalled();
  });

  it("does not delete learning data when cancelling the subscription fails", async () => {
    const deletionStore = store();

    const result = await deleteUcatProductAccount({
      userId: "user-1",
      fullName: "Ada Lovelace",
      store: deletionStore,
      cancelStripeSubscription: jest.fn(async () => {
        throw new Error("stripe down");
      }),
      deleteAuthUser: jest.fn(),
    });

    expect(result).toEqual({ ok: false, error: "billing_failed" });
    expect(deletionStore.deleteLearningData).not.toHaveBeenCalled();
  });

  it("deletes learning data when there is no subscription to cancel", async () => {
    const deletionStore = store({
      loadManageableSubscriptions: jest.fn(async () => []),
    });
    const cancelStripeSubscription = jest.fn();

    const result = await deleteUcatProductAccount({
      userId: "user-1",
      fullName: "Ada Lovelace",
      store: deletionStore,
      cancelStripeSubscription,
      deleteAuthUser: jest.fn(async () => undefined),
    });

    expect(result).toEqual({ ok: true, loginRemoved: true });
    expect(cancelStripeSubscription).not.toHaveBeenCalled();
    expect(deletionStore.deleteLearningData).toHaveBeenCalledWith("student-1");
  });

  it("relinks the login when removing the auth user fails", async () => {
    const deletionStore = store();

    const result = await deleteUcatProductAccount({
      userId: "user-1",
      fullName: "Ada Lovelace",
      store: deletionStore,
      cancelStripeSubscription: jest.fn(async () => undefined),
      deleteAuthUser: jest.fn(async () => {
        throw new Error("auth delete failed");
      }),
    });

    expect(result).toEqual({ ok: false, error: "deletion_failed" });
    expect(deletionStore.unlinkLogin).toHaveBeenCalledWith("student-1");
    expect(deletionStore.relinkLogin).toHaveBeenCalledWith(
      "student-1",
      "user-1",
    );
  });
});
