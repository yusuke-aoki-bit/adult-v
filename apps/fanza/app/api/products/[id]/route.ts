import { getProductById } from '@/lib/db/queries';
import { createProductByIdHandler } from '@adult-v/shared/api-handlers';

export const dynamic = 'force-dynamic';

export const GET = createProductByIdHandler({ getProductById });
