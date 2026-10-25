/** @jest-environment node */

import { randomBytes, randomUUID } from "node:crypto";
import type { Database } from "@altitutor/shared";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { POST } from "./route";

// Ordinary unit runs skip these contracts. The guarded runner supplies local keys.
const ownedDatabase =
  process.env.ALTITUTOR_OWNED_DB_INNER === "1" ||
  process.env.ALTITUTOR_REGISTRATION_DB_TEST === "1";
const password = "Synthetic-password-242!";

async function registrationFixture(sharedEmail = true) {
  const admin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const intendedId = randomUUID();
  const unrelatedId = randomUUID();
  const email = `registration-${randomUUID()}@example.test`;
  const token = randomBytes(16).toString("base64url");
  const { error: fixtureError } = await admin.from("students").insert([
    {
      id: intendedId,
      first_name: "Intended",
      last_name: "Student",
      email,
      status: "TRIAL",
      registration_public_token: token,
    },
    {
      id: unrelatedId,
      first_name: "Unrelated",
      last_name: "Student",
      email: sharedEmail ? email.toUpperCase() : `other-${email}`,
      status: "TRIAL",
    },
  ]);
  expect(fixtureError).toBeNull();
  // Stored synthetic payment evidence only: no Stripe request or external email.
  const { error: paymentError } = await admin
    .from("student_payment_methods")
    .insert({
      student_id: intendedId,
      stripe_payment_method_id: `pm_synthetic_${randomUUID()}`,
      card_brand: "visa",
      card_last4: "4242",
      card_exp_month: 12,
      card_exp_year: 2030,
    });
  expect(paymentError).toBeNull();

  function complete() {
    return POST(
      new NextRequest("http://localhost/api/register/complete", {
        method: "POST",
        body: JSON.stringify({
          token,
          student: {
            first_name: "Registered",
            last_name: "Student",
            email,
            availability_monday: true,
          },
          parents: [
            {
              first_name: "Synthetic",
              last_name: "Parent",
              email: "dev242-parent@example.test",
              phone: "0499999242",
            },
          ],
          subject_ids: [],
          password,
          confirmPassword: password,
        }),
      }),
    );
  }

  async function readStudent(id = intendedId) {
    const { data, error } = await admin
      .from("students")
      .select("id,user_id,status,first_name,registration_public_token")
      .eq("id", id)
      .maybeSingle();
    expect(error).toBeNull();
    return data;
  }

  return {
    admin,
    intendedId,
    unrelatedId,
    email,
    token,
    complete,
    readStudent,
  };
}

