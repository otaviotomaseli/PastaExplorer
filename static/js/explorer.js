let currentPath = "";
let history = [];
let histIndex = -1;
let selected = new Set();
let clipboard = null; // {mode:'copy'|'cut', items:[]}
let viewMode = localStorage.getItem("viewMode") || "details";
let searchTimeout = null;

// tema claro/escuro
let theme = localStorage.getItem("theme") || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light");
function applyTheme(t){
  theme = t;
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("theme", t);
  const btn = document.getElementById("btnTheme");
  if(btn) btn.textContent = t==="dark" ? "☀️ Claro" : "🌙 Escuro";
  if(btn) btn.title = t==="dark" ? "Mudar para modo claro" : "Mudar para modo escuro";
}
applyTheme(theme);

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function toast(msg, type="") {
  const c = $("#toast");
  const el = document.createElement("div");
  el.className = "toast-msg " + type;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(()=>el.remove(), 3000);
}

function api(path, opts={}) {
  return fetch(path, opts).then(async r=>{
    const j = await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(j.error||r.statusText);
    return j;
  });
}

function formatIcon(item){
  if(item.is_dir) return "📁";
  const e = item.ext;
  if([".jpg",".jpeg",".png",".gif",".webp",".bmp",".svg"].includes(e)) return "🖼️";
  if([".mp4",".avi",".mkv",".mov",".wmv"].includes(e)) return "🎬";
  if([".mp3",".wav",".flac",".ogg",".m4a"].includes(e)) return "🎵";
  if([".pdf"].includes(e)) return "📄";
  if([".zip",".rar",".7z",".tar",".gz"].includes(e)) return "🗜️";
  if([".doc",".docx"].includes(e)) return "📝";
  if([".xls",".xlsx",".csv"].includes(e)) return "📊";
  if([".ppt",".pptx"].includes(e)) return "📈";
  if([".exe",".msi"].includes(e)) return "⚙️";
  if([".py",".js",".html",".css",".json",".txt",".md",".log",".xml",".yml",".yaml",".ini",".cfg",".bat",".sh"].includes(e)) return "📄";
  return "📄";
}
function typeLabel(item){
  if(item.is_dir) return "Pasta";
  const e = item.ext;
  if(!e) return "Arquivo";
  const map={".txt":"Texto",".pdf":"PDF",".jpg":"Imagem",".png":"Imagem",".zip":"Compactado",".mp4":"Vídeo",".mp3":"Áudio",".py":"Python",".js":"JavaScript",".html":"HTML",".css":"CSS",".json":"JSON",".exe":"Aplicativo"};
  return map[e]||e.replace(".","").toUpperCase();
}

// Breadcrumb
function renderBreadcrumb(path){
  const bc = $("#breadcrumb");
  bc.innerHTML="";
  // split by sep
  const isWin = path.includes(":\\") || path.includes(":/");
  let parts=[];
  if(isWin){
    // e.g. C:\Users\UNIP
    const m = path.match(/^([A-Za-z]:[\\/])/);
    let root = m?m[1]:"";
    parts.push({name: root.replace(/\\/g,"").replace("/","") || root, path: root});
    let rest = path.slice(root.length).split(/[\\/]/).filter(Boolean);
    let acc = root;
    for(let p of rest){
      acc = acc.replace(/\\$/,"") + "\\" + p;
      // normalize
      acc = acc.replace("\\\\","\\");
      parts.push({name:p, path: acc});
    }
  } else {
    if(path==="/") parts.push({name:"/", path:"/"});
    else {
      parts.push({name:"/", path:"/"});
      let segs = path.split("/").filter(Boolean);
      let acc="";
      for(let s of segs){
        acc += "/" + s;
        parts.push({name:s, path:acc});
      }
    }
  }
  parts.forEach((p,i)=>{
    const s = document.createElement("span");
    s.textContent=p.name;
    s.title=p.path;
    s.onclick=()=> navigate(p.path);
    bc.appendChild(s);
    if(i<parts.length-1){
      const sep=document.createElement("span");
      sep.className="crumb-sep";
      sep.textContent="›";
      bc.appendChild(sep);
    }
  });
}

