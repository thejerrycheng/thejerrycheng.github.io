/* Load the larger development snapshot only when its section is approached. */
(()=>{'use strict';const section=document.getElementById('development');let started=false;
const notice=document.createElement('p');notice.className='section-note';notice.setAttribute('role','status');notice.textContent='Video and training explorer loads when you reach this section.';section.insertBefore(notice,section.querySelector('.m2-tabs'));
function script(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.append(s);});}
async function load(){if(started)return;started=true;notice.textContent='Loading recorded development results…';try{await script('assets/projects/m2/data.js');await script('assets/projects/m2/m2-project.js?v='+encodeURIComponent((window.M2Project.interface_revision||'legacy')+'-orange-tiffany'));notice.remove();}catch(e){started=false;notice.textContent='The explorer could not load. ';const retry=document.createElement('button');retry.textContent='Retry';retry.onclick=load;notice.append(retry);}}
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();load();}},{rootMargin:'500px'});observer.observe(section);}else{load();}
})();
