import { Redis } from '@upstash/redis';

async function test() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.error('❌ Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
    process.exit(1);
  }

  console.log('📡 Connecting to Upstash Redis...');
  console.log('URL:', url);

  const redis = new Redis({ url, token });

  // テストデータを保存
  await redis.set('test-key', { hello: 'world', time: Date.now() }, { ex: 60 });
  console.log('✅ Set test-key');

  // データを取得
  const data = await redis.get('test-key');
  console.log('✅ Get test-key:', JSON.stringify(data));

  // 削除
  await redis.del('test-key');
  console.log('✅ Deleted test-key');

  console.log('🎉 Upstash Redis connection successful!');
}

test().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
