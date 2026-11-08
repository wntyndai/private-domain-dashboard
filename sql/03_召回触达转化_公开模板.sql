-- 公开 SQL 模板：库表、群名、策略和渠道已替换为示例标识。无查询结果或凭证。
-- 保留原查询逻辑；执行前需适配自己的数据结构和 SQL 方言。
-- 用户消息中的 SQL；仅去除 Markdown 对下划线、句点和注释符的转义。
WITH touch_user AS
(
SELECT a.uid
,MIN(CAST(a.touch_date AS DATE)) AS first_touch_date
FROM demo_analysis.touch_events a
JOIN (
SELECT DISTINCT strategy_id
FROM demo_analysis.strategies
WHERE strategy_name REGEXP '示例新客召回策略'
) b ON a.strategy_id = b.strategy_id
WHERE a.uid IS NOT NULL
GROUP BY a.uid
)
,group_user AS
(
SELECT t.uid
,MIN(CAST(g.add_date AS DATE)) AS first_add_date
FROM touch_user t
JOIN demo_dw.private_user_events g
ON t.uid = g.uid
AND CAST(g.add_date AS DATE) >= t.first_touch_date
WHERE g.dp = CURRENT_DATE() - 1
AND g.data_type = 2
AND g.source <> 3
AND g.union_id IS NOT NULL
AND g.union_id <> ''
AND g.group_name REGEXP '示例新客福利群|示例新客专属群'
GROUP BY t.uid
)
,daily_event AS
(
SELECT first_touch_date AS date,COUNT(*) AS touch_cnt,0 AS add_cnt
FROM touch_user GROUP BY first_touch_date
UNION ALL
SELECT first_add_date AS date,0 AS touch_cnt,COUNT(*) AS add_cnt
FROM group_user GROUP BY first_add_date
)
,daily_stat AS
(
SELECT date,SUM(touch_cnt) AS touch_cnt,SUM(add_cnt) AS add_cnt
FROM daily_event GROUP BY date
)
SELECT d.date AS 日期
,SUM(COALESCE(s.touch_cnt,0)) OVER (ORDER BY d.date) AS 累计触达人数
,SUM(COALESCE(s.add_cnt,0)) OVER (ORDER BY d.date) AS 累计进群人数
,SUM(COALESCE(s.add_cnt,0)) OVER (ORDER BY d.date) / NULLIF(SUM(COALESCE(s.touch_cnt,0)) OVER (ORDER BY d.date),0) AS 累计进群率
FROM demo_dw.calendar d
LEFT JOIN daily_stat s ON d.date = s.date
WHERE d.date >= '2026-01-01'
AND d.date <= CURRENT_DATE() - 1
ORDER BY d.date
LIMIT 10000;
