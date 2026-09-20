const express = require('express');
const router = express.Router();
const { query, getConnection } = require('../db/db_config');
const { success, paramError, notFound, fail } = require('../utils/response');

// ========== 原有接口保持不变 ==========
// 获取公开笔记列表
router.get('/public', async (req, res) => {
  try {
    const { category_id, page, pageSize } = req.query;
    const currentPage = parseInt(page) || 1;
    const currentPageSize = parseInt(pageSize) || 10;
    const finalPage = currentPage < 1 ? 1 : currentPage;
    const finalPageSize = currentPageSize < 1 ? 10 : (currentPageSize > 50 ? 50 : currentPageSize);
    const offset = Math.max((finalPage - 1) * finalPageSize, 0);

    let cateIdStr = category_id?.toString() || '0';
    let cateIdNum = Number(category_id);
    const isAllCategory = !category_id || isNaN(cateIdNum) || cateIdNum === 0;
    if (!isAllCategory && (cateIdNum < 1)) {
      return paramError(res, '分类ID必须是大于0的整数');
    }

    let listSql = '';
    let countSql = '';
    let listParams = [];
    let countParams = [];

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
      listParams = [finalPageSize.toString(), offset.toString()];
    } else if (parseInt(category_id) < 5) {
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
      listParams = [cateIdStr, finalPageSize.toString(), offset.toString()];
      countParams = [cateIdStr];
    } else {
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
      listParams = [4, finalPageSize.toString(), offset.toString()];
      countParams = [5];
    }

    const countResult = await query(countSql, countParams);
    const total = countResult?.[0]?.total ?? 0;
    const noteList = await query(listSql, listParams);

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
    return fail(res, '分页查询失败：' + err.message);
  }
});

// 获取个人笔记列表
router.get('/list', async (req, res) => {
  try {
    const { user_id, category_id, level, privacy, page, pageSize } = req.query;
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

    const cateIdNum = Number(category_id);
    const hasCategory = !isNaN(cateIdNum) && cateIdNum > 0;
    const cateIdStr = hasCategory ? cateIdNum.toString() : '';

    const levelNum = Number(level);
    const hasLevel = !isNaN(levelNum) && [1, 2, 3].includes(levelNum);
    const levelStr = hasLevel ? levelNum.toString() : '';

    const privacyNum = Number(privacy);
    const hasPrivacy = !isNaN(privacyNum) && [1, 2].includes(privacyNum);
    const privacyStr = hasPrivacy ? privacyNum.toString() : '';

    let listSql = `SELECT n.*,c.category_name FROM note n,note_category c WHERE category_id=c.id and n.user_id = ?`;
    let countSql = `SELECT COUNT(*) AS total FROM \`note\` WHERE user_id = ?`;
    let listParams = [userIdStr];
    let countParams = [userIdStr];

    if (hasCategory) {
      listSql += ' AND category_id = ?';
      listParams.push(cateIdStr);
      countSql += ' AND category_id = ?';
      countParams.push(cateIdStr);
    }

    if (hasLevel) {
      listSql += ' AND level = ?';
      listParams.push(levelStr);
      countSql += ' AND level = ?';
      countParams.push(levelStr);
    }

    if (hasPrivacy) {
      listSql += ' AND privacy_type = ?';
      listParams.push(privacyStr);
      countSql += ' AND privacy_type = ?';
      countParams.push(privacyStr);
    }

    listSql += ' ORDER BY n.create_time DESC LIMIT ? OFFSET ?';
    listParams.push(finalPageSize.toString(), offset.toString());

    const countResult = await query(countSql, countParams);
    const total = countResult?.[0]?.total ?? 0;
    const noteList = await query(listSql, listParams);

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

    return success(res, paginationData, "获取个人笔记分页数据成功！");

  } catch (err) {
    console.error('个人笔记分页查询失败：', err);
    return fail(res, '分页查询失败：' + err.message);
  }
});

