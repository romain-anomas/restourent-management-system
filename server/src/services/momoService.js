/**
 * MTN Mobile Money (MoMo) Collections API integration.
 *
 * Docs: https://momodeveloper.mtn.com
 *
 * Flow implemented here:
 *  1. getAccessToken()  - exchanges API user/key for a short-lived bearer token (cached in memory)
 *  2. requestToPay()    - asks MTN to push a payment approval prompt to the customer's phone
 *  3. checkStatus()     - polls whether that request was approved/failed/still pending
 *
 * IMPORTANT SANDBOX LIMITATION: MTN's sandbox environment only accepts
 * EUR as a currency - it cannot process real RWF amounts. This is a
 * constraint of MTN's own test environment, not a bug here. Switching
 * MOMO_TARGET_ENVIRONMENT to "production" (with real production
 * credentials from MTN Rwanda) is required before real RWF payments work.
 */
require('dotenv').config();
const crypto = require('crypto');

const BASE_URL = process.env.MOMO_BASE_URL || 'https://sandbox.momodeveloper.mtn.com';
const SUBSCRIPTION_KEY = process.env.MOMO_SUBSCRIPTION_KEY;
const API_USER = process.env.MOMO_API_USER;
const API_KEY = process.env.MOMO_API_KEY;
const TARGET_ENVIRONMENT = process.env.MOMO_TARGET_ENVIRONMENT || 'sandbox';
const CURRENCY = process.env.MOMO_CURRENCY || 'EUR'; // sandbox only supports EUR

let cachedToken = null;
let cachedTokenExpiresAt = 0;

/** True once an admin has filled in real MTN credentials in .env. */
function isConfigured() {
  return Boolean(SUBSCRIPTION_KEY && API_USER && API_KEY);
}

/**
 * One-time provisioning: creates an API user + API key under your
 * subscription. Run this once (see server/scripts/momoSetup.js) after
 * you have a subscription key from the MTN developer portal - it prints
 * the values to paste into your .env as MOMO_API_USER / MOMO_API_KEY.
 */
async function provisionApiUser() {
  if (!SUBSCRIPTION_KEY) {
    throw new Error('MOMO_SUBSCRIPTION_KEY is not set. Get one from https://momodeveloper.mtn.com first.');
  }

  const referenceId = crypto.randomUUID();
  const callbackHost = process.env.MOMO_CALLBACK_HOST || 'example.com';

  const createUserRes = await fetch(`${BASE_URL}/v1_0/apiuser`, {
    method: 'POST',
    headers: {
      'X-Reference-Id': referenceId,
      'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ providerCallbackHost: callbackHost }),
  });

  if (!createUserRes.ok && createUserRes.status !== 201) {
    const text = await createUserRes.text();
    throw new Error(`Failed to create MoMo API user (${createUserRes.status}): ${text}`);
  }

  const createKeyRes = await fetch(`${BASE_URL}/v1_0/apiuser/${referenceId}/apikey`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY },
  });

  if (!createKeyRes.ok) {
    const text = await createKeyRes.text();
    throw new Error(`Failed to create MoMo API key (${createKeyRes.status}): ${text}`);
  }

  const { apiKey } = await createKeyRes.json();
  return { apiUser: referenceId, apiKey };
}

/** Fetches (and caches) a bearer token for the Collections API. */
async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt) {
    return cachedToken;
  }
  if (!isConfigured()) {
    throw new Error('MTN MoMo is not configured. Set MOMO_SUBSCRIPTION_KEY, MOMO_API_USER, MOMO_API_KEY in .env.');
  }

  const basicAuth = Buffer.from(`${API_USER}:${API_KEY}`).toString('base64');

  const res = await fetch(`${BASE_URL}/collection/token/`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MTN MoMo auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  // Refresh a little early (60s buffer) rather than waiting for exact expiry
  cachedTokenExpiresAt = Date.now() + (Number(data.expires_in) - 60) * 1000;
  return cachedToken;
}

/**
 * Normalizes a Rwandan phone number to MSISDN format MTN expects
 * (international format without the leading +), e.g. "0788123456" -> "250788123456".
 */
function toMsisdn(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('250')) return digits;
  if (digits.startsWith('0')) return `250${digits.slice(1)}`;
  return digits;
}

/**
 * Initiates a "Request to Pay" - MTN pushes an approval prompt to the
 * payer's phone. Returns the referenceId used to poll status later.
 * Note: `amount` is sent as-is in whatever MOMO_CURRENCY is configured
 * (EUR in sandbox) - see the module-level comment about this limitation.
 */
async function requestToPay({ amount, phone, externalId, payerMessage, payeeNote }) {
  const token = await getAccessToken();
  const referenceId = crypto.randomUUID();

  const res = await fetch(`${BASE_URL}/collection/v1_0/requesttopay`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Reference-Id': referenceId,
      'X-Target-Environment': TARGET_ENVIRONMENT,
      'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: String(Math.max(1, Math.round(amount))), // MTN expects a whole-number string
      currency: CURRENCY,
      externalId: String(externalId),
      payer: { partyIdType: 'MSISDN', partyId: toMsisdn(phone) },
      payerMessage: payerMessage?.slice(0, 160) || 'Order payment',
      payeeNote: payeeNote?.slice(0, 160) || 'Order payment',
    }),
  });

  if (res.status !== 202) {
    const text = await res.text();
    throw new Error(`MTN MoMo request-to-pay failed (${res.status}): ${text}`);
  }

  return { referenceId };
}

/**
 * Checks the status of a previously-initiated request-to-pay.
 * Returns one of: PENDING, SUCCESSFUL, FAILED.
 */
async function checkStatus(referenceId) {
  const token = await getAccessToken();

  const res = await fetch(`${BASE_URL}/collection/v1_0/requesttopay/${referenceId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Target-Environment': TARGET_ENVIRONMENT,
      'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MTN MoMo status check failed (${res.status}): ${text}`);
  }

  return res.json(); // { status, amount, currency, financialTransactionId, reason, ... }
}

/**
 * Checks whether a phone number is a registered, active MoMo account,
 * using MTN's account holder validation endpoint. Returns true/false,
 * or null if the check itself couldn't be completed (MTN down, not
 * configured, etc.) - callers should treat null as "unknown, proceed
 * anyway" rather than as a hard failure.
 */
async function validateAccountHolder(phone) {
  if (!isConfigured()) return null;

  try {
    const token = await getAccessToken();
    const msisdn = toMsisdn(phone);

    const res = await fetch(`${BASE_URL}/collection/v1_0/accountholder/msisdn/${msisdn}/active`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Target-Environment': TARGET_ENVIRONMENT,
        'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
      },
    });

    if (res.status === 200) return true;
    if (res.status === 404 || res.status === 400) return false;
    return null; // unexpected status - don't block checkout over it
  } catch (err) {
    console.error('MoMo account validation failed:', err.message);
    return null;
  }
}

module.exports = { isConfigured, provisionApiUser, requestToPay, checkStatus, validateAccountHolder, toMsisdn };
