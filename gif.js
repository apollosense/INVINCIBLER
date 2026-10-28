/* INVINCIBLER - gif.js
   a small GIF maker with no libraries. every frame gets its own 256 colours,
   so the colour changing looks stay clean. */
(function(){
  function gifPalette(frames, npx){
    var hist = new Uint32Array(32768), f, i, d, total = 0;
    for(f=0; f<frames.length; f++){
      d = frames[f];
      for(i=0; i<npx*4; i+=4) hist[((d[i]>>3)<<10)|((d[i+1]>>3)<<5)|(d[i+2]>>3)]++;
    }
    var keys = [];
    for(i=0; i<32768; i++) if(hist[i]){ keys.push(i); total += hist[i]; }
    function ch(k,c){ return c===0 ? k>>10 : (c===1 ? (k>>5)&31 : k&31); }
    function mk(k){
      var pop = 0, mn=[31,31,31], mx=[0,0,0], j, c, v;
      for(j=0; j<k.length; j++){
        pop += hist[k[j]];
        for(c=0; c<3; c++){ v = ch(k[j],c); if(v<mn[c]) mn[c]=v; if(v>mx[c]) mx[c]=v; }
      }
      var r = [mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]];
      var axis = r[0]>=r[1] && r[0]>=r[2] ? 0 : (r[1]>=r[2] ? 1 : 2);
      return { k:k, pop:pop, axis:axis, score:(k.length>1 ? pop*(r[axis]+1) : -1) };
    }
    var boxes = [mk(keys)];
    while(boxes.length < 256){
      var bi = -1, bs = 0, j;
      for(j=0; j<boxes.length; j++) if(boxes[j].score > bs){ bs = boxes[j].score; bi = j; }
      if(bi < 0) break;
      var b = boxes[bi], ax = b.axis;
      b.k.sort(function(a,z){ return ch(a,ax)-ch(z,ax); });
      var half = b.pop/2, acc = 0, cut = 1;
      for(j=0; j<b.k.length-1; j++){ acc += hist[b.k[j]]; cut = j+1; if(acc >= half) break; }
      boxes.splice(bi, 1, mk(b.k.slice(0,cut)), mk(b.k.slice(cut)));
    }
    var pal = new Uint8Array(768), map = new Uint8Array(32768);
    boxes.forEach(function(bx, idx){
      var r=0, g=0, bl=0, n=0, j, p, k;
      for(j=0; j<bx.k.length; j++){
        k = bx.k[j]; p = hist[k]; n += p;
        r += (k>>10)*p; g += ((k>>5)&31)*p; bl += (k&31)*p;
        map[k] = idx;
      }
      pal[idx*3]   = Math.round(r/n*255/31);
      pal[idx*3+1] = Math.round(g/n*255/31);
      pal[idx*3+2] = Math.round(bl/n*255/31);
    });
    return { pal:pal, map:map };
  }

  function gifLZW(idx, out){
    var MIN = 8, CLEAR = 256, EOI = 257;
    var next = EOI+1, size = MIN+1, table = new Map();
    var cur = 0, shift = 0, bytes = [], i;
    function put(code){
      cur |= code << shift; shift += size;
      while(shift >= 8){ bytes.push(cur & 255); cur >>>= 8; shift -= 8; }
    }
    put(CLEAR);
    var prefix = idx[0];
    for(i=1; i<idx.length; i++){
      var k = idx[i], key = (prefix<<8)|k, code = table.get(key);
      if(code === undefined){
        put(prefix);
        if(next === 4096){
          put(CLEAR);
          next = EOI+1; size = MIN+1; table = new Map();
        } else {
          if(next >= (1<<size)) size++;
          table.set(key, next++);
        }
        prefix = k;
      } else prefix = code;
    }
    put(prefix);
    put(EOI);
    if(shift > 0) bytes.push(cur & 255);
    out.push(MIN);
    for(i=0; i<bytes.length; i+=255){
      var n = Math.min(255, bytes.length-i);
      out.push(n);
      for(var j=0; j<n; j++) out.push(bytes[i+j]);
    }
    out.push(0);
  }

  function encodeGif(frames, w, h, delay){
    var npx = w*h, out = [], f, i, q;
    function u16(v){ out.push(v & 255, (v>>8) & 255); }
    out.push(71,73,70,56,57,97);
    u16(w); u16(h); out.push(0x70, 0, 0);
    out.push(0x21,0xFF,0x0B);
    "NETSCAPE2.0".split('').forEach(function(c){ out.push(c.charCodeAt(0)); });
    out.push(3,1,0,0,0);
    for(f=0; f<frames.length; f++){
      var d = frames[f], idx = new Uint8Array(npx);
      q = gifPalette([d], npx);
      for(i=0; i<npx; i++){
        var p = i*4;
        idx[i] = q.map[((d[p]>>3)<<10)|((d[p+1]>>3)<<5)|(d[p+2]>>3)];
      }
      out.push(0x21,0xF9,4,0x04); u16(delay); out.push(0,0);
      out.push(0x2C); u16(0); u16(0); u16(w); u16(h); out.push(0x87);
      for(i=0; i<768; i++) out.push(q.pal[i]);
      gifLZW(idx, out);
    }
    out.push(0x3B);
    return new Uint8Array(out);
  }

  window.encodeGif = encodeGif;
})();
