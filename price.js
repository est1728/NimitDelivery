/* ราคาเริ่มต้นของเมนู: เมนูที่มีหัวข้อย่อยแบบ "ราคา" หรือ "กิโล/ขีด" ราคาหลักมักเป็น 0
   คืนข้อความ เช่น "เริ่มต้น ฿45" (P = ฟังก์ชันคิดราคาลูกค้า) */
window.NimitStartPrice=function(m,P){
  var base=P(m.price||0,m.gp),add=0,variable=false;
  (m.optionGroups||[]).forEach(function(g){
    if(g.type==='price'){
      if(g.required||!(m.price>0)){ add+=P(g.priceMin||0,m.gp); variable=true; }
    }else if(g.type==='kg'){
      if(g.required||!(m.price>0)){ add+=P((g.kgRate||0),m.gp); variable=true; }
    }
  });
  var t=base+add;
  return (variable?'เริ่มต้น ':'')+'฿'+t;
};
