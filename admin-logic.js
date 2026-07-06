import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, query, where, onSnapshot, doc, getDocs, updateDoc, setDoc, addDoc, deleteDoc, getDoc, serverTimestamp, orderBy, limit }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:"AIzaSyCnBUk0ZKFcwMK0NyYkheux1xPt9bLYhr4",
  authDomain:"nimit-delivery.firebaseapp.com",
  projectId:"nimit-delivery",
  storageBucket:"nimit-delivery.firebasestorage.app",
  messagingSenderId:"233476256130",
  appId:"1:233476256130:web:62ba8f64ad0bf2f92c9f9b"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const statusLabel = { pending:"รอรับ", accepted:"รับแล้ว", picking:"ไปร้าน", arrived:"ถึงร้าน", delivering:"กำลังส่ง", done:"เสร็จสิ้น", rejected:"ยกเลิก" };
const actionLabel = { pending:"รับงาน", accepted:"เริ่มงาน", picking:"ถึงร้านแล้ว", arrived:"ขับรถไปหาลูกค้า", delivering:"ส่งสำเร็จ" };
const statusNext = { pending:"accepted", accepted:"picking", picking:"arrived", arrived:"delivering", delivering:"done" };
const statusPrev = { accepted:"pending", picking:"accepted", arrived:"picking", delivering:"arrived", done:"delivering" };
const pillClass = { pending:"pill-pending", accepted:"pill-accepted", picking:"pill-picking", arrived:"pill-arrived", delivering:"pill-delivering", done:"pill-done", rejected:"pill-rejected" };
const ACTIVE_STATUSES = ["pending","accepted","picking","arrived","delivering"];

let allOrders=[], todayDoneOrders=[], riders=[], shops=[];
let currentFilter="all";
let assignTargetDocId=null, selectedRiderId=null;
let editTargetDocId=null, recallTargetDocId=null;
let editingShopId=null, editingRiderId=null;
let currentDetailDocId=null, currentDetailOrder=null, detailUnsub=null;
let topupRiderId=null;
let dashCollapsed=false;

// ===== PAGE =====
window.switchPage = function(pageId) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const navMap={ordersPage:'nav-orders',historyPage:'nav-history',shopsPage:'nav-shops',ridersPage:'nav-riders',settingsPage:'nav-settings'};
  document.getElementById(navMap[pageId])?.classList.add('active');
  if(pageId==='shopsPage') loadShops();
  if(pageId==='ridersPage') loadRiders();
  if(pageId==='historyPage') loadHistory();
}

// ===== DASHBOARD =====
window.toggleDash = function() {
  dashCollapsed=!dashCollapsed;
  document.getElementById("dashStatsWrap").classList.toggle("collapsed",dashCollapsed);
  document.getElementById("dashToggleBtn").classList.toggle("collapsed",dashCollapsed);
}

// ===== ORDERS =====
function listenOrders() {
  onSnapshot(query(collection(db,"orders"),where("status","in",ACTIVE_STATUSES)), snap=>{
    allOrders=[];
    snap.forEach(d=>allOrders.push({docId:d.id,...d.data()}));
    allOrders.sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));
    updateStats(); renderOrders();
  });
  onSnapshot(query(collection(db,"orders"),where("status","==","done"),orderBy("createdAt","desc"),limit(200)), snap=>{
    todayDoneOrders=[];
    snap.forEach(d=>todayDoneOrders.push({docId:d.id,...d.data()}));
    updateStats();
  });
}

function updateStats() {
  const today=new Date().toDateString();
  const todayDone=todayDoneOrders.filter(o=>o.createdAt?.toDate?.().toDateString()===today);
  const pending=allOrders.filter(o=>o.status==="pending").length;
  document.getElementById("statPending").textContent=pending;
  document.getElementById("statActive").textContent=allOrders.filter(o=>["accepted","picking","arrived","delivering"].includes(o.status)).length;
  document.getElementById("statDone").textContent=todayDone.length;
  document.getElementById("statRevenue").textContent=todayDone.reduce((s,o)=>s+(o.grandTotal||0),0);
  const badge=document.getElementById("pendingBadge");
  badge.textContent=pending; badge.style.display=pending>0?"flex":"none";
}

