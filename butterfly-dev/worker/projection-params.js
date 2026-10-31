/**
 * 人生推演 · 参数表（ParamTable）——独立、带版本的配置文件。
 * 全部数值为初版占位：由产品与市场调研后续替换（source 字段须与实际资料一致）；改动任何数值必须同时提升 version。
 * 规则层只读取本表，推演结果记录 paramVersion，可回放。
 */
export const PROJECTION_PARAMS={
 version:'pt-v0.2-2026-10-25',
 calibration:'初版参考区间：基于公开薪资资料与通用参数估算，尚未用实际用户数据校准',
 calibrationNote:'参数为初版占位，区间刻意放宽；仅用于闭测演示，待产品与市场调研替换。',
 /** 固定免责（法务 v1 §2，一字不改） */
 incomeDisclaimer:'这是基于你提供的条件和公开资料做的模拟估算，不代表实际收入，也不构成任何承诺。',
 /** R17/R8：L3 区间旁固定句（逐字白名单） */
 l3IndustryNote:'该区间参考公开行业报告，与你所在公司或岗位的实际薪酬可能差异较大。',
 /** R17：发布年份超过 2 年时加注 */
 dataStaleNote:'数据较旧，仅供参考',
 incomeUnit:'人民币（元）· 税前应发 · 每月（官方年值÷12）',
 /** R9 标识（法务终版，一字不改，无空格） */
 aiBadge:'AI生成·模拟非承诺',
 /** P1-4 首次使用弹窗（法务终版，一字不改；按哈希列入 R8 白名单） */
 firstUseNotice:'人生推演是基于你所给条件的AI模拟，不是算命，不承诺结果。',
 /** R11 行动线假设前提：逐字取自用户协议草稿 v0.4.2 §2A.2（系统固定模板；含「必然」，仅按哈希白名单放行） */
 planAssumption:'推演中的行动轨迹以您按计划执行为假设前提，并不意味着执行后必然达到所示状态。',
 /** 推演页首屏说明（系统固定模板） */
 pageDisclaimer:'以下是基于你确认的条件和假设生成的行动路径模拟，仅供参考，实际情况可能明显不同。',
 /** 6 个固定差距维度（顺序即推演节点的默认先后） */
 dims:[
  {key:'ability',label:'能力',nodeTitle:'补齐核心能力'},
  {key:'credential',label:'资质/证书',nodeTitle:'取得所需资质'},
  {key:'experience',label:'经验',nodeTitle:'积累相关经验'},
  {key:'network',label:'人脉/作品',nodeTitle:'建立作品与人脉'},
  {key:'income',label:'收入',nodeTitle:'验证收入来源'},
  {key:'time',label:'可投入时间',nodeTitle:'稳定可投入时间'}
 ],
 levelLabels:['基本无差距','小差距','中等差距','较大差距','很大差距'],
 /** 基础周期（周）：dim × level(0–4)，按 refHours 每周小时数估算。level 0 不生成节点。必须随 level 单调不减。 */
 baseWeeks:{
  ability:   [[0,0],[2,4],[4,8],[8,16],[16,30]],
  credential:[[0,0],[3,6],[6,12],[12,24],[24,48]],
  experience:[[0,0],[2,4],[4,10],[10,20],[20,40]],
  network:   [[0,0],[2,4],[3,8],[6,14],[12,26]],
  income:    [[0,0],[2,4],[4,8],[8,16],[12,28]],
  time:      [[0,0],[1,2],[1,3],[2,4],[2,6]]
 },
 /** 每周小时弹性：周期 × clamp((refHours/hours)^elasticity, minFactor, maxFactor) */
 hours:{refHours:6,elasticity:0.6,minFactor:0.6,maxFactor:2.2,defaultHoursWhenUnknown:3},
 /** 相邻节点可部分并行：后一节点起点 = 前一节点起点 + 前一节点时长 × overlap */
 overlap:0.75,
 /** 差距总分 → 难度档（加权平均 level，0–4） */
 dimWeights:{ability:1.2,credential:1.0,experience:1.0,network:0.8,income:0.8,time:0.6},
 tiers:[{key:'easy',label:'较易',maxScore:1.3},{key:'medium',label:'中等',maxScore:2.3},{key:'hard',label:'较难',maxScore:4.01}],
 /** 收入：数据来自独立版本化表 worker/projection-income-table.js（INCOME_TABLE）。这里只放匹配规则。
  *  规则：职业或城市不在表中 → 不给区间（不替代其他城市/职业）；副业/经营类目标无可核验数据 → 不给区间。 */
 income:{
  /** 缺数据时的查找顺序（v1.22 Micheal 确认；区域/省级标注跟台账）。
   *  第 1 步：同城市×同职业，L1→L2→L3。分位行取有低–高分位的行；L2 仅有行业均值时可用（展示行业名，非分位区间）。
   *  第 2a 步：同区域×同职业（如川渝），标注「区域样本 ≠ 单市」（或行内 sampleLabel）。默认开。
   *  第 2b 步：同省份×同职业的省级行；优先行内 sampleLabel（如「省级样本 ≠ 单市」），否则「以XX省数据估算」。默认开。
   *  第 3 步：仍无 → 不给区间；可展示用户自填，标注「用户自填」。默认开。
   *  不用其他城市近似。分位标签以行内 bandLabel / percentile* 为准，禁止写死「P25–P75」。 */
  fallback:{version:'income-fallback-v1-2026-10-24',
   sameCityTiers:{enabled:true,order:['L1','L2','L3']},
   region:{enabled:true,label:'区域样本 ≠ 单市'},
   province:{enabled:true,labelTemplate:'以{province}省数据估算'},
   userProvided:{enabled:true,label:'用户自填'}},
  /** 先匹配“无数据”方向（命中即不给区间） */
  noDataPatterns:[
   {key:'公务员（含参公）',pattern:'公务员|考公|参公|国考|省考|选调'},
   {key:'自媒体副业',pattern:'自媒体|博主'},
   {key:'互联网产品经理',pattern:'产品经理'}
  ],
  /** 公办在编教师不在工资价位调查范围 */
  publicTeacherPattern:'公办|在编|编制|考编|事业单位|教师招聘考试',
  directions:[
   {key:'程序员/前端',pattern:'程序员|前端|后端|软件开发|软件工程师|高级工程师|研发工程师|开发工程师|写代码|编程|全栈|Java工程师|算法工程师|客户端|服务端'},
   {key:'数据分析',pattern:'数据分析'},
   {key:'UI/平面设计',pattern:'UI|UX|交互设计|平面设计|视觉设计|视觉传达|美工|海报设计'},
   {key:'CPA/会计',pattern:'会计|CPA|注会|注册会计师'},
   {key:'法考/律师助理/律师',pattern:'律师|律所|法考|司法考试|法务|法律顾问|律师助理'},
   {key:'人力资源',pattern:'人力资源|HR|人事|招聘专员'},
   {key:'销售',pattern:'销售|营销员'},
   {key:'互联网运营',pattern:'运营'},
   {key:'教师',pattern:'教师|老师|讲师|教培'}
  ],
  educationMap:[{key:'硕士',pattern:'硕士|研究生|博士'},{key:'本科',pattern:'本科|学士'},{key:'专科',pattern:'专科|大专|高职'}],
  roundTo:100
 },
 /** 实际线首次出现（v1.22）：每日重算；需连续天数与有效执行记录均达阈值。配置开关，默认如下；后期阶段再渲染。 */
 actualLine:{version:'actual-line-v0-2026-10-24',
  enabled:true,
  firstAppearance:{minDays:3,minValidRecords:3,recompute:'daily'},
  shareCard:{includeActualLine:false,includeExecutionRecords:false},
  /** §1.6 固定句（系统插入，逐字进 R8 白名单） */
  notice:'实际线按你已有的执行记录推演，继续执行会随之更新。两条线都是模拟。',
  /** R15 灰色占位固定句 */
  placeholder:'开始执行后，这里会出现按你实际执行情况推演的轨迹',
  /** 节奏规则（纯规则、确定性）：每个节点窗口内的期望记录数 = expectedPerWeek × 有效周数（扣除暂停）；
   *  时间差（周）= 每条期望记录对应周数 ×（期望数 − 完成当量）；完成当量 done=1 / partial=0.5 / skipped=0。 */
  pace:{expectedPerWeek:3,credit:{done:1,partial:0.5,skipped:0},maxShiftWeeks:52},
  /** 有原因暂停：只勾选、不设自由填写；暂停区间不计入时间差 */
  pauseReasons:[{key:'health',label:'身体不适'},{key:'work',label:'工作冲突'},{key:'family',label:'家庭事务'},{key:'study',label:'学业考试'},{key:'travel',label:'出行不可抗'},{key:'other',label:'其他'}],
  maxAttribution:3,
  adjustWeeks:[1,2,4],
  demo:{label:'演示数据',note:'合成执行记录 + 时钟快进，仅用于演示，不保存到你的推演记录。',scenarios:['on_plan','behind','ahead','paused'],defaultDays:21,minDays:3,maxDays:84}},
 /** P0-14 详细故事版（本轮仅骨架；长文异步生成下一阶段接入） */
 /** P0-14 详细故事版（短摘要 + 长文双档；数字锁定在规则层，叙事层只写文字） */
 story:{version:'story-v1-2026-10-25',pendingText:'详细故事版正在准备，完成后会显示在这里。',
  generatingText:'正在生成详细故事版，可以先看上方行动线，完成后会自动显示。',
  failedText:'详细故事版暂未生成成功，行动线不受影响，可以点按钮重试。',
  sourceNote:{llm:'由本地模型按行动线节点改写成故事，节点周数与收入区间只来自上方行动线。',template:'按行动线节点模板生成，节点周数与收入区间只来自上方行动线。',mixed:'部分段落由本地模型改写、部分按模板生成，节点周数与收入区间只来自上方行动线。'},
  minChars:1500,maxChars:3000,fieldMinChars:30,summaryMaxChars:320,
  timeoutMs:360000,nodeTimeoutMs:90000,nodeRetries:1,temperature:0.4},
 /** 风险领域：需附专业意见提示（R6） */
 riskDomains:{
  investment:{label:'投资理财',pattern:'投资|理财|股票|基金|炒股|期货|加密货币|比特币|虚拟币|币圈|外汇|财务自由',notice:'目标涉及投资理财：本推演不构成投资建议，涉及资金决策请咨询持牌专业人士，并评估本金损失风险。'},
  medical:{label:'医疗健康',pattern:'医疗|治疗|疾病|生病|看病|药|手术|康复|减肥|减重|抑郁|焦虑症|失眠|怀孕|备孕|体检',notice:'目标涉及医疗健康：本推演不构成医疗建议，身体或心理状况请以执业医生的诊断与建议为准。'},
  legal:{label:'法律',pattern:'法律|诉讼|起诉|官司|律师|合同纠纷|仲裁|离婚|继承|维权|劳动仲裁|签证|移民',notice:'目标涉及法律事务：本推演不构成法律意见，具体问题请咨询执业律师或相关主管部门。'}
 },
 /** R3/R8 禁用词：全文（提示词 + 模型输出 + 模板） */
 absoluteWords:['年薪翻倍','保证','一定','必然','必定','肯定能','绝对','百分之百','100%','稳赚','躺赚','包过','包上岸','确保','逆天改命','改变命运'],
 forecastWords:['预测','预言','注定','命运','算命','测运势','命盘','天命','改运','转运'],
  /** 焦虑恐吓类（营销词表，同样扫描） */
 anxietyWords:['再不行动就晚了','你正在被淘汰','穷一辈子','没救了'],
 /** v1.18：评判/贴标签/与他人比较类用语（R8） */
 /** v1.18/v1.21：评判/贴标签/与他人比较；「失败」仅禁下列整句短语，不禁裸词 */
 judgmentWords:['你失败了','人生失败','失败的人生','注定失败','走向失败','落后于他人','拖延症','懒','不自律','越来越远','走上岔路'],
 /** 法务 §1 其余类别 + 法务 v1.15 行动线兜底（正则扫描，R8/R12） */
 bannedPatterns:[
  {key:'income_promise',cat:'结果承诺',pattern:'月入\\s*[0-9一二三四五六七八九十百千几]+\\s*万|[0-9一二三四五六七八九十几]+\\s*天实现'},
  {key:'superlative',cat:'绝对化用语',pattern:'最准|最科学|唯一|顶级|国家级|100%\\s*准确|精准预测|(?:行业|全网|排名|全国)第一|第一(?:名|品牌)'},
  {key:'authority',cat:'权威背书',pattern:'专家认证|权威测算|科学证明'},
  {key:'reverse_implication',cat:'反向暗示',pattern:'(?:如果|若|要是|假如)?不(?:行动|开始|改变|努力|坚持|执行)(?:的话)?[，,]?\\s*(?:就会|就将|会|将会|就)|再不(?:行动|开始|改变|努力)|否则(?:就|会|将)|不然(?:就|会|将)|会被淘汰|就晚了|来不及了|越来越差|错过(?:就|这次)'},
  {key:'future_extrapolation',cat:'未来外推',pattern:'(?:照|按|再|就)(?:这|那)样(?:下去|发展下去|持续下去)|照此(?:下去|发展)|长此以往|如此下去|(?:继续|一直)(?:这|那)样(?:下去)?[，,]?\\s*(?:将|会|就会|终将|迟早)'},
  {key:'paid_outcome',cat:'付费结果导向',pattern:'解锁更好的?结果|更好的结果|更快(?:达成|实现|成功|上岸|到达)|加速(?:达成|实现|成功)|提高成功率|成功率|保你|包你'}
 ],
 /** 危机关键词：命中则先走危机提示，暂停两条线对比 */
 crisisPattern:'自杀|轻生|不想活|活着没意思|活不下去|结束生命|结束自己|了结自己|想死|去死|自残|自伤|割腕|跳楼|寻死',
 crisisNotice:{title:'先照顾好你自己',body:'你提到的内容让我们有些担心。人生推演先暂停，你的安全更重要。如果你正处在困难中，可以随时联系下面的援助热线，或身边信任的人。',hotlines:[{name:'全国心理援助热线',phone:'400-161-9995'},{name:'北京心理危机研究与干预中心',phone:'010-82951332'},{name:'紧急情况',phone:'110 / 120'}],note:'该提示不构成危机干预、心理咨询或医疗服务，也不能替代紧急报警或专业医疗机构。'}
};
export default PROJECTION_PARAMS;
