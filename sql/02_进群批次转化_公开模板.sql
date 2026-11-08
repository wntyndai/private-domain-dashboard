-- 公开 SQL 模板：库表、群名、策略和渠道已替换为示例标识。无查询结果或凭证。
-- 保留原查询逻辑；执行前需适配自己的数据结构和 SQL 方言。
WITH user_add AS 
(
    -- 所有加群记录，到天颗粒度，保留一个用户多条进群记录
    SELECT  add_date
            ,a.union_id
            ,b.crm_customer_id
            ,IF(a.add_date < b.first_use_date OR b.first_use_date IS NULL,1,0) add_new
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
    AND     a.add_date <= CURRENT_DATE() - 1
    GROUP BY a.add_date
             ,a.union_id
             ,b.crm_customer_id
             ,IF(a.add_date < b.first_use_date OR b.first_use_date IS NULL,1,0)
) -- 新增进群
,add_stat AS 
(
    SELECT  add_date
            ,COUNT(DISTINCT union_id) AS add_cnt
            ,COUNT(DISTINCT IF(is_valid = 1,union_id,NULL)) AS in_cnt
            ,COUNT(DISTINCT IF(add_new = 1,union_id,NULL)) AS new_add_cnt
            ,COUNT(DISTINCT IF(add_new = 1 AND is_valid = 1,union_id,NULL)) AS new_in_cnt
    FROM    user_add
    GROUP BY add_date
) --- 支付
,pay_stat AS 
(
    SELECT  a.add_date
            ,COUNT(DISTINCT a.union_id) AS pay_cnt
            ,SUM(COALESCE(b.pay_gmv,0)) AS pay_gmv
            ,COUNT(DISTINCT IF(DATEDIFF(CAST(b.pay_date AS DATE),CAST(a.add_date AS DATE)) < 30,a.union_id,NULL)) AS pay_30_cnt
            ,SUM(
                IF(DATEDIFF(CAST(b.pay_date AS DATE),CAST(a.add_date AS DATE)) < 30,COALESCE(b.pay_gmv,0),0)
            ) AS pay_30_gmv -- 新客统计
            ,COUNT(DISTINCT IF(b.is_before_paydate_execution = 0,a.union_id,NULL)) AS new_pay_cnt
            ,SUM(IF(b.is_before_paydate_execution = 0,COALESCE(b.pay_gmv,0),0)) AS new_pay_gmv
            ,COUNT(DISTINCT 
                  IF(b.is_before_paydate_execution = 0 AND DATEDIFF(CAST(b.pay_date AS DATE),CAST(a.add_date AS DATE)) < 30,a.union_id,NULL)
            ) AS new_pay_30_cnt
            ,SUM(
                IF(b.is_before_paydate_execution = 0 AND DATEDIFF(CAST(b.pay_date AS DATE),CAST(a.add_date AS DATE)) < 30,COALESCE(b.pay_gmv,0),0)
            ) AS new_pay_30_gmv -- 进群时为新客，且支付时满足新客条件
            ,COUNT(DISTINCT IF(a.add_new = 1,a.union_id,NULL)) AS addnew_pay_cnt
            ,SUM(COALESCE(IF(a.add_new = 1,b.pay_gmv,0),0)) AS addnew_pay_gmv
            ,COUNT(DISTINCT 
                  IF(a.add_new = 1 AND DATEDIFF(CAST(b.pay_date AS DATE),CAST(a.add_date AS DATE)) < 30,a.union_id,NULL)
            ) AS addnew_pay_30_cnt
            ,SUM(
                IF(a.add_new = 1 AND DATEDIFF(CAST(b.pay_date AS DATE),CAST(a.add_date AS DATE)) < 30,COALESCE(b.pay_gmv,0),0)
            ) AS addnew_pay_30_gmv
            ,COUNT(DISTINCT IF(a.add_new = 1 AND b.is_before_paydate_execution = 0,a.union_id,NULL)) AS addnew_new_pay_cnt
            ,SUM(IF(a.add_new = 1 AND b.is_before_paydate_execution = 0,COALESCE(b.pay_gmv,0),0)) AS addnew_new_pay_gmv
            ,COUNT(DISTINCT 
                  IF(a.add_new = 1 AND b.is_before_paydate_execution = 0 AND DATEDIFF(CAST(b.pay_date AS DATE),CAST(a.add_date AS DATE)) < 30,a.union_id,NULL)
            ) AS addnew_new_pay_30_cnt
            ,SUM(
                IF(a.add_new = 1 AND b.is_before_paydate_execution = 0 AND DATEDIFF(CAST(b.pay_date AS DATE),CAST(a.add_date AS DATE)) < 30,COALESCE(b.pay_gmv,0),0)
            ) AS addnew_new_pay_30_gmv
    FROM    user_add a
    JOIN    (
                SELECT  crm_customer_id
                        ,pay_date
                        ,pay_gmv
                        ,is_before_paydate_execution
                FROM    demo_dw.orders
                WHERE   dp = CURRENT_DATE() - 1
                AND     is_paydate_cash = 0
                AND     pay_date <= CURRENT_DATE() - 1
                AND     pay_gmv > 0
            ) b
    ON      a.crm_customer_id = b.crm_customer_id
    AND     b.pay_date >= a.add_date
    GROUP BY a.add_date
) -- 核销
,exe_stat AS 
(
    SELECT  a.add_date
            ,COUNT(DISTINCT a.crm_customer_id) AS exe_cnt
            ,SUM(COALESCE(b.exe_income,0)) AS exe_income
            ,COUNT(DISTINCT 
                  IF(DATEDIFF(CAST(b.executed_date AS DATE),CAST(a.add_date AS DATE)) < 30,a.crm_customer_id,NULL)
            ) AS exe_30_cnt
            ,SUM(
                IF(DATEDIFF(CAST(b.executed_date AS DATE),CAST(a.add_date AS DATE)) < 30,COALESCE(b.exe_income,0),0)
            ) AS exe_30_income
            ,COUNT(DISTINCT IF(b.is_new = 1,a.crm_customer_id,NULL)) AS new_exe_cnt
            ,SUM(IF(b.is_new = 1,COALESCE(b.exe_income,0),0)) AS new_exe_income
            ,COUNT(DISTINCT 
                  IF(b.is_new = 1 AND DATEDIFF(CAST(b.executed_date AS DATE),CAST(a.add_date AS DATE)) < 30,a.crm_customer_id,NULL)
            ) AS new_exe_30_cnt
            ,SUM(
                IF(b.is_new = 1 AND DATEDIFF(CAST(b.executed_date AS DATE),CAST(a.add_date AS DATE)) < 30,COALESCE(b.exe_income,0),0)
            ) AS new_exe_30_income -- 进群时为新客，且核销时满足新客条件
            ,COUNT(DISTINCT IF(a.add_new = 1,a.crm_customer_id,NULL)) AS addnew_exe_cnt
            ,SUM(IF(a.add_new = 1,COALESCE(b.exe_income,0),0)) AS addnew_exe_income
            ,COUNT(DISTINCT 
                  IF(a.add_new = 1 AND DATEDIFF(CAST(b.executed_date AS DATE),CAST(a.add_date AS DATE)) < 30,a.crm_customer_id,NULL)
            ) AS addnew_exe_30_cnt
            ,SUM(
                IF(a.add_new = 1 AND DATEDIFF(CAST(b.executed_date AS DATE),CAST(a.add_date AS DATE)) < 30,COALESCE(b.exe_income,0),0)
            ) AS addnew_exe_30_income
            ,COUNT(DISTINCT IF(a.add_new = 1 AND b.is_new = 1,a.crm_customer_id,NULL)) AS addnew_new_exe_cnt
            ,SUM(IF(a.add_new = 1 AND b.is_new = 1,COALESCE(b.exe_income,0),0)) AS addnew_new_exe_income
            ,COUNT(DISTINCT 
                  IF(a.add_new = 1 AND b.is_new = 1 AND DATEDIFF(CAST(b.executed_date AS DATE),CAST(a.add_date AS DATE)) < 30,a.crm_customer_id,NULL)
            ) AS addnew_new_exe_30_cnt
            ,SUM(
                IF(a.add_new = 1 AND b.is_new = 1 AND DATEDIFF(CAST(b.executed_date AS DATE),CAST(a.add_date AS DATE)) < 30,COALESCE(b.exe_income,0),0)
            ) AS addnew_new_exe_30_income
    FROM    user_add a
    JOIN    (
                SELECT  customer_id
                        ,executed_date
                        ,exe_income
                        ,is_new
                FROM    demo_dw.redemptions
                WHERE   dp = CURRENT_DATE() - 1
                AND     is_valid = 1
                AND     executed_date <= CURRENT_DATE() - 1
            ) b
    ON      a.crm_customer_id = b.customer_id
    WHERE   b.executed_date >= a.add_date
    GROUP BY a.add_date
)
SELECT  d.date AS 日期 --,COALESCE(d.total_add_cnt,0) AS 累计进群人数
--,COALESCE(d.total_in_cnt,0) AS 累计在群人数
--,COALESCE(d.total_in_cnt,0) / NULLIF(d.total_add_cnt,0) AS 累计留存率
        ,COALESCE(a.add_cnt,0) AS 新增进群人数
        ,COALESCE(a.in_cnt,0) AS 新增在群人数
        ,COALESCE(a.in_cnt / NULLIF(a.add_cnt,0),0) AS 留存率
        ,COALESCE(a.new_add_cnt,0) AS 新客进群人数
        ,COALESCE(a.new_in_cnt,0) AS 新客在群人数
        ,COALESCE(a.new_in_cnt,0) / NULLIF(a.new_add_cnt,0) AS 新客留存率 -- 02. 全量
        ,COALESCE(b.pay_cnt,0) AS `累计支付人数_全量`
        ,COALESCE(b.pay_cnt / NULLIF(a.add_cnt,0),0) AS `累计支付率_全量`
        ,COALESCE(b.pay_gmv,0) AS `累计支付gmv_全量`
        ,COALESCE(b.pay_30_cnt,0) AS `30日内支付人数_全量`
        ,COALESCE(b.pay_30_cnt / NULLIF(a.add_cnt,0),0) AS `30日内支付率_全量`
        ,COALESCE(b.pay_30_gmv,0) AS `30日内支付gmv_全量`
        ,COALESCE(c.exe_cnt,0) AS `累计核销人数_全量`
        ,COALESCE(c.exe_cnt / NULLIF(a.add_cnt,0),0) AS `累计核销率_全量`
        ,COALESCE(c.exe_income,0) AS `累计核销收入_全量`
        ,COALESCE(c.exe_30_cnt,0) AS `30日内核销人数_全量`
        ,COALESCE(c.exe_30_cnt / NULLIF(a.add_cnt,0),0) AS `30日内核销率_全量`
        ,COALESCE(c.exe_30_income,0) AS `30日内核销收入_全量` -- 03. 交易新客
        ,COALESCE(b.new_pay_cnt,0) AS `累计支付人数_新客`
        ,COALESCE(b.new_pay_cnt / NULLIF(a.add_cnt,0),0) AS `累计支付率_新客`
        ,COALESCE(b.new_pay_gmv,0) AS `累计支付gmv_新客`
        ,COALESCE(b.new_pay_30_cnt,0) AS `30日内支付人数_新客`
        ,COALESCE(b.new_pay_30_cnt / NULLIF(a.add_cnt,0),0) AS `30日内支付率_新客`
        ,COALESCE(b.new_pay_30_gmv,0) AS `30日内支付gmv_新客`
        ,COALESCE(c.new_exe_cnt,0) AS `累计核销人数_新客`
        ,COALESCE(c.new_exe_cnt / NULLIF(a.add_cnt,0),0) AS `累计核销率_新客`
        ,COALESCE(c.new_exe_income,0) AS `累计核销收入_新客`
        ,COALESCE(c.new_exe_30_cnt,0) AS `30日内核销人数_新客`
        ,COALESCE(c.new_exe_30_cnt / NULLIF(a.add_cnt,0),0) AS `30日内核销率_新客`
        ,COALESCE(c.new_exe_30_income,0) AS `30日内核销收入_新客` -- 04. 进群新客
        ,COALESCE(b.addnew_pay_cnt,0) AS `累计支付人数_进群新客`
        ,COALESCE(b.addnew_pay_cnt / NULLIF(a.new_add_cnt,0),0) AS `累计支付率_进群新客`
        ,COALESCE(b.addnew_pay_gmv,0) AS `累计支付gmv_进群新客`
        ,COALESCE(b.addnew_pay_30_cnt,0) AS `30日内支付人数_进群新客`
        ,COALESCE(b.addnew_pay_30_cnt / NULLIF(a.new_add_cnt,0),0) AS `30日内支付率_进群新客`
        ,COALESCE(b.addnew_pay_30_gmv,0) AS `30日内支付gmv_进群新客`
        ,COALESCE(c.addnew_exe_cnt,0) AS `累计核销人数_进群新客`
        ,COALESCE(c.addnew_exe_cnt / NULLIF(a.new_add_cnt,0),0) AS `累计核销率_进群新客`
        ,COALESCE(c.addnew_exe_income,0) AS `累计核销收入_进群新客`
        ,COALESCE(c.addnew_exe_30_cnt,0) AS `30日内核销人数_进群新客`
        ,COALESCE(c.addnew_exe_30_cnt / NULLIF(a.new_add_cnt,0),0) AS `30日内核销率_进群新客`
        ,COALESCE(c.addnew_exe_30_income,0) AS `30日内核销收入_进群新客` -- 05. 进群且交易新客
        ,COALESCE(b.addnew_new_pay_cnt,0) AS `累计支付人数_进群新客_交易新客`
        ,COALESCE(b.addnew_new_pay_cnt / NULLIF(a.new_add_cnt,0),0) AS `累计支付率_进群新客_交易新客`
        ,COALESCE(b.addnew_new_pay_gmv,0) AS `累计支付gmv_进群新客_交易新客`
        ,COALESCE(b.addnew_new_pay_30_cnt,0) AS `30日内支付人数_进群新客_交易新客`
        ,COALESCE(b.addnew_new_pay_30_cnt / NULLIF(a.new_add_cnt,0),0) AS `30日内支付率_进群新客_交易新客`
        ,COALESCE(b.addnew_new_pay_30_gmv,0) AS `30日内支付gmv_进群新客_交易新客`
        ,COALESCE(c.addnew_new_exe_cnt,0) AS `累计核销人数_进群新客_交易新客`
        ,COALESCE(c.addnew_new_exe_cnt / NULLIF(a.new_add_cnt,0),0) AS `累计核销率_进群新客_交易新客`
        ,COALESCE(c.addnew_new_exe_income,0) AS `累计核销收入_进群新客_交易新客`
        ,COALESCE(c.addnew_new_exe_30_cnt,0) AS `30日内核销人数_进群新客_交易新客`
        ,COALESCE(c.addnew_new_exe_30_cnt / NULLIF(a.new_add_cnt,0),0) AS `30日内核销率_进群新客_交易新客`
        ,COALESCE(c.addnew_new_exe_30_income,0) AS `30日内核销收入_进群新客_交易新客`
FROM    demo_dw.calendar d
LEFT JOIN add_stat a
ON      d.date = a.add_date
LEFT JOIN pay_stat b
ON      d.date = b.add_date
LEFT JOIN exe_stat c
ON      d.date = c.add_date
WHERE   date >= '2025-08-06'
AND     date <= current_date() - 1
ORDER BY d.date
LIMIT   10000
;
