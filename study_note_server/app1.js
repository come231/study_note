const express = require('express');
const cors = require('cors');
const { pool, testConnection,getConnection, query } = require('./db');

const JwtUtil = require('./jwt_util');
// 引入响应工具类（补充duplicate方法，避免报错）
const { success, paramError, notFound, fail, duplicate } = require('./result');

const app = express();
const PORT = 3000;

// 允许所有跨域请求（适配小程序）
app.use(cors({
  origin: '*', // 生产环境建议指定小程序域名
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

// 解析 POST JSON 数据
app.use(express.json({
  limit: '1mb',
  strict: true
}));

// 解析 URL 编码数据
app.use(express.urlencoded({ extended: true }));

// 测试数据库连接
testConnection();

// 根路由
app.get('/', (req, res) => {
  res.send('Node.js + MySQL 服务器已就绪，可接收小程序请求！http://localhost:3000');
});

// -------------------------- 用户模块/api/user --------------------------
/**
 * 用户注册接口
 * POST /api/user/register
 * body: {username, password, nickname}
 */
app.post('/api/user/register', async (req, res) => {
  try {
    const { username, password, nickname } = req.body;

    // 参数校验
    if (!username) return paramError(res, '用户名不能为空');
    if (!password) return paramError(res, '密码不能为空');
    if (!nickname) return paramError(res, '昵称不能为空');

    // 插入用户数据
    const result = await query(
      'INSERT INTO `user` (username, password, nickname, avatar, create_time) VALUES (?, ?, ?, ?, NOW())',
      [username, password, nickname, 'https://example.com/default-avatar.jpg']
    );

    return success(res, { user_id: result.insertId, username, nickname }, '注册成功！');
  } catch (err) {
    return fail(res, '注册失败：' + err.message);
  }
});
/**
 * 检查用户名唯一性校验接口
 * get /api/user/check-username
 * body: {username}
 */
// 1. 新增：用户名唯一性校验接口
app.get('/api/user/check-username', async (req, res) => {
  try {
    const { username } = req.query;
    
    // 参数校验
    if (!username) return paramError(res, '用户名不能为空');
    
    // 查询用户名是否存在
    const countResult = await query('SELECT COUNT(*) AS total FROM `user` WHERE username = ?', [username]);
    const count = countResult?.[0]?.total ?? 0;

    // 返回校验结果
    return success(
      res, 
      { isAvailable: count === 0 }, 
      count === 0 ? '用户名可用' : '用户名已存在'
    );
  } catch (err) {
    return fail(res, '校验用户名失败：' + err.message);
  }
});

/**
 * 检查昵称唯一性校验接口
 * get /api/user/check-nickname
 * body: {nickname}
 */
app.get('/api/user/check-nickname', async (req, res) => {
  try {
    const { nickname } = req.query;
    if (!nickname) return paramError(res, '昵称不能为空');

    const countResult = await query('SELECT COUNT(*) AS total FROM `user` WHERE nickname = ?', [nickname]);
    const count = countResult?.[0]?.total ?? 0;

    return success(res, { isAvailable: count === 0 }, count === 0 ? '昵称可用' : '昵称已存在');
  } catch (err) {
    return fail(res, '校验昵称失败：' + err.message);
  }
});

/**
 * 用户登录接口
 * POST /api/user/login
 * body: {username, password}
 */
app.post('/api/user/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 参数校验
    if (!username) return paramError(res, '用户名不能为空');
    if (!password) return paramError(res, '密码不能为空');

    // 查询用户信息
    const userResult = await query(
      'SELECT id, username, nickname, avatar FROM `user` WHERE username = ? AND password = ?',
      [username, password]
    );
   
    
    if (userResult.length === 0) return notFound(res, '用户名或密码错误');
 
    const userInfo = {
      id: userResult[0].id
    };

    // 3. 生成 JWT 并缓存到 Redis
    const tokens = JwtUtil.generateTokens(userInfo);
    const user = [userResult[0],tokens]

    return success(res, user, '登录成功！');
  } catch (err) {
    return fail(res, '登录失败：' + err.message);
  }
});

/**
 * 验证前端传递的token接口
 * GET /api/user/check-token
 * body: {token}
 */
app.get('/api/user/check-token', async (req, res) => {
  try {
    const {token} = req.query;


    // 验证redis中的用户token
    const result= await JwtUtil.verifyToken(token)
    if(result!==null) return fail(res,result)
    return success(res,result, "token验证成功");
  } catch (err) {
    return fail(res, '验证失败：' + err.message);
  }
});


/**
 * 用户退出登录接口
 * GET /api/user/logout
 * 
 */
app.get('/api/user/logout', async (req, res) => {
  try {
    const { userId } = req.query;

    // 参数校验
    if (!userId) return paramError(res, '用户Id不能为空');

    // 注销redis中的用户token
    const flag=await JwtUtil.logout(userId);
     if(!flag) return fail(res,'退出登录失败');

    return success(res, "", '退出成功！');
  } catch (err) {
    return fail(res, '登录失败：' + err.message);
  }
});

/**
 * 用户token刷新接口
 * GET /api/user/refresh
 * query: { userId, refreshToken }
 */
app.get('/api/user/refresh', async (req, res) => {
  try {
    const { userId, refreshToken } = req.query;

    // 1. 参数强校验
    if (!userId) return paramError(res, '用户Id不能为空');
    if (!refreshToken) return paramError(res, '刷新令牌不能为空');

    // 2. 调用工具类刷新令牌
    const newTokens = await JwtUtil.refreshAccessToken(refreshToken, userId);
    
    // 3. 结果判断
    if (!newTokens) {
      return fail(res, '刷新令牌无效或已过期');
    }

    // 4. 返回新令牌
    return success(res, newTokens, '令牌刷新成功！');
  } catch (err) {
    console.error('刷新令牌接口异常：', err);
    return fail(res, '刷新失败：' + err.message);
  }
});



/**
 * 获取用户信息接口
 * GET /api/user/profile
 * query: {user_id,username}
 */
app.get('/api/user/profile', async (req, res) => {
  try {
    const { user_id,username } = req.query;

    if (!user_id && username){
      // 如果只传递了一个username参数则返回用户头像
        const userResult = await query(
        'SELECT avatar FROM `user` WHERE username = ?',
        [username])

        if (userResult.length === 0) return notFound(res, '用户不存在');

        return success(res, userResult[0], '获取用户头像成功');
    }

    const userResult = await query(
      'SELECT id,username,nickname, avatar, phone, create_time update_time FROM `user` WHERE id = ?',
      [user_id]
    );
    

    if (userResult.length === 0) return notFound(res, '用户不存在');

    return success(res, userResult[0], '获取用户信息成功');
  } catch (err) {
    return fail(res, '获取用户信息失败：' + err.message);
  }
});

/**
 * 用户信息修改接口
 * POST /api/user/update
 * body: {user_id, username, nickname, phone, avatar}
 * 说明：至少传一个要修改的字段（username/nickname/phone/avatar），user_id为必传
 */
app.post('/api/user/update', async (req, res) => {
  try {
    const { user_id, username, nickname, phone, avatar } = req.body;

    // 1. 必传参数校验
    if (!user_id) return paramError(res, '用户ID不能为空');
    
    // 2. 校验至少传一个要修改的字段
    if (username === undefined && nickname === undefined && phone === undefined && avatar === undefined) {
      return paramError(res, '至少需要传入用户名、昵称、手机号、头像中的一个字段');
    }

    // 3. 校验用户名唯一性（如果传了用户名）
    if (username) {
      // 查询是否有其他用户使用该用户名
      const usernameResult = await query(
        'SELECT COUNT(*) AS total FROM `user` WHERE username = ? AND id != ?',
        [username, user_id]
      );
      const usernameCount = usernameResult?.[0]?.total ?? 0;
      if (usernameCount > 0) return duplicate(res, '用户名已被占用，请更换');
    }

    // 4. 校验手机号唯一性（如果传了手机号且不为空）
    if (phone) {
      // 查询是否有其他用户使用该手机号
      const phoneResult = await query(
        'SELECT COUNT(*) AS total FROM `user` WHERE phone = ? AND id != ?',
        [phone, user_id]
      );
      const phoneCount = phoneResult?.[0]?.total ?? 0;
      if (phoneCount > 0) return duplicate(res, '手机号已被绑定，请更换');
    }

    // 5. 构建更新SQL和参数（动态拼接，只更新传了的字段）
    let updateFields = [];
    let updateParams = [];
    
    if (username !== undefined) {
      updateFields.push('username = ?');
      updateParams.push(username);
    }
    if (nickname !== undefined) {
      updateFields.push('nickname = ?');
      updateParams.push(nickname);
    }
    // 手机号支持传空（清空手机号），但空值不校验唯一性
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateParams.push(phone || null);
    }
    if (avatar !== undefined) {
      updateFields.push('avatar = ?');
      updateParams.push(avatar);
    }
    // 强制更新修改时间（依赖数据库的ON UPDATE也可以，这里显式更新更清晰）
    updateFields.push('update_time = NOW()');

    // 6. 执行更新操作
    const result = await query(
      `UPDATE \`user\` SET ${updateFields.join(', ')} WHERE id = ?`,
      [...updateParams, user_id]
    );

    // 7. 校验是否更新成功（无字段变更或用户不存在）
    if (result.affectedRows === 0) return fail(res, '修改失败：用户不存在或无字段变更');

    // 8. 查询修改后的用户信息（返回最新数据）
    const updatedUser = await query(
      'SELECT id, username, nickname, phone, avatar, update_time FROM `user` WHERE id = ?',
      [user_id]
    );

    // 9. 返回成功响应（包含修改时间）
    return success(res, {
      user_id: updatedUser[0].id,
      username: updatedUser[0].username,
      nickname: updatedUser[0].nickname,
      phone: updatedUser[0].phone || '未绑定',
      avatar: updatedUser[0].avatar,
      update_time: updatedUser[0].update_time // 资料修改时间
    }, '用户信息修改成功！');

  } catch (err) {
    return fail(res, '修改用户信息失败：' + err.message);
  }
});

