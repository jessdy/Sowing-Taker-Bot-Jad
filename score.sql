CREATE TABLE `score` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `project` varchar(255) DEFAULT NULL,
  `account` varchar(255) DEFAULT NULL,
  `wallet` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `score` varchar(255) DEFAULT NULL,
  `count_date` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_account` (`account`),
  KEY `idx_project` (`project`)
) ENGINE=InnoDB AUTO_INCREMENT=1920 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;