// Tree
async function loadDrives(){
  const drives = await api("/api/drives");
  const tree = $("#tree");
  tree.innerHTML="";
  for(let d of drives){
    const node = createTreeNode(d.name, d.path, true, 0);
    tree.appendChild(node);
  }
  // auto expand first drive
  if(drives[0]) {
    navigate(drives[0].path);
    // expand it
    setTimeout(()=> expandNode(drives[0].path), 300);
  }
}
function createTreeNode(name, path, isDir, depth){
  const wrap=document.createElement("div");
  const row=document.createElement("div");
  row.className="tree-item";
  row.dataset.path=path;
  row.style.paddingLeft = (12 + depth*14) + "px";
  const exp=document.createElement("span");
  exp.className="expander";
  exp.textContent = isDir ? "▶" : "";
  const icon=document.createElement("span");
  icon.textContent = isDir ? "📁" : "📄";
  const label=document.createElement("span");
  label.textContent=name;
  label.style.overflow="hidden";
  label.style.textOverflow="ellipsis";
  row.append(exp, icon, label);
  const children=document.createElement("div");
  children.className="tree-children";
  children.dataset.parent=path;
  row.addEventListener("click", (e)=>{
    e.stopPropagation();
    selectTreeNode(path);
    navigate(path);
  });
  exp.addEventListener("click", async (e)=>{
    e.stopPropagation();
    toggleNode(path, row, children, depth);
  });
  wrap.append(row, children);
  return wrap;
}
function selectTreeNode(path){
  $$(".tree-item").forEach(el=>el.classList.toggle("active", el.dataset.path===path));
}
async function toggleNode(path, row, children, depth){
  const isOpen = children.classList.contains("open");
  if(isOpen){
    children.classList.remove("open");
    row.querySelector(".expander").textContent="▶";
  } else {
    await expandNode(path, children, depth, row);
  }
}
async function expandNode(path, childrenEl=null, depth=0, rowEl=null){
  try{
    const data = await api("/api/list?path="+encodeURIComponent(path));
    if(!childrenEl){
      // find by data-parent
      childrenEl = document.querySelector(`.tree-children[data-parent="${CSS.escape(path)}"]`);
      // fallback search
      if(!childrenEl) childrenEl = [...document.querySelectorAll(".tree-children")].find(c=>c.dataset.parent===path);
      rowEl = document.querySelector(`.tree-item[data-path="${CSS.escape(path)}"]`);
      if(!rowEl) rowEl = [...document.querySelectorAll(".tree-item")].find(r=>r.dataset.path===path);
      if(rowEl){
        const curDepth = parseInt(rowEl.style.paddingLeft)||12;
        depth = Math.floor((curDepth-12)/14);
      }
    }
    if(!childrenEl) return;
    childrenEl.innerHTML="";
    const dirs = data.items.filter(i=>i.is_dir);
    for(let d of dirs){
      const n = createTreeNode(d.name, d.path, true, depth+1);
      childrenEl.appendChild(n);
    }
    childrenEl.classList.add("open");
    if(rowEl) rowEl.querySelector(".expander").textContent="▼";
  }catch(e){
    toast(e.message,"error");
  }
}

// Navigation
async function navigate(path, pushHist=true){
  try{
    const data = await api("/api/list?path="+encodeURIComponent(path));
    currentPath = data.current;
    if(pushHist){
      // truncate forward history
      history = history.slice(0, histIndex+1);
      history.push(currentPath);
      histIndex = history.length-1;
      updateNavButtons();
    }
    renderBreadcrumb(currentPath);
    renderFiles(data.items);
    $("#statusText").textContent = `${data.count} itens`;
    selectTreeNode(currentPath);
    selected.clear();
    updateSelectionUI();
    // close preview if path changed? keep
  }catch(e){
    toast(e.message,"error");
    $("#statusText").textContent = "Erro: " + e.message;
  }
}
function updateNavButtons(){
  $("#btnBack").disabled = histIndex<=0;
  $("#btnForward").disabled = histIndex>=history.length-1;
  // up button
  const p = currentPath;
  const isRoot = (p.length===3 && p[1]===":") || p==="/" ;
  $("#btnUp").disabled = isRoot;
}