// 个人笔记标题模糊查询
router.get('/list/by-title', async (req, res) => {
  try {
    const { user_id, title, category_id, level, privacy, page, pageSize } = req.query;
    const userIdNum = Number(user_id);
    if (!user_id || isNaN(userIdNum) || userIdNum < 1) {
      return paramError(res, '用户ID必须是大于0的整数');
    }
    const userIdStr = userIdNum.toString();

    if (!title || title.trim() === '') {
      return paramError(res, '标题关键词不能为空');
    }
    const titleKeyword = `%${title.trim()}%`;

    const currentPage = parseInt(page) || 1;
    const currentPageSize = parseInt(pageSize) || 10;
    const finalPage = currentPage < 1 ? 1 : currentPage;
    const finalPageSize = currentPageSize < 1 ? 10 : (currentPageSize > 50 ? 50 : currentPageSize);
    const offset = Math.max((finalPage - 1) * finalPageSize, 0);

    const cateIdNum = Number(category_id);
    const hasCategory = !isNaN(cateIdNum) && cateIdNum > 0;
    const cateIdStr = hasCategory ? cateIdNum.toString() : '';

    const levelNum = Number(level);
    const hasLevel = !isNaN(levelNum) && [1, 2, 3].includes(levelNum);
    const levelStr = hasLevel ? levelNum.toString() : '';

    const privacyNum = Number(privacy);
    const hasPrivacy = !isNaN(privacyNum) && [1, 2].includes(privacyNum);
    const privacyStr = hasPrivacy ? privacyNum.toString() : '';

    let listSql = `
      SELECT n.*, c.category_name 
      FROM note n 
      LEFT JOIN note_category c ON n.category_id = c.id 
      WHERE n.user_id = ? AND n.title LIKE ?
    `;
    let countSql = `SELECT COUNT(*) AS total FROM \`note\` WHERE user_id = ? AND title LIKE ?`;
    let listParams = [userIdStr, titleKeyword];
    let countParams = [userIdStr, titleKeyword];

    if (hasCategory) {
      listSql += ' AND n.category_id = ?';
      listParams.push(cateIdStr);
      countSql += ' AND category_id = ?';
      countParams.push(cateIdStr);
    }

    if (hasLevel) {
      listSql += ' AND n.level = ?';
      listParams.push(levelStr);
      countSql += ' AND level = ?';
      countParams.push(levelStr);
    }

    if (hasPrivacy) {
      listSql += ' AND n.privacy_type = ?';
      listParams.push(privacyStr);
      countSql += ' AND privacy_type = ?';
      countParams.push(privacyStr);
    }

    listSql += ' ORDER BY n.create_time DESC LIMIT ? OFFSET ?';
    listParams.push(finalPageSize.toString(), offset.toString());

    const countResult = await query(countSql, countParams);
    const total = countResult?.[0]?.total ?? 0;
    const noteList = await query(listSql, listParams);

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

    return success(res, paginationData, "个人笔记标题模糊查询成功！");

  } catch (err) {
    console.error('个人笔记标题查询失败：', err);
    return fail(res, '标题查询失败：' + err.message);
  }
});

