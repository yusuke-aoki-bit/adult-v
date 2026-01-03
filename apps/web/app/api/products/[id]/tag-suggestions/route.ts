import { getDb } from '@/lib/db';
import { userTagSuggestions, userTagVotes, products, tags } from '@adult-v/database';
import { eq, and, desc, sql } from 'drizzle-orm';
import { createUserTagSuggestionsGetHandler, createUserTagSuggestionsPostHandler } from '@adult-v/shared/api-handlers';

export const dynamic = 'force-dynamic';

const deps = {
  getDb,
  userTagSuggestions,
  userTagVotes,
  products,
  tags,
  eq,
  and,
  desc,
  sql,
};

export const GET = createUserTagSuggestionsGetHandler(deps);
export const POST = createUserTagSuggestionsPostHandler(deps);