// render files
function renderFiles(items){
  const list = $("#fileList");
  list.innerHTML="";
  // empty state
  if(items.length===0){
    list.innerHTML=`<div style="padding:20px;color:#888;text-align:center">Pasta vazia</div>`;
    return;
  }
  for(let it of items){
    const row=document.createElement("div");
    row.className="file-item";
    row.dataset.path=it.path;
    row.dataset.isDir=it.is_dir;
    row.draggable=true;

    const icon=document.createElement("span");
    icon.className="icon";
    icon.textContent=formatIcon(it);

    const name=document.createElement("span");
    name.className="name";
    name.textContent=it.name;
    name.title=it.name;

    const mod=document.createElement("span");
    mod.className="col-modified";
    mod.textContent=it.mtime_human||"";

    const type=document.createElement("span");
    type.className="col-type";
    type.textContent=typeLabel(it);

    const size=document.createElement("span");
    size.className="col-size";
    size.textContent=it.is_dir?"":it.size_human;

    if(viewMode==="details"){
      row.append(icon, name, mod, type, size);
    } else if(viewMode==="grid"){
      row.append(icon, name);
    } else {
      // list
      row.append(icon, name);
    }

    // click
    row.addEventListener("click", (e)=>{
      if(e.ctrlKey || e.metaKey){
        if(selected.has(it.path)) selected.delete(it.path);
        else selected.add(it.path);
      } else if(e.shiftKey && selected.size>0){
        // range select
        const paths = items.map(x=>x.path);
        const first = [...selected][0];
        const a = paths.indexOf(first);
        const b = paths.indexOf(it.path);
        const [s,e2] = [Math.min(a,b), Math.max(a,b)];
        selected.clear();
        for(let i=s;i<=e2;i++) selected.add(paths[i]);
      } else {
        selected.clear();
        selected.add(it.path);
      }
      updateSelectionUI();
      if(!it.is_dir) showPreview(it);
      e.stopPropagation();
    });
    row.addEventListener("dblclick", ()=>{
      if(it.is_dir) navigate(it.path);
      else openFile(it);
    });
    // drag
    row.addEventListener("dragstart", (e)=>{
      if(!selected.has(it.path)){
        selected.clear();
        selected.add(it.path);
        updateSelectionUI();
      }
      e.dataTransfer.effectAllowed="move";
      e.dataTransfer.setData("text/plain", it.path);
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", ()=> row.classList.remove("dragging"));
    row.addEventListener("dragover", (e)=>{
      if(it.is_dir){
        e.preventDefault();
        row.classList.add("drop-target");
      }
    });
    row.addEventListener("dragleave", ()=> row.classList.remove("drop-target"));
    row.addEventListener("drop", async (e)=>{
      e.preventDefault();
      row.classList.remove("drop-target");
      const src = e.dataTransfer.getData("text/plain");
      if(!src || src===it.path) return;
      // if dragging multiple, move all selected
      const toMove = selected.has(src) ? [...selected] : [src];
      for(let s of toMove){
        try{
          await api("/api/move",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({src:s,dest:it.path})});
        }catch(err){ toast(err.message,"error")}
      }
      toast("Movido");
      refresh();
      // refresh tree
      expandNode(it.path);
    });
    // context menu
    row.addEventListener("contextmenu", (e)=>{
      e.preventDefault();
      if(!selected.has(it.path)){
        selected.clear();
        selected.add(it.path);
        updateSelectionUI();
      }
      showContext(e.clientX, e.clientY, it);
    });

    list.appendChild(row);
  }
  updateViewModeUI();
}
function updateSelectionUI(){
  $$(".file-item").forEach(el=>{
    el.classList.toggle("selected", selected.has(el.dataset.path));
  });
  const hasSel = selected.size>0;
  $("#btnDelete").disabled=!hasSel;
  $("#btnRename").disabled=selected.size!==1;
  $("#btnDownload").disabled=!hasSel;
  $("#btnCopy").disabled=!hasSel;
  $("#btnCut").disabled=!hasSel;
}
function updateViewModeUI(){
  const area=$("#fileArea");
  area.className="file-area " + viewMode;
}

// preview
async function showPreview(item){
  const pre=$("#preview");
  $("#previewTitle").textContent=item.name;
  pre.style.display="flex";
  const content=$("#previewContent");
  content.innerHTML="Carregando...";
  try{
    if(item.is_dir){
      const info=await api("/api/info?path="+encodeURIComponent(item.path));
      content.innerHTML=`<div><b>Tipo:</b> Pasta</div><div><b>Itens:</b> ${info.items_count||0}</div><div><b>Modificado:</b> ${info.mtime_human}</div><div><b>Caminho:</b><br><small style="word-break:break-all">${info.path}</small></div>`;
    } else if([".jpg",".jpeg",".png",".gif",".webp",".bmp",".svg"].includes(item.ext)){
      content.innerHTML=`<img src="/api/download?path=${encodeURIComponent(item.path)}" alt=""><div style="margin-top:8px;color:#555">${item.size_human} • ${item.mtime_human}</div>`;
    } else if([".txt",".md",".json",".js",".py",".html",".css",".xml",".log",".ini",".bat",".sh",".yml",".yaml"].includes(item.ext) && item.size < 500*1024){
      const r=await api("/api/read?path="+encodeURIComponent(item.path));
      content.innerHTML=`<pre>${escapeHtml(r.content.slice(0,5000))}</pre><button onclick="editFile('${item.path.replace(/'/g,"\\'")}')" style="margin-top:8px;padding:6px 10px;background:#0078d4;color:#fff;border:none;border-radius:4px;cursor:pointer">Editar</button>`;
    } else {
      const info=await api("/api/info?path="+encodeURIComponent(item.path));
      content.innerHTML=`<div><b>Tipo:</b> ${typeLabel(item)}</div><div><b>Tamanho:</b> ${info.size_human}</div><div><b>Modificado:</b> ${info.mtime_human}</div><div><b>Caminho:</b><br><small style="word-break:break-all">${info.path}</small></div><div style="margin-top:10px"><button onclick="downloadPath('${item.path.replace(/'/g,"\\'")}')" style="padding:6px 10px;background:#0078d4;color:#fff;border:none;border-radius:4px;cursor:pointer">Download</button></div>`;
    }
  }catch(e){
    content.innerHTML=`<div style="color:#d13438">${e.message}</div>`;
  }
}
function escapeHtml(s){
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function openFile(item){
  if(item.is_dir) navigate(item.path);
  else {
    // decide: if editable, open editor; else download/preview
    const editable = [".txt",".md",".json",".js",".py",".html",".css",".xml",".log",".ini",".bat",".sh",".yml",".yaml"].includes(item.ext);
    if(editable) editFile(item.path);
    else if([".jpg",".jpeg",".png",".gif",".webp"].includes(item.ext)) showPreview(item);
    else downloadPath(item.path);
  }
}
window.downloadPath = (p)=>{
  window.location.href="/api/download?path="+encodeURIComponent(p);
}
window.editFile = async (p)=>{
  try{
    const r=await api("/api/read?path="+encodeURIComponent(p));
    showModal("Editar: "+p.split(/[\\/]/).pop(), r.content, true, async (val)=>{
      await api("/api/write",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:p,content:val})});
      toast("Salvo","success");
      refresh();
    });
  }catch(e){ toast(e.message,"error")}
}

