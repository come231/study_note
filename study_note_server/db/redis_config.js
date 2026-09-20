const Redis = require('ioredis');
const dotenv = require('dotenv');

// 加载环境变量（如果使用 .env 文件）
dotenv.config();

class RedisConfig {
  // 单例实例
  static instance = null;
  // Redis 客户端实例
  client = null;

  // 构造函数：初始化配置
  constructor() {
    // 读取配置（优先环境变量，其次默认值）
    this.config = {
      host: process.env.REDIS_HOST || '127.0.0.1', // Redis 地址
      port: parseInt(process.env.REDIS_PORT) || 6379, // Redis 端口
      password: process.env.REDIS_PASSWORD || '', // Redis 密码（无则空）
      db: parseInt(process.env.REDIS_DB) || 0, // 数据库编号（默认 0）
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'note_app:', // key 前缀（避免冲突）
      // 连接池/超时配置
      connectTimeout: 5000, // 连接超时时间（ms）
      retryStrategy: (times) => {
        // 重连策略：失败后重试，最多 10 次，每次间隔递增
        if (times > 10) {
          console.error('Redis 重连次数达到上限，停止重连');
          return null; // 停止重连
        }
        return Math.min(times * 1000, 5000); // 每次重连间隔（1s, 2s... 最多 5s）
      }
    };

    // 初始化客户端
    this.initClient();
  }

  // 初始化 Redis 客户端
  initClient() {
    try {
      this.client = new Redis(this.config);

      // 监听连接成功事件
      this.client.on('connect', () => {
        console.log(`✅ Redis 连接成功：${this.config.host}:${this.config.port} (db: ${this.config.db})`);
      });

      // 监听连接错误事件
      this.client.on('error', (err) => {
        console.error(`❌ Redis 连接失败：${err.message}`);
      });

      // 监听断开连接事件
      this.client.on('close', () => {
        console.warn('⚠️ Redis 连接已断开');
      });

    } catch (err) {
      console.error('❌ Redis 客户端初始化失败：', err);
      throw err;
    }
  }

  // 获取单例实例（避免重复创建连接）
  static getInstance() {
    if (!RedisConfig.instance) {
      RedisConfig.instance = new RedisConfig();
    }
    return RedisConfig.instance;
  }

  // 获取 Redis 客户端（对外暴露）
  getClient() {
    if (!this.client) {
      this.initClient();
    }
    return this.client;
  }

  // 通用操作：设置值（带过期时间）
  async set(key, value, expire = 0) {
    try {
      // 支持对象/字符串值（自动序列化）
      const val = typeof value === 'object' ? JSON.stringify(value) : value;
      if (expire > 0) {
        // 带过期时间（单位：秒）
        await this.client.set(key, val, 'EX', expire);
      } else {
        // 永久存储
        await this.client.set(key, val);
      }
      return true;
    } catch (err) {
      console.error(`❌ Redis 设置值失败（key: ${key}）：`, err);
      return false;
    }
  }

  // 通用操作：获取值
  async get(key) {
    try {
      const value = await this.client.get(key);
      if (!value) return null;

      // 尝试反序列化（如果是 JSON 字符串）
      try {
        return JSON.parse(value);
      } catch (e) {
        // 非 JSON 直接返回原字符串
        return value;
      }
    } catch (err) {
      console.error(`❌ Redis 获取值失败（key: ${key}）：`, err);
      return null;
    }
  }

  // 通用操作：删除值
  async del(key) {
    try {
      await this.client.del(key);
      return true;
    } catch (err) {
      console.error(`❌ Redis 删除值失败（key: ${key}）：`, err);
      return false;
    }
  }

  // 关闭 Redis 连接（应用退出时调用）
  async close() {
    if (this.client) {
      await this.client.quit();
      console.log('✅ Redis 连接已关闭');
      RedisConfig.instance = null; // 重置单例
    }
  }
}

// 导出单例实例（直接使用）
module.exports = RedisConfig.getInstance();