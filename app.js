/* INVINCIBLER - app.js
   draws the title card on a 1920x1080 canvas. the same draw() is used for the
   preview, the Play animation, PNG, GIF and video, so they always match.
   draw(ctx, t): t = seconds into the animation, or null for the finished card. */
(function(){
  var W = 1920, H = 1080;
  var $ = function(id){ return document.getElementById(id); };
  var card = $('card'), cx = card.getContext('2d');
  var statusEl = $('status');
  function say(m){ statusEl.textContent = m || ''; }

  // ---- looks, colors measured from the real cards ---------------------------
  var PRESETS = [
    { id:'classic', name:'Classic (season 1)', bg:'#169AF5', fg:'#FAE800', fx:'none' },
    { id:'bloody',  name:'Bloody (season 1)',  bg:'#169AF5', fg:'#FAE800', fx:'blood', ep:6 },
    { id:'red',     name:'Red on black (season 2)', bg:'#050505', fg:'#BA0D13', fx:'none', grain:false },
    { id:'cracked', name:'Cracked (season 2)', bg:'#050505', fg:'#BA0D13', fx:'cracks', grain:false },
    { id:'blackblue', name:'Black on blue',    bg:'#457CBD', fg:'#000000', fx:'none' },
    { id:'grey',    name:'Grey (season 3)',    bg:'#44484A', fg:'#598AA9', fx:'none' },
    { id:'sun',     name:'Yellow & blue',      bg:'#FCDA5A', fg:'#3876AB', fx:'glitch' },
    { id:'steel',   name:'Steel blue',         bg:'#3678A7', fg:'#FDDB5A', fx:'none' },
    { id:'brick',   name:'Brick red',          bg:'#C6412E', fg:'#D5E0E8', fx:'none' },
    { id:'mint',    name:'Mint & red',         bg:'#C8E3E4', fg:'#C4422A', fx:'none' },
    { id:'silver',  name:'Silver',             bg:'#C3CCCD', fg:'#F8F9FC', fx:'none' },
    { id:'lime',    name:'Toxic lime',         bg:'#89F349', fg:'#E9F96B', fx:'glitch' },
    { id:'cream',   name:'Cream & navy',       bg:'#FBF0EA', fg:'#437193', fx:'none' },
    { id:'night',   name:'Charcoal & gold',    bg:'#2E3234', fg:'#FDE25E', fx:'none' },
    { id:'coral',   name:'Coral',              bg:'#E76551', fg:'#CAE3E4', fx:'glitch' },
    { id:'space',   name:'Space holes (season 3 finale)', bg:'#DFE1E1', fg:'#8A9395', fx:'space' },
    { id:'white',   name:'White & blue',       bg:'#FDFDFD', fg:'#3778A8', fx:'none' },
    // season 2 episode 3. background, red paint and the red "THE ALIEN" are cut
    // from the real card, the title is in mint with wider letters like the real one
    { id:'allen',   name:'Allen the Alien (season 2)', bg:'#2A1FD4', fg:'#2FFFD0', fx:'none', grain:false,
      img:'img/allen-bg.jpg', paint:'img/allen-paint.webp', alien:'img/allen-the-alien.webp',
      size:22, ypos:12.9, sx:1.27, bend:9, credY:.731, title:'ALLEN' }
  ];
  // the order the glitch animation flips through
  var GLITCH_SEQ = ['sun','grey','brick','mint','silver','steel','lime','cream','night','coral'].map(function(id){
    return PRESETS.filter(function(p){ return p.id===id; })[0];
  });

  var S = {
    preset:'classic', bg:'#169AF5', fg:'#FAE800', grain:true,
    fx:'none', ep:4, ink:'#050505', blood:'#B3080E', holeBg:'#457CBD', holeFg:'#000000',
    size:22, bend:10, ypos:22.5, credits:true, seed:7
  };

  // ---- small helpers ----------------------------------------------------------
  function rng(seed){
    var a = seed >>> 0;
    return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function ease(p){ p = clamp(p, 0, 1); return 1 - Math.pow(1-p, 3); }
  function hexRgb(h){ h = h.replace('#',''); return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]; }
  function mix(a, b, k){ var x = hexRgb(a), y = hexRgb(b); return 'rgb(' + [0,1,2].map(function(i){ return Math.round(x[i] + (y[i]-x[i])*k); }).join(',') + ')'; }
  function canvas(w, h){ var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  var grainImg = new Image(), grainOk = false;
  grainImg.onload = function(){ grainOk = true; redraw(); };
  grainImg.src = 'img/grain.jpg';

  // ---- text -------------------------------------------------------------------
  function titleLines(){
    var raw = $('title').value.replace(/\r/g,'').split('\n').map(function(s){ return s.trim(); }).filter(Boolean);
    if(!raw.length) raw = [' '];
    // a long single line gets split in two, like a two line card
    if(raw.length === 1 && raw[0].length > 18 && raw[0].indexOf(' ') > 0){
      var words = raw[0].split(/\s+/), best = null;
      for(var i=1; i<words.length; i++){
        var a = words.slice(0,i).join(' '), b = words.slice(i).join(' '), d = Math.abs(a.length - b.length);
        if(!best || d < best.d) best = { d:d, l:[a, b] };
      }
      raw = best.l;
    }
    return raw;
  }
  function titleOpts(){
    return { cx:W/2, top:H*S.ypos/100, cap:W*S.size/100, maxW:W*.82, maxH:H*.5, bend:S.bend/100, sx:S.sx || 1 };
  }
  var JOST = '"Jost","Futura","Century Gothic","Trebuchet MS",sans-serif';
  // letters + credits in one color. returns the title box
  // mode: 'title' = only the big title, 'credits' = only the credits, nothing = both
  function drawText(ctx, color, dx, dy, mode){
    var o = titleOpts(); o.color = color; o.cx += dx || 0; o.top += dy || 0;
    var box;
    if(mode === 'credits'){ var off = canvas(1, 1).getContext('2d'); box = TitleCard.draw(off, titleLines(), o); }
    else box = TitleCard.draw(ctx, titleLines(), o);
    if(S.credits && mode !== 'title'){
      var l1 = $('cred1').value, l2 = $('cred2').value, y = S.special && S.special.credY ? H*S.special.credY : box.bottom + W*.054;
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      [[l1, .0141], [l2, .0198]].forEach(function(p, i){
        if(!p[0]) return;
        var px = W*p[1]/.7;
        ctx.font = '500 ' + px + 'px ' + JOST;
        var w = ctx.measureText(p[0]).width; if(w > W*.9){ px *= W*.9/w; ctx.font = '500 ' + px + 'px ' + JOST; }
        ctx.fillText(p[0], o.cx, y + (i ? W*.0406 : 0));
      });
    }
    return box;
  }
  var maskC = canvas(W, H), maskX = maskC.getContext('2d');
  function letterMask(){ maskX.clearRect(0,0,W,H); return drawText(maskX, '#fff', 0, 0, 'title'); }  // blood only soaks the big title

  // ---- background ---------------------------------------------------------------
  var imgs = {};
  function img(src){
    if(!src) return null;
    if(!imgs[src]){ var im = new Image(); im.onload = function(){ im.ok = true; redraw(); drawThumbs(); }; im.src = src; imgs[src] = im; }
    return imgs[src].ok ? imgs[src] : null;
  }
  function drawBg(ctx, bg){
    ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
    var sp = S.special, bi = sp && bg === sp.bg ? img(sp.img) : null;
    if(bi){ ctx.drawImage(bi, 0, 0, W, H); return; }
    if(S.grain && grainOk){
      ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .9;
      ctx.drawImage(grainImg, 0, 0, W, H); ctx.restore();
    }
  }

  // ---- blood (season 1) ----------------------------------------------------------
  // black ink splashes over everything, red spatter only on the letters.
  // every splash has an episode number, so episode 3 shows everything up to 3
  function makeBlood(seed, box){
    var r = rng(seed*31 + 5), specks = [];
    for(var q=0; q<260; q++) specks.push([box.x + r()*box.w, box.y + r()*box.h, 2 + Math.pow(r(), 3)*16]);
    return { specks:specks };
  }
  var redC = canvas(W, H), redX = redC.getContext('2d');
  // the black ink and red spatter are cut out of the real season 1 cards,
  // one layer per episode (2 to 8). episode 1 is the clean card
  var LAYERS = {}, tinted = {};
  function layerImg(kind, ep){
    var key = kind + ep;
    if(!LAYERS[key]){
      var im = new Image(); im.onload = function(){ im.ok = true; tinted = {}; redraw(); };
      im.src = 'img/blood/' + key + '.webp'; LAYERS[key] = im;
    }
    return LAYERS[key].ok ? LAYERS[key] : null;
  }
  function layer(kind, ep, color){
    if(ep < 2 || ep > 8 || (kind === 'red' && ep > 7)) return null;   // episode 8's red is the full soak below
    var key = kind + ep + color;
    if(tinted[key]) return tinted[key];
    var im = layerImg(kind, ep); if(!im) return null;
    var c = canvas(W, H), x = c.getContext('2d');
    x.drawImage(im, 0, 0, W, H); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0,0,W,H);
    return (tinted[key] = c);
  }
  function preloadBlood(){ for(var e=2; e<=8; e++){ layerImg('ink', e); layerImg('inkon', e); if(e < 8) layerImg('red', e); } }
  // amount: episode number (can be a fraction while animating, then the next
  // episode's blood pops in). part 'under' = the ink behind the letters,
  // part 'over' = the ink and red that landed on the letters
  function bloodLevels(amount){ var L = Math.floor(amount); return { L:L, f:ease((amount - L)/.12) }; }
  function both(x, kind, color, lv){
    var a = layer(kind, lv.L, color), b = layer(kind, lv.L + 1, color);
    if(a) x.drawImage(a, 0, 0);
    if(b && lv.f > 0){ x.globalAlpha = lv.f; x.drawImage(b, 0, 0); x.globalAlpha = 1; }
  }
  function drawBloodUnder(ctx, amount){ both(ctx, 'ink', S.ink, bloodLevels(amount)); }
  function drawBloodOver(ctx, blood, amount){
    var lv = bloodLevels(amount);
    redX.clearRect(0,0,W,H);
    both(redX, 'inkon', S.ink, lv);
    both(redX, 'red', S.blood, lv);
    var full = lv.L >= 8 ? 1 : (lv.L === 7 ? lv.f : 0);
    if(full > 0){
      // last episode: the letters are soaked, only little specks of color left
      redX.fillStyle = S.blood; redX.globalAlpha = full; redX.fillRect(0,0,W,H); redX.globalAlpha = 1;
      redX.globalCompositeOperation = 'destination-out';
      blood.specks.forEach(function(d){ redX.beginPath(); redX.arc(d[0], d[1], d[2], 0, Math.PI*2); redX.fill(); });
      redX.globalCompositeOperation = 'source-over';
    }
    redX.globalCompositeOperation = 'destination-in'; redX.drawImage(maskC, 0, 0); redX.globalCompositeOperation = 'source-over';
    ctx.drawImage(redC, 0, 0);
  }

  // ---- holes: cracks (season 2) and space (season 3 finale) ------------------------
  function makeHoles(seed, kind){
    var r = rng(seed*17 + (kind==='space' ? 99 : 3)), holes = [], n = kind==='space' ? 7 : 5;
    for(var i=0; i<n; i++){
      var hx = W*(.05 + r()*.9), hy = H*(.05 + r()*.9), R = (kind==='space' ? 150 : 260) + r()*260, pts = [];
      var sp = kind==='space', m = sp ? 16 + Math.floor(r()*8) : 9 + Math.floor(r()*7);
      for(var j=0; j<m; j++){
        var a = j/m*Math.PI*2 + (r()-.5)*.4, k = sp ? R*(.7 + r()*.35) : R*(.45 + r()*.75);
        pts.push([Math.cos(a)*k*(1.3), Math.sin(a)*k]);
        if(kind==='cracks' && r() < .5){ var a2 = a + .5/m*Math.PI*2; pts.push([Math.cos(a2)*k*.6*1.3, Math.sin(a2)*k*.6]); }
      }
      holes.push({ x:hx, y:hy, pts:pts, at:i/n });
    }
    var lines = [];
    for(var l=0; l<14; l++){
      var x0 = W*r(), y0 = H*r(), seg = [[x0, y0]];
      for(var s2=0; s2<6; s2++){ var last = seg[seg.length-1]; seg.push([last[0] + (r()-.5)*420, last[1] + (r()-.5)*260]); }
      lines.push({ seg:seg, at:r() });
    }
    var stars = [];
    for(var st=0; st<420; st++) stars.push([W*r(), H*r(), r()*2.2 + .4, r()]);
    var streaks = [];
    for(var q=0; q<16; q++) streaks.push({ x:W*r(), y:H*r(), a:-.5 + r()*.25, len:80 + r()*260, at:r() });
    var shards = [];
    for(var sh=0; sh<26; sh++) shards.push({ h:Math.floor(r()*n), a:r()*Math.PI*2, v:300 + r()*700, s:10 + r()*34, spin:(r()-.5)*8, at:r() });
    return { holes:holes, lines:lines, stars:stars, streaks:streaks, shards:shards };
  }
  function holePath(ctx, holes, p){
    ctx.beginPath();
    holes.forEach(function(h){
      var k = ease((p - h.at*.7)/.3);
      if(k <= 0) return;
      h.pts.forEach(function(pt, i){
        var x = h.x + pt[0]*k, y = h.y + pt[1]*k;
        if(i===0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath();
    });
  }
  function drawHoles(ctx, data, kind, p, t){
    var inside = kind==='space' ? mix(S.fg.length===7 ? S.fg : '#8A9395', '#000000', .25) : S.holeFg;
    // cracks in the surface first
    if(kind==='cracks'){
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 2;
      data.lines.forEach(function(l){
        var k = ease((p - l.at*.5)/.5); if(k <= 0) return;
        ctx.beginPath(); ctx.moveTo(l.seg[0][0], l.seg[0][1]);
        var n = Math.max(1, Math.round((l.seg.length-1)*k));
        for(var i=1; i<=n; i++) ctx.lineTo(l.seg[i][0], l.seg[i][1]);
        ctx.stroke();
      });
      ctx.restore();
    }
    ctx.save();
    holePath(ctx, data.holes, p);
    ctx.clip('evenodd');
    if(kind==='space'){
      ctx.fillStyle = '#020306'; ctx.fillRect(0,0,W,H);
      data.stars.forEach(function(s){ ctx.fillStyle = 'rgba(255,255,255,' + (.35 + s[3]*.65) + ')'; ctx.fillRect(s[0], s[1], s[2], s[2]); });
      data.streaks.forEach(function(s){
        var ph = t == null ? .6 : ((t*.35 + s.at) % 1);
        var x = s.x + Math.cos(s.a)*ph*900, y = s.y + Math.sin(s.a)*ph*900;
        var g = ctx.createLinearGradient(x, y, x - Math.cos(s.a)*s.len, y - Math.sin(s.a)*s.len);
        g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,170,90,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(s.a)*s.len, y - Math.sin(s.a)*s.len); ctx.stroke();
      });
    } else {
      ctx.fillStyle = S.holeBg; ctx.fillRect(0,0,W,H);
      if(S.grain && grainOk){ ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .7; ctx.drawImage(grainImg, 0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    }
    drawText(ctx, inside);
    ctx.restore();
    // a thin edge around every hole
    ctx.save();
    holePath(ctx, data.holes, p);
    ctx.strokeStyle = kind==='space' ? 'rgba(40,44,46,.85)' : 'rgba(0,0,0,.55)';
    ctx.lineWidth = kind==='space' ? 9 : 4; ctx.lineJoin = 'miter'; ctx.stroke();
    ctx.restore();
    // flying pieces while it breaks
    if(t != null && kind==='space'){
      data.shards.forEach(function(s){
        var h = data.holes[s.h], st = h.at*.7*durS()*.75 + .5 + s.at*.3, age = t - st;
        if(age < 0 || age > 1.4) return;
        var x = h.x + Math.cos(s.a)*s.v*age, y = h.y + Math.sin(s.a)*s.v*age + 300*age*age;
        ctx.save(); ctx.translate(x, y); ctx.rotate(s.spin*age); ctx.globalAlpha = 1 - age/1.4;
        ctx.fillStyle = S.bg; ctx.strokeStyle = 'rgba(0,0,0,.4)';
        ctx.beginPath(); ctx.moveTo(-s.s, -s.s*.4); ctx.lineTo(s.s*.8, -s.s*.6); ctx.lineTo(s.s*.3, s.s*.7); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      });
    }
  }

  // red paint on top of the title for the Allen look
  function drawSpecial(ctx){
    var sp = S.special; if(!sp) return;
    var p1 = img(sp.paint), p2 = $('alienLine').checked ? img(sp.alien) : null;
    if(p1) ctx.drawImage(p1, 0, 0, W, H);
    if(p2) ctx.drawImage(p2, 0, 0, W, H);
  }

  // ---- glitch (season 3 color split) ------------------------------------------------
  function drawGlitch(ctx, bg, fg, off){
    drawBg(ctx, bg);
    ctx.save(); ctx.globalAlpha = .85;
    drawText(ctx, '#FF5FA8', -off, off*.3);
    drawText(ctx, '#3FF2A0', off, -off*.3);
    ctx.restore();
    drawText(ctx, fg);
  }

  // ---- the whole card ------------------------------------------------------------------
  var cache = {};
  function data(kind){
    var key = kind + ':' + S.seed + ':' + $('title').value + ':' + S.size + ':' + S.bend + ':' + S.ypos + ':' + S.credits;
    if(!cache[key]){ cache = {}; cache[key] = kind==='blood' ? makeBlood(S.seed, letterMask()) : makeHoles(S.seed, kind); }
    return cache[key];
  }
  function durS(){ return parseFloat($('dur').value) || 4; }

  function draw(ctx, t){
    var D = durS(), anim = t != null;
    var p = anim ? clamp((t - .5)/(D*.75 - .5), 0, 1) : 1;   // how far the effect has grown
    ctx.save();
    if(anim && $('punch').checked && t < .3){
      var z = 1 + .06*(1 - ease(t/.3));
      ctx.translate(W/2, H/2); ctx.scale(z, z); ctx.translate(-W/2, -H/2);
    }
    if(S.fx === 'glitch'){
      var bg = S.bg, fg = S.fg, off = 7;
      if(anim){
        var step = Math.floor(t/.42), pr = GLITCH_SEQ[step % GLITCH_SEQ.length];
        if(t > .42){ bg = pr.bg; fg = pr.fg; }
        off = 4 + rng(step*7 + 1)()*14;
      }
      drawGlitch(ctx, bg, fg, off);
    } else {
      drawBg(ctx, S.bg);
      var amt = anim ? 1 + (S.ep - 1)*p : S.ep;
      if(S.fx === 'blood') drawBloodUnder(ctx, amt);
      drawText(ctx, S.fg);
      drawSpecial(ctx);
      if(S.fx === 'blood'){
        var bl = data('blood');
        letterMask();
        drawBloodOver(ctx, bl, amt);
      } else if(S.fx === 'cracks' || S.fx === 'space'){
        drawHoles(ctx, data(S.fx), S.fx, p, anim ? t : null);
      }
    }
    ctx.restore();
  }

  // ---- buttons -----------------------------------------------------------------------------
  // turns the save buttons off while a GIF or video is being made
  function syncButtons(){
    ['savePng','gif','record','copy','play'].forEach(function(id){ $(id).disabled = busy; });
    return false;
  }

  // ---- drawing on screen -----------------------------------------------------------------
  var raf = 0, playing = null, busy = false;
  function redraw(){
    if(playing) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function(){ draw(cx, null); syncButtons(); });
  }

  // ---- sound (made in the browser, no files) ----------------------------------------------
  var AC = null, recDest = null;
  function audio(){
    if(!AC){ try{ AC = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ return null; } }
    if(AC.state === 'suspended') AC.resume();
    return AC;
  }
  function outNode(){ var a = AC, g = a.createGain(); g.connect(a.destination); if(recDest) g.connect(recDest); return g; }
  // a big dramatic hit for when the card cuts in: low boom, a brass-like
  // chord stab and a bit of room echo. made here, no sound files
  var verb = null;
  function room(){
    var a = AC; if(verb) return verb;
    var n = Math.floor(a.sampleRate*2.2), ir = a.createBuffer(2, n, a.sampleRate);
    for(var c=0; c<2; c++){ var d = ir.getChannelData(c); for(var i=0; i<n; i++) d[i] = (Math.random()*2 - 1)*Math.pow(1 - i/n, 3.2); }
    var cv = a.createConvolver(); cv.buffer = ir;
    var wet = a.createGain(); wet.gain.value = .35;
    cv.connect(wet); wet.connect(a.destination);
    verb = { input:cv, wet:wet };
    return verb;
  }
  function boom(at){
    var a = audio(); if(!a || !$('sound').checked) return;
    var out = outNode(), r = room();
    if(recDest){ try{ r.wet.connect(recDest); }catch(e){} }
    // sub boom
    var o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(120, at); o.frequency.exponentialRampToValueAtTime(36, at + .6);
    g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(1, at + .008); g.gain.exponentialRampToValueAtTime(.0001, at + 1.4);
    o.connect(g); g.connect(out); o.start(at); o.stop(at + 1.5);
    // brass stab: a low minor chord of detuned saws through a closing filter
    var f = a.createBiquadFilter(), sg = a.createGain();
    f.type = 'lowpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(3200, at); f.frequency.exponentialRampToValueAtTime(420, at + 1.2);
    sg.gain.setValueAtTime(.0001, at); sg.gain.exponentialRampToValueAtTime(.32, at + .02); sg.gain.exponentialRampToValueAtTime(.0001, at + 1.6);
    f.connect(sg); sg.connect(out); sg.connect(r.input);
    [55, 65.41, 82.41, 110, 130.81, 164.81].forEach(function(hz, i){
      [-6, 6].forEach(function(det){
        var so = a.createOscillator(); so.type = 'sawtooth'; so.frequency.value = hz; so.detune.value = det + i;
        so.connect(f); so.start(at); so.stop(at + 1.7);
      });
    });
    noise(at, .22, 2600, .45);
  }
  function noise(at, len, freq, vol){
    var a = audio(); if(!a || !$('sound').checked) return;
    var n = Math.floor(a.sampleRate*len), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for(var i=0; i<n; i++) d[i] = (Math.random()*2 - 1)*Math.pow(1 - i/n, 2.2);
    var src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(outNode()); src.start(at);
  }
  function blip(at, hz){
    var a = audio(); if(!a || !$('sound').checked) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = 'square'; o.frequency.value = hz;
    g.gain.setValueAtTime(.06, at); g.gain.exponentialRampToValueAtTime(.0001, at + .12);
    o.connect(g); g.connect(outNode()); o.start(at); o.stop(at + .13);
  }
  function scheduleSounds(){
    var a = audio(); if(!a) return;
    var t0 = a.currentTime + .03, D = durS();
    boom(t0);
    if(S.fx === 'blood'){
      for(var e=2; e<=S.ep; e++){ var at = .5 + (D*.75 - .5)*(e-1)/(S.ep-1); noise(t0 + at, .25, 900, .55); }
    } else if(S.fx === 'cracks' || S.fx === 'space'){
      var hs = data(S.fx).holes;
      hs.forEach(function(h){ noise(t0 + .5 + (D*.75 - .5)*h.at*.7, S.fx==='space' ? .6 : .35, S.fx==='space' ? 600 : 3500, .5); });
    } else if(S.fx === 'glitch'){
      for(var s=1; s*.42 < D; s++) blip(t0 + s*.42, 180 + (s*137 % 500));
    }
  }

  // ---- play -------------------------------------------------------------------------------
  function play(onFrame){
    return new Promise(function(done){
      var D = durS(), start = performance.now();
      cancelAnimationFrame(raf);
      playing = true;
      (function frame(){
        var t = (performance.now() - start)/1000;
        draw(cx, Math.min(t, D));
        if(onFrame) onFrame(t);
        if(t < D) requestAnimationFrame(frame);
        else { playing = null; done(); }
      })();
    });
  }
  $('play').addEventListener('click', function(){
    if(playing || syncButtons()) return;
    scheduleSounds(); play().then(redraw);
  });

  // ---- saving -----------------------------------------------------------------------------
  function fileName(ext){
    var base = titleLines().join(' ').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40) || 'title-card';
    return 'invincibler-' + base + '.' + ext;
  }
  function saveBlob(blob, name){
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
  }
  function finalBlob(){
    return new Promise(function(res){ var c = canvas(W, H); draw(c.getContext('2d'), null); c.toBlob(res, 'image/png'); });
  }
  $('savePng').addEventListener('click', function(){
    if(syncButtons()) return;
    finalBlob().then(function(b){ saveBlob(b, fileName('png')); say('PNG saved.'); });
  });
  $('copy').addEventListener('click', function(){
    if(syncButtons()) return;
    if(!navigator.clipboard || !window.ClipboardItem){ say('Copy is not available in this browser. Use Save PNG.'); return; }
    navigator.clipboard.write([new ClipboardItem({ 'image/png': finalBlob() })])
      .then(function(){ say('Copied! paste it anywhere.'); })
      .catch(function(){ say('Copy did not work here. Use Save PNG.'); });
  });

  function tick(){ return new Promise(function(r){ setTimeout(r, 0); }); }
  function setBusy(b){ busy = b; syncButtons(); $('random').disabled = b; }
  $('gif').addEventListener('click', async function(){
    if(busy || syncButtons()) return;
    setBusy(true);
    try{
      var gw = parseInt($('gifW').value, 10), gh = Math.round(gw*9/16), fps = 15, D = durS();
      var n = Math.round(D*fps) + 1, big = canvas(W, H), bx = big.getContext('2d'), small = canvas(gw, gh), sx = small.getContext('2d'), frames = [];
      for(var i=0; i<n; i++){
        draw(bx, Math.min(i/fps, D));
        sx.drawImage(big, 0, 0, gw, gh);
        frames.push(sx.getImageData(0, 0, gw, gh).data);
        if(i % 3 === 0){ say('Making GIF… ' + Math.round(i/n*80) + '%'); await tick(); }
      }
      // hold the last frame for a second before it loops
      for(var h=0; h<fps; h++) frames.push(frames[frames.length-1]);
      say('Making GIF… 90%'); await tick();
      var bytes = window.encodeGif(frames, gw, gh, Math.round(100/fps));
      var blob = new Blob([bytes], { type:'image/gif' });
      saveBlob(blob, fileName('gif'));
      say('GIF saved (' + Math.round(blob.size/1024) + ' KB).');
    }catch(e){ say('The GIF could not be made. Try a smaller size.'); }
    setBusy(false); redraw();
  });

  $('record').addEventListener('click', function(){
    if(busy || syncButtons()) return;
    if(!card.captureStream || !window.MediaRecorder){ say('This browser cannot record video. Try Chrome or Firefox, or save a GIF.'); return; }
    var types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    var type = types.filter(function(t){ return MediaRecorder.isTypeSupported(t); })[0] || '';
    var stream = card.captureStream(30), a = audio();
    if(a && $('sound').checked){
      recDest = a.createMediaStreamDestination();
      recDest.stream.getAudioTracks().forEach(function(tr){ stream.addTrack(tr); });
    }
    var chunks = [], rec;
    try{ rec = new MediaRecorder(stream, type ? { mimeType:type, videoBitsPerSecond:8e6 } : undefined); }
    catch(e){ say('Recording failed to start in this browser.'); recDest = null; return; }
    rec.ondataavailable = function(e){ if(e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = function(){
      var mt = rec.mimeType || type || 'video/webm', ext = mt.indexOf('mp4') > -1 ? 'mp4' : 'webm';
      saveBlob(new Blob(chunks, { type:mt }), fileName(ext));
      say('Video saved (' + ext + ').'); recDest = null;
      $('record').classList.remove('rec'); setBusy(false); redraw();
    };
    setBusy(true); $('record').classList.add('rec'); say('Recording…');
    draw(cx, 0);
    rec.start();
    setTimeout(function(){
      scheduleSounds();
      play().then(function(){ setTimeout(function(){ rec.stop(); }, 700); });
    }, 120);
  });

  // ---- controls -----------------------------------------------------------------------------
  function selPreset(id){
    var name = 'Your own colors';
    Array.prototype.forEach.call($('presets').children, function(b){
      var on = b.getAttribute('data-id') === id; b.classList.toggle('sel', on);
      if(on){ name = b.textContent; var st = $('presets'); st.scrollLeft = Math.max(0, b.offsetLeft - st.offsetLeft - 8); }
    });
    $('lookName').textContent = name;
  }
  function syncArrows(){
    var st = $('presets'), max = st.scrollWidth - st.clientWidth;
    $('lookPrev').disabled = st.scrollLeft <= 4; $('lookNext').disabled = st.scrollLeft >= max - 4;
  }
  $('presets').addEventListener('scroll', syncArrows);
  $('lookPrev').addEventListener('click', function(){ var st = $('presets'); st.scrollLeft -= st.clientWidth*.85; });
  $('lookNext').addEventListener('click', function(){ var st = $('presets'); st.scrollLeft += st.clientWidth*.85; });
  window.addEventListener('resize', syncArrows);
  function setFx(fx){
    S.fx = fx;
    Array.prototype.forEach.call($('fx').children, function(b){ b.classList.toggle('sel', b.getAttribute('data-fx') === fx); });
    Array.prototype.forEach.call(document.querySelectorAll('.fxbox'), function(b){ b.hidden = b.getAttribute('data-for') !== fx; });
  }
  function applyPreset(p){
    S.preset = p.id; S.bg = p.bg; S.fg = p.fg;
    $('bg').value = p.bg; $('fg').value = p.fg;
    S.grain = p.grain !== false; $('grain').checked = S.grain;
    setFx(p.fx || 'none'); if(S.fx === 'blood') preloadBlood();
    if(p.ep) setEp(p.ep);
    // special looks bring their own size and spot, normal ones go back to the default
    var was = S.special;
    S.special = p.img ? p : null;
    $('allenBox').hidden = !S.special;
    if(S.special || was){
      setRange('size', p.size || 22); setRange('ypos', p.ypos || 22.5); setRange('bend', p.bend || 10);
      S.sx = p.sx || 1;
      var t = $('title').value.trim().toUpperCase();
      if(p.title && (t === 'THINK MARK!' || !t)) $('title').value = p.title;
      else if(!p.title && was && t === (was.title || '')) $('title').value = 'THINK MARK!';
      drawThumbs();
    }
    if(S.special){ img(p.img); img(p.paint); img(p.alien); }
    selPreset(p.id); redraw();
  }
  // little previews use your own title, so you see what you get
  var thumbs = [];
  function buildPresets(){
    PRESETS.forEach(function(p){
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'preset'; b.setAttribute('data-id', p.id);
      var c = canvas(320, 180), sp = document.createElement('span'); sp.textContent = p.name;
      b.appendChild(c); b.appendChild(sp);
      b.addEventListener('click', function(){ applyPreset(p); });
      $('presets').appendChild(b); thumbs.push({ p:p, c:c });
    });
    selPreset(S.preset); setTimeout(syncArrows, 50);
  }
  var thumbT = 0;
  function drawThumbs(){
    clearTimeout(thumbT);
    thumbT = setTimeout(function(){
      thumbs.forEach(function(th){
        var x = th.c.getContext('2d');
        x.fillStyle = th.p.bg; x.fillRect(0,0,320,180);
        var bi = img(th.p.img); if(bi) x.drawImage(bi, 0, 0, 320, 180);
        TitleCard.draw(x, titleLines(), { cx:160, top:th.p.img ? 26 : 42, cap:64, maxW:290, color:th.p.fg, sx:th.p.sx || 1 });
        [th.p.paint, th.p.alien].forEach(function(src){ var o = img(src); if(o) x.drawImage(o, 0, 0, 320, 180); });
      });
    }, 150);
  }
  function setRange(id, v){ $(id).value = v; $(id).dispatchEvent(new Event('input')); }
  function setEp(n){
    S.ep = n; $('epV').textContent = 'EP. ' + n;
    Array.prototype.forEach.call($('eps').children, function(b){ b.classList.toggle('sel', +b.textContent === n); });
  }
  for(var e=1; e<=8; e++){
    (function(n){
      var b = document.createElement('button'); b.type = 'button'; b.textContent = n;
      b.addEventListener('click', function(){ setEp(n); if(S.fx !== 'blood') setFx('blood'); preloadBlood(); redraw(); });
      $('eps').appendChild(b);
    })(e);
  }
  $('fx').addEventListener('click', function(ev){
    var b = ev.target.closest('button'); if(!b) return;
    setFx(b.getAttribute('data-fx')); if(S.fx === 'blood') preloadBlood(); redraw();
  });
  [['fg','fg'],['bg','bg'],['ink','ink'],['blood','blood'],['holeBg','holeBg'],['holeFg','holeFg']].forEach(function(p){
    $(p[0]).addEventListener('input', function(){ S[p[1]] = this.value; if(p[0]==='fg' || p[0]==='bg') selPreset(''); redraw(); });
  });
  $('grain').addEventListener('change', function(){ S.grain = this.checked; redraw(); });
  $('alienLine').addEventListener('change', redraw);
  $('credits').addEventListener('change', function(){ S.credits = this.checked; $('creditsBox').hidden = !this.checked; redraw(); });
  [['size','sizeV',''],['bend','bendV',''],['ypos','yposV',''],['dur','durV','s']].forEach(function(p){
    var el = $(p[0]);
    function upd(){ $(p[1]).textContent = el.value + p[2]; if(p[0] !== 'dur') S[p[0]] = parseFloat(el.value); redraw(); }
    el.addEventListener('input', upd); upd();
  });
  ['title','cred1','cred2'].forEach(function(id){
    $(id).addEventListener('input', function(){ redraw(); if(id === 'title') drawThumbs(); });
  });
  $('reseed').addEventListener('click', function(){ S.seed = Math.floor(Math.random()*1e6); redraw(); });
  $('random').addEventListener('click', function(){
    var p = PRESETS[Math.floor(Math.random()*PRESETS.length)];
    applyPreset(p);
    if(p.fx === 'none' && Math.random() < .5) setFx(['blood','cracks','space','glitch'][Math.floor(Math.random()*4)]);
    if(S.fx === 'blood') setEp(1 + Math.floor(Math.random()*8));
    S.seed = Math.floor(Math.random()*1e6); redraw();
  });

  // ---- header logo -------------------------------------------------------------------------
  function drawLogo(){
    var l = $('logo'), x = l.getContext('2d');
    x.clearRect(0,0,l.width,l.height);
    TitleCard.draw(x, ['INVINCIBLER'], { cx:l.width/2, top:14, cap:112, maxW:l.width*.96, color:'#FAE800' });
  }

  buildPresets(); setEp(4); setFx('none'); drawLogo(); drawThumbs(); redraw();
  if(document.fonts && document.fonts.load) document.fonts.load('500 40px Jost').then(redraw, function(){});
  // test hook: lets an automatic check draw any moment of the animation
  window.__invincibler = { draw:function(t){ draw(cx, t); }, S:S, setFx:setFx, applyPreset:function(id){ applyPreset(PRESETS.filter(function(p){ return p.id===id; })[0]); }, setEp:setEp };
})();
