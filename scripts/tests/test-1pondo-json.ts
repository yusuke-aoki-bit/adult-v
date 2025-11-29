// Test fetching 一本道 JSON API directly
async function main() {
  const productId = '112524_001';
  const jsonUrl = `https://www.1pondo.tv/dyn/phpauto/movie_details/movie_id/${productId}.json`;

  console.log('Fetching:', jsonUrl);

  const response = await fetch(jsonUrl);
  if (response.ok) {
    const data = await response.json();
    console.log('\nJSON API Response:');
    console.log('Title:', data.Title);
    console.log('Actors:', data.ActressesJa);
    console.log('Thumbnail:', data.ThumbHigh);
    console.log('Sample Files:', data.SampleFiles?.length || 0, 'files');

    if (data.SampleFiles && data.SampleFiles.length > 0) {
      console.log('\nFirst 3 sample file URLs:');
      data.SampleFiles.slice(0, 3).forEach((file: any, i: number) => {
        console.log(`  [${i+1}] ${file.url}`);
      });
    }
  } else {
    console.log('Failed to fetch:', response.status);
  }

  process.exit(0);
}

main().catch(console.error);