/**
 * 修改密码接口
 * POST /api/user/change-pwd
 * body: {user_id, old_pwd, new_pwd}
 * 说明：user_id、old_pwd、new_pwd均为必传字段
 */
app.post('/api/user/change-pwd', async (req, res) => {
  try {
    const { user_id, old_pwd, new_pwd } = req.body;

    // 1. 必传参数校验
    if (!user_id) return paramError(res, '用户ID不能为空');
    if (!old_pwd) return paramError(res, '原密码不能为空');
    if (!new_pwd) return paramError(res, '新密码不能为空');

    // 2. 新密码格式校验
    if (new_pwd.length < 6 || new_pwd.length > 20) {
      return paramError(res, '新密码长度必须在6-20位之间');
    }

    // 3. 查询用户原密码（验证用户存在性）
    const userResult = await query(
      'SELECT id, password FROM `user` WHERE id = ?',
      [user_id]
    );
    const user = userResult?.[0];
    
    // 3.1 校验用户是否存在
    if (!user) return fail(res, '用户不存在');

    // 3.2 校验原密码是否正确
    if (user.password !== old_pwd) {
      return fail(res, '原密码输入错误');
    }

    // 3.3 校验新密码是否和原密码一致
    if (new_pwd === user.password) {
      return fail(res, '新密码不能和原密码相同');
    }

    // 4. 执行密码更新操作
    const updateResult = await query(
      'UPDATE `user` SET password = ?, update_time = NOW() WHERE id = ?',
      [new_pwd, user_id]
    );

    // 5. 校验更新结果
    if (updateResult.affectedRows === 0) {
      return fail(res, '密码修改失败：无数据变更');
    }

    // 6. 返回成功响应
    return success(res, {}, '请重新登录');

  } catch (err) {
    console.error('修改密码接口异常：', err);
    return fail(res, '修改密码失败：' + err.message);
  }
});



// -------------------------- 分类模块/api/category --------------------------
/**
 * 获取分类列表接口
 * GET /api/category/list
 * query: {user_id, type}  type=0(系统分类)/1(自定义分类)
 */
app.get('/api/category/list', async (req, res) => {
  try {
    const { user_id, type } = req.query;
    let results;
    if (type == 0) {
      //获取公共分类
      results = await query('SELECT * FROM `note_category` WHERE type = 0 ORDER BY sort ASC');
    } else {
      //获取公共分类和自定义分类
      results = await query(
        'SELECT * FROM `note_category` WHERE user_id = ? or type=0 ORDER BY sort ASC',
        [user_id]
      );
    }

    return success(res, results, '获取分类列表成功');
  } catch (err) {
    return fail(res, '获取分类列表失败：' + err.message);
  }
});

/**
 * 创建自定义分类接口
 * POST /api/category/add
 * body: {user_id, name, description}
 */
app.post('/api/category/add', async (req, res) => {
  try {
    const { user_id, name, description } = req.body;

    if (!user_id) return paramError(res, '用户ID不能为空');
    if (!name) return paramError(res, '分类名称不能为空');

    const countResult = await query(
      'SELECT COUNT(*) AS total FROM `note_category` WHERE user_id = ? AND category_name = ? AND type = 1',
      [user_id, name]
    );
    const result = await query(
      'INSERT INTO `note_category` (category_name, description, sort, type, user_id, create_time) VALUES (?, ?, 0, 1, ?, NOW())',
      [name, description || '', user_id]
    );

    return success(res, { category_id: result.insertId, name }, '创建分类成功');
  } catch (err) {
    return fail(res, '创建分类失败：' + err.message);
  }
});

/**
 * 修改分类接口（支持名称、优先级、描述）
 * POST /api/category/update
 * body: {id, category_name, sort, description}
 * 说明：category_name/sort/description 至少传一个，sort为数字类型（用于排序优先级）
 */
