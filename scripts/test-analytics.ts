import { getAnalyticsReport, checkGoogleApiConfig } from '@/lib/google-apis';

async function test() {
  console.log('=== Analytics API Debug Test ===');

  const config = checkGoogleApiConfig();
  console.log('API Config:', config);

  const propertyId = process.env.GA4_PROPERTY_ID || 'NOT SET';
  console.log('GA4 Property ID:', propertyId);
  console.log('Service Account Key exists:', !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

  // Try to get analytics report
  try {
    const report = await getAnalyticsReport(
      propertyId,
      ['pagePath'],
      ['screenPageViews'],
      '2024-01-01',
      '2024-12-31'
    );

    if (report) {
      console.log('SUCCESS! Report rows:', report.rows.length);
      console.log('Sample data:', report.rows.slice(0, 3));
    } else {
      console.log('FAILED: Report returned null');
    }
  } catch (error) {
    console.error('ERROR:', error);
  }
}

test();
