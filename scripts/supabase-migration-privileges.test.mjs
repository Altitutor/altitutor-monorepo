import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  findMissingRelationPrivilegeContracts,
} from "./supabase-migration-privileges.mjs";

test("flags a new public relation without an explicit privilege contract", () => {
  assert.deepEqual(
    findMissingRelationPrivilegeContracts(`
      CREATE TABLE public.example_events (
        id uuid PRIMARY KEY
      );
    `),
    ["example_events"],
  );
});

test("accepts explicit least-privilege grants and denials", () => {
  assert.deepEqual(
    findMissingRelationPrivilegeContracts(`
      CREATE TABLE public.private_events (id uuid PRIMARY KEY);
      REVOKE ALL ON public.private_events
        FROM PUBLIC, anon, authenticated, service_role;

      CREATE VIEW public.vstudent_events AS
        SELECT id FROM public.private_events;
      REVOKE ALL ON public.vstudent_events
        FROM PUBLIC, anon, authenticated, service_role;
      GRANT SELECT ON public.vstudent_events TO authenticated;

      CREATE SEQUENCE public.event_numbers;
      GRANT USAGE ON SEQUENCE public.event_numbers TO service_role;

      CREATE FUNCTION public.process_private_events()
      RETURNS void LANGUAGE sql AS 'SELECT NULL';
      REVOKE ALL ON FUNCTION public.process_private_events() FROM PUBLIC;
    `),
    [],
  );
});

test("flags a new function that inherits default API execution", () => {
  assert.deepEqual(
    findMissingRelationPrivilegeContracts(`
      CREATE FUNCTION public.refresh_private_state()
      RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
      BEGIN
        RETURN NEW;
      END
      $$;
    `),
    ["refresh_private_state"],
  );
});

test("allows an existing function to be replaced without changing its ACL", () => {
  assert.deepEqual(
    findMissingRelationPrivilegeContracts(
      `
        CREATE OR REPLACE FUNCTION public.refresh_private_state()
        RETURNS void LANGUAGE sql AS 'SELECT NULL';
      `,
      { knownObjects: new Set(["refresh_private_state"]) },
    ),
    [],
  );
});

test("requires a new contract when an existing object is dropped and recreated", () => {
  assert.deepEqual(
    findMissingRelationPrivilegeContracts(
      `
        DROP FUNCTION public.refresh_private_state();
        CREATE FUNCTION public.refresh_private_state()
        RETURNS void LANGUAGE sql AS 'SELECT NULL';
      `,
      { knownObjects: new Set(["refresh_private_state"]) },
    ),
    ["refresh_private_state"],
  );
});

test("requires a contract for each relation in a multi-object migration", () => {
  assert.deepEqual(
    findMissingRelationPrivilegeContracts(`
      CREATE TABLE public.first_table (id uuid PRIMARY KEY);
      CREATE MATERIALIZED VIEW public.second_view AS
        SELECT id FROM public.first_table;
      REVOKE ALL ON public.first_table FROM PUBLIC;
    `),
    ["second_view"],
  );
});

test("does not treat commented privilege SQL as a contract", () => {
  assert.deepEqual(
    findMissingRelationPrivilegeContracts(`
      CREATE TABLE public.unprotected_rows (id uuid PRIMARY KEY);
      -- GRANT SELECT ON public.unprotected_rows TO service_role;
      /* REVOKE ALL ON public.unprotected_rows FROM PUBLIC; */
    `),
    ["unprotected_rows"],
  );
});

test("the production release gate runs the migration privilege audit", async () => {
  const releaseGate = await readFile(
    new URL("./production-release-gate.test.mjs", import.meta.url),
    "utf8",
  );

  assert.match(releaseGate, /auditMigrationDirectory/u);
});
