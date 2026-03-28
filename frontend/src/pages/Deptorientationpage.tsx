import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Stack, Button, IconButton, Tooltip, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  Snackbar, Alert, Select, MenuItem, FormControl, InputLabel,
  Collapse, Chip,
} from '@mui/material';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import {
  Slideshow as SlideshowIcon,
  Download as DownloadIcon,
  OpenInNew as OpenInNewIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  FilterList as FilterIcon,
  PictureAsPdf as PdfIcon,
  ExpandMore as ExpandMoreIcon,
  Notes as NotesIcon,
  KeyboardArrowDown as ArrowDownIcon,
  Article as ArticleIcon,
  VerifiedUser as JDIcon,
  Apartment as ApartmentIcon,
  Work as WorkIcon,
  Quiz as QuizIcon,
  Assignment as AssignmentIcon,
  Person,
  Edit as EditIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
} from '@mui/icons-material';

const API_BASE = 'http://13.235.0.127:5000/api';
const getToken = () => localStorage.getItem('token') || '';
const getRole  = () => localStorage.getItem('role')  || 'Admin';
const isHR = true; // swap with real role check

// ── Clipboard helper — works on HTTP (no HTTPS required) ─────────────────────
function copyToClipboard(text: string): void {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}
function fallbackCopy(text: string): void {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Designation {
  _id: string;
  department: string;
  designation: string;
  role_document_link: string;
  jd_link: string;
  remarks: string;
  role_document: string;
}
interface QuarterPPT {
  id: string; fy: string; quarter: 'Q1'|'Q2'|'Q3'|'Q4'; name: string; url: string;
}
interface DeptNote {
  id: string; title: string; content: string; updatedAt: string;
}
interface LinkItem { id: string; name: string; url: string; }
interface DeptData {
  id: string; name: string;
  onboardingPPT: LinkItem | null; reviewPPTs: QuarterPPT[]; masterPPT: LinkItem | null;
  notes: DeptNote[]; recruitmentTest: LinkItem | null; onboardingTest: LinkItem | null;
}
interface ApiResponse<T = unknown> { success: boolean; data?: T; message?: string; }

// ── API helpers ───────────────────────────────────────────────────────────────
const authH = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`,
  'x-user-role': getRole(),
});
async function apiGet<T>(p: string): Promise<ApiResponse<T>> {
  const r = await fetch(`${API_BASE}${p}`, { headers: authH() });
  if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json();
}
async function apiPut<T>(p: string, body: object): Promise<ApiResponse<T>> {
  const r = await fetch(`${API_BASE}${p}`, { method:'PUT', headers:authH(), body:JSON.stringify(body) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json();
}
async function apiPost<T>(p: string, body: object): Promise<ApiResponse<T>> {
  const r = await fetch(`${API_BASE}${p}`, { method:'POST', headers:authH(), body:JSON.stringify(body) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json();
}
async function apiDel<T>(p: string): Promise<ApiResponse<T>> {
  const r = await fetch(`${API_BASE}${p}`, { method:'DELETE', headers:authH() });
  if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getCurrentFY() {
  const y = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  return `FY${String(y).slice(2)}-${String(y+1).slice(2)}`;
}
function getFYList() {
  const y = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  return Array.from({length:4},(_,i)=>`FY${String(y-i).slice(2)}-${String(y-i+1).slice(2)}`);
}
const QUARTERS: Array<'Q1'|'Q2'|'Q3'|'Q4'> = ['Q1','Q2','Q3','Q4'];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g,'').trim().replace(/\s+/g,'_');
}

const COLOR_POOL = ['#3B82F6','#10B981','#EC4899','#F59E0B','#8B5CF6','#0EA5E9','#EF4444','#F97316','#14B8A6','#6366F1'];
const colorCache: Record<string,string> = {};
function deptColor(n: string) {
  if (!colorCache[n]) colorCache[n] = COLOR_POOL[Object.keys(colorCache).length % COLOR_POOL.length];
  return colorCache[n];
}
const NOTION_STYLES = [
  {bg:'#EEF2FF',color:'#4F46E5',border:'#C7D2FE'},{bg:'#F0FDF4',color:'#16A34A',border:'#BBF7D0'},
  {bg:'#FFF7ED',color:'#EA580C',border:'#FED7AA'},{bg:'#FDF4FF',color:'#9333EA',border:'#E9D5FF'},
  {bg:'#FFF1F2',color:'#E11D48',border:'#FECDD3'},{bg:'#F0F9FF',color:'#0284C7',border:'#BAE6FD'},
  {bg:'#FFFBEB',color:'#D97706',border:'#FDE68A'},{bg:'#F0FDFA',color:'#0D9488',border:'#99F6E4'},
];
const notionCache: Record<string,typeof NOTION_STYLES[0]> = {};
function notionStyle(n: string) {
  if (!notionCache[n]) notionCache[n] = NOTION_STYLES[Object.keys(notionCache).length % NOTION_STYLES.length];
  return notionCache[n];
}

// ══════════════════════════════════════════════════════════════════════════════
// Shared components
// ══════════════════════════════════════════════════════════════════════════════
function EmptyState({icon,text}:{icon:React.ReactNode;text:string}) {
  return (
    <Box sx={{py:4,textAlign:'center',color:'#9CA3AF',bgcolor:'#F9FAFB',borderRadius:'12px',border:'1px dashed #E5E7EB'}}>
      <Box sx={{mb:0.5,opacity:0.4}}>{icon}</Box>
      <Typography fontSize="0.83rem">{text}</Typography>
    </Box>
  );
}

// CopyBadge — uses copyToClipboard (HTTP-safe)
function CopyBadge({text}:{text:string}) {
  const [copied,setCopied] = useState(false);
  return (
    <Tooltip title={copied?'Copied!':'Copy'}>
      <Box onClick={()=>{copyToClipboard(text);setCopied(true);setTimeout(()=>setCopied(false),1800);}}
        sx={{display:'inline-flex',alignItems:'center',gap:0.5,px:1,py:0.3,borderRadius:'6px',bgcolor:'#F1F5F9',border:'1px solid #E2E8F0',cursor:'pointer','&:hover':{bgcolor:'#E2E8F0'}}}>
        <Typography sx={{fontFamily:'monospace',fontSize:'0.7rem',color:'#64748B'}}>{text}</Typography>
        {copied?<CheckIcon sx={{fontSize:11,color:'#10B981'}}/>:<CopyIcon sx={{fontSize:11,color:'#94A3B8'}}/>}
      </Box>
    </Tooltip>
  );
}

function LinkRow({link,accentColor,sysName}:{link:LinkItem|null;accentColor:string;sysName:string}) {
  const [copied,setCopied] = useState(false);
  if (!link?.url) return <Typography fontSize="0.82rem" color="#9CA3AF" fontStyle="italic">No file added yet.</Typography>;
  return (
    <Box sx={{display:'flex',alignItems:'center',gap:1.2,p:1.2,bgcolor:'white',borderRadius:'10px',border:`1px solid ${accentColor}20`,boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
      <Box sx={{width:34,height:34,borderRadius:'8px',bgcolor:`${accentColor}12`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        <PdfIcon sx={{color:accentColor,fontSize:17}}/>
      </Box>
      <Box flex={1} minWidth={0}>
        <Typography fontSize="0.85rem" fontWeight={600} color="#1F2937" noWrap>{link.name||sysName}</Typography>
        <CopyBadge text={sysName}/>
      </Box>
      <Tooltip title="Open"><IconButton size="small" href={link.url} target="_blank" sx={{color:accentColor,bgcolor:`${accentColor}12`,borderRadius:'7px',width:30,height:30}}><OpenInNewIcon sx={{fontSize:15}}/></IconButton></Tooltip>
      <Tooltip title="Download"><IconButton size="small" component="a" href={link.url} download={sysName} sx={{color:'#6B7280',bgcolor:'#F3F4F6',borderRadius:'7px',width:30,height:30}}><DownloadIcon sx={{fontSize:15}}/></IconButton></Tooltip>
      <Tooltip title={copied?'Copied!':'Copy URL'}>
        <IconButton size="small" onClick={()=>{copyToClipboard(link.url);setCopied(true);setTimeout(()=>setCopied(false),1800);}} sx={{color:copied?'#10B981':'#6B7280',bgcolor:copied?'#F0FDF4':'#F3F4F6',borderRadius:'7px',width:30,height:30}}>
          {copied?<CheckIcon sx={{fontSize:14}}/>:<CopyIcon sx={{fontSize:14}}/>}
        </IconButton>
      </Tooltip>
    </Box>
  );
}

function LinkEditor({currentUrl,sysName,c,onSave}:{currentUrl:string;sysName:string;c:string;onSave:(name:string,url:string)=>Promise<void>;}) {
  const [editing,setEditing] = useState(false);
  const [url,setUrl]         = useState(currentUrl);
  const [saving,setSaving]   = useState(false);
  useEffect(()=>setUrl(currentUrl),[currentUrl]);
  if (!isHR) return null;
  const save = async()=>{
    if (!url.trim()) return;
    setSaving(true); await onSave(sysName,url.trim()); setSaving(false); setEditing(false);
  };
  if (!editing) return (
    <Button size="small" startIcon={<EditIcon sx={{fontSize:13}}/>} onClick={()=>setEditing(true)}
      sx={{textTransform:'none',color:c,fontSize:'0.78rem',bgcolor:`${c}10`,border:`1px solid ${c}25`,borderRadius:'8px',px:1.5,py:0.5}}>
      {currentUrl?'Edit link':'Add link'}
    </Button>
  );
  return (
    <Stack spacing={0.8} sx={{p:1.5,bgcolor:'white',borderRadius:'10px',border:'1px solid #E5E7EB'}}>
      <Box sx={{display:'flex',alignItems:'center',gap:1}}>
        <Typography fontSize="0.72rem" color="#9CA3AF">System name:</Typography>
        <CopyBadge text={sysName}/>
      </Box>
      <TextField size="small" label="Google Drive URL" value={url} onChange={e=>setUrl(e.target.value)} fullWidth sx={{'& .MuiOutlinedInput-root':{borderRadius:'8px',fontSize:'0.8rem'}}}/>
      <Stack direction="row" spacing={0.8}>
        <Button size="small" variant="contained" onClick={save} disabled={saving||!url.trim()}
          startIcon={saving?<CircularProgress size={11} color="inherit"/>:<SaveIcon sx={{fontSize:13}}/>}
          sx={{bgcolor:c,borderRadius:'7px',textTransform:'none',fontSize:'0.78rem',px:2,'&:hover':{bgcolor:c,opacity:0.9}}}>Save</Button>
        <Button size="small" onClick={()=>setEditing(false)} sx={{textTransform:'none',fontSize:'0.78rem',color:'#9CA3AF'}}>Cancel</Button>
      </Stack>
    </Stack>
  );
}

function SectionCard({num,label,icon,children}:{num:number;label:string;icon:React.ReactNode;children:React.ReactNode}) {
  const [open,setOpen] = useState(false);
  return (
    <Box sx={{borderRadius:'16px',border:`1px solid ${open?'#CBD5E1':'#E5E7EB'}`,bgcolor:'white',overflow:'hidden',boxShadow:open?'0 4px 20px rgba(0,0,0,0.07)':'0 1px 4px rgba(0,0,0,0.04)',transition:'all 0.2s'}}>
      <Box onClick={()=>setOpen(o=>!o)} sx={{display:'flex',alignItems:'center',gap:2,px:3,py:2.2,cursor:'pointer',bgcolor:open?'#F8FAFC':'white',borderBottom:open?'1px solid #F1F5F9':'none','&:hover':{bgcolor:'#F8FAFC'}}}>
        <Box sx={{width:40,height:40,borderRadius:'11px',bgcolor:open?'#E0E7FF':'#F1F5F9',display:'flex',alignItems:'center',justifyContent:'center',color:open?'#4F46E5':'#6B7280',transition:'all 0.2s',flexShrink:0}}>{icon}</Box>
        <Box flex={1} sx={{display:'flex',alignItems:'center',gap:1.2}}>
          <Typography fontSize="0.7rem" fontWeight={800} color="#CBD5E1" letterSpacing={1.2} textTransform="uppercase">{String(num).padStart(2,'0')}</Typography>
          <Typography fontSize="1rem" fontWeight={700} color="#0F172A">{label}</Typography>
        </Box>
        <ExpandMoreIcon sx={{fontSize:20,color:'#94A3B8',transform:open?'rotate(180deg)':'none',transition:'transform 0.22s'}}/>
      </Box>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box sx={{px:3,py:3}}>{children}</Box>
      </Collapse>
    </Box>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Section 1 — Presentations
// ══════════════════════════════════════════════════════════════════════════════
function DeptPresentations({dept,dd,c,onUpdate}:{dept:string;dd:DeptData|undefined;c:string;onUpdate:(n:string,d:Partial<DeptData>)=>void}) {
  const [tab,setTab]     = useState(0);
  const [fy,setFY]       = useState(getCurrentFY());
  const [q,setQ]         = useState<'Q1'|'Q2'|'Q3'|'Q4'|'all'>('all');
  const [addDlg,setDlg]  = useState(false);
  const [saving,setSaving]= useState(false);
  const [newP,setNewP]   = useState({fy:getCurrentFY(),quarter:'Q1' as 'Q1'|'Q2'|'Q3'|'Q4',url:''});

  const onbSys  = `${slugify(dept)}_onboarding_ppt`;
  const mastSys = `${slugify(dept)}_master_ppt`;

  const saveOnb  = async(name:string,url:string)=>{const r=await apiPut(`/dept-orientation/${dd?.id}/onboarding-ppt`,{name,url});if(r.success)onUpdate(dept,{onboardingPPT:{id:'ppt',name,url}});};
  const saveMast = async(name:string,url:string)=>{const r=await apiPut(`/dept-orientation/${dd?.id}/master-ppt`,{name,url});if(r.success)onUpdate(dept,{masterPPT:{id:'master',name,url}});};

  const addReview = async()=>{
    if (!newP.url) return; setSaving(true);
    const fySlug = newP.fy.toLowerCase().replace('-','_');
    const name = `${slugify(dept)}_review_ppt_${fySlug}_${newP.quarter.toLowerCase()}`;
    const r = await apiPost<QuarterPPT>(`/dept-orientation/${dd?.id}/review-ppts`,{...newP,name});
    if (r.success&&r.data) onUpdate(dept,{reviewPPTs:[...(dd?.reviewPPTs||[]),r.data]});
    setSaving(false); setDlg(false); setNewP({fy:getCurrentFY(),quarter:'Q1',url:''});
  };
  const delReview = async(id:string)=>{
    await apiDel(`/dept-orientation/${dd?.id}/review-ppts/${id}`);
    onUpdate(dept,{reviewPPTs:(dd?.reviewPPTs||[]).filter(p=>p.id!==id)});
  };

  const filtered = (dd?.reviewPPTs||[]).filter(p=>p.fy===fy&&(q==='all'||p.quarter===q));

  return (
    <Box>
      <Box sx={{display:'flex',gap:0.5,mb:2,p:0.5,bgcolor:'#F1F5F9',borderRadius:'10px',width:'fit-content'}}>
        {['Onboarding PPT','Review PPTs','Master PPT'].map((t,i)=>(
          <Button key={i} size="small" onClick={()=>setTab(i)}
            sx={{textTransform:'none',fontSize:'0.8rem',fontWeight:700,borderRadius:'8px',px:1.8,py:0.5,minHeight:32,bgcolor:tab===i?'white':'transparent',boxShadow:tab===i?'0 1px 4px rgba(0,0,0,0.1)':'none',color:tab===i?c:'#6B7280'}}>{t}</Button>
        ))}
      </Box>

      {tab===0&&<Stack spacing={1.2}><LinkRow link={dd?.onboardingPPT||null} accentColor={c} sysName={onbSys}/><LinkEditor currentUrl={dd?.onboardingPPT?.url||''} sysName={onbSys} c={c} onSave={saveOnb}/></Stack>}

      {tab===1&&(
        <Stack spacing={1.5}>
          <Box sx={{display:'flex',gap:1.5,alignItems:'center',p:1.5,bgcolor:'#F8FAFC',borderRadius:'10px',border:'1px solid #E5E7EB',flexWrap:'wrap'}}>
            <FilterIcon sx={{fontSize:16,color:'#94A3B8'}}/>
            <FormControl size="small" sx={{minWidth:105}}>
              <InputLabel sx={{fontSize:'0.78rem'}}>FY</InputLabel>
              <Select value={fy} label="FY" onChange={e=>setFY(e.target.value)} sx={{fontSize:'0.8rem',borderRadius:'8px',bgcolor:'white'}}>
                {getFYList().map(f=><MenuItem key={f} value={f} sx={{fontSize:'0.8rem'}}>{f}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{minWidth:80}}>
              <InputLabel sx={{fontSize:'0.78rem'}}>Quarter</InputLabel>
              <Select value={q} label="Quarter" onChange={e=>setQ(e.target.value as any)} sx={{fontSize:'0.8rem',borderRadius:'8px',bgcolor:'white'}}>
                <MenuItem value="all" sx={{fontSize:'0.8rem'}}>All</MenuItem>
                {QUARTERS.map(qv=><MenuItem key={qv} value={qv} sx={{fontSize:'0.8rem'}}>{qv}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>

          {filtered.length===0
            ?<EmptyState icon={<SlideshowIcon sx={{fontSize:36}}/>} text={`No PPTs for ${fy}${q!=='all'?' · '+q:''}`}/>
            :filtered.map(p=>{
              const sysName=`${slugify(dept)}_review_ppt_${p.fy.toLowerCase().replace('-','_')}_${p.quarter.toLowerCase()}`;
              return(
                <Box key={p.id} sx={{display:'flex',alignItems:'center',gap:1.5,p:1.2,bgcolor:'white',borderRadius:'10px',border:`1px solid ${c}20`}}>
                  <Box sx={{width:34,height:34,borderRadius:'8px',bgcolor:`${c}12`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><SlideshowIcon sx={{color:c,fontSize:17}}/></Box>
                  <Box flex={1} minWidth={0}>
                    <Typography fontSize="0.85rem" fontWeight={600} color="#1F2937" noWrap>{p.name||sysName}</Typography>
                    <Typography fontSize="0.72rem" color="#9CA3AF">{p.fy} · {p.quarter}</Typography>
                  </Box>
                  <Tooltip title="Open"><IconButton size="small" href={p.url} target="_blank" sx={{color:c,bgcolor:`${c}12`,borderRadius:'7px',width:30,height:30}}><OpenInNewIcon sx={{fontSize:15}}/></IconButton></Tooltip>
                  <Tooltip title="Download"><IconButton size="small" component="a" href={p.url} download={sysName} sx={{color:'#6B7280',bgcolor:'#F3F4F6',borderRadius:'7px',width:30,height:30}}><DownloadIcon sx={{fontSize:15}}/></IconButton></Tooltip>
                  {isHR&&<Tooltip title="Delete"><IconButton size="small" onClick={()=>delReview(p.id)} sx={{color:'#EF4444',bgcolor:'#FEF2F2',borderRadius:'7px',width:28,height:28}}><DeleteIcon sx={{fontSize:13}}/></IconButton></Tooltip>}
                </Box>
              );
            })
          }
          {isHR&&<Button size="small" startIcon={<AddIcon sx={{fontSize:14}}/>} onClick={()=>setDlg(true)} sx={{textTransform:'none',color:c,bgcolor:`${c}10`,border:`1px dashed ${c}40`,borderRadius:'8px',px:2,py:0.8,alignSelf:'flex-start'}}>Add Review PPT</Button>}

          <Dialog open={addDlg} onClose={()=>setDlg(false)} maxWidth="xs" fullWidth PaperProps={{sx:{borderRadius:'16px'}}}>
            <DialogTitle sx={{fontWeight:700,fontSize:'0.95rem'}}>Add Review PPT — {dept}</DialogTitle>
            <DialogContent>
              <Stack spacing={2} mt={0.5}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Financial Year</InputLabel>
                  <Select value={newP.fy} label="Financial Year" onChange={e=>setNewP(p=>({...p,fy:e.target.value}))} sx={{borderRadius:'10px'}}>
                    {getFYList().map(f=><MenuItem key={f} value={f}>{f}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                  <InputLabel>Quarter</InputLabel>
                  <Select value={newP.quarter} label="Quarter" onChange={e=>setNewP(p=>({...p,quarter:e.target.value as any}))} sx={{borderRadius:'10px'}}>
                    {QUARTERS.map(qv=><MenuItem key={qv} value={qv}>{qv}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField size="small" label="Google Drive URL" fullWidth value={newP.url} onChange={e=>setNewP(p=>({...p,url:e.target.value}))} sx={{'& .MuiOutlinedInput-root':{borderRadius:'10px'}}}/>
              </Stack>
            </DialogContent>
            <DialogActions sx={{px:3,pb:2.5}}>
              <Button onClick={()=>setDlg(false)} sx={{textTransform:'none',color:'#6B7280',borderRadius:'8px'}}>Cancel</Button>
              <Button variant="contained" onClick={addReview} disabled={saving||!newP.url} sx={{bgcolor:c,borderRadius:'8px',textTransform:'none',px:3}}>
                {saving?<CircularProgress size={14} color="inherit"/>:'Add'}
              </Button>
            </DialogActions>
          </Dialog>
        </Stack>
      )}

      {tab===2&&<Stack spacing={1.2}><LinkRow link={dd?.masterPPT||null} accentColor={c} sysName={mastSys}/><LinkEditor currentUrl={dd?.masterPPT?.url||''} sysName={mastSys} c={c} onSave={saveMast}/></Stack>}
    </Box>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Section 2 — JD & Role Docs  (read-only from Designation model)
// ══════════════════════════════════════════════════════════════════════════════
function JDRoleDocs({dept,c,designations}:{dept:string;c:string;designations:Designation[]}) {
  const [active,setActive] = useState<string|null>(null);
  const roles = designations.filter(d=>d.department===dept);

  return (
    <Box>
      {roles.length===0
        ?<EmptyState icon={<WorkIcon sx={{fontSize:36}}/>} text={`No designations found for ${dept}`}/>
        :<Stack spacing={0.8}>
          {roles.map(r=>{
            const jdSys   = `${slugify(dept)}_${slugify(r.designation)}_jd`;
            const roleSys = `${slugify(dept)}_${slugify(r.designation)}_role_doc`;
            const hasJD   = !!r.jd_link;
            const hasRole = !!(r.role_document_link||r.role_document);
            return(
              <Box key={r._id}>
                <Box onClick={()=>setActive(a=>a===r._id?null:r._id)}
                  sx={{display:'flex',alignItems:'center',gap:1.5,p:1.3,bgcolor:active===r._id?`${c}08`:'white',borderRadius:'10px',border:`1px solid ${active===r._id?c+'35':'#E5E7EB'}`,cursor:'pointer',transition:'all 0.15s','&:hover':{bgcolor:`${c}05`}}}>
                  <Box sx={{width:34,height:34,borderRadius:'8px',bgcolor:`${c}12`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Person sx={{fontSize:16,color:c}}/></Box>
                  <Box flex={1}>
                    <Typography fontSize="0.88rem" fontWeight={700} color="#1F2937">{r.designation}</Typography>
                    {r.remarks&&<Typography fontSize="0.72rem" color="#9CA3AF">{r.remarks}</Typography>}
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    {hasJD  &&<Chip label="JD"       size="small" sx={{fontSize:'0.65rem',height:18,bgcolor:`${c}12`,color:c,fontWeight:700}}/>}
                    {hasRole&&<Chip label="Role Doc" size="small" sx={{fontSize:'0.65rem',height:18,bgcolor:'#F3F4F6',color:'#6B7280',fontWeight:700}}/>}
                  </Stack>
                  <ExpandMoreIcon sx={{fontSize:18,color:'#9CA3AF',transform:active===r._id?'rotate(180deg)':'none',transition:'transform 0.2s'}}/>
                </Box>
                <Collapse in={active===r._id} timeout="auto">
                  <Box sx={{mx:1,mt:0.5,mb:0.5,p:2,bgcolor:'#F8FAFC',borderRadius:'10px',border:`1px solid ${c}15`}}>
                    <Typography fontSize="0.72rem" color="#94A3B8" fontWeight={700} textTransform="uppercase" letterSpacing={0.8} mb={1.5}>Documents</Typography>
                    <Stack spacing={1.5}>
                      {/* JD */}
                      <Box sx={{p:1.5,bgcolor:'white',borderRadius:'10px',border:`1px solid ${c}20`}}>
                        <Box sx={{display:'flex',alignItems:'center',gap:1,mb:1}}>
                          <JDIcon sx={{fontSize:16,color:c}}/>
                          <Typography fontSize="0.82rem" fontWeight={700} color="#1F2937">Job Description</Typography>
                          <CopyBadge text={jdSys}/>
                        </Box>
                        {hasJD?(
                          <Stack direction="row" spacing={1}>
                            <Button href={r.jd_link} target="_blank" startIcon={<OpenInNewIcon sx={{fontSize:14}}/>}
                              sx={{textTransform:'none',fontWeight:700,fontSize:'0.82rem',color:'white',bgcolor:c,borderRadius:'8px',px:2,py:0.7,'&:hover':{opacity:0.88}}}>Open</Button>
                            <Tooltip title="Download"><IconButton component="a" href={r.jd_link} download={jdSys} sx={{color:'#6B7280',bgcolor:'#F3F4F6',borderRadius:'7px',width:32,height:32}}><DownloadIcon sx={{fontSize:15}}/></IconButton></Tooltip>
                          </Stack>
                        ):<Typography fontSize="0.78rem" color="#9CA3AF" fontStyle="italic">No JD linked in designation record.</Typography>}
                      </Box>
                      {/* Role Doc */}
                      <Box sx={{p:1.5,bgcolor:'white',borderRadius:'10px',border:'1px solid #E5E7EB'}}>
                        <Box sx={{display:'flex',alignItems:'center',gap:1,mb:1}}>
                          <ArticleIcon sx={{fontSize:16,color:'#6B7280'}}/>
                          <Typography fontSize="0.82rem" fontWeight={700} color="#1F2937">Role Document</Typography>
                          <CopyBadge text={roleSys}/>
                        </Box>
                        {hasRole?(
                          <Stack direction="row" spacing={1}>
                            <Button href={r.role_document_link||r.role_document} target="_blank" startIcon={<OpenInNewIcon sx={{fontSize:14}}/>}
                              sx={{textTransform:'none',fontWeight:700,fontSize:'0.82rem',color:c,bgcolor:`${c}12`,border:`1px solid ${c}30`,borderRadius:'8px',px:2,py:0.7,'&:hover':{bgcolor:`${c}20`}}}>Open</Button>
                            <Tooltip title="Download"><IconButton component="a" href={r.role_document_link||r.role_document} download={roleSys} sx={{color:'#6B7280',bgcolor:'#F3F4F6',borderRadius:'7px',width:32,height:32}}><DownloadIcon sx={{fontSize:15}}/></IconButton></Tooltip>
                          </Stack>
                        ):<Typography fontSize="0.78rem" color="#9CA3AF" fontStyle="italic">No role document linked in designation record.</Typography>}
                      </Box>
                    </Stack>
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Stack>
      }
    </Box>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Section 3 — Notes
// ══════════════════════════════════════════════════════════════════════════════
function DeptNotes({dept,c,dd,onUpdate}:{dept:string;c:string;dd:DeptData|undefined;onUpdate:(n:string,d:Partial<DeptData>)=>void}) {
  const [expanded,setExpanded] = useState<string|null>(null);
  const [addDlg,setDlg]        = useState(false);
  const [title,setTitle]       = useState('');
  const [content,setContent]   = useState('');
  const [saving,setSaving]     = useState(false);

  const addNote = async()=>{
    if (!title.trim()||!content.trim()) return;
    setSaving(true);
    try {
      const r = await apiPost<DeptNote>(`/dept-orientation/${dd?.id}/notes`,{title:title.trim(),content:content.trim()});
      if (r.success&&r.data) onUpdate(dept,{notes:[...(dd?.notes||[]),r.data]});
      setDlg(false); setTitle(''); setContent('');
    } finally { setSaving(false); }
  };
  const delNote = async(id:string)=>{
    await apiDel(`/dept-orientation/${dd?.id}/notes/${id}`);
    onUpdate(dept,{notes:(dd?.notes||[]).filter(n=>n.id!==id)});
  };

  return(
    <Box>
      {isHR&&(
        <Box sx={{display:'flex',justifyContent:'flex-end',mb:2}}>
          <Button size="small" startIcon={<AddIcon sx={{fontSize:14}}/>} onClick={()=>setDlg(true)}
            sx={{textTransform:'none',color:c,bgcolor:`${c}10`,border:`1px dashed ${c}40`,borderRadius:'8px',px:1.5,py:0.5}}>Add Note</Button>
        </Box>
      )}
      {(!dd?.notes||dd.notes.length===0)
        ?<EmptyState icon={<NotesIcon sx={{fontSize:36}}/>} text="No notes yet"/>
        :<Stack spacing={0.8}>
          {dd.notes.map(note=>(
            <Box key={note.id} sx={{borderRadius:'10px',border:`1px solid ${expanded===note.id?c+'40':'#E5E7EB'}`,overflow:'hidden',bgcolor:'white'}}>
              <Box onClick={()=>setExpanded(e=>e===note.id?null:note.id)}
                sx={{display:'flex',alignItems:'center',gap:1.5,px:1.8,py:1.3,cursor:'pointer','&:hover':{bgcolor:'#F8FAFC'}}}>
                <NotesIcon sx={{fontSize:17,color:c,flexShrink:0}}/>
                <Typography fontSize="0.88rem" fontWeight={600} color="#1F2937" flex={1}>{note.title}</Typography>
                <Typography fontSize="0.72rem" color="#9CA3AF">{note.updatedAt}</Typography>
                {isHR&&<Tooltip title="Delete"><IconButton size="small" onClick={e=>{e.stopPropagation();delNote(note.id);}} sx={{color:'#EF4444',p:0.3}}><DeleteIcon sx={{fontSize:13}}/></IconButton></Tooltip>}
                <ExpandMoreIcon sx={{fontSize:18,color:'#9CA3AF',transform:expanded===note.id?'rotate(180deg)':'none',transition:'transform 0.2s'}}/>
              </Box>
              <Collapse in={expanded===note.id}>
                <Box sx={{px:2.5,py:2,bgcolor:'#FAFAFA',borderTop:`1px solid ${c}12`}}>
                  <Typography fontSize="0.84rem" color="#374151" sx={{whiteSpace:'pre-wrap',lineHeight:1.85}}>{note.content}</Typography>
                </Box>
              </Collapse>
            </Box>
          ))}
        </Stack>
      }
      <Dialog open={addDlg} onClose={()=>setDlg(false)} maxWidth="sm" fullWidth PaperProps={{sx:{borderRadius:'16px'}}}>
        <DialogTitle sx={{fontWeight:700,fontSize:'0.95rem'}}>Add Note — {dept}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={0.5}>
            <TextField size="small" label="Title" fullWidth value={title} onChange={e=>setTitle(e.target.value)} sx={{'& .MuiOutlinedInput-root':{borderRadius:'10px'}}}/>
            <TextField size="small" label="Content" fullWidth multiline minRows={3} value={content} onChange={e=>setContent(e.target.value)} sx={{'& .MuiOutlinedInput-root':{borderRadius:'10px'}}}/>
          </Stack>
        </DialogContent>
        <DialogActions sx={{px:3,pb:2.5}}>
          <Button onClick={()=>setDlg(false)} sx={{textTransform:'none',color:'#6B7280',borderRadius:'8px'}}>Cancel</Button>
          <Button variant="contained" onClick={addNote} disabled={saving||!title.trim()||!content.trim()} sx={{bgcolor:c,borderRadius:'8px',textTransform:'none',px:3}}>
            {saving?<CircularProgress size={14} color="inherit"/>:'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Section 4 — Tests
// ══════════════════════════════════════════════════════════════════════════════
function DeptTests({dept,c,dd,onUpdate}:{dept:string;c:string;dd:DeptData|undefined;onUpdate:(n:string,d:Partial<DeptData>)=>void}) {
  const recSys=`${slugify(dept)}_recruitment_test`;
  const onbSys=`${slugify(dept)}_onboarding_test`;
  const saveRec=async(name:string,url:string)=>{const r=await apiPut(`/dept-orientation/${dd?.id}/tests/recruitment`,{name,url});if(r.success)onUpdate(dept,{recruitmentTest:{id:'rec',name,url}});};
  const saveOnb=async(name:string,url:string)=>{const r=await apiPut(`/dept-orientation/${dd?.id}/tests/onboarding`,{name,url});if(r.success)onUpdate(dept,{onboardingTest:{id:'onb',name,url}});};
  return(
    <Stack spacing={1.5}>
      {[
        {label:'Recruitment Test',sub:`For candidates applying to ${dept}`,chip:'Candidates',link:dd?.recruitmentTest,sysName:recSys,ac:c,onSave:saveRec,icon:<AssignmentIcon sx={{fontSize:19,color:c}}/>},
        {label:'Dept. Onboarding Test',sub:`For new joiners in ${dept}`,chip:'New Joiners',link:dd?.onboardingTest,sysName:onbSys,ac:'#10B981',onSave:saveOnb,icon:<QuizIcon sx={{fontSize:19,color:'#10B981'}}/>},
      ].map(({label,sub,chip,link,sysName,ac,onSave,icon})=>(
        <Box key={label} sx={{p:2,borderRadius:'12px',bgcolor:'white',border:`1px solid ${ac}20`,boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
          <Box sx={{display:'flex',alignItems:'center',gap:1.2,mb:1.2}}>
            <Box sx={{width:36,height:36,borderRadius:'9px',bgcolor:`${ac}12`,display:'flex',alignItems:'center',justifyContent:'center'}}>{icon}</Box>
            <Box flex={1}>
              <Typography fontSize="0.9rem" fontWeight={700} color="#1F2937">{label}</Typography>
              <Typography fontSize="0.73rem" color="#9CA3AF">{sub}</Typography>
            </Box>
            <Chip label={chip} size="small" sx={{fontSize:'0.68rem',height:20,bgcolor:`${ac}12`,color:ac,fontWeight:700}}/>
          </Box>
          <LinkRow link={link||null} accentColor={ac} sysName={sysName}/>
          <Box mt={1.2}><LinkEditor currentUrl={link?.url||''} sysName={sysName} c={ac} onSave={onSave}/></Box>
        </Box>
      ))}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Department picker
// ══════════════════════════════════════════════════════════════════════════════
function DeptPicker({departments,value,onChange}:{departments:string[];value:string;onChange:(d:string)=>void}) {
  const [open,setOpen]=useState(false);
  const s=value?notionStyle(value):{bg:'#F1F5F9',color:'#64748B',border:'#E2E8F0'};
  return(
    <Box sx={{position:'relative'}}>
      <Box onClick={()=>setOpen(o=>!o)} sx={{display:'inline-flex',alignItems:'center',gap:1,px:1.4,py:0.55,bgcolor:s.bg,border:`1.5px solid ${s.border}`,borderRadius:'8px',cursor:'pointer',userSelect:'none','&:hover':{filter:'brightness(0.96)'}}}>
        <Box sx={{width:8,height:8,borderRadius:'50%',bgcolor:s.color}}/>
        <Typography sx={{fontSize:'0.85rem',fontWeight:700,color:s.color}}>{value||'Select Department'}</Typography>
        <ArrowDownIcon sx={{fontSize:16,color:s.color,opacity:0.7,transform:open?'rotate(180deg)':'none',transition:'transform 0.2s'}}/>
      </Box>
      <Collapse in={open} timeout={160}>
        <Box sx={{position:'absolute',top:'calc(100% + 6px)',left:0,zIndex:1200,minWidth:220,maxHeight:280,overflowY:'auto',bgcolor:'white',border:'1px solid #E2E8F0',borderRadius:'12px',boxShadow:'0 8px 32px rgba(0,0,0,0.12)',py:0.6}}>
          {departments.map(d=>{
            const ds=notionStyle(d);
            return(
              <Box key={d} onClick={()=>{onChange(d);setOpen(false);}}
                sx={{display:'flex',alignItems:'center',gap:1.2,px:1.5,py:0.9,cursor:'pointer',bgcolor:d===value?'#F8FAFC':'transparent','&:hover':{bgcolor:'#F8FAFC'}}}>
                <Box sx={{display:'inline-flex',alignItems:'center',gap:0.7,px:1,py:0.25,bgcolor:ds.bg,border:`1px solid ${ds.border}`,borderRadius:'6px'}}>
                  <Box sx={{width:7,height:7,borderRadius:'50%',bgcolor:ds.color}}/>
                  <Typography sx={{fontSize:'0.8rem',fontWeight:600,color:ds.color}}>{d}</Typography>
                </Box>
                {d===value&&<CheckIcon sx={{fontSize:14,color:'#64748B',ml:'auto'}}/>}
              </Box>
            );
          })}
        </Box>
      </Collapse>
      {open&&<Box onClick={()=>setOpen(false)} sx={{position:'fixed',inset:0,zIndex:1199}}/>}
    </Box>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Page root
// ══════════════════════════════════════════════════════════════════════════════
export default function DeptOrientationPage() {
  const [designations,setDesignations] = useState<Designation[]>([]);
  const [deptDataMap,setDeptDataMap]   = useState<Record<string,DeptData>>({});
  const [departments,setDepartments]   = useState<string[]>([]);
  const [activeDept,setActiveDept]     = useState('');
  const [loading,setLoading]           = useState(true);
  const [toast,setToast]               = useState<{open:boolean;msg:string;type:'success'|'error'}>({open:false,msg:'',type:'success'});

  const fetchData = useCallback(async()=>{
    setLoading(true);
    try{
      const [desRes,deptRes] = await Promise.all([
        apiGet<Designation[]>('/designations'),
        apiGet<DeptData[]>('/dept-orientation'),
      ]);
      // Build map from orientation model
      const map:Record<string,DeptData>={};
      if (deptRes.success&&Array.isArray(deptRes.data)){
        deptRes.data.forEach(d=>{
          const name=d?.name?.trim(); if(!name) return;
          map[name]={...d,id:(d as any).id||(d as any)._id?.toString()||''};
        });
      }
      // Seed departments that only exist in Designation model
      if (desRes.success&&Array.isArray(desRes.data)){
        setDesignations(desRes.data);
        desRes.data.forEach(des=>{
          const dn=des.department?.trim();
          if (dn&&!map[dn]) map[dn]={id:'',name:dn,onboardingPPT:null,reviewPPTs:[],masterPPT:null,notes:[],recruitmentTest:null,onboardingTest:null};
        });
      }
      const sorted=Object.keys(map).sort();
      setDeptDataMap(map); setDepartments(sorted);
    } catch(err){
      console.error(err);
      setToast({open:true,msg:'Failed to load data',type:'error'});
    } finally { setLoading(false); }
  },[]);

  useEffect(()=>{fetchData();},[fetchData]);

  const updateDeptData=(deptName:string,partial:Partial<DeptData>)=>{
    setDeptDataMap(prev=>({...prev,[deptName]:{...prev[deptName],...partial}}));
    setToast({open:true,msg:'Saved successfully',type:'success'});
  };

  const c  = activeDept?deptColor(activeDept):'#6366F1';
  const dd = deptDataMap[activeDept];

  return(
    <div className="min-h-screen" style={{background:'#F1F5F9'}}>
      <Sidebar/>
      <div className="lg:pl-64">
        <Navbar/>
        <main style={{padding:'24px',paddingTop:'88px'}}>

          {/* Banner */}
          <Box sx={{mb:3,p:3.5,borderRadius:'20px',background:'linear-gradient(135deg,#0F172A 0%,#1E3A5F 65%,#334155 100%)',color:'white',position:'relative',overflow:'hidden'}}>
            <Box sx={{position:'absolute',top:-40,right:-20,width:180,height:180,borderRadius:'50%',bgcolor:'rgba(255,255,255,0.04)'}}/>
            <Box sx={{display:'flex',alignItems:'center',gap:2,position:'relative',zIndex:1}}>
              <Box sx={{width:52,height:52,borderRadius:'14px',bgcolor:'rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center'}}><ApartmentIcon sx={{fontSize:28}}/></Box>
              <Box flex={1}>
                <Typography fontWeight={800} fontSize="1.5rem" lineHeight={1.2}>Department Orientation</Typography>
                <Typography fontSize="0.85rem" sx={{opacity:0.6,mt:0.3}}>PPTs · JDs · Notes · Tests — organised by department</Typography>
              </Box>
              <Stack direction="row" spacing={1.5} alignItems="center">
                {loading&&<CircularProgress size={18} sx={{color:'rgba(255,255,255,0.6)'}}/>}
                <Chip label={`${departments.length} Departments`} size="small" sx={{bgcolor:'rgba(255,255,255,0.12)',color:'white',fontWeight:700,border:'1px solid rgba(255,255,255,0.2)',fontSize:'0.75rem'}}/>
                {isHR&&<Chip label="HR · Edit Mode" size="small" sx={{bgcolor:'rgba(134,239,172,0.15)',color:'#86EFAC',fontWeight:700,border:'1px solid rgba(134,239,172,0.3)',fontSize:'0.75rem'}}/>}
              </Stack>
            </Box>
          </Box>

          {loading
            ?<Box sx={{display:'flex',justifyContent:'center',pt:8}}><CircularProgress/></Box>
            :<Stack spacing={2}>
              {/* Dept selector */}
              <Box sx={{display:'flex',alignItems:'center',gap:2,px:2.5,py:1.8,bgcolor:'white',borderRadius:'14px',border:'1px solid #E5E7EB',boxShadow:'0 1px 4px rgba(0,0,0,0.05)'}}>
                <Typography fontSize="0.82rem" fontWeight={700} color="#6B7280" whiteSpace="nowrap">Department</Typography>
                <DeptPicker departments={departments} value={activeDept} onChange={setActiveDept}/>
              </Box>

              {!activeDept
                ?<Box sx={{py:6,textAlign:'center',color:'#9CA3AF'}}>
                  <ApartmentIcon sx={{fontSize:48,opacity:0.3,mb:1}}/>
                  <Typography fontSize="0.9rem">Select a department above to get started</Typography>
                </Box>
                :<>
                  <SectionCard num={1} label="Presentations"     icon={<SlideshowIcon sx={{fontSize:21}}/>}>
                    <DeptPresentations dept={activeDept} dd={dd} c={c} onUpdate={updateDeptData}/>
                  </SectionCard>
                  <SectionCard num={2} label="JD & Role Documents" icon={<WorkIcon sx={{fontSize:21}}/>}>
                    <JDRoleDocs dept={activeDept} c={c} designations={designations}/>
                  </SectionCard>
                  <SectionCard num={3} label="Department Notes"  icon={<NotesIcon sx={{fontSize:21}}/>}>
                    <DeptNotes dept={activeDept} c={c} dd={dd} onUpdate={updateDeptData}/>
                  </SectionCard>
                  <SectionCard num={4} label="Department Tests"  icon={<QuizIcon sx={{fontSize:21}}/>}>
                    <DeptTests dept={activeDept} c={c} dd={dd} onUpdate={updateDeptData}/>
                  </SectionCard>
                </>
              }
            </Stack>
          }
        </main>
      </div>

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={()=>setToast(t=>({...t,open:false}))} anchorOrigin={{vertical:'bottom',horizontal:'right'}}>
        <Alert severity={toast.type} onClose={()=>setToast(t=>({...t,open:false}))} sx={{borderRadius:'12px',boxShadow:'0 8px 24px rgba(0,0,0,0.12)'}}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </div>
  );
}