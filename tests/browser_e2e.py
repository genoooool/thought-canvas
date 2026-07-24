"""Browser acceptance gates for Thought Canvas v12.5.

The execution environment blocks browser access to localhost. This suite therefore
runs the real UI against an in-page API implementation with the same v12.5 routes.
The Node/local-file integration is covered separately by local-api-test.mjs.
"""
from pathlib import Path
import json
import os
import re
import time
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DEBUG = os.environ.get("TC_E2E_DEBUG", "1") != "0"
CHECKPOINT_STARTED = time.monotonic()
CHECKPOINT_LAST = CHECKPOINT_STARTED


def checkpoint(label):
    global CHECKPOINT_LAST
    if DEBUG:
        current = time.monotonic()
        print(f"[browser-e2e] {label} +{current-CHECKPOINT_LAST:.2f}s total={current-CHECKPOINT_STARTED:.2f}s", flush=True)
        CHECKPOINT_LAST = current

API_MOCK = r'''
const browserDefaultProvider={
  id:'deepseek',name:'DeepSeek 官方',protocol:'openai-chat',baseUrl:'https://api.deepseek.com',builtIn:true,enabled:true,category:'官方',authMode:'bearer',reasoningMode:'deepseek',connectionStatus:'connected',connectionDetail:'',
  models:[
    {id:'deepseek-v4-flash',label:'DeepSeek V4 Flash',reasoningEfforts:['none','high','max'],supportedReasoningEfforts:['none','high','max'],defaultReasoningEffort:'high',isDefault:true},
    {id:'deepseek-v4-pro',label:'DeepSeek V4 Pro',reasoningEfforts:['none','high','max'],supportedReasoningEfforts:['none','high','max'],defaultReasoningEffort:'high'}
  ],testModel:'deepseek-v4-flash',lastModelSyncAt:'2026-07-23T10:00:00.000Z'
};
const browserDefaultSettings={version:'1.2.5',uiLanguage:'zh-CN',providers:[browserDefaultProvider],defaultProvider:'deepseek',defaultModel:'deepseek-v4-flash',defaultReasoningEffort:'high',mergeProvider:'deepseek',mergeModel:'deepseek-v4-flash',mergeReasoningEffort:'high'};
window.__apiState = window.__apiSeed || {settings:browserDefaultSettings,secretStatus:{deepseek:true},projects:{},backups:{},activeProjectId:"",requests:[]};
window.__apiState.requests=window.__apiState.requests||[];
window.__apiState.backups=window.__apiState.backups||{};
window.__apiState.codex=window.__apiState.codex||{installed:true,loggedIn:false,sessions:{},account:null,models:[]};
const SESSION_TOKEN='browser-gate-session';
const clone=x=>JSON.parse(JSON.stringify(x));
const now=()=>new Date().toISOString();
window.__openedUrls=window.__openedUrls||[];
window.open=(initialUrl='')=>{
  const popup={closed:false,_href:String(initialUrl||''),close(){this.closed=true;}};
  popup.location={get href(){return popup._href;},set href(value){popup._href=String(value||'');window.__openedUrls.push(popup._href);}};
  if(initialUrl)window.__openedUrls.push(String(initialUrl));
  return popup;
};
const codexAccount={type:'chatgpt',email:'codex.ui@example.com',planType:'plus',credentialSource:'codex-cli'};
const codexModels=[
  {id:'gpt-5.6-codex',displayName:'GPT-5.6 Codex',supportedReasoningEfforts:['low','medium','high','xhigh'],defaultReasoningEffort:'high',isDefault:true,inputModalities:['text','image']},
  {id:'gpt-5.5-codex-mini',displayName:'GPT-5.5 Codex Mini',supported_reasoning_efforts:['low','medium','high'],default_reasoning_effort:'medium',input_modalities:['text']}
];
const indexEntry=p=>({id:p.projectId,title:p.projectTitle||'未命名项目',goal:p.goal?.text||'',summary:p.nodes?.[0]?.summary||'',nodeCount:p.nodes?.length||0,createdAt:p.projectCreatedAt||'',updatedAt:p.projectUpdatedAt||''});
const splitSections=text=>{
  text=String(text||'').trim();
  const re=/^(#{1,4})\s+(.+)$/gm, ms=[...text.matchAll(re)], out=[];
  if(ms.length){
    for(let i=0;i<ms.length;i++){
      const start=ms[i].index+ms[i][0].length, end=i+1<ms.length?ms[i+1].index:text.length;
      const source=text.slice(start,end).trim(); if(source.length<8)continue;
      const sourceStart=text.indexOf(source,start);
      out.push({title:ms[i][2].trim(),summary:source.replace(/\s+/g,' ').slice(0,180),sourceText:source,content:source,sourceStart,sourceEnd:sourceStart+source.length,order:out.length});
    }
  }
  if(out.length)return out.slice(0,8);
  return text ? [{title:'所选原文',summary:text.slice(0,180),sourceText:text,content:text,sourceStart:0,sourceEnd:text.length,order:0}] : [];
};
const ok=(payload,status=200)=>({ok:status>=200&&status<300,status,json:async()=>clone(payload),text:async()=>JSON.stringify(payload)});
const encoder=new TextEncoder();
const streamOk=(events,{delay=10,signal}={})=>new Response(new ReadableStream({
  start(controller){
    let index=0,timer=null,closed=false;
    const abort=()=>{if(closed)return;closed=true;if(timer)clearTimeout(timer);controller.error(new DOMException('The operation was aborted.','AbortError'));};
    signal?.addEventListener('abort',abort,{once:true});
    const pump=()=>{
      if(closed)return;
      if(signal?.aborted)return abort();
      if(index>=events.length){closed=true;signal?.removeEventListener('abort',abort);controller.close();return;}
      controller.enqueue(encoder.encode(JSON.stringify(events[index++])+'\n'));
      timer=setTimeout(pump,delay);
    };
    pump();
  },
  cancel(){/* reader cancellation is intentionally a no-op in the in-page mock */}
}),{status:200,headers:{'content-type':'application/x-ndjson'}});
const streamEvents=(text,{meta=null,size=48}={})=>{
  const events=[{type:'start',requestId:'mock_'+Date.now()}];
  for(let i=0;i<text.length;i+=size)events.push({type:'delta',text:text.slice(i,i+size)});
  if(meta)events.push({type:'meta',...meta});
  events.push({type:'done',textLength:text.length});
  return events;
};
const initialAnswer='## 核心判断\n\n> **核心区别**\n> 普通人卖内容，高维玩家控制客户、数据与交易。\n\n## 1. 自营内容与交易\n\n使用低成本内容能力运营账号、联盟带货或自营商品。优势是启动直接，风险是同时承担选品、流量和转化。\n\n## 2. 产品化与基础设施\n\n把稳定的视频工作流包装为服务、SaaS 或 API。价值来自替客户降低组织生产的成本，而不是只提供一次生成。\n\n## 3. 行业工作流与结果交付\n\n选择一个行业，连接商品资料、品牌规则、发布、投放和成交数据，按持续结果收费。\n\n## 4. 数据、渠道与责任\n\n更长期的壁垒来自真实业务数据、客户入口、授权资产和对结果负责的能力。\n\n```js\nconsole.log("copy me")\n```';
const generatedReply=prompt=>{
  prompt=String(prompt||'');
  if(prompt.includes('继续完成上一条被停止的回答'))return '## 续写完成\n\n这里承接已有部分，补齐剩余判断、风险和下一步，不重复开头。';
  if(prompt.includes('停止测试'))return '## 可中止的长回答\n\n'+Array.from({length:48},(_,i)=>`### 分段 ${i+1}\n\n这是第 ${i+1} 段增量内容，用于验证停止生成后保留部分输出，并能从同一条消息继续。`).join('\n\n');
  if(prompt.includes('北极星17')&&prompt.includes('项目代号是什么'))return '## 直接回答\n\n项目代号是 **北极星17**。\n\n这个事实来自父节点上下文。\n\n'+Array.from({length:22},(_,i)=>`### 补充 ${i+1}\n\n这是用于验证分支面板从顶部开始、正文随面板宽度自动换行的说明段落。`).join('\n\n');
  return '## 进一步解释\n\n这是当前分支的完整回答。\n\n> **结论**\n> 这个答案可以独立拆解。\n\n```text\n可复制示例\n```';
};
window.fetch=async(url,opts={})=>{
  const path=new URL(String(url),'http://local.test').pathname.replace(/\/+$/,'')||'/';
  const method=(opts.method||'GET').toUpperCase();
  let body={};try{body=JSON.parse(opts.body||'{}')}catch{}
  const sessionHeader=new Headers(opts.headers||{}).get('x-thought-canvas-session')||'';
  if(['POST','PUT','PATCH','DELETE'].includes(method)&&sessionHeader!==SESSION_TOKEN)return ok({error:'本地运行会话已失效，请刷新页面后重试。',code:'SESSION_REQUIRED'},401);
  if(['/api/analyze','/api/generate','/api/analyze-stream','/api/generate-stream','/api/synthesize','/api/provider-secret'].includes(path))window.__apiState.requests.push({path,body:clone(body),sessionHeader,at:now()});
  if(path==='/api/health')return ok({ok:true,version:'1.2.5'});
  if(path==='/api/local-config'&&method==='GET')return ok({settings:clone(window.__apiState.settings),secretStatus:clone(window.__apiState.secretStatus),storage:{envFile:'.env.local',settingsFile:'data/settings.local.json'}});
  if(path==='/api/local-config'&&method==='POST'){window.__apiState.settings=clone(body.settings||{});return ok({ok:true,settings:clone(window.__apiState.settings)});}
  if(path==='/api/provider-secret'&&method==='POST'){if(!body.clear)return ok({error:'API Key 只能通过连接并同步模型验证成功后保存。'},400);delete window.__apiState.secretStatus[body.providerId];return ok({ok:true,providerId:body.providerId,hasKey:false});}
  if(path==='/api/workspace')return ok({projects:Object.values(window.__apiState.projects).map(indexEntry).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))),activeProjectId:window.__apiState.activeProjectId,storage:{projectsDir:'data/projects',backupsDir:'data/backups'}});
  if(path==='/api/active-project'&&method==='POST'){window.__apiState.activeProjectId=body.projectId||'';return ok({ok:true,activeProjectId:window.__apiState.activeProjectId});}
  let m=path.match(/^\/api\/projects\/([^/]+)\/backups$/);
  if(m&&method==='GET'){
    const items=window.__apiState.backups[m[1]]||[];
    return ok({projectId:m[1],backups:items.map(item=>({id:item.id,createdAt:item.createdAt,size:JSON.stringify(item.project).length,project:indexEntry(item.project),projectUpdatedAt:item.project.projectUpdatedAt||''}))});
  }
  m=path.match(/^\/api\/projects\/([^/]+)\/restore$/);
  if(m&&method==='POST'){
    const items=window.__apiState.backups[m[1]]||[],found=items.find(item=>item.id===body.backupId);
    if(!found)return ok({error:'备份不存在或已被清理。'},404);
    const current=window.__apiState.projects[m[1]];
    if(current)items.unshift({id:`${m[1]}.restore-${Date.now()}.json`,createdAt:now(),project:clone(current)});
    const restored=clone(found.project);restored.projectId=m[1];restored.version='1.2.5';restored.projectUpdatedAt=now();restored.restoredFromBackup=found.id;restored.restoredAt=restored.projectUpdatedAt;
    window.__apiState.projects[m[1]]=restored;
    return ok({ok:true,project:clone(restored),index:indexEntry(restored),restoredFrom:found.id});
  }
  m=path.match(/^\/api\/projects\/([^/]+)$/);
  if(m&&method==='GET'){const p=window.__apiState.projects[m[1]];return p?ok({project:clone(p)}):ok({error:'项目不存在'},404);}
  if(m&&method==='POST'){
    const existing=window.__apiState.projects[m[1]];
    if(existing&&body.createBackup!==false){const items=window.__apiState.backups[m[1]]||(window.__apiState.backups[m[1]]=[]);if(!items.length)items.push({id:`${m[1]}.${Date.now()}-${Math.random().toString(36).slice(2,6)}.json`,createdAt:now(),project:clone(existing)});}
    const p=clone(body.project||body);p.projectId=m[1];p.version='1.2.5';window.__apiState.projects[m[1]]=p;return ok({ok:true,project:indexEntry(p),storageFile:`data/projects/${m[1]}.json`});
  }
  if(m&&method==='DELETE'){delete window.__apiState.projects[m[1]];delete window.__apiState.backups[m[1]];if(window.__apiState.activeProjectId===m[1])window.__apiState.activeProjectId='';return ok({ok:true});}
  if(path==='/api/analyze'&&method==='POST')return ok({goalSuggestion:'验证 AI 视频商业化路径并形成可执行判断',answer:initialAnswer,manualDecompose:true});
  if(path==='/api/analyze-stream'&&method==='POST')return streamOk(streamEvents(initialAnswer,{meta:{goalSuggestion:'验证 AI 视频商业化路径并形成可执行判断',manualDecompose:true}}),{delay:8,signal:opts.signal});
  if(path==='/api/generate'&&method==='POST')return ok({text:generatedReply(body.prompt)});
  if(path==='/api/generate-stream'&&method==='POST'){
    const prompt=String(body.prompt||''),text=generatedReply(prompt),slow=prompt.includes('停止测试');
    return streamOk(streamEvents(text,{size:slow?34:56}),{delay:slow?70:7,signal:opts.signal});
  }
  if(path==='/api/decompose'&&method==='POST'){
    const text=String(body.text||body.answer||'').trim();
    if(!text)return ok({error:'缺少待拆解内容'},400);
    return ok({sections:splitSections(text)});
  }
  m=path.match(/^\/api\/projects\/([^/]+)\/nodes\/([^/]+)\/messages\/([^/]+)\/decompose$/);
  if(m&&method==='POST'){
    const p=window.__apiState.projects[m[1]], n=p?.nodes?.find(x=>x.id===m[2]), msg=n?.messages?.find(x=>x.id===m[3]&&x.role==='assistant');
    if(!msg)return ok({error:'这条回答已被删除，无法拆解。'},404);
    const text=body.scope==='selection'?String(body.selectedText||'').trim():String(msg.content||'').trim();
    if(body.scope==='selection'&&!text)return ok({error:'尚未选择文字。'},400);
    return ok({sections:splitSections(text),binding:{projectId:m[1],nodeId:m[2],messageId:m[3]}});
  }
  m=path.match(/^\/api\/projects\/([^/]+)\/nodes\/([^/]+)\/organize$/);
  if(m&&method==='POST')return ok({organized:'## 当前讨论主题\n\nAI 视频商业化路径。\n\n## 已确认结论\n\n应先验证客户、数据与交易闭环。\n\n## 被修改或推翻的判断\n\n- 暂无。\n\n## 尚未解决的问题\n\n- 首个客户来自哪里？\n\n## 推荐下一步\n\n阅读后决定是否手动拆解。',result:{topic:'AI 视频商业化路径',confirmedConclusions:['验证闭环'],keyArguments:[],revisedOrRejectedJudgments:[],openQuestions:['首个客户来自哪里？'],recommendedNextStep:'手动决定是否拆解'}});
  m=path.match(/^\/api\/projects\/([^/]+)\/nodes\/([^/]+)\/compact$/);
  if(m&&method==='POST'){
    const n=window.__apiState.projects[m[1]]?.nodes?.find(x=>x.id===m[2]);const ids=(n?.messages||[]).map(x=>x.id);
    const transcript=(n?.messages||[]).map(x=>x.content).join('\n');
    return ok({compact:{summary:transcript.slice(-5000),confirmedConclusions:['保留关键结论'],openQuestions:[],rejectedAssumptions:[],importantUserConstraints:[],coveredMessageIds:ids}});
  }
  if(path==='/api/synthesize'&&method==='POST')return ok({text:'## 共同点\n\n所选节点都服务于同一目标。\n\n## 不同点\n\n各自控制的资源不同。\n\n## 综合结论\n\n优先验证最短闭环。'});
  if(path==='/api/providers/connect'&&method==='POST'){
    window.__apiState.requests.push({path,body:clone(body),sessionHeader,at:now()});
    const providerId=String(body.config?.providerId||'custom-ui');
    const suppliedKey=String(body.apiKey||'');
    if(suppliedKey==='bad-ui-key')return ok({error:'bad auth'},502);
    if(!suppliedKey&&!window.__apiState.secretStatus[providerId]&&body.config?.authMode!=='none')return ok({error:'缺少 API Key'},400);
    if(suppliedKey)window.__apiState.secretStatus[providerId]=true;
    const models=providerId==='deepseek' ? [
      {id:'deepseek-v4-flash',label:'DeepSeek V4 Flash',supportedReasoningEfforts:['none','high','max'],defaultReasoningEffort:'high',isDefault:true},
      {id:'deepseek-v4-pro',label:'DeepSeek V4 Pro',supportedReasoningEfforts:['none','high','max'],defaultReasoningEffort:'high'},
      {id:'deepseek-reasoner-ui',label:'DeepSeek Reasoner UI',supportedReasoningEfforts:['high','max'],defaultReasoningEffort:'max'}
    ] : [
      {id:'ui-reasoning-model',label:'UI Reasoning Model',supportedReasoningEfforts:['low','medium','high'],defaultReasoningEffort:'medium',isDefault:true},
      {id:'ui-basic-model',label:'UI Basic Model'}
    ];
    return ok({ok:true,hasKey:!!window.__apiState.secretStatus[providerId],models,preferredModel:models[0].id,preview:'CONNECTION_OK',catalogSource:'remote_catalog',catalogWarning:'',latencyMs:9,syncedAt:now(),connection:{status:'connected',modelCount:models.length,syncedAt:now(),catalogSource:'remote_catalog',warning:''}});
  }
  if(path==='/api/test-provider'&&method==='POST')return ok({ok:true,status:200,latencyMs:8,preview:'CONNECTION_OK'});
  if(path==='/api/list-models'&&method==='POST')return ok({models:[{id:'mock-thought',label:'Mock Thought',supportedReasoningEfforts:['low','medium','high'],defaultReasoningEffort:'medium'}]});
  if(path==='/api/oauth/codex/status'){
    const active=Object.values(window.__apiState.codex.sessions).find(s=>['running','cancelling'].includes(s.status))||null;
    const loggedIn=!!window.__apiState.codex.loggedIn;
    return ok({installed:window.__apiState.codex.installed,loggedIn,version:'App Server',detail:loggedIn?'已通过 ChatGPT 连接 · plus':'Codex App Server 可用，尚未连接 ChatGPT 账号。',account:loggedIn?clone(codexAccount):null,models:loggedIn?clone(codexModels):[],activeSession:active?clone(active):null});
  }
  if(path==='/api/oauth/codex/start'&&method==='POST'){
    window.__apiState.requests.push({path,body:clone(body),sessionHeader,at:now()});
    if(!window.__apiState.codex.installed)return ok({error:'not installed'},400);
    if(window.__apiState.codex.loggedIn)return ok({status:'success',mode:body.mode||'browser',account:clone(codexAccount),models:clone(codexModels),message:'Codex 已连接。'});
    const active=Object.values(window.__apiState.codex.sessions).find(s=>['running','cancelling'].includes(s.status));
    if(active)return ok({error:'已有 Codex 授权会话正在进行，请先完成或取消。',session:clone(active)},409);
    const mode=body.mode==='device'?'device':'browser',id='codex_'+mode+'_'+Date.now();
    const session={sessionId:id,id,loginId:id,mode,status:'running',polls:0,completeAfterPolls:mode==='device'?99:1,authUrl:mode==='browser'?`https://auth.openai.com/oauth/authorize?client_id=ui&login_id=${id}`:'',verificationUrl:mode==='device'?'https://auth.openai.com/codex/device':'',userCode:mode==='device'?'UI-1234':'',message:mode==='device'?'请打开验证网址并输入设备码。':'请在新窗口完成 ChatGPT 授权。',log:mode==='device'?'请打开验证网址并输入设备码。':'请在新窗口完成 ChatGPT 授权。'};
    window.__apiState.codex.sessions[id]=session;
    return ok(clone(session),202);
  }
  if(path==='/api/oauth/codex/session'){
    const id=new URL(String(url),'http://local.test').searchParams.get('id'),session=window.__apiState.codex.sessions[id];
    if(!session)return ok({error:'授权会话不存在或已过期。'},404);
    session.polls=(session.polls||0)+1;
    if(session.status==='running'&&session.polls>=session.completeAfterPolls){session.status='success';session.message='Codex 授权成功。';session.log=session.message;window.__apiState.codex.loggedIn=true;window.__apiState.codex.account=clone(codexAccount);window.__apiState.codex.models=clone(codexModels);}
    const payload=clone(session);if(session.status==='success'){payload.account=clone(codexAccount);payload.models=clone(codexModels);}return ok(payload);
  }
  if(path==='/api/oauth/codex/cancel'&&method==='POST'){
    window.__apiState.requests.push({path,body:clone(body),sessionHeader,at:now()});
    const session=window.__apiState.codex.sessions[body.sessionId];
    if(!session)return ok({error:'授权会话不存在或已过期。'},404);
    session.status='cancelled';session.message='Codex 授权已取消。';session.log=session.message;window.__apiState.codex.loggedIn=false;window.__apiState.codex.account=null;window.__apiState.codex.models=[];
    return ok(clone(session));
  }
  if(path==='/api/oauth/codex/logout'&&method==='POST'){
    window.__apiState.requests.push({path,body:clone(body),sessionHeader,at:now()});
    window.__apiState.codex.loggedIn=false;window.__apiState.codex.account=null;window.__apiState.codex.models=[];
    return ok({ok:true,message:'已退出 Codex ChatGPT 登录。'});
  }
  return ok({error:'unhandled '+method+' '+path},404);
};
'''