window.filterOrders = function(f,el) {
  currentFilter=f;
  document.querySelectorAll('.filter-tab').forEach(t=>t.classList.remove('active'));
  el?.classList.add('active');
  renderOrders();
}

function renderOrders() {
  let orders=[...allOrders];
  if(currentFilter==='pending') orders=orders.filter(o=>o.status==='pending');
  else if(currentFilter==='active') orders=orders.filter(o=>['accepted','picking','arrived','delivering'].includes(o.status));
  const el=document.getElementById("ordersContainer");
  if(!orders.length){
    el.innerHTML=`<div class="empty-orders"><svg viewBox="0 0 24 24"><path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-2 .89-2 2v11c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z"/></svg><p>ไม่มีออเดอร์</p><span>ในหมวดหมู่นี้</span></div>`;
    return;
  }
  el.innerHTML=orders.map(o=>{
    const time=o.createdAt?.toDate?o.createdAt.toDate().toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'-';
    const qty=(o.items||[]).reduce((s,i)=>s+i.qty,0);
    return `<div class="order-card" onclick="openOrderDetail('${o.docId}')">
      <div class="order-card-head">
        <div class="order-head-left">
          <div class="order-id">${o.orderId}</div>
          <div class="status-pill ${pillClass[o.status]||''}">${statusLabel[o.status]||o.status}</div>
          ${o.riderName?`<div class="rider-chip"><svg viewBox="0 0 24 24"><path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/></svg>${o.riderName}</div>`:''}
        </div>
        <div class="order-amount">฿${o.grandTotal||0}</div>
      </div>
      <div class="order-card-body">
        <div class="order-info-row"><svg viewBox="0 0 24 24"><path d="M20 4H4v2l8 5 8-5V4zm0 4.236l-8 5-8-5V20h16V8.236z"/></svg><span>${o.shopName||'-'}</span></div>
        <div class="order-info-row"><svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg><span>${o.customer?.name||o.customer?.phone||'-'}</span><span style="font-size:11px;color:var(--subtext);margin-left:auto">${time}</span></div>
        <div class="order-info-row"><svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM17 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM7.17 14l.94-2h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 19.97 3H5.21l-.94-2H1v2h2l3.6 7.59L5.25 13c-.16.28-.25.61-.25.96C5 15.1 5.9 16 7 16h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12z"/></svg><span>${(o.items||[]).map(i=>i.name).join(', ').substring(0,35)}</span><span style="font-size:12px;color:var(--subtext);margin-left:auto">${qty} รายการ</span></div>
      </div>
    </div>`;
  }).join('');
}

// ===== ORDER DETAIL =====
window.openOrderDetail = function(docId) {
  currentDetailDocId=docId;
  document.getElementById("orderDetailPage").classList.add("show");
  if(detailUnsub) detailUnsub();
  detailUnsub=onSnapshot(doc(db,"orders",docId),snap=>{
    if(snap.exists()){ currentDetailOrder={docId,...snap.data()}; renderDetailPage(currentDetailOrder); }
  });
}
window.closeOrderDetail = function() {
  document.getElementById("orderDetailPage").classList.remove("show");
  closeAssignSheet();
  if(detailUnsub){ detailUnsub(); detailUnsub=null; }
  currentDetailDocId=null; currentDetailOrder=null;
}

