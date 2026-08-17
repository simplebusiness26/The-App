#!/usr/bin/env node

import { createHmac } from "node:crypto";
import { pathToFileURL } from "node:url";

export async function sendGhostWriterEvent(activity, options = {}) {
  const endpoint = clean(options.endpoint ?? process.env.GHOSTWRITER_ENDPOINT);
  const projectId = clean(options.projectId ?? process.env.GHOSTWRITER_PROJECT_ID);
  const secret = clean(options.secret ?? process.env.GHOSTWRITER_INGEST_SECRET);
  const projectOrigin = normalizeProjectOrigin(options.projectOrigin ?? process.env.GHOSTWRITER_PROJECT_ORIGIN);

  if (!endpoint) throw new Error("GHOSTWRITER_ENDPOINT is required");
  if (!projectId) throw new Error("GHOSTWRITER_PROJECT_ID is required");
  if (!secret) throw new Error("GHOSTWRITER_INGEST_SECRET is required");
  if (!activity || typeof activity !== "object" || Array.isArray(activity)) throw new Error("Bridge activity must be a JSON object");
  if (!clean(activity.type)) throw new Error("Bridge activity requires a type");

  const contentEligible = activity.contentEligible ?? defaultContentEligibility(activity.type);
  const payload = {
    ...(activity.payload && typeof activity.payload === "object" && !Array.isArray(activity.payload) ? activity.payload : {})
  };
  if (projectOrigin && payload.projectOrigin === undefined) payload.projectOrigin = projectOrigin;

  const event = {
    ...activity,
    projectId,
    source: clean(activity.source) || "project-bridge",
    occurredAt: activity.occurredAt ?? new Date().toISOString(),
    privacy: activity.privacy ?? (contentEligible ? "content_eligible" : "internal"),
    contentEligible,
    payload
  };

  const raw = JSON.stringify(event);
  const signature = createHmac("sha256", secret).update(raw).digest("hex");
  const response = await fetch(`${endpoint.replace(/\/$/, "")}/v1/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GhostWriter-Signature": `sha256=${signature}`
    },
    body: raw
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`Ghost Writer rejected bridge event (${response.status}): ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

function defaultContentEligibility(type) {
  const value = String(type);
  return [
    "project.started",
    "git.commit",
    "git.merge",
    "test.passed",
    "build.completed",
    "deployment.completed",
    "milestone.completed",
    "decision.made"
  ].includes(value);
}

function normalizeProjectOrigin(value) {
  const normalized = clean(value).toLowerCase();
  if (!normalized) return "";
  if (normalized === "new" || normalized === "existing") return normalized;
  throw new Error("GHOSTWRITER_PROJECT_ORIGIN must be either 'new' or 'existing'");
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8").trim();
}

async function main() {
  const inline = process.argv.slice(2).join(" ").trim();
  const raw = inline || await readStdin();
  if (!raw) throw new Error("Pass one JSON activity object as an argument or on stdin");
  const parsed = JSON.parse(raw);
  const result = await sendGhostWriterEvent(parsed);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
