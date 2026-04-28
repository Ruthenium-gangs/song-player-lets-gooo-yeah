const audio = document.getElementById("audio");

const fileInput = document.getElementById("fileInput");
const playlist = document.getElementById("playlist");

const progress = document.getElementById("progress");
const knob = document.getElementById("knob");
const progressContainer = document.getElementById("progressContainer");

const currentTimeEl = document.getElementById("currentTime");
const durationEl = document.getElementById("duration");

const playPauseBtn = document.getElementById("playPauseBtn");
const volumeSlider = document.getElementById("volume");

let songs = [];
let currentIndex = 0;
let isDragging = false;


const canvas = document.getElementById("visualizer");
const ctx = canvas.getContext("2d");

let audioCtx, analyser, source, dataArray;
let bassFilter, trebleFilter;

function initVisualizer() {
  if (audioCtx) return;

  audioCtx = new AudioContext();

  analyser = audioCtx.createAnalyser();

  bassFilter = audioCtx.createBiquadFilter();
  bassFilter.type = "lowshelf";
  bassFilter.frequency.value = 200;

  trebleFilter = audioCtx.createBiquadFilter();
  trebleFilter.type = "highshelf";
  trebleFilter.frequency.value = 3000;

  source = audioCtx.createMediaElementSource(audio);

  source.connect(bassFilter);
  bassFilter.connect(trebleFilter);
  trebleFilter.connect(analyser);
  analyser.connect(audioCtx.destination);

  document.getElementById("bass").oninput = e => {
    bassFilter.gain.value = (e.target.value - 1) * 10;
  };

  document.getElementById("treble").oninput = e => {
    trebleFilter.gain.value = (e.target.value - 1) * 10;
  };

  analyser.fftSize = 2048;
  dataArray = new Uint8Array(analyser.fftSize);

  draw();
}

function draw() {
  requestAnimationFrame(draw);

  analyser.getByteTimeDomainData(dataArray);

  ctx.fillStyle = "#121212";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();

  let slice = canvas.width / dataArray.length;
  let x = 0;

  for (let i = 0; i < dataArray.length; i++) {
    let v = dataArray[i] / 128.0;
    let y = v * canvas.height / 2;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);

    x += slice;
  }

  ctx.strokeStyle = "#1db954";
  ctx.stroke();
}


fileInput.addEventListener("change", function () {
  playlist.innerHTML = "";
  songs = [];

  Array.from(this.files).forEach((file, i) => {
    const url = URL.createObjectURL(file);
    songs.push({ name: file.name, url });

    const div = document.createElement("div");
    div.className = "song";
    div.textContent = file.name;
    div.onclick = () => playSong(i);

    playlist.appendChild(div);
  });

  if (songs.length > 0) playSong(0);
});

function playSong(index) {
  currentIndex = index;
  audio.src = songs[index].url;
  audio.play();

  initVisualizer();

  playPauseBtn.textContent = "⏸";

  document.getElementById("nowPlaying").textContent = songs[index].name;

  document.querySelectorAll(".song").forEach(s => s.classList.remove("active"));
  playlist.children[index].classList.add("active");
}


function togglePlay() {
  if (audio.paused) {
    audio.play();
    playPauseBtn.textContent = "⏸";
  } else {
    audio.pause();
    playPauseBtn.textContent = "▶";
  }
}

function nextSong() {
  currentIndex = (currentIndex + 1) % songs.length;
  playSong(currentIndex);
}

function prevSong() {
  currentIndex = (currentIndex - 1 + songs.length) % songs.length;
  playSong(currentIndex);
}


audio.addEventListener("timeupdate", () => {
  if (!isDragging) {
    let percent = (audio.currentTime / audio.duration) * 100;
    progress.style.width = percent + "%";
    knob.style.left = percent + "%";
  }

  currentTimeEl.textContent = formatTime(audio.currentTime);
  durationEl.textContent = formatTime(audio.duration);
});

progressContainer.addEventListener("mousedown", () => isDragging = true);
document.addEventListener("mouseup", () => isDragging = false);

document.addEventListener("mousemove", (e) => {
  if (!isDragging) return;

  const rect = progressContainer.getBoundingClientRect();
  let percent = (e.clientX - rect.left) / rect.width;
  percent = Math.max(0, Math.min(1, percent));

  audio.currentTime = percent * audio.duration;
});


volumeSlider.addEventListener("input", () => {
  audio.volume = volumeSlider.value;
});


let singleLoop = false;
function toggleSingleLoop(e) {
  singleLoop = !singleLoop;
  e.target.style.background = singleLoop ? "#1ed760" : "";
}

audio.addEventListener("ended", () => {
  if (singleLoop) {
    audio.currentTime = 0;
    audio.play();
  } else {
    nextSong();
  }
});


document.getElementById("speed").addEventListener("change", e => {
  audio.playbackRate = e.target.value;
});


let mediaRecorder, chunks = [];

function startRecording() {
  const stream = canvas.captureStream(60);

  const ctx2 = new AudioContext();
  const src = ctx2.createMediaElementSource(audio);
  const dest = ctx2.createMediaStreamDestination();

  src.connect(dest);
  src.connect(ctx2.destination);

  const combined = new MediaStream([
    ...stream.getVideoTracks(),
    ...dest.stream.getAudioTracks()
  ]);

  mediaRecorder = new MediaRecorder(combined);

  chunks = [];

  mediaRecorder.ondataavailable = e => chunks.push(e.data);
  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: "video/webm" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "visualizer.webm";
    a.click();
  };

  mediaRecorder.start();
}

function stopRecording() {
  mediaRecorder.stop();
}


function formatTime(sec) {
  if (isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return m + ":" + s;
}