function renderDetailPage(o) {
  const isDone=['done','rejected'].includes(o.status);
  const hasPrev=!!statusPrev[o.status];
  const time=o.createdAt?.toDate?o.createdAt.toDate().toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'-';
  const cus=o.customer||{};
  document.getElementById("od-title").textContent=o.orderId;
  document.getElementById("od-status-text").textContent=statusLabel[o.status]||o.status;
  document.getElementById("od-status-pill").className=`status-pill ${pillClass[o.status]||''}`;
  document.getElementById("od-status-pill").textContent=statusLabel[o.status]||o.status;
  document.getElementById("od-orderId").textContent=o.orderId;
  document.getElementById("od-qty").textContent=(o.items||[]).reduce((s,i)=>s+i.qty,0)+' รายการ';
  document.getElementById("od-pay").textContent=o.paymentMethod==='cash'?'เงินสด':'โอนเงิน';
  document.getElementById("od-delivery").textContent=`฿${o.deliveryFee||0}`;
  document.getElementById("od-time").textContent=time;
  if(o.riderName){ document.getElementById("od-rider-row").style.display='flex'; document.getElementById("od-rider").textContent=`${o.riderName}${o.riderPhone?' · '+o.riderPhone:''}`; }
  else { document.getElementById("od-rider-row").style.display='none'; }
  if(o.adminNote){ document.getElementById("od-note-row").style.display='flex'; document.getElementById("od-note").textContent=o.adminNote; }
  else { document.getElementById("od-note-row").style.display='none'; }
  document.getElementById("od-shopName").textContent=o.shopName||'-';
  document.getElementById("od-shopPhone").textContent=o.shopPhone||'-';
  document.getElementById("od-shopAddr").textContent=o.shopAddress||'-';
  document.getElementById("od-callShop").onclick=()=>{ if(o.shopPhone) window.location.href=`tel:${o.shopPhone}`; };
  document.getElementById("od-navShop").onclick=()=>{ if(o.shopLat) window.open(`https://www.google.com/maps/dir/?api=1&destination=${o.shopLat},${o.shopLng}`); };
  document.getElementById("od-cusName").textContent=cus.name||'-';
  document.getElementById("od-cusPhone").textContent=cus.phone||'-';
  document.getElementById("od-cusAddr").textContent=cus.address||'-';
  document.getElementById("od-callCus").onclick=()=>{ if(cus.phone) window.location.href=`tel:${cus.phone}`; };
  document.getElementById("od-navCus").onclick=()=>{ if(cus.lat) window.open(`https://www.google.com/maps/dir/?api=1&destination=${cus.lat},${cus.lng}`); };
  document.getElementById("od-items").innerHTML=(o.items||[]).map(i=>`<div class="ditem-row"><div><div>${i.name}</div>${i.options?.length?`<div class="ditem-opt">${i.options.map(op=>op.name).join(', ')}</div>`:''}</div><div>x${i.qty}</div><div>฿${i.price*i.qty}</div></div>`).join('');
  document.getElementById("od-total").textContent=`฿${o.subtotal||0}`;
  document.getElementById("od-grand").textContent=`฿${o.grandTotal||0}`;
  document.getElementById("od-base").textContent=`฿${o.baseCost||0}`;
  document.getElementById("od-walletCut").textContent=`฿${o.walletCut||0}`;
  document.getElementById("od-riderEarn").textContent=`฿${o.riderEarn||0}`;
  document.getElementById("od-diff").textContent=`฿${o.totalDiff||0}`;
  const prevBtn=document.getElementById("barPrevBtn");
  const statusBtn=document.getElementById("barStatusBtn");
  prevBtn.style.opacity=hasPrev&&!isDone?'1':'0.3';
  prevBtn.style.pointerEvents=hasPrev&&!isDone?'auto':'none';
  if(isDone){ statusBtn.textContent='เสร็จสิ้นแล้ว'; statusBtn.disabled=true; statusBtn.className='bar-btn-status green'; }
  else { statusBtn.textContent=actionLabel[o.status]||'-'; statusBtn.disabled=false; statusBtn.className=`bar-btn-status${o.status==='delivering'?' green':''}`; }
}

window.nextStatusDetail = async function() {
  if(!currentDetailDocId||!currentDetailOrder) return;
  const next=statusNext[currentDetailOrder.status]; if(!next) return;
  await updateDoc(doc(db,"orders",currentDetailDocId),{status:next,updatedAt:serverTimestamp()});
  if(next==='done') showToast("ออเดอร์เสร็จสิ้น","success");
}
window.prevStatusDetail = async function() {
  if(!currentDetailDocId||!currentDetailOrder) return;
  const prev=statusPrev[currentDetailOrder.status]; if(!prev) return;
  if(!confirm(`ย้อนกลับเป็น "${statusLabel[prev]}"?`)) return;
  await updateDoc(doc(db,"orders",currentDetailDocId),{status:prev,updatedAt:serverTimestamp()});
}