def load_app(page, seed=None):
    html = (ROOT / "index.html").read_text()
    css = (ROOT / "styles.css").read_text()
    providers = (ROOT / "providers.js").read_text().replace("export const ", "const ").replace("export function ", "function ")
    providers = "(function(){\n" + providers + "\nwindow.__providers={PROVIDER_PRESETS,PROTOCOL_OPTIONS,AUTH_MODE_OPTIONS,clonePresetProfiles};\n})();"
    capabilities = (ROOT / "provider-capabilities.js").read_text().replace("export const ", "const ").replace("export function ", "function ")
    capabilities = "(function(){\n" + capabilities + "\nwindow.__providerCapabilities={REASONING_EFFORT_LABELS,REASONING_MODE_OPTIONS,normalizeModelRecord,normalizeDiscoveredModels,reasoningOptionsForModel,resolveReasoningEffort,inferReasoningMode};\n})();"
    thinking = (ROOT / "thinking-core.js").read_text().replace("export const ", "const ").replace("export function ", "function ")
    thinking = "(function(){\n" + thinking + "\nwindow.__thinkingCore={makeDefaultGoal,normalizeGoalState,confirmedGoal,proposeGoal,acceptGoalProposal,rejectGoalProposal,setConfirmedUserGoal,sliceMessagesThrough,estimateTokens,buildContextMetrics,ARTIFACT_KIND_LABELS,REASONING_RELATION_LABELS,CONFIDENCE_STATUS_LABELS,makeArtifactRecord,makeReasoningEdge,makeDecisionArtifactRecord};\n})();"
    selection_utils = (ROOT / "selection-utils.js").read_text().replace("export const ", "const ").replace("export function ", "function ")
    selection_utils = "(function(){\n" + selection_utils + "\nwindow.__selectionUtils={resolveMarkdownSelection,normalizeLooseSelection,buildMarkdownVisibleIndex,allIndexes};\n})();"
    text_encoding = (ROOT / "text-encoding.js").read_text().replace("export const ", "const ").replace("export function ", "function ")
    text_encoding = "(function(){\n" + text_encoding + "\nwindow.__textEncoding={inspectUtf8Mojibake,repairUtf8Mojibake,hasLikelyUtf8Mojibake,repairUtf8MojibakeDeep};\n})();"
    i18n = (ROOT / "i18n.js").read_text().replace("export const ", "const ").replace("export function ", "function ")
    i18n = "(function(){\n" + i18n + "\nwindow.__i18n={DEFAULT_UI_LANGUAGE,UI_LANGUAGE_OPTIONS,normalizeUiLanguage,getUiLanguage,localeForIntl,t,hasTranslation,setUiLanguage,startUiLocalization,stopUiLocalization,localizeUi,responseLanguageInstruction};\n})();"
    app = (ROOT / "app.js").read_text().replace(
        "import { PROVIDER_PRESETS, PROTOCOL_OPTIONS, AUTH_MODE_OPTIONS, clonePresetProfiles } from './providers.js';",
        "const { PROVIDER_PRESETS, PROTOCOL_OPTIONS, AUTH_MODE_OPTIONS, clonePresetProfiles } = window.__providers;",
    )
    app = re.sub(
        r"import\s*\{[\s\S]*?\}\s*from './provider-capabilities\.js';",
        "const { REASONING_EFFORT_LABELS, REASONING_MODE_OPTIONS, normalizeModelRecord, normalizeDiscoveredModels, reasoningOptionsForModel, resolveReasoningEffort, inferReasoningMode } = window.__providerCapabilities;",
        app,
        count=1,
    )
    app = re.sub(
        r"import\s*\{[\s\S]*?\}\s*from './thinking-core\.js';",
        "const { makeDefaultGoal, normalizeGoalState, confirmedGoal, proposeGoal, acceptGoalProposal, rejectGoalProposal, setConfirmedUserGoal, sliceMessagesThrough, estimateTokens, buildContextMetrics, ARTIFACT_KIND_LABELS, REASONING_RELATION_LABELS, CONFIDENCE_STATUS_LABELS, makeArtifactRecord, makeReasoningEdge, makeDecisionArtifactRecord } = window.__thinkingCore;",
        app,
        count=1,
    )
    app = app.replace(
        "import { resolveMarkdownSelection } from './selection-utils.js';",
        "const { resolveMarkdownSelection } = window.__selectionUtils;",
    )
    app = app.replace(
        "import { repairUtf8Mojibake, repairUtf8MojibakeDeep } from './text-encoding.js';",
        "const { repairUtf8Mojibake, repairUtf8MojibakeDeep } = window.__textEncoding;",
    )
    app = re.sub(
        r"import\s*\{[\s\S]*?\}\s*from './i18n\.js';",
        "const { DEFAULT_UI_LANGUAGE, UI_LANGUAGE_OPTIONS, normalizeUiLanguage, setUiLanguage, startUiLocalization, localizeUi, localeForIntl, t, responseLanguageInstruction } = window.__i18n;",
        app,
        count=1,
    )
    app = "(function(){\n" + app + "\n})();"
    html = html.replace('<head>', '<head><meta name="thought-canvas-session" content="browser-gate-session">', 1)
    # Browser gates verify final geometry and state, not transition timing. Removing
    # animations keeps the complete suite deterministic on software-rendered CI
    # Chromium and prevents actionability waits from dominating release checks.
    test_css = "*{transition:none!important;animation:none!important;scroll-behavior:auto!important;}"
    html = html.replace('<link rel="stylesheet" href="styles.css" />', f"<style>{css}</style><style>{test_css}</style>").replace('<script type="module" src="app.js"></script>', "")
    page.set_content(html, wait_until="domcontentloaded")
    if seed is not None:
        page.add_script_tag(content="window.__apiSeed=" + json.dumps(seed, ensure_ascii=False) + ";")
    page.add_script_tag(content=API_MOCK)
    page.add_script_tag(content=providers)
    page.add_script_tag(content=capabilities)
    page.add_script_tag(content=thinking)
    page.add_script_tag(content=selection_utils)
    page.add_script_tag(content=text_encoding)
    page.add_script_tag(content=i18n)
    page.add_script_tag(content=app)
    expected = "#workspace:not(.hidden)" if seed and seed.get("activeProjectId") else "#homeView:not(.hidden)"
    page.wait_for_selector(expected)
    if seed and seed.get("activeProjectId"):
        page.wait_for_selector('.node[data-id="root"]')