app.post('/api/category/update', async (req, res) => {
  try {
    const { id, category_name, sort, description } = req.body;

    // 1. 必传参数校验
    if (!id) return paramError(res, '分类ID不能为空');
    // 2. 校验至少传一个要修改的字段
    if (category_name=== undefined && sort === undefined && description === undefined) {
      return paramError(res, '至少需要传入名称、优先级、描述中的一个字段');
    }

    // 3. 校验优先级（如果传了的话）
    let sortNum = null;
    if (sort !== undefined) {
      sortNum = parseInt(sort);
      if (isNaN(sortNum) || sortNum < 0) {
        return paramError(res, '优先级必须是大于等于0的整数');
      }
    }

    // 4. 检查分类是否存在及是否为系统分类
    const cateResult = await query('SELECT type FROM `note_category` WHERE id = ?', [id]);
    if (cateResult.length === 0) return notFound(res, '分类不存在');
    if (cateResult[0].type === 0) return fail(res, '系统分类不可修改', 403);

    // 5. 构建更新SQL和参数（动态拼接，只更新传了的字段）
    let updateFields = [];
    let updateParams = [];
    
    if (category_name!== undefined) {
      updateFields.push('category_name= ?');
      updateParams.push(category_name);
    }
    if (sort !== undefined) {
      updateFields.push('sort = ?');
      updateParams.push(sortNum);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateParams.push(description || ''); // 空值兜底
    }

    // 6. 执行更新操作
    const result = await query(
      `UPDATE \`note_category\` SET ${updateFields.join(', ')} WHERE id = ?`,
      [...updateParams, id]
    );

    if (result.affectedRows === 0) return fail(res, '修改分类失败（无字段变更或分类不存在）');

    // 7. 返回成功响应
    return success(res, { 
      id,
      category_name: category_name || '未修改',
      sort: sortNum || '未修改',
      description: description || '未修改'
    }, '修改分类成功');

  } catch (err) {
    return fail(res, '修改分类失败：' + err.message);
  }
});


/**
 * 批量删除自定义分类接口
 * POST /api/category/delete
 * body: {category_ids, user_id}  category_ids为分类ID数组
 */
app.post('/api/category/delete', async (req, res) => {
  try {
    const { category_ids, user_id } = req.body;

    // 1. 必传参数校验
    if (!category_ids || !Array.isArray(category_ids) || category_ids.length === 0) {
      return paramError(res, '分类ID数组不能为空');
    }
    if (!user_id) return paramError(res, '用户ID不能为空');

    // 2. 校验所有分类是否存在且为自定义分类
    const placeholders = category_ids.map(() => '?').join(',');
    const cateResult = await query(
      `SELECT id, type FROM \`note_category\` WHERE id IN (${placeholders}) AND user_id = ?`,
      [...category_ids, user_id]
    );

    // 过滤出合法的自定义分类ID
    const validCategoryIds = cateResult
      .filter(item => item.type === 1)
      .map(item => item.id);

    if (validCategoryIds.length === 0) {
      return fail(res, '无可用的自定义分类可删除（系统分类不可删或分类不存在）', 403);
    }

    // 3. 批量迁移该分类下的笔记到"其它"分类（category_id=5）
    const migratePlaceholders = validCategoryIds.map(() => '?').join(',');
    await query(
      `UPDATE \`note\` SET category_id = 5 WHERE category_id IN (${migratePlaceholders}) AND user_id = ?`,
      [...validCategoryIds, user_id]
    );

    // 4. 批量删除分类
    const deletePlaceholders = validCategoryIds.map(() => '?').join(',');
    const result = await query(
      `DELETE FROM \`note_category\` WHERE id IN (${deletePlaceholders})`,
      validCategoryIds
    );

    if (result.affectedRows === 0) return fail(res, '删除分类失败');

    return success(res, { 
      deletedCount: result.affectedRows,
      deletedIds: validCategoryIds
    }, `成功删除${result.affectedRows}个自定义分类`);

  } catch (err) {
    return fail(res, '批量删除分类失败：' + err.message);
  }
});

// -------------------------- 笔记模块/api/note --------------------------
/**
 * 获取公开笔记列表接口（使用分页工具类）
 * GET /api/note/public
 * query: {category_id, page, pageSize}
 */
app.get('/api/note/public', async (req, res) => {
  try {
    const { category_id, page, pageSize } = req.query;

    // 1. 分页参数强校验+兜底（转字符串避免驱动兼容问题）
    const currentPage = parseInt(page) || 1;
    const currentPageSize = parseInt(pageSize) || 10;
    const finalPage = currentPage < 1 ? 1 : currentPage;
    const finalPageSize = currentPageSize < 1 ? 10 : (currentPageSize > 50 ? 50 : currentPageSize);
    const offset = Math.max((finalPage - 1) * finalPageSize, 0);

    // 2. 分类ID处理（强制转字符串，适配驱动参数要求）
    let cateIdStr = category_id?.toString() || '0'; // 转字符串
    let cateIdNum = Number(category_id);
    //category_id=0表示显示全部公开笔记
    const isAllCategory = !category_id || isNaN(cateIdNum) || cateIdNum === 0;
    if (!isAllCategory && (cateIdNum < 1)) {
      return paramError(res, '分类ID必须是大于0的整数');
    }

    // 3. 构建SQL和参数（核心：所有参数转字符串，避免驱动兼容问题）
    let listSql = '';
    let countSql = '';
    let listParams = [];
    let countParams = [];
    //显示全部公开笔记
    if (isAllCategory) {
      listSql = `
        SELECT n.*, u.nickname, c.category_name ,u.avatar
        FROM \`note\` n 
        LEFT JOIN \`user\` u ON n.user_id = u.id 
        LEFT JOIN \`note_category\` c ON n.category_id = c.id 
        WHERE n.privacy_type = 2 
        ORDER BY n.create_time DESC
        LIMIT ? OFFSET ?
      `;
      countSql = `SELECT COUNT(*) AS total FROM \`note\` WHERE privacy_type = 2`;
      // 参数转字符串 + 确保是基本类型（非Number对象）
      listParams = [finalPageSize.toString(), offset.toString()];
    } else if(parseInt(category_id)<5){//分类显示公开笔记
      listSql = `
        SELECT n.*, u.nickname, c.category_name  ,u.avatar
        FROM \`note\` n 
        LEFT JOIN \`user\` u ON n.user_id = u.id 
        LEFT JOIN \`note_category\` c ON n.category_id = c.id 
        WHERE n.category_id = ? AND n.privacy_type = 2 
        ORDER BY n.create_time DESC
        LIMIT ? OFFSET ?
      `;
      countSql = `SELECT COUNT(*) AS total FROM \`note\` WHERE category_id = ? AND privacy_type = 2`;
      // 核心修复：所有参数转字符串，避免驱动参数绑定失败
      listParams = [
        cateIdStr,          // 分类ID（字符串）
        finalPageSize.toString(), // 每页条数（字符串）
        offset.toString()   // 偏移量（字符串）
      ];
      countParams = [cateIdStr]; // 总数查询参数也转字符串
    }else{//显示其它公开笔记（主要包括的是用户自定义分类的一些笔记）
      listSql = `
        SELECT n.*, u.nickname, c.category_name  ,u.avatar
        FROM \`note\` n 
        LEFT JOIN \`user\` u ON n.user_id = u.id 
        LEFT JOIN \`note_category\` c ON n.category_id = c.id 
        WHERE n.category_id > ? AND n.privacy_type = 2 
        ORDER BY n.create_time DESC
        LIMIT ? OFFSET ?
      `;
      countSql = `SELECT COUNT(*) AS total FROM \`note\` WHERE category_id > ?  AND privacy_type = 2`;
      // 核心修复：所有参数转字符串，避免驱动参数绑定失败
      listParams = [
        4,          // 分类ID（字符串）
        finalPageSize.toString(), // 每页条数（字符串）
        offset.toString()   // 偏移量（字符串）
      ];
      countParams = [5]; // 总数查询参数也转字符串
    }


    // 4. 执行查询（先查总数，恢复正常查询逻辑）
    const countResult = await query(countSql, countParams);
    const total = countResult?.[0]?.total ?? 0;
    // 核心：如果query方法要求参数是数组嵌套（如[[param1, param2]]），则调整：
    // const noteList = await query(listSql, [listParams]); // 按需打开注释
    const noteList = await query(listSql, listParams); // 默认方式

    // 5. 组装分页数据
    const totalPages = Math.ceil(total / finalPageSize) || 0;
    const paginationData = {
      list: noteList,
      pagination: {
        page: finalPage,
        pageSize: finalPageSize,
        total: total,
        totalPages: totalPages,
        hasMore: finalPage < totalPages
      }
    };

    return success(res, paginationData, "获取公开笔记分页数据成功！");

  } catch (err) {
    console.error('公开笔记分页查询失败：', err);
    console.error('错误SQL参数：', req.query);
    // 更详细的错误信息
    console.error('参数绑定失败详情：', {
      sql: err.sql,
      params: err.params,
      message: err.message
    });
    return fail(res, '分页查询失败：' + err.message);
  }
});



