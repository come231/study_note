// 引入 mysql2 库
const mysql = require('mysql2/promise');

// 数据库连接配置（根据你的实际情况修改）
const dbConfig = {
  host: 'localhost', // 数据库地址（本地填 localhost）
  user: 'root',      // 数据库用户名（默认 root）
  password: 'root',// 你的 MySQL 密码
  database: 'study_note',// 要连接的数据库名（需提前在 MySQL 中创建）
  waitForConnections: true,
  connectionLimit: 10, // 最大连接数
  queueLimit: 0,
  // 关键配置：指定时区为东八区
  timezone: '+08:00', 
  // 可选：强制返回字符串格式的时间（避免 Date 对象解析问题）
  dateStrings: true 
};

// 创建连接池
const pool = mysql.createPool(dbConfig);

// 测试连接
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('MySQL 数据库连接成功！');
    connection.release(); // 释放连接
  } catch (err) {
    console.error('MySQL 连接失败：', err.message);
    process.exit(1); // 连接失败则退出程序
  }
}

// 执行 SQL 语句的通用方法（封装后更易用）
async function query(sql, params = []) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (err) {
    console.error('SQL 执行失败：', err.message, 'SQL：', sql);
    throw err; // 抛出错误，让上层处理
  }
}

// 获取数据库连接的方法
async function getConnection() {
  return await pool.getConnection();
}

// 导出连接池和查询方法
module.exports = {
  pool,
  query,
  getConnection,
  testConnection
};