def project_state(page):
    return page.evaluate("""() => {
      const id=window.__apiState.activeProjectId;
      return id ? JSON.parse(JSON.stringify(window.__apiState.projects[id])) : null;
    }""")


def wait_project(page, predicate_js, timeout=30000):
    page.wait_for_function(f"""() => {{
      const id=window.__apiState.activeProjectId, p=id&&window.__apiState.projects[id];
      return !!p && ({predicate_js})(p);
    }}""", timeout=timeout, polling=50)
    return project_state(page)


def no_overlap(page):
    boxes = page.locator(".node:not(.archived)").evaluate_all("els=>els.map(e=>{const r=e.getBoundingClientRect(),title=e.querySelector('.node-title')?.textContent||'';return {id:e.dataset.id,title,classes:e.className,x:r.x,y:r.y,w:r.width,h:r.height}})")
    for i, a in enumerate(boxes):
        for b in boxes[i + 1:]:
            assert not (a["x"] < b["x"] + b["w"] and a["x"] + a["w"] > b["x"] and a["y"] < b["y"] + b["h"] and a["y"] + a["h"] > b["y"]), f"overlap {a['id']}({a['title']},{a['classes']}) {b['id']}({b['title']},{b['classes']})"


def select_node(page, node_id):
    page.evaluate("""id=>{const el=document.querySelector(`.node[data-id="${id}"]`);if(!el)throw new Error(`missing node ${id}`);el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0,clientX:20,clientY:20}));document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0,clientX:20,clientY:20}));}""", node_id)

def center_y(page, node_id):
    box = page.locator(f'.node[data-id="{node_id}"]').bounding_box()
    assert box
    return box["y"] + box["height"] / 2



def assert_node_visible(page, node_id, margin=2):
    node = page.locator(f'.node[data-id="{node_id}"]').bounding_box()
    viewport = page.locator('#viewport').bounding_box()
    assert node and viewport, f"missing geometry for {node_id}"
    assert node["x"] >= viewport["x"] - margin, f"{node_id} left of viewport"
    assert node["y"] >= viewport["y"] - margin, f"{node_id} above viewport"
    assert node["x"] + node["width"] <= viewport["x"] + viewport["width"] + margin, f"{node_id} right of viewport"
    assert node["y"] + node["height"] <= viewport["y"] + viewport["height"] + margin, f"{node_id} below viewport"


def open_node_more(page):
    menu = page.locator('.node-more-menu')
    if not menu.count():
        return
    visible_action = page.locator('#compactNodeBtn, #organizeNodeBtn, #archiveNodeBtn, #restoreNodeBtn').first
    if not visible_action.is_visible():
        page.click('.node-more-menu > summary')


def select_message_text(page, message_id, text):
    selected = page.evaluate(r"""({messageId,text})=>{
      const body=document.querySelector(`.message[data-message-id="${CSS.escape(messageId)}"] .message-body`);
      if(!body)return false;
      const walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT);
      let node;
      while(node=walker.nextNode()){
        const index=String(node.nodeValue||'').indexOf(text);
        if(index<0)continue;
        const range=document.createRange();range.setStart(node,index);range.setEnd(node,index+text.length);
        const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
        body.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
        return true;
      }
      return false;
    }""", {"messageId": message_id, "text": text})
    assert selected, f"unable to select text: {text}"


def select_source_with_overflow(page, node_id):
    selected = page.evaluate(r"""nodeId=>{
      const card=document.querySelector(`.source-content-card[data-source-content-node="${CSS.escape(nodeId)}"]`);
      const body=card?.querySelector('[data-source-selection-body]');
      const head=card?.querySelector('.source-content-head');
      if(!card||!body||!head)return false;
      const first=(head.firstChild?.nodeType===Node.TEXT_NODE?head.firstChild:head.querySelector('*')?.firstChild)||head;
      const walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT,{acceptNode:n=>String(n.nodeValue||'').trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});
      const texts=[];let n;while(n=walker.nextNode())texts.push(n);
      if(!texts.length)return false;
      const last=texts[Math.min(texts.length-1,2)];
      const range=document.createRange();
      try{range.setStart(first,0);}catch{range.setStartBefore(head);}
      range.setEnd(last,Math.min(String(last.nodeValue||'').length,Math.max(6,String(last.nodeValue||'').length)));
      const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
      return true;
    }""", node_id)
    assert selected, f"unable to over-select source content for {node_id}"


