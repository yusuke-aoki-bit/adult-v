import { getDb } from '@/lib/db';
import { userPerformerSuggestions, userPerformerVotes, products, performers } from '@adult-v/database';
import { eq, and, or, desc, ilike, sql } from 'drizzle-orm';
import { createUserPerformerSuggestionsGetHandler, createUserPerformerSuggestionsPostHandler } from '@adult-v/shared/api-handlers';

export const dynamic = 'force-dynamic';

const deps = {
  getDb,
  userPerformerSuggestions,
  userPerformerVotes,
  products,
  performers,
  eq,
  and,
  or,
  desc,
  ilike,
  sql,
};

export const GET = createUserPerformerSuggestionsGetHandler(deps);
export const POST = createUserPerformerSuggestionsPostHandler(deps);
