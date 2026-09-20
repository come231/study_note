const express = require('express');
const cors = require('cors');
const { testConnection } = require('./db/db_config');

// 导入路由模块
const userRoutes = require('./routes/user');
const categoryRoutes = require('./routes/category');
const noteRoutes = require('./routes/note');
const collectRoutes = require('./routes/collect');

const app = express();
const PORT = 3000;

// 全局中间件
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '1mb', strict: true }));
app.use(express.urlencoded({ extended: true }));

// 测试数据库连接
testConnection();

// 根路由
app.get('/', (req, res) => {
  res.send('Node.js + MySQL 服务器已就绪，可接收小程序请求！http://localhost:3000');
});

// 挂载各模块路由
app.use('/api/user', userRoutes);
app.use('/api/category', categoryRoutes);
app.use('/api/note', noteRoutes);
app.use('/api/collect', collectRoutes);

// 启动服务器
app.listen(PORT, () => {
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  let localIp = 'localhost';
  for (const devName in networkInterfaces) {
    const iface = networkInterfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        localIp = alias.address;
        break;
      }
    }
  }
  console.log(`✅ 服务器启动成功！`);
  console.log(`🔗 本机访问：http://localhost:${PORT}`);
  console.log(`🔗 局域网访问：http://${localIp}:${PORT}`);
});