'use client'

import { useEffect, useMemo, useState } from 'react'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

type Dashboard = {
  generatedAt: string
  summary: { total:number; active:number; inProduction:number; completed:number; overdue:number; dueSoon:number; lowProgress:number; plannedQuantity:number; completedQuantity:number; remainingQuantity:number; progressPercent:number }
  execution: { pending:number; inProgress:number; paused:number; completed:number; actualMinutes:number }
  risks: { id:string; orderNo:string; type:string; label:string; progressPercent:number; dueDate:string|null }[]
  inProduction: { id:string; orderNo:string; productId:string; plannedQuantity:number; completedQuantity:number; progressPercent:number; dueDate:string|null; priority:string }[]
}

const fmt = (n:number) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(n)
const date = (v:string|null) => v ? new Date(v).toLocaleDateString('zh-CN', { month:'2-digit', day:'2-digit' }) : '--'

function Ring({ value }: { value:number }) {
  const safe = Math.max(0, Math.min(100, value)); const r = 48; const c = 2 * Math.PI * r
  return <div style={{ width:132,height:132,position:'relative' }}><svg width="132" height="132" viewBox="0 0 132 132" style={{ transform:'rotate(-90deg)' }}><circle cx="66" cy="66" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="10"/><circle cx="66" cy="66" r={r} fill="none" stroke="url(#cockpitGradient)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${c * safe / 100} ${c}`} /><defs><linearGradient id="cockpitGradient"><stop offset="0%"/><stop offset="100%"/></linearGradient></defs></svg><div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}><strong style={{fontSize:28}}>{safe}%</strong><span style={{fontSize:11,color:'#8ea0b8'}}>总体完成率</span></div></div>
}