/**
 * 获取个人笔记列表接口
 * GET /api/note/list
 * query: {user_id, category_id, level, privacy, page, pageSize}
 */
app.get('/api/note/list', async (req, res) => {
  try {
    const { user_id, category_id, level, privacy, page, pageSize } = req.query;

    // 1. 核心参数强校验（用户ID）
    const userIdNum = Number(user_id);
    if (!user_id || isNaN(userIdNum) || userIdNum < 1) {
      return paramError(res, '用户ID必须是大于0的整数');
    }
    const userIdStr = userIdNum.toString(); // 转字符串适配驱动

    // 2. 分页参数强校验+兜底（转字符串避免驱动兼容问题）
    const currentPage = parseInt(page) || 1;
    const currentPageSize = parseInt(pageSize) || 10;
    const finalPage = currentPage < 1 ? 1 : currentPage; // 页码≥1
    const finalPageSize = currentPageSize < 1 ? 10 : (currentPageSize > 50 ? 50 : currentPageSize); // 页大小1-50
    const offset = Math.max((finalPage - 1) * finalPageSize, 0); // 偏移量≥0

    // 3. 筛选参数处理+合法性校验（转字符串适配驱动）
    // 分类ID：未传/0/非数值 → 不筛选；否则必须是≥1的整数
    const cateIdNum = Number(category_id);
    const hasCategory = !isNaN(cateIdNum) && cateIdNum > 0;
    const cateIdStr = hasCategory ? cateIdNum.toString() : '';

    // 重要程度：未传/非数值 → 不筛选；假设level有效值为1/2/3
    const levelNum = Number(level);
    const hasLevel = !isNaN(levelNum) && [1, 2, 3].includes(levelNum);
    const levelStr = hasLevel ? levelNum.toString() : '';

    // 隐私类型：未传/非数值 → 不筛选；假设privacy有效值为1/2
    const privacyNum = Number(privacy);
    const hasPrivacy = !isNaN(privacyNum) && [1, 2].includes(privacyNum);
    const privacyStr = hasPrivacy ? privacyNum.toString() : '';

    // 4. 动态构建SQL和参数（安全拼接，避免语法错误）
    // 基础SQL（用户ID为必选条件）
    let listSql = `SELECT n.*,c.category_name FROM note n,note_category c WHERE category_id=c.id and n.user_id = ?`;
    let countSql = `SELECT COUNT(*) AS total FROM \`note\` WHERE user_id = ?`;
    
    // 参数数组（初始仅用户ID，转字符串）
    let listParams = [userIdStr];
    let countParams = [userIdStr];

    // 分类筛选（仅当参数有效时拼接）
    if (hasCategory) {
      listSql += ' AND category_id = ?';
      listParams.push(cateIdStr);
      countSql += ' AND category_id = ?';
      countParams.push(cateIdStr);
    }

    // 重要程度筛选（仅当参数有效时拼接）
    if (hasLevel) {
      listSql += ' AND level = ?';
      listParams.push(levelStr);
      countSql += ' AND level = ?';
      countParams.push(levelStr);
    }

    // 隐私类型筛选（仅当参数有效时拼接）
    if (hasPrivacy) {
      listSql += ' AND privacy_type = ?';
      listParams.push(privacyStr);
      countSql += ' AND privacy_type = ?';
      countParams.push(privacyStr);
    }

    // 排序 + 分页（LIMIT/OFFSET）
    listSql += ' ORDER BY n.create_time DESC LIMIT ? OFFSET ?';
    // 追加分页参数（转字符串）
    listParams.push(finalPageSize.toString(), offset.toString());

    // 调试打印（关键：确认参数数量/类型匹配）
    console.log('=== 个人笔记查询调试信息 ===');
    console.log('列表SQL：', listSql);
    console.log('列表参数：', listParams); // 应为字符串数组
    console.log('总数SQL：', countSql);
    console.log('总数参数：', countParams); // 应为字符串数组
    console.log('============================');

    // 5. 执行查询（先查总数，再查列表）
    const countResult = await query(countSql, countParams);
    const total = countResult?.[0]?.total ?? 0; // 总数兜底为0
    const noteList = await query(listSql, listParams);

    // 6. 组装标准化分页数据（适配前端）
    const totalPages = Math.ceil(total / finalPageSize) || 0;
    const paginationData = {
      list: noteList,
      pagination: {
        page: finalPage,          // 当前页码
        pageSize: finalPageSize,  // 每页条数
        total: total,             // 总条数
        totalPages: totalPages,   // 总页数
        hasMore: finalPage < totalPages // 是否有更多数据
      }
    };

    // 7. 返回响应
    return success(res, paginationData, "获取个人笔记分页数据成功！");

  } catch (err) {
    console.error('个人笔记分页查询失败：', err);
    console.error('错误请求参数：', req.query);
    // 详细错误信息（便于定位参数绑定问题）
    console.error('参数绑定失败详情：', {
      sql: err.sql,
      params: err.params,
      message: err.message
    });
    return fail(res, '分页查询失败：' + err.message);
  }
});

/**
 * 个人笔记标题模糊查询接口
 * GET /api/note/list/by-title
 * query: {user_id, title, category_id, level, privacy, page, pageSize}
 * title: 笔记标题关键词（必填）
 */
