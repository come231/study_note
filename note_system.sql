/*
SQLyog Ultimate v12.08 (64 bit)
MySQL - 8.0.28 : Database - study_note
*********************************************************************
*/

/*!40101 SET NAMES utf8 */;

/*!40101 SET SQL_MODE=''*/;

/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
CREATE DATABASE /*!32312 IF NOT EXISTS*/`study_note` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `study_note`;

/*Table structure for table `note` */

DROP TABLE IF EXISTS `note`;

CREATE TABLE `note` (
  `id` int unsigned NOT NULL AUTO_INCREMENT COMMENT '笔记唯一ID',
  `user_id` int unsigned NOT NULL COMMENT '所属用户ID',
  `category_id` int unsigned DEFAULT NULL COMMENT '所属分类ID',
  `title` varchar(100) NOT NULL COMMENT '笔记标题',
  `content` text NOT NULL COMMENT '笔记内容（语音转文字仅存文本，不上传语音）',
  `privacy_type` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1=仅自己可见 2=公开',
  `level` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1=一般 2=重要 3=非常重要',
  `collect_count` int unsigned NOT NULL DEFAULT '0' COMMENT '笔记被收藏次数',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_category` (`user_id`,`category_id`),
  KEY `idx_user_level` (`user_id`,`level`),
  KEY `idx_privacy` (`privacy_type`),
  KEY `category_id` (`category_id`),
  CONSTRAINT `note_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `note_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `note_category` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='笔记主表';

/*Data for the table `note` */

insert  into `note`(`id`,`user_id`,`category_id`,`title`,`content`,`privacy_type`,`level`,`collect_count`,`create_time`,`update_time`) values (6,1,7,'HashMap底层原理','JDK8：数组+链表+红黑树；负载因子0.75；扩容机制：2倍扩容，重新hash',2,3,0,'2026-03-09 17:05:35','2026-03-11 11:52:26'),(7,1,2,'每日工作复盘','1. 完成接口开发；2. 修复3个bug；3. 对接前端联调；4. 明日计划：单元测试',1,3,0,'2026-03-09 17:05:35','2026-03-11 11:42:03'),(8,1,2,'项目需求会议纪要','需求：用户中心重构；时间节点：本周完成概要设计，下周开始开发；责任人：test01',2,2,0,'2026-03-09 17:05:35','2026-03-11 11:56:54'),(9,1,3,'2026年3月待办','1. 周一：买水果；2. 周三：健身；3. 周五：看电影；4. 周日：整理房间',2,1,0,'2026-03-09 17:05:35','2026-03-11 21:25:28'),(10,1,4,'笔记小程序优化想法','1. 增加标签功能；2. 支持笔记导出PDF；3. 夜间模式；4. 语音速记优化',1,3,1,'2026-03-09 17:05:35','2026-03-11 12:11:08'),(11,2,8,'Requests库使用技巧','1. 伪装请求头：User-Agent、Referer；2. 处理cookie：session对象；3. 超时设置：timeout参数',2,2,2,'2026-03-09 17:05:35','2026-03-09 21:26:08'),(12,2,8,'反爬应对策略','1. 代理IP池；2. 随机UA；3. 验证码识别（打码平台）；4. 延时请求',2,3,0,'2026-03-09 17:05:35','2026-03-09 17:05:35'),(13,2,9,'SQL窗口函数','row_number()：不重复排名；rank()：重复排名；dense_rank()：连续排名；应用场景：TopN查询',2,2,2,'2026-03-09 17:05:35','2026-03-09 21:26:08'),(15,2,2,'数据分析日报','1. 日活：12000（+5%）；2. 留存率：35%（-2%）；3. 转化漏斗：浏览→点击→下单 80%→30%→5%',2,2,0,'2026-03-09 17:05:35','2026-03-10 15:54:23'),(16,2,3,'周末出行计划','周六：公园野餐；周日：图书馆学习Python；晚上整理笔记',2,1,0,'2026-03-09 17:05:35','2026-03-10 15:54:26'),(17,1,5,'Python装饰器详解','装饰器本质：闭包；作用：增强函数功能；语法：@decorator；应用：日志、权限校验',2,3,0,'2026-03-09 17:05:35','2026-03-11 13:23:50'),(18,2,4,'数据可视化工具对比','Matplotlib：灵活但复杂；Seaborn：美观易上手；Pyecharts：交互式图表',2,2,1,'2026-03-09 17:05:35','2026-03-10 15:54:28'),(19,3,10,'政治马原核心考点','唯物辩证法：联系、发展、矛盾；两大特征：普遍联系、永恒发展；三大规律：对立统一、质量互变、否定之否定',2,3,0,'2026-03-09 17:05:35','2026-03-10 15:54:27'),(20,3,10,'英语阅读解题技巧','1. 定位关键词；2. 排除绝对化选项；3. 同义替换；4. 主旨题看首尾段',2,2,0,'2026-03-09 17:05:35','2026-03-10 15:54:36'),(21,3,11,'胸肌训练计划','周一：平板卧推4*12；上斜卧推3*10；蝴蝶机夹胸3*15；每组休息60秒',2,1,0,'2026-03-09 17:05:35','2026-03-10 15:54:29'),(22,3,11,'饮食打卡','早餐：鸡蛋+牛奶+全麦面包；午餐：鸡胸肉+西兰花+糙米饭；晚餐：鱼肉+蔬菜沙拉',2,1,0,'2026-03-09 17:05:35','2026-03-10 15:54:31'),(23,3,3,'考研每日计划','早上7:00-9:00：英语；9:30-12:00：专业课；下午2:00-5:00：政治；晚上6:00-9:00：刷题',2,3,0,'2026-03-09 17:05:35','2026-03-10 15:54:30'),(44,1,1,'Java学习','Java学习',1,2,1,'2026-03-11 08:47:01','2026-03-11 11:51:57'),(45,1,2,'Java编程基础','Java',1,1,1,'2026-03-11 08:47:45','2026-03-11 11:51:47'),(48,1,16,'明日待办','早起',2,3,1,'2026-03-11 11:53:06','2026-03-12 14:38:13');

/*Table structure for table `note_category` */

DROP TABLE IF EXISTS `note_category`;

CREATE TABLE `note_category` (
  `id` int unsigned NOT NULL AUTO_INCREMENT COMMENT '分类唯一ID',
  `category_name` varchar(50) NOT NULL COMMENT '分类名称',
  `description` varchar(255) DEFAULT NULL COMMENT '分类描述',
  `sort` tinyint NOT NULL DEFAULT '0' COMMENT '排序优先级（数值越小越靠前）',
  `type` tinyint(1) NOT NULL DEFAULT '0' COMMENT '0=系统分类 1=用户自定义分类',
  `user_id` int unsigned DEFAULT NULL COMMENT '自定义分类归属用户（系统分类为NULL）',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_type` (`user_id`,`type`),
  CONSTRAINT `note_category_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='笔记分类表';

/*Data for the table `note_category` */

insert  into `note_category`(`id`,`category_name`,`description`,`sort`,`type`,`user_id`,`create_time`,`update_time`) values (1,'学习笔记','课程/自学内容记录',1,0,NULL,'2026-03-09 17:05:35','2026-03-09 17:05:35'),(2,'工作记录','任务/会议纪要',2,0,NULL,'2026-03-09 17:05:35','2026-03-09 17:05:35'),(3,'生活杂记','日常感悟/待办',3,0,NULL,'2026-03-09 17:05:35','2026-03-09 17:05:35'),(4,'灵感创意','创意/想法记录',4,0,NULL,'2026-03-09 17:05:35','2026-03-09 17:05:35'),(5,'其它','自定义分类公开笔记兜底',5,0,NULL,'2026-03-09 17:05:35','2026-03-09 17:05:35'),(7,'前端开发','HTML/CSS/JS/Vue',2,1,1,'2026-03-09 17:05:35','2026-03-09 17:05:35'),(8,'面试刷题','算法/编程题记录',3,1,1,'2026-03-09 17:05:35','2026-03-09 17:05:35'),(9,'Python爬虫','爬虫实战/反爬技巧',1,1,2,'2026-03-09 17:05:35','2026-03-09 17:05:35'),(10,'数据分析','Excel/SQL/可视化',2,1,2,'2026-03-09 17:05:35','2026-03-09 17:05:35'),(11,'考研笔记','政治/英语/专业课',1,1,3,'2026-03-09 17:05:35','2026-03-09 17:05:35'),(12,'健身计划','每日训练/饮食记录',2,1,3,'2026-03-09 17:05:35','2026-03-09 17:05:35'),(16,'日记','记录日常',0,1,1,'2026-03-10 21:42:26','2026-03-10 21:42:26'),(17,'微信小程序','微信小程序',0,1,1,'2026-03-11 11:01:16','2026-03-11 11:01:16'),(19,'后台','待办',0,1,1,'2026-03-11 13:14:09','2026-03-11 13:14:09'),(20,'今日','今日',0,1,1,'2026-03-12 14:38:59','2026-03-12 14:38:59');

/*Table structure for table `note_collect` */

DROP TABLE IF EXISTS `note_collect`;

CREATE TABLE `note_collect` (
  `id` int unsigned NOT NULL AUTO_INCREMENT COMMENT '收藏记录ID',
  `user_id` int unsigned NOT NULL COMMENT '收藏者ID',
  `note_id` int unsigned NOT NULL COMMENT '被收藏笔记ID',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_note` (`user_id`,`note_id`) COMMENT '防止重复收藏',
  KEY `idx_user_create` (`user_id`,`create_time`),
  KEY `note_id` (`note_id`),
  CONSTRAINT `note_collect_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `note_collect_ibfk_2` FOREIGN KEY (`note_id`) REFERENCES `note` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='笔记收藏表';

/*Data for the table `note_collect` */

insert  into `note_collect`(`id`,`user_id`,`note_id`,`create_time`) values (6,3,11,'2026-03-09 17:05:35'),(7,3,13,'2026-03-09 17:05:35'),(8,1,11,'2026-03-09 17:05:35'),(9,1,13,'2026-03-09 17:05:35'),(10,2,18,'2026-03-09 17:05:35'),(16,1,10,'2026-03-11 11:01:48'),(17,1,45,'2026-03-11 11:51:47'),(18,1,44,'2026-03-11 11:51:57'),(26,1,48,'2026-03-12 14:38:13');

/*Table structure for table `note_media` */

DROP TABLE IF EXISTS `note_media`;

CREATE TABLE `note_media` (
  `id` int unsigned NOT NULL AUTO_INCREMENT COMMENT '多媒体ID',
  `note_id` int unsigned NOT NULL COMMENT '关联笔记ID',
  `media_type` tinyint(1) NOT NULL COMMENT '1=图片 2=语音',
  `media_url` varchar(255) DEFAULT NULL COMMENT '仅存示例URL，不上传真实文件',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_note_id` (`note_id`),
  CONSTRAINT `note_media_ibfk_1` FOREIGN KEY (`note_id`) REFERENCES `note` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='笔记多媒体表（仅演示）';

/*Data for the table `note_media` */

insert  into `note_media`(`id`,`note_id`,`media_type`,`media_url`,`create_time`) values (3,11,1,'https://example.com/python_spider.jpg','2026-03-09 17:05:35'),(4,44,1,'/static/image/user/test02.jpg','2026-03-11 08:47:01'),(5,45,1,'/static/image/user/test01.jpg','2026-03-11 08:47:45'),(10,10,1,'http://tmp/XambZUopxKWCad332b7be57eaccab74f510ff56eef94.jpg','2026-03-11 11:02:54'),(11,10,2,'http://tmp/AsLt6HWlU77Sf36c52a0f9ddd6db02f38ab5c11d5839.mp3','2026-03-11 11:02:54'),(12,9,1,'http://tmp/k0e7pOoXpSjC464a34ec24ef3e0bb41415dc0b3a0c3a.jpg','2026-03-11 21:23:07');

/*Table structure for table `user` */

DROP TABLE IF EXISTS `user`;

CREATE TABLE `user` (
  `id` int unsigned NOT NULL AUTO_INCREMENT COMMENT '用户唯一ID',
  `username` varchar(50) NOT NULL COMMENT '登录账号（唯一）',
  `password` varchar(100) NOT NULL COMMENT '密码（课程设计可存明文/简单加密）',
  `wx_openid` varchar(100) DEFAULT NULL COMMENT '微信登录标识（仅示意，不实际对接）',
  `nickname` varchar(50) DEFAULT NULL COMMENT '用户昵称',
  `avatar` varchar(255) DEFAULT NULL COMMENT '头像URL（仅存示例地址，不上传）',
  `phone` varchar(20) DEFAULT NULL COMMENT '手机号（可选）',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  UNIQUE KEY `uk_wx_openid` (`wx_openid`),
  UNIQUE KEY `uk_phone` (`phone`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户表';

/*Data for the table `user` */

insert  into `user`(`id`,`username`,`password`,`wx_openid`,`nickname`,`avatar`,`phone`,`create_time`,`update_time`) values (1,'test01','123456',NULL,'测试用户','/static/image/user/test01.jpg','13645699874','2026-03-09 17:05:35','2026-03-12 09:16:58'),(2,'test02','123456',NULL,'测试用户02','/static/image/user/test02.jpg',NULL,'2026-03-09 17:05:35','2026-03-10 15:03:50'),(3,'test03','123456',NULL,'测试03','/static/image/user/test03.png',NULL,'2026-03-09 17:05:35','2026-03-11 17:19:05'),(4,'test04','123456',NULL,'张三','https://example.com/default-avatar.jpg',NULL,'2026-03-10 11:22:37','2026-03-10 11:22:37'),(5,'test05','123456',NULL,'李四','https://example.com/default-avatar.jpg',NULL,'2026-03-10 11:36:16','2026-03-10 11:36:16'),(7,'test06','123456',NULL,'麻子','https://example.com/default-avatar.jpg',NULL,'2026-03-10 14:36:34','2026-03-10 14:36:34');

/* Trigger structure for table `note_collect` */

DELIMITER $$

/*!50003 DROP TRIGGER*//*!50032 IF EXISTS */ /*!50003 `tr_note_collect_insert` */$$

/*!50003 CREATE */ /*!50017 DEFINER = 'root'@'localhost' */ /*!50003 TRIGGER `tr_note_collect_insert` AFTER INSERT ON `note_collect` FOR EACH ROW BEGIN
    UPDATE `note` SET collect_count = collect_count + 1 WHERE id = NEW.note_id;
END */$$


DELIMITER ;

/* Trigger structure for table `note_collect` */

DELIMITER $$

/*!50003 DROP TRIGGER*//*!50032 IF EXISTS */ /*!50003 `tr_note_collect_delete` */$$

/*!50003 CREATE */ /*!50017 DEFINER = 'root'@'localhost' */ /*!50003 TRIGGER `tr_note_collect_delete` AFTER DELETE ON `note_collect` FOR EACH ROW BEGIN
    UPDATE `note` SET collect_count = collect_count - 1 WHERE id = OLD.note_id AND collect_count > 0;
END */$$


DELIMITER ;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