export default function ProductionCockpitPage() {
  const t = useT(); const [data,setData] = useState<Dashboard|null>(null); const [error,setError] = useState<string|null>(null); const [loading,setLoading] = useState(true)
  const load = () => { setLoading(true); apiCall<Dashboard>('/api/production-work-orders/dashboard').then(r => setData(r.result ?? null)).catch((e:any)=>setError(e?.message ?? '加载失败')).finally(()=>setLoading(false)) }
  useEffect(() => { load() }, [])
  const health = useMemo(() => { if (!data) return 0; return Math.max(0, Math.min(100, 100 - data.summary.overdue * 12 - data.summary.lowProgress * 5)) }, [data])
  const s = data?.summary
  return <Page>
    <PageHeader title={t('production_work_orders.dashboard.title','生产驾驶舱')} />
    <PageBody>
      <div style={{background:'radial-gradient(circle at 80% 0%, rgba(78,140,255,.22), transparent 35%), radial-gradient(circle at 10% 30%, rgba(120,76,255,.18), transparent 32%), linear-gradient(135deg,#07101f,#0b1324 55%,#10182b)', borderRadius:24, padding:28, color:'#eef5ff', boxShadow:'0 24px 70px rgba(0,0,0,.28)', overflow:'hidden', position:'relative'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:26}}><div><div style={{fontSize:12,letterSpacing:3,color:'#7fa6d9',textTransform:'uppercase'}}>AI · SMART MANUFACTURING</div><h1 style={{margin:'7px 0 4px',fontSize:30,letterSpacing:-1}}>生产运营实时驾驶舱</h1><div style={{color:'#8497b3',fontSize:13}}>订单、进度、工序与交期风险一屏掌控</div></div><button onClick={load} style={{background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.13)',color:'#dce9fb',borderRadius:12,padding:'9px 15px',cursor:'pointer'}}>↻ 刷新数据</button></div>
        {error ? <div role="alert" style={{padding:12,background:'rgba(255,80,100,.12)',border:'1px solid rgba(255,80,100,.25)',borderRadius:12,marginBottom:18}}>{error}</div> : null}
        {loading && !data ? <div style={{padding:60,textAlign:'center',color:'#91a4bf'}}>正在接入生产实时数据…</div> : null}
        {data ? <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:14,marginBottom:14}}>
            {[['工单总数',s!.total,'全部工单',''],['在制工单',s!.inProduction,'实时生产中',''],['已完成',s!.completed,'完工工单',''],['生产健康度',health,'综合运行指数','%']].map(([label,value,sub,suffix],i)=><div key={String(label)} style={{background:'rgba(255,255,255,.055)',border:'1px solid rgba(255,255,255,.09)',borderRadius:18,padding:'18px 20px',backdropFilter:'blur(16px)'}}><div style={{color:'#8fa3c0',fontSize:12}}>{label}</div><div style={{fontSize:31,fontWeight:700,marginTop:8}}>{fmt(Number(value))}{suffix}</div><div style={{fontSize:11,color:'#607693',marginTop:5}}>{sub}</div></div>)}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1.25fr .75fr',gap:14,marginBottom:14}}>
            <div style={{background:'rgba(255,255,255,.055)',border:'1px solid rgba(255,255,255,.09)',borderRadius:18,padding:22}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><div style={{fontSize:14,fontWeight:650}}>生产进度</div><div style={{fontSize:11,color:'#7186a3',marginTop:5}}>计划数量 {fmt(s!.plannedQuantity)} · 已完成 {fmt(s!.completedQuantity)} · 剩余 {fmt(s!.remainingQuantity)}</div></div><Ring value={s!.progressPercent}/></div><div style={{height:8,borderRadius:8,background:'rgba(255,255,255,.08)',overflow:'hidden'}}><div style={{width:`${Math.min(100,s!.progressPercent)}%`,height:'100%',background:'linear-gradient(90deg,#4f8cff,#72d8ff)',borderRadius:8}}/></div></div>
            <div style={{background:'rgba(255,255,255,.055)',border:'1px solid rgba(255,255,255,.09)',borderRadius:18,padding:22}}><div style={{fontSize:14,fontWeight:650,marginBottom:18}}>工序执行态势</div>{[['执行中',data.execution.inProgress],['暂停',data.execution.paused],['待执行',data.execution.pending],['已完成',data.execution.completed]].map(([name,n])=><div key={String(name)} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid rgba(255,255,255,.05)',fontSize:12}}><span style={{color:'#879bb7'}}>{name}</span><strong>{n}</strong></div>)}<div style={{fontSize:11,color:'#657b99',marginTop:13}}>累计实际工时 {fmt(data.execution.actualMinutes)} 分钟</div></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1.15fr .85fr',gap:14}}>
            <div style={{background:'rgba(255,255,255,.055)',border:'1px solid rgba(255,255,255,.09)',borderRadius:18,padding:22}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:15}}><div><div style={{fontSize:14,fontWeight:650}}>在制工单</div><div style={{fontSize:11,color:'#7186a3',marginTop:4}}>实时追踪当前生产任务</div></div><span style={{fontSize:11,color:'#6e8fba'}}>LIVE</span></div>{data.inProduction.length ? data.inProduction.map(r=><div key={r.id} onClick={()=>window.location.href=`/admin/production-work-orders/work-orders/${r.id}`} style={{display:'grid',gridTemplateColumns:'105px 1fr 58px',gap:14,alignItems:'center',padding:'13px 0',borderTop:'1px solid rgba(255,255,255,.055)',cursor:'pointer'}}><div><strong style={{fontSize:12}}>{r.orderNo}</strong><div style={{fontSize:10,color:'#647996',marginTop:3}}>{r.productId}</div></div><div><div style={{height:6,background:'rgba(255,255,255,.08)',borderRadius:6}}><div style={{height:'100%',width:`${Math.min(100,r.progressPercent)}%`,background:'linear-gradient(90deg,#557dff,#60d5c8)',borderRadius:6}}/></div><div style={{fontSize:10,color:'#657b98',marginTop:5}}>{fmt(r.completedQuantity)} / {fmt(r.plannedQuantity)} · 交期 {date(r.dueDate)}</div></div><div style={{textAlign:'right',fontWeight:700,fontSize:13}}>{r.progressPercent}%</div></div>) : <div style={{padding:35,textAlign:'center',color:'#7186a3',fontSize:12}}>当前暂无在制工单</div>}</div>
            <div style={{background:'rgba(255,255,255,.055)',border:'1px solid rgba(255,255,255,.09)',borderRadius:18,padding:22}}><div style={{fontSize:14,fontWeight:650}}>AI 风险雷达</div><div style={{fontSize:11,color:'#7186a3',margin:'4px 0 14px'}}>基于交期、计划与完成量自动识别</div>{data.risks.length ? data.risks.map(r=><div key={`${r.id}-${r.type}`} onClick={()=>window.location.href=`/admin/production-work-orders/work-orders/${r.id}`} style={{padding:'12px 0',borderTop:'1px solid rgba(255,255,255,.055)',cursor:'pointer'}}><div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><strong>{r.orderNo}</strong><span style={{color:r.type==='overdue'?'#ff8d9a':r.type==='dueSoon'?'#ffc66d':'#9bbcff'}}>{r.label}</span></div><div style={{fontSize:10,color:'#657b98',marginTop:5}}>当前完成率 {r.progressPercent}% · 交期 {date(r.dueDate)}</div></div>) : <div style={{padding:35,textAlign:'center',color:'#7186a3',fontSize:12}}>暂无高风险工单，生产运行平稳</div>}</div>
          </div>
        </> : null}
      </div>
    </PageBody>
  </Page>
}
