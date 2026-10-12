"use strict";(()=>{var V='[id^="result_card_"]',B={january:"01",february:"02",march:"03",april:"04",may:"05",june:"06",july:"07",august:"08",september:"09",october:"10",november:"11",december:"12"},M=class{id="dom";parse(e,n){let t=n.now.toISOString();if(!/findseats\.pearsonvue\.com$/i.test(new URL(n.pageUrl).hostname))return c("unsupported",t,"Open the official Pearson VUE appointment page.");let i=d(e.body?.textContent??"");if(e.querySelector('iframe[src*="captcha" i], .g-recaptcha, [id*="captcha" i], [class*="captcha" i]')||/verify (that )?you are human|security check|complete the verification|captcha/i.test(i))return c("verification_required",t,"Pearson requires manual verification. Automatic refresh has been paused.");if(/too many requests|rate limit|error\s*429|request limit exceeded/i.test(i))return c("rate_limited",t,"Pearson reported a request limit. Automatic refresh has been paused.");if(X(e))return c("loading",t,"Pearson VUE is processing the page. Existing results were not replaced.");let o=d(e.body?.textContent??""),y=d(e.querySelector("#tagAlongAriaId")?.textContent??e.querySelector("#TagAlongLink")?.textContent??""),b=Array.from(e.querySelectorAll(V)),f=!!(e.querySelector("#searchResultsLabelHeader, #search-results-label-header")||/Search has returned available test centres/i.test(o));if(!b.length&&!f)return e.querySelector("#testCentersNearAddress")?c("waiting_for_search",t,"Enter Sydney on the official page and run the search manually."):c("parse_error",t,"The expected Pearson VUE search controls were not found.",{error:"Unsupported or changed Pearson VUE page structure"});if(y&&!/PTE-A\s*:\s*PTE Academic|PTE Academic/i.test(y))return c("unsupported",t,"The open page is not a PTE Academic search.");if(!b.length)return/no (test centres|appointments|results).*(available|found)|0 results/i.test(o)?c("success",t,"The official page returned no centers."):c("parse_error",t,"Search results were announced but no result cards could be parsed.",{error:"Result card structure changed"});let w=[],u=0,S=[];for(let a of b){let l=a.id.match(/result_card_(\d+)/)?.[1];if(!l){S.push(`Unrecognized card id: ${a.id||"(missing)"}`);continue}let s=d(a.querySelector(`#test-center-info-link_${l}`)?.textContent??a.querySelector('[id^="tc_name_"]')?.textContent??""),m=a.querySelector('[id^="tc_address_"]'),g=d(m?.textContent??""),E=m?.id.match(/tc_address_(\d+)/)?.[1]??a.querySelector('[id^="tc_distance_"]')?.id.match(/tc_distance_(\d+)/)?.[1]??"";if(!s||!E){S.push(`Card ${l} is missing its center name or center id.`);continue}u+=1;let T=d(a.querySelector('[id^="tc_distance_"]')?.textContent??"").match(/(\d+(?:\.\d+)?)/),_=T?Number(T[1]):void 0,v=a.querySelector(`#preferredDateShown_${l}, input[id^="preferredDateShown_"]`),h=j(v?.value??v?.getAttribute("value")??""),z=a.querySelector(`#appt_menu_${l}, select[id^="appt_menu_"]`);if(!(!h||!z))for(let D of Array.from(z.options)){let F=d(D.textContent??D.label??""),C=K(F);C&&w.push({id:`${E}|${h}|${C}`,testCenterId:E,testCenterName:s,city:"Sydney",examType:"PTE Academic",date:h,time:C,displayTime:F,timezone:"Australia/Sydney",bookingUrl:n.pageUrl,detectedAt:t,address:g,distanceMiles:_})}}return!u||S.length===b.length?c("parse_error",t,"Pearson VUE results were present but could not be parsed safely.",{centerCount:u,error:S.join(" ")||"No valid result cards"}):c("success",t,`Parsed ${u} center${u===1?"":"s"} from the current page.`,{slots:J(w),centerCount:u})}};function c(r,e,n,t={}){return{provider:"dom",status:r,checkedAt:e,slots:[],centerCount:0,message:n,...t}}function X(r){return Array.from(r.querySelectorAll('#progressDialog, [aria-busy="true"], .processing-request')).some(n=>{if(!Y(n,r))return!1;let t=d(n.textContent??"");return n.getAttribute("aria-busy")==="true"||/processing request|please wait|loading/i.test(t)})}function Y(r,e){let n=e.defaultView,t=r;for(;t&&t!==e.body;){if(t.hidden||t.getAttribute("aria-hidden")==="true")return!1;let i=t.getAttribute("style")??"";if(/display\s*:\s*none|visibility\s*:\s*(hidden|collapse)/i.test(i))return!1;if(n){let o=n.getComputedStyle(t);if(o.display==="none"||o.visibility==="hidden"||o.visibility==="collapse"||o.opacity==="0")return!1}t=t.parentElement}return!0}function j(r){let e=d(r);if(!e||/select a date/i.test(e))return null;let n=e.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(n)return`${n[3]}-${A(n[1])}-${A(n[2])}`;let t=e.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);if(!t)return null;let i=B[t[2].toLowerCase()];return i?`${t[3]}-${i}-${A(t[1])}`:null}function K(r){let e=d(r),n=e.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);if(n){let i=Number(n[1]),o=n[2],y=n[3].toUpperCase();return i===12&&(i=0),y==="PM"&&(i+=12),`${A(String(i))}:${o}`}let t=e.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);return t?`${A(t[1])}:${t[2]}`:null}function d(r){return r.replace(/\s+/g," ").trim()}function A(r){return r.padStart(2,"0")}function J(r){return Array.from(new Map(r.map(e=>[e.id,e])).values())}var P={uiLanguage:"en",examType:"PTE Academic",city:"Sydney",dateFrom:"2026-10-11",dateTo:"2026-10-13",timezone:"Australia/Sydney",notificationsEnabled:!0,soundEnabled:!0,autoRefreshEnabled:!0,refreshIntervalMinutes:10,maxDistanceMiles:50};var N={visible:!0,minimized:!1},p={config:"monitorConfig",state:"monitorState",floatingWindow:"floatingWindowState",notificationTargets:"notificationTargets"};var W="pte-slot-monitor-floating-host",I=414,x=12,L=40;function U(r,e,n,t){return{x:Math.min(Math.max(x,r),Math.max(x,n-I-x)),y:Math.min(Math.max(x,e),Math.max(x,t-L-x))}}async function O(){document.getElementById(W)?.remove();let r=await chrome.storage.local.get([p.floatingWindow,p.config]),e={...N,...r[p.floatingWindow]},n={...P,...r[p.config]},t=document.createElement("div");t.id=W,t.style.all="initial";let i=t.attachShadow({mode:"closed"});i.innerHTML=`
    <style>
      :host { all: initial; }
      .window {
        position: fixed;
        z-index: 2147483647;
        width: ${I}px;
        height: min(720px, calc(100vh - 24px));
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid #344150;
        border-radius: 14px;
        background: #0d1117;
        box-shadow: 0 18px 55px rgba(0, 0, 0, .38);
        color: #e8edf4;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .window.is-hidden { display: none; }
      .window.is-minimized { height: ${L}px; }
      .window.is-minimized iframe { display: none; }
      .bar {
        height: ${L}px;
        flex: 0 0 ${L}px;
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 0 8px 0 13px;
        border-bottom: 1px solid #27313d;
        background: #151b23;
        cursor: move;
        user-select: none;
        touch-action: none;
      }
      .window.is-minimized .bar { border-bottom: 0; }
      .grip { color: #657285; font-size: 15px; letter-spacing: -2px; }
      .title { flex: 1; font-size: 12px; font-weight: 700; }
      button {
        width: 27px;
        height: 27px;
        display: grid;
        place-items: center;
        padding: 0;
        border: 1px solid #344150;
        border-radius: 8px;
        color: #9ba7b7;
        background: #10161d;
        font: 700 16px/1 system-ui, sans-serif;
        cursor: pointer;
      }
      button:hover { color: #ffffff; border-color: #4c5d70; }
      button:focus-visible { outline: 2px solid #84e7c2; outline-offset: 1px; }
      iframe { width: 100%; min-height: 0; flex: 1; border: 0; background: #0d1117; }
      @media (max-width: 460px) {
        .window { width: calc(100vw - 24px); }
      }
    </style>
    <section class="window" role="dialog" aria-label="PTE Slot Monitor">
      <header class="bar">
        <span class="grip" aria-hidden="true">\u283F</span>
        <span class="title"></span>
        <button class="minimize" type="button"></button>
        <button class="close" type="button">\xD7</button>
      </header>
      <iframe title="PTE Slot Monitor"></iframe>
    </section>
  `,(document.body??document.documentElement).appendChild(t);let o=i.querySelector(".window"),y=i.querySelector(".bar"),b=i.querySelector(".title"),f=i.querySelector(".minimize"),w=i.querySelector(".close"),u=i.querySelector("iframe");u.src=`${chrome.runtime.getURL("popup/index.html")}?mode=floating`;function S(){return n.uiLanguage==="zh-CN"?{title:"PTE \u8003\u4F4D\u76D1\u63A7",minimize:"\u6700\u5C0F\u5316",restore:"\u6062\u590D\u7A97\u53E3",close:"\u5173\u95ED\u60AC\u6D6E\u7A97"}:{title:"PTE Slot Monitor",minimize:"Minimize",restore:"Restore",close:"Close floating window"}}function a(){let s=S();o.classList.toggle("is-hidden",!e.visible),o.classList.toggle("is-minimized",e.minimized),b.textContent=s.title,f.textContent=e.minimized?"+":"\u2212",f.title=e.minimized?s.restore:s.minimize,f.setAttribute("aria-label",f.title),w.title=s.close,w.setAttribute("aria-label",s.close);let m=window.innerWidth-I-24,g=U(e.x??m,e.y??24,window.innerWidth,window.innerHeight);e={...e,...g},o.style.left=`${g.x}px`,o.style.top=`${g.y}px`}async function l(){await chrome.storage.local.set({[p.floatingWindow]:e})}return f.addEventListener("click",s=>{s.stopPropagation(),e={...e,minimized:!e.minimized,visible:!0},a(),l()}),w.addEventListener("click",s=>{s.stopPropagation(),e={...e,visible:!1},a(),l()}),y.addEventListener("pointerdown",s=>{if(s.target.closest("button"))return;s.preventDefault();let m=s.clientX,g=s.clientY,E=e.x??o.offsetLeft,q=e.y??o.offsetTop,T=v=>{let h=U(E+v.clientX-m,q+v.clientY-g,window.innerWidth,window.innerHeight);e={...e,...h},o.style.left=`${h.x}px`,o.style.top=`${h.y}px`},_=()=>{window.removeEventListener("pointermove",T),window.removeEventListener("pointerup",_),l()};window.addEventListener("pointermove",T),window.addEventListener("pointerup",_,{once:!0})}),window.addEventListener("resize",()=>{a(),l()}),chrome.storage.onChanged.addListener((s,m)=>{m==="local"&&s[p.config]?.newValue&&(n={...P,...s[p.config].newValue},a())}),a(),{show:async()=>{e={...e,visible:!0},a(),await l()}}}var Z=new M,$="",H,k,Q=O();function G(){let e=Array.from(document.querySelectorAll('[id^="result_card_"]')).map(t=>({id:t.id,text:t.innerText,dates:Array.from(t.querySelectorAll('[id^="preferredDateShown_"]')).map(i=>i.value),times:Array.from(t.querySelectorAll('[id^="appt_menu_"]')).map(i=>Array.from(i.options).map(o=>o.textContent?.trim()))})),n=document.querySelector('#progressDialog, [aria-busy="true"]');return JSON.stringify({cardState:e,progress:n?`${n.getAttribute("aria-hidden")}|${n.getAttribute("style")}|${n.textContent}`:""})}async function R(r){let e=Z.parse(document,{now:new Date,pageUrl:location.href}),n={type:"SCAN_RESULT",result:e,reason:r,lastPageChangeAt:H};try{await chrome.runtime.sendMessage(n)}catch{}return e}function ee(){window.clearTimeout(k),k=window.setTimeout(()=>{let r=G();r!==$&&($=r,H=new Date().toISOString(),R("page_change"))},250)}var te=new MutationObserver(ee);te.observe(document.documentElement,{childList:!0,subtree:!0,attributes:!0,attributeFilter:["style","class","aria-busy","aria-hidden","value"]});chrome.runtime.onMessage.addListener((r,e,n)=>r.type==="TRIGGER_SCAN"?(R("manual").then(t=>n(t)),!0):r.type==="SHOW_FLOATING_WINDOW"?(Q.then(t=>t.show()).then(()=>n({ok:!0})),!0):!1);$=G();H=new Date().toISOString();R("initial");})();