// modal
let modalCb=null;
let modalIsTextarea=false;
function showModal(title, def="", isTextarea=false, cb=null){
  $("#modalTitle").textContent=title;
  modalCb=cb;
  modalIsTextarea=isTextarea;
  if(isTextarea){
    $("#modalInput").style.display="none";
    $("#modalTextarea").style.display="block";
    $("#modalTextarea").value=def;
    $("#modalTextarea").focus();
  } else {
    $("#modalTextarea").style.display="none";
    $("#modalInput").style.display="block";
    $("#modalInput").value=def;
    $("#modalInput").focus();
    $("#modalInput").select();
  }
  $("#modal").style.display="flex";
}
function hideModal(){
  $("#modal").style.display="none";
  modalCb=null;
}
$("#modalCancel").onclick=hideModal;
$("#modalOk").onclick=()=>{
  const val = modalIsTextarea ? $("#modalTextarea").value : $("#modalInput").value;
  if(modalCb) modalCb(val);
  hideModal();
};
$("#modal").addEventListener("click",(e)=>{ if(e.target.id==="modal") hideModal() });

// context menu
let ctxTarget=null;
function showContext(x,y,item){
  ctxTarget=item;
  const m=$("#contextMenu");
  m.style.left=x+"px";
  m.style.top=y+"px";
  m.style.display="block";
  $("#contextMenuBg").style.display="block";
  // adjust if overflow
  setTimeout(()=>{
    const r=m.getBoundingClientRect();
    if(r.right>window.innerWidth) m.style.left=(window.innerWidth - r.width -10)+"px";
    if(r.bottom>window.innerHeight) m.style.top=(window.innerHeight - r.height -10)+"px";
  },0);
}
function hideContext(){
  $("#contextMenu").style.display="none";
  $("#contextMenuBg").style.display="none";
}
$("#contextMenuBg").onclick=hideContext;
$("#contextMenu").addEventListener("click",(e)=>{
  const act=e.target.dataset.action;
  if(!act) return;
  hideContext();
  handleAction(act, ctxTarget);
});
async function handleAction(act, item){
  const sel = selected.size?[...selected]: (item?[item.path]:[]);
  const single = sel[0];
  switch(act){
    case "open": if(item) openFile(item); break;
    case "download": sel.forEach(p=> downloadPath(p)); break;
    case "copy": clipboard={mode:"copy", items:[...sel]}; updateClipboardUI(); toast("Copiado"); break;
    case "cut": clipboard={mode:"cut", items:[...sel]}; updateClipboardUI(); toast("Recortado"); break;
    case "paste": doPaste(); break;
    case "rename":
      if(!single) return;
      showModal("Renomear", item.name, false, async (newName)=>{
        if(!newName||newName===item.name) return;
        try{ await api("/api/rename",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:single,newName})}); toast("Renomeado","success"); refresh(); }catch(e){toast(e.message,"error")}
      });
      break;
    case "delete":
      if(!sel.length) return;
      if(!confirm(`Excluir ${sel.length} item(ns)?`)) return;
      for(let p of sel){
        try{ await api("/api/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:p})}); }catch(e){toast(e.message,"error")}
      }
      toast("Excluído","success"); refresh(); break;
    case "properties":
      try{
        const info=await api("/api/info?path="+encodeURIComponent(single));
        showModal("Propriedades", `Nome: ${info.name}\nCaminho: ${info.path}\nTipo: ${info.is_dir?"Pasta":typeLabel(info)}\nTamanho: ${info.size_human||"-"}\nModificado: ${info.mtime_human}`, true, null);
        $("#modalOk").style.display="none";
        setTimeout(()=>$("#modalCancel").textContent="Fechar",0);
      }catch(e){toast(e.message,"error")}
      break;
  }
}
function updateClipboardUI(){
  if(clipboard){
    $("#clipboardInfo").textContent = `${clipboard.items.length} item(ns) ${clipboard.mode==="cut"?"recortado":"copiado"}`;
    $("#btnPaste").disabled=false;
  } else {
    $("#clipboardInfo").textContent="";
    $("#btnPaste").disabled=true;
  }
}
async function doPaste(){
  if(!clipboard) return;
  for(let src of clipboard.items){
    try{
      const endpoint = clipboard.mode==="cut"?"/api/move":"/api/copy";
      await api(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({src,dest:currentPath})});
    }catch(e){ toast(e.message,"error")}
  }
  if(clipboard.mode==="cut") clipboard=null;
  updateClipboardUI();
  toast(clipboard?"Copiado":"Movido","success");
  refresh();
}