def main():
    errors = []
    checkpoint("launch")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=os.environ.get("CHROMIUM", "/usr/bin/chromium"), args=["--no-sandbox", "--disable-gpu"])
        context = browser.new_context(viewport={"width": 1680, "height": 1050}, reduced_motion="reduce")
        context.set_default_timeout(20_000)
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("dialog", lambda dialog: dialog.accept())
        load_app(page)
        checkpoint("home loaded")

        page.click("#homeNewProjectBtn")
        page.wait_for_selector("#newProjectDialog[open]")
        page.click("#cancelNewProjectBtn")
        assert page.evaluate("Object.keys(window.__apiState.projects).length") == 0

        question = "测试项目代号是北极星17。请分析 AI 视频商业化的四条可行路径，并使用 Markdown 标题、引用和代码块。"
        page.fill("#homeQuestionInput", question)
        page.click("#homeStartBtn")
        page.wait_for_selector("#workspace:not(.hidden)")
        page.wait_for_selector(".message.assistant")
        project = wait_project(page, "p=>p.nodes.length===1&&p.nodes[0].messages.length>=2&&p.nodes[0].messages.at(-1).streaming!==true")
        checkpoint("initial answer")
        assert len(project["nodes"]) == 1
        assert project["nodes"][0]["decomposedMessageIds"] == []
        assert page.locator("[data-decompose-message]").count() == 1
        assert page.locator(".message.assistant h3").count() >= 1
        assert page.locator(".message.assistant blockquote").count() >= 1
        assert page.locator(".message.assistant pre").count() >= 1
        assert not page.locator(".message.assistant").inner_text().lstrip().startswith("{")
        assert page.input_value("#goalInput").strip() == ""
        assert project["goal"]["status"] == "unset"
        assert project["goal"]["pending"]["status"] == "suggested"
        assert project["goal"]["pending"]["text"] == "验证 AI 视频商业化路径并形成可执行判断"
        page.wait_for_selector("#goalSuggestionCard:not(.hidden)")
        assert "待确认" in page.locator("#goalBadge").inner_text()

        # 默认输入框继续当前节点，不再自动创建分支。
        page.fill("#messageDraft", "项目代号是什么？")
        page.press("#messageDraft", "Enter")
        project = wait_project(page, "p=>p.nodes.length===1&&p.nodes[0].messages.length>=4&&p.nodes[0].messages.at(-1).streaming!==true")
        checkpoint("follow-up")
        root = next(node for node in project["nodes"] if node["id"] == "root")
        assert "北极星17" in root["messages"][-1]["content"]
        last_generate_prompt = page.evaluate("window.__apiState.requests.filter(x=>x.path==='/api/generate-stream').at(-1).body.prompt")
        assert "验证 AI 视频商业化路径并形成可执行判断" not in last_generate_prompt
        page.click("#acceptGoalSuggestionBtn")
        project = wait_project(page, "p=>p.goal.text==='验证 AI 视频商业化路径并形成可执行判断'&&p.goal.status==='accepted'")
        assert page.input_value("#goalInput") == "验证 AI 视频商业化路径并形成可执行判断"
        assert page.locator("#goalSuggestionCard").is_hidden()
        page.wait_for_function("document.querySelector('#saveStatus span')?.textContent==='已保存'")
        assert question[:18] in page.locator("#conversation").inner_text()
        assert "发送会继续当前节点" in page.locator("#composerDefaultHint").inner_text()
        assert page.locator(".composer .new-branch-button").count() == 0
        assert page.locator('[data-node-branch="root"]').count() == 1

        # 只有点击画布节点右侧 + 才创建新分支；全局处理中浮层不再出现。
        page.click('[data-node-branch="root"]')
        page.wait_for_selector("#branchComposerDialog[open]")
        branch_metrics = page.evaluate("""()=>{const dialog=document.querySelector('#branchComposerDialog'),h=dialog.querySelector('h2'),p=dialog.querySelector('header p'),ta=dialog.querySelector('textarea'),fields=[...dialog.querySelectorAll('.model-pair select')],metas=[...dialog.querySelectorAll('.branch-field-meta')];return{dialog:dialog.getBoundingClientRect(),heading:parseFloat(getComputedStyle(h).fontSize),copy:parseFloat(getComputedStyle(p).fontSize),textarea:parseFloat(getComputedStyle(ta).fontSize),fieldWidths:fields.map(el=>el.getBoundingClientRect().width),titles:fields.map(el=>el.title),labels:[...dialog.querySelectorAll('.model-pair label>span')].map(el=>parseFloat(getComputedStyle(el).fontSize)),metaText:metas.map(el=>el.textContent.trim()),metaFits:metas.map(el=>el.scrollWidth<=el.clientWidth+1||getComputedStyle(el).overflowWrap==='anywhere')}}""")
        assert branch_metrics["heading"] >= 24 and branch_metrics["copy"] >= 13 and branch_metrics["textarea"] >= 16
        assert min(branch_metrics["fieldWidths"]) >= 165
        assert all(branch_metrics["titles"]) and min(branch_metrics["labels"]) >= 12
        assert all(branch_metrics["metaText"]) and all(branch_metrics["metaFits"])
        page.fill("#branchMessageDraft", "项目代号是什么？")
        page.click("#confirmBranchBtn")
        page.wait_for_selector(".node.processing")
        page.wait_for_selector(".edge.processing-edge", state="attached")
        assert page.locator("#busyToast").count() == 0
        assert " C " in page.locator(".edge.processing-edge").first.get_attribute("d")
        project = wait_project(page, "p=>p.nodes.length===2&&p.nodes.find(n=>n.id!=='root')?.messages.length>=2&&p.nodes.find(n=>n.id!=='root')?.messages.at(-1)?.streaming!==true")
        checkpoint("first branch")
        answer_child = next(node for node in project["nodes"] if node["id"] != "root")
        checkpoint("first branch state read")
        assert "北极星17" in answer_child["messages"][-1]["content"]
        assert len(next(node for node in project["nodes"] if node["id"] == "root")["messages"]) == 4
        page.wait_for_selector(f'.node[data-id="{answer_child["id"]}"]')
        checkpoint("first branch node rendered")
        assert_node_visible(page, "root")
        checkpoint("first branch root visible")
        assert_node_visible(page, answer_child["id"])
        checkpoint("first branch child visible")
        assert not page.locator("#canvasNavigator").is_hidden()
        assert not page.locator("#miniMap").is_hidden()
        assert page.locator(".mini-map-node").count() >= 2
        checkpoint("first branch navigation assertions")

        # 搜索能定位节点，来源按钮把用户带回分叉起点并保留两端在视野中。
        page.fill("#nodeSearchInput", "项目代号")
        checkpoint("search filled")
        page.wait_for_selector("[data-search-node]")
        checkpoint("search result rendered")
        page.press("#nodeSearchInput", "Enter")
        checkpoint("search enter")
        page.wait_for_selector(f'.node[data-id="{answer_child["id"]}"].selected')
        checkpoint("search selected child")
        branch_answer_id = next(message["id"] for message in answer_child["messages"] if message["role"] == "assistant")
        assert page.locator(f'[data-decompose-message="{branch_answer_id}"]').count() == 1
        assert not page.locator("#returnToSourceBtn").is_hidden()
        checkpoint("return source available")
        page.click("#returnToSourceBtn")
        checkpoint("return source clicked")
        page.wait_for_selector('.node[data-id="root"].selected')
        checkpoint("source selected")
        assert_node_visible(page, "root")
        assert_node_visible(page, answer_child["id"])
        assert page.locator("#conversation").evaluate("el=>el.scrollTop") <= 2
        assert page.locator("#conversation").evaluate("el=>el.scrollWidth<=el.clientWidth+1")
        composer_box = page.locator(".composer-wrap").bounding_box(); sidebar_box = page.locator("#sidebar").bounding_box()
        assert composer_box and sidebar_box and composer_box["y"] + composer_box["height"] <= sidebar_box["y"] + sidebar_box["height"] + 1
        select_node(page, 'root')
        checkpoint("root selected before decomposition")

        root_message_id = next(message["id"] for message in project["nodes"][0]["messages"] if message["role"] == "assistant")
        page.click(f'[data-decompose-message="{root_message_id}"]')
        checkpoint("full decomposition clicked")
        project = wait_project(page, "p=>p.nodes.filter(n=>n.kind==='content_section').length>=4")
        checkpoint("full decomposition completed")
        root = next(node for node in project["nodes"] if node["id"] == "root")
        root_answer = next(message["content"] for message in root["messages"] if message["id"] == root_message_id)
        root_sections = [node for node in project["nodes"] if node["kind"] == "content_section" and node["sourceMessageId"] == root_message_id]
        for section in root_sections:
            assert root_answer[section["sourceStart"]:section["sourceEnd"]] == section["sourceText"] == section["content"]
            assert not section["title"].endswith(("?", "？"))

        assert_node_visible(page, "root")
        checkpoint("decompose root visible")
        assert_node_visible(page, root_sections[0]["id"])
        checkpoint("decompose first child visible")
        assert_node_visible(page, root_sections[-1]["id"])
        checkpoint("decompose last child visible")
        select_node(page, root_sections[0]["id"])
        checkpoint("decompose first child selected")
        page.click("#pathViewBtn")
        project = wait_project(page, "p=>p.viewMode==='path'")
        checkpoint("path mode active")
        path_node_ids = page.locator(".node").evaluate_all("els=>els.map(el=>el.dataset.id)")
        assert "root" in path_node_ids and root_sections[0]["id"] in path_node_ids
        assert len(path_node_ids) < len(project["nodes"])
        page.click("#pathViewBtn")
        project = wait_project(page, "p=>p.viewMode==='all'")
        checkpoint("path mode restored")

        select_node(page, root_sections[0]["id"])
        assert page.locator("#conversation").evaluate("el=>el.scrollTop") <= 2
        assert page.locator("#conversation").evaluate("el=>el.scrollWidth<=el.clientWidth+1")
        assert page.locator(".source-content-card").evaluate("el=>el.getBoundingClientRect().right<=document.querySelector('#conversation').getBoundingClientRect().right+1")
        page.locator("#conversation").evaluate("el=>el.scrollTop=el.scrollHeight")
        assert page.locator("#conversation").evaluate("el=>Math.abs((el.scrollHeight-el.clientHeight)-el.scrollTop)<3")

        select_node(page, 'root')
        checkpoint("root selected before selection gates")
        # 选择跨越 Markdown 粗体和引用行的可见文字；底层必须映射回原始 Markdown 范围。
        selected_visible = "核心区别\n普通人卖内容，高维玩家控制客户、数据与交易。"
        # Do not synthesize a message-body mouseup. Real users can release the
        # pointer outside the body or click the action before the old handler's
        # requestAnimationFrame runs. The document-level selection observer and
        # action pointerdown fallback must still capture the live range.
        assert page.evaluate(r"""text=>{const body=[...document.querySelectorAll('.message.assistant .message-body')].find(el=>el.innerText.includes('核心区别'));if(!body)return false;const nodes=[];const w=document.createTreeWalker(body,NodeFilter.SHOW_TEXT);let n,total='';while(n=w.nextNode()){nodes.push({n,start:total.length,end:total.length+n.nodeValue.length});total+=n.nodeValue+'\n';}const wanted=text.split('\n');const a=nodes.find(x=>x.n.nodeValue.includes(wanted[0]));const b=nodes.find(x=>x.n.nodeValue.includes(wanted[1]));if(!a||!b)return false;const r=document.createRange();r.setStart(a.n,a.n.nodeValue.indexOf(wanted[0]));r.setEnd(b.n,b.n.nodeValue.indexOf(wanted[1])+wanted[1].length);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);return true;}""", selected_visible)
        page.wait_for_function(f"document.querySelector('[data-decompose-selection=\"{root_message_id}\"]')?.textContent.includes('拆解已选')")
        page.wait_for_function(f"document.querySelector('[data-promote-selection=\"{root_message_id}\"]')?.textContent.includes('提炼已选')")
        checkpoint("formatted selection captured")
        page.click(f'[data-promote-selection="{root_message_id}"]')
        page.wait_for_selector("#artifactDialog[open]")
        artifact_visible_text = page.input_value("#artifactContentInput")
        assert "核心区别" in artifact_visible_text and "普通人卖内容" in artifact_visible_text
        assert "**" not in artifact_visible_text and "> " not in artifact_visible_text
        page.select_option("#artifactKindSelect", "claim")
        page.select_option("#artifactConfidenceSelect", "partial")
        page.fill("#artifactTitleInput", "客户、数据与交易控制构成核心区别")
        page.click('#artifactForm button[type="submit"]')
        project = wait_project(page, "p=>p.artifacts?.length===1")
        checkpoint("first artifact saved")
        first_artifact = project["artifacts"][0]
        assert first_artifact["nodeId"] == "root"
        assert first_artifact["sourceMessageId"] == root_message_id
        assert first_artifact["sourceStart"] >= 0
        assert root_answer[first_artifact["sourceStart"]:first_artifact["sourceEnd"]] == first_artifact["sourceText"]

        page.click(f'[data-decompose-selection="{root_message_id}"]')
        project = wait_project(page, "p=>p.nodes.find(n=>n.id==='root').decompositions?.some(x=>x.scope==='selection')")
        checkpoint("formatted selection decomposed")
        root = next(node for node in project["nodes"] if node["id"] == "root")
        record = [item for item in root["decompositions"] if item["scope"] == "selection"][-1]
        selection_children = [next(node for node in project["nodes"] if node["id"] == child_id) for child_id in record["childIds"]]
        assert record["selectionStart"] >= 0 and record["selectionEnd"] > record["selectionStart"]
        assert all(root_answer[child["sourceStart"]:child["sourceEnd"]] == child["sourceText"] for child in selection_children)
        assert all("自营内容" not in child["sourceText"] and "行业工作流" not in child["sourceText"] for child in selection_children)

        # 再提炼一条证据，并建立“观点 → 证据”的支持关系。
        select_node(page, 'root')
        evidence_text = "更长期的壁垒来自真实业务数据、客户入口、授权资产和对结果负责的能力。"
        select_message_text(page, root_message_id, evidence_text)
        page.wait_for_function(f"document.querySelector('[data-promote-selection=\"{root_message_id}\"]')?.textContent.includes('提炼已选')")
        page.click(f'[data-promote-selection="{root_message_id}"]')
        page.wait_for_selector("#artifactDialog[open]")
        page.select_option("#artifactKindSelect", "evidence")
        page.select_option("#artifactConfidenceSelect", "verified")
        page.fill("#artifactTitleInput", "长期壁垒来自业务数据与客户入口")
        page.click('#artifactForm button[type="submit"]')
        project = wait_project(page, "p=>p.artifacts?.length===2")
        checkpoint("evidence artifact saved")
        artifacts = project["artifacts"]
        claim_artifact = next(item for item in artifacts if item["kind"] == "claim")
        evidence_artifact = next(item for item in artifacts if item["kind"] == "evidence")
        assert evidence_artifact["sourceText"] == evidence_text
        assert root_answer[evidence_artifact["sourceStart"]:evidence_artifact["sourceEnd"]] == evidence_text

        page.click("#reasoningPanelBtn")
        page.wait_for_selector("#reasoningDialog[open]")
        assert "2 个对象" in page.locator("#reasoningSummary").inner_text()
        page.click(f'[data-reasoning-connect="{claim_artifact["id"]}"]')
        page.wait_for_selector("#relationDialog[open]")
        page.select_option("#relationTypeSelect", "supports")
        page.select_option("#relationTargetSelect", evidence_artifact["id"])
        page.click('#relationForm button[type="submit"]')
        project = wait_project(page, "p=>p.reasoningEdges?.length===1")
        assert project["reasoningEdges"][0]["sourceArtifactId"] == claim_artifact["id"]
        assert project["reasoningEdges"][0]["targetArtifactId"] == evidence_artifact["id"]
        assert project["reasoningEdges"][0]["relation"] == "supports"
        page.select_option("#reasoningKindFilter", "evidence")
        assert page.locator("[data-reasoning-artifact]").count() == 1
        page.locator("#reasoningDialog .modal-close").click()
        checkpoint("reasoning relation complete")

        # 拆解生成的内容模块也能继续拆解或提炼；选区越过模块头部时会被安全裁剪到正文。
        source_action_node = root_sections[-1]
        select_node(page, source_action_node["id"])
        checkpoint("source node selected for recursive actions")
        assert page.locator('[data-decompose-source]').count() == 1
        assert page.locator('[data-decompose-source-selection]').count() == 1
        assert page.locator('[data-promote-source-selection]').count() == 1
        select_source_with_overflow(page, source_action_node["id"])
        page.wait_for_function("document.querySelector('[data-promote-source-selection]')?.textContent.includes('提炼已选')")
        checkpoint("source overflow selection captured")
        page.click('[data-promote-source-selection]')
        page.wait_for_selector("#artifactDialog[open]")
        page.fill("#artifactTitleInput", "内容模块中的可见选区")
        page.click('#artifactForm button[type="submit"]')
        project = wait_project(page, "p=>p.artifacts?.length===3")
        checkpoint("source artifact saved")
        source_artifact = next(item for item in project["artifacts"] if item["title"] == "内容模块中的可见选区")
        assert source_artifact["nodeId"] == source_action_node["id"]
        assert source_artifact["sourceMessageId"] == ""
        assert source_artifact["sourceText"].strip()

        select_node(page, source_action_node["id"])
        page.click('[data-decompose-source]')
        project = wait_project(page, f"p=>p.nodes.some(n=>n.parentId==='{source_action_node['id']}'&&n.kind==='content_section')")
        checkpoint("recursive decomposition complete")
        recursive_child = next(node for node in project["nodes"] if node.get("parentId") == source_action_node["id"] and node.get("kind") == "content_section")
        select_node(page, recursive_child["id"])
        assert page.locator('[data-decompose-source-selection]').count() == 1
        assert page.locator('[data-promote-source-selection]').count() == 1

        # 本地标注通过密集虚线挂在来源节点上，不影响主分支完成度，并可折叠、搜索、编辑和导出。
        select_node(page, source_action_node["id"])
        source_status_before_annotation = page.input_value("#nodeStatusSelect")
        page.click("#addAnnotationBtn")
        page.wait_for_selector("#annotationDialog[open]")
        annotation_metrics = page.evaluate("""()=>{const d=document.querySelector('#annotationDialog'),h=d.querySelector('h2'),p=d.querySelector('header p'),i=d.querySelector('input'),t=d.querySelector('textarea');return{heading:parseFloat(getComputedStyle(h).fontSize),copy:parseFloat(getComputedStyle(p).fontSize),input:parseFloat(getComputedStyle(i).fontSize),textarea:parseFloat(getComputedStyle(t).fontSize),centerX:d.getBoundingClientRect().x+d.getBoundingClientRect().width/2,viewportX:innerWidth/2}}""")
        assert annotation_metrics["heading"] >= 24 and annotation_metrics["copy"] >= 13
        assert annotation_metrics["input"] >= 14 and annotation_metrics["textarea"] >= 14
        assert abs(annotation_metrics["centerX"] - annotation_metrics["viewportX"]) < 2
        page.select_option("#annotationTypeSelect", "risk")
        page.fill("#annotationTitleInput", "关键成本假设")
        page.fill("#annotationContentInput", "需要验证用户是否愿意承担本地配置成本，并记录验证结果。")
        page.click('#annotationForm button[type="submit"]')
        project = wait_project(page, f"p=>p.nodes.some(n=>n.kind==='annotation'&&n.parentId==='{source_action_node['id']}'&&n.title==='关键成本假设')")
        annotation = next(node for node in project["nodes"] if node.get("kind") == "annotation" and node.get("title") == "关键成本假设")
        assert annotation["annotationSourceNodeId"] == source_action_node["id"]
        assert any(edge.get("source") == source_action_node["id"] and edge.get("target") == annotation["id"] and edge.get("relation") == "annotation" for edge in project["edges"])
        assert next(node for node in project["nodes"] if node["id"] == source_action_node["id"])["status"] == source_status_before_annotation
        page.wait_for_selector(f'.node.kind-annotation[data-id="{annotation["id"]}"]')
        annotation_dash = page.locator(".edge.annotation-edge").last.evaluate("el=>getComputedStyle(el).strokeDasharray")
        assert annotation_dash.replace(" ", "") in {"3px,3px", "3,3"}
        select_node(page, annotation["id"])
        assert page.locator('[data-edit-annotation]').count() == 1
        assert page.locator('[data-decompose-source]').count() == 1
        assert page.locator('[data-decompose-source-selection]').count() == 1
        assert page.locator('[data-promote-source-selection]').count() == 1
        assert "不计入主分支完成度" in page.locator(".node-context-row").inner_text()
        page.select_option("#nodeStatusSelect", "resolved")
        project = wait_project(page, f"p=>p.nodes.find(n=>n.id==='{annotation['id']}').status==='resolved'")
        assert next(node for node in project["nodes"] if node["id"] == source_action_node["id"])["status"] == source_status_before_annotation
        page.locator(f'[data-edit-annotation="{annotation["id"]}"]').evaluate("el=>el.click()")
        page.wait_for_selector("#annotationDialog[open]")
        page.fill("#annotationTitleInput", "关键成本假设（已编辑）")
        page.click('#annotationForm button[type="submit"]')
        project = wait_project(page, f"p=>p.nodes.find(n=>n.id==='{annotation['id']}').title==='关键成本假设（已编辑）'")

        # 也可以从节点的标注把手拖出一条临时虚线，在指定位置创建本地模块。
        select_node(page, source_action_node["id"])
        handle = page.locator(f'[data-node-annotation="{source_action_node["id"]}"]')
        handle_box = handle.bounding_box()
        viewport_box = page.locator("#viewport").bounding_box()
        assert handle_box and viewport_box
        start_x = handle_box["x"] + handle_box["width"] / 2
        start_y = handle_box["y"] + handle_box["height"] / 2
        right_target = min(viewport_box["x"] + viewport_box["width"] - 180, start_x + 230)
        left_target = max(viewport_box["x"] + 180, start_x - 230)
        target_x = right_target if abs(right_target - start_x) >= 90 else left_target
        target_y = min(viewport_box["y"] + viewport_box["height"] - 140, max(viewport_box["y"] + 150, start_y + 130))
        page.mouse.move(start_x, start_y)
        page.mouse.down()
        page.mouse.move(target_x, target_y, steps=8)
        page.wait_for_selector("#annotationDraftPath")
        page.wait_for_selector("#annotationDraftGhost")
        page.mouse.up()
        page.wait_for_selector("#annotationDialog[open]")
        page.select_option("#annotationTypeSelect", "idea")
        page.fill("#annotationTitleInput", "拖拽创建的想法")
        page.fill("#annotationContentInput", "这个模块由节点把手拖到画布指定位置后创建。")
        page.click('#annotationForm button[type="submit"]')
        project = wait_project(page, f"p=>p.nodes.some(n=>n.kind==='annotation'&&n.parentId==='{source_action_node['id']}'&&n.title==='拖拽创建的想法'&&n.annotationManualPosition===true)")
        dragged_annotation = next(node for node in project["nodes"] if node.get("kind") == "annotation" and node.get("title") == "拖拽创建的想法")
        assert dragged_annotation["annotationManualPosition"] is True
        assert page.locator(f'.node.kind-annotation[data-id="{dragged_annotation["id"]}"]').count() == 1
        checkpoint("annotation drag placement")

        select_node(page, source_action_node["id"])
        page.click(f'[data-node-collapse="{source_action_node["id"]}"]')
        project = wait_project(page, f"p=>p.nodes.find(n=>n.id==='{source_action_node['id']}').collapsed===true")
        assert page.locator(f'.node[data-id="{annotation["id"]}"]').count() == 0
        assert page.locator(f'.node[data-id="{recursive_child["id"]}"]').count() == 0
        page.fill("#nodeSearchInput", "关键成本假设")
        page.wait_for_selector(f'[data-search-node="{annotation["id"]}"]')
        page.press("#nodeSearchInput", "Enter")
        project = wait_project(page, f"p=>p.nodes.find(n=>n.id==='{source_action_node['id']}').collapsed===false&&p.selectedIds?.[0]==='{annotation['id']}'")
        page.wait_for_selector(f'.node.kind-annotation[data-id="{annotation["id"]}"].selected')
        checkpoint("annotation and folding")

        # 节点的工作状态与可信状态独立变化。
        select_node(page, 'root')
        root_work_status = page.input_value("#nodeStatusSelect")
        page.select_option("#nodeConfidenceSelect", "verified")
        project = wait_project(page, "p=>p.nodes.find(n=>n.id==='root').confidenceStatus==='verified'")
        assert next(node for node in project["nodes"] if node["id"] == "root")["status"] == root_work_status

        # NDJSON 增量输出可以被用户主动停止；已收到内容必须保留并可在同一条回答上继续。
        select_node(page, 'root')
        root = next(node for node in project["nodes"] if node["id"] == "root")
        messages_before_stop = len(root["messages"])
        page.fill("#messageDraft", "请生成一段可停止的长回答，停止测试。")
        page.press("#messageDraft", "Enter")
        checkpoint("root stream sent")
        page.wait_for_selector(".message.assistant.streaming")
        page.wait_for_selector("#stopGenerationBtn")
        page.wait_for_function("document.querySelector('.message.assistant.streaming .message-body')?.innerText.length>80")
        page.locator("#stopGenerationBtn").evaluate("el=>el.click()")
        project = wait_project(page, "p=>{const n=p.nodes.find(x=>x.id==='root'),m=n?.messages.at(-1);return n?.messages.length>=" + str(messages_before_stop + 2) + "&&m?.role==='assistant'&&m?.partial===true&&m?.streaming===false}")
        root = next(node for node in project["nodes"] if node["id"] == "root")
        partial_message = root["messages"][-1]
        assert partial_message["content"]
        assert partial_message.get("partial") is True
        assert "分段 48" not in partial_message["content"]
        assert page.locator(f'[data-continue-message="{partial_message["id"]}"]').count() == 1
        assert page.locator(f'[data-fork-message="{partial_message["id"]}"]').count() == 1
        assert page.locator(f'[data-decompose-message="{partial_message["id"]}"]').count() == 1
        stopped_call = next(record for record in project["generationRecords"] if record.get("id") == partial_message.get("callId"))
        assert stopped_call.get("stopped") is True and stopped_call.get("partialOutput") is True
        assert stopped_call.get("outputChars", 0) == len(partial_message["content"])
        page.click(f'[data-continue-message="{partial_message["id"]}"]')
        project = wait_project(page, f"p=>{{const n=p.nodes.find(x=>x.id==='root'),m=n?.messages.find(x=>x.id==='{partial_message['id']}');return m?.partial===false&&m?.streaming===false&&m?.content.includes('续写完成')}}")
        resumed_message = next(message for message in next(node for node in project["nodes"] if node["id"] == "root")["messages"] if message["id"] == partial_message["id"])
        assert "续写完成" in resumed_message["content"]
        assert any(record.get("purpose") == "continue_partial" and record.get("success") is True for record in project["generationRecords"])
        assert all(request.get("sessionHeader") == "browser-gate-session" for request in page.evaluate("window.__apiState.requests.filter(x=>x.path.endsWith('-stream'))"))

        select_node(page, 'root')
        root = next(node for node in project["nodes"] if node["id"] == "root")
        before_nodes = len(project["nodes"])
        before_messages = len(root["messages"])
        open_node_more(page)
        page.click("#organizeNodeBtn")
        page.wait_for_selector("#confirmDialog[open]")
        assert "整理" in page.locator("#confirmDialogTitle").inner_text()
        page.click("#confirmDialogConfirmBtn")
        project = wait_project(page, f"p=>p.nodes.find(n=>n.id==='root').messages.length==={before_messages+1}")
        assert len(project["nodes"]) == before_nodes
        assert next(node for node in project["nodes"] if node["id"] == "root")["messages"][-1]["type"] == "organized_summary"

        select_node(page, 'root')
        open_node_more(page)
        page.click("#compactNodeBtn")
        project = wait_project(page, "p=>!!p.nodes.find(n=>n.id==='root').activeCompactId")
        root_after_compact = next(node for node in project["nodes"] if node["id"] == "root")
        raw_count = len(root_after_compact["messages"])
        compact_count = len(root_after_compact["compactSnapshots"])
        open_node_more(page)
        page.click("#compactNodeBtn")
        project = wait_project(page, f"p=>p.nodes.find(n=>n.id==='root').compactSnapshots.length==={compact_count+1}")
        assert next(node for node in project["nodes"] if node["id"] == "root")["compactSnapshots"][-1]["version"] >= 2
        page.wait_for_selector(".compact-panel")
        page.click(".compact-panel summary")
        page.click("#deleteCompactBtn")
        project = wait_project(page, "p=>!p.nodes.find(n=>n.id==='root').activeCompactId")
        assert len(next(node for node in project["nodes"] if node["id"] == "root")["messages"]) == raw_count

        select_node(page, answer_child["id"])
        page.click(f'[data-decompose-message="{branch_answer_id}"]')
        project = wait_project(page, f"p=>p.nodes.some(n=>n.sourceMessageId==='{branch_answer_id}')")
        assert any(node.get("sourceMessageId") == root_message_id for node in project["nodes"])
        assert any(node.get("sourceMessageId") == branch_answer_id for node in project["nodes"])

        parent_section = next(node for node in project["nodes"] if node["kind"] == "content_section" and node["sourceMessageId"] == root_message_id)
        parallel_question = "请用一个例子解释这个模块。"
        for count in (1, 2):
            select_node(page, parent_section["id"])
            page.click(f'[data-node-branch="{parent_section["id"]}"]')
            page.wait_for_selector("#branchComposerDialog[open]")
            page.fill("#branchMessageDraft", parallel_question)
            page.click("#confirmBranchBtn")
            project = wait_project(page, f"p=>p.nodes.filter(n=>n.parentId==='{parent_section['id']}'&&n.question==='{parallel_question}'&&n.messages.length>=2&&n.messages.at(-1)?.streaming!==true).length>={count}")
        siblings = [node for node in project["nodes"] if node.get("parentId") == parent_section["id"] and node.get("question") == parallel_question]
        assert siblings[0]["groupId"] == siblings[1]["groupId"]
        assert siblings[0]["contextSnapshot"]["id"] == siblings[1]["contextSnapshot"]["id"]
        page.click("#autoLayoutBtn")
        page.wait_for_timeout(100)
        assert abs(center_y(page, parent_section["id"]) - sum(center_y(page, child["id"]) for child in siblings) / 2) < 4
        no_overlap(page)

        for child in siblings:
            select_node(page, child["id"])
            page.select_option("#nodeStatusSelect", "resolved")
        project = wait_project(page, f"p=>p.nodes.find(n=>n.id==='{parent_section['id']}').status==='resolved'")
        select_node(page, siblings[0]["id"])
        page.select_option("#nodeStatusSelect", "exploring")
        project = wait_project(page, f"p=>p.nodes.find(n=>n.id==='{parent_section['id']}').status==='exploring'")

        select_node(page, root_sections[0]["id"])
        page.click(f'.node[data-id="{root_sections[1]["id"]}"]', modifiers=["Control"])
        page.wait_for_selector("#selectionActions:not(.hidden)")
        assert not page.locator("#compareSelectedBtn").is_hidden()
        page.click("#compareSelectedBtn")
        page.wait_for_selector("#compareDialog[open]")
        assert page.locator(".compare-branch").count() == 2
        assert "上下文快照" in page.locator("#compareContent").inner_text()
        page.locator("#compareDialog .modal-close").click()

        page.click("#mergeSelectedBtn")
        page.wait_for_selector("#mergeDialog[open]")
        page.click("#confirmMergeBtn")
        project = wait_project(page, "p=>p.nodes.some(n=>n.kind==='merge_summary')&&p.artifacts?.some(a=>a.kind==='decision')")
        checkpoint("reasoning and merge")
        merge_node = next(node for node in project["nodes"] if node["kind"] == "merge_summary")
        decision = next(item for item in project["artifacts"] if item["id"] == merge_node["decisionArtifactId"])
        assert decision["kind"] == "decision"
        assert decision["decisionData"]["sourceNodeIds"]
        assert decision["contextSnapshotId"] == merge_node["contextSnapshotId"]
        assert any(record.get("purpose") == "merge" and record.get("nodeId") == merge_node["id"] for record in project["generationRecords"])
        assert any(snapshot.get("id") == merge_node["contextSnapshotId"] and snapshot.get("immutable") for snapshot in project["contextSnapshots"])

        leaf = siblings[0]
        checkpoint("archive gate start")
        select_node(page, leaf["id"])
        open_node_more(page)
        page.click("#archiveNodeBtn")
        page.wait_for_selector("#archiveDialog[open]")
        page.locator("#archiveDialog button.primary-action").click()
        project = wait_project(page, f"p=>p.nodes.find(n=>n.id==='{leaf['id']}').status==='archived'")
        checkpoint("leaf archived")
        page.click("#toggleArchiveBtn")
        checkpoint("archive visibility toggled")
        select_node(page, leaf["id"])
        checkpoint("archived leaf selected")
        open_node_more(page)
        checkpoint("archived leaf menu opened")
        page.click("#restoreNodeBtn")
        checkpoint("restore clicked")
        project = wait_project(page, f"p=>p.nodes.find(n=>n.id==='{leaf['id']}').status!=='archived'")
        checkpoint("leaf restored")

        # 流式回答必须可见、可停止；停止后保留同一条部分回答并允许原位续写。
        select_node(page, leaf["id"])
        page.fill("#messageDraft", "请执行停止测试，分段输出足够长的说明。")
        page.press("#messageDraft", "Enter")
        page.wait_for_selector(".message.assistant.streaming")
        page.wait_for_selector("#stopGenerationBtn")
        page.wait_for_function("document.querySelector('.message.assistant.streaming .message-body')?.innerText.length>20")
        page.locator("#stopGenerationBtn").evaluate("el=>el.click()")
        project = wait_project(page, f"p=>{{const n=p.nodes.find(x=>x.id==='{leaf['id']}'),m=n?.messages.at(-1);return !!m&&m.role==='assistant'&&m.partial===true&&m.streaming!==true}}")
        checkpoint("leaf stream stopped")
        stopped_message = next(node for node in project["nodes"] if node["id"] == leaf["id"])["messages"][-1]
        stopped_id = stopped_message["id"]
        stopped_length = len(stopped_message.get("content", ""))
        assert stopped_length > 0
        stopped_call = next(record for record in reversed(project["generationRecords"]) if record.get("responseMessageId") == stopped_id)
        assert stopped_call.get("stopped") is True and stopped_call.get("partialOutput") is True
        page.wait_for_selector(f'[data-continue-message="{stopped_id}"]')
        page.click(f'[data-continue-message="{stopped_id}"]')
        project = wait_project(page, f"p=>{{const n=p.nodes.find(x=>x.id==='{leaf['id']}'),m=n?.messages.find(x=>x.id==='{stopped_id}');return !!m&&m.streaming!==true&&m.partial!==true&&m.content.length>{stopped_length}}}")
        checkpoint("stream stop and continue")
        continued_node = next(node for node in project["nodes"] if node["id"] == leaf["id"])
        assert len([message for message in continued_node["messages"] if message["id"] == stopped_id]) == 1
        assert any(record.get("purpose") == "continue_partial" and record.get("responseMessageId") == stopped_id and record.get("success") is True for record in project["generationRecords"])

        # 折叠状态是项目数据的一部分，必须进入原生、Canvas、Markdown 导出并在重载后恢复。
        select_node(page, source_action_node["id"])
        page.click(f'[data-node-collapse="{source_action_node["id"]}"]')
        project = wait_project(page, f"p=>p.nodes.find(n=>n.id==='{source_action_node['id']}').collapsed===true")

        # 本地版本记录必须从 UI 可见；开放导出必须产出可解析、可迁移且不含敏感字段的文件。
        page.click("#historyBtn")
        page.wait_for_selector("#backupDialog[open]")
        page.wait_for_selector("[data-restore-backup]")
        assert page.locator(".backup-item").count() >= 1
        assert "本地版本" in page.locator("#backupDialog").inner_text()
        assert "保留最近" in page.locator("#backupSummary").inner_text()
        page.locator("#backupDialog .modal-close").click()

        page.click("#exportBtn")
        page.wait_for_selector("#exportDialog[open]")
        assert page.locator("[data-export-format]").count() == 3
        page.click('[data-export-format="native"]')
        native_export = page.evaluate("JSON.parse(JSON.stringify(window.__lastExportForTest))")
        native_payload = json.loads(native_export["text"])
        assert native_export["filename"].endswith(".json")
        assert native_payload["exportFormat"] == "thought-canvas-v12"
        assert native_payload["projectId"] == project["projectId"]
        assert next(node for node in native_payload["nodes"] if node["id"] == source_action_node["id"])["collapsed"] is True
        assert any(node.get("kind") == "annotation" and node.get("title") == "关键成本假设（已编辑）" for node in native_payload["nodes"])
        assert all(secret_key not in native_export["text"] for secret_key in ('"apiKey"', '"accessToken"', '"clientSecret"', '"authorization"', '"cookie"'))

        page.click("#exportBtn")
        page.wait_for_selector("#exportDialog[open]")
        page.click('[data-export-format="canvas"]')
        canvas_export = page.evaluate("JSON.parse(JSON.stringify(window.__lastExportForTest))")
        canvas_payload = json.loads(canvas_export["text"])
        assert canvas_export["filename"].endswith(".canvas")
        assert len(canvas_payload["nodes"]) >= len(project["nodes"])
        assert all({"id", "type", "x", "y", "width", "height"}.issubset(item) for item in canvas_payload["nodes"])
        assert any(edge.get("label") == "提炼自" for edge in canvas_payload["edges"])
        assert any(edge.get("label") in {"支持", "反驳", "依赖"} for edge in canvas_payload["edges"])
        assert any(edge.get("label") == "标注" for edge in canvas_payload["edges"])
        assert any("关键成本假设（已编辑）" in node.get("text", "") for node in canvas_payload["nodes"])
        assert any("折叠状态**：已折叠" in node.get("text", "") for node in canvas_payload["nodes"] if node.get("id") == source_action_node["id"])

        page.click("#exportBtn")
        page.wait_for_selector("#exportDialog[open]")
        page.click('[data-export-format="markdown"]')
        markdown_export = page.evaluate("JSON.parse(JSON.stringify(window.__lastExportForTest))")
        assert markdown_export["filename"].endswith(".md")
        assert "## 最终目标" in markdown_export["text"]
        assert "## 推理对象" in markdown_export["text"]
        assert "## 决策与收敛结果" in markdown_export["text"]
        assert "## 画布节点" in markdown_export["text"]
        assert "关键成本假设（已编辑）" in markdown_export["text"] and "annotation / 风险" in markdown_export["text"]
        assert f"### {source_action_node['title']}" in markdown_export["text"] and "- 折叠状态：已折叠" in markdown_export["text"]
        assert f"- 标注来源节点：{source_action_node['id']}" in markdown_export["text"]
        checkpoint("history and exports")

        before_scale = project["camera"]["scale"]
        page.locator("#viewport").hover()
        page.mouse.wheel(0, 100)
        project = wait_project(page, f"p=>p.camera.scale!=={before_scale}")
        assert abs(project["camera"]["scale"] - before_scale) < 0.2

        # 自定义模型选择器必须与触发器分离，且底层 select 仍同步供状态机/辅助技术使用。
        checkpoint("model picker opening")
        model_trigger = page.locator('[data-composer-picker-trigger="model"]')
        model_trigger.evaluate("el=>el.click()")
        page.wait_for_selector('[data-composer-picker-menu="model"]:not(.hidden)')
        picker_geometry = page.locator('[data-composer-picker="model"]').evaluate("""el=>{const t=el.querySelector('[data-composer-picker-trigger]').getBoundingClientRect(),m=el.querySelector('[data-composer-picker-menu]').getBoundingClientRect(),n=el.querySelector('select'),ns=getComputedStyle(n),ts=getComputedStyle(el.querySelector('[data-composer-picker-trigger]'));return{trigger:{top:t.top,bottom:t.bottom},menu:{top:m.top,bottom:m.bottom},native:{width:n.getBoundingClientRect().width,opacity:ns.opacity},outlineColor:ts.outlineColor}}""")
        assert picker_geometry["menu"]["bottom"] <= picker_geometry["trigger"]["top"] - 6
        assert picker_geometry["native"]["width"] <= 1.5 and picker_geometry["native"]["opacity"] == "0"
        assert "169, 140, 255" not in picker_geometry["outlineColor"] and "183, 167, 255" not in picker_geometry["outlineColor"]
        page.locator('[data-composer-picker="model"] [data-composer-picker-option="deepseek-v4-pro"]').evaluate("el=>el.click()")
        page.wait_for_function("document.querySelector('#composerModel')?.value==='deepseek-v4-pro'")
        assert page.locator('[data-composer-picker-trigger="model"] .composer-picker-value').inner_text() == "DeepSeek V4 Pro"

        reasoning_trigger = page.locator('[data-composer-picker-trigger="reasoning"]')
        assert reasoning_trigger.is_enabled()
        checkpoint("reasoning picker opening")
        reasoning_trigger.evaluate("el=>el.click()")
        page.wait_for_selector('[data-composer-picker-menu="reasoning"]:not(.hidden)')
        reasoning_geometry = page.locator('[data-composer-picker="reasoning"]').evaluate("""el=>{const t=el.querySelector('[data-composer-picker-trigger]').getBoundingClientRect(),m=el.querySelector('[data-composer-picker-menu]').getBoundingClientRect(),n=el.querySelector('select'),ns=getComputedStyle(n),ts=getComputedStyle(el.querySelector('[data-composer-picker-trigger]'));return{trigger:{top:t.top,bottom:t.bottom},menu:{top:m.top,bottom:m.bottom},native:{width:n.getBoundingClientRect().width,opacity:ns.opacity},outlineColor:ts.outlineColor}}""")
        assert reasoning_geometry["menu"]["bottom"] <= reasoning_geometry["trigger"]["top"] - 6
        assert reasoning_geometry["native"]["width"] <= 1.5 and reasoning_geometry["native"]["opacity"] == "0"
        assert "169, 140, 255" not in reasoning_geometry["outlineColor"] and "183, 167, 255" not in reasoning_geometry["outlineColor"]
        page.locator('[data-composer-picker="reasoning"] [data-composer-picker-option="high"]').evaluate("el=>el.click()")
        page.wait_for_function("document.querySelector('#composerReasoning')?.value==='high'")
        assert page.locator('[data-composer-picker-trigger="reasoning"] .composer-picker-value').inner_text() == "高"

        checkpoint("custom model and reasoning pickers")

        checkpoint("provider settings opening")
        page.click("#settingsBtn")
        page.wait_for_selector("#settingsDialog[open]")
        checkpoint("provider settings opened")
        page.click('[data-settings-tab="providers"]')
        checkpoint("providers tab opened")
        headings = page.locator(".provider-category").all_inner_texts()
        assert set(headings).issubset({"预设", "自定义"}) and "预设" in headings
        assert page.locator("#providerProfileList").inner_text().find("Mock") == -1

        # “保存非敏感配置”不能绕过连接验证写入 API Key。
        page.locator('[data-provider-profile="deepseek"]').evaluate("el=>el.click()")
        checkpoint("deepseek editor selected")
        page.wait_for_function("document.querySelector('#providerEditorTitle')?.textContent.includes('DeepSeek')")
        direct_secret_writes_before = page.evaluate("window.__apiState.requests.filter(x=>x.path==='/api/provider-secret'&&!x.body.clear).length")
        page.fill("#providerApiKeyInput", "save-only-unverified-key")
        page.locator("#saveProviderBtn").evaluate("el=>el.click()")
        page.wait_for_function("document.querySelector('#providerApiKeyInput')?.value===''", timeout=10000, polling=50)
        assert page.evaluate("window.__apiState.requests.filter(x=>x.path==='/api/provider-secret'&&!x.body.clear).length") == direct_secret_writes_before
        assert page.evaluate("window.__apiState.settings.providers.find(x=>x.id==='deepseek')?.connectionStatus") == "connected"

        # API Key 供应商通过一个主动作完成验证、密钥保存、模型发现与思考能力同步。
        page.fill("#providerApiKeyInput", "ui-secret-key")
        checkpoint("api key entered")
        connect_requests_before = page.evaluate("window.__apiState.requests.filter(x=>x.path==='/api/providers/connect').length")
        page.locator("#connectProviderBtn").evaluate("el=>el.click()")
        checkpoint("connect action invoked")
        page.wait_for_function(f"window.__apiState.requests.filter(x=>x.path==='/api/providers/connect').length>{connect_requests_before}", timeout=10000, polling=50)
        page.wait_for_function("document.querySelector('#providerConnectionState')?.textContent==='已连接'", timeout=10000, polling=50)
        connect_request = page.evaluate("window.__apiState.requests.filter(x=>x.path==='/api/providers/connect').at(-1)")
        assert connect_request["sessionHeader"] == "browser-gate-session"
        assert connect_request["body"]["apiKey"] == "ui-secret-key"
        assert page.input_value("#providerApiKeyInput") == ""
        assert "已保存" in page.locator("#providerKeyStatus").inner_text()
        synced_model_ids = page.locator("[data-model-id]").evaluate_all("els=>els.map(el=>el.value)")
        assert "deepseek-reasoner-ui" in synced_model_ids
        assert "思考" in page.locator("#providerModelRows").inner_text()
        persisted_provider = page.evaluate("window.__apiState.settings.providers.find(x=>x.id==='deepseek')")
        assert persisted_provider["connectionStatus"] == "connected"
        assert any(item["id"] == "deepseek-reasoner-ui" and "max" in item["reasoningEfforts"] for item in persisted_provider["models"])
        assert "ui-secret-key" not in json.dumps(page.evaluate("window.__apiState.settings"), ensure_ascii=False)

        # 新 Key 或重新同步失败时，服务端和 UI 都保留先前已验证连接。
        failed_connects_before = page.evaluate("window.__apiState.requests.filter(x=>x.path==='/api/providers/connect').length")
        page.fill("#providerApiKeyInput", "bad-ui-key")
        page.locator("#connectProviderBtn").evaluate("el=>el.click()")
        page.wait_for_function(f"window.__apiState.requests.filter(x=>x.path==='/api/providers/connect').length>{failed_connects_before}", timeout=10000, polling=50)
        page.wait_for_function("document.querySelector('#providerConnectionState')?.textContent.includes('原连接仍可用')", timeout=10000, polling=50)
        assert "原连接仍可用" in page.locator("#providerConnectionState").inner_text()
        page.locator("#saveProviderBtn").evaluate("el=>el.click()")
        page.wait_for_function("document.querySelector('#providerApiKeyInput')?.value===''", timeout=10000, polling=50)
        persisted_after_failed_reconnect = page.evaluate("window.__apiState.settings.providers.find(x=>x.id==='deepseek')")
        assert persisted_after_failed_reconnect["connectionStatus"] == "connected"
        assert "deepseek-reasoner-ui" in [item["id"] for item in persisted_after_failed_reconnect["models"]]
        assert page.evaluate("window.__apiState.secretStatus.deepseek") is True
        checkpoint("api-key provider connected and synced")

        # 设置页使用可读字号和单层中性焦点，不再出现 label + input 的双紫框。
        settings_metrics = page.evaluate("""()=>{const profile=document.querySelector('.provider-profile-item strong'),small=document.querySelector('.provider-profile-item small'),label=document.querySelector('label:has(#providerBaseUrlInput)'),input=document.querySelector('#providerBaseUrlInput'),header=document.querySelector('.provider-settings-modal .modal-header p'),cap=document.querySelector('.provider-model-capability'),row=document.querySelector('.provider-model-row');input.focus();const ps=getComputedStyle(profile),ss=getComputedStyle(small),ls=getComputedStyle(label),is=getComputedStyle(input),hs=getComputedStyle(header),cs=getComputedStyle(cap),r=input.getBoundingClientRect(),rr=row.getBoundingClientRect();return{profile:parseFloat(ps.fontSize),small:parseFloat(ss.fontSize),header:parseFloat(hs.fontSize),input:parseFloat(is.fontSize),height:r.height,labelOutline:ls.outlineStyle,border:is.borderColor,shadow:is.boxShadow,capability:parseFloat(cs.fontSize),rowWidth:rr.width,rowScrollWidth:row.scrollWidth}}""")
        assert settings_metrics["profile"] >= 13
        assert settings_metrics["small"] >= 11
        assert settings_metrics["header"] >= 13
        assert settings_metrics["input"] >= 14 and settings_metrics["height"] >= 44
        assert settings_metrics["capability"] >= 12
        assert settings_metrics["rowScrollWidth"] <= settings_metrics["rowWidth"] + 2
        assert settings_metrics["labelOutline"] == "none"
        assert "169, 140, 255" not in settings_metrics["border"] and "183, 167, 255" not in settings_metrics["border"]
        assert "169, 140, 255" not in settings_metrics["shadow"] and "183, 167, 255" not in settings_metrics["shadow"]
        checkpoint("settings typography")

        # OAuth UI：浏览器登录为主路径，设备码为备选，并可取消进行中的授权。
        checkpoint("oauth tab opening")
        page.click('[data-settings-tab="oauth"]')
        checkpoint("oauth tab clicked")
        page.wait_for_function("document.querySelector('#codexOAuthBadge')?.textContent==='未连接'", timeout=10000, polling=50)
        checkpoint("oauth disconnected rendered")
        assert page.locator("#codexBrowserLoginBtn").is_enabled()
        assert page.locator("#codexDeviceLoginBtn").is_enabled()
        checkpoint("oauth browser click")
        page.click("#codexBrowserLoginBtn")
        checkpoint("oauth browser clicked")
        page.wait_for_function("window.__apiState.requests.some(r=>r.path==='/api/oauth/codex/start'&&r.body.mode==='browser')")
        checkpoint("oauth browser request seen")
        page.wait_for_function("document.querySelector('#codexOAuthBadge')?.textContent==='已连接'", timeout=10000, polling=50)
        assert page.locator("#codexBrowserLoginBtn").is_disabled()
        assert page.locator("#codexLogoutBtn").is_enabled()
        assert "codex.ui@example.com" in page.locator("#codexAccountSummary").inner_text()
        assert "plus" in page.locator("#codexAccountSummary").inner_text().lower()
        assert "GPT-5.6 Codex" in page.locator("#codexModelSummary").inner_text()
        assert page.locator("#codexUseNowBtn").is_visible() and page.locator("#codexUseNowBtn").is_enabled()
        assert any("auth.openai.com/oauth/authorize" in value for value in page.evaluate("window.__openedUrls"))
        page.locator("#codexUseNowBtn").evaluate("el=>el.click()")
        page.wait_for_selector("#settingsDialog", state="hidden")
        page.wait_for_function("window.__apiState.settings.defaultProvider==='codex-cli'&&window.__apiState.settings.defaultModel==='gpt-5.6-codex'", timeout=10000, polling=50)
        page.wait_for_function("document.querySelector('#composerProvider')?.value==='codex-cli'&&document.querySelector('#composerModel')?.value==='gpt-5.6-codex'", timeout=10000, polling=50)
        assert page.locator('[data-composer-picker-trigger="reasoning"] .composer-picker-value').inner_text() == "高"
        checkpoint("codex browser login")

        checkpoint("oauth settings reopening")
        page.locator("#settingsBtn").evaluate("el=>el.click()")
        page.wait_for_selector("#settingsDialog[open]")
        checkpoint("oauth settings reopened")
        page.locator('[data-settings-tab="oauth"]').evaluate("el=>el.click()")
        page.wait_for_function("document.querySelector('#codexOAuthBadge')?.textContent==='已连接'", timeout=10000, polling=50)
        checkpoint("oauth connected rerendered")
        page.locator("#codexLogoutBtn").evaluate("el=>el.click()")
        page.wait_for_function("document.querySelector('#codexOAuthBadge')?.textContent==='未连接'", timeout=10000, polling=50)
        page.locator("#codexDeviceLoginBtn").evaluate("el=>el.click()")
        page.wait_for_function("window.__apiState.requests.some(r=>r.path==='/api/oauth/codex/start'&&r.body.mode==='device')")
        page.wait_for_selector("#codexCancelLoginBtn:not(.hidden)")
        assert "UI-1234" in page.locator("#codexOAuthDetail").inner_text()
        assert any("auth.openai.com/codex/device" in value for value in page.evaluate("window.__openedUrls"))
        page.locator("#codexCancelLoginBtn").evaluate("el=>el.click()")
        page.wait_for_function("window.__apiState.requests.some(r=>r.path==='/api/oauth/codex/cancel')")
        page.wait_for_function("document.querySelector('#codexOAuthBadge')?.textContent==='未连接'", timeout=10000, polling=50)
        checkpoint("codex device cancel")

        checkpoint("general tab opening")
        page.click('[data-settings-tab="general"]')
        checkpoint("general tab opened")

        # 界面语言可在设置中实时预览；用户项目标题和对话正文不做自动翻译。
        preserved_user_content = page.evaluate("""()=>({
          project:document.querySelector('.project-copy strong')?.textContent||'',
          message:document.querySelector('.message-body')?.textContent||''
        })""")
        language_options = page.locator('#uiLanguageSelect option').evaluate_all("els=>els.map(el=>({value:el.value,label:el.textContent.trim()}))")
        assert language_options == [
            {"value": "zh-CN", "label": "简体中文"},
            {"value": "en", "label": "English"},
            {"value": "ja", "label": "日本語"},
        ]
        page.select_option('#uiLanguageSelect', 'en')
        page.wait_for_function("document.documentElement.lang==='en'&&document.querySelector('#settingsDialog .modal-header h2')?.textContent==='Model providers and context'", polling=50)
        assert page.locator('[data-settings-tab="general"]').inner_text() == 'General'
        assert page.locator('.language-settings-card h3').inner_text() == 'Interface language'
        assert page.locator('#saveSettingsBtn').inner_text() == 'Save all settings'
        assert page.locator('.project-copy strong').inner_text() == preserved_user_content['project']
        assert page.evaluate("document.querySelector('.message-body')?.textContent||''") == preserved_user_content['message']
        # Even user content that exactly matches a UI dictionary key must not
        # be translated. This catches accidental DOM-wide replacement.
        page.evaluate("document.querySelector('.project-copy strong').textContent='设置';window.__i18n.localizeUi(document.documentElement)")
        assert page.locator('.project-copy strong').inner_text() == '设置'
        page.evaluate("value=>document.querySelector('.project-copy strong').textContent=value", preserved_user_content['project'])
        page.select_option('#uiLanguageSelect', 'ja')
        page.wait_for_function("document.documentElement.lang==='ja'&&document.querySelector('#settingsDialog .modal-header h2')?.textContent==='モデルプロバイダーとコンテキスト'", polling=50)
        assert page.locator('[data-settings-tab="general"]').inner_text() == '一般'
        assert page.locator('.language-settings-card h3').inner_text() == '表示言語'
        assert page.locator('#saveSettingsBtn').inner_text() == 'すべての設定を保存'
        assert page.locator('.project-copy strong').inner_text() == preserved_user_content['project']
        assert page.evaluate("document.querySelector('.message-body')?.textContent||''") == preserved_user_content['message']
        page.select_option('#uiLanguageSelect', 'zh-CN')
        page.wait_for_function("document.documentElement.lang==='zh-CN'&&document.querySelector('#settingsDialog .modal-header h2')?.textContent==='模型供应商与上下文'", polling=50)
        checkpoint("language switching and user-content isolation")

        page.locator("#autoCompactEnabledInput").evaluate("el=>{el.checked=false;el.dispatchEvent(new Event('change',{bubbles:true}))}")
        checkpoint("auto compact unchecked")
        page.select_option("#connectionShapeInput", "curve")
        page.select_option("#connectionStrokeInput", "dashed")
        checkpoint("connection style selected")
        page.click('#settingsForm button[type="submit"]')
        checkpoint("settings submitted")
        page.wait_for_function("window.__apiState.settings.autoCompactEnabled===false&&window.__apiState.settings.connectionShape==='curve'&&window.__apiState.settings.connectionStroke==='dashed'")
        page.wait_for_selector("#settingsDialog", state="hidden")
        assert "deepseek-reasoner-ui" in page.locator("#composerModel option").evaluate_all("els=>els.map(el=>el.value)")
        checkpoint("settings saved")
        assert page.locator(".edge.user-dashed").count() >= 1
        assert all(" C " in d for d in page.locator(".edge.user-dashed").evaluate_all("els=>els.map(e=>e.getAttribute('d'))"))
        dash_pattern = page.locator(".edge.user-dashed").first.evaluate("el=>getComputedStyle(el).strokeDasharray")
        assert dash_pattern.replace("px", "").replace(" ", "") in {"3,3", "3,3,3,3"}
        assert "14px" in page.locator("#viewport").evaluate("el=>getComputedStyle(el).backgroundSize")

        # 窄画布下左上角标题与副标题不能互相覆盖；动作栏允许换行但不能相互重叠。
        page.set_viewport_size({"width": 1000, "height": 820})
        page.wait_for_timeout(80)
        chrome_boxes = page.locator("#topChrome > :not(.hidden)").evaluate_all("els=>els.filter(e=>getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect();return{id:e.id||e.className,x:r.x,y:r.y,w:r.width,h:r.height}})")
        for i, a in enumerate(chrome_boxes):
            for b in chrome_boxes[i+1:]:
                assert not (a["x"] < b["x"]+b["w"] and a["x"]+a["w"] > b["x"] and a["y"] < b["y"]+b["h"] and a["y"]+a["h"] > b["y"]), f"top chrome overlap {a['id']} {b['id']}"
        assert page.locator(".project-copy").evaluate("el=>{const a=el.querySelector('strong').getBoundingClientRect(),b=el.querySelector('span');if(getComputedStyle(b).display==='none')return true;const r=b.getBoundingClientRect();return a.bottom<=r.top+1}")
        action_boxes = page.locator(".header-actions > *").evaluate_all("els=>els.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})")
        for i, a in enumerate(action_boxes):
            for b in action_boxes[i+1:]:
                assert not (a["x"] < b["x"]+b["w"] and a["x"]+a["w"] > b["x"] and a["y"] < b["y"]+b["h"] and a["y"]+a["h"] > b["y"])
        page.set_viewport_size({"width": 1680, "height": 1050})
        page.wait_for_timeout(80)
        top_metrics = page.evaluate("""()=>{const project=document.querySelector('.top-chrome:not(.home-mode) .project-bar').getBoundingClientRect(),goal=document.querySelector('.top-chrome:not(.home-mode) .goal-bar').getBoundingClientRect(),save=document.querySelector('.top-chrome:not(.home-mode) .save-status').getBoundingClientRect(),search=document.querySelector('.canvas-search-field').getBoundingClientRect(),sidebar=document.querySelector('#sidebar').getBoundingClientRect(),input=document.querySelector('#goalInput').getBoundingClientRect(),chrome=getComputedStyle(document.querySelector('#topChrome'));return{project,goal,save,search,sidebar,input,chromeBackground:chrome.backgroundColor,canvasCenter:sidebar.x/2,goalCenter:goal.x+goal.width/2}}""")
        assert abs(top_metrics["project"]["x"] - top_metrics["search"]["x"]) <= 1
        assert abs(top_metrics["goalCenter"] - top_metrics["canvasCenter"]) <= 4
        assert top_metrics["input"]["bottom"] <= top_metrics["goal"]["bottom"] - 7
        assert top_metrics["chromeBackground"] in {"rgba(0, 0, 0, 0)", "transparent"}
        def rectangles_overlap(a, b):
            return a["x"] < b["right"] and a["right"] > b["x"] and a["y"] < b["bottom"] and a["bottom"] > b["y"]
        assert not rectangles_overlap(top_metrics["project"], top_metrics["goal"])
        assert not rectangles_overlap(top_metrics["goal"], top_metrics["save"])

        # Pointer focus is calm; keyboard navigation still receives a visible focus indicator.
        page.click("#goalInput")
        pointer_focus = page.locator("#goalInput").evaluate("el=>({outline:getComputedStyle(el).outlineStyle,shadow:getComputedStyle(el).boxShadow})")
        assert pointer_focus["outline"] == "none" and pointer_focus["shadow"] == "none"
        page.evaluate("document.body.classList.add('keyboard-navigation');document.querySelector('#goalInput').blur();document.querySelector('#goalInput').focus()")
        keyboard_focus = page.locator("#goalInput").evaluate("el=>({outline:getComputedStyle(el).outlineStyle,width:getComputedStyle(el).outlineWidth})")
        assert keyboard_focus["outline"] != "none" and keyboard_focus["width"] != "0px"
        page.mouse.click(12, 220)

        seed = page.evaluate("JSON.parse(JSON.stringify(window.__apiState))")
        # The reload gate validates persisted project behavior, not the full backup payload.
        # Dropping backup snapshots here keeps the in-page seed compact and avoids Chromium
        # spending release-test time parsing nested copies of the same project.
        reload_seed = json.loads(json.dumps(seed))
        reload_seed["backups"] = {}
        page.evaluate("try{localStorage.clear()}catch{};try{sessionStorage.clear()}catch{}")
        page.close()
        checkpoint("primary page closed")
        page2 = context.new_page()
        checkpoint("reload page created")
        page2.on("pageerror", lambda error: errors.append(str(error)))
        page2.on("dialog", lambda dialog: dialog.accept())
        load_app(page2, reload_seed)
        checkpoint("reload app loaded")
        page2.wait_for_selector("#workspace:not(.hidden)")
        restored = project_state(page2)
        assert any(message.get("type") == "organized_summary" for message in next(node for node in restored["nodes"] if node["id"] == "root")["messages"])
        assert len(restored["nodes"]) == len(project["nodes"])
        assert next(node for node in restored["nodes"] if node["id"] == source_action_node["id"])["collapsed"] is True
        assert len(restored.get("artifacts", [])) >= 3
        assert len(restored.get("reasoningEdges", [])) == 1
        restored_merge = next(node for node in restored["nodes"] if node["kind"] == "merge_summary")
        assert any(item["id"] == restored_merge["decisionArtifactId"] and item["kind"] == "decision" for item in restored["artifacts"])
        no_overlap(page2)
        page2.close()
        checkpoint("reload page closed")

        # Auto Compact 使用最小隔离工程，避免让前面故意生成的长流式内容影响此 gate。
        active_id = seed["activeProjectId"]
        source_project = seed["projects"][active_id]
        minimal_root = json.loads(json.dumps(next(node for node in source_project["nodes"] if node["id"] == "root")))
        minimal_root.update({
            "title": "Auto Compact Gate",
            "question": "验证自动 Compact",
            "summary": "用于隔离验证自动 Compact。",
            "messages": [
                {"id":"auto_u1","role":"user","content":"事实一是什么？","createdAt":"2026-07-23T11:00:00.000Z"},
                {"id":"auto_a1","role":"assistant","content":"事实一：原始消息必须保留。","createdAt":"2026-07-23T11:01:00.000Z"},
                {"id":"auto_u2","role":"user","content":"事实二是什么？","createdAt":"2026-07-23T11:02:00.000Z"},
                {"id":"auto_a2","role":"assistant","content":"事实二：Compact 只创建派生摘要。","createdAt":"2026-07-23T11:03:00.000Z"}
            ],
            "compactSnapshots": [],
            "activeCompactId": "",
            "decomposedMessageIds": [],
            "decompositions": [],
            "contextSnapshotCache": {},
            "contextSnapshot": None,
            "contextSnapshotId": "",
            "lastContextSnapshotId": "",
            "branchAnchor": None
        })
        auto_project_seed = json.loads(json.dumps(source_project))
        auto_project_seed.update({
            "projectTitle": "Auto Compact Gate",
            "nodes": [minimal_root],
            "edges": [],
            "artifacts": [],
            "reasoningEdges": [],
            "contextSnapshots": [],
            "generationRecords": [],
            "modelCalls": [],
            "selectedIds": ["root"],
            "camera": {"x": 145, "y": 110, "scale": 1}
        })
        seed_auto = {
            "settings": json.loads(json.dumps(seed["settings"])),
            "secretStatus": json.loads(json.dumps(seed.get("secretStatus", {}))),
            "projects": {active_id: auto_project_seed},
            "backups": {},
            "activeProjectId": active_id,
            "requests": []
        }
        seed_auto["settings"]["autoCompactEnabled"] = True
        seed_auto["settings"]["autoCompactMessageLimit"] = 4
        auto_raw_ids = [message["id"] for message in minimal_root["messages"]]
        page3 = context.new_page()
        page3.on("pageerror", lambda error: errors.append(str(error)))
        load_app(page3, seed_auto)
        checkpoint("auto compact page loaded")
        select_node(page3, "root")
        checkpoint("auto compact node selected")
        page3.fill("#messageDraft", "触发自动 Compact 后继续回答。")
        checkpoint("auto compact draft filled")
        page3.press("#messageDraft", "Enter")
        checkpoint("auto compact enter pressed")
        auto_project = wait_project(page3, "p=>p.nodes.find(n=>n.id==='root').compactSnapshots?.some(x=>x.trigger==='auto')&&p.nodes.find(n=>n.id==='root').messages.at(-1)?.streaming!==true")
        checkpoint("auto compact completed")
        auto_root_after = next(node for node in auto_project["nodes"] if node["id"] == "root")
        assert all(message_id in [message["id"] for message in auto_root_after["messages"]] for message_id in auto_raw_ids)
        assert any(snapshot.get("trigger") == "auto" for snapshot in auto_root_after["compactSnapshots"])
        page3.close()
        checkpoint("auto compact page closed")

        # 恢复 gate 同样使用最小工程，并验证恢复来源会在后续自动保存后继续保留。
        restore_current = json.loads(json.dumps(auto_project_seed))
        restore_current["projectTitle"] = "恢复前版本"
        restore_current["nodes"][0]["x"] = 180
        restore_old = json.loads(json.dumps(restore_current))
        restore_old["projectTitle"] = "待恢复版本"
        restore_old["projectUpdatedAt"] = "2026-07-22T10:00:00.000Z"
        restore_old["nodes"][0]["x"] = 412
        restore_backup_id = f"{active_id}.2026-07-22T10-00-00-000Z.json"
        restore_seed = {
            "settings": json.loads(json.dumps(seed["settings"])),
            "secretStatus": json.loads(json.dumps(seed.get("secretStatus", {}))),
            "projects": {active_id: restore_current},
            "backups": {active_id: [{"id": restore_backup_id, "createdAt": "2026-07-22T10:00:00.000Z", "project": restore_old}]},
            "activeProjectId": active_id,
            "requests": []
        }
        restore_page = context.new_page()
        restore_page.on("pageerror", lambda error: errors.append(str(error)))
        restore_page.on("dialog", lambda dialog: dialog.accept())
        load_app(restore_page, restore_seed)
        restore_page.click("#historyBtn")
        restore_page.wait_for_selector(f'[data-restore-backup="{restore_backup_id}"]')
        restore_count_before = restore_page.evaluate("window.__apiState.backups[window.__apiState.activeProjectId]?.length||0")
        restore_page.locator(f'[data-restore-backup="{restore_backup_id}"]').evaluate("el=>el.click()")
        restore_page.wait_for_selector("#confirmDialog[open]")
        restore_page.click("#confirmDialogConfirmBtn")
        restored_via_ui = wait_project(restore_page, f"p=>p.restoredFromBackup==='{restore_backup_id}'&&p.projectTitle==='待恢复版本'&&p.nodes.find(n=>n.id==='root').x===412")
        assert restored_via_ui["restoredAt"]
        restore_count_after = restore_page.evaluate("window.__apiState.backups[window.__apiState.activeProjectId]?.length||0")
        assert restore_count_after >= restore_count_before
        restore_page.wait_for_selector("#backupDialog", state="hidden")
        restore_page.close()
        checkpoint("restore page closed")

        # 删除项目使用系统内的居中确认弹窗，不再调用浏览器原生 confirm。
        delete_project_seed = json.loads(json.dumps(seed_auto))
        delete_project_seed["projects"] = {active_id: json.loads(json.dumps(auto_project_seed))}
        delete_project_seed["projects"][active_id]["projectTitle"] = "待删除测试项目"
        delete_project_seed["activeProjectId"] = active_id
        delete_page = context.new_page()
        delete_page.on("pageerror", lambda error: errors.append(str(error)))
        load_app(delete_page, delete_project_seed)
        delete_page.click("#homeBtn")
        delete_page.wait_for_selector("#homeView:not(.hidden)")
        delete_page.evaluate("window.__nativeConfirmCalled=false;window.__nativeConfirmStack='';window.confirm=function(){window.__nativeConfirmCalled=true;window.__nativeConfirmStack=(new Error('native confirm invoked')).stack;return false};void 0")
        delete_page.click(f'[data-delete-project="{active_id}"]')
        delete_page.wait_for_selector("#confirmDialog[open]")
        delete_metrics = delete_page.evaluate("""()=>{const d=document.querySelector('#confirmDialog').getBoundingClientRect(),h=document.querySelector('#confirmDialogTitle'),p=document.querySelector('#confirmDialogMessage');return{cx:d.x+d.width/2,cy:d.y+d.height/2,vx:innerWidth/2,vy:innerHeight/2,title:parseFloat(getComputedStyle(h).fontSize),copy:parseFloat(getComputedStyle(p).fontSize)}}""")
        assert abs(delete_metrics["cx"] - delete_metrics["vx"]) < 2 and abs(delete_metrics["cy"] - delete_metrics["vy"]) < 2
        assert delete_metrics["title"] >= 24 and delete_metrics["copy"] >= 13
        delete_page.click("#confirmDialogCancelBtn")
        assert delete_page.evaluate(f"!!window.__apiState.projects['{active_id}']")
        native_confirm_probe = delete_page.evaluate("()=>({called:window.__nativeConfirmCalled,stack:window.__nativeConfirmStack})")
        assert not native_confirm_probe["called"], native_confirm_probe["stack"]
        delete_page.click(f'[data-delete-project="{active_id}"]')
        delete_page.click("#confirmDialogConfirmBtn")
        delete_page.wait_for_function(f"!window.__apiState.projects['{active_id}']")
        delete_page.close()
        checkpoint("custom project deletion")

        # 截图中的乱码模式是 UTF-8 字节被按 Windows-1252 解码。客户端在
        # 工作区索引和项目正文两层恢复可读文字，保留用户内容原语言，并在
        # 下一次保存时把修复后的状态和迁移元数据写回项目。
        mojibake_sample = "è§£é‡Š Harness é‡Œé¢ loop çš„æ¦‚å¿µã€è¿è¡Œæœºåˆ¶åŠå®žé™…åº”ç”¨"
        repaired_sample = "解释 Harness 里面 loop 的概念、运行机制及实际应用"
        mojibake_project_id = "project_mojibake_gate"
        mojibake_root = {
            "id": "root", "kind": "root", "origin": "root", "x": 180, "y": 280,
            "title": mojibake_sample, "question": mojibake_sample, "summary": mojibake_sample,
            "content": mojibake_sample, "status": "exploring", "parentId": None,
            "messages": [
                {"id": "moji_user", "role": "user", "content": mojibake_sample, "createdAt": "2026-07-24T10:00:00.000Z"},
                {"id": "moji_ai", "role": "assistant", "content": mojibake_sample, "createdAt": "2026-07-24T10:01:00.000Z"},
            ],
            "decomposedMessageIds": [], "compactSnapshots": [], "activeCompactId": "", "decompositions": [],
            "contextSnapshotCache": {}, "contextSnapshot": None, "contextSnapshotId": "", "lastContextSnapshotId": "",
            "branchAnchor": None, "createdAt": "2026-07-24T10:00:00.000Z", "updatedAt": "2026-07-24T10:01:00.000Z"
        }
        mojibake_project = {
            "version": "1.2.4", "projectId": mojibake_project_id, "projectTitle": mojibake_sample,
            "projectCreatedAt": "2026-07-24T10:00:00.000Z", "projectUpdatedAt": "2026-07-24T10:01:00.000Z",
            "goal": {"text": mojibake_sample, "source": "user", "status": "edited", "version": 1, "history": []},
            "nodes": [mojibake_root], "edges": [], "artifacts": [], "reasoningEdges": [], "contextSnapshots": [],
            "generationRecords": [], "modelCalls": [], "composerByNode": {}, "contextPreferencesByNode": {},
            "camera": {"x": 145, "y": 110, "scale": 1}, "selectedIds": ["root"], "viewMode": "all"
        }
        mojibake_settings = json.loads(json.dumps(seed["settings"]))
        mojibake_settings["uiLanguage"] = "en"
        mojibake_seed = {
            "settings": mojibake_settings,
            "secretStatus": json.loads(json.dumps(seed.get("secretStatus", {}))),
            "projects": {mojibake_project_id: mojibake_project},
            "backups": {}, "activeProjectId": mojibake_project_id, "requests": []
        }
        checkpoint("mojibake page creating")
        mojibake_page = context.new_page()
        checkpoint("mojibake page created")
        mojibake_page.on("pageerror", lambda error: errors.append(str(error)))
        load_app(mojibake_page, mojibake_seed)
        checkpoint("mojibake app loaded")
        mojibake_page.wait_for_function("document.documentElement.lang==='en'", polling=50)
        checkpoint("mojibake language active")
        mojibake_page.wait_for_selector('.operation-notice-toast')
        checkpoint("mojibake notice visible")
        assert mojibake_page.locator('.operation-notice-toast strong').inner_text() == 'Text encoding repaired'
        checkpoint("mojibake notice text checked")
        assert mojibake_page.locator('.project-copy strong').inner_text() == repaired_sample
        checkpoint("mojibake project title checked")
        assert mojibake_page.input_value('#goalInput') == repaired_sample
        checkpoint("mojibake goal checked")
        assert all(text == repaired_sample for text in mojibake_page.locator('.message-body').all_inner_texts())
        checkpoint("mojibake messages checked")
        assert mojibake_sample not in mojibake_page.locator('body').inner_text()
        checkpoint("mojibake raw text absent")
        assert mojibake_page.locator('#pathViewBtn').inner_text() == 'Current path'
        checkpoint("mojibake English chrome checked")
        mojibake_page.evaluate("window.__i18n.stopUiLocalization()")
        checkpoint("mojibake observer stopped")
        mojibake_page.click('#pathViewBtn')
        checkpoint("mojibake save triggered")
        mojibake_page.wait_for_function(
            f"window.__apiState.projects['{mojibake_project_id}']?.projectTitle==={json.dumps(repaired_sample, ensure_ascii=False)}"
            f"&&window.__apiState.projects['{mojibake_project_id}']?.textEncodingRepairVersion===1",
            polling=50,
        )
        stored_mojibake_project = mojibake_page.evaluate(f"window.__apiState.projects['{mojibake_project_id}']")
        assert stored_mojibake_project['goal']['text'] == repaired_sample
        assert stored_mojibake_project['nodes'][0]['messages'][1]['content'] == repaired_sample
        assert stored_mojibake_project['textEncodingRepairCount'] >= 5
        mojibake_page.close()
        checkpoint("language plus mojibake migration")

        assert not errors, errors
        # Close the browser context explicitly before the browser. Some Linux Chromium/
        # Playwright combinations otherwise leave the driver waiting on a late context
        # shutdown even though every acceptance assertion has already completed.
        context.close()
        checkpoint("browser context closed")
        browser.close()
        checkpoint("browser closed")
        print("PASS: browser v12.5 Chinese/English/Japanese switching, user-content isolation, UTF-8 mojibake repair/migration, complex selections, recursive decomposition, independent top modules, readable dialogs, custom confirmations, annotations, folding/search, API-key connect/sync, Codex OAuth, streaming, reasoning, Compact, versions and exports.", flush=True)


if __name__ == "__main__":
    main()
