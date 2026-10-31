import { PageHeader, Card, EmptyState } from "@/components/ui";

export default function ReviewPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader
        title="抽样覆核"
        subtitle="闸门 2：20% 抽样。重点看低分证据是否成立、改写率是否注水。"
      />
      <div className="space-y-4">
        <Card title="待覆核队列" accent>
          <EmptyState
            label="暂无待覆核记录"
            hint="学生写记录卡后自动入池；低分（≤2）卡 100% 入池"
          />
        </Card>
        <Card title="口试答辩抽查名单">
          <EmptyState
            label="期末生成"
            hint="系统按「决策理由链薄弱 + 改写率低」自动提名候选人"
          />
        </Card>
        <Card title="覆核记录">
          <EmptyState label="暂无覆核记录" />
        </Card>
      </div>
    </main>
  );
}
