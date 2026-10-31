/* 自动生成：node scripts/build-persona-table.mjs —— 请勿手改。calibration 为内部标记，不得展示。 */
export const PERSONA_TABLE={
 "version": "persona-v1-2026-10-25-a034d25f",
 "sourceFile": "butterfly-pm/persona_param_sources.csv",
 "ledgerFile": "butterfly-pm/persona_source_ledger.csv",
 "ledgerCount": 19,
 "calibrationNote": "节点时长系数、差距权重为产品初设，非公开统计；calibration 为内部标记，不得展示",
 "dims": [
  "ability",
  "credential",
  "experience",
  "network",
  "income"
 ],
 "packs": {
  "P01_T1_grad_tech": {
   "id": "P01_T1_grad_tech",
   "name": "一线应届互联网技术",
   "priority": "P0",
   "dataStatus": "部分无数据",
   "axes": {
    "ageBand": "≤22/23–27",
    "education": "本科及以上",
    "occupation": "互联网技术",
    "cityTier": "一线",
    "hours": "高",
    "careerChange": "否",
    "civilTarget": "否"
   },
   "durationFactor": 0.85,
   "dimWeightsPct": {
    "ability": 30,
    "credential": 10,
    "experience": 30,
    "network": 15,
    "income": 15
   },
   "meta": {
    "incomeSourceKeys": "E06",
    "incomeBandRatio": "约2.0（深圳12130→24347）",
    "incomeBandRatioNote": "同源 P75÷P25 带宽比，非工龄涨幅；收入仍走 INCOME_TABLE",
    "credentialRefs": null,
    "gradSalaryKeys": "E01/E02/E04",
    "livingCostKeys": "K05/K06/K08",
    "careerYears": "G06 无数据"
   },
   "maxParallelNodes": null,
   "calibration": "示例校准"
  },
  "P02_NT1_grad_tech": {
   "id": "P02_NT1_grad_tech",
   "name": "新一线应届互联网技术",
   "priority": "P0",
   "dataStatus": "部分无数据",
   "axes": {
    "ageBand": "≤22/23–27",
    "education": "本科及以上",
    "occupation": "互联网技术",
    "cityTier": "新一线",
    "hours": "高",
    "careerChange": "否",
    "civilTarget": "否"
   },
   "durationFactor": 0.9,
   "dimWeightsPct": {
    "ability": 30,
    "credential": 10,
    "experience": 30,
    "network": 15,
    "income": 15
   },
   "meta": {
    "incomeSourceKeys": "E07",
    "incomeBandRatio": "约2.3（杭州14773→34278）",
    "incomeBandRatioNote": "同源 P75÷P25 带宽比，非工龄涨幅；收入仍走 INCOME_TABLE",
    "credentialRefs": null,
    "gradSalaryKeys": "E03",
    "livingCostKeys": "K07",
    "careerYears": "G06 无数据"
   },
   "maxParallelNodes": null,
   "calibration": "示例校准"
  },
  "P03_ops_T1_NT1": {
   "id": "P03_ops_T1_NT1",
   "name": "一线或新一线互联网运营",
   "priority": "P0",
   "dataStatus": "部分无数据",
   "axes": {
    "ageBand": "23–27/28–35",
    "education": "本科及以上",
    "occupation": "互联网运营",
    "cityTier": "一线/新一线",
    "hours": "中高",
    "careerChange": "否",
    "civilTarget": "否"
   },
   "durationFactor": 1.05,
   "dimWeightsPct": {
    "ability": 25,
    "credential": 10,
    "experience": 25,
    "network": 25,
    "income": 15
   },
   "meta": {
    "incomeSourceKeys": "E08/E09",
    "incomeBandRatio": "约1.8–2.3",
    "incomeBandRatioNote": "同源 P75÷P25 带宽比，非工龄涨幅；收入仍走 INCOME_TABLE",
    "credentialRefs": null,
    "gradSalaryKeys": "E05",
    "livingCostKeys": "K05–K08",
    "careerYears": "G01–G03 职级比"
   },
   "maxParallelNodes": null,
   "calibration": "示例校准"
  },
  "P04_career_change_da": {
   "id": "P04_career_change_da",
   "name": "28-35转行数据分析",
   "priority": "P0",
   "dataStatus": "部分无数据",
   "axes": {
    "ageBand": "28–35",
    "education": "本科及以上",
    "occupation": "数据分析",
    "cityTier": "一线/新一线",
    "hours": "中高",
    "careerChange": "是",
    "civilTarget": "否"
   },
   "durationFactor": 1.2,
   "dimWeightsPct": {
    "ability": 25,
    "credential": 20,
    "experience": 35,
    "network": 15,
    "income": 5
   },
   "meta": {
    "incomeSourceKeys": "E10/E11",
    "incomeBandRatio": "约2.3–2.8",
    "incomeBandRatioNote": "同源 P75÷P25 带宽比，非工龄涨幅；收入仍走 INCOME_TABLE",
    "credentialRefs": null,
    "gradSalaryKeys": null,
    "livingCostKeys": "K05–K08",
    "careerYears": "G05 无数据"
   },
   "maxParallelNodes": null,
   "calibration": "示例校准"
  },
  "P05_civil_exam": {
   "id": "P05_civil_exam",
   "name": "体制内备考",
   "priority": "P0",
   "dataStatus": "部分无数据",
   "axes": {
    "ageBand": "23–27/28–35",
    "education": "本科及以上",
    "occupation": "公务员",
    "cityTier": "不限",
    "hours": "高",
    "careerChange": "可",
    "civilTarget": "是"
   },
   "durationFactor": 1.15,
   "dimWeightsPct": {
    "ability": 15,
    "credential": 40,
    "experience": 20,
    "network": 10,
    "income": 15
   },
   "meta": {
    "incomeSourceKeys": "E23/E25",
    "incomeBandRatio": null,
    "incomeBandRatioNote": "同源 P75÷P25 带宽比，非工龄涨幅；收入仍走 INCOME_TABLE",
    "credentialRefs": "C07",
    "gradSalaryKeys": null,
    "livingCostKeys": "K01–K03",
    "careerYears": null
   },
   "maxParallelNodes": null,
   "calibration": "示例校准"
  },
  "P06_cpa_path": {
   "id": "P06_cpa_path",
   "name": "CPA会计考证路径",
   "priority": "P0",
   "dataStatus": "初值已填",
   "axes": {
    "ageBand": "23–27/28–35",
    "education": "本科及以上",
    "occupation": "会计/CPA",
    "cityTier": "一线/新一线",
    "hours": "中高",
    "careerChange": "可",
    "civilTarget": "否"
   },
   "durationFactor": 1.25,
   "dimWeightsPct": {
    "ability": 15,
    "credential": 40,
    "experience": 20,
    "network": 10,
    "income": 15
   },
   "meta": {
    "incomeSourceKeys": "E12/E13",
    "incomeBandRatio": "约1.6–2.0",
    "incomeBandRatioNote": "同源 P75÷P25 带宽比，非工龄涨幅；收入仍走 INCOME_TABLE",
    "credentialRefs": "C01/C02/C03",
    "gradSalaryKeys": null,
    "livingCostKeys": "K05–K08",
    "careerYears": null
   },
   "maxParallelNodes": null,
   "calibration": "示例校准"
  },
  "P07_judicial_exam": {
   "id": "P07_judicial_exam",
   "name": "法考路径",
   "priority": "P0",
   "dataStatus": "部分无数据",
   "axes": {
    "ageBand": "23–27/28–35",
    "education": "法学相关",
    "occupation": "法律",
    "cityTier": "一线/新一线",
    "hours": "高",
    "careerChange": "可",
    "civilTarget": "可"
   },
   "durationFactor": 1.25,
   "dimWeightsPct": {
    "ability": 15,
    "credential": 40,
    "experience": 20,
    "network": 10,
    "income": 15
   },
   "meta": {
    "incomeSourceKeys": "E14/E15",
    "incomeBandRatio": "约1.8–1.9",
    "incomeBandRatioNote": "同源 P75÷P25 带宽比，非工龄涨幅；收入仍走 INCOME_TABLE",
    "credentialRefs": "C04/C05（通过率无数据）",
    "gradSalaryKeys": null,
    "livingCostKeys": "K05–K08",
    "careerYears": null
   },
   "maxParallelNodes": null,
   "calibration": "示例校准"
  },
  "P08_teacher_path": {
   "id": "P08_teacher_path",
   "name": "教师资格或民办教学",
   "priority": "P1",
   "dataStatus": "部分无数据",
   "axes": {
    "ageBand": "23–27/28–35",
    "education": "本科及以上",
    "occupation": "教师",
    "cityTier": "一线/新一线",
    "hours": "中",
    "careerChange": "可",
    "civilTarget": "可（公办）"
   },
   "durationFactor": 1,
   "dimWeightsPct": {
    "ability": 20,
    "credential": 35,
    "experience": 25,
    "network": 10,
    "income": 10
   },
   "meta": {
    "incomeSourceKeys": "E16/E17/E24",
    "incomeBandRatio": "约1.9–2.5（企业样本）",
    "incomeBandRatioNote": "同源 P75÷P25 带宽比，非工龄涨幅；收入仍走 INCOME_TABLE",
    "credentialRefs": "C06（通过率无数据）",
    "gradSalaryKeys": null,
    "livingCostKeys": "K05–K08",
    "careerYears": null
   },
   "maxParallelNodes": null,
   "calibration": "示例校准"
  },
  "P09_sales_T1": {
   "id": "P09_sales_T1",
   "name": "一线销售",
   "priority": "P1",
   "dataStatus": "初值已填",
   "axes": {
    "ageBand": "23–27/28–35",
    "education": "大专及以上",
    "occupation": "销售",
    "cityTier": "一线",
    "hours": "高",
    "careerChange": "否",
    "civilTarget": "否"
   },
   "durationFactor": 0.95,
   "dimWeightsPct": {
    "ability": 15,
    "credential": 5,
    "experience": 25,
    "network": 35,
    "income": 20
   },
   "meta": {
    "incomeSourceKeys": "E18",
    "incomeBandRatio": "约2.0",
    "incomeBandRatioNote": "同源 P75÷P25 带宽比，非工龄涨幅；收入仍走 INCOME_TABLE",
    "credentialRefs": null,
    "gradSalaryKeys": "E05",
    "livingCostKeys": "K05/K06/K08",
    "careerYears": "G01/G02 职级比"
   },
   "maxParallelNodes": null,
   "calibration": "示例校准"
  },
  "P10_design_UI": {
   "id": "P10_design_UI",
   "name": "设计UI视觉一线或新一线",
   "priority": "P1",
   "dataStatus": "部分无数据",
   "axes": {
    "ageBand": "23–27/28–35",
    "education": "本科及以上",
    "occupation": "设计",
    "cityTier": "一线/新一线",
    "hours": "中高",
    "careerChange": "否",
    "civilTarget": "否"
   },
   "durationFactor": 1,
   "dimWeightsPct": {
    "ability": 30,
    "credential": 5,
    "experience": 35,
    "network": 20,
    "income": 10
   },
   "meta": {
    "incomeSourceKeys": "E19/E20",
    "incomeBandRatio": "约1.7–3.8",
    "incomeBandRatioNote": "同源 P75÷P25 带宽比，非工龄涨幅；收入仍走 INCOME_TABLE",
    "credentialRefs": null,
    "gradSalaryKeys": null,
    "livingCostKeys": "K05–K08",
    "careerYears": null
   },
   "maxParallelNodes": null,
   "calibration": "示例校准"
  },
  "P11_low_hours_side": {
   "id": "P11_low_hours_side",
   "name": "低周投入宝妈兼职侧",
   "priority": "P1",
   "dataStatus": "部分无数据",
   "axes": {
    "ageBand": "28–35/36–45",
    "education": "不限",
    "occupation": "兼职/自媒体",
    "cityTier": "不限",
    "hours": "低",
    "careerChange": "可",
    "civilTarget": "否"
   },
   "durationFactor": 1.35,
   "dimWeightsPct": {
    "ability": 20,
    "credential": 15,
    "experience": 25,
    "network": 15,
    "income": 25
   },
   "meta": {
    "incomeSourceKeys": "E26（无数据）",
    "incomeBandRatio": null,
    "incomeBandRatioNote": "同源 P75÷P25 带宽比，非工龄涨幅；收入仍走 INCOME_TABLE",
    "credentialRefs": null,
    "gradSalaryKeys": null,
    "livingCostKeys": "K01–K04；E28对照",
    "careerYears": null
   },
   "maxParallelNodes": null,
   "calibration": "示例校准"
  },
  "P12_hr_NT1_1to3y": {
   "id": "P12_hr_NT1_1to3y",
   "name": "HR新一线在职1-3年",
   "priority": "P1",
   "dataStatus": "初值已填",
   "axes": {
    "ageBand": "23–27/28–35",
    "education": "本科及以上",
    "occupation": "人力资源",
    "cityTier": "新一线",
    "hours": "中",
    "careerChange": "否",
    "civilTarget": "否"
   },
   "durationFactor": 1,
   "dimWeightsPct": {
    "ability": 20,
    "credential": 15,
    "experience": 30,
    "network": 20,
    "income": 15
   },
   "meta": {
    "incomeSourceKeys": "E21（E22对照）",
    "incomeBandRatio": "约2.2",
    "incomeBandRatioNote": "同源 P75÷P25 带宽比，非工龄涨幅；收入仍走 INCOME_TABLE",
    "credentialRefs": null,
    "gradSalaryKeys": null,
    "livingCostKeys": "K07",
    "careerYears": "G07 学历×工龄参照"
   },
   "maxParallelNodes": null,
   "calibration": "示例校准"
  }
 },
 "ledgerIndex": {
  "E06": {
   "key": "E06",
   "title": "深圳市2025年人力资源市场工资价位及行业人工成本信息",
   "publisher": "深圳市人社局",
   "url": "https://hrss.sz.gov.cn/attachment/1/1703/1703629/12735120.pdf",
   "publishDate": "2025",
   "city": "深圳",
   "metric": "P25–P75；税前；年÷12；企业应发",
   "tier": "L1"
  },
  "E08": {
   "key": "E08",
   "title": "深圳市2025年人力资源市场工资价位及行业人工成本信息",
   "publisher": "深圳市人社局",
   "url": "https://hrss.sz.gov.cn/attachment/1/1703/1703629/12735120.pdf",
   "publishDate": "2025",
   "city": "深圳",
   "metric": "P25–P75；税前；年÷12；企业应发",
   "tier": "L1"
  },
  "E10": {
   "key": "E10",
   "title": "深圳市2025年人力资源市场工资价位及行业人工成本信息",
   "publisher": "深圳市人社局",
   "url": "https://hrss.sz.gov.cn/attachment/1/1703/1703629/12735120.pdf",
   "publishDate": "2025",
   "city": "深圳",
   "metric": "P25–P75；税前；年÷12；企业应发",
   "tier": "L1"
  },
  "E12": {
   "key": "E12",
   "title": "深圳市2025年人力资源市场工资价位及行业人工成本信息",
   "publisher": "深圳市人社局",
   "url": "https://hrss.sz.gov.cn/attachment/1/1703/1703629/12735120.pdf",
   "publishDate": "2025",
   "city": "深圳",
   "metric": "P25–P75；税前；年÷12；企业应发",
   "tier": "L1"
  },
  "E14": {
   "key": "E14",
   "title": "深圳市2025年人力资源市场工资价位及行业人工成本信息",
   "publisher": "深圳市人社局",
   "url": "https://hrss.sz.gov.cn/attachment/1/1703/1703629/12735120.pdf",
   "publishDate": "2025",
   "city": "深圳",
   "metric": "P25–P75；税前；年÷12；企业应发",
   "tier": "L1"
  },
  "E16": {
   "key": "E16",
   "title": "深圳市2025年人力资源市场工资价位及行业人工成本信息",
   "publisher": "深圳市人社局",
   "url": "https://hrss.sz.gov.cn/attachment/1/1703/1703629/12735120.pdf",
   "publishDate": "2025",
   "city": "深圳",
   "metric": "P25–P75；税前；年÷12；企业应发",
   "tier": "L1"
  },
  "E18": {
   "key": "E18",
   "title": "深圳市2025年人力资源市场工资价位及行业人工成本信息",
   "publisher": "深圳市人社局",
   "url": "https://hrss.sz.gov.cn/attachment/1/1703/1703629/12735120.pdf",
   "publishDate": "2025",
   "city": "深圳",
   "metric": "P25–P75；税前；年÷12；企业应发",
   "tier": "L1"
  },
  "E19": {
   "key": "E19",
   "title": "深圳市2025年人力资源市场工资价位及行业人工成本信息",
   "publisher": "深圳市人社局",
   "url": "https://hrss.sz.gov.cn/attachment/1/1703/1703629/12735120.pdf",
   "publishDate": "2025",
   "city": "深圳",
   "metric": "P25–P75；税前；年÷12；企业应发",
   "tier": "L1"
  },
  "E22": {
   "key": "E22",
   "title": "深圳市2025年人力资源市场工资价位及行业人工成本信息",
   "publisher": "深圳市人社局",
   "url": "https://hrss.sz.gov.cn/attachment/1/1703/1703629/12735120.pdf",
   "publishDate": "2025",
   "city": "深圳",
   "metric": "P25–P75；税前；年÷12；企业应发",
   "tier": "L1"
  },
  "E07": {
   "key": "E07",
   "title": "杭州市2023年企业薪酬调查信息",
   "publisher": "杭州市人社局",
   "url": "https://zjjcmspublic.oss-cn-hangzhou-zwynet-d01-a.internet.cloud.zj.gov.cn/jcms_files/jcms1/web3163/site/attach/0/8de07211fbc54b69b37cb7c62f3ddc47.pdf",
   "publishDate": "2024",
   "city": "杭州",
   "metric": "P25–P75；税前；年÷12；企业应发",
   "tier": "L1"
  },
  "E09": {
   "key": "E09",
   "title": "杭州市2023年企业薪酬调查信息",
   "publisher": "杭州市人社局",
   "url": "https://zjjcmspublic.oss-cn-hangzhou-zwynet-d01-a.internet.cloud.zj.gov.cn/jcms_files/jcms1/web3163/site/attach/0/8de07211fbc54b69b37cb7c62f3ddc47.pdf",
   "publishDate": "2024",
   "city": "杭州",
   "metric": "P25–P75；税前；年÷12；企业应发",
   "tier": "L1"
  },
  "E11": {
   "key": "E11",
   "title": "杭州市2023年企业薪酬调查信息",
   "publisher": "杭州市人社局",
   "url": "https://zjjcmspublic.oss-cn-hangzhou-zwynet-d01-a.internet.cloud.zj.gov.cn/jcms_files/jcms1/web3163/site/attach/0/8de07211fbc54b69b37cb7c62f3ddc47.pdf",
   "publishDate": "2024",
   "city": "杭州",
   "metric": "P25–P75；税前；年÷12；企业应发",
   "tier": "L1"
  },
  "E13": {
   "key": "E13",
   "title": "杭州市2023年企业薪酬调查信息",
   "publisher": "杭州市人社局",
   "url": "https://zjjcmspublic.oss-cn-hangzhou-zwynet-d01-a.internet.cloud.zj.gov.cn/jcms_files/jcms1/web3163/site/attach/0/8de07211fbc54b69b37cb7c62f3ddc47.pdf",
   "publishDate": "2024",
   "city": "杭州",
   "metric": "P25–P75；税前；年÷12；企业应发",
   "tier": "L1"
  },
  "E15": {
   "key": "E15",
   "title": "杭州市2023年企业薪酬调查信息",
   "publisher": "杭州市人社局",
   "url": "https://zjjcmspublic.oss-cn-hangzhou-zwynet-d01-a.internet.cloud.zj.gov.cn/jcms_files/jcms1/web3163/site/attach/0/8de07211fbc54b69b37cb7c62f3ddc47.pdf",
   "publishDate": "2024",
   "city": "杭州",
   "metric": "P25–P75；税前；年÷12；企业应发",
   "tier": "L1"
  },
  "E17": {
   "key": "E17",
   "title": "杭州市2023年企业薪酬调查信息",
   "publisher": "杭州市人社局",
   "url": "https://zjjcmspublic.oss-cn-hangzhou-zwynet-d01-a.internet.cloud.zj.gov.cn/jcms_files/jcms1/web3163/site/attach/0/8de07211fbc54b69b37cb7c62f3ddc47.pdf",
   "publishDate": "2024",
   "city": "杭州",
   "metric": "P25–P75；税前；年÷12；企业应发",
   "tier": "L1"
  },
  "E20": {
   "key": "E20",
   "title": "杭州市2023年企业薪酬调查信息",
   "publisher": "杭州市人社局",
   "url": "https://zjjcmspublic.oss-cn-hangzhou-zwynet-d01-a.internet.cloud.zj.gov.cn/jcms_files/jcms1/web3163/site/attach/0/8de07211fbc54b69b37cb7c62f3ddc47.pdf",
   "publishDate": "2024",
   "city": "杭州",
   "metric": "P25–P75；税前；年÷12；企业应发",
   "tier": "L1"
  },
  "E21": {
   "key": "E21",
   "title": "杭州市2023年企业薪酬调查信息",
   "publisher": "杭州市人社局",
   "url": "https://zjjcmspublic.oss-cn-hangzhou-zwynet-d01-a.internet.cloud.zj.gov.cn/jcms_files/jcms1/web3163/site/attach/0/8de07211fbc54b69b37cb7c62f3ddc47.pdf",
   "publishDate": "2024",
   "city": "杭州",
   "metric": "P25–P75；税前；年÷12；企业应发",
   "tier": "L1"
  },
  "E01": {
   "key": "E01",
   "title": "2025人力资源白皮书",
   "publisher": "前程无忧",
   "url": "https://research.51job.com/pdf/resource/2025/resource.pdf",
   "publishDate": "2026-01",
   "city": "北京/上海/杭州",
   "metric": "分位/平均；招聘调研月薪；企业开出",
   "tier": "L3"
  },
  "E02": {
   "key": "E02",
   "title": "2025人力资源白皮书",
   "publisher": "前程无忧",
   "url": "https://research.51job.com/pdf/resource/2025/resource.pdf",
   "publishDate": "2026-01",
   "city": "北京/上海/杭州",
   "metric": "分位/平均；招聘调研月薪；企业开出",
   "tier": "L3"
  },
  "E03": {
   "key": "E03",
   "title": "2025人力资源白皮书",
   "publisher": "前程无忧",
   "url": "https://research.51job.com/pdf/resource/2025/resource.pdf",
   "publishDate": "2026-01",
   "city": "北京/上海/杭州",
   "metric": "分位/平均；招聘调研月薪；企业开出",
   "tier": "L3"
  },
  "G01": {
   "key": "G01",
   "title": "2025人力资源白皮书",
   "publisher": "前程无忧",
   "url": "https://research.51job.com/pdf/resource/2025/resource.pdf",
   "publishDate": "2026-01",
   "city": "北京/上海/杭州",
   "metric": "分位/平均；招聘调研月薪；企业开出",
   "tier": "L3"
  },
  "G02": {
   "key": "G02",
   "title": "2025人力资源白皮书",
   "publisher": "前程无忧",
   "url": "https://research.51job.com/pdf/resource/2025/resource.pdf",
   "publishDate": "2026-01",
   "city": "北京/上海/杭州",
   "metric": "分位/平均；招聘调研月薪；企业开出",
   "tier": "L3"
  },
  "G03": {
   "key": "G03",
   "title": "2025人力资源白皮书",
   "publisher": "前程无忧",
   "url": "https://research.51job.com/pdf/resource/2025/resource.pdf",
   "publishDate": "2026-01",
   "city": "北京/上海/杭州",
   "metric": "分位/平均；招聘调研月薪；企业开出",
   "tier": "L3"
  },
  "G04": {
   "key": "G04",
   "title": "2025人力资源白皮书",
   "publisher": "前程无忧",
   "url": "https://research.51job.com/pdf/resource/2025/resource.pdf",
   "publishDate": "2026-01",
   "city": "北京/上海/杭州",
   "metric": "分位/平均；招聘调研月薪；企业开出",
   "tier": "L3"
  },
  "E04": {
   "key": "E04",
   "title": "北京2025届高校毕业生起薪（央广转载）",
   "publisher": "北京人社（央广网转载）",
   "url": "https://edu.cnr.cn/dj/20250714/t20250714_527262244.shtml",
   "publishDate": "2025-07",
   "city": "北京",
   "metric": "中位值；月薪",
   "tier": "L1"
  },
  "E05": {
   "key": "E05",
   "title": "北京2025届高校毕业生起薪（央广转载）",
   "publisher": "北京人社（央广网转载）",
   "url": "https://edu.cnr.cn/dj/20250714/t20250714_527262244.shtml",
   "publishDate": "2025-07",
   "city": "北京",
   "metric": "中位值；月薪",
   "tier": "L1"
  },
  "E23": {
   "key": "E23",
   "title": "北京统计年鉴2025 表3-16",
   "publisher": "北京市统计局",
   "url": "https://nj.tjj.beijing.gov.cn/nj/main/2025-tjnj/zk/e/html/C0316.jpg",
   "publishDate": "2025",
   "city": "北京",
   "metric": "行业均值；非私营在岗；年÷12",
   "tier": "L2"
  },
  "E24": {
   "key": "E24",
   "title": "北京统计年鉴2025 表3-16",
   "publisher": "北京市统计局",
   "url": "https://nj.tjj.beijing.gov.cn/nj/main/2025-tjnj/zk/e/html/C0316.jpg",
   "publishDate": "2025",
   "city": "北京",
   "metric": "行业均值；非私营在岗；年÷12",
   "tier": "L2"
  },
  "E25": {
   "key": "E25",
   "title": "国办发〔2015〕3号等公务员工资标准",
   "publisher": "国务院/国务院办公厅",
   "url": "https://www.gov.cn/zhengce/zhengceku/2019-03/19/content_5375052.htm",
   "publishDate": "2015",
   "city": "全国",
   "metric": "基本工资标准；税前",
   "tier": "官方标准"
  },
  "E28": {
   "key": "E28",
   "title": "中华人民共和国2025年国民经济和社会发展统计公报",
   "publisher": "国家统计局",
   "url": "https://www.stats.gov.cn/sj/zxfb/202602/t20260228_1962662.html",
   "publishDate": "2026-02-28",
   "city": "全国",
   "metric": "平均数/中位数；年",
   "tier": "L2"
  },
  "K01": {
   "key": "K01",
   "title": "中华人民共和国2025年国民经济和社会发展统计公报",
   "publisher": "国家统计局",
   "url": "https://www.stats.gov.cn/sj/zxfb/202602/t20260228_1962662.html",
   "publishDate": "2026-02-28",
   "city": "全国",
   "metric": "平均数/中位数；年",
   "tier": "L2"
  },
  "K02": {
   "key": "K02",
   "title": "中华人民共和国2025年国民经济和社会发展统计公报",
   "publisher": "国家统计局",
   "url": "https://www.stats.gov.cn/sj/zxfb/202602/t20260228_1962662.html",
   "publishDate": "2026-02-28",
   "city": "全国",
   "metric": "平均数/中位数；年",
   "tier": "L2"
  },
  "K03": {
   "key": "K03",
   "title": "中华人民共和国2025年国民经济和社会发展统计公报",
   "publisher": "国家统计局",
   "url": "https://www.stats.gov.cn/sj/zxfb/202602/t20260228_1962662.html",
   "publishDate": "2026-02-28",
   "city": "全国",
   "metric": "平均数/中位数；年",
   "tier": "L2"
  },
  "K04": {
   "key": "K04",
   "title": "中华人民共和国2025年国民经济和社会发展统计公报",
   "publisher": "国家统计局",
   "url": "https://www.stats.gov.cn/sj/zxfb/202602/t20260228_1962662.html",
   "publishDate": "2026-02-28",
   "city": "全国",
   "metric": "平均数/中位数；年",
   "tier": "L2"
  },
  "C01": {
   "key": "C01",
   "title": "2025年注册会计师全国统一考试举行",
   "publisher": "中国注册会计师协会",
   "url": "https://www.cicpa.org.cn/xxfb/news/202508/t20250827_65611.html",
   "publishDate": "2025-08-27",
   "city": "全国",
   "metric": "报名人数；官方",
   "tier": "官方考试"
  },
  "C02": {
   "key": "C02",
   "title": "2021—2025年注册会计师考试分析报告（转载）",
   "publisher": "中注协（搜狐转载）",
   "url": "https://www.sohu.com/a/1083603216_121124337",
   "publishDate": "2026",
   "city": "全国",
   "metric": "合格率；官方报告经转载",
   "tier": "官方考试（转载）"
  },
  "C03": {
   "key": "C03",
   "title": "2021—2025年注册会计师考试分析报告（转载）",
   "publisher": "中注协（搜狐转载）",
   "url": "https://www.sohu.com/a/1083603216_121124337",
   "publishDate": "2026",
   "city": "全国",
   "metric": "合格率；官方报告经转载",
   "tier": "官方考试（转载）"
  },
  "C04": {
   "key": "C04",
   "title": "2025年国家统一法律职业资格考试公告",
   "publisher": "司法部",
   "url": "https://www.moj.gov.cn/pub/sfbgw/zwxxgk/fdzdgknr/fdzdgknrtzwj/202506/t20250605_520493.html",
   "publishDate": "2025-06-05",
   "city": "全国",
   "metric": "日程；官方",
   "tier": "官方考试"
  },
  "C05": {
   "key": "C05",
   "title": "司法部公告第8号",
   "publisher": "司法部",
   "url": "https://www.moj.gov.cn/pub/sfbgw/zwxxgk/fdzdgknr/fdzdgknrtzwj/202509/t20250918_525221.html",
   "publishDate": "2025-09-18",
   "city": "全国",
   "metric": "日程、合格线",
   "tier": "官方考试"
  },
  "C06": {
   "key": "C06",
   "title": "上海市2025年下半年中小学教资笔试报名公告",
   "publisher": "上海市教育考试院",
   "url": "https://www.shmeea.edu.cn/page/08000/20250630/19563.html",
   "publishDate": "2025-06-30",
   "city": "上海/全国",
   "metric": "日程",
   "tier": "官方考试"
  },
  "C07": {
   "key": "C07",
   "title": "中央机关及其直属机构2026年度考试录用公务员公告",
   "publisher": "国家公务员局（首都之窗转载）",
   "url": "https://www.beijing.gov.cn/fuwu/bmfw/sy/jrts/202510/t20251014_4222416.html",
   "publishDate": "2025-10-14",
   "city": "全国",
   "metric": "日程、招录数",
   "tier": "官方考试"
  },
  "K05": {
   "key": "K05",
   "title": "2025年全市居民人均可支配收入同比增长4.3%",
   "publisher": "国家统计局北京调查总队",
   "url": "https://tjj.beijing.gov.cn/zxfbu/202601/t20260121_4451962.html",
   "publishDate": "2026-01-21",
   "city": "北京",
   "metric": "人均；年",
   "tier": "L2"
  },
  "K06": {
   "key": "K06",
   "title": "2025年居民人均可支配收入及消费支出",
   "publisher": "上海市统计局",
   "url": "https://www.shanghai.gov.cn/nw48810/20260203/2bed33e23b324e27ae846d3a88bade53.html",
   "publishDate": "2026-01-21",
   "city": "上海",
   "metric": "人均；年",
   "tier": "L2"
  },
  "K07": {
   "key": "K07",
   "title": "2025年杭州市国民经济和社会发展统计公报（杭州网转载）",
   "publisher": "杭州市统计局",
   "url": "https://hznews.hangzhou.com.cn/chengshi/content/2026-04/30/content_9214808.htm",
   "publishDate": "2026-04-30",
   "city": "杭州",
   "metric": "人均；年",
   "tier": "L2"
  },
  "K08": {
   "key": "K08",
   "title": "深圳市2025年国民经济和社会发展统计公报",
   "publisher": "深圳市统计局",
   "url": "https://www.sz.gov.cn/cn/xxgk/zfxxgj/tjsj/tjgb/content/post_12805133.html",
   "publishDate": "2026-05-25",
   "city": "深圳",
   "metric": "人均；年",
   "tier": "L2"
  }
 },
 "buildIssues": []
};
