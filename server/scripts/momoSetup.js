/**
 * One-time MTN MoMo API user/key provisioning.
 *
 * Run this AFTER you've set MOMO_SUBSCRIPTION_KEY in server/.env (the
 * "Primary key" from your subscription at https://momodeveloper.mtn.com):
 *
 *   node scripts/momoSetup.js
 *
 * It creates a sandbox API user + API key under your subscription and
 * prints them. Copy the printed values into server/.env as
 * MOMO_API_USER and MOMO_API_KEY. You only need to run this once -
 * re-running it just creates a new (also valid) user/key pair.
 */
require('dotenv').config();
const momoService = require('../src/services/momoService');

(async () => {
  try {
    console.log('Provisioning MTN MoMo API user + key...');
    const { apiUser, apiKey } = await momoService.provisionApiUser();

    console.log('\n✅ Success! Add these two lines to server/.env:\n');
    console.log(`MOMO_API_USER=${apiUser}`);
    console.log(`MOMO_API_KEY=${apiKey}`);
    console.log('\nThen restart your backend server.');
  } catch (err) {
    console.error('\n❌ Failed to provision MoMo API user:', err.message);
    console.error('   Check that MOMO_SUBSCRIPTION_KEY is set correctly in server/.env');
    process.exit(1);
  }
})();
