#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

// Migrations after this incident must state the privilege contract for every
// new PostgREST-visible relation. The cutoff records the audited baseline.
export const PRIVILEGE_CONTRACT_BASELINE = 20260902130208;

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/--[^\n]*/gu, "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function createdPublicObjects(sql) {
  const objectPattern =
    /\bCREATE\s+(OR\s+REPLACE\s+)?(?:(?:UNLOGGED|TEMP|TEMPORARY)\s+)?(?:TABLE|VIEW|MATERIALIZED\s+VIEW|SEQUENCE|FUNCTION|PROCEDURE)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?public"?\.)?"?([a-zA-Z_][a-zA-Z0-9_$]*)"?/giu;

  return [...sql.matchAll(objectPattern)].map((match) => ({
    name: match[2],
    replaces: match[1] != null,
  }));
}

function droppedPublicObjects(sql) {
  const objectPattern =
    /\bDROP\s+(?:TABLE|VIEW|MATERIALIZED\s+VIEW|SEQUENCE|FUNCTION|PROCEDURE)\s+(?:IF\s+EXISTS\s+)?(?:"?public"?\.)?"?([a-zA-Z_][a-zA-Z0-9_$]*)"?/giu;
  return new Set([...sql.matchAll(objectPattern)].map((match) => match[1]));
}

export function findMissingRelationPrivilegeContracts(
  sql,
  { knownObjects = new Set() } = {},
) {
  const uncommented = stripSqlComments(sql);
  const droppedObjects = droppedPublicObjects(uncommented);
  const relations = new Set(
    createdPublicObjects(uncommented)
      .filter(
        ({ name, replaces }) =>
          !replaces || !knownObjects.has(name) || droppedObjects.has(name),
      )
      .map(({ name }) => name),
  );
  const privilegeStatements = uncommented
    .split(";")
    .filter((statement) => /\b(?:GRANT|REVOKE)\b/iu.test(statement));

  return [...relations]
    .filter((relation) => {
      const relationReference = new RegExp(
        `(?:\\bpublic\\s*\\.\\s*)?\\b${escapeRegExp(relation)}\\b`,
        "iu",
      );
      return !privilegeStatements.some((statement) =>
        relationReference.test(statement),
      );
    })
    .sort();
}

export async function auditMigrationDirectory(directoryUrl) {
  const entries = (await readdir(directoryUrl))
    .filter((name) => /^\d+.*\.sql$/u.test(name))
    .sort();
  const violations = [];
  const knownObjects = new Set();

  for (const filename of entries) {
    const version = Number.parseInt(filename.match(/^\d+/u)?.[0] ?? "", 10);
    if (!Number.isFinite(version)) {
      continue;
    }

    const sql = await readFile(new URL(filename, directoryUrl), "utf8");
    const uncommented = stripSqlComments(sql);
    if (version > PRIVILEGE_CONTRACT_BASELINE) {
      for (const relation of findMissingRelationPrivilegeContracts(sql, {
        knownObjects,
      })) {
        violations.push({ filename, relation });
      }
    }

    for (const droppedObject of droppedPublicObjects(uncommented)) {
      knownObjects.delete(droppedObject);
    }
    for (const { name } of createdPublicObjects(uncommented)) {
      knownObjects.add(name);
    }
  }

  return violations;
}

async function main() {
  const migrationsUrl = new URL("../supabase/migrations/", import.meta.url);
  const violations = await auditMigrationDirectory(migrationsUrl);

  if (violations.length > 0) {
    console.error(
      "New public objects must have an explicit GRANT or REVOKE privilege contract in the migration that creates them:",
    );
    for (const { filename, relation } of violations) {
      console.error(`- ${filename}: public.${relation}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Supabase migration privilege contracts passed.");
}

if (process.argv[1] && pathToFileURL(fileURLToPath(import.meta.url)).href === pathToFileURL(process.argv[1]).href) {
  await main();
}