// ===== ASSIGN SHEET =====
window.openAssignSheetFromDetail = async function() {
  if(!currentDetailOrder) return;
  assignTargetDocId=currentDetailDocId;
  document.getElementById("sheetOrderBadge").textContent=`ออเดอร์: ${currentDetailOrder.orderId} · ${currentDetailOrder.shopName||''}`;
  document.getElementById("sheetPrevBtn").style.display=statusPrev[currentDetailOrder.status]?'flex':'none';
  selectedRiderId=null;
  const snap=await getDocs(collection(db,"riders"));
  riders=[]; snap.forEach(d=>riders.push({id:d.id,...d.data()}));
  document.getElementById("sheetRiderList").innerHTML=riders.map(r=>`
    <div class="rider-option" id="ro-${r.id}" onclick="selectRider('${r.id}')">
      <div class="rider-option-avatar"><svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>
      <div><div class="rider-option-name">${r.name}</div><div class="rider-option-sub">${r.phone||''}${r.plate?' · '+r.plate:''}</div></div>
    </div>`).join('');
  document.getElementById("sheetOverlay").classList.add("show");
  document.getElementById("assignSheet").classList.add("show");
}
window.closeAssignSheet=function(){ document.getElementById("sheetOverlay").classList.remove("show"); document.getElementById("assignSheet").classList.remove("show"); selectedRiderId=null; }
window.selectRider=function(id){ selectedRiderId=id; document.querySelectorAll('.rider-option').forEach(el=>el.classList.remove('selected')); document.getElementById(`ro-${id}`)?.classList.add('selected'); }
window.confirmAssign=async function(){
  if(!selectedRiderId){ showToast("กรุณาเลือกไรเดอร์","error"); return; }
  const r=riders.find(x=>x.id===selectedRiderId);
  await updateDoc(doc(db,"orders",assignTargetDocId),{riderId:r.id,riderName:r.name,riderPhone:r.phone||'',status:"pending",updatedAt:serverTimestamp()});
  closeAssignSheet();
  showToast(`โยนงานให้ ${r.name} แล้ว รอกดรับงาน`,"success");
}
window.prevStatusFromSheet=async function(){
  if(!currentDetailDocId||!currentDetailOrder) return;
  const prev=statusPrev[currentDetailOrder.status]; if(!prev) return;
  if(!confirm(`ย้อนกลับเป็น "${statusLabel[prev]}"?`)) return;
  await updateDoc(doc(db,"orders",currentDetailDocId),{status:prev,updatedAt:serverTimestamp()});
  closeAssignSheet();
}

// ===== EDIT ORDER =====
window.openEditModal=function(docId,deliveryFee){
  editTargetDocId=docId;
  document.getElementById("edit-delivery").value=deliveryFee||0;
  document.getElementById("edit-note").value="";
  document.getElementById("editOrderModal").classList.add("show");
}
window.saveEditOrder=async function(){
  await updateDoc(doc(db,"orders",editTargetDocId),{deliveryFee:parseFloat(document.getElementById("edit-delivery").value)||0,adminNote:document.getElementById("edit-note").value,updatedAt:serverTimestamp()});
  closeModal("editOrderModal");
  showToast("บันทึกการแก้ไขสำเร็จ","success");
}