app.get('/api/note/list/by-title', async (req, res) => {
  try {
    const { user_id, title, category_id, level, privacy, page, pageSize } = req.query;

    // 1. 核心参数强校验
    // 校验用户ID
    const userIdNum = Number(user_id);
    if (!user_id || isNaN(userIdNum) || userIdNum < 1) {
      return paramError(res, '用户ID必须是大于0的整数');
    }
    const userIdStr = userIdNum.toString();

    // 校验标题关键词（必填）
    if (!title || title.trim() === '') {
      return paramError(res, '标题关键词不能为空');
    }
    const titleKeyword = `%${title.trim()}%`; // 模糊查询通配符

    // 2. 分页参数强校验+兜底（与原接口一致）
    const currentPage = parseInt(page) || 1;
    const currentPageSize = parseInt(pageSize) || 10;
    const finalPage = currentPage < 1 ? 1 : currentPage;
    const finalPageSize = currentPageSize < 1 ? 10 : (currentPageSize > 50 ? 50 : currentPageSize);
    const offset = Math.max((finalPage - 1) * finalPageSize, 0);

    // 3. 筛选参数处理（与原接口一致）
    const cateIdNum = Number(category_id);
    const hasCategory = !isNaN(cateIdNum) && cateIdNum > 0;
    const cateIdStr = hasCategory ? cateIdNum.toString() : '';

    const levelNum = Number(level);
    const hasLevel = !isNaN(levelNum) && [1, 2, 3].includes(levelNum);
    const levelStr = hasLevel ? levelNum.toString() : '';

    const privacyNum = Number(privacy);
    const hasPrivacy = !isNaN(privacyNum) && [1, 2].includes(privacyNum);
    const privacyStr = hasPrivacy ? privacyNum.toString() : '';

    // 4. 动态构建SQL和参数（新增标题模糊匹配）
    let listSql = `
      SELECT n.*, c.category_name 
      FROM note n 
      LEFT JOIN note_category c ON n.category_id = c.id 
      WHERE n.user_id = ? AND n.title LIKE ?
    `;
    let countSql = `SELECT COUNT(*) AS total FROM \`note\` WHERE user_id = ? AND title LIKE ?`;
    
    // 参数数组（先放入用户ID和标题关键词）
    let listParams = [userIdStr, titleKeyword];
    let countParams = [userIdStr, titleKeyword];

    // 分类筛选
    if (hasCategory) {
      listSql += ' AND n.category_id = ?';
      listParams.push(cateIdStr);
      countSql += ' AND category_id = ?';
      countParams.push(cateIdStr);
    }

    // 重要程度筛选
    if (hasLevel) {
      listSql += ' AND n.level = ?';
      listParams.push(levelStr);
      countSql += ' AND level = ?';
      countParams.push(levelStr);
    }

    // 隐私类型筛选
    if (hasPrivacy) {
      listSql += ' AND n.privacy_type = ?';
      listParams.push(privacyStr);
      countSql += ' AND privacy_type = ?';
      countParams.push(privacyStr);
    }

    // 排序 + 分页
    listSql += ' ORDER BY n.create_time DESC LIMIT ? OFFSET ?';
    listParams.push(finalPageSize.toString(), offset.toString());

    // 调试打印
    console.log('=== 个人笔记标题查询调试信息 ===');
    console.log('列表SQL：', listSql);
    console.log('列表参数：', listParams);
    console.log('总数SQL：', countSql);
    console.log('总数参数：', countParams);
    console.log('============================');

    // 5. 执行查询
    const countResult = await query(countSql, countParams);
    const total = countResult?.[0]?.total ?? 0;
    const noteList = await query(listSql, listParams);

    // 6. 组装分页数据
    const totalPages = Math.ceil(total / finalPageSize) || 0;
    const paginationData = {
      list: noteList,
      pagination: {
        page: finalPage,
        pageSize: finalPageSize,
        total: total,
        totalPages: totalPages,
        hasMore: finalPage < totalPages
      }
    };

    // 7. 返回响应
    return success(res, paginationData, "个人笔记标题模糊查询成功！");

  } catch (err) {
    console.error('个人笔记标题查询失败：', err);
    console.error('错误请求参数：', req.query);
    console.error('参数绑定失败详情：', {
      sql: err.sql,
      params: err.params,
      message: err.message
    });
    return fail(res, '标题查询失败：' + err.message);
  }
});


/**
 * 1. 公开笔记-标题模糊查询接口
 * GET /api/note/public/by-title
 * query: {title, category_id, page, pageSize}
 * title: 笔记标题关键词（必填）
 */
app.get('/api/note/public/by-title', async (req, res) => {
  try {
    const { title, category_id, page, pageSize } = req.query;

    // 1. 必传参数校验（使用工具类返回参数错误）
    if (!title || title.trim() === '') {
      return paramError(res, '标题关键词不能为空');
    }
    const titleKeyword = `%${title.trim()}%`; // 模糊查询通配符

    // 2. 分页参数强校验+兜底（与原接口保持一致）
    const currentPage = parseInt(page) || 1;
    const currentPageSize = parseInt(pageSize) || 10;
    const finalPage = currentPage < 1 ? 1 : currentPage;
    const finalPageSize = currentPageSize < 1 ? 10 : (currentPageSize > 50 ? 50 : currentPageSize);
    const offset = Math.max((finalPage - 1) * finalPageSize, 0);

    // 3. 分类ID处理（与原接口逻辑一致）
    let cateIdStr = category_id?.toString() || '0';
    let cateIdNum = Number(category_id);
    const isAllCategory = !category_id || isNaN(cateIdNum) || cateIdNum === 0;
    if (!isAllCategory && (cateIdNum < 1)) {
      return paramError(res, '分类ID必须是大于0的整数');
    }

    // 4. 构建SQL和参数（核心：新增标题模糊匹配）
    let listSql = '';
    let countSql = '';
    let listParams = [titleKeyword]; // 先放入标题关键词
    let countParams = [titleKeyword];

    if (isAllCategory) {
      // 全部分类 + 标题模糊查询
      listSql = `
        SELECT n.*, u.nickname, c.category_name, u.avatar
        FROM \`note\` n 
        LEFT JOIN \`user\` u ON n.user_id = u.id 
        LEFT JOIN \`note_category\` c ON n.category_id = c.id 
        WHERE n.privacy_type = 2 AND n.title LIKE ?
        ORDER BY n.create_time DESC
        LIMIT ? OFFSET ?
      `;
      countSql = `SELECT COUNT(*) AS total FROM \`note\` WHERE privacy_type = 2 AND title LIKE ?`;
      listParams = [...listParams, finalPageSize.toString(), offset.toString()];
    } else if (parseInt(category_id) < 5) {
      // 指定系统分类 + 标题模糊查询
      listSql = `
        SELECT n.*, u.nickname, c.category_name, u.avatar
        FROM \`note\` n 
        LEFT JOIN \`user\` u ON n.user_id = u.id 
        LEFT JOIN \`note_category\` c ON n.category_id = c.id 
        WHERE n.category_id = ? AND n.privacy_type = 2 AND n.title LIKE ?
        ORDER BY n.create_time DESC
        LIMIT ? OFFSET ?
      `;
      countSql = `SELECT COUNT(*) AS total FROM \`note\` WHERE category_id = ? AND privacy_type = 2 AND title LIKE ?`;
      listParams = [cateIdStr, titleKeyword, finalPageSize.toString(), offset.toString()];
      countParams = [cateIdStr, titleKeyword];
    } else {
      // 其它分类（category_id>5） + 标题模糊查询
      listSql = `
        SELECT n.*, u.nickname, c.category_name, u.avatar
        FROM \`note\` n 
        LEFT JOIN \`user\` u ON n.user_id = u.id 
        LEFT JOIN \`note_category\` c ON n.category_id = c.id 
        WHERE n.category_id > ? AND n.privacy_type = 2 AND n.title LIKE ?
        ORDER BY n.create_time DESC
        LIMIT ? OFFSET ?
      `;
      countSql = `SELECT COUNT(*) AS total FROM \`note\` WHERE category_id > ? AND privacy_type = 2 AND title LIKE ?`;
      listParams = ['4', titleKeyword, finalPageSize.toString(), offset.toString()];
      countParams = ['4', titleKeyword];
    }

    // 5. 执行查询（总数 + 列表，增加兜底处理）
    const [countResult] = await query(countSql, countParams);
    const total = countResult?.[0]?.total ?? 0; // 兜底避免空值
    const totalPages = Math.ceil(total / finalPageSize) || 0;

    const listResult = await query(listSql, listParams);

    const paginationData = {
      list: listResult || [], // 列表兜底为空数组
      pagination: {
        page: finalPage,
        pageSize: finalPageSize,
        total,
        totalPages,
        hasMore: finalPage < totalPages
      }
    };

    // 6. 返回响应（使用工具类，自定义提示语）
    return success(res, paginationData, "笔记标题模糊查询成功！", 200);
  } catch (error) {
    console.error('标题模糊查询失败：', error);
    // 使用工具类返回失败响应，补全code和httpStatus
    return fail(res, '标题查询失败：' + error.message, 500, null, 500);
  }
});

