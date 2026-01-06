import { getProductById, searchProductByProductId } from '@/lib/db/queries';
import { createProductByIdHandler } from '@adult-v/shared/api-handlers';

export const revalidate = 300; // 5分キャッシュ

export const GET = createProductByIdHandler({ getProductById, searchProductByProductId });
