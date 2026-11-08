-- 公开 SQL 模板：库表、群名、策略和渠道已替换为示例标识。无查询结果或凭证。
-- 保留原查询逻辑；执行前需适配自己的数据结构和 SQL 方言。
-- 用户消息中的 SQL；仅去除 Markdown 对下划线、句点和注释符的转义。
WITH jiac AS
(
SELECT add_date
,CONCAT(add_date,' ',add_time) AS add_time
,union_id
,CASE WHEN channel_name IN ('示例渠道-弹窗A','示例渠道-弹窗B') THEN '小程序弹窗'
WHEN channel_name IN ('示例渠道-APP新人专区') THEN 'app新人专区'
WHEN channel_name IN ('示例渠道-小程序新人专区') THEN '小程序新人专区'
ELSE 'app资源位' END AS 资源位
FROM demo_dw.private_user_events
WHERE dp = CURRENT_DATE() - 1
AND data_type = 1
AND source <> 3
AND union_id IS NOT NULL
AND union_id <> ''
AND channel_name IN ('示例渠道-弹窗A','示例渠道-弹窗B','示例渠道-APP新人专区','示例渠道-小程序新人专区','示例渠道-APP资源位')
)
,date_list AS
(
SELECT /*+ MAPJOIN(r) */ a.`date`,r.资源位
FROM demo_dw.calendar a
CROSS JOIN (
SELECT '小程序弹窗' AS 资源位
UNION ALL SELECT 'app新人专区' AS 资源位
UNION ALL SELECT '小程序新人专区' AS 资源位
UNION ALL SELECT 'app资源位' AS 资源位
UNION ALL SELECT '汇总' AS 资源位
) r
WHERE a.date >= '2025-03-13' AND a.date <= current_date() - 1
)
,result AS
(
SELECT a.加C日期,COALESCE(a.资源位,'汇总') AS 资源位
,COUNT(DISTINCT a.union_id) AS 加C用户数
,COUNT(DISTINCT IF(a.进群日期 IS NOT NULL,a.union_id,NULL)) AS 进群用户数
,COUNT(DISTINCT IF(a.进群日期 IS NOT NULL AND is_valid = 1,a.union_id,NULL)) AS 进群留存用户数
,COUNT(DISTINCT IF(a.进群日期 IS NOT NULL AND is_valid = 1,a.union_id,NULL)) / NULLIF(COUNT(DISTINCT IF(a.进群日期 IS NOT NULL,a.union_id,NULL)),0) AS 进群留存率
,COUNT(DISTINCT IF(a.进群日期 = a.加C日期,a.union_id,NULL)) AS 加C当日进群用户数
,COUNT(DISTINCT IF(a.进群日期 IS NOT NULL,a.union_id,NULL)) / NULLIF(COUNT(DISTINCT a.union_id),0) AS 进群率
,COUNT(DISTINCT IF(a.进群日期 = a.加C日期,a.union_id,NULL)) / NULLIF(COUNT(DISTINCT a.union_id),0) AS 加C当日进群率
FROM (
SELECT t.add_date AS 加C日期,t.资源位,t.union_id,b.add_date AS 进群日期,b.is_valid
,ROW_NUMBER() OVER (PARTITION BY t.union_id ORDER BY b.add_time ASC) AS group_rn
FROM jiac t
LEFT JOIN (
SELECT union_id,add_date,is_valid,CONCAT(add_date,' ',add_time) AS add_time
FROM demo_dw.private_user_events
WHERE dp = CURRENT_DATE() - 1
AND data_type = 2 AND source <> 3
AND union_id IS NOT NULL AND union_id <> ''
AND group_name REGEXP '示例新客福利群|示例新客专属群'
) b ON t.union_id = b.union_id AND t.add_time <= b.add_time
) a
WHERE a.group_rn = 1
GROUP BY GROUPING SETS ((a.加C日期,a.资源位),(a.加C日期))
)
SELECT a.date 日期,a.资源位
,COALESCE(b.加C用户数,0) AS 加C用户数
,COALESCE(b.加C当日进群用户数,0) AS 加C当日进群用户数
,COALESCE(b.进群用户数,0) AS 进群用户数
,COALESCE(b.进群留存用户数,0) AS 进群留存用户数
,COALESCE(b.进群留存率,0) AS 进群留存率
,COALESCE(b.进群率,0) AS 进群率
,COALESCE(b.加C当日进群率,0) AS 加C当日进群率
FROM date_list a
LEFT JOIN result b ON a.date = b.加C日期 AND a.资源位 = b.资源位
ORDER BY a.date,a.资源位
LIMIT 10000;