/**
 * 2. 公开笔记-作者昵称模糊查询接口
 * GET /api/note/public/by-author
 * query: {nickname, category_id, page, pageSize}
 * nickname: 作者昵称关键词（必填）
 */
app.get('/api/note/public/by-author', async (req, res) => {
  try {
    const { nickname, category_id, page, pageSize } = req.query;

    // 1. 必传参数校验（使用工具类返回参数错误）
    if (!nickname || nickname.trim() === '') {
      return paramError(res, '作者昵称关键词不能为空');
    }
    const nicknameKeyword = `%${nickname.trim()}%`; // 模糊查询通配符

    // 2. 分页参数强校验+兜底（与原接口保持一致）
    const currentPage = parseInt(page) || 1;
    const currentPageSize = parseInt(pageSize) || 10;
    const finalPage = currentPage < 1 ? 1 : currentPage;
    const finalPageSize = currentPageSize < 1 ? 10 : (currentPageSize > 50 ? 50 : currentPageSize);
    const offset = Math.max((finalPage - 1) * finalPageSize, 0);

    // 3. 分类ID处理（与原接口逻辑一致）
    let cateIdStr = category_id?.toString() || '0';
    let cateIdNum = Number(category_id);
    const isAllCategory = !category_id || isNaN(cateIdNum) || cateIdNum === 0;
    if (!isAllCategory && (cateIdNum < 1)) {
      return paramError(res, '分类ID必须是大于0的整数');
    }

    // 4. 构建SQL和参数（核心：多表关联 + 昵称模糊匹配）
    let listSql = '';
    let countSql = '';
    let listParams = [nicknameKeyword];
    let countParams = [nicknameKeyword];

    if (isAllCategory) {
      // 全部分类 + 作者昵称模糊查询
      listSql = `
        SELECT n.*, u.nickname, c.category_name, u.avatar
        FROM \`note\` n 
        INNER JOIN \`user\` u ON n.user_id = u.id  -- 必须关联用户表（昵称在user表）
        LEFT JOIN \`note_category\` c ON n.category_id = c.id 
        WHERE n.privacy_type = 2 AND u.nickname LIKE ?
        ORDER BY n.create_time DESC
        LIMIT ? OFFSET ?
      `;
      countSql = `
        SELECT COUNT(*) AS total 
        FROM \`note\` n 
        INNER JOIN \`user\` u ON n.user_id = u.id 
        WHERE n.privacy_type = 2 AND u.nickname LIKE ?
      `;
      listParams = [...listParams, finalPageSize.toString(), offset.toString()];
    } else if (parseInt(category_id) < 5) {
      // 指定系统分类 + 作者昵称模糊查询
      listSql = `
        SELECT n.*, u.nickname, c.category_name, u.avatar
        FROM \`note\` n 
        INNER JOIN \`user\` u ON n.user_id = u.id 
        LEFT JOIN \`note_category\` c ON n.category_id = c.id 
        WHERE n.category_id = ? AND n.privacy_type = 2 AND u.nickname LIKE ?
        ORDER BY n.create_time DESC
        LIMIT ? OFFSET ?
      `;
      countSql = `
        SELECT COUNT(*) AS total 
        FROM \`note\` n 
        INNER JOIN \`user\` u ON n.user_id = u.id 
        WHERE n.category_id = ? AND n.privacy_type = 2 AND u.nickname LIKE ?
      `;
      listParams = [cateIdStr, nicknameKeyword, finalPageSize.toString(), offset.toString()];
      countParams = [cateIdStr, nicknameKeyword];
    } else {
      // 其它分类（category_id>5） + 作者昵称模糊查询
      listSql = `
        SELECT n.*, u.nickname, c.category_name, u.avatar
        FROM \`note\` n 
        INNER JOIN \`user\` u ON n.user_id = u.id 
        LEFT JOIN \`note_category\` c ON n.category_id = c.id 
        WHERE n.category_id > ? AND n.privacy_type = 2 AND u.nickname LIKE ?
        ORDER BY n.create_time DESC
        LIMIT ? OFFSET ?
      `;
      countSql = `
        SELECT COUNT(*) AS total 
        FROM \`note\` n 
        INNER JOIN \`user\` u ON n.user_id = u.id 
        WHERE n.category_id > ? AND n.privacy_type = 2 AND u.nickname LIKE ?
      `;
      listParams = ['4', nicknameKeyword, finalPageSize.toString(), offset.toString()];
      countParams = ['4', nicknameKeyword];
    }

    // 5. 执行查询（总数 + 列表，增加兜底处理）
    const [countResult] = await query(countSql, countParams);
    const total = countResult?.[0]?.total ?? 0; // 兜底避免空值
    const totalPages = Math.ceil(total / finalPageSize) || 0;

    const listResult = await query(listSql, listParams);

    const data = {
      list: listResult || [], // 列表兜底为空数组
      pagination: {
        page: finalPage,
        pageSize: finalPageSize,
        total,
        totalPages,
        hasMore: finalPage < totalPages
      }
    };

    // 6. 返回响应（使用工具类，自定义提示语）
    return success(res, data, "根据作者名称查询成功", 200);
  } catch (error) {
    console.error('作者昵称查询失败：', error);
    // 使用工具类返回失败响应，补全code和httpStatus
    return fail(res, '作者昵称查询失败：' + error.message, 500, null, 500);
  }
});

/**
 * 获取笔记详情接口（含多媒体资源）
 * GET /api/note/detail
 * query: {note_id, user_id}
 */
