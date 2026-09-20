/**
 * 小程序后端通用响应封装工具类
 * 功能：统一接口返回格式、简化成功/失败响应、支持自定义状态码和提示语
 */

// 通用成功响应
/**
 * @param {Object} res - Express的response对象
 * @param {any} data - 要返回的数据（可选，默认null）
 * @param {string} msg - 提示语（可选，默认"操作成功"）
 * @param {number} code - 业务状态码（可选，默认200）
 */
const success = (res, data = null, msg = '操作成功', code = 200) => {
  return res.status(200).json({
    code,        // 业务状态码（200=成功，小程序端易判断）
    msg,         // 用户友好提示语
    data,        // 业务数据（null/数组/对象）
    timestamp: Date.now() // 时间戳（便于前端排查问题）
  });
};

// 通用失败响应
/**
 * @param {Object} res - Express的response对象
 * @param {string} msg - 错误提示语（可选，默认"操作失败"）
 * @param {number} code - 业务状态码（可选，默认500）
 * @param {any} data - 附加数据（可选，默认null）
 * @param {number} httpStatus - HTTP状态码（可选，默认500）
 */
const fail = (res, msg = '操作失败', code = 500, data = null, httpStatus = 500) => {
  return res.status(httpStatus).json({
    code,        // 业务错误码（400=参数错误，404=数据不存在，500=服务器错误等）
    msg,         // 错误提示语
    data,        // 附加数据（如错误详情）
    timestamp: Date.now()
  });
};

// 专用响应方法（适配你的业务场景）
// 1. 参数错误响应
const paramError = (res, msg = '参数不能为空或格式错误') => {
  return fail(res, msg, 400, null, 400);
};

// 2. 数据不存在响应
const notFound = (res, msg = '请求的数据不存在') => {
  return fail(res, msg, 404, null, 200); // HTTP状态码用200，业务码用404（小程序更友好）
};

// 3. 数据重复响应
const duplicate = (res, msg = '数据已存在，请勿重复操作') => {
  return fail(res, msg, 409, null, 400);
};

// 导出所有方法
module.exports = {
  success,
  fail,
  paramError,
  notFound,
  duplicate
};