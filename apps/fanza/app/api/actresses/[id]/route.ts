import { getActressById } from '@/lib/db/queries';
import { createActressByIdHandler } from '@adult-v/shared/api-handlers';

export const dynamic = 'force-dynamic';

export const GET = createActressByIdHandler({ getActressById });
