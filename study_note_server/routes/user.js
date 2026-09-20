const express = require('express');
const router = express.Router();
const { query, getConnection } = require('../db/db_config');
const JwtUtil = require('../utils/jwt_util');
const { success, paramError, notFound, fail, duplicate } = require('../utils/response');

// 用户注册
router.post('/register', async (req, res) => {
  try {
    const { username, password, nickname } = req.body;
    if (!username) return paramError(res, '用户名不能为空');
    if (!password) return paramError(res, '密码不能为空');
    if (!nickname) return paramError(res, '昵称不能为空');

    const result = await query(
      'INSERT INTO `user` (username, password, nickname, avatar, create_time) VALUES (?, ?, ?, ?, NOW())',
      [username, password, nickname, 'https://example.com/default-avatar.jpg']
    );

    return success(res, { user_id: result.insertId, username, nickname }, '注册成功！');
  } catch (err) {
    return fail(res, '注册失败：' + err.message);
  }
});

// 检查用户名唯一性
router.get('/check-username', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return paramError(res, '用户名不能为空');
    
    const countResult = await query('SELECT COUNT(*) AS total FROM `user` WHERE username = ?', [username]);
    const count = countResult?.[0]?.total ?? 0;

    return success(
      res, 
      { isAvailable: count === 0 }, 
      count === 0 ? '用户名可用' : '用户名已存在'
    );
  } catch (err) {
    return fail(res, '校验用户名失败：' + err.message);
  }
});

// 检查昵称唯一性
router.get('/check-nickname', async (req, res) => {
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

// 用户登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username) return paramError(res, '用户名不能为空');
    if (!password) return paramError(res, '密码不能为空');

    const userResult = await query(
      'SELECT id, username, nickname, avatar FROM `user` WHERE username = ? AND password = ?',
      [username, password]
    );
   
    if (userResult.length === 0) return notFound(res, '用户名或密码错误');
 
    const userInfo = { id: userResult[0].id };
    const tokens = JwtUtil.generateTokens(userInfo);
    const user = [userResult[0], tokens];

    return success(res, user, '登录成功！');
  } catch (err) {
    return fail(res, '登录失败：' + err.message);
  }
});

// 验证token
router.get('/check-token', async (req, res) => {
  try {
    const { token } = req.query;
    const result = await JwtUtil.verifyToken(token);
    if (result !== null) return fail(res, result);
    return success(res, result, "token验证成功");
  } catch (err) {
    return fail(res, '验证失败：' + err.message);
  }
});

// 退出登录
router.get('/logout', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return paramError(res, '用户Id不能为空');

    const flag = await JwtUtil.logout(userId);
    if (!flag) return fail(res, '退出登录失败');

    return success(res, "", '退出成功！');
  } catch (err) {
    return fail(res, '退出登录失败：' + err.message);
  }
});

// 刷新token
router.get('/refresh', async (req, res) => {
  try {
    const { userId, refreshToken } = req.query;
    if (!userId) return paramError(res, '用户Id不能为空');
    if (!refreshToken) return paramError(res, '刷新令牌不能为空');

    const newTokens = await JwtUtil.refreshAccessToken(refreshToken, userId);
    if (!newTokens) return fail(res, '刷新令牌无效或已过期');

    return success(res, newTokens, '令牌刷新成功！');
  } catch (err) {
    console.error('刷新令牌接口异常：', err);
    return fail(res, '刷新失败：' + err.message);
  }
});

// 获取用户信息
router.get('/profile', async (req, res) => {
  try {
    const { user_id, username } = req.query;

    if (!user_id && username) {
      const userResult = await query(
        'SELECT avatar FROM `user` WHERE username = ?',
        [username]
      );
      if (userResult.length === 0) return notFound(res, '用户不存在');
      return success(res, userResult[0], '获取用户头像成功');
    }

    const userResult = await query(
      'SELECT id,username,nickname, avatar, phone, create_time, update_time FROM `user` WHERE id = ?',
      [user_id]
    );
    if (userResult.length === 0) return notFound(res, '用户不存在');

    return success(res, userResult[0], '获取用户信息成功');
  } catch (err) {
    return fail(res, '获取用户信息失败：' + err.message);
  }
});

// 修改用户信息
router.post('/update', async (req, res) => {
  try {
    const { user_id, username, nickname, phone, avatar } = req.body;
    if (!user_id) return paramError(res, '用户ID不能为空');
    
    if (username === undefined && nickname === undefined && phone === undefined && avatar === undefined) {
      return paramError(res, '至少需要传入用户名、昵称、手机号、头像中的一个字段');
    }

    // 校验用户名唯一性
    if (username) {
      const usernameResult = await query(
        'SELECT COUNT(*) AS total FROM `user` WHERE username = ? AND id != ?',
        [username, user_id]
      );
      const usernameCount = usernameResult?.[0]?.total ?? 0;
      if (usernameCount > 0) return duplicate(res, '用户名已被占用，请更换');
    }

    // 校验手机号唯一性
    if (phone) {
      const phoneResult = await query(
        'SELECT COUNT(*) AS total FROM `user` WHERE phone = ? AND id != ?',
        [phone, user_id]
      );
      const phoneCount = phoneResult?.[0]?.total ?? 0;
      if (phoneCount > 0) return duplicate(res, '手机号已被绑定，请更换');
    }

    // 构建更新SQL
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
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateParams.push(phone || null);
    }
    if (avatar !== undefined) {
      updateFields.push('avatar = ?');
      updateParams.push(avatar);
    }
    updateFields.push('update_time = NOW()');

    const result = await query(
      `UPDATE \`user\` SET ${updateFields.join(', ')} WHERE id = ?`,
      [...updateParams, user_id]
    );

    if (result.affectedRows === 0) return fail(res, '修改失败：用户不存在或无字段变更');

    const updatedUser = await query(
      'SELECT id, username, nickname, phone, avatar, update_time FROM `user` WHERE id = ?',
      [user_id]
    );

    return success(res, {
      user_id: updatedUser[0].id,
      username: updatedUser[0].username,
      nickname: updatedUser[0].nickname,
      phone: updatedUser[0].phone || '未绑定',
      avatar: updatedUser[0].avatar,
      update_time: updatedUser[0].update_time
    }, '用户信息修改成功！');

  } catch (err) {
    return fail(res, '修改用户信息失败：' + err.message);
  }
});

// 修改密码
router.post('/change-pwd', async (req, res) => {
  try {
    const { user_id, old_pwd, new_pwd } = req.body;
    if (!user_id) return paramError(res, '用户ID不能为空');
    if (!old_pwd) return paramError(res, '原密码不能为空');
    if (!new_pwd) return paramError(res, '新密码不能为空');

    if (new_pwd.length < 6 || new_pwd.length > 20) {
      return paramError(res, '新密码长度必须在6-20位之间');
    }

    const userResult = await query(
      'SELECT id, password FROM `user` WHERE id = ?',
      [user_id]
    );
    const user = userResult?.[0];
    if (!user) return fail(res, '用户不存在');
    if (user.password !== old_pwd) return fail(res, '原密码输入错误');
    if (new_pwd === user.password) return fail(res, '新密码不能和原密码相同');

    const updateResult = await query(
      'UPDATE `user` SET password = ?, update_time = NOW() WHERE id = ?',
      [new_pwd, user_id]
    );

    if (updateResult.affectedRows === 0) return fail(res, '密码修改失败：无数据变更');

    return success(res, {}, '请重新登录');

  } catch (err) {
    console.error('修改密码接口异常：', err);
    return fail(res, '修改密码失败：' + err.message);
  }
});

module.exports = router;