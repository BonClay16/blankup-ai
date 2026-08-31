const crypto = require('crypto');

const VNP_VERSION = '2.1.0';

function buildPaymentUrl(params) {
  const {
    amount,
    orderInfo,
    orderRef,
    locale = 'vn',
    ipAddr,
    // Env fallbacks kept for test compatibility — caller must validate. NEVER fallback to '' in production path.
    tmnCode = process.env.VNP_TMN_CODE,
    hashSecret = process.env.VNP_HASH_SECRET,
    vnpUrl = process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    returnUrl = process.env.VNP_RETURN_URL || 'http://localhost:3000/api/payment/vnpay-return',
  } = params;

  // Fail-closed: VNPay URL generation requires both secret and tmnCode.
  if (!hashSecret || !tmnCode) {
    const err = new Error(!hashSecret ? 'VNPay hash secret not configured' : 'VNPay merchant code not configured');
    err.code = 'VNPAY_NOT_CONFIGURED';
    throw err;
  }

  const date = new Date();
  const createDate = date.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const expiryDate = new Date(date.getTime() + 15 * 60 * 1000)
    .toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

  const vnpParams = {
    vnp_Version: VNP_VERSION,
    vnp_Command: 'pay',
    vnp_TmnCode: tmnCode,
    vnp_Amount: Math.round(amount) * 100,
    vnp_CreateDate: createDate,
    vnp_CurrCode: 'VND',
    vnp_IpAddr: ipAddr || '127.0.0.1',
    vnp_Locale: locale === 'en' ? 'en' : 'vn',
    vnp_OrderInfo: orderInfo || `Thanh toan don hang ${orderRef}`,
    vnp_OrderType: 'other',
    vnp_ReturnUrl: returnUrl,
    vnp_ExpireDate: expiryDate,
    vnp_TxnRef: orderRef,
  };

  const sortedKeys = Object.keys(vnpParams).sort();
  const signData = sortedKeys.map(k => `${k}=${encodeURIComponent(String(vnpParams[k]))}`).join('&');
  const secureHash = crypto.createHmac('sha512', hashSecret).update(signData).digest('hex');

  vnpParams.vnp_SecureHash = secureHash;
  const queryStr = Object.entries(vnpParams)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');

  return { paymentUrl: `${vnpUrl}?${queryStr}`, secureHash, vnpParams };
}

function verifyIpn(params) {
  const hashSecret = process.env.VNP_HASH_SECRET;
  // Fail-closed: if secret is missing, NOTHING is valid. Never accept callbacks without a secret.
  if (!hashSecret) {
    return { isValid: false, code: '99', reason: 'VNPay secret not configured' };
  }
  const secureHash = params.vnp_SecureHash;
  if (!secureHash) return { isValid: false, code: '01' };

  const filteredKeys = Object.keys(params)
    .filter(k => k.startsWith('vnp_') && k !== 'vnp_SecureHash')
    .sort();

  const signData = filteredKeys.map(k => `${k}=${encodeURIComponent(String(params[k]).replace(/\+/g, ' '))}`).join('&');
  const computedHash = crypto.createHmac('sha512', hashSecret).update(signData).digest('hex');

  return {
    isValid: computedHash === secureHash,
    code: computedHash === secureHash ? '00' : '97',
    transactionId: params.vnp_TransactionNo || '',
    orderRef: params.vnp_TxnRef || '',
    amount: parseInt(params.vnp_Amount || '0') / 100,
    responseCode: params.vnp_ResponseCode || '',
    bankCode: params.vnp_BankCode || '',
    payDate: params.vnp_PayDate || '',
  };
}

module.exports = { buildPaymentUrl, verifyIpn };
