import { db } from '../packages/database/src/client';
import { products, productPerformers, performers, productSources } from '../packages/database/src/schema';
import { eq, ilike, sql } from 'drizzle-orm';

async function checkProduct() {
  // 商品ID 993560 の情報を取得
  const product = await db.query.products.findFirst({
    where: eq(products.id, 993560),
  });

  console.log('=== Product Info ===');
  console.log('ID:', product?.id);
  console.log('Title:', product?.title);
  console.log('Provider:', product?.provider);
  console.log('Original Product ID:', product?.originalProductId);
  console.log('Actresses field:', product?.actresses);

  // 演者紐付けを確認
  const productPerformerLinks = await db.select()
    .from(productPerformers)
    .where(eq(productPerformers.productId, 993560));

  console.log('\n=== Product-Performer Links ===');
  console.log('Links count:', productPerformerLinks.length);

  for (const link of productPerformerLinks) {
    const performer = await db.query.performers.findFirst({
      where: eq(performers.id, link.performerId),
    });
    console.log(`- Performer ID ${link.performerId}: ${performer?.name || 'NOT FOUND'}`);
  }

  // 日向由奈を検索
  const hinataYuna = await db.query.performers.findFirst({
    where: eq(performers.name, '日向由奈'),
  });

  console.log('\n=== Performer: 日向由奈 ===');
  if (hinataYuna) {
    console.log('ID:', hinataYuna.id);
    console.log('Name:', hinataYuna.name);

    // この演者の商品数を確認
    const performerProducts = await db.select()
      .from(productPerformers)
      .where(eq(productPerformers.performerId, hinataYuna.id));
    console.log('Total products linked:', performerProducts.length);
  } else {
    console.log('Not found in performers table');
  }

  // Product Sources を確認
  const sources = await db.select()
    .from(productSources)
    .where(eq(productSources.productId, 993560));

  console.log('\n=== Product Sources ===');
  for (const source of sources) {
    console.log(`- ASP: ${source.aspName}, Actresses: ${source.actresses}`);
  }

  process.exit(0);
}

checkProduct();
