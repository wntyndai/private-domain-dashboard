-- 公开 SQL 模板：库表、群名、策略和渠道已替换为示例标识。无查询结果或凭证。
-- 保留原查询逻辑；执行前需适配自己的数据结构和 SQL 方言。
WITH user_add AS 
(
    -- 所有加群记录，到天颗粒度，保留一个用户多条进群记录
    SELECT  add_date
            ,a.union_id
            ,b.crm_customer_id
            ,IF(a.add_date < b.first_use_date OR b.first_use_date IS NULL,1,0) AS add_new
            ,MAX(IF(a.is_valid = 1,1,0)) AS is_valid
    FROM    demo_dw.private_user_events a
    LEFT JOIN   (
                    SELECT  union_id
                            ,crm_customer_id
                            ,first_use_date
                    FROM    demo_dw.user_summary
                    WHERE   dp = CURRENT_DATE() - 1
                    QUALIFY ROW_NUMBER() OVER (PARTITION BY union_id ORDER BY create_date ASC ) = 1
                ) b
    ON      a.union_id = b.union_id
    WHERE   a.dp = CURRENT_DATE() - 1
    AND     a.data_type = 2
    AND     a.source = 2
    AND     a.union_id IS NOT NULL
    AND     a.union_id <> ''
    AND     a.group_name REGEXP '示例新客福利群|示例新客专属群'
    AND     CAST(a.add_date AS DATE) <= CURRENT_DATE() - 1
    GROUP BY a.add_date
             ,a.union_id
             ,b.crm_customer_id
             ,IF(CAST(a.add_date AS DATE) < CAST(b.first_use_date AS DATE) OR b.first_use_date IS NULL,1,0)
)
,cumulative_stat AS 
(
    -- 累计进群规模主表
    -- user_add 与原始进群表使用了相同的过滤条件，因此直接基于 user_add 统计
    SELECT  CURRENT_DATE() - 1 AS stat_date
            ,COUNT(DISTINCT union_id) AS cumulative_add_cnt
            ,COUNT(DISTINCT IF(is_valid = 1,union_id,NULL)) AS in_cnt
            ,COUNT(DISTINCT IF(is_valid = 1 AND add_new = 1,union_id,NULL)) AS new_in_cnt
    FROM    user_add
)
,pay_stat AS 
(
    -- 将一个用户的多条进群记录压成一行
    -- first_add_date：首次进群日期
    -- add_new：首次进群时是否为新客
    SELECT  CURRENT_DATE() - 1 AS stat_date -- 当前仍在群用户，进群后累计支付
            ,COUNT(DISTINCT IF(u.is_valid = 1,u.union_id,NULL)) AS in_pay_cnt
            ,SUM(IF(u.is_valid = 1,COALESCE(o.pay_gmv,0),0)) AS in_pay_gmv -- 当前仍在群、进群时为新客、且首次进群当天支付
            ,COUNT(DISTINCT 
                  IF(u.is_valid = 1 AND u.add_new = 1 AND CAST(o.pay_date AS DATE) = u.first_add_date,u.union_id,NULL)
            ) AS new_in_same_day_pay_cnt
            ,SUM(
                IF(u.is_valid = 1 AND u.add_new = 1 AND CAST(o.pay_date AS DATE) = u.first_add_date,COALESCE(o.pay_gmv,0),0)
            ) AS new_in_same_day_pay_gmv
    FROM    (
                SELECT  x.union_id
                        ,MAX(x.crm_customer_id) AS crm_customer_id
                        ,MIN(x.first_add_date) AS first_add_date
                        ,MAX(x.is_valid) AS is_valid
                        ,MAX(IF(x.add_date = x.first_add_date,x.add_new,0)) AS add_new
                FROM    (
                            SELECT  a.*
                                    ,MIN(a.add_date) OVER (PARTITION BY a.union_id ) AS first_add_date
                            FROM    user_add a
                        ) x
                GROUP BY x.union_id
            ) u
    JOIN    demo_dw.orders o
    ON      u.crm_customer_id = o.crm_customer_id
    AND     CAST(o.pay_date AS DATE) >= u.first_add_date
    WHERE   o.dp = CURRENT_DATE() - 1
    AND     o.is_paydate_cash = 0
    AND     CAST(o.pay_date AS DATE) <= CURRENT_DATE() - 1
    AND     o.pay_gmv > 0
)
,exe_stat AS 
(
    -- 将一个用户的多条进群记录压成一行
    -- 当前仍在群用户，进群后累计核销
    -- 同时统计进群新客首次进群当天核销
    SELECT  CURRENT_DATE() - 1 AS stat_date
            ,COUNT(DISTINCT IF(u.is_valid = 1,u.union_id,NULL)) AS in_exe_cnt
            ,SUM(IF(u.is_valid = 1,COALESCE(e.exe_income,0),0)) AS in_exe_income
            ,COUNT(DISTINCT 
                  IF(u.is_valid = 1 AND u.add_new = 1 AND CAST(e.executed_date AS DATE) = u.first_add_date,u.union_id,NULL)
            ) AS new_in_same_day_exe_cnt
            ,SUM(
                IF(u.is_valid = 1 AND u.add_new = 1 AND CAST(e.executed_date AS DATE) = u.first_add_date,COALESCE(e.exe_income,0),0)
            ) AS new_in_same_day_exe_income
    FROM    (
                SELECT  x.union_id
                        ,MAX(x.crm_customer_id) AS crm_customer_id
                        ,MIN(x.first_add_date) AS first_add_date
                        ,MAX(x.is_valid) AS is_valid
                        ,MAX(IF(x.add_date = x.first_add_date,x.add_new,0)) AS add_new
                FROM    (
                            SELECT  a.*
                                    ,MIN(a.add_date) OVER (PARTITION BY a.union_id ) AS first_add_date
                            FROM    user_add a
                        ) x
                GROUP BY x.union_id
            ) u
    JOIN    demo_dw.redemptions e
    ON      u.crm_customer_id = e.customer_id
    AND     CAST(e.executed_date AS DATE) >= u.first_add_date
    WHERE   e.dp = CURRENT_DATE() - 1
    AND     e.is_valid = 1
    AND     CAST(e.executed_date AS DATE) <= CURRENT_DATE() - 1
)
SELECT  c.stat_date AS 日期 -- 累计进群和在群规模
        ,COALESCE(c.cumulative_add_cnt,0) AS 累计进群人数
        ,COALESCE(c.in_cnt,0) AS 累计在群人数
        ,COALESCE(c.new_in_cnt,0) AS 在群新客人数
        ,COALESCE(1.0 * c.in_cnt / NULLIF(c.cumulative_add_cnt,0),0) AS 累计留存率
        ,COALESCE(1.0 * c.new_in_cnt / NULLIF(c.in_cnt,0),0) AS 在群新客占比 -- 当前在群用户累计支付
        ,COALESCE(p.in_pay_cnt,0) AS 在群用户累计支付人数
        ,COALESCE(p.in_pay_gmv,0) AS 在群用户累计支付GMV
        ,COALESCE(1.0 * p.in_pay_cnt / NULLIF(c.in_cnt,0),0) AS 在群用户累计支付率 -- 进群新客进群当日支付
        ,COALESCE(p.new_in_same_day_pay_cnt,0) AS 进群新客进群当日支付人数
        ,COALESCE(p.new_in_same_day_pay_gmv,0) AS 进群新客进群当日支付GMV
        ,COALESCE(1.0 * p.new_in_same_day_pay_cnt / NULLIF(c.new_in_cnt,0),0) AS 进群新客进群当日支付率 -- 当前在群用户累计核销
        ,COALESCE(e.in_exe_cnt,0) AS 在群用户累计核销人数
        ,COALESCE(e.in_exe_income,0) AS 在群用户累计核销收入
        ,COALESCE(1.0 * e.in_exe_cnt / NULLIF(c.in_cnt,0),0) AS 在群用户累计核销率 -- 进群新客进群当日核销
        ,COALESCE(e.new_in_same_day_exe_cnt,0) AS 进群新客进群当日核销人数
        ,COALESCE(e.new_in_same_day_exe_income,0) AS 进群新客进群当日核销收入
        ,COALESCE(1.0 * e.new_in_same_day_exe_cnt / NULLIF(c.new_in_cnt,0),0) AS 进群新客进群当日核销率
FROM    cumulative_stat c
LEFT JOIN pay_stat p
ON      c.stat_date = p.stat_date
LEFT JOIN exe_stat e
ON      c.stat_date = e.stat_date
;