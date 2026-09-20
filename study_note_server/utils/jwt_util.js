const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const dotenv = require('dotenv');
const redisClient = require('../db/redis_config');

dotenv.config();

// JWT 配置（保持不变）
const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
  expiresIn: process.env.JWT_EXPIRES_IN || '7200s',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '86400s',
  expiresInSeconds: (() => {
    const match = process.env.JWT_EXPIRES_IN?.match(/^(\d+)([smhd])$/);
    if (!match) return 7200;
    const [, num, unit] = match;
    const numInt = parseInt(num);
    switch (unit) {
      case 's': return numInt;
      case 'm': return numInt * 60;
      case 'h': return numInt * 3600;
      case 'd': return numInt * 86400;
      default: return 7200;
    }
  })(),
  refreshExpiresInSeconds: (() => {
    const match = process.env.JWT_REFRESH_EXPIRES_IN?.match(/^(\d+)([smhd])$/);
    if (!match) return 86400;
    const [, num, unit] = match;
    const numInt = parseInt(num);
    switch (unit) {
      case 's': return numInt;
      case 'm': return numInt * 60;
      case 'h': return numInt * 3600;
      case 'd': return numInt * 86400;
      default: return 86400;
    }
  })()
};

class JwtUtil {
  /**
   * 生成访问令牌 + 刷新令牌
   * @param {Object} payload - JWT 载荷（用户信息）
   * @returns {Object} { accessToken, refreshToken, expiresIn }
   */
  generateTokens(payload) {
    try {
      // 修复：payload 中取 userId，而非直接用未定义的 userId
      const userId = payload.id;
      if (!userId) throw new Error('用户ID不能为空');

      // 1. 生成访问令牌
      const accessToken = jwt.sign(
        { ...payload, type: 'access' },
        JWT_CONFIG.secret,
        { expiresIn: JWT_CONFIG.expiresIn }
      );

      // 2. 生成刷新令牌
      const refreshToken = jwt.sign(
        { id: userId, type: 'refresh' },
        JWT_CONFIG.secret,
        { expiresIn: JWT_CONFIG.refreshExpiresIn }
      );

      console.log("访问令牌："+accessToken)
      console.log("刷新令牌"+refreshToken)

      // 3. 缓存访问令牌到 Redis
      this.cacheTokenToRedis(`user:${userId}`, accessToken, JWT_CONFIG.expiresInSeconds);
      // 4. 缓存刷新令牌到 Redis
      this.cacheTokenToRedis(`refresh:${userId}`, refreshToken, JWT_CONFIG.refreshExpiresInSeconds);

      return {
        accessToken,
        refreshToken,
        expiresIn: JWT_CONFIG.expiresInSeconds
      };
    } catch (err) {
      console.error('❌ 生成 JWT 失败：', err);
      throw new Error('生成令牌失败');
    }
  }

  /**
 * 只生成新的 accessToken（不生成 refreshToken）
 */
generateAccessToken(payload) {
  try {
    const userId = payload.id;
    if (!userId) throw new Error('用户ID不能为空');

    const accessToken = jwt.sign(
      { ...payload, type: 'access' },
      JWT_CONFIG.secret,
      { expiresIn: JWT_CONFIG.expiresIn }
    );

    // 只更新/缓存 accessToken
    this.cacheTokenToRedis(`user:${userId}`, accessToken, JWT_CONFIG.expiresInSeconds);

    return {
      accessToken,
      expiresIn: JWT_CONFIG.expiresInSeconds
    };
  } catch (err) {
    console.error('❌ 生成 accessToken 失败：', err);
    throw new Error('生成访问令牌失败');
  }
}

  /**
   * 将令牌缓存到 Redis
   * @param {string} redisKey - Redis 的 key
   * @param {string} token - JWT 令牌
   * @param {number} expireSeconds - 过期时间（秒）
   */
  async cacheTokenToRedis(redisKey, token, expireSeconds) {
    try {
      await redisClient.set(redisKey, token, expireSeconds);
      console.log(`✅ 令牌 ${redisKey} 已缓存到 Redis，过期时间：${expireSeconds}s`);
    } catch (err) {
      console.error(`❌ 缓存令牌 ${redisKey} 失败：`, err);
      throw new Error('缓存令牌失败');
    }
  }