// toolbar actions
$("#btnBack").onclick=()=>{
  if(histIndex>0){ histIndex--; updateNavButtons(); navigate(history[histIndex], false); }
};
$("#btnForward").onclick=()=>{
  if(histIndex<history.length-1){ histIndex++; updateNavButtons(); navigate(history[histIndex], false); }
};
$("#btnUp").onclick=()=>{
  api("/api/list?path="+encodeURIComponent(currentPath)).then(d=>{
    if(d.parent) navigate(d.parent);
  }).catch(()=>{});
  // fallback: parent via path
  const p = currentPath;
  if(p.length<=3 && p[1]===":") return;
  if(p==="/") return;
  const parent = p.replace(/[/\\][^/\\]+[/\\]?$/,"");
  let np = parent || (p.includes(":\\") ? p.slice(0,3) : "/");
  if(p.includes(":\\") && np.length===2) np+="\\";
  navigate(np);
};
$("#btnRefresh").onclick=refresh;
function refresh(){ navigate(currentPath,false); expandNode(currentPath); }

$("#btnNewFolder").onclick=()=>{
  showModal("Nova pasta","Nova pasta",false, async (name)=>{
    if(!name) return;
    try{ await api("/api/mkdir",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:currentPath,name})}); toast("Pasta criada","success"); refresh(); }catch(e){toast(e.message,"error")}
  });
};
$("#btnNewFile").onclick=()=>{
  showModal("Novo arquivo","Novo arquivo.txt",false, async (name)=>{
    if(!name) return;
    try{ await api("/api/mkfile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:currentPath,name})}); toast("Arquivo criado","success"); refresh(); }catch(e){toast(e.message,"error")}
  });
};
$("#btnDelete").onclick=()=> handleAction("delete", null);
$("#btnRename").onclick=()=>{
  const p=[...selected][0];
  if(!p) return;
  const name=p.split(/[\\/]/).pop();
  showModal("Renomear",name,false, async (newName)=>{
    try{ await api("/api/rename",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:p,newName})}); toast("Renomeado","success"); refresh(); }catch(e){toast(e.message,"error")}
  });
};
$("#btnDownload").onclick=()=>{ [...selected].forEach(p=> downloadPath(p)); };
$("#btnCopy").onclick=()=> handleAction("copy", null);
$("#btnCut").onclick=()=> handleAction("cut", null);
$("#btnPaste").onclick=doPaste;
$("#btnClosePreview").onclick=()=> $("#preview").style.display="none";
$("#viewMode").value=viewMode;
$("#viewMode").onchange=(e)=>{ viewMode=e.target.value; localStorage.setItem("viewMode",viewMode); updateViewModeUI(); };