app.get('/api/note/detail', async (req, res) => {
  try {
    const { note_id, user_id } = req.query;

    if (!note_id) return paramError(res, '笔记ID不能为空');

    // 1. 查询笔记基础信息
    const noteResult = await query(
      'select n.*,c.`category_name` from `note` n,`note_category` c where n.`category_id`=c.`id` and n.`id` = ?', 
      [note_id]
    );
    if (noteResult.length === 0) return notFound(res, '笔记不存在');

    const note = noteResult[0];

    // 2. 查询关联的多媒体资源
    const mediaResult = await query(
      'SELECT id, media_type, media_url FROM `note_media` WHERE note_id = ? ORDER BY create_time DESC',
      [note_id]
    );

    // 3. 整理多媒体数据（图片单独存入images数组，语音单独处理）
    const mediaData = {
      images: [],       // 图片资源数组
      voices: [],       // 语音资源数组
      allMedia: mediaResult // 所有多媒体原始数据
    };
    
    mediaResult.forEach(item => {
      if (item.media_type === 1) {
        mediaData.images.push({
          id: item.id,
          url: item.media_url,
          create_time: item.create_time
        });
      } else if (item.media_type === 2) {
        mediaData.voices.push({
          id: item.id,
          url: item.media_url,
          create_time: item.create_time
        });
      }
    });

    // 4. 合并笔记数据和多媒体数据
    const noteDetail = {
      ...note,
      ...mediaData
    };

    return success(res, noteDetail, '获取笔记详情成功');
  } catch (err) {
    return fail(res, '获取笔记详情失败：' + err.message);
  }
});
/**
 * 新建笔记接口（支持批量添加多媒体）
 * POST /api/note/add
 * body: {
 *   user_id, title, content, category_id, level, privacy_type,
 *   mediaList: [ // 可选，多媒体列表
 *     {media_type: 1, media_url: 'xxx'},
 *     {media_type: 2, media_url: 'xxx'}
 *   ]
 * }
 */
app.post('/api/note/add', async (req, res) => {
  // 开启事务（确保笔记和多媒体数据同时创建/回滚）
  const connection = await getConnection(); // 需提前封装数据库连接获取方法
  try {
    await connection.beginTransaction();

    const { user_id, title, content, category_id, level, privacy_type, mediaList = [] } = req.body;

    // 基础参数校验
    if (!user_id) return paramError(res, '用户ID不能为空');
    if (!title) return paramError(res, '笔记标题不能为空');
    if (!content) return paramError(res, '笔记内容不能为空');
    if (!category_id) return paramError(res, '分类ID不能为空');
    if (!level) return paramError(res, '重要程度不能为空');
    if (!privacy_type) return paramError(res, '隐私类型不能为空');

    // 1. 创建笔记主记录
    const [noteResult] = await connection.query(
      'INSERT INTO `note` (user_id, title, content, category_id,  privacy_type,level, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [user_id, title, content, category_id, privacy_type,level]
    );
    const noteId = noteResult.insertId;

    // 2. 批量添加多媒体资源（如果有）
    if (mediaList.length > 0) {
      // 校验mediaList格式
      const validMediaList = mediaList.filter(item => 
        item.media_type && [1, 2].includes(item.media_type) && item.media_url
      );
      
      if (validMediaList.length > 0) {
        // 生成二维数组：[[noteId, type1, url1], [noteId, type2, url2]]
        const mediaValues = validMediaList.map(item => [
          noteId,          // 关联的笔记ID
          item.media_type, // 媒体类型（1=图片 2=语音）
          item.media_url   // 媒体URL
        ]);
        
        // 批量插入多媒体数据（关键：VALUES ? + 传入二维数组）
        await connection.query(
          'INSERT INTO `note_media` (note_id, media_type, media_url) VALUES ?',
          [mediaValues] // 注意：这里是一维数组包裹二维数组，不是解构
        );
      }
    }

    await connection.commit(); // 提交事务

    return success(res, { note_id: noteId, title }, '新建笔记成功');
  } catch (err) {
    await connection.rollback(); // 事务回滚
    return fail(res, '新建笔记失败：' + err.message);
  } finally {
    connection.release(); // 释放连接
  }
});
/**
 * 修改笔记接口（支持批量处理多媒体）
 * POST /api/note/update
 * body: {
 *   note_id, user_id, title, content, category_id, level, privacy_type,
 *   deleteMediaIds: [], // 可选，要删除的多媒体ID数组
 *   addMediaList: [     // 可选，要新增的多媒体列表
 *     {media_type: 1, media_url: 'xxx'}
 *   ]
 * }
 */
app.post('/api/note/update', async (req, res) => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    const { 
      note_id, user_id, title, content, category_id, level, privacy_type,
      deleteMediaIds = [], // 要删除的多媒体ID
      addMediaList = []    // 要新增的多媒体
    } = req.body;

    // 基础参数校验
    if (!note_id) return paramError(res, '笔记ID不能为空');
    if (!user_id) return paramError(res, '用户ID不能为空');
    // 1. 校验笔记归属权
    const [noteResult] = await connection.query('SELECT user_id FROM `note` WHERE id = ?', [note_id]);
    if (noteResult.length === 0) return notFound(res, '笔记不存在');
    if (noteResult[0].user_id != user_id) return fail(res, '无权限修改该笔记', 403);

    // 2. 更新笔记基础信息
    const updateResult = await connection.query(
      'UPDATE `note` SET title = ?, content = ?, category_id = ?, privacy_type = ?,level = ?, update_time = NOW() WHERE id = ?',
      [title, content, category_id, privacy_type ,level, note_id]
    );
    if (updateResult[0].affectedRows === 0) {
      await connection.rollback();
      return fail(res, '修改笔记失败');
    }

    // 3. 批量删除指定的多媒体资源
    if (deleteMediaIds.length > 0) {
      // 过滤合法的数字ID
      const validMediaIds = deleteMediaIds.filter(id => !isNaN(id) && id > 0);
      if (validMediaIds.length > 0) {
        const placeholders = validMediaIds.map(() => '?').join(',');
        await connection.query(
          `DELETE FROM \`note_media\` WHERE id IN (${placeholders}) AND note_id = ?`,
          [...validMediaIds, note_id] // 关联note_id防止删除其他笔记的资源
        );
      }
    }

    // 4. 批量新增多媒体资源
    if (addMediaList.length > 0) {
      const validMediaList = addMediaList.filter(item => 
        item.media_type && [1, 2].includes(item.media_type) && item.media_url
      );
      
      if (validMediaList.length > 0) {
        const mediaValues = validMediaList.map(item => [
          note_id,
          item.media_type,
          item.media_url
        ]);
        await connection.query(
          'INSERT INTO `note_media` (note_id, media_type, media_url) VALUES ?',
          [mediaValues]
        );
      }
    }

    await connection.commit();

    return success(res, null, '修改笔记成功');
  } catch (err) {
    await connection.rollback();
    return fail(res, '修改笔记失败：' + err.message);
  } finally {
    connection.release();
  }
});

/**
 * 删除笔记接口
 * POST /api/note/delete
 * body: {note_id, user_id}
 */
