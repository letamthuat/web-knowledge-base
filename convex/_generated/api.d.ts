/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as betterAuthFunctions from "../betterAuthFunctions.js";
import type * as crons from "../crons.js";
import type * as documents_actions from "../documents/actions.js";
import type * as documents_cronActions from "../documents/cronActions.js";
import type * as documents_mutations from "../documents/mutations.js";
import type * as documents_queries from "../documents/queries.js";
import type * as folders_mutations from "../folders/mutations.js";
import type * as folders_queries from "../folders/queries.js";
import type * as highlights_mutations from "../highlights/mutations.js";
import type * as highlights_queries from "../highlights/queries.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_telemetry from "../lib/telemetry.js";
import type * as note_tabs_mutations from "../note_tabs/mutations.js";
import type * as note_tabs_queries from "../note_tabs/queries.js";
import type * as notes_actions from "../notes/actions.js";
import type * as notes_mutations from "../notes/mutations.js";
import type * as notes_queries from "../notes/queries.js";
import type * as reading_history_mutations from "../reading_history/mutations.js";
import type * as reading_history_queries from "../reading_history/queries.js";
import type * as reading_progress_mutations from "../reading_progress/mutations.js";
import type * as reading_progress_queries from "../reading_progress/queries.js";
import type * as tabs_mutations from "../tabs/mutations.js";
import type * as tabs_queries from "../tabs/queries.js";
import type * as tags_mutations from "../tags/mutations.js";
import type * as tags_queries from "../tags/queries.js";
import type * as transcripts_actions from "../transcripts/actions.js";
import type * as transcripts_mutations from "../transcripts/mutations.js";
import type * as transcripts_queries from "../transcripts/queries.js";
import type * as users_actions from "../users/actions.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_queries from "../users/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  betterAuthFunctions: typeof betterAuthFunctions;
  crons: typeof crons;
  "documents/actions": typeof documents_actions;
  "documents/cronActions": typeof documents_cronActions;
  "documents/mutations": typeof documents_mutations;
  "documents/queries": typeof documents_queries;
  "folders/mutations": typeof folders_mutations;
  "folders/queries": typeof folders_queries;
  "highlights/mutations": typeof highlights_mutations;
  "highlights/queries": typeof highlights_queries;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/errors": typeof lib_errors;
  "lib/telemetry": typeof lib_telemetry;
  "note_tabs/mutations": typeof note_tabs_mutations;
  "note_tabs/queries": typeof note_tabs_queries;
  "notes/actions": typeof notes_actions;
  "notes/mutations": typeof notes_mutations;
  "notes/queries": typeof notes_queries;
  "reading_history/mutations": typeof reading_history_mutations;
  "reading_history/queries": typeof reading_history_queries;
  "reading_progress/mutations": typeof reading_progress_mutations;
  "reading_progress/queries": typeof reading_progress_queries;
  "tabs/mutations": typeof tabs_mutations;
  "tabs/queries": typeof tabs_queries;
  "tags/mutations": typeof tags_mutations;
  "tags/queries": typeof tags_queries;
  "transcripts/actions": typeof transcripts_actions;
  "transcripts/mutations": typeof transcripts_mutations;
  "transcripts/queries": typeof transcripts_queries;
  "users/actions": typeof users_actions;
  "users/mutations": typeof users_mutations;
  "users/queries": typeof users_queries;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
