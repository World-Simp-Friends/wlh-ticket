(() => {
  const $ = id => document.getElementById(id);
  const phoneScale=$('phoneScale'),phone=$('phone'),popup=$('popup'),status=$('status');
  const homeView=$('homeView'),lineView=$('lineView'),recentsView=$('recentsView'),albumView=$('albumView'),settingsView=$('settingsView'),aboutView=$('aboutView');
  const views=[homeView,lineView,recentsView,albumView,settingsView,aboutView];
  const scroll=$('scroll'),dynamic=$('dynamic'),choices=$('choices'),menu=$('menu'),toast=$('toast'),whoFlash=$('whoFlash');
  const composer=phone.querySelector('.composer'),contactBackdrop=$('contactBackdrop');
  const assistive=$('assistiveToggle'),systemMenu=$('systemMenu');
  const dialogMask=$('dialogMask'),secretPhoto=$('secretPhoto'),viewer=$('viewer'),voidCard=$('voidCard'),modelNumber=$('modelNumber'),buildNumber=$('buildNumber');
  const black=$('black'),reveal=$('reveal');
  const phoneTransition=$('phoneTransition');
  const lizardPhoneMessage='「トカゲさん電話。」<small class="bubbleTranslation">Lizard Phone</small>';
  let current='home', previous='home', stage=0, profileVisits=0, started=false;
  const banner=$('messageBanner'),badge=$('messagesBadge');
  let unreadCount=1,latestUnread={text:'ねえ。 · Này.',time:'23:47'};
  let bannerTimer=0,bannerEpoch=0,popupReplay=0,airplaneMode=false;
  let followChat=true,savedChatScroll=0;

  function fit(){
    const mobile=matchMedia('(max-width: 600px), (pointer: coarse)').matches;
    if(mobile){phoneScale.style.transform='none';return}
    const s=Math.min(1.24,(innerWidth-48)/phoneScale.offsetWidth,(innerHeight-32)/phoneScale.offsetHeight);
    phoneScale.style.transform=`translate(-50%,-50%) scale(${s})`;
  }
  fit(); addEventListener('resize',fit);

  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function buzz(){phone.classList.remove('vibrate');void phone.offsetWidth;phone.classList.add('vibrate')}
  // Work out where the tapped icon sits inside the screen so the zoom grows out of it,
  // the way SpringBoard opened an app. Falls back to centre when there is no icon.
  const VIEW_MAP={home:homeView,line:lineView,recents:recentsView,album:albumView,settings:settingsView,about:aboutView};

  // On the way out the cast shrinks toward its own icon on the home screen, not toward the
  // button that was tapped, so the close finds that icon by the app it belongs to.
  function iconFor(view){
    const name=Object.keys(VIEW_MAP).find(k=>VIEW_MAP[k]===view);
    if(!name)return null;
    if(name==='about')return document.querySelector('[data-open="settings"]');
    return document.querySelector(`[data-open="${name}"]`);
  }
  // transform-origin is read against the view's own box, so the icon centre is expressed
  // relative to that box. The icon rect is measured earlier, while the home screen is still
  // on screen, because a hidden home screen measures its icons as 0x0.
  function launchOriginFrom(anchor,view){
    if(!anchor||!anchor.width||!anchor.height)return '50% 50%';
    const v=view.getBoundingClientRect();
    if(!v.width||!v.height)return '50% 50%';
    const cx=anchor.left+anchor.width/2, cy=anchor.top+anchor.height/2;
    return `${(cx-v.left).toFixed(2)}px ${(cy-v.top).toFixed(2)}px`;
  }
  function playViewAnimation(view,kind,anchor){
    if(!kind)return 0;
    view.style.removeProperty('--launch-origin');
    view.classList.remove('from-icon','from-icon-reverse','slideInFromRight','slideOutToRight','settle','is-leaving');
    const leaving=kind==='close'||kind==='pop';
    // Measure before any transform lands: a view mid-animation reports a scaled box, and an
    // origin read from it sits in the wrong place.
    void view.offsetWidth;
    if(kind==='open'||kind==='close')view.style.setProperty('--launch-origin',launchOriginFrom(anchor,view));
    // Reflow again so the class lands after the origin is set, letting the animation replay.
    void view.offsetWidth;
    const cls=kind==='open'?'from-icon':kind==='close'?'from-icon-reverse'
      :kind==='push'?'slideInFromRight':kind==='pop'?'slideOutToRight':'settle';
    if(leaving)view.classList.add('is-leaving');
    view.classList.add(cls);
    const done=()=>{view.classList.remove(cls);if(leaving)view.classList.remove('is-leaving')};
    view.addEventListener('animationend',done,{once:true});
    // Backgrounded tabs may drop the end frame, which would leave the class stuck on.
    setTimeout(done,700);
    return leaving?380:0;
  }
  function viewKindFor(name,from,trigger){
    const appViews=['line','album','settings','about'];
    if(name===from)return '';
    if(name==='home')return 'close';
    if(appViews.includes(name)){
      if(from==='about'&&name==='settings')return 'pop';
      if(from==='settings'&&name==='about')return 'push';
      return 'open';
    }
    if(name==='recents')return 'settle';
    return '';
  }
  function showView(name,trigger){
    const map=VIEW_MAP;
    const from=current;
    if(from==='line'&&name!=='line'){
      savedChatScroll=scroll.scrollTop;
      followChat=scroll.scrollHeight-scroll.clientHeight-scroll.scrollTop<48;
    }
    const kind=viewKindFor(name,from,trigger);
    const outgoing=map[from];
    const incoming=map[name];
    previous=from; current=name;
    // The exit plays on the view being left, the entrance on the view being entered. Running
    // both through one element meant an opening app zoomed the home screen instead of itself.
    const leaving=kind==='close'||kind==='pop';
    // Measure the icon before the classes change. Once the home screen loses active it is
    // display:none and every icon inside measures 0x0, which is what parked the zoom in the
    // middle of the phone on every opening.
    // The home screen is display:none while an app is open, and an icon inside a hidden
    // subtree measures 0x0. Show it for the read, invisibly, then restore.
    const probe=kind?(leaving?iconFor(outgoing):trigger):null;
    let anchor=null;
    if(probe){
      const homeShown=homeView.classList.contains('active');
      if(homeShown){
        anchor=probe.getBoundingClientRect();
      }else{
        homeView.style.visibility='hidden';
        homeView.classList.add('active');
        anchor=probe.getBoundingClientRect();
        homeView.classList.remove('active');
        homeView.style.removeProperty('visibility');
      }
    }
    phone.dataset.view=name;
    const delay=leaving?playViewAnimation(outgoing,kind,anchor):0;
    views.forEach(v=>{if(v!==outgoing){v.classList.toggle('active',v===map[name]);v.inert=v!==map[name]}});
    if(leaving){
      outgoing.classList.remove('active');outgoing.inert=true;
      incoming.classList.remove('active');incoming.inert=true;
      setTimeout(()=>{
        if(current!==name)return;
        incoming.classList.add('active');incoming.inert=false;
        outgoing.classList.remove('is-leaving');
      },delay);
    }else{
      views.forEach(v=>{v.classList.toggle('active',v===map[name]);v.inert=v!==map[name]});
      if(kind)playViewAnimation(incoming,kind,anchor);
    }
    closeContacts();closeSystemMenu();
    if(name==='album')albumView.dispatchEvent(new Event('photos:open'));
    if(name==='line'){
      markMessagesRead();
      updateChoiceGap();
      if(followChat)bottom();else scroll.scrollTop=savedChatScroll;
      window.dispatchEvent(new CustomEvent('invitation:prepare'));
    }
  }
  function closeContacts(){
    menu.classList.remove('show');contactBackdrop.hidden=true;
    $('menuBtn').setAttribute('aria-expanded','false');
  }
  function closeSystemMenu(){systemMenu.hidden=true;assistive.setAttribute('aria-expanded','false')}
  function toastMsg(t){
    toast.textContent=t;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1400);
  }
  function motionAllowed(){return !matchMedia('(prefers-reduced-motion: reduce)').matches}
  function setUnreadCount(value){
    const wasUnread=unreadCount>0;
    unreadCount=Math.max(0,value);
    badge.textContent=unreadCount>99?'99+':String(unreadCount);
    badge.hidden=unreadCount===0;
    phone.dataset.unread=String(unreadCount>0);
    badge.closest('button').setAttribute('aria-label',unreadCount?`Messages · ${unreadCount} tin nhắn chưa đọc`:'Messages');
    if(unreadCount&&!wasUnread&&motionAllowed())badge.animate([{transform:'scale(.82)'},{transform:'scale(1)'}],{duration:180,easing:'cubic-bezier(.22,1,.36,1)'});
  }
  function hideMessageBanner(immediate=false){
    const epoch=++bannerEpoch;
    clearTimeout(bannerTimer);banner.inert=true;
    banner.getAnimations().forEach(animation=>animation.cancel());
    if(immediate||banner.hidden||!motionAllowed()){banner.hidden=true;return}
    banner.animate([{transform:'translateY(0)',opacity:1},{transform:'translateY(-100%)',opacity:0}],{duration:150,easing:'cubic-bezier(.4,0,1,1)'}).finished.catch(()=>{}).then(()=>{
      if(epoch===bannerEpoch)banner.hidden=true;
    });
  }
  function showMessageBanner(message){
    if(!message||current==='line'||invitationStarted||handoffStarted)return;
    ++bannerEpoch;clearTimeout(bannerTimer);
    const entering=banner.hidden||banner.inert;
    banner.getAnimations().forEach(animation=>animation.cancel());
    $('messageBannerText').textContent=message.text;
    $('messageBannerTime').textContent=message.time;
    banner.setAttribute('aria-label',`Unknown: ${message.text} Mở tin nhắn.`);
    banner.hidden=false;banner.inert=false;bannerDismissed=false;
    if(entering&&motionAllowed())banner.animate([{transform:'translateY(-100%)',opacity:.6},{transform:'translateY(0)',opacity:1}],{duration:250,easing:'cubic-bezier(.22,1,.36,1)'});
    bannerTimer=setTimeout(()=>hideMessageBanner(),6000);
  }
  function markMessagesRead(){
    setUnreadCount(0);latestUnread=null;++popupReplay;
    popup.classList.remove('show');hideMessageBanner(true);
  }
  function notifyIncoming(html,time){
    if(invitationStarted||handoffStarted)return;
    if(current==='line'&&!document.hidden){markMessagesRead();return}
    const preview=document.createElement('div');preview.innerHTML=html;
    preview.querySelectorAll('small,br').forEach(node=>node.before(document.createTextNode(' · ')));
    latestUnread={text:preview.textContent.replace(/\s+/g,' ').trim(),time};
    setUnreadCount(unreadCount+1);
    if(!document.hidden){buzz();showMessageBanner(latestUnread)}
  }
  let bannerStartY=0,bannerDismissed=false;
  banner.onpointerdown=event=>{bannerStartY=event.clientY;banner.setPointerCapture(event.pointerId)};
  banner.onpointerup=event=>{
    if(event.clientY-bannerStartY< -24){bannerDismissed=true;hideMessageBanner(true)}
  };
  banner.onclick=()=>{
    if(bannerDismissed){bannerDismissed=false;return}
    showView('line',badge.closest('button'));
  };
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden||invitationStarted||handoffStarted)return;
    if(current==='line')markMessagesRead();else if(unreadCount)showMessageBanner(latestUnread);
  });
  function syncConnectivity(){
    $('airplaneStatus').hidden=!airplaneMode;
    $('airplaneToggle').setAttribute('aria-checked',String(airplaneMode));
    $('wifiState').textContent=airplaneMode||status.classList.contains('noService')?'Off':'On';
    $('networkNote').hidden=!airplaneMode;
    status.setAttribute('aria-label',airplaneMode?'Trạng thái điện thoại — Chế độ máy bay':'Trạng thái điện thoại');
  }
  $('airplaneToggle').onclick=()=>{
    airplaneMode=!airplaneMode;
    status.classList.toggle('airplane-mode',airplaneMode);
    syncConnectivity();
  };
  new MutationObserver(syncConnectivity).observe(status,{attributes:true,attributeFilter:['class']});
  syncConnectivity();setUnreadCount(1);
  function bottom(){if(current==='line'&&followChat)scroll.scrollTop=scroll.scrollHeight}
  function updateChoiceGap(){
    const base=composer.offsetHeight||44;
    const gap=choices.classList.contains('show')?choices.offsetHeight+18:0;
    scroll.style.bottom=`${base+gap}px`;
  }
  function showChoices(){
    choices.classList.add('show');updateChoiceGap();bottom();
  }
  function hideChoices(){
    choices.classList.remove('show');updateChoiceGap();
  }
  updateChoiceGap();
  scroll.addEventListener('scroll',()=>{
    if(current!=='line'||!scroll.clientHeight)return;
    savedChatScroll=scroll.scrollTop;
    followChat=scroll.scrollHeight-scroll.clientHeight-scroll.scrollTop<48;
  },{passive:true});
  views.forEach(v=>{v.inert=!v.classList.contains('active')});
  if('ResizeObserver' in window){
    const observer=new ResizeObserver(updateChoiceGap);
    observer.observe(choices);observer.observe(composer);
  }
  function addMine(t){
    followChat=true;
    const r=document.createElement('div');r.className='row me';
    r.innerHTML=`<div class="stamp">既読 23:47</div><div class="bw"><div class="bubble">${t}</div></div>`;
    dynamic.appendChild(r);bottom();
  }
  function addThem(t,time='23:47'){
    const r=document.createElement('div');r.className='row them';
    r.innerHTML=`<div class="bw"><div class="bubble">${t}</div></div><div class="stamp${time==='--:--'?' anomaly':''}">${time}</div>`;
    dynamic.appendChild(r);bottom();
    notifyIncoming(t,time);
  }
  function typing(){
    const r=document.createElement('div');r.className='row them';
    r.innerHTML='<div class="bw"><div class="bubble typing" aria-label="Unknown đang nhập"><i></i><i></i><i></i></div></div>';
    dynamic.appendChild(r);bottom();return r;
  }
  async function reply(t,delay=800,time='23:47'){const x=typing();await sleep(delay);x.remove();addThem(t,time)}

  const notificationObserver=new MutationObserver(()=>{
    const shown=popup.classList.contains('show');
    homeView.querySelector('.grid').inert=shown;
    if(shown&&current==='home')$('viewPopup').focus({preventScroll:true});
  });
  notificationObserver.observe(popup,{attributes:true,attributeFilter:['class']});

  // first notification
  (async()=>{
    await sleep(900);
    if(invitationStarted||handoffStarted||!unreadCount)return;
    buzz();
    if(current==='home')popup.classList.add('show');else showMessageBanner(latestUnread);
  })();

  $('closePopup').onclick=async()=>{
    popup.classList.remove('show');const replay=++popupReplay;
    await sleep(850);
    if(replay!==popupReplay||!unreadCount||invitationStarted||handoffStarted)return;
    buzz();if(current==='home')popup.classList.add('show');else showMessageBanner(latestUnread);
  };
  $('viewPopup').onclick=()=>{
    popup.classList.remove('show');
    showView('line',document.getElementById('messagesBadge')?.closest('.app')||null);
  };

  document.querySelectorAll('[data-open]').forEach(el=>{
    el.addEventListener('click',()=>{
      if(el.dataset.open==='line'){
        $('viewPopup').onclick();
      }else showView(el.dataset.open,el);
    });
  });

  $('lineBack').onclick=()=>showView('home');
  $('menuBtn').onclick=()=>{
    const open=!menu.classList.contains('show');
    menu.classList.toggle('show',open);contactBackdrop.hidden=!open;
    $('menuBtn').setAttribute('aria-expanded',String(open));
  };
  $('closeContact').onclick=closeContacts;contactBackdrop.onclick=closeContacts;

  $('profileBtn').onclick=async()=>{
    closeContacts(); profileVisits++;
    if(profileVisits>=2 && stage>=1){
      whoFlash.classList.remove('flash');void whoFlash.offsetWidth;whoFlash.classList.add('flash');
      await sleep(330);
    }
    toastMsg('ユーザーが見つかりません · Không tìm thấy người dùng');
  };

  $('blockBtn').onclick=()=>{closeContacts();dialogMask.classList.add('show')};
  $('cancelBlock').onclick=()=>dialogMask.classList.remove('show');
  $('confirmBlock').onclick=async()=>{
    dialogMask.classList.remove('show');toastMsg('ブロックしました · Đã chặn');
    await sleep(900);buzz();addThem('<span>まだ聞こえる？</span><small class="bubbleTranslation">Cậu vẫn nghe thấy chứ?</small>','--:--');
  };

  document.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>begin(b.dataset.answer));

  async function begin(kind){
    if(started)return; started=true; hideChoices();
    addMine(kind==='who'?'Cậu là ai?':'Điện thoại gì?');
    await sleep(450);
    if(kind==='who'){
      await reply('Điều đó quan trọng sao?',820);
      await sleep(350);
      await reply('Thứ cậu nên tò mò là chiếc điện thoại.',820);
    }else{
      await reply('Một chiếc điện thoại xuất hiện trong lời đồn.',820);
    }
    await sleep(450);

    stage=1;
    status.classList.add('noService');
    lineView.classList.add('stage1');
    secretPhoto.classList.add('show');

    await sleep(450);
    await reply('Gần đây, các cô gái ở Mitakihara đang truyền tai nhau về nó.',880,'--:--');
    showRumorChoices();
  }

  function showRumorChoices(){
    choices.innerHTML=`<button class="choice" id="askRumor">Lời đồn gì?</button><button class="choice" id="neverHeard">Tôi chưa từng nghe.</button>`;
    showChoices();
    $('askRumor').onclick=()=>continueFromRumor('Lời đồn gì?','Về một chiếc điện thoại.');
    $('neverHeard').onclick=()=>continueFromRumor('Tôi chưa từng nghe.','Vậy thì bây giờ cậu sẽ biết.');
  }

  async function continueFromRumor(userText,response){
    hideChoices();addMine(userText);
    await sleep(350);await reply(response,780,'--:--');
    await sleep(450);await reply(lizardPhoneMessage,800,'--:--');
    await sleep(800);await reply('Nghe nói nó có thể thực hiện một điều ước.',820,'--:--');
    showPriceChoices();
  }

  function showPriceChoices(){
    choices.innerHTML=`<button class="choice" id="anyWish">Bất kỳ điều ước nào?</button><button class="choice" id="soundsSuspicious">Nghe đáng ngờ quá.</button><button class="choice" id="askPrice">Cái giá là gì?</button>`;
    showChoices();
    $('anyWish').onclick=()=>continueFromWishClaim('Bất kỳ điều ước nào?','Người ta đồn là vậy.');
    $('soundsSuspicious').onclick=()=>continueFromWishClaim('Nghe đáng ngờ quá.','Những lời đồn thú vị thường là thế mà.');
    $('askPrice').onclick=()=>continueFromWishClaim('Cái giá là gì?','Tất nhiên là có.');
  }

  async function continueFromWishClaim(userText,response){
    hideChoices();addMine(userText);
    await sleep(350);await reply(response,780,'--:--');
    await sleep(450);await reply('Cái giá là phải chiến đấu với những lời nguyền của thế giới này.',900,'--:--');
    await sleep(1000);await reply('Nếu lời đồn đó là thật…',820,'--:--');
    await sleep(450);await reply('Cậu sẽ ước điều gì?',780,'--:--');
    showWishChoices();
  }

  function showWishOrLeaveChoices(){
    choices.innerHTML=`<button class="choice" id="wish">Tôi có một điều ước.</button><button class="choice" id="leave">Đóng cuộc trò chuyện.</button>`;
    showChoices();
    $('wish').onclick=()=>contract(false);
    $('leave').onclick=leaveConversation;
  }

  function showWishChoices(){
    choices.innerHTML=`<button class="choice" id="wantSomething">…Có một điều tôi muốn.</button><button class="choice" id="whyAsk">Tại sao cậu muốn biết?</button><button class="choice" id="noAnswer">Không trả lời.</button>`;
    showChoices();
    $('wantSomething').onclick=()=>contract(false,'…Có một điều tôi muốn.');
    $('whyAsk').onclick=()=>respondToWishChoice('Tại sao cậu muốn biết?','Tớ chỉ muốn biết cậu có tin vào lời đồn không.');
    $('noAnswer').onclick=()=>respondToWishChoice('Không trả lời.','Ừm. Tùy cậu.');
  }

  async function respondToWishChoice(userText,response){
    hideChoices();addMine(userText);
    await sleep(350);await reply(response,780,'--:--');
    showWishOrLeaveChoices();
  }

  async function leaveConversation(){
    hideChoices();addMine('Đóng cuộc trò chuyện.');

    await sleep(850);
    showView('home');

    await sleep(900);
    buzz();

    // LINE comes back even after the user tries to leave.
    latestUnread={text:'ねえ。 · Này.',time:'--:--'};
    setUnreadCount(unreadCount+1);
    if(current==='home')popup.classList.add('show');else showMessageBanner(latestUnread);
    popup.querySelector('.popupBody').innerHTML='<strong>Unknown</strong>ねえ。<small class="bubbleTranslation">Này.</small>';

    await sleep(1400);
    popup.classList.remove('show');
    showView('line');

    await sleep(350);
    addThem('Cậu không cần phải tin đâu.','--:--');

    await sleep(700);
    await reply('Chỉ cần nhớ cái tên này.',800,'--:--');

    await sleep(450);
    await reply(lizardPhoneMessage,820,'--:--');

    await sleep(500);

    choices.innerHTML=`
      <button class="choice" id="returnWish">…Tôi có một điều ước.</button>
      <button class="choice" id="ignoreAgain">Tiếp tục bỏ qua.</button>
    `;
    showChoices();

    $('returnWish').onclick=()=>contract(true);

    $('ignoreAgain').onclick=async()=>{
      hideChoices();
      addMine('Tiếp tục bỏ qua.');

      await sleep(1000);

      status.classList.add('noService');
      lineView.classList.add('stage2');
      voidCard.classList.add('show');
      secretPhoto.classList.add('show');

      await reply('Ừm.',650,'--:--');
      await sleep(1400);
      await reply('Vậy cứ coi như cậu chưa từng thấy những tin nhắn này.',900,'--:--');
      await sleep(600);
      await reply('Nhưng nếu một chiếc điện thoại lạ reo lên…',850,'--:--');
      await sleep(500);
      await reply('đừng bỏ lỡ cuộc gọi.',820,'--:--');
      showFinalContinue();
    };
  }

  async function contract(returning=false,userText='Tôi có một điều ước.'){
    hideChoices();addMine(returning?'…Tôi có một điều ước.':userText);
    await sleep(450);
    await reply(returning?'Vậy thì cậu có lý do để nhớ lời đồn đó.':'Vậy thì cậu có lý do để nhớ cái tên đó.',800,'--:--');
    if(!returning){
      await sleep(450);
      await reply(lizardPhoneMessage,800,'--:--');
    }
    stage=2;lineView.classList.add('stage2');voidCard.classList.add('show');buildNumber.textContent='QB.1026';
    await sleep(600);
    choices.innerHTML=`<button class="choice" id="askNext">Hỏi tiếp</button>`;
    showChoices();$('askNext').onclick=()=>askNext(returning);
  }

  async function askNext(returning){
    hideChoices();addMine('…Vậy tôi phải làm gì?');
    await sleep(450);await reply('Không cần làm gì cả.',820,'--:--');
    if(!returning){
      await sleep(450);await reply('Chỉ cần nhớ lời đồn này.',820,'--:--');
    }
    await sleep(450);await reply('Nếu một chiếc điện thoại lạ reo lên…',850,'--:--');
    await sleep(600);await reply('đừng bỏ lỡ cuộc gọi.',820,'--:--');
    showFinalContinue();
  }

  function showFinalContinue(){
    choices.innerHTML='<button class="choice" id="finishInvite">Tiếp tục</button>';
    showChoices();$('finishInvite').onclick=revealEvent;
  }

  let invitationStarted=false,handoffStarted=false;
  const opacityFinished=element=>new Promise(resolve=>{
    const style=getComputedStyle(element);
    const milliseconds=value=>parseFloat(value)*(value.trim().endsWith('ms')?1:1000);
    const duration=milliseconds(style.transitionDuration)+milliseconds(style.transitionDelay);
    if(!duration){resolve();return}
    const done=event=>{
      if(event&&(event.target!==element||event.propertyName!=='opacity'))return;
      clearTimeout(timer);element.removeEventListener('transitionend',done);resolve();
    };
    const timer=setTimeout(()=>{
      // A throttled/background tab may not deliver its transition end frame.
      element.getAnimations?.().forEach(animation=>{
        if(animation.transitionProperty==='opacity')try{animation.finish()}catch(_){}
      });
      done();
    },duration+100);
    element.addEventListener('transitionend',done);
  });
  async function releasePhoneTransition(){
    if(!phoneTransition.classList.contains('is-covered'))return;
    phoneTransition.classList.add('is-releasing');
    phoneTransition.classList.remove('is-covered');
    await opacityFinished(phoneTransition);
    phoneTransition.classList.remove('is-active','is-releasing');
  }
  window.addEventListener('invitation:opening',releasePhoneTransition);
  window.addEventListener('invitation:ready',releasePhoneTransition);  phoneTransition.addEventListener('wheel',event=>event.preventDefault(),{passive:false});
  function openInvitation(){
    if(invitationStarted)return;
    invitationStarted=true;
    ++popupReplay;hideMessageBanner(true);
    popup.classList.remove('show');
    phoneScale.classList.add('gone');
    phoneScale.inert=true;
    phoneScale.setAttribute('aria-hidden','true');
    hideChoices();
    reveal.hidden=false;
    reveal.inert=true;
    document.documentElement.classList.add('invitation-open');
    document.body.classList.add('invitation-open');
    window.scrollTo({top:0,behavior:'instant'});
    window.dispatchEvent(new CustomEvent('invitation:open'));
  }
  window.addEventListener('invitation:preview',openInvitation);
  async function revealEvent(){
    if(invitationStarted||handoffStarted)return;
    handoffStarted=true;phone.inert=true;
    // Freeze the reply layout until it is covered: hiding choices first shifts chat.
    black.classList.add('show');
    await opacityFinished(black);
    phoneTransition.classList.add('is-active','is-covered');
    phoneScale.classList.add('gone');
    await opacityFinished(phoneTransition);
    openInvitation();
  }

  // Skip hands the visitor straight to the invitation through the same cover-and-release
  // path the phone uses, so the prologue never plays a second transition style.
  // The button answers on pointerdown: the handoff spends its first frames setting up the
  // fade, so waiting for the cover made a pressed button look dead.
  const prologueSkip=$('prologueSkip');
  prologueSkip.onpointerdown=()=>prologueSkip.classList.add('is-pressed');
  prologueSkip.onclick=()=>{prologueSkip.classList.remove('is-pressed');revealEvent()};
  prologueSkip.onpointerup=()=>prologueSkip.classList.remove('is-pressed');
  prologueSkip.onpointercancel=()=>prologueSkip.classList.remove('is-pressed');
  window.addEventListener('invitation:open',()=>prologueSkip.classList.add('is-hidden'));

  let homeTap=0;
  $('navHome').onclick=()=>{
    if(homeTap){clearTimeout(homeTap);homeTap=0;showView('recents')}
    else homeTap=setTimeout(()=>{homeTap=0;showView('home')},230);
  };
  $('touchHome').onclick=()=>showView('home');
  $('navRecent').onclick=()=>showView('recents');
  $('navBack').onclick=()=>{
    if(current==='album'&&!albumView.dispatchEvent(new Event('photos:back',{cancelable:true})))return;
    if(current==='about')showView('settings');
    else if(current==='settings'||current==='album'||current==='recents'||current==='line')showView('home');
  };

  $('aboutRow').onclick=e=>showView('about',e.currentTarget);
  phone.querySelectorAll('[data-phone-back]').forEach(button=>{
    button.onclick=()=>showView(button.dataset.phoneBack,button);
  });

  let drag=null,dragged=false;
  assistive.addEventListener('pointerdown',event=>{
    const bounds=assistive.parentElement.getBoundingClientRect();
    const rect=assistive.getBoundingClientRect();
    drag={x:event.clientX,y:event.clientY,left:rect.left-bounds.left,top:rect.top-bounds.top,width:bounds.width,height:bounds.height};
    dragged=false;assistive.setPointerCapture(event.pointerId);
  });
  assistive.addEventListener('pointermove',event=>{
    if(!drag)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(Math.abs(dx)+Math.abs(dy)>6)dragged=true;
    if(!dragged)return;
    assistive.style.right='auto';
    assistive.style.left=`${Math.max(0,Math.min(drag.width-42,drag.left+dx))}px`;
    assistive.style.top=`${Math.max(20,Math.min(drag.height-42,drag.top+dy))}px`;
  });
  ['pointerup','pointercancel'].forEach(type=>assistive.addEventListener(type,()=>{drag=null}));
  assistive.onclick=()=>{
    if(dragged){dragged=false;return}
    const open=systemMenu.hidden;systemMenu.hidden=!open;
    assistive.setAttribute('aria-expanded',String(open));
  };

  document.addEventListener('keydown',event=>{
    if(invitationStarted||handoffStarted)return;
    if(event.key==='Escape'){
      if(!systemMenu.hidden)closeSystemMenu();
      else if(dialogMask.classList.contains('show'))dialogMask.classList.remove('show');
      else if(menu.classList.contains('show'))closeContacts();
      else if(current==='album'&&viewer.classList.contains('show'))viewer.dispatchEvent(new Event('photos:close'));
      else $('navBack').click();
      event.preventDefault();
    }
  });

  voidCard.onclick=e=>{
    showView('line',e.currentTarget);
    if(stage<2){stage=2;lineView.classList.add('stage2')}
  };
})();