// 公开笔记标题模糊查询
router.get('/public/by-title', async (req, res) => {
  try {
    const { title, category_id, page, pageSize } = req.query;
    if (!title || title.trim() === '') {
      return paramError(res, '标题关键词不能为空');
    }
    const titleKeyword = `%${title.trim()}%`;

    const currentPage = parseInt(page) || 1;
    const currentPageSize = parseInt(pageSize) || 10;
    const finalPage = currentPage < 1 ? 1 : currentPage;
    const finalPageSize = currentPageSize < 1 ? 10 : (currentPageSize > 50 ? 50 : currentPageSize);
    const offset = Math.max((finalPage - 1) * finalPageSize, 0);

    let cateIdStr = category_id?.toString() || '0';
    let cateIdNum = Number(category_id);
    const isAllCategory = !category_id || isNaN(cateIdNum) || cateIdNum === 0;
    if (!isAllCategory && (cateIdNum < 1)) {
      return paramError(res, '分类ID必须是大于0的整数');
    }

    let listSql = '';
    let countSql = '';
    let listParams = [titleKeyword];
    let countParams = [titleKeyword];

    if (isAllCategory) {
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

    const [countResult] = await query(countSql, countParams);
    const total = countResult?.[0]?.total ?? 0;
    const totalPages = Math.ceil(total / finalPageSize) || 0;
    const listResult = await query(listSql, listParams);

    const paginationData = {
      list: listResult || [],
      pagination: {
        page: finalPage,
        pageSize: finalPageSize,
        total,
        totalPages,
        hasMore: finalPage < totalPages
      }
    };

    return success(res, paginationData, "笔记标题模糊查询成功！", 200);
  } catch (error) {
    console.error('标题模糊查询失败：', error);
    return fail(res, '标题查询失败：' + error.message, 500, null, 500);
  }
});

// 公开笔记作者昵称模糊查询
router.get('/public/by-author', async (req, res) => {
  try {
    const { nickname, category_id, page, pageSize } = req.query;
    if (!nickname || nickname.trim() === '') {
      return paramError(res, '作者昵称关键词不能为空');
    }
    const nicknameKeyword = `%${nickname.trim()}%`;

    const currentPage = parseInt(page) || 1;
    const currentPageSize = parseInt(pageSize) || 10;
    const finalPage = currentPage < 1 ? 1 : currentPage;
    const finalPageSize = currentPageSize < 1 ? 10 : (currentPageSize > 50 ? 50 : currentPageSize);
    const offset = Math.max((finalPage - 1) * finalPageSize, 0);

    let cateIdStr = category_id?.toString() || '0';
    let cateIdNum = Number(category_id);
    const isAllCategory = !category_id || isNaN(cateIdNum) || cateIdNum === 0;
    if (!isAllCategory && (cateIdNum < 1)) {
      return paramError(res, '分类ID必须是大于0的整数');
    }

    let listSql = '';
    let countSql = '';
    let listParams = [nicknameKeyword];
    let countParams = [nicknameKeyword];

    if (isAllCategory) {
      listSql = `
        SELECT n.*, u.nickname, c.category_name, u.avatar
        FROM \`note\` n 
        INNER JOIN \`user\` u ON n.user_id = u.id 
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

    const [countResult] = await query(countSql, countParams);
    const total = countResult?.[0]?.total ?? 0;
    const totalPages = Math.ceil(total / finalPageSize) || 0;
    const listResult = await query(listSql, listParams);

    const data = {
      list: listResult || [],
      pagination: {
        page: finalPage,
        pageSize: finalPageSize,
        total,
        totalPages,
        hasMore: finalPage < totalPages
      }
    };

    return success(res, data, "根据作者名称查询成功", 200);
  } catch (error) {
    console.error('作者昵称查询失败：', error);
    return fail(res, '作者昵称查询失败：' + error.message, 500, null, 500);
  }
});

// 获取笔记详情
router.get('/detail', async (req, res) => {
  try {
    const { note_id, user_id } = req.query;
    if (!note_id) return paramError(res, '笔记ID不能为空');

    const noteResult = await query(
      'select n.*,c.`category_name` from `note` n,`note_category` c where n.`category_id`=c.`id` and n.`id` = ?', 
      [note_id]
    );
    if (noteResult.length === 0) return notFound(res, '笔记不存在');

    const note = noteResult[0];
    const mediaResult = await query(
      'SELECT id, media_type, media_url FROM `note_media` WHERE note_id = ? ORDER BY create_time DESC',
      [note_id]
    );

    const mediaData = {
      images: [],
      voices: [],
      allMedia: mediaResult
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

    const noteDetail = {
      ...note,
      ...mediaData
    };

    return success(res, noteDetail, '获取笔记详情成功');
  } catch (err) {
    return fail(res, '获取笔记详情失败：' + err.message);
  }
});

// 新建笔记
router.post('/add', async (req, res) => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    const { user_id, title, content, category_id, level, privacy_type, mediaList = [] } = req.body;
    if (!user_id) return paramError(res, '用户ID不能为空');
    if (!title) return paramError(res, '笔记标题不能为空');
    if (!content) return paramError(res, '笔记内容不能为空');
    if (!category_id) return paramError(res, '分类ID不能为空');
    if (!level) return paramError(res, '重要程度不能为空');
    if (!privacy_type) return paramError(res, '隐私类型不能为空');

    const [noteResult] = await connection.query(
      'INSERT INTO `note` (user_id, title, content, category_id,  privacy_type,level, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [user_id, title, content, category_id, privacy_type, level]
    );
    const noteId = noteResult.insertId;

    if (mediaList.length > 0) {
      const validMediaList = mediaList.filter(item => 
        item.media_type && [1, 2].includes(item.media_type) && item.media_url
      );
      
      if (validMediaList.length > 0) {
        const mediaValues = validMediaList.map(item => [
          noteId,
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
    return success(res, { note_id: noteId, title }, '新建笔记成功');
  } catch (err) {
    await connection.rollback();
    return fail(res, '新建笔记失败：' + err.message);
  } finally {
    connection.release();
  }
});

// 修改笔记
router.post('/update', async (req, res) => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    const { 
      note_id, user_id, title, content, category_id, level, privacy_type,
      deleteMediaIds = [],
      addMediaList = []
    } = req.body;

    if (!note_id) return paramError(res, '笔记ID不能为空');
    if (!user_id) return paramError(res, '用户ID不能为空');

    const [noteResult] = await connection.query('SELECT user_id FROM `note` WHERE id = ?', [note_id]);
    if (noteResult.length === 0) return notFound(res, '笔记不存在');
    if (noteResult[0].user_id != user_id) return fail(res, '无权限修改该笔记', 403);

    const updateResult = await connection.query(
      'UPDATE `note` SET title = ?, content = ?, category_id = ?, privacy_type = ?,level = ?, update_time = NOW() WHERE id = ?',
      [title, content, category_id, privacy_type, level, note_id]
    );
    if (updateResult[0].affectedRows === 0) {
      await connection.rollback();
      return fail(res, '修改笔记失败');
    }

    if (deleteMediaIds.length > 0) {
      const validMediaIds = deleteMediaIds.filter(id => !isNaN(id) && id > 0);
      if (validMediaIds.length > 0) {
        const placeholders = validMediaIds.map(() => '?').join(',');
        await connection.query(
          `DELETE FROM \`note_media\` WHERE id IN (${placeholders}) AND note_id = ?`,
          [...validMediaIds, note_id]
        );
      }
    }

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

// ========== 新增/修改的核心接口 ==========

/**
 * 批量删除笔记接口
 * 请求参数：
 * - user_id: 必选，用户ID
 * - note_ids: 必选，笔记ID数组（如 [1,2,3]）
 */
router.post('/batch/delete', async (req, res) => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    const { user_id, note_ids } = req.body;
    
    // 参数校验
    if (!user_id) return paramError(res, '用户ID不能为空');
    const userIdNum = Number(user_id);
    if (isNaN(userIdNum) || userIdNum < 1) {
      return paramError(res, '用户ID必须是大于0的整数');
    }
    
    if (!note_ids || !Array.isArray(note_ids) || note_ids.length === 0) {
      return paramError(res, '笔记ID数组不能为空，且必须是数组格式');
    }
    
    // 过滤有效笔记ID
    const validNoteIds = note_ids.filter(id => !isNaN(id) && id > 0);
    if (validNoteIds.length === 0) {
      return paramError(res, '笔记ID必须是大于0的整数');
    }

    // 校验笔记归属权
    const placeholders = validNoteIds.map(() => '?').join(',');
    const [checkResult] = await connection.query(
      `SELECT id FROM \`note\` WHERE id IN (${placeholders}) AND user_id = ?`,
      [...validNoteIds, userIdNum]
    );
    
    const ownedNoteIds = checkResult.map(item => item.id);
    if (ownedNoteIds.length === 0) {
      await connection.rollback();
      return fail(res, '无权限删除所选笔记', 403);
    }

    // 先删除关联的媒体文件
    await connection.query(
      `DELETE FROM \`note_media\` WHERE note_id IN (${placeholders})`,
      ownedNoteIds
    );

    // 批量删除笔记
    const deleteResult = await connection.query(
      `DELETE FROM \`note\` WHERE id IN (${placeholders}) AND user_id = ?`,
      [...ownedNoteIds, userIdNum]
    );

    await connection.commit();

    return success(res, {
      deletedCount: deleteResult[0].affectedRows,
      deletedIds: ownedNoteIds
    }, `成功删除${deleteResult[0].affectedRows}条笔记`);

  } catch (err) {
    await connection.rollback();
    console.error('批量删除笔记失败：', err);
    return fail(res, '批量删除笔记失败：' + err.message);
  } finally {
    connection.release();
  }
});

