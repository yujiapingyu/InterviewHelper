import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// 支付宝配置
const ALIPAY_CONFIG = {
  appId: process.env.ALIPAY_APP_ID,
  privateKey: process.env.ALIPAY_PRIVATE_KEY,
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
  gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipaydev.com/gateway.do',
  notifyUrl: process.env.ALIPAY_NOTIFY_URL,
  returnUrl: process.env.ALIPAY_RETURN_URL
};

// 充值套餐配置
export const RECHARGE_PACKAGES = [
  { id: 'package_1', name: '基础套餐', credits: 100, price: 9.9, description: '100次AI调用' },
  { id: 'package_2', name: '标准套餐', credits: 300, price: 24.9, description: '300次AI调用，优惠17%' },
  { id: 'package_3', name: '专业套餐', credits: 500, price: 39.9, description: '500次AI调用，优惠20%' },
  { id: 'package_4', name: '企业套餐', credits: 1000, price: 69.9, description: '1000次AI调用，优惠30%' }
];

/**
 * 生成签名
 */
function sign(params) {
  // 排序并拼接参数
  const sortedKeys = Object.keys(params).sort();
  const signString = sortedKeys
    .map(key => `${key}=${params[key]}`)
    .join('&');

  // 使用私钥签名
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signString, 'utf8');
  return sign.sign(ALIPAY_CONFIG.privateKey, 'base64');
}

/**
 * 验证支付宝回调签名
 */
export function verifyAlipaySign(params, signature) {
  const { sign, sign_type, ...signParams } = params;
  
  // 排序并拼接参数
  const sortedKeys = Object.keys(signParams).sort();
  const signString = sortedKeys
    .map(key => `${key}=${signParams[key]}`)
    .join('&');

  // 验证签名
  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(signString, 'utf8');
  return verify.verify(ALIPAY_CONFIG.alipayPublicKey, signature, 'base64');
}

/**
 * 创建支付订单
 * @param {Object} order - 订单信息
 * @param {string} order.outTradeNo - 商户订单号
 * @param {number} order.totalAmount - 订单金额
 * @param {string} order.subject - 订单标题
 * @param {string} order.body - 订单描述
 * @returns {string} 支付表单HTML
 */
export function createAlipayOrder(order) {
  const { outTradeNo, totalAmount, subject, body } = order;

  // 构建请求参数
  const params = {
    app_id: ALIPAY_CONFIG.appId,
    method: 'alipay.trade.page.pay',
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    version: '1.0',
    notify_url: ALIPAY_CONFIG.notifyUrl,
    return_url: ALIPAY_CONFIG.returnUrl,
    biz_content: JSON.stringify({
      out_trade_no: outTradeNo,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      total_amount: totalAmount.toFixed(2),
      subject: subject,
      body: body
    })
  };

  // 生成签名
  params.sign = sign(params);

  // 构建支付URL
  const queryString = Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');

  return `${ALIPAY_CONFIG.gateway}?${queryString}`;
}

/**
 * 创建支付表单（用于前端提交）
 */
export function createAlipayForm(order) {
  const { outTradeNo, totalAmount, subject, body } = order;

  const params = {
    app_id: ALIPAY_CONFIG.appId,
    method: 'alipay.trade.page.pay',
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    version: '1.0',
    notify_url: ALIPAY_CONFIG.notifyUrl,
    return_url: ALIPAY_CONFIG.returnUrl,
    biz_content: JSON.stringify({
      out_trade_no: outTradeNo,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      total_amount: totalAmount.toFixed(2),
      subject: subject,
      body: body
    })
  };

  params.sign = sign(params);

  // 生成HTML表单
  let formHtml = `<form id="alipay_submit" action="${ALIPAY_CONFIG.gateway}" method="POST">`;
  Object.keys(params).forEach(key => {
    formHtml += `<input type="hidden" name="${key}" value="${params[key]}">`;
  });
  formHtml += `</form><script>document.getElementById('alipay_submit').submit();</script>`;

  return formHtml;
}

/**
 * 查询订单状态
 */
export async function queryAlipayOrder(outTradeNo) {
  const params = {
    app_id: ALIPAY_CONFIG.appId,
    method: 'alipay.trade.query',
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    version: '1.0',
    biz_content: JSON.stringify({
      out_trade_no: outTradeNo
    })
  };

  params.sign = sign(params);

  const queryString = Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');

  const response = await fetch(`${ALIPAY_CONFIG.gateway}?${queryString}`);
  return await response.json();
}