$("#searchInput").addEventListener("keydown",(e)=>{
  if(e.key==="Enter") doSearch();
});
$("#btnSearch").onclick=doSearch;
async function doSearch(){
  const q=$("#searchInput").value.trim();
  if(!q) return refresh();
  $("#statusText").textContent="Pesquisando...";
  try{
    const r=await api("/api/search?path="+encodeURIComponent(currentPath)+"&q="+encodeURIComponent(q));
    renderFiles(r.results);
    $("#statusText").textContent=`${r.count} resultados para "${q}"` + (r.truncated?" (limite 100)":"");
  }catch(e){toast(e.message,"error")}
}

// upload
$("#fileUpload").addEventListener("change", async (e)=>{
  const files=e.target.files;
  if(!files.length) return;
  const fd=new FormData();
  fd.append("path", currentPath);
  for(let f of files) fd.append("files", f);
  try{
    const res=await fetch("/api/upload",{method:"POST",body:fd});
    const j=await res.json();
    if(!res.ok) throw new Error(j.error);
    toast(`${j.saved.length} arquivo(s) enviado(s)`,"success");
    refresh();
  }catch(err){ toast(err.message,"error")}
  e.target.value="";
});

// drag over content area for upload / drop
const fileArea=$("#fileArea");
fileArea.addEventListener("dragover",(e)=>{ e.preventDefault(); e.dataTransfer.dropEffect="copy"; });
fileArea.addEventListener("drop", async (e)=>{
  e.preventDefault();
  // check if files from OS
  if(e.dataTransfer.files && e.dataTransfer.files.length){
    const fd=new FormData();
    fd.append("path", currentPath);
    for(let f of e.dataTransfer.files) fd.append("files", f);
    try{
      const res=await fetch("/api/upload",{method:"POST",body:fd});
      const j=await res.json();
      if(!res.ok) throw new Error(j.error);
      toast("Upload concluído","success");
      refresh();
    }catch(err){ toast(err.message,"error")}
    return;
  }
  // else internal move already handled
});
document.addEventListener("click",(e)=>{
  if(!e.target.closest(".file-item") && !e.target.closest("#contextMenu")) {
    // click on empty area
    if(e.target.closest("#fileArea")) {
      selected.clear();
      updateSelectionUI();
    }
  }
});
document.addEventListener("keydown",(e)=>{
  if(e.key==="Delete" && selected.size){ handleAction("delete",null); }
  if(e.key==="F2" && selected.size===1){ $("#btnRename").click(); }
  if((e.ctrlKey||e.metaKey) && e.key==="c"){ if(selected.size) handleAction("copy",null); }
  if((e.ctrlKey||e.metaKey) && e.key==="x"){ if(selected.size) handleAction("cut",null); }
  if((e.ctrlKey||e.metaKey) && e.key==="v"){ doPaste(); }
});