/**
 * 批量移动笔记到指定分类接口
 * 请求参数：
 * - user_id: 必选，用户ID
 * - note_ids: 必选，笔记ID数组
 * - target_category_id: 必选，目标分类ID
 */
router.post('/batch/move-category', async (req, res) => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    const { user_id, note_ids, target_category_id } = req.body;
    
    // 参数校验
    if (!user_id) return paramError(res, '用户ID不能为空');
    const userIdNum = Number(user_id);
    if (isNaN(userIdNum) || userIdNum < 1) {
      return paramError(res, '用户ID必须是大于0的整数');
    }
    
    if (!note_ids || !Array.isArray(note_ids) || note_ids.length === 0) {
      return paramError(res, '笔记ID数组不能为空，且必须是数组格式');
    }
    
    if (!target_category_id) return paramError(res, '目标分类ID不能为空');
    const targetCateIdNum = Number(target_category_id);
    if (isNaN(targetCateIdNum) || targetCateIdNum < 1) {
      return paramError(res, '目标分类ID必须是大于0的整数');
    }

    // 过滤有效笔记ID
    const validNoteIds = note_ids.filter(id => !isNaN(id) && id > 0);
    if (validNoteIds.length === 0) {
      return paramError(res, '笔记ID必须是大于0的整数');
    }

    // 校验目标分类是否存在
    const [cateCheck] = await connection.query(
      'SELECT id FROM `note_category` WHERE id = ? AND (user_id = ? OR type = 0)',
      [targetCateIdNum, userIdNum]
    );
    if (cateCheck.length === 0) {
      await connection.rollback();
      return notFound(res, '目标分类不存在');
    }

    // 校验笔记归属权
    const placeholders = validNoteIds.map(() => '?').join(',');
    const [noteCheck] = await connection.query(
      `SELECT id FROM \`note\` WHERE id IN (${placeholders}) AND user_id = ?`,
      [...validNoteIds, userIdNum]
    );
    
    const ownedNoteIds = noteCheck.map(item => item.id);
    if (ownedNoteIds.length === 0) {
      await connection.rollback();
      return fail(res, '无权限移动所选笔记', 403);
    }

    // 批量更新分类ID
    const updateResult = await connection.query(
      `UPDATE \`note\` SET category_id = ?, update_time = NOW() WHERE id IN (${placeholders}) AND user_id = ?`,
      [targetCateIdNum, ...ownedNoteIds, userIdNum]
    );

    await connection.commit();

    return success(res, {
      movedCount: updateResult[0].affectedRows,
      movedIds: ownedNoteIds,
      targetCategoryId: targetCateIdNum
    }, `成功将${updateResult[0].affectedRows}条笔记移动到指定分类`);

  } catch (err) {
    await connection.rollback();
    console.error('批量移动笔记分类失败：', err);
    return fail(res, '批量移动笔记分类失败：' + err.message);
  } finally {
    connection.release();
  }
});

module.exports = router;