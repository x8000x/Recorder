(function(){

  /* ============ Self-contained SHA-256 (no external libraries, works fully offline) ============ */
  function sha256(ascii) {
    function rightRotate(value, amount) {
      return (value>>>amount) | (value<<(32 - amount));
    }
    var mathPow = Math.pow;
    var maxWord = mathPow(2, 32);
    var i, j;
    var result = '';

    var words = [];
    var asciiBitLength = ascii.length*8;

    var hash = sha256.h = sha256.h || [];
    var k = sha256.k = sha256.k || [];
    var primeCounter = k.length;

    var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (mathPow(candidate, .5)*maxWord)|0;
        k[primeCounter++] = (mathPow(candidate, 1/3)*maxWord)|0;
      }
    }

    ascii += '\x80';
    while (ascii.length%64 - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) {
      j = ascii.charCodeAt(i);
      if (j>>8) return null; // ASCII only
      words[i>>2] |= j << ((3 - i)%4)*8;
    }
    words[words.length] = ((asciiBitLength/maxWord)|0);
    words[words.length] = (asciiBitLength);

    for (j = 0; j < words.length;) {
      var w = words.slice(j, j += 16);
      var oldHash = hash;
      hash = hash.slice(0, 8);

      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2];
        var a = hash[0], e = hash[4];
        var temp1 = hash[7]
          + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
          + ((e&hash[5])^((~e)&hash[6]))
          + k[i]
          + (w[i] = (i < 16) ? w[i] : (
              w[i - 16]
              + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15>>>3))
              + w[i - 7]
              + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2>>>10))
            )|0
          );
        var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
          + ((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]));

        hash = [(temp1 + temp2)|0].concat(hash);
        hash[4] = (hash[4] + temp1)|0;
      }

      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i])|0;
    }

    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        var b = (hash[i]>>(j*8))&255;
        result += ((b < 16) ? 0 : '') + b.toString(16);
      }
    }
    return result;
  }

  // Hardcoded, hashed credential — the plaintext password is never stored in the code.
  // This hash decodes/verifies entirely client-side; it is a UI gate, not real security.
  var CREDENTIAL_HASH = "8faf47a77b54e1a4c39e617d9894ac8f349fb06c0c67fc81954dd338a3036cb8";

  /* ============ UI sound effects (synthesized, no audio files needed) ============ */
  var audioCtx = null;
  function getAudioCtx(){
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playClickSound(){
    try {
      var ctx = getAudioCtx();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1100, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch (e) { /* synth sound unsupported/blocked — safe to ignore */ }
  }

  // A whirring "tape winding up" sound, played while the reels spin up before playback.
  var windNodes = null;
  function startWindSound(durationSec){
    try {
      var ctx = getAudioCtx();
      var bufferSize = Math.floor(ctx.sampleRate * durationSec);
      var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);

      var noise = ctx.createBufferSource();
      noise.buffer = buffer;

      var bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 1000;
      bandpass.Q.value = 5;

      var lfo = ctx.createOscillator();
      lfo.frequency.value = 7;
      var lfoGain = ctx.createGain();
      lfoGain.gain.value = 350;
      lfo.connect(lfoGain);
      lfoGain.connect(bandpass.frequency);

      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime + durationSec - 0.25);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + durationSec);

      noise.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
      lfo.start();
      noise.stop(ctx.currentTime + durationSec);
      lfo.stop(ctx.currentTime + durationSec);

      windNodes = { noise: noise, lfo: lfo, gain: gain };
    } catch (e) { /* synth sound unsupported/blocked — the timer below still fires */ }
  }
  function stopWindSound(){
    if (!windNodes) return;
    var ctx = getAudioCtx();
    try {
      windNodes.gain.gain.cancelScheduledValues(ctx.currentTime);
      windNodes.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08);
      windNodes.noise.stop(ctx.currentTime + 0.1);
      windNodes.lfo.stop(ctx.currentTime + 0.1);
    } catch (e) { /* already stopped */ }
    windNodes = null;
  }

  // Attach a click sound to every button in the UI.
  document.querySelectorAll('button').forEach(function(btn){
    btn.addEventListener('click', playClickSound);
  });

  /* ============ Login logic ============ */
  var loginView = document.getElementById('loginView');
  var recorderView = document.getElementById('recorderView');
  var pwInput = document.getElementById('pwInput');
  var unlockBtn = document.getElementById('unlockBtn');
  var loginError = document.getElementById('loginError');
  var lockPlate = document.getElementById('lockPlate');

  function attemptUnlock(){
    var val = pwInput.value || '';
    var hashed = sha256(val);
    if (hashed && hashed === CREDENTIAL_HASH) {
      loginError.hidden = true;
      loginView.hidden = true;
      recorderView.hidden = false;
      pwInput.value = '';
    } else {
      loginError.hidden = false;
      lockPlate.classList.remove('shake');
      void lockPlate.offsetWidth; // restart animation
      lockPlate.classList.add('shake');
      pwInput.value = '';
      pwInput.focus();
    }
  }

  unlockBtn.addEventListener('click', attemptUnlock);
  pwInput.addEventListener('keydown', function(e){
    if (e.key === 'Enter') attemptUnlock();
  });

  document.getElementById('logoutBtn').addEventListener('click', function(){
    recorderView.hidden = true;
    loginView.hidden = false;
    pwInput.focus();
  });

  /* ============================================================
     ADD YOUR OWN AUDIO FILES HERE.
     Put your audio files next to index.html (e.g. in a folder
     named "audio"), then list each file's path below. Slots are
     numbered 1–15; leave a slot as "" (empty string) if you
     don't have a file for it yet.

     Example:
       1: "audio/1.mp3",
       2: "audio/2.mp3",
     ============================================================ */
  var TRACKS = {
    1:  "",
    2:  "",
    3:  "",
    4:  "",
    5:  "",
    6:  "",
    7:  "",
    8:  "",
    9:  "",
    10: "",
    11: "",
    12: "",
    13: "",
    14: "",
    15: ""
  };

  /* ============ Recorder logic ============ */
  var playBtn = document.getElementById('playBtn');
  var stopBtn = document.getElementById('stopBtn');
  var lcd = document.getElementById('lcdReadout');
  var reelLeft = document.getElementById('reelLeft');
  var reelRight = document.getElementById('reelRight');
  var player = document.getElementById('player');
  var windTimeout = null;
  var isBusy = false; // true while winding up or playing

  var WIND_UP_MS = 3000; // delay before playback so the "spinning up" sound/animation can play

  function setSpinning(on){
    reelLeft.classList.toggle('spinning', on);
    reelRight.classList.toggle('spinning', on);
  }

  function setBusy(on){
    isBusy = on;
    playBtn.disabled = on;
    playBtn.style.opacity = on ? '0.6' : '1';
    playBtn.style.cursor = on ? 'default' : 'pointer';
  }

  function stopPlayback(resetLcd){
    if (windTimeout) { clearTimeout(windTimeout); windTimeout = null; }
    stopWindSound();
    player.pause();
    player.currentTime = 0;
    setSpinning(false);
    setBusy(false);
    if (resetLcd !== false) lcd.textContent = 'STANDBY';
  }

  playBtn.addEventListener('click', function(){
    if (isBusy) return;
    var available = Object.keys(TRACKS).filter(function(n){ return !!TRACKS[n]; }).map(Number);
    if (available.length === 0) {
      lcd.textContent = 'NO TAPES LOADED';
      return;
    }
    var pick = available[Math.floor(Math.random() * available.length)];

    setBusy(true);
    setSpinning(true);
    lcd.textContent = 'REWINDING…';
    startWindSound(WIND_UP_MS / 1000);

    windTimeout = setTimeout(function(){
      windTimeout = null;
      player.src = TRACKS[pick];
      player.play().catch(function(){
        lcd.textContent = 'TAP ▶ AGAIN TO PLAY';
        setBusy(false);
      });
      lcd.textContent = 'TRACK ' + (pick < 10 ? '0' + pick : pick) + ' ▶ PLAYING';
    }, WIND_UP_MS);
  });

  stopBtn.addEventListener('click', function(){ stopPlayback(true); });

  player.addEventListener('ended', function(){ stopPlayback(true); });
  player.addEventListener('error', function(){
    if (player.src) {
      stopPlayback(false);
      lcd.textContent = 'TAPE ERROR — CHECK FILE PATH';
    }
  });

})();
