// Temporary endpoint to test Sentry integration
// DELETE THIS FILE after verification

export async function GET() {
  throw new Error('Sentry Test Error (fanza) - This is a test error to verify Sentry integration');
}
