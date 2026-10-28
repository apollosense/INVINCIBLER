/* INVINCIBLER - filter.js
   the same word check as the Megumi text generator. if the title or the credits
   have a slur or explicit word in them, the card gets blurred and nothing can be
   saved, copied or recorded. */
(function(){
  // ---- word check -----------------------------------------------------------
  // whole words that are blocked
  // "fuck" and "shit" (and their spellings) are allowed on purpose, everything else here breaks the screen
  var WORDS = ('cunt dick dickhead cock cocks ' +
    'pussy pussies asshole assholes arsehole whore slut sluts porn porno pornhub xxx sex sexy nude nudes naked boobs boob tits titties ' +
    'penis vagina cum cumming jizz blowjob handjob dildo horny rape rapist nigga niggas niggaz nigger niggers faggot faggots fag fags retard ' +
    'amk aq orospu siktir sik sikik sikiş yarrak yarak göt götveren piç amcık oç ananı ' +
    'сука суки бля блять блядь хуй хуйня пизда пиздец нахуй ебать ебал ебаный шлюха').split(/\s+/);
  // anything that starts with these is blocked too (fuckface, pornhub, ...)
  var STEMS = ['cunt','porn','whore','slut','dildo','blowj','handj','orospu','siktir','siker','sikey','sikim','yarra','amcı','amına','amina','хуй','пизд','ебан','ебат','бля'];

  // stretched words: 3 or more of the same letter in a row. "cuuunt" -> "cunt"
  // and "boooobs" -> "boobs". normal double letters (poorness, sikkim) are left alone
  function squash(s){ return s.replace(/(.)\1{2,}/g, '$1'); }
  function squash2(s){ return s.replace(/(.)\1{2,}/g, '$1$1'); }
  function leet(s){ return s.replace(/[0@4$5!1|3€7]/g, function(c){ return {'0':'o','@':'a','4':'a','$':'s','5':'s','!':'i','1':'i','|':'i','3':'e','€':'e','7':'t'}[c]; }); }
  var WORDSET = Object.create(null);   // plain {} would think "constructor" is a bad word
  WORDS.forEach(function(w){ if(w) WORDSET[w] = 1; });

  function tokens(text){
    var t = leet(String(text).toLowerCase());
    var raw = t.split(/[^a-zа-яёçğıöşü]+/i).filter(Boolean);
    // glue spaced-out letters back together: "f u c k" -> "fuck"
    var out = [], run = '';
    raw.forEach(function(w){ if(w.length === 1){ run += w; } else { if(run){ out.push(run); run=''; } out.push(w); } });
    if(run) out.push(run);
    return out;
  }
  // while a word is still being typed only the STEMS count, because whole words
  // like "dick", "cum" or "nude" are also the start of normal words (dickens,
  // cumulative, nudge). whole words count once you finish them with a space,
  // punctuation, or by leaving the box
  function bad(w, typing){
    var s = squash(w), s2 = squash2(w);
    for(var i=0;i<STEMS.length;i++){
      var st = STEMS[i];
      if(w.indexOf(st) === 0 || s.indexOf(st) === 0 || s2.indexOf(st) === 0) return true;
    }
    if(typing) return false;
    return !!(WORDSET[w] || WORDSET[s] || WORDSET[s2]);
  }
  // tricks people use to sneak words past: a lowercase L instead of a capital I
  // (looks the same in capitals), look-alike letters from other alphabets,
  // full-width letters, invisible characters and accent marks. every message is
  // checked as written and also with those undone
  var LOOKALIKE = { 'а':'a','е':'e','о':'o','р':'p','с':'c','у':'y','х':'x','к':'k','м':'m','т':'t','н':'h','в':'b',
    'і':'i','ї':'i','ј':'j','ѕ':'s','ԁ':'d','ɡ':'g','ı':'i','ο':'o','α':'a','ι':'i','ν':'v','κ':'k','ρ':'p','τ':'t','ε':'e','υ':'u' };
  function clean(text){
    return String(text).normalize('NFKC').replace(/[\u200B-\u200F\u2060\uFEFF\u00AD]/g, '');
  }
  function lookalikes(t){ return t.replace(/[\u0400-\u04FF\u0370-\u03FFɡı]/g, function(c){ return LOOKALIKE[c] || c; }); }
  function noAccents(t){ return t.normalize('NFKD').replace(/[\u0300-\u036f\u0489\u20d0-\u20ff]/g, ''); }
  function variants(text){
    var t = clean(text).toLowerCase(), out = [t], add = function(v){ if(out.indexOf(v) < 0) out.push(v); };
    add(noAccents(t)); add(lookalikes(t)); add(lookalikes(noAccents(t)));
    out.slice().forEach(function(v){ add(v.replace(/l/g, 'i')); });
    return out;
  }
  // live = the person is still typing, so the last word may not be finished yet
  window.megumiIsExplicit = function(text, live){
    var stillTyping = live && /[a-zа-яёçğıöşü0-9@$|!€]$/i.test(String(text));
    return variants(text).some(function(v){
      var tk = tokens(v), last = tk.length - 1;
      return tk.some(function(w, i){ return bad(w, stillTyping && i === last); });
    });
  };

})();