// ===== HISTORY =====
async function loadHistory() {
  const snap=await getDocs(query(collection(db,"orders"),orderBy("createdAt","desc"),limit(200)));
  const done=[]; snap.forEach(d=>{ const data=d.data(); if(["done","rejected"].includes(data.status)) done.push({docId:d.id,...data}); });
  const el=document.getElementById("historyContainer");
  if(!done.length){ el.innerHTML='<div class="loading-text">ยังไม่มีประวัติ</div>'; return; }
  el.innerHTML=done.map(o=>{
    const time=o.createdAt?.toDate?o.createdAt.toDate().toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'-';
    return `<div class="history-card">
      <div class="history-top"><span class="history-id">${o.orderId}</span><div style="display:flex;align-items:center;gap:6px"><span class="status-pill ${pillClass[o.status]||''}">${statusLabel[o.status]||o.status}</span></div></div>
      <div class="history-shop">${o.shopName||''} · ${time}</div>
      <div class="history-items-text">${(o.items||[]).map(i=>i.name).join(', ')}</div>
      <div class="history-bottom">
        <span class="history-total">฿${o.grandTotal||0}</span>
        ${o.status==="done"?`<button class="recall-btn" onclick="openRecallModal('${o.docId}','${o.orderId}','${(o.shopName||'').replace(/'/g,"\\'")}')">เรียกกลับ</button>`:''}
      </div>
      ${o.adminNote?`<div style="margin-top:10px;font-size:12px;color:var(--orange);background:var(--orange-light);border-radius:10px;padding:8px 12px">${o.adminNote}</div>`:''}</div>`;
  }).join('');
}

// ===== RECALL =====
window.openRecallModal=function(docId,orderId,shopName){
  recallTargetDocId=docId;
  document.getElementById("recallOrderInfo").textContent=`ออเดอร์: ${orderId} · ${shopName}`;
  document.getElementById("recall-note").value="";
  document.getElementById("recallModal").classList.add("show");
}
window.confirmRecall=async function(){
  const note=document.getElementById("recall-note").value.trim();
  if(!note){ showToast("กรุณาใส่หมายเหตุก่อนเรียกกลับ","error"); return; }
  await updateDoc(doc(db,"orders",recallTargetDocId),{status:"pending",riderId:null,riderName:null,riderPhone:null,adminNote:note,recalledAt:serverTimestamp(),updatedAt:serverTimestamp()});
  closeModal("recallModal");
  showToast("เรียกออเดอร์กลับสำเร็จ","success");
  switchPage("ordersPage");
}

// ===== SHOPS =====
async function loadShops(){
  const snap=await getDocs(collection(db,"shops"));
  shops=[]; snap.forEach(d=>shops.push({id:d.id,...d.data()}));
  const el=document.getElementById("shopsList");
  if(!shops.length){ el.innerHTML='<div class="loading-text">ยังไม่มีร้านค้า</div>'; return; }
  el.innerHTML=`<div class="section-card">${shops.map(s=>{
    const slug=s.slug||s.id;
    const link=`${window.location.origin}/shop-admin.html?id=${slug}`;
    return `<div class="list-row">
      <div class="list-row-top">
        <div class="list-avatar"><svg viewBox="0 0 24 24"><path d="M20 4H4v2l8 5 8-5V4zm0 4.236l-8 5-8-5V20h16V8.236z"/></svg></div>
        <div class="list-info"><div class="list-name">${s.name}</div><div class="list-sub">/${slug}${s.phone?' · '+s.phone:''}</div></div>
        <span class="open-badge ${s.isOpen?'open-yes':'open-no'}">${s.isOpen?'เปิด':'ปิด'}</span>
        <div class="list-actions">
          <button class="icon-btn btn-view" onclick="window.open('shop-admin.html?id=${slug}','_blank')"><svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg></button>
          <button class="icon-btn btn-manage" onclick="window.location.href='shop-manage.html?id=${s.id}'"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
          <button class="icon-btn btn-del" onclick="deleteShop('${s.id}')"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
        </div>
      </div>
      <div class="link-row"><span class="link-text">${link}</span><button class="copy-link-btn" onclick="copyLink('${link}')"><svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>คัดลอก</button></div>
    </div>`;
  }).join('')}</div>`;
}
window.openAddShopModal=function(){ editingShopId=null; document.getElementById("addShopTitle").textContent="เพิ่มร้านค้า"; ['s-name','s-slug','s-desc','s-phone'].forEach(id=>document.getElementById(id).value=''); document.getElementById("addShopModal").classList.add("show"); }
window.saveShop=async function(){
  const name=document.getElementById("s-name").value.trim(); if(!name){ showToast("กรุณากรอกชื่อร้าน","error"); return; }
  const data={name,slug:document.getElementById("s-slug").value.trim(),desc:document.getElementById("s-desc").value.trim(),phone:document.getElementById("s-phone").value.trim(),isOpen:true,updatedAt:serverTimestamp()};
  if(editingShopId) await updateDoc(doc(db,"shops",editingShopId),data);
  else await addDoc(collection(db,"shops"),{...data,createdAt:serverTimestamp()});
  closeModal("addShopModal"); loadShops(); showToast("บันทึกร้านค้าสำเร็จ","success");
}
window.deleteShop=async function(id){ if(!confirm("ลบร้านนี้?")) return; await deleteDoc(doc(db,"shops",id)); loadShops(); }

// ===== RIDERS =====
async function loadRiders(){
  const snap=await getDocs(collection(db,"riders"));
  riders=[]; snap.forEach(d=>riders.push({id:d.id,...d.data()}));
  const el=document.getElementById("ridersList");
  if(!riders.length){ el.innerHTML='<div class="loading-text">ยังไม่มีไรเดอร์</div>'; return; }
  el.innerHTML=`<div class="section-card">${riders.map(r=>{
    const slug=r.slug||r.id;
    const link=`${window.location.origin}/rider.html?id=${slug}`;
    return `<div class="list-row">
      <div class="list-row-top">
        <div class="list-avatar"><svg viewBox="0 0 24 24"><path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/></svg></div>
        <div class="list-info"><div class="list-name">${r.name}</div><div class="list-sub">${r.phone||''}${r.plate?' · '+r.plate:''}${r.shift?' · '+r.shift:''}</div></div>
        <div style="text-align:right;margin-right:4px"><div style="font-size:13px;font-weight:800;color:var(--green)">฿${r.wallet||0}</div><div style="font-size:10px;color:var(--subtext)">กระเป๋า</div></div>
        <div class="list-actions">
          <button class="icon-btn btn-view" onclick="window.open('rider.html?id=${slug}','_blank')"><svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg></button>
          <button class="icon-btn" style="background:var(--green-light)" onclick="openTopupModal('${r.id}','${r.name}',${r.wallet||0})"><svg viewBox="0 0 24 24" style="fill:var(--green)"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9z"/></svg></button>
          <button class="icon-btn btn-manage" onclick="editRider('${r.id}')"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
          <button class="icon-btn btn-del" onclick="deleteRider('${r.id}')"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
        </div>
      </div>
      <div class="link-row"><span class="link-text">${link}</span><button class="copy-link-btn" onclick="copyLink('${link}')"><svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>คัดลอก</button></div>
    </div>`;
  }).join('')}</div>`;
}
window.openAddRiderModal=function(){ editingRiderId=null; document.getElementById("addRiderTitle").textContent="เพิ่มไรเดอร์"; ['r-name','r-phone','r-plate','r-slug','r-shift'].forEach(id=>document.getElementById(id).value=''); document.getElementById("addRiderModal").classList.add("show"); }
window.editRider=function(id){
  const r=riders.find(x=>x.id===id); if(!r) return;
  editingRiderId=id; document.getElementById("addRiderTitle").textContent="แก้ไขไรเดอร์";
  document.getElementById("r-name").value=r.name||''; document.getElementById("r-phone").value=r.phone||''; document.getElementById("r-plate").value=r.plate||''; document.getElementById("r-slug").value=r.slug||''; document.getElementById("r-shift").value=r.shift||'';
  document.getElementById("addRiderModal").classList.add("show");
}
window.saveRider=async function(){
  const name=document.getElementById("r-name").value.trim(); if(!name){ showToast("กรุณากรอกชื่อไรเดอร์","error"); return; }
  const data={name,phone:document.getElementById("r-phone").value.trim(),plate:document.getElementById("r-plate").value.trim(),slug:document.getElementById("r-slug").value.trim(),shift:document.getElementById("r-shift").value.trim(),updatedAt:serverTimestamp()};
  if(editingRiderId) await updateDoc(doc(db,"riders",editingRiderId),data);
  else await addDoc(collection(db,"riders"),{...data,wallet:0,createdAt:serverTimestamp()});
  closeModal("addRiderModal"); loadRiders(); showToast("บันทึกไรเดอร์สำเร็จ","success");
}
window.deleteRider=async function(id){ if(!confirm("ลบไรเดอร์?")) return; await deleteDoc(doc(db,"riders",id)); loadRiders(); }

// ===== WALLET =====
window.openTopupModal=function(id,name,wallet){
  topupRiderId=id;
  document.getElementById("topupRiderName").textContent=name;
  document.getElementById("topupCurrentBal").textContent=`ยอดปัจจุบัน: ฿${wallet}`;
  document.getElementById("topup-amount").value='';
  document.getElementById("topup-note").value='';
  document.getElementById("topupModal").classList.add("show");
}
window.confirmTopup=async function(){
  const amount=parseFloat(document.getElementById("topup-amount").value)||0;
  if(amount<=0){ showToast("กรุณากรอกจำนวนเงิน","error"); return; }
  const riderRef=doc(db,"riders",topupRiderId);
  const riderSnap=await getDoc(riderRef);
  const current=riderSnap.data()?.wallet||0;
  await updateDoc(riderRef,{wallet:current+amount,updatedAt:serverTimestamp()});
  closeModal("topupModal"); loadRiders(); showToast(`เติมเงิน ฿${amount} สำเร็จ`,"success");
}

// ===== PRICING =====
async function loadPricing(){
  try{
    const snap=await getDoc(doc(db,"settings","pricing"));
    if(snap.exists()){
      const d=snap.data();
      document.getElementById("gpPercent").value=d.gpPercent||34;
      document.getElementById("gpSubPercent").value=d.gpSubPercent||0;
      document.getElementById("walletPercent").value=d.walletPercent||30;
      document.getElementById("riderPercent").value=d.riderPercent||70;
      document.getElementById("freeDistance").value=d.freeDistance||1.5;
      document.getElementById("deliveryFee").value=d.deliveryFee||9;
    }
    updatePricingPreview();
  }catch(e){}
}
function updatePricingPreview(){
  const gp=parseFloat(document.getElementById("gpPercent")?.value)||34;
  const wp=parseFloat(document.getElementById("walletPercent")?.value)||30;
  const rp=parseFloat(document.getElementById("riderPercent")?.value)||70;
  const base=50; const display=Math.ceil(base*(1+gp/100));
  const diff=display-base; const wallet=Math.round(diff*wp/100); const rider=Math.round(diff*rp/100);
  document.getElementById("pricingPreview").innerHTML=`ตัวอย่าง: ร้าน ฿${base} → ลูกค้า ฿${display}<br>ส่วนต่าง ฿${diff} · กระเป๋า ฿${wallet} · ไรเดอร์ ฿${rider}`;
}
['gpPercent','gpSubPercent','walletPercent','riderPercent'].forEach(id=>document.getElementById(id)?.addEventListener('input',updatePricingPreview));
window.savePricing=async function(){
  const btn=event?.target; if(btn){btn.disabled=true;btn.textContent="กำลังบันทึก...";}
  try{
    await setDoc(doc(db,"settings","pricing"),{
      gpPercent:parseFloat(document.getElementById("gpPercent").value)||34,
      gpSubPercent:parseFloat(document.getElementById("gpSubPercent").value)||0,
      walletPercent:parseFloat(document.getElementById("walletPercent").value)||30,
      riderPercent:parseFloat(document.getElementById("riderPercent").value)||70,
      freeDistance:parseFloat(document.getElementById("freeDistance").value)||1.5,
      deliveryFee:parseFloat(document.getElementById("deliveryFee").value)||9,
      updatedAt:serverTimestamp()
    },{merge:true});
    showToast("บันทึกการตั้งค่าสำเร็จ","success");
  }catch(e){ showToast("เกิดข้อผิดพลาด ลองใหม่อีกครั้ง","error"); }
  if(btn){btn.disabled=false;btn.textContent="บันทึกการตั้งค่า";}
}

// ===== UTILS =====
window.closeModal=function(id){ document.getElementById(id).classList.remove("show"); }
window.copyLink=function(link){
  navigator.clipboard.writeText(link).then(()=>showToast("คัดลอกลิงก์แล้ว","success")).catch(()=>{
    const ta=document.createElement('textarea'); ta.value=link; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast("คัดลอกลิงก์แล้ว","success");
  });
}
window.showToast=function(message,type){
  type=type||"info";
  const icons={
    success:'<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>',
    error:'<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12z"/>',
    info:'<path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>'
  };
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  el.innerHTML=`<svg viewBox="0 0 24 24">${icons[type]||icons.info}</svg><span>${message}</span>`;
  document.getElementById("toastWrap").appendChild(el);
  setTimeout(()=>{ el.style.animation='toastOut 0.2s ease-in forwards'; setTimeout(()=>el.remove(),200); },2400);
}

listenOrders();
loadPricing();