  /**
   * 验证访问令牌
   * @param {string} token - JWT 令牌
   * @returns {string} 错误信息（验证通过返回 null）
   */
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_CONFIG.secret);

      let message = null;
      // 校验令牌类型
      if (decoded.type !== 'access') {
        message = '令牌类型错误，仅支持 access 类型';
        console.error(`❌ ${message}`);
      }

      // 校验 Redis 中令牌是否匹配
      const cachedToken = await redisClient.get(`user:${decoded.id}`);
      if (!cachedToken || cachedToken !== token) {
        message = `用户 ${decoded.id} 的令牌已失效`;
        console.error(`❌ ${message}`);
      }

      return message;
    } catch (err) {
      let message = '验证失败';
      if (err.name === 'TokenExpiredError') {
        message = 'JWT 已过期';
      } else if (err.name === 'JsonWebTokenError') {
        message = 'JWT 签名无效';
      }
      console.error(`❌ ${message}：`, err);
      return message;
    }
  }

  /**
   * 验证刷新令牌
   * @param {string} refreshToken - 刷新令牌
   * @param {string/number} userId - 用户ID（用于校验一致性）
   * @returns {Object} 解密后的载荷（失败返回 null）
   */
  async verifyRefreshToken(refreshToken, userId) {
    try {
      // 1. 验证刷新令牌合法性
      const decoded = jwt.verify(refreshToken, JWT_CONFIG.secret);

      // 2. 校验令牌类型
      if (decoded.type !== 'refresh') {
        console.error('❌ 令牌类型错误，仅支持 refresh 类型');
        return null;
      }

      // 3. 校验用户ID一致性
      if (parseInt(decoded.id) !== parseInt(userId)) {
        console.error(`❌ 刷新令牌用户ID(${decoded.id})与传入ID(${userId})不一致`);
        return null;
      }

      // 4. 校验 Redis 中刷新令牌是否匹配
      const cachedRefreshToken = await redisClient.get(`refresh:${userId}`);
      if (!cachedRefreshToken || cachedRefreshToken !== refreshToken) {
        console.error(`❌ 用户 ${userId} 的刷新令牌已失效`);
        return null;
      }

      return decoded;
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        console.error('❌ 刷新令牌已过期：', err);
      } else if (err.name === 'JsonWebTokenError') {
        console.error('❌ 刷新令牌签名无效：', err);
      } else {
        console.error('❌ 验证刷新令牌失败：', err);
      }
      return null;
    }
  }

  /**
   * 刷新访问令牌
   * @param {string} refreshToken - 刷新令牌
   * @param {string/number} userId - 用户ID
   * @returns {Object} 新令牌 { accessToken, refreshToken, expiresIn }（失败返回 null）
   */
  async refreshAccessToken(refreshToken, userId) {
  try {
    // 1. 验证 refreshToken 合法性
    const decoded = await this.verifyRefreshToken(refreshToken, userId);
    if (!decoded) return null;

    // 2. 只生成新的 accessToken（不生成新的 refreshToken）
    const newAccessToken = this.generateAccessToken({ id: userId });

    // 3. 返回新的 accessToken + 保留原来的 refreshToken
    return {
      accessToken: newAccessToken.accessToken,
      refreshToken: refreshToken,  // 直接用旧的，不重新生成
      expiresIn: newAccessToken.expiresIn
    };
  } catch (err) {
    console.error('❌ 刷新 accessToken 失败：', err);
    return null;
  }
}

  /**
   * 注销令牌（删除 access + refresh 令牌）
   * @param {string/number} userId - 用户ID
   * @returns {boolean} 操作结果
   */
  async logout(userId) {
    try {
      // 同时删除访问令牌和刷新令牌
      await redisClient.del(`user:${userId}`);
      await redisClient.del(`refresh:${userId}`);
      console.log(`✅ 用户 ${userId} 的所有令牌已删除`);
      return true;
    } catch (err) {
      console.error(`❌ 注销用户 ${userId} 令牌失败：`, err);
      return false;
    }
  }
}

module.exports = new JwtUtil();