(ownedDatabase ? describe : describe.skip)(
  "registration with real local Auth",
  () => {
    beforeAll(() => {
      expect(["127.0.0.1", "localhost", "[::1]"]).toContain(
        new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
      );
    });

    afterEach(() => jest.restoreAllMocks());

    beforeEach(() => {
      jest.spyOn(console, "error").mockImplementation(() => undefined);
    });

    it.each([false, true])(
      "completes only the bearer-authorized Student (shared email: %s)",
      async (sharedEmail) => {
        const fixture = await registrationFixture(sharedEmail);
        const response = await fixture.complete();
        expect({
          status: response.status,
          result: await response.json(),
        }).toEqual({
          status: 200,
          result: {
            success: true,
            message: "Registration completed successfully",
            redirectTo: "/dashboard",
          },
        });
        const intended = await fixture.readStudent();
        expect(intended).toMatchObject({
          status: "ACTIVE",
          registration_public_token: fixture.token,
        });
        expect(intended?.user_id).toEqual(expect.any(String));
        expect(await fixture.readStudent(fixture.unrelatedId)).toMatchObject({
          status: "TRIAL",
          user_id: null,
        });
        const { data, error } = await fixture.admin.auth.signInWithPassword({
          email: fixture.email,
          password,
        });
        expect(error).toBeNull();
        expect(data.user?.id).toBe(intended?.user_id);
      },
    );

    it.each(["account_creation", "verification", "activation"])(
      "preserves the Student after %s failure so the same link can retry",
      async (stage) => {
        const fixture = await registrationFixture(false);
        const actualFetch = global.fetch;
        let accountCreated = false;
        const fetchSpy = jest
          .spyOn(global, "fetch")
          .mockImplementation(async (input, init) => {
            const url = new URL(
              input instanceof Request ? input.url : input.toString(),
            );
            const creatingAccount =
              url.pathname === "/auth/v1/admin/users" &&
              init?.method === "POST";
            if (
              (stage === "account_creation" && creatingAccount) ||
              (accountCreated &&
                url.pathname === "/rest/v1/students" &&
                ((stage === "verification" &&
                  url.searchParams.get("select") === "id,user_id,status" &&
                  init?.method !== "PATCH") ||
                  (stage === "activation" && init?.method === "PATCH")))
            ) {
              return new Response(
                JSON.stringify({
                  code: "synthetic_failure",
                  message: "Synthetic service outage",
                }),
                {
                  status: 500,
                  headers: { "Content-Type": "application/json" },
                },
              );
            }
            const response = await actualFetch(input, init);
            if (creatingAccount && response.ok) {
              accountCreated = true;
            }
            return response;
          });
        const failure = await fixture.complete();
        fetchSpy.mockRestore();
        expect({
          status: failure.status,
          body: await failure.json(),
        }).toMatchObject({
          status: 500,
          body: {
            code:
              stage === "account_creation"
                ? "account_creation_failed"
                : stage === "verification"
                  ? "account_link_verification_failed"
                  : "account_link_failed",
          },
        });
        const pending = await fixture.readStudent();
        expect(pending).toMatchObject({
          status: "TRIAL",
          first_name: "Registered",
          registration_public_token: fixture.token,
        });
        if (stage === "account_creation") {
          expect(pending?.user_id).toBeNull();
          const { data, error } = await fixture.admin.auth.admin.listUsers({
            perPage: 1000,
          });
          expect(error).toBeNull();
          expect(
            data.users.filter((user) => user.email === fixture.email),
          ).toHaveLength(0);
        } else {
          expect(pending?.user_id).toEqual(expect.any(String));
        }
        const retry = await fixture.complete();
        expect({
          status: retry.status,
          body: await retry.json(),
        }).toMatchObject({
          status: 200,
          body: { success: true },
        });
        expect(await fixture.readStudent()).toMatchObject({
          status: "ACTIVE",
          user_id: pending?.user_id ?? expect.any(String),
        });
        const { data: parents, error } = await fixture.admin
          .from("parents_students")
          .select("parent_id")
          .eq("student_id", fixture.intendedId);
        expect(error).toBeNull();
        expect(parents).toHaveLength(1);
      },
    );

    it("does not let caller-editable metadata select a Student", async () => {
      const fixture = await registrationFixture();
      const { data, error } = await fixture.admin.auth.admin.createUser({
        email: fixture.email,
        password,
        email_confirm: true,
        user_metadata: { registration_student_id: fixture.intendedId },
      });
      expect(error).toBeNull();
      expect(data.user?.app_metadata.registration_student_id).toBeUndefined();
      const caller = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: { persistSession: false, autoRefreshToken: false },
        },
      );
      const { data: session, error: loginError } =
        await caller.auth.signInWithPassword({
          email: fixture.email,
          password,
        });
      expect(loginError).toBeNull();
      // Attempt the forbidden app-metadata update at the actual public Auth API.
      const spoof = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`,
        {
          method: "PUT",
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${session.session!.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            app_metadata: { registration_student_id: fixture.intendedId },
          }),
        },
      );
      expect(spoof.status).toBe(403);
      const { data: unchanged, error: readError } =
        await fixture.admin.auth.admin.getUserById(data.user!.id);
      expect(readError).toBeNull();
      expect(
        unchanged.user?.app_metadata.registration_student_id,
      ).toBeUndefined();
      expect(await fixture.readStudent()).toMatchObject({
        user_id: null,
        status: "TRIAL",
      });
      expect(await fixture.readStudent(fixture.unrelatedId)).toMatchObject({
        user_id: null,
      });
    });

    it("rolls back Auth creation when the trusted selection cannot link, without email fallback", async () => {
      const fixture = await registrationFixture();
      const authId = randomUUID();
      const { data, error } = await fixture.admin.auth.admin.createUser({
        id: authId,
        email: fixture.email,
        password,
        email_confirm: true,
        user_metadata: { registration_student_id: fixture.intendedId },
        app_metadata: { registration_student_id: randomUUID() },
      });
      expect(error?.status).toBe(500);
      expect(data.user).toBeNull();
      expect(
        (await fixture.admin.auth.admin.getUserById(authId)).error?.status,
      ).toBe(404);
      expect(await fixture.readStudent()).toMatchObject({
        user_id: null,
        status: "TRIAL",
      });
      expect(await fixture.readStudent(fixture.unrelatedId)).toMatchObject({
        user_id: null,
      });
    });

    it("keeps invite-token selection working when Student emails are shared", async () => {
      const fixture = await registrationFixture();
      const inviteToken = randomUUID();
      const { error: inviteError } = await fixture.admin
        .from("students")
        .update({ invite_token: inviteToken })
        .eq("id", fixture.intendedId);
      expect(inviteError).toBeNull();
      const { data, error } = await fixture.admin.auth.admin.createUser({
        email: fixture.email,
        password,
        email_confirm: true,
        user_metadata: { invite_token: inviteToken },
      });
      expect(error).toBeNull();
      expect(await fixture.readStudent()).toMatchObject({
        user_id: data.user?.id,
      });
      expect(await fixture.readStudent(fixture.unrelatedId)).toMatchObject({
        user_id: null,
      });
    });

    it("retains email fallback for an ordinary unambiguous signup", async () => {
      const fixture = await registrationFixture(false);
      const { data, error } = await fixture.admin.auth.admin.createUser({
        email: fixture.email,
        password,
        email_confirm: true,
      });
      expect(error).toBeNull();
      expect(await fixture.readStudent()).toMatchObject({
        user_id: data.user?.id,
      });
      expect(await fixture.readStudent(fixture.unrelatedId)).toMatchObject({
        user_id: null,
      });
    });

    it("does not link matching staff during a Student registration", async () => {
      const fixture = await registrationFixture();
      const staffId = randomUUID();
      const { error: fixtureError } = await fixture.admin.from("staff").insert({
        id: staffId,
        first_name: "Unrelated",
        last_name: "Tutor",
        role: "TUTOR",
        status: "TRIAL",
        email: fixture.email,
      });
      expect(fixtureError).toBeNull();
      const response = await fixture.complete();
      expect(response.status).toBe(200);
      const { data, error } = await fixture.admin
        .from("staff")
        .select("user_id")
        .eq("id", staffId)
        .single();
      expect(error).toBeNull();
      expect(data?.user_id).toBeNull();
      expect(await fixture.readStudent()).toMatchObject({
        status: "ACTIVE",
        user_id: expect.any(String),
      });
    });

    it("rejects an existing login without transferring it to either shared-email Student", async () => {
      const fixture = await registrationFixture();
      const { data, error } = await fixture.admin.auth.admin.createUser({
        email: fixture.email,
        password,
        email_confirm: true,
        user_metadata: { registration_student_id: fixture.intendedId },
      });
      expect(error).toBeNull();
      const response = await fixture.complete();
      expect({
        status: response.status,
        body: await response.json(),
      }).toMatchObject({ status: 409, body: { code: "account_exists" } });
      expect(await fixture.readStudent()).toMatchObject({
        user_id: null,
        status: "TRIAL",
      });
      expect(await fixture.readStudent(fixture.unrelatedId)).toMatchObject({
        user_id: null,
      });
      expect(
        (await fixture.admin.auth.admin.getUserById(data.user!.id)).error,
      ).toBeNull();
    });
  },
);
