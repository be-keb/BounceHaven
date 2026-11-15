"use strict";
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const SCREEN_W = 1280, SCREEN_H = 720;
const playerImg = new Image(); playerImg.src = "assets/sprite.png";
const platformImg = new Image(); platformImg.src = "assets/platform.png";

function imageReady(img) { return img.complete && img.naturalWidth > 0; }

const PLAYER_SIZE = 150;
const GRAVITY = 1000;
const PLAYER_SPEED = 320;
const PLATFORM_H = 40;

const DIFFICULTIES = {
  Easy:   { gap: 250, width: 160, heightChange: [-60, 40] },
  Medium: { gap: 300, width: 140, heightChange: [-50, 60] },
  Hard:   { gap: 350, width: 120, heightChange: [-70, 80] },
};

let state = "menu";
let difficulty = "Easy";
let platforms = [];
let platformId = 1;
let playerX = 0, playerY = 0, velocityY = 0, onGround = false;
let cameraX = 0;
let score = 0;
let scoredPlatforms = new Set();

let audioCtx = null, analyser = null, micStream = null;
let floatBuf = null;
let smoothedVoice = 0;
// THE MICROPHONE SHI (I DON UNDERSTAND ANY OF THE MICROPHONE RELATED SHI)
async function initMic() {
  if (audioCtx) return;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    floatBuf = new Float32Array(analyser.fftSize);
  } catch (e) {
    alert("Microphone access is required to play! Please refresh and allow it.");
  }
}

function readVoice(dt) {
  let rms = 0;
  if (analyser && floatBuf) {
    analyser.getFloatTimeDomainData(floatBuf);
    let sum = 0;
    for (let i = 0; i < floatBuf.length; i++) sum += floatBuf[i] * floatBuf[i];
    rms = Math.sqrt(sum / floatBuf.length);
  }
  let target = Math.max(0, Math.min(1, (rms - 0.005) / 0.1));
  smoothedVoice += (target - smoothedVoice) * (dt * 15);
}

function startGame(diff) {
  difficulty = diff;
  document.getElementById('main-menu').style.display = 'none';
  document.getElementById('left').style.display = 'none';
  document.getElementById('right').style.display = 'none';
  canvas.style.display = 'block';
  initMic(); 
  
  platforms = [];
  platformId = 1;
  score = 0;
  scoredPlatforms.clear();
  
  const startPlat = { x: 60, y: 540, w: DIFFICULTIES[diff].width, baseY: 540, id: platformId++ };
  platforms.push(startPlat);
  
  playerX = startPlat.x + startPlat.w / 2 - PLAYER_SIZE / 2;
  playerY = startPlat.y - PLAYER_SIZE;
  velocityY = 0;
  onGround = true;
  cameraX = 0;
  
  state = "playing";
  requestAnimationFrame(loop);
}

function generatePlatforms() {
  const s = DIFFICULTIES[difficulty];
  let lastP = platforms[platforms.length - 1];
  
  while (lastP.x + lastP.w < cameraX + SCREEN_W + 800) {
    let newBaseY = lastP.baseY + (Math.random() * (s.heightChange[1] - s.heightChange[0]) + s.heightChange[0]);
    newBaseY = Math.max(250, Math.min(550, newBaseY)); 
    
    const newPlat = {
      x: lastP.x + lastP.w + s.gap,
      y: newBaseY,
      w: s.width,
      baseY: newBaseY,
      id: platformId++
    };
    platforms.push(newPlat);
    lastP = newPlat;
  }
  
  if (platforms.length > 50) {
    platforms = platforms.filter(p => p.x + p.w > cameraX - 500);
  }
}
function update(dt) {
  readVoice(dt);

  if (smoothedVoice > 0.15 && onGround) {
    const jumpForce = 500 + (smoothedVoice * 600); 
    velocityY = -jumpForce;
    onGround = false;
  }

  velocityY += GRAVITY * dt;
  playerY += velocityY * dt;
  playerX += PLAYER_SPEED * dt;
  cameraX = Math.max(0, playerX - SCREEN_W / 3);

  if (playerY < 0) {
    playerY = 0;
    velocityY = Math.abs(velocityY) * 0.6; 
  } else if (playerY + PLAYER_SIZE > SCREEN_H) {
    playerY = SCREEN_H - PLAYER_SIZE;
    
    let bounceForce = 800; 
    if (smoothedVoice > 0.1) {
      bounceForce = 600 + (smoothedVoice * 800); 
    }
    velocityY = -bounceForce; 
  }
  onGround = false; 
  
  for (const p of platforms) {
    const overlapsX = playerX + PLAYER_SIZE > p.x && playerX < p.x + p.w;
    const playerBottom = playerY + PLAYER_SIZE;
    const playerTop = playerY;

    if (velocityY > 0 && overlapsX && playerBottom > p.y && (playerBottom - velocityY * dt) <= p.y + 15) {
      playerY = p.y - PLAYER_SIZE;
      velocityY = 0;
      onGround = true;
      if (!scoredPlatforms.has(p.id)) {
        scoredPlatforms.add(p.id);
        score++;
      }
      break; 
    }
    
    if (velocityY < 0 && overlapsX && playerTop < p.y + PLATFORM_H && (playerTop - velocityY * dt) >= p.y + PLATFORM_H) {
      playerY = p.y + PLATFORM_H; 
      velocityY = 0; 
      break;
    }
  }
  
  generatePlatforms();
}
function draw() {
  ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);

  for (const p of platforms) {
    const dx = Math.round(p.x - cameraX);
    if (dx < -300 || dx > SCREEN_W + 300) continue;
    
    if (imageReady(platformImg)) {
      ctx.drawImage(platformImg, dx, p.y, p.w, PLATFORM_H);
    } else {
      ctx.fillStyle = "#dc4b69";
      ctx.fillRect(dx, p.y, p.w, PLATFORM_H);
    }
  }
  const dx = Math.round(playerX - cameraX);
  const dy = Math.round(playerY);
  
  if (imageReady(playerImg)) {
    ctx.drawImage(playerImg, dx, dy, PLAYER_SIZE, PLAYER_SIZE);
  } else {
    ctx.fillStyle = "#f5dc5a";
    ctx.fillRect(dx, dy, PLAYER_SIZE, PLAYER_SIZE);
  }

  ctx.fillStyle = "rgba(35,20,14,0.8)";
  ctx.fillRect(24, 20, 200, 45);
  ctx.strokeStyle = "#ffc457";
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 20, 200, 45);
  
  ctx.fillStyle = "#fff8e6";
  ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("SCORE: " + score, 40, 43);

  const w = 230, h = 18, hx = 18, hy = 80;
  ctx.fillStyle = "rgba(35,20,14,0.8)";
  ctx.fillRect(hx, hy, w, h);
  ctx.fillStyle = "#ffcd5a";
  ctx.fillRect(hx, hy, w * smoothedVoice, h);
  ctx.strokeStyle = "#fff8e6";
  ctx.strokeRect(hx, hy, w, h);
}
let lastT = performance.now();

function loop(now) {
  let dt = (now - lastT) / 1000;
  lastT = now;
  
  if (dt > 0.1) dt = 0.1;

  if (state === "playing") {
    update(dt);
    draw();
  }
  
  requestAnimationFrame(loop);
}
