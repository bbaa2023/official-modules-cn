'use client'

import { useEffect, useMemo, useState } from 'react'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

type Dashboard = {
  generatedAt: string
  summary: { total:number; active:number; inProduction:number; completed:number; overdue:number; dueSoon:number; lowProgress:number; plannedQuantity:number; completedQuantity:number; remainingQuantity:number; progressPercent:number }
  execution: { pending:number; inProgress:number; paused:number; completed:number; actualMinutes:number }
  statusFlow: { status:string; count:number }[]
  risks: { id:string; orderNo:string; type:string; label:string; progressPercent:number; dueDate:string|null }[]
  inProduction: { id:string; orderNo:string; productId:string; plannedQuantity:number; completedQuantity:number; progressPercent:number; dueDate:string|null; priority:string }[]
}

const fmt = (n:number) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(n)
const date = (v:string|null) => v ? new Date(v).toLocaleDateString('zh-CN', { month:'2-digit', day:'2-digit' }) : '--'
const flowLabels: Record<string,string> = { draft:'草稿', planned:'已计划', released:'已下达', in_progress:'生产中', completed:'已完成', cancelled:'已取消' }

function Ring({ value }: { value:number }) {
  const safe = Math.max(0, Math.min(100, value)); const r = 50; const c = 2 * Math.PI * r
  return <div style={{ width:150,height:150,position:'relative',flexShrink:0 }}><svg width="150" height="150" viewBox="0 0 150 150" style={{ transform:'rotate(-90deg)' }}><defs><linearGradient id="cockpitGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%"/><stop offset="100%"/></linearGradient></defs><circle cx="75" cy="75" r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="11"/><circle cx="75" cy="75" r={r} fill="none" stroke="url(#cockpitGradient)" strokeWidth="11" strokeLinecap="round" strokeDasharray={`${c * safe / 100} ${c}`} /></svg><div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}><strong style={{fontSize:30}}>{safe}%</strong><span style={{fontSize:11,color:'#8ea0b8'}}>总体完成率</span></div></div>
}

const glass: React.CSSProperties = { background:'rgba(255,255,255,.055)', border:'1px solid rgba(255,255,255,.09)', borderRadius:18, backdropFilter:'blur(18px)', boxShadow:'inset 0 1px rgba(255,255,255,.035)' }