// resizer
let isResizing=false;
$("#resizer").addEventListener("mousedown",()=> isResizing=true);
document.addEventListener("mousemove",(e)=>{
  if(!isResizing) return;
  const w = e.clientX;
  if(w>150 && w<500) $("#sidebar").style.width=w+"px";
});
document.addEventListener("mouseup",()=> isResizing=false);
// click outside to hide context handled already

// tema toggle
document.getElementById("btnTheme")?.addEventListener("click", ()=>{
  applyTheme(theme==="dark" ? "light" : "dark");
});
// atalho T para tema
document.addEventListener("keydown", (e)=>{
  if(e.key.toLowerCase()==="t" && (e.ctrlKey||e.metaKey) && e.shiftKey){
    e.preventDefault();
    document.getElementById("btnTheme")?.click();
  }
});

// -------- configurações --------
const settingsModal = document.getElementById("settingsModal");
function openSettings(){
  settingsModal.style.display="flex";
  loadSettings();
}
function closeSettings(){ settingsModal.style.display="none"; clearSettingsMsgs(); }
document.getElementById("btnSettings")?.addEventListener("click", openSettings);
document.getElementById("btnCloseSettings")?.addEventListener("click", closeSettings);
settingsModal?.addEventListener("click", (e)=>{ if(e.target===settingsModal) closeSettings(); });

