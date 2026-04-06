import { signPaymentCallbackPayload, type PaymentProvider } from '../src/services/payment-callback.service';

function usage() {
  console.log(`Usage:
  tsx scripts/generate-payment-callback-signature.ts \\
    --provider wechat \\
    --secret your-secret \\
    --order-no SUB202604060001 \\
    [--trade-no WX-123] \\
    [--amount 19.9] \\
    [--timestamp 1712390400000]
`);
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

const provider = getArg('--provider') as PaymentProvider | undefined;
const secret = getArg('--secret');
const orderNo = getArg('--order-no');
const tradeNo = getArg('--trade-no');
const amountRaw = getArg('--amount');
const timestamp = getArg('--timestamp') || String(Date.now());

if (!provider || !secret || !orderNo || !['wechat', 'alipay'].includes(provider)) {
  usage();
  process.exit(1);
}

const amount = amountRaw ? Number(amountRaw) : undefined;
if (amountRaw && !Number.isFinite(amount)) {
  console.error('Invalid --amount');
  process.exit(1);
}

const signature = signPaymentCallbackPayload(
  provider,
  timestamp,
  {
    orderNo,
    tradeNo,
    amount,
    paymentStatus: 'success',
  },
  secret,
);

console.log(
  JSON.stringify(
    {
      provider,
      timestamp,
      signature,
      headers: {
        'X-Payment-Timestamp': timestamp,
        'X-Payment-Signature': signature,
      },
    },
    null,
    2,
  ),
);
