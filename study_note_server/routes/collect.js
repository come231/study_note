const express = require('express');
const router = express.Router();
const { query } = require('../db/db_config');
const { success, paramError, notFound, fail, duplicate } = require('../utils/response');

// 收藏笔记
router.post('/add', async (req, res) => {
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

// 取消收藏
router.post('/cancel', async (req, res) => {
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

// 检查是否收藏
router.get('/check', async (req, res) => {
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

// 获取收藏列表
router.get('/list', async (req, res) => {
  try {
    const { user_id, page, pageSize } = req.query;
    const userIdNum = Number(user_id);
    if (!user_id || isNaN(userIdNum) || userIdNum < 1) {
      return paramError(res, '用户ID必须是大于0的整数');
    }
    const userIdStr = userIdNum.toString();

    const currentPage = parseInt(page) || 1;
    const currentPageSize = parseInt(pageSize) || 10;
    const finalPage = currentPage < 1 ? 1 : currentPage;
    const finalPageSize = currentPageSize < 1 ? 10 : (currentPageSize > 50 ? 50 : currentPageSize);
    const offset = Math.max((finalPage - 1) * finalPageSize, 0);

    const listSql = `
      SELECT 
        nc.create_time AS collect_time,
        n.*,
        u.nickname AS author_nickname, u.avatar,
        (SELECT COUNT(*) FROM \`note_collect\` WHERE note_id = n.id) AS collect_count
      FROM \`note_collect\` nc 
      LEFT JOIN \`note\` n ON nc.note_id = n.id 
      LEFT JOIN \`user\` u ON n.user_id = u.id 
      WHERE nc.user_id = ? 
      ORDER BY nc.create_time DESC
      LIMIT ? OFFSET ?
    `;
    const countSql = `SELECT COUNT(*) AS total FROM \`note_collect\` WHERE user_id = ?`;

    const listParams = [
      userIdStr,
      finalPageSize.toString(),
      offset.toString()
    ];
    const countParams = [userIdStr];

    const countResult = await query(countSql, countParams);
    const total = countResult?.[0]?.total ?? 0;
    const collectList = await query(listSql, listParams);

    const totalPages = Math.ceil(total / finalPageSize) || 0;
    const paginationData = {
      list: collectList,
      pagination: {
        page: finalPage,
        pageSize: finalPageSize,
        total: total,
        totalPages: totalPages,
        hasMore: finalPage < totalPages
      }
    };

    return success(res, paginationData, "获取收藏列表分页数据成功！");

  } catch (err) {
    console.error('收藏列表分页查询失败：', err);
    return fail(res, '分页查询失败：' + err.message);
  }
});

module.exports = router;