// tabs
document.querySelectorAll(".tab").forEach(t=>{
  t.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".tabpane").forEach(x=>x.classList.remove("active"));
    t.classList.add("active");
    document.getElementById("tab-"+t.dataset.tab)?.classList.add("active");
  });
});
function clearSettingsMsgs(){
  ["passMsg","tfaMsg","tfaDisableMsg","tfaInactiveMsg"].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.textContent="";
  });
}
function showMsg(id, txt, isError){
  const el=document.getElementById(id);
  if(!el) return;
  el.textContent=txt;
  el.className="msg " + (isError?"error":"success");
}
async function loadSettings(){
  try{
    const s = await api("/api/settings");
    const st = document.getElementById("tfaStatus");
    if(s.totp_enabled){
      st.innerHTML=`Usuário: <b>${s.username}</b> • 2FA: <b style="color:#107c10">Ativo ✅</b>`;
      document.getElementById("tfaInactiveArea").style.display="none";
      document.getElementById("tfaSetupArea").style.display="none";
      document.getElementById("tfaEnabledArea").style.display="block";
    } else {
      st.innerHTML=`Usuário: <b>${s.username}</b> • 2FA: <b style="color:#d13438">Desativado ❌</b>`;
      document.getElementById("tfaEnabledArea").style.display="none";
      document.getElementById("tfaSetupArea").style.display="none";
      document.getElementById("tfaInactiveArea").style.display="block";
    }
  }catch(e){ toast(e.message,"error"); }
}
// trocar senha
document.getElementById("btnChangePass")?.addEventListener("click", async ()=>{
  const oldPass = document.getElementById("oldPass").value;
  const newPass = document.getElementById("newPass").value;
  const confirmPass = document.getElementById("confirmPass").value;
  if(!oldPass || !newPass){ showMsg("passMsg","Preencha todos os campos",true); return; }
  if(newPass!==confirmPass){ showMsg("passMsg","Confirmação não confere",true); return; }
  try{
    await api("/api/settings/password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({oldPassword:oldPass,newPassword:newPass,confirmPassword:confirmPass})});
    showMsg("passMsg","Senha alterada com sucesso!",false);
    toast("Senha alterada","success");
    document.getElementById("oldPass").value="";
    document.getElementById("newPass").value="";
    document.getElementById("confirmPass").value="";
  }catch(e){ showMsg("passMsg",e.message,true); }
});
// 2fa setup
let pendingSecret=null;
document.getElementById("btnSetup2fa")?.addEventListener("click", async ()=>{
  try{
    const r = await api("/api/settings/2fa/setup",{method:"POST"});
    pendingSecret=r.secret;
    document.getElementById("tfaSecret").value=r.secret;
    const qrImg=document.getElementById("qrImg");
    const placeholder=document.getElementById("qrPlaceholder");
    if(r.qr_base64){
      qrImg.src=r.qr_base64;
      qrImg.style.display="inline-block";
      placeholder.style.display="none";
    } else {
      // fallback: usa API externa para QR
      qrImg.src=`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(r.otpauth_url)}`;
      qrImg.style.display="inline-block";
      placeholder.style.display="none";
    }
    document.getElementById("tfaInactiveArea").style.display="none";
    document.getElementById("tfaSetupArea").style.display="block";
    showMsg("tfaMsg","Escaneie e digite o código de 6 dígitos",false);
  }catch(e){ showMsg("tfaInactiveMsg",e.message,true); }
});
document.getElementById("btnCopySecret")?.addEventListener("click", ()=>{
  const v=document.getElementById("tfaSecret").value;
  navigator.clipboard.writeText(v).then(()=> toast("Secret copiado","success"));
});
document.getElementById("btnEnable2fa")?.addEventListener("click", async ()=>{
  const code=document.getElementById("tfaCodeEnable").value.trim();
  if(code.length!==6){ showMsg("tfaMsg","Código deve ter 6 dígitos",true); return; }
  try{
    await api("/api/settings/2fa/enable",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code, secret:pendingSecret})});
    showMsg("tfaMsg","2FA ativado com sucesso!",false);
    toast("2FA ativado","success");
    loadSettings();
    document.getElementById("tfaCodeEnable").value="";
  }catch(e){ showMsg("tfaMsg",e.message,true); }
});
document.getElementById("btnDisable2fa")?.addEventListener("click", async ()=>{
  const pwd=document.getElementById("disablePass").value;
  const code=document.getElementById("disableCode").value.trim();
  if(!pwd){ showMsg("tfaDisableMsg","Informe a senha",true); return; }
  try{
    await api("/api/settings/2fa/disable",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:pwd, code})});
    showMsg("tfaDisableMsg","2FA desativado",false);
    toast("2FA desativado","success");
    loadSettings();
    document.getElementById("disablePass").value="";
    document.getElementById("disableCode").value="";
  }catch(e){ showMsg("tfaDisableMsg",e.message,true); }
});

// init
loadDrives();
updateViewModeUI();
