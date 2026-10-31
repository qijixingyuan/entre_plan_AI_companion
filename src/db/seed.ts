import { db, schema } from "./index";

const { couponDefs, simEvents, bpModules } = schema;

async function seed() {
  // 6 种券
  await db
    .insert(couponDefs)
    .values([
      {
        code: "search",
        name: "检索增强",
        category: "process",
        price: 1,
        outputSpec: "扩展检索词表 + 多源对照表 + 反例清单（学生自行核实）",
      },
      {
        code: "logic",
        name: "逻辑梳理",
        category: "process",
        price: 1,
        outputSpec: "商业逻辑链图 + 断点诊断 + 3 个追问",
      },
      {
        code: "ppt",
        name: "PPT 生成",
        category: "output",
        price: 1,
        outputSpec: "路演大纲 + 版式初稿，内容留空位",
      },
      {
        code: "report",
        name: "调研报告",
        category: "output",
        price: 1,
        outputSpec: "调研框架 + 二手数据综述 + 访谈提纲",
      },
      {
        code: "investor",
        name: "模拟投资人",
        category: "process",
        price: 1,
        outputSpec: "一轮 10 问拷问 + 弱点报告",
      },
      {
        code: "repair",
        name: "修复券",
        category: "process",
        price: 1,
        outputSpec: "结构化修复会话：定位缺陷 → 说清问题 → 提改法 → 重写",
      },
    ])
    .onConflictDoNothing();

  // 5 个 BP 模块
  await db
    .insert(bpModules)
    .values([
      { id: "mod-opportunity", code: "opportunity", title: "机会识别", seq: 1, scaffoldJson: JSON.stringify({ questions: ["你要解决谁的什么问题？", "这个问题现在怎么被解决的？为什么不够好？", "凭什么你来做？"] }) },
      { id: "mod-model", code: "model", title: "商业模式", seq: 2, scaffoldJson: JSON.stringify({ questions: ["谁付钱？付多少？多久付一次？", "成本大头在哪？", "赚的是哪一段的钱？"] }) },
      { id: "mod-marketing", code: "marketing", title: "营销策略", seq: 3, scaffoldJson: JSON.stringify({ questions: ["第一批客户从哪来？", "获客成本大概多少？", "口碑怎么起来？"] }) },
      { id: "mod-finance", code: "finance", title: "财务测算", seq: 4, scaffoldJson: JSON.stringify({ questions: ["月固定成本多少？", "多少客户才保本？", "现金流断点在哪？"] }) },
      { id: "mod-pitch", code: "pitch", title: "路演", seq: 5, scaffoldJson: JSON.stringify({ questions: ["3 分钟讲清什么事？", "投资人为什么要现在投你？", "最可能被问倒的是什么？"] }) },
    ])
    .onConflictDoNothing();

  // 20 条事件（与《事件库v1_湖南情境_20条_20261027.md》一致）
  const events = [
    { code: "E01", category: "天气", severity: 3, narrative: "湘西进入超长梅雨，连续 15 天强降雨，户外体育旅游与研学团退改率达 35%，固定成本照常发生。", targetAssumptions: "A3,A2", isOpportunity: 0, sourceNote: "湖南梅雨季文旅退改场景", options: [
      { id: "A", text: "48 小时内上线室内替代产品线", hint: "投入 2 万，挽回约 40% 流水" },
      { id: "B", text: "与客户谈「改期不退款+赠送权益」", hint: "本月流水 -35%，下月排期爆满" },
      { id: "C", text: "砍营销与兼职成本止血", hint: "流水 -50%，成本 -20%，团队士气风险" },
    ]},
    { code: "E02", category: "天气", severity: 2, narrative: "冬季山区道路结冰封路 5 天，县乡物流中断，装备与农产品发货停摆。", targetAssumptions: "A7", isOpportunity: 0, sourceNote: "湘西山区冬季封路", options: [
      { id: "A", text: "启用前置仓就近发货", hint: "成本 +8%，交付恢复" },
      { id: "B", text: "通知客户改期+补偿", hint: "口碑保全，当月订单延后" },
      { id: "C", text: "暂停接单保口碑", hint: "流水 -20%，差评归零" },
    ]},
    { code: "E03", category: "天气", severity: 2, narrative: "7 月连续高温红色预警，户外赛事与军训服务被要求延期两周。", targetAssumptions: "A2,A3", isOpportunity: 0, sourceNote: "湖南夏季高温停工", options: [
      { id: "A", text: "改晚间场次", hint: "人力成本 +15%，流水挽回 70%" },
      { id: "B", text: "与主办方谈顺延条款", hint: "当月空窗，下月排满" },
      { id: "C", text: "开发室内替代项目", hint: "一次性投入，新业务线萌芽" },
    ]},
    { code: "E04", category: "天气", severity: 2, narrative: "台风外围影响，高铁停运 3 天，跨省客源订单量腰斩。", targetAssumptions: "A2", isOpportunity: 0, sourceNote: "台风季高铁停运", options: [
      { id: "A", text: "转本地客源促销", hint: "获客成本 -30%，客单价 -20%" },
      { id: "B", text: "启动不可抗力免责话术", hint: "纠纷清零，品牌好感微降" },
      { id: "C", text: "压缩可变成本", hint: "现金流保全，团队压力大" },
    ]},
    { code: "E05", category: "政策", severity: 3, narrative: "体育类校外培训预收费新规：单次收费不得超过 3 个月，须银行资金托管，次月生效，存量学费 3 个月内清退整改。", targetAssumptions: "A2,A5", isOpportunity: 0, sourceNote: "参考 2023 年起体育类校外培训预收费监管实践", options: [
      { id: "A", text: "产品改为月付+次卡", hint: "现金流收紧 30%-50%，须压降固定成本" },
      { id: "B", text: "对接银行托管保留季付", hint: "手续费 +1.5%，品牌信任上升" },
      { id: "C", text: "转型学校/单位团购 ToB", hint: "销售周期变长，CAC 结构改变" },
    ]},
    { code: "E06", category: "政策", severity: 2, narrative: "省级体育产业引导资金申报窗口提前 20 天截止，配套资金比例要求提高。", targetAssumptions: "A6", isOpportunity: 0, sourceNote: "省级产业资金申报变化", options: [
      { id: "A", text: "放弃申报转自筹", hint: "资金缺口自担，节奏自主" },
      { id: "B", text: "压缩项目规模凑配套", hint: "保住申报，影响力缩水" },
      { id: "C", text: "联合本地企业组队申报", hint: "分润让出，资源互补" },
    ]},
    { code: "E07", category: "政策", severity: 2, narrative: "数字乡村类项目补贴下调 20%，验收标准与数据留存要求趋严。", targetAssumptions: "A6", isOpportunity: 0, sourceNote: "数字乡村补贴调整", options: [
      { id: "A", text: "砍低效模块保核心", hint: "交付面收窄，合规达标" },
      { id: "B", text: "按新标准补数据留痕", hint: "工作量 +30%，验收稳过" },
      { id: "C", text: "与村集体共担成本", hint: "利润 -10%，关系加深" },
    ]},
    { code: "E08", category: "政策", severity: 2, narrative: "义务教育课后服务采购改为区县统一招标，准入资质与保证金门槛提高。", targetAssumptions: "A6,A1", isOpportunity: 0, sourceNote: "课后服务采购招标化", options: [
      { id: "A", text: "陪标转供应商", hint: "让出主导权，走量保底" },
      { id: "B", text: "与持证机构合作分润", hint: "毛利 -15%，进得去" },
      { id: "C", text: "退出该渠道转 C 端", hint: "获客成本重来，天花板更高" },
    ]},
    { code: "E09", category: "市场", severity: 3, narrative: "竞对在同城新开 3 家门店，暑期班价格直降 30% 并买断本地社群广告位，你的咨询量两周内下降 25%。", targetAssumptions: "A1,A2", isOpportunity: 0, sourceNote: "体育培训暑期价格战常见形态", options: [
      { id: "A", text: "不跟价做差异化，内容获客", hint: "短期流水 -15%，CAC 先升后降" },
      { id: "B", text: "限时跟价+老学员锁客升班", hint: "份额保全，毛利 -8%" },
      { id: "C", text: "收缩投放转介绍裂变", hint: "月流水 -20%，CAC 显著下降" },
    ]},
    { code: "E10", category: "市场", severity: 2, narrative: "中秋国庆双节文旅订单同比增长 60%，但兼职教练与服务人力招不满。", targetAssumptions: "A5,A7", isOpportunity: 1, sourceNote: "双节文旅爆单场景", options: [
      { id: "A", text: "提价筛选高价值单", hint: "流水 +40%，客户数 -20%" },
      { id: "B", text: "外包人力分润", hint: "流水 +50%，毛利 -12%" },
      { id: "C", text: "限单量保服务质量", hint: "流水 +25%，口碑积累" },
    ]},
    { code: "E11", category: "行业", severity: 2, narrative: "体育用品直播电商行业退货率升至 25%，库存周转与现金流恶化。", targetAssumptions: "A2,A8", isOpportunity: 0, sourceNote: "直播电商退货率行业现象", options: [
      { id: "A", text: "砍 SKU 保爆款", hint: "库存 -40%，选择变少" },
      { id: "B", text: "改预售测款", hint: "现金流稳，起量慢" },
      { id: "C", text: "转线下体验清库存", hint: "清库存，人力成本 +" },
    ]},
    { code: "E12", category: "周期", severity: 1, narrative: "开学季学生消费预算下降，目标客群对价格敏感度明显上升。", targetAssumptions: "A8", isOpportunity: 0, sourceNote: "开学季消费收缩", options: [
      { id: "A", text: "推小额入门产品", hint: "客单价 -30%，客数 +" },
      { id: "B", text: "拉长付款周期", hint: "转化 +，现金流变紧" },
      { id: "C", text: "与社团拼单降单价", hint: "单价 -15%，批量 +" },
    ]},
    { code: "E13", category: "地域", severity: 2, narrative: "桑植红色旅游线路入选省级精品推荐，周边乡镇客流外溢明显。", targetAssumptions: "A2", isOpportunity: 1, sourceNote: "桑植红色旅游入选省级推荐", options: [
      { id: "A", text: "快速上马配套体验产品", hint: "投入 3 万，窗口期抢量" },
      { id: "B", text: "与旅行社签导流协议", hint: "分润 20%，稳定进客" },
      { id: "C", text: "观望不投入", hint: "零风险，错过窗口" },
    ]},
    { code: "E14", category: "地域", severity: 2, narrative: "张家界景区门票与接驳政策调整，地接综合成本上升 12%。", targetAssumptions: "A5,A8", isOpportunity: 0, sourceNote: "张家界景区政策调整", options: [
      { id: "A", text: "提价转嫁", hint: "客单价 +10%，转化 -8%" },
      { id: "B", text: "换线路避开景区", hint: "成本 -，产品吸引力考验" },
      { id: "C", text: "与地接商重谈分润", hint: "毛利 -3%，关系维稳" },
    ]},
    { code: "E15", category: "地域", severity: 2, narrative: "县域农产品直播同质化，同款礼盒 6 家上线，本地特产价格被压。", targetAssumptions: "A8,A1", isOpportunity: 0, sourceNote: "县域农产品直播同质化", options: [
      { id: "A", text: "做品牌故事与包装差异", hint: "投入 +，溢价空间" },
      { id: "B", text: "转 B 端团购", hint: "单价 -，走量稳定" },
      { id: "C", text: "放弃该品类", hint: "止损，品类收窄" },
    ]},
    { code: "E16", category: "地域", severity: 1, narrative: "县域快递首重价格整体上调 15%。", targetAssumptions: "A5", isOpportunity: 0, sourceNote: "县域物流涨价", options: [
      { id: "A", text: "改自提点", hint: "成本归零，体验折损" },
      { id: "B", text: "换快递商谈量价", hint: "成本 +5%，服务差异" },
      { id: "C", text: "运费并入定价", hint: "客单价 +8%，转化微降" },
    ]},
    { code: "E17", category: "经营", severity: 3, narrative: "核心教练被竞对以 1.5 倍薪资挖角，带走部分学员。", targetAssumptions: "A5,A4", isOpportunity: 0, sourceNote: "体育培训行业挖角常见形态", options: [
      { id: "A", text: "紧急谈留任条件", hint: "人力成本 +20%，稳住阵脚" },
      { id: "B", text: "快速招人+老学员安抚", hint: "过渡期波动，成本 +" },
      { id: "C", text: "自己顶课过渡", hint: "成本 -，创始人精力透支" },
    ]},
    { code: "E18", category: "供应链", severity: 2, narrative: "主要原材料与装备采购价上涨 18%，供应商账期从 60 天缩至 30 天。", targetAssumptions: "A5,A8", isOpportunity: 0, sourceNote: "原材料涨价+账期缩短", options: [
      { id: "A", text: "换供应商", hint: "成本 +8%，账期恢复" },
      { id: "B", text: "提前锁价囤货", hint: "现金占用，成本锁定" },
      { id: "C", text: "提价+推组合包", hint: "客单价 +12%，转化考验" },
    ]},
    { code: "E19", category: "经营", severity: 1, narrative: "小程序支付通道与平台服务费率上调，开放平台接口版本变更。", targetAssumptions: "A5", isOpportunity: 0, sourceNote: "平台费率上调", options: [
      { id: "A", text: "接受费率", hint: "成本 +1.5%，零工作量" },
      { id: "B", text: "迁移自建支付页", hint: "一次性投入，长期省" },
      { id: "C", text: "提高客单价摊薄", hint: "客单价 +5%，转化微降" },
    ]},
    { code: "E20", category: "口碑", severity: 3, narrative: "一条客户投诉在本地社群与短视频发酵，24 小时播放破 10 万。", targetAssumptions: "A4,A1", isOpportunity: 0, sourceNote: "本地社群口碑危机", options: [
      { id: "A", text: "24h 内公开回应+补偿", hint: "口碑回升，现金支出" },
      { id: "B", text: "私下和解+删帖", hint: "短平快，二次发酵风险" },
      { id: "C", text: "主动发起服务改进公示", hint: "品牌好感 +，执行压力大" },
    ]},
  ];

  for (const e of events) {
    await db
      .insert(simEvents)
      .values({
        code: e.code,
        category: e.category,
        severity: e.severity,
        narrative: e.narrative,
        targetAssumptions: e.targetAssumptions,
        optionsJson: JSON.stringify(e.options),
        isOpportunity: e.isOpportunity,
        sourceNote: e.sourceNote,
      })
      .onConflictDoNothing();
  }

  const counts = {
    coupons: (await db.select().from(couponDefs)).length,
    modules: (await db.select().from(bpModules)).length,
    events: (await db.select().from(simEvents)).length,
  };
  console.log("seed done:", JSON.stringify(counts));
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
