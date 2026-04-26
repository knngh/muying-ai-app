import { paymentCallbackBody } from '../src/schemas/payment.schema';

describe('payment schemas', () => {
  it('coerces callback amount strings from payment gateways', () => {
    expect(paymentCallbackBody.parse({
      orderNo: 'SUB202604060001',
      amount: '19.9',
    })).toEqual({
      orderNo: 'SUB202604060001',
      amount: 19.9,
      paymentStatus: 'success',
    });
  });

  it('rejects invalid callback amounts', () => {
    expect(paymentCallbackBody.safeParse({
      orderNo: 'SUB202604060001',
      amount: '0',
    }).success).toBe(false);
    expect(paymentCallbackBody.safeParse({
      orderNo: 'SUB202604060001',
      amount: 'not-a-number',
    }).success).toBe(false);
  });
});
