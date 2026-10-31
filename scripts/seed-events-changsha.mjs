/**
 * 播种事件库 v2 —— 长沙体育新城情境（20 条）
 *
 * 背景设定：湖南体育职业学院学生创业，项目落在长沙市雨花区体育新城一带，
 * 业态为青少年体育培训 / 场馆时段运营 / 赛事与团建承接。
 *
 * 每条事件三个策略选项，hint 为该选项的推演结果（跑机结算时直接呈现）。
 * 用法：node scripts/seed-events-changsha.mjs
 */
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "harness.db");
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");

const EVENTS = [
  {
    code: "E01", category: "天气", severity: 3, opp: 0, target: "A2,A3",
    narrative: "长沙进入梅雨季，连续 20 天降雨，体育新城周边室外篮球场、足球场全部停用，已售课时包无法履约，家长开始要求退费。",
    options: [
      { id: "A", text: "把室外课全部改到室内羽毛球馆，向家长承诺课时顺延不退费", hint: "场地成本翻倍，但保住了约 8 成课时，现金流没断。" },
      { id: "B", text: "主动给家长办理顺延，并赠送 2 节室内课", hint: "口碑明显变好，但当季现金流缺口约 2 万元。" },
      { id: "C", text: "暂停课程，等雨季结束再开课", hint: "退费率冲到 40%，白白流失一批最忠诚的客户。" },
    ],
    note: "长沙梅雨季 · 室外场地停摆",
  },
  {
    code: "E02", category: "天气", severity: 2, opp: 0, target: "A2,A5",
    narrative: "7 月连续高温红色预警，白天室外场地地表温度超过 50℃，日间时段几乎全部空置。",
    options: [
      { id: "A", text: "把课时全部挪到早 7 点前和晚 7 点后", hint: "家长接送不便，出勤率掉到 55%。" },
      { id: "B", text: "把日间时段改做室内体能与游泳课", hint: "游泳馆分成吃掉三成毛利，但时段利用率明显上来了。" },
      { id: "C", text: "日间时段低价出租给企业团建", hint: "薄利但填满了空置时段，还带来 3 个长期团建客户。" },
    ],
    note: "长沙夏季高温 · 日间时段空置",
  },
  {
    code: "E03", category: "天气", severity: 2, opp: 0, target: "A3,A4",
    narrative: "寒潮来袭，青少年感冒高发，连续两周到课率不足四成，家长普遍要求暂停课时包计时。",
    options: [
      { id: "A", text: "推出线上跟练打卡，课时照常消耗", hint: "家长配合度两极分化，约三成认为线上不该算课。" },
      { id: "B", text: "主动停课并顺延课时包", hint: "口碑好，但当月收入直接少一个月。" },
      { id: "C", text: "把这两周改做室内体能测评，按次单独收费", hint: "测评转化了 12 个续报客户，淡季反而变成获客窗口。" },
    ],
    note: "寒潮 · 出勤率骤降",
  },
  {
    code: "E04", category: "政策", severity: 3, opp: 0, target: "A2,A6",
    narrative: "体育类校外培训预收费新规落地：单次收费不得超过 3 个月，且须进入银行资金托管账户，次月起执行。",
    options: [
      { id: "A", text: "立刻改为按月收费，彻底放弃长课时包", hint: "现金流立刻紧张，但完全合规，避开了后续查验风险。" },
      { id: "B", text: "把课时包拆成 3 个月一期，到期再收下一期", hint: "合规了，但续报工作量翻倍，漏续率约 15%。" },
      { id: "C", text: "继续卖长包，只是换成签多份短期合同", hint: "被家长举报，托管账户被冻结，信誉严重受损。" },
    ],
    note: "预收费监管 · 现金流模式冲击",
  },
  {
    code: "E05", category: "政策", severity: 2, opp: 0, target: "A1,A2",
    narrative: "长沙市中考体育方案调整，球类项目分值下调，长跑与跳绳权重提高，家长需求结构一夜之间变化。",
    options: [
      { id: "A", text: "两周内开出一期长跑跳绳冲刺班", hint: "吃到了第一波需求，但教练储备不足，教学质量有波动。" },
      { id: "B", text: "维持球类主业，不追政策热点", hint: "老客户稳定，但新增咨询量掉了三成。" },
      { id: "C", text: "与初中体育老师合作，进校做课后长跑训练", hint: "拿到稳定的校内流量，但利润率被渠道分走一半。" },
    ],
    note: "中考体育改革 · 需求结构突变",
  },
  {
    code: "E06", category: "政策", severity: 2, opp: 0, target: "A8,A1",
    narrative: "体育新城片区新落成两处公办全民健身场馆，晚间时段低价对外开放，一批价格敏感型家长转向。",
    options: [
      { id: "A", text: "跟着降价，把客单价压到公办场馆的 1.5 倍", hint: "保住了部分客户，但毛利被压到几乎不赚钱。" },
      { id: "B", text: "不降价，把差异化全压到教练固定和课后视频反馈上", hint: "流失两成价格敏感客户，剩下的客单价反而提高了。" },
      { id: "C", text: "转做公办场馆做不了的：中考专项与体态矫正", hint: "避开正面价格战，客单价提升 40%。" },
    ],
    note: "公办场馆低价分流",
  },
  {
    code: "E07", category: "政策", severity: 3, opp: 0, target: "A5,A7",
    narrative: "消防与办学资质抽查，你长期租用的那间训练场馆被认定不符合培训场所要求，限期停用。",
    options: [
      { id: "A", text: "立刻搬到合规场馆，接受租金上涨", hint: "固定成本上涨 25%，但保住了全部在读学员。" },
      { id: "B", text: "让学生暂时分散到几个合作场馆上课", hint: "教学体验明显下降，退费率上升。" },
      { id: "C", text: "暂停招生，先完成场地整改", hint: "合规了，但停摆两个月，现金流几近断裂。" },
    ],
    note: "场地合规 · 经营中断风险",
  },
  {
    code: "E08", category: "市场", severity: 3, opp: 0, target: "A1,A8",
    narrative: "竞对在体育新城三公里内连开两家少儿篮球馆，暑期班直接降价 30%，你的咨询量两周内掉了四分之一。",
    options: [
      { id: "A", text: "跟着降价 30%，硬扛", hint: "保住了咨询量，但每课时毛利被削掉近一半。" },
      { id: "B", text: "不降价，把预算全部投向家长转介绍和续报", hint: "新客减少，但老客续报率提高到 75%，现金流反而更稳。" },
      { id: "C", text: "推出竞对没有的体态测评与训练反馈报告", hint: "差异化立住了，客单价守住，但获客成本上升。" },
    ],
    note: "同城竞对 · 价格战",
  },
  {
    code: "E09", category: "市场", severity: 2, opp: 0, target: "A1,A8",
    narrative: "体育中考培训需求爆发，但家长只问一句「能不能保证提分」，你无法承诺结果，咨询转化很低。",
    options: [
      { id: "A", text: "承诺不提分全额退款", hint: "转化率上去了，但期末退款压力巨大，且存在合规风险。" },
      { id: "B", text: "不承诺结果，改为公开往期学员的提分数据", hint: "转化慢一些，但来的都是认可你的家长，退费极少。" },
      { id: "C", text: "与学校体育组合作，进入校内课后服务", hint: "拿到稳定生源，但议价权在校方，利润被压薄。" },
    ],
    note: "结果导向需求 · 转化难题",
  },
  {
    code: "E10", category: "市场", severity: 2, opp: 1, target: "A2,A5",
    narrative: "体育新城周边企业集中，年底团建与趣味运动会订单涌来，单笔金额是少儿课时包的 5 倍以上，但账期普遍 60 天。",
    options: [
      { id: "A", text: "接下所有订单，先垫资", hint: "营收翻倍，但应收账款占压现金流，当月发薪非常紧张。" },
      { id: "B", text: "只接预付款不低于 50% 的订单", hint: "丢了几笔大单，但现金流健康，没有坏账。" },
      { id: "C", text: "把团建外包给兼职团队，自己抽成", hint: "轻资产拿到收入，但服务质量失控，坏了两次口碑。" },
    ],
    note: "B 端机会 · 账期风险",
  },
  {
    code: "E11", category: "行业", severity: 3, opp: 0, target: "A5,A7",
    narrative: "你最受欢迎的两名教练被竞对以 1.5 倍薪资挖走，带走约 30 名在读学员。",
    options: [
      { id: "A", text: "立刻加薪留住剩下的教练", hint: "人力成本上涨 20%，但学员没有继续流失。" },
      { id: "B", text: "不做挽留，48 小时内招满并启用新教练", hint: "成本没涨，但家长对换教练强烈不满，退费增加。" },
      { id: "C", text: "改成教练合伙人制，给课时分成与学员留存奖励", hint: "当月成本上升，但半年内教练流失率降到接近零。" },
    ],
    note: "核心人力流失",
  },
  {
    code: "E12", category: "周期", severity: 2, opp: 0, target: "A2,A3",
    narrative: "寒假结束到春季开学是全年最淡的两个月，课时消耗骤降，而场馆租金和教练底薪照付。",
    options: [
      { id: "A", text: "淡季裁员，只留核心教练", hint: "成本压下来了，但旺季来临重新招人，质量不稳定。" },
      { id: "B", text: "淡季改做教练培训与课程研发，不裁员", hint: "当月亏损，但旺季课程质量明显提升，续报率提高。" },
      { id: "C", text: "淡季推低价体验包冲现金流", hint: "现金流转正，但低价客户续报率低，还挤占了旺季产能。" },
    ],
    note: "淡旺季 · 现金流断档",
  },
  {
    code: "E13", category: "地域", severity: 2, opp: 0, target: "A1,A3",
    narrative: "体育新城主干道地铁施工围挡半年，家长接送需步行 15 分钟，到店客流下降三成。",
    options: [
      { id: "A", text: "加开社区接驳电瓶车，免费接送", hint: "每月多花 6000 元，但客流基本保住了。" },
      { id: "B", text: "把部分课程改为上门小班，去家长所在小区", hint: "省了场地费，但教练路上时间翻倍，人均带课量下降。" },
      { id: "C", text: "不做补偿，等施工结束", hint: "省了成本，但半年里流失近三成客户，很难再拉回来。" },
    ],
    note: "市政施工 · 到店客流受阻",
  },
  {
    code: "E14", category: "地域", severity: 1, opp: 1, target: "A1,A3",
    narrative: "体育新城东侧三个新楼盘集中交付，一批 30-40 岁的年轻家庭入住，其中不少是小学到初中孩子的家长。",
    options: [
      { id: "A", text: "在三个小区门口做免费体态测评，导流到体验课", hint: "获客成本降到平时的三分之一，当月新增体验客户 60 个。" },
      { id: "B", text: "与小区物业合作，包下周末空地做亲子运动会", hint: "品牌进得快，但转化周期长，当月直接收入很少。" },
      { id: "C", text: "不主动出击，等自然客流", hint: "最省力，但被其他机构抢先占领了这个片区。" },
    ],
    note: "新盘交付 · 客源涌入",
  },
  {
    code: "E15", category: "经营", severity: 3, opp: 0, target: "A4,A6",
    narrative: "一名家长在本地业主群发帖称「教练态度差、孩子不想去」，24 小时内跟帖 40 多条，并要求退剩余课时。",
    options: [
      { id: "A", text: "公开道歉并全额退费，更换教练", hint: "直接损失两期学费，但舆情两天内平息。" },
      { id: "B", text: "私下沟通，只退未上课时", hint: "成本最低，但群里仍在发酵，后续咨询量明显下滑。" },
      { id: "C", text: "不回应，等热度过去", hint: "省了一次退费，但被截图扩散到本地论坛，三个月口碑受损。" },
    ],
    note: "本地社群口碑危机",
  },
  {
    code: "E16", category: "供应链", severity: 2, opp: 0, target: "A5,A7",
    narrative: "场馆方通知下季度租金上调 20%，且不再续约非黄金时段，你原本依靠的低价时段没了。",
    options: [
      { id: "A", text: "接受涨价，把成本转嫁到客单价", hint: "老客户因涨价流失约 10%，但单位毛利守住了。" },
      { id: "B", text: "换到更远的场馆，租金便宜 30%", hint: "成本下来了，但接送不便导致流失 15% 客户。" },
      { id: "C", text: "签独家长约锁定三年租金", hint: "锁住了成本，但押上三年现金流，抗风险能力下降。" },
    ],
    note: "场地成本上涨",
  },
  {
    code: "E17", category: "经营", severity: 2, opp: 0, target: "A4,A7",
    narrative: "兼职教练同时接三家机构的课，排班冲突频繁，一个月内临时调课 8 次，家长开始抱怨。",
    options: [
      { id: "A", text: "把兼职教练改为固定排班制，保证课时量", hint: "人力成本上升，但调课基本消失，续报率回升。" },
      { id: "B", text: "全部改用全职教练", hint: "成本大涨，但教学质量和反馈一致性最好。" },
      { id: "C", text: "维持兼职模式，增加备选教练池", hint: "成本最低，但教学质量仍然波动，口碑被慢慢消耗。" },
    ],
    note: "排班冲突 · 教学稳定性",
  },
  {
    code: "E18", category: "口碑", severity: 1, opp: 1, target: "A1,A4",
    narrative: "一位学员在市级青少年比赛中拿了名次，家长主动在本地社群晒了成绩。",
    options: [
      { id: "A", text: "立刻做成案例，办一场小型成果展示日", hint: "当月咨询量翻倍，转化率明显提升。" },
      { id: "B", text: "只在自己的家长群低调发布", hint: "稳，但白白浪费了一次扩大影响的机会。" },
      { id: "C", text: "主动联系本地媒体报道", hint: "曝光量大，但被质疑过度营销，反而引起反感。" },
    ],
    note: "学员成果 · 口碑放大机会",
  },
  {
    code: "E19", category: "政企", severity: 1, opp: 1, target: "A2,A6",
    narrative: "区教育局公开招标课后体育服务，覆盖体育新城周边 6 所初中，合同期一年。",
    options: [
      { id: "A", text: "全力投标，压低报价拿入场券", hint: "拿到稳定收入和校内流量，但利润率只有平时的六成。" },
      { id: "B", text: "联合另外两家机构组成联合体投标", hint: "资质补齐并中标，但收入要分两家，管理成本上升。" },
      { id: "C", text: "不投标，专注自己的 C 端客户", hint: "没被合同绑住，但也错过了校内流量入口。" },
    ],
    note: "政企采购 · 校内流量入口",
  },
  {
    code: "E20", category: "行业", severity: 1, opp: 1, target: "A8,A3",
    narrative: "家长群里开始频繁问体态问题：驼背、脊柱侧弯、长短腿。本地几乎没有专门做青少年体态矫正的机构。",
    options: [
      { id: "A", text: "送教练去考资质，三个月后开体态矫正课", hint: "客单价是普通课时的 2 倍，成为第二增长曲线。" },
      { id: "B", text: "直接引进外部康复师合作分成", hint: "上线快，但利润被分走一半，且质量不受你控制。" },
      { id: "C", text: "先做免费体态测评，攒够案例再开课", hint: "上线慢，但用真实案例说话，家长期待值管理得最好。" },
    ],
    note: "业态升级 · 高毛利新业务",
  },
];

const del = sqlite.prepare("DELETE FROM sim_events");
const ins = sqlite.prepare(
  `INSERT INTO sim_events (code, category, severity, narrative, target_assumptions, options_json, is_opportunity, source_note, active)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
);

sqlite.transaction(() => {
  del.run();
  for (const e of EVENTS) {
    ins.run(
      e.code,
      e.category,
      e.severity,
      e.narrative,
      e.target,
      JSON.stringify(e.options),
      e.opp,
      e.note
    );
  }
})();

console.log("seeded events:", EVENTS.length);
for (const e of EVENTS) {
  console.log(
    ` ${e.code} ${e.opp ? "机会" : "威胁"} ${e.category} 严重度${e.severity} | ${e.narrative.slice(0, 26)}…`
  );
}
sqlite.close();