app.post('/api/note/delete', async (req, res) => {
  try {
    const { note_id, user_id } = req.body;

    if (!note_id) return paramError(res, '笔记ID不能为空');
    if (!user_id) return paramError(res, '用户ID不能为空');

    const noteResult = await query('SELECT user_id FROM `note` WHERE id = ?', [note_id]);
    if (noteResult.length === 0) return notFound(res, '笔记不存在');
    if (noteResult[0].user_id != user_id) return fail(res, '无权限删除该笔记', 403);

    const result = await query('DELETE FROM `note` WHERE id = ?', [note_id]);

    if (result.affectedRows === 0) return fail(res, '删除笔记失败');

    // 由于note_media表设置了ON DELETE CASCADE，删除笔记后会自动删除关联的多媒体
    return success(res, null, '删除笔记成功');
  } catch (err) {
    return fail(res, '删除笔记失败：' + err.message);
  }
});

// -------------------------- 收藏模块/api/collect --------------------------
/**
 * 收藏笔记接口
 * POST /api/collect/add
 * body: {user_id, note_id}
 */
app.post('/api/collect/add', async (req, res) => {
  try {
    const { user_id, note_id } = req.body;

    if (!user_id) return paramError(res, '用户ID不能为空');
    if (!note_id) return paramError(res, '笔记ID不能为空');

    const noteResult = await query('SELECT id FROM `note` WHERE id = ?', [note_id]);
    if (noteResult.length === 0) return notFound(res, '笔记不存在');

    const collectResult = await query(
      'SELECT COUNT(*) AS total FROM `note_collect` WHERE user_id = ? AND note_id = ?',
      [user_id, note_id]
    );
    const count = collectResult?.[0]?.total ?? 0;
    if (count > 0) return duplicate(res, '已收藏该笔记，无需重复收藏');

    const result = await query(
      'INSERT INTO `note_collect` (user_id, note_id, create_time) VALUES (?, ?, NOW())',
      [user_id, note_id]
    );

    return success(res, null, '收藏笔记成功');
  } catch (err) {
    return fail(res, '收藏笔记失败：' + err.message);
  }
});

/**
 * 取消收藏接口
 * POST /api/collect/cancel
 * body: {user_id, note_id}
 */
app.post('/api/collect/cancel', async (req, res) => {
  try {
    const { user_id, note_id } = req.body;

    if (!user_id) return paramError(res, '用户ID不能为空');
    if (!note_id) return paramError(res, '笔记ID不能为空');

    const result = await query(
      'DELETE FROM `note_collect` WHERE user_id = ? AND note_id = ?',
      [user_id, note_id]
    );

    if (result.affectedRows === 0) return fail(res, '未收藏该笔记，无需取消');

    return success(res, null, '取消收藏成功');
  } catch (err) {
    return fail(res, '取消收藏失败：' + err.message);
  }
});

/**
 * 检查是否收藏笔记接口
 * GET /api/collect/check
 * query: {user_id, note_id}
 */
app.get('/api/collect/check', async (req, res) => {
  try {
    const { user_id, note_id } = req.query;
    if (!user_id || !note_id) return paramError(res, '参数不能为空');

    const result = await query(
      'SELECT COUNT(*) AS total FROM `note_collect` WHERE user_id = ? AND note_id = ?',
      [user_id, note_id]
    );
    return success(res, result[0].total > 0, '检查收藏状态成功');
  } catch (err) {
    return fail(res, '检查收藏状态失败：' + err.message);
  }
});

/**
 * 获取用户收藏列表接口（使用分页工具类）
 * GET /api/collect/list
 * query: {user_id, page, pageSize}
 */
app.get('/api/collect/list', async (req, res) => {
  try {
    const { user_id, page, pageSize } = req.query;

    // 1. 核心参数强校验（用户ID）
    const userIdNum = Number(user_id);
    if (!user_id || isNaN(userIdNum) || userIdNum < 1) {
      return paramError(res, '用户ID必须是大于0的整数');
    }
    const userIdStr = userIdNum.toString(); // 转字符串适配MySQL驱动

    // 2. 分页参数强校验+兜底（转字符串避免驱动兼容问题）
    const currentPage = parseInt(page) || 1;
    const currentPageSize = parseInt(pageSize) || 10;
    const finalPage = currentPage < 1 ? 1 : currentPage; // 页码兜底≥1
    const finalPageSize = currentPageSize < 1 ? 10 : (currentPageSize > 50 ? 50 : currentPageSize); // 页大小1-50
    const offset = Math.max((finalPage - 1) * finalPageSize, 0); // 偏移量兜底≥0

    // 3. 构建SQL和参数（核心修改：关联用户表+子查询收藏数）
    // 列表SQL：关联收藏表+笔记表+用户表，子查询获取笔记总收藏数
    const listSql = `
      SELECT 
        nc.create_time AS collect_time, -- 收藏时间（重命名避免冲突）
        n.*,
        u.nickname AS author_nickname, u.avatar, -- 笔记作者昵称
        (SELECT COUNT(*) FROM \`note_collect\` WHERE note_id = n.id) AS collect_count -- 笔记总收藏数
      FROM \`note_collect\` nc 
      LEFT JOIN \`note\` n ON nc.note_id = n.id 
      LEFT JOIN \`user\` u ON n.user_id = u.id -- 关联用户表获取作者信息
      WHERE nc.user_id = ? 
      ORDER BY nc.create_time DESC
      LIMIT ? OFFSET ?
    `;
    // 总数SQL：仅查收藏表总数（性能更优）
    const countSql = `SELECT COUNT(*) AS total FROM \`note_collect\` WHERE user_id = ?`;

    // 参数数组（全转字符串，适配驱动参数绑定要求）
    const listParams = [
      userIdStr,          // 用户ID（字符串）
      finalPageSize.toString(), // 每页条数（字符串）
      offset.toString()   // 偏移量（字符串）
    ];
    const countParams = [userIdStr]; // 总数查询参数（字符串）

    // 调试打印（关键：确认参数数量/类型匹配）
    console.log('=== 收藏列表查询调试信息 ===');
    console.log('列表SQL：', listSql);
    console.log('列表参数：', listParams); // 应为 ["1", "10", "0"] 格式
    console.log('总数SQL：', countSql);
    console.log('总数参数：', countParams); // 应为 ["1"] 格式
    console.log('============================');

    // 4. 执行查询（先查总数，再查列表）
    const countResult = await query(countSql, countParams);
    const total = countResult?.[0]?.total ?? 0; // 总数兜底为0
    const collectList = await query(listSql, listParams);

    // 5. 组装标准化分页数据（和其他接口格式一致）
    const totalPages = Math.ceil(total / finalPageSize) || 0;
    const paginationData = {
      list: collectList,
      pagination: {
        page: finalPage,          // 当前页码
        pageSize: finalPageSize,  // 每页条数
        total: total,             // 总收藏数
        totalPages: totalPages,   // 总页数
        hasMore: finalPage < totalPages // 是否有更多数据
      }
    };

    // 6. 返回响应
    return success(res, paginationData, "获取收藏列表分页数据成功！");

  } catch (err) {
    console.error('收藏列表分页查询失败：', err);
    console.error('错误请求参数：', req.query);
    // 详细错误信息（便于定位参数绑定问题）
    console.error('参数绑定失败详情：', {
      sql: err.sql,
      params: err.params,
      message: err.message
    });
    return fail(res, '分页查询失败：' + err.message);
  }
});

// 启动服务器
app.listen(PORT, () => {
  // 获取本机IP
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