export default function ProductionCockpitPage() {
  const t = useT(); const [data,setData] = useState<Dashboard|null>(null); const [error,setError] = useState<string|null>(null); const [loading,setLoading] = useState(true)
  const load = () => { setLoading(true); setError(null); apiCall<Dashboard>('/api/production-work-orders/dashboard').then(r => setData(r.result ?? null)).catch((e:any)=>setError(e?.message ?? '加载失败')).finally(()=>setLoading(false)) }
  useEffect(() => { load() }, [])
  const health = useMemo(() => { if (!data) return 0; return Math.max(0, Math.min(100, 100 - data.summary.overdue * 12 - data.summary.lowProgress * 5)) }, [data])
  const s = data?.summary
  return <Page>
    <PageHeader title={t('production_work_orders.dashboard.title','生产驾驶舱')} />
    <PageBody>
      <div style={{background:'radial-gradient(circle at 78% -5%, rgba(74,144,255,.25), transparent 32%),radial-gradient(circle at 8% 45%, rgba(127,76,255,.17), transparent 30%),linear-gradient(135deg,#060d19 0%,#091426 52%,#101a30 100%)',borderRadius:26,padding:28,color:'#eef5ff',boxShadow:'0 28px 90px rgba(0,0,0,.34)',overflow:'hidden',position:'relative'}}>
        <div style={{position:'absolute',inset:0,pointerEvents:'none',background:'linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)',backgroundSize:'44px 44px',maskImage:'linear-gradient(to bottom,black,transparent 75%)'}} />
        <div style={{position:'relative'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:26}}><div><div style={{fontSize:11,letterSpacing:4,color:'#77a9e7',textTransform:'uppercase'}}>AI · SMART MANUFACTURING · COMMAND CENTER</div><h1 style={{margin:'8px 0 5px',fontSize:31,letterSpacing:-1}}>生产运营实时驾驶舱</h1><div style={{color:'#7f93b0',fontSize:13}}>订单 · 进度 · 工序 · 交期 · 风险，一屏掌控生产全局</div></div><div style={{display:'flex',alignItems:'center',gap:12}}><div style={{fontSize:11,color:'#7d91ac'}}><span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:'#55d6b2',boxShadow:'0 0 12px #55d6b2',marginRight:7}}/>实时数据已连接</div><button onClick={load} style={{background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.13)',color:'#dce9fb',borderRadius:12,padding:'9px 15px',cursor:'pointer'}}>↻ 刷新</button></div></div>
          {error ? <div role="alert" style={{padding:12,background:'rgba(255,80,100,.12)',border:'1px solid rgba(255,80,100,.25)',borderRadius:12,marginBottom:18}}>{error}</div> : null}
          {loading && !data ? <div style={{padding:80,textAlign:'center',color:'#91a4bf'}}>正在接入生产实时数据…</div> : null}
          {data ? <>
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:12,marginBottom:14}}>
              {[["工单总数",s!.total,'全部生产任务'],['在制工单',s!.inProduction,'当前生产中'],['已完成',s!.completed,'已完工任务'],['延期风险',s!.overdue,'超过交期'],['低进度',s!.lowProgress,'完成率 < 50%']].map(([label,value,sub])=><div key={String(label)} style={{...glass,padding:'17px 18px'}}><div style={{fontSize:11,color:'#8297b5'}}>{label}</div><div style={{fontSize:28,fontWeight:750,marginTop:7,letterSpacing:-.5}}>{fmt(Number(value))}</div><div style={{fontSize:10,color:'#5f7593',marginTop:5}}>{sub}</div></div>)}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1.22fr .78fr',gap:14,marginBottom:14}}>
              <div style={{...glass,padding:22,minHeight:222}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><div><div style={{fontSize:14,fontWeight:700}}>生产流转态势</div><div style={{fontSize:11,color:'#6e84a2',marginTop:4}}>从计划下达到最终完工的实时状态分布</div></div><span style={{fontSize:10,color:'#6c8ebc',letterSpacing:1}}>PRODUCTION FLOW</span></div><div style={{display:'flex',alignItems:'center',gap:5,marginTop:28}}>{data.statusFlow.filter(x=>['planned','released','in_progress','completed'].includes(x.status)).map((x,i)=><div key={x.status} style={{display:'flex',alignItems:'center',flex:1}}><div style={{flex:1,textAlign:'center'}}><div style={{height:78,borderRadius:14,background:'linear-gradient(180deg,rgba(78,140,255,.15),rgba(78,140,255,.035))',border:'1px solid rgba(102,157,255,.14)',display:'flex',flexDirection:'column',justifyContent:'center'}}><strong style={{fontSize:25}}>{x.count}</strong><span style={{fontSize:10,color:'#7f94b2',marginTop:4}}>{flowLabels[x.status]}</span></div></div>{i<3 ? <span style={{color:'#4c73a5',fontSize:18,padding:'0 4px'}}>›</span>:null}</div>)}</div><div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#5e7491',marginTop:16}}><span>计划数量 {fmt(s!.plannedQuantity)}</span><span>完成 {fmt(s!.completedQuantity)}</span><span>剩余 {fmt(s!.remainingQuantity)}</span></div></div>
              <div style={{...glass,padding:22,display:'flex',alignItems:'center',justifyContent:'space-between'}}><div><div style={{fontSize:14,fontWeight:700}}>生产健康度</div><div style={{fontSize:11,color:'#6e84a2',marginTop:5,lineHeight:1.7}}>综合延期、低进度<br/>与当前生产状态计算</div><div style={{fontSize:11,color:'#55d6b2',marginTop:22}}>● 系统运行中</div></div><Ring value={health}/></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1.05fr .95fr',gap:14}}>
              <div style={{...glass,padding:22}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:15}}><div><div style={{fontSize:14,fontWeight:700}}>在制工单 · 实时追踪</div><div style={{fontSize:11,color:'#6e84a2',marginTop:4}}>当前正在生产的任务与完成进度</div></div><span style={{fontSize:10,color:'#55d6b2',letterSpacing:1}}>● LIVE</span></div>{data.inProduction.length ? data.inProduction.map(r=><div key={r.id} onClick={()=>window.location.href=`/admin/production-work-orders/work-orders/${r.id}`} style={{display:'grid',gridTemplateColumns:'112px 1fr 56px',gap:14,alignItems:'center',padding:'13px 0',borderTop:'1px solid rgba(255,255,255,.055)',cursor:'pointer'}}><div><strong style={{fontSize:12}}>{r.orderNo}</strong><div style={{fontSize:10,color:'#607795',marginTop:4,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.productId}</div></div><div><div style={{height:6,borderRadius:6,background:'rgba(255,255,255,.07)',overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(100,r.progressPercent)}%`,background:'linear-gradient(90deg,#4f83ff,#5ed7c5)',borderRadius:6}}/></div><div style={{fontSize:10,color:'#607795',marginTop:5}}>{fmt(r.completedQuantity)} / {fmt(r.plannedQuantity)} · 交期 {date(r.dueDate)}</div></div><div style={{textAlign:'right',fontWeight:750,fontSize:13}}>{r.progressPercent}%</div></div>) : <div style={{padding:35,textAlign:'center',color:'#7186a3',fontSize:12}}>当前暂无在制工单</div>}</div>
              <div style={{...glass,padding:22}}><div style={{fontSize:14,fontWeight:700}}>AI 风险雷达</div><div style={{fontSize:11,color:'#6e84a2',margin:'4px 0 14px'}}>根据交期、计划量与完成量自动识别异常</div>{data.risks.length ? data.risks.map(r=><div key={`${r.id}-${r.type}`} onClick={()=>window.location.href=`/admin/production-work-orders/work-orders/${r.id}`} style={{padding:'11px 0',borderTop:'1px solid rgba(255,255,255,.055)',cursor:'pointer'}}><div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><strong>{r.orderNo}</strong><span style={{color:r.type==='overdue'?'#ff8d9a':r.type==='dueSoon'?'#ffc66d':'#9bbcff'}}>{r.label}</span></div><div style={{fontSize:10,color:'#607795',marginTop:5}}>完成率 {r.progressPercent}% · 交期 {date(r.dueDate)}</div></div>) : <div style={{padding:35,textAlign:'center',color:'#7186a3',fontSize:12}}>暂无高风险工单，生产运行平稳</div>}</div>
            </div>
            <div style={{...glass,padding:'15px 20px',marginTop:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{display:'flex',gap:28,fontSize:11,color:'#7288a5'}}><span>工序执行中 <b style={{color:'#a8c8ff'}}>{data.execution.inProgress}</b></span><span>暂停 <b style={{color:'#ffc66d'}}>{data.execution.paused}</b></span><span>待执行 <b style={{color:'#91a6c3'}}>{data.execution.pending}</b></span><span>已完成 <b style={{color:'#63d5bf'}}>{data.execution.completed}</b></span></div><span style={{fontSize:10,color:'#5d7492'}}>累计实际工时 {fmt(data.execution.actualMinutes)} 分钟 · {new Date(data.generatedAt).toLocaleTimeString('zh-CN')}</span></div>
          </> : null}
        </div>
      </div>
    </PageBody>
  </Page>
}
