const express = require('express');
const router = express.Router();
const { query } = require('../db/db_config');
const { success, paramError, notFound, fail } = require('../utils/response');

// 获取分类列表
router.get('/list', async (req, res) => {
  try {
    const { user_id, type } = req.query;
    let results;
    if (type == 0) {
      results = await query('SELECT * FROM `note_category` WHERE type = 0 ORDER BY sort ASC');
    } else {
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

// 创建自定义分类
router.post('/add', async (req, res) => {
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

// 修改分类
router.post('/update', async (req, res) => {
  try {
    const { id, category_name, sort, description } = req.body;
    if (!id) return paramError(res, '分类ID不能为空');
    
    if (category_name === undefined && sort === undefined && description === undefined) {
      return paramError(res, '至少需要传入名称、优先级、描述中的一个字段');
    }

    // 校验优先级
    let sortNum = null;
    if (sort !== undefined) {
      sortNum = parseInt(sort);
      if (isNaN(sortNum) || sortNum < 0) {
        return paramError(res, '优先级必须是大于等于0的整数');
      }
    }

    // 检查分类是否存在及是否为系统分类
    const cateResult = await query('SELECT type FROM `note_category` WHERE id = ?', [id]);
    if (cateResult.length === 0) return notFound(res, '分类不存在');
    if (cateResult[0].type === 0) return fail(res, '系统分类不可修改', 403);

    // 构建更新SQL
    let updateFields = [];
    let updateParams = [];
    if (category_name !== undefined) {
      updateFields.push('category_name= ?');
      updateParams.push(category_name);
    }
    if (sort !== undefined) {
      updateFields.push('sort = ?');
      updateParams.push(sortNum);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateParams.push(description || '');
    }

    const result = await query(
      `UPDATE \`note_category\` SET ${updateFields.join(', ')} WHERE id = ?`,
      [...updateParams, id]
    );

    if (result.affectedRows === 0) return fail(res, '修改分类失败（无字段变更或分类不存在）');

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

// 批量删除分类
router.post('/delete', async (req, res) => {
  try {
    const { category_ids, user_id } = req.body;
    if (!category_ids || !Array.isArray(category_ids) || category_ids.length === 0) {
      return paramError(res, '分类ID数组不能为空');
    }
    if (!user_id) return paramError(res, '用户ID不能为空');

    // 校验分类是否存在且为自定义分类
    const placeholders = category_ids.map(() => '?').join(',');
    const cateResult = await query(
      `SELECT id, type FROM \`note_category\` WHERE id IN (${placeholders}) AND user_id = ?`,
      [...category_ids, user_id]
    );

    const validCategoryIds = cateResult
      .filter(item => item.type === 1)
      .map(item => item.id);

    if (validCategoryIds.length === 0) {
      return fail(res, '无可用的自定义分类可删除（系统分类不可删或分类不存在）', 403);
    }

    // 批量迁移笔记到"其它"分类
    const migratePlaceholders = validCategoryIds.map(() => '?').join(',');
    await query(
      `UPDATE \`note\` SET category_id = 5 WHERE category_id IN (${migratePlaceholders}) AND user_id = ?`,
      [...validCategoryIds, user_id]
    );

    // 批量删除分类
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

module.exports = router;