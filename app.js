const $ = id => document.getElementById(id);
const lesson = new window.LessonModel();
const names = { forward: '⬆️ 앞으로', backward: '⬇️ 뒤로', left: '⬅️ 왼쪽', right: '➡️ 오른쪽', stop: '⏹️ 정지' };
let stage = 'learn', collecting = null, features = null, lastSeen = 0, lastCollect = 0;
let detector, stream, device, characteristic, driving = false, lastCommand = 0, writing = false, stopping = false;
const video = $('video'), ctx = $('overlay').getContext('2d');
const notify = message => { $('notice').textContent = message; };
const fresh = () => features && performance.now() - lastSeen < 500;
const ready = () => lesson.model.length > 0 && !lesson.dirty;
function endCollection() {
  collecting = null;
  renderGuidance();
  document.querySelectorAll('.collect').forEach(b => b.classList.remove('collecting'));
}
function refresh() {
  for (const label in names) $('count-' + label).textContent = `${lesson.count(label)}/30개`;
  $('total').textContent = `${lesson.samples.length}개 수집`;
  $('train').disabled = !Object.keys(names).every(label => lesson.count(label) >= 30) || !lesson.dirty;
  $('tab-test').disabled = !ready();
  $('tab-robot').disabled = !lesson.canDrive();
  $('go-robot').disabled = !lesson.canDrive();
  $('record').disabled = !ready() || !fresh();
  $('robot-start').disabled = !lesson.canDrive() || !characteristic || driving || stopping;
  $('connect').disabled = !!device || !navigator.bluetooth;
  $('disconnect').disabled = !device;
  $('model-status').textContent = lesson.version ? `모델 ${lesson.version} · ${lesson.model.length}개로 학습${lesson.dirty ? ' · 데이터 변경됨, 다시 학습해주세요.' : ' 완료'}` : '아직 학습한 모델이 없어요.';
}
async function changeStage(next) {
  if (next !== 'learn' && !ready()) return;
  if (next === 'robot' && !lesson.canDrive()) return;
  endCollection();
  await stopRobot();
  stage = next;
  ['learn', 'test', 'robot'].forEach(name => {
    $('panel-' + name).hidden = name !== stage;
    if (name === stage) $('tab-' + name).setAttribute('aria-current', 'step');
    else $('tab-' + name).removeAttribute('aria-current');
  });
  notify({ learn: '손 모양은 입력 데이터, 버튼의 이름은 정답이에요.', test: '테스트 데이터는 학습에 사용하지 않아요. 친구의 손이나 새로운 각도로 시험해보세요.', robot: '기기를 연결한 뒤 조작 시작을 눌러주세요.' }[stage]);
  refresh(); renderGuidance();
}
for (const label in names) {
  const card = document.createElement('div'); card.className = 'gesture-card';
  card.innerHTML = `<button class="collect" id="collect-${label}">${names[label]}</button><span class="sample-count" id="count-${label}">0개</span><button class="delete" aria-label="${names[label]} 데이터 삭제">×</button>`;
  $('gesture-grid').append(card);
  const button = card.querySelector('.collect');
  button.addEventListener('pointerdown', e => {
    if (e.button !== 0 || stage !== 'learn') return;
    if (!fresh()) { notify('먼저 카메라를 켜고 손이 보이도록 해주세요.'); return; }
    e.preventDefault(); button.setPointerCapture(e.pointerId); collecting = label; button.classList.add('collecting');
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(event => button.addEventListener(event, endCollection));
  // 키보드는 한 번 누를 때마다 한 샘플을 저장합니다.
  button.addEventListener('click', e => {
    if (e.detail === 0 && stage === 'learn' && fresh()) { lesson.add(label, features); refresh(); renderGuidance(); }
  });
  card.querySelector('.delete').onclick = () => { endCollection(); lesson.remove(label); refresh(); renderGuidance(); notify('수집 데이터를 삭제했어요. 다시 학습하면 모델에 반영돼요.'); };
  const option = document.createElement('option'); option.value = label; option.textContent = names[label]; $('expected').append(option);
}
['learn', 'test', 'robot'].forEach(name => { $('tab-' + name).onclick = () => changeStage(name); });
$('train').onclick = () => {
  endCollection();
  try { lesson.train(); renderTests(); refresh(); changeStage('test'); }
  catch (error) { notify(error.message); }
};
$('go-robot').onclick = () => changeStage('robot');
$('improve').onclick = () => changeStage('learn');
$('reset').onclick = async () => {
  if (!confirm('수집 데이터, 모델, 시험 기록을 모두 지울까요?')) return;
  await changeStage('learn');
  Object.assign(lesson, new window.LessonModel()); renderTests(); refresh(); notify('초기화했어요. 새로운 손 모양을 모아보세요.');
};
function renderGuidance() {
  const notes = lesson.feedback(stage !== 'learn');
  const list = $('feedback-list'); list.replaceChildren();
  for (const note of notes) {
    const item = document.createElement('li');
    if (note.type === 'few') item.textContent = `예시가 적은 동작: ${note.labels.map(label => `${names[label]} ${note.counts[label]}개`).join(', ')}. 손 각도를 바꾸거나 다른 친구의 손으로 예시를 더 모아보세요. 각 동작을 30개 이상 모아야 학습할 수 있어요. 개수만으로 성능을 보장하지는 않아요.`;
    if (note.type === 'imbalance') item.textContent = `동작별 데이터 차이가 커요 (${Object.entries(note.counts).map(([label,count]) => `${names[label]} ${count}개`).join(', ')}). 한 동작의 예시에 치우칠 수 있으니 적은 동작도 더 모아보세요.`;
    if (note.type === 'testing') item.textContent = `아직 모든 동작을 충분히 확인하지 않았어요. 동작별 5회 조건을 채우려면 ${note.remaining}회 더 시험해야 해요. 테스트를 늘려도 모델이 학습되는 것은 아니에요.`;
    if (note.type === 'accuracy') item.textContent = `정답률 80% 이하: ${note.labels.map(label => names[label]).join(', ')}. 이 동작들의 데이터와 정답을 점검하고 보완해 다시 학습해보세요. 모든 동작이 80%를 초과해야 마퀸 조작으로 넘어갈 수 있어요.`;
    if (note.type === 'confusion') item.textContent = `실제 ${names[note.expected]}를 AI가 ${names[note.predicted]}로 ${note.count}회 예상했어요. 두 손 모양이 비슷하거나 예시·정답이 충분하지 않을 수 있어요. 정답 이름을 확인하고, 서로 구분되는 다양한 예시를 모아 다시 학습해보세요.`;
    list.append(item);
  }
  if (!notes.length) { const item = document.createElement('li'); item.textContent = '현재 횟수와 오답 기록에서 뚜렷한 점검 항목은 없어요. 모든 손을 잘 알아본다는 뜻은 아니니 새로운 친구의 손도 시험해보세요.'; list.append(item); }
  $('feedback-source').textContent = stage === 'learn' ? '수집 중인 데이터와 현재 모델의 시험 기록 기준' : `모델 ${lesson.version}에 사용한 데이터와 시험 기록 기준`;
}
function renderTests() {
  const progress = lesson.testProgress();
  $('test-progress').textContent = `마퀸 조작 준비 ${progress.completed}/25 · 실제 시험 ${progress.total}회`;
  $('test-counts').replaceChildren();
  for (const label in names) {
    const item = document.createElement('span');
    item.className = progress.counts[label] >= 5 && progress.accuracy[label] > .8 ? 'pill' : 'pill pending';
    item.textContent = `${names[label]} ${progress.counts[label]}/5회 · ${progress.counts[label] ? (progress.accuracy[label] * 100).toFixed(1) + "% (" + progress.correct[label] + "/" + progress.counts[label] + ")" : "정답률 —"}`;
    $('test-counts').append(item);
  }
  $('unlock-status').textContent = lesson.canDrive() ? '다섯 동작 모두 테스트 5회 이상, 정답률 80% 초과를 달성했어요. 마퀸 조작을 시작할 수 있어요.' : '각 동작을 5회 이상 시험하고, 모든 동작의 정답률이 80%를 초과해야 해요. 4/5회 정답(80%)은 통과하지 못해요. 현재 모델의 누적 시험으로 계산하며, 다시 학습하면 새 모델에서 다시 시험해요.';
  renderGuidance();
  const current = lesson.tests.filter(t => t.version === lesson.version);
  const correct = current.filter(t => t.correct).length;
  $('accuracy').textContent = current.length ? `${Math.round(correct / current.length * 100)}%` : '—';
  $('score-detail').textContent = current.length ? `${current.length}회 중 ${correct}회 정답 · 모델 ${lesson.version}` : '아직 시험 기록이 없어요.';
  $('test-results').replaceChildren();
  for (const test of lesson.tests.slice(-10).reverse()) {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${test.version}</td><td>${names[test.expected]}</td><td>${names[test.predicted]}</td><td class="${test.correct ? 'correct' : 'incorrect'}">${test.correct ? '정답' : '다시 살펴보기'}</td>`;
    $('test-results').append(row);
  }
  const versions = [...new Set(lesson.tests.map(t => t.version))];
  $('history').textContent = versions.map(v => {
    const tests = lesson.tests.filter(t => t.version === v);
    return `모델 ${v}: ${tests.filter(t => t.correct).length}/${tests.length}회 정답`;
  }).join(' · ') + (versions.length ? ' — 모델마다 시험한 손이 다르면 직접 비교하기 어려워요. 같은 조건으로 시험해보세요.' : '');
}
$('record').onclick = () => {
  if (stage !== 'test' || !fresh()) { notify('손이 보이는 상태에서 시험해주세요.'); return; }
  try {
    const result = lesson.record($('expected').value, features);
    notify(result.correct ? '정답이에요! 다른 각도나 친구의 손도 시험해보세요.' : `AI는 ${names[result.predicted]}라고 예상했어요. 어떤 데이터를 더 모으면 좋을까요?`);
    renderTests(); refresh();
  } catch (error) { notify(error.message); }
};
function extractFeatures(landmarks) {
  const wrist = landmarks[0];
  const scale = Math.max(.001, ...landmarks.slice(1).map(p => Math.hypot(p.x - wrist.x, p.y - wrist.y)));
  return landmarks.slice(1).flatMap(p => [(p.x - wrist.x) / scale, (p.y - wrist.y) / scale]);
}
$('camera-start').onclick = async () => {
  $('camera-start').disabled = true; $('camera-status').textContent = '카메라 권한을 허용해주세요. 손 인식 모델을 준비하고 있어요…';
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
    video.srcObject = stream; await video.play();
    const { FilesetResolver, HandLandmarker } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8');
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm');
    detector = await HandLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task' }, runningMode: 'VIDEO', numHands: 1 });
    $('camera-placeholder').hidden = true; $('camera-start').hidden = true;
    $('camera-status').textContent = '준비 완료! 손 전체가 화면 안에 들어오도록 보여주세요.';
    requestAnimationFrame(frame);
  } catch (error) {
    stream?.getTracks().forEach(track => track.stop());
    $('camera-start').disabled = false;
    $('camera-status').textContent = '카메라를 시작하지 못했어요. 카메라 권한과 인터넷 연결을 확인하고 다시 눌러주세요.';
    console.error(error);
  }
};
function drawHand(hand) {
  const connections = [
    [0,1],[1,2],[2,3],[3,4], [0,5],[5,6],[6,7],[7,8],
    [0,9],[9,10],[10,11],[11,12], [0,13],[13,14],[14,15],[15,16],
    [0,17],[17,18],[18,19],[19,20], [5,9],[9,13],[13,17]
  ];
  ctx.strokeStyle = '#00c800'; ctx.lineWidth = 4;
  for (const [a,b] of connections) {
    ctx.beginPath(); ctx.moveTo(hand[a].x * 640, hand[a].y * 480);
    ctx.lineTo(hand[b].x * 640, hand[b].y * 480); ctx.stroke();
  }
  hand.forEach((point,index) => {
    ctx.fillStyle = index === 0 ? '#ff0000' : '#00ff00';
    ctx.beginPath(); ctx.arc(point.x * 640, point.y * 480, 7, 0, Math.PI * 2); ctx.fill();
  });
}
let lastVideoTime = -1;
function frame(now) {
  try {
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const hand = detector.detectForVideo(video, now).landmarks[0];
      ctx.clearRect(0, 0, 640, 480);
      features = hand ? extractFeatures(hand) : null;
      if (hand) {
        lastSeen = now;
        drawHand(hand);
        if (stage === 'learn' && collecting && now - lastCollect > 250) { lesson.add(collecting, features); lastCollect = now; }
      }
    }
    $('hand-status').textContent = fresh() ? '손 인식됨' : '손을 보여주세요';
    if (stage !== 'learn' && ready() && fresh()) {
      const prediction = lesson.predict(features);
      $('prediction').textContent = names[prediction.label];
      $('prediction-note').textContent = `비슷한 샘플의 일치 비율 ${Math.round(prediction.agreement * 100)}% · 시험 정답률과 달라요.`;
      if (driving && stage === 'robot') {
        $('robot-status').textContent = '마퀸 조작 중 · 손을 보여주세요.';
        if (now - lastCommand > 150) { lastCommand = now; send(prediction.label); }
      }
    } else {
      $('prediction').textContent = stage === 'learn' ? '데이터 수집 중' : '손을 보여주세요';
      $('prediction-note').textContent = stage === 'learn' ? '모델 학습하기를 누르면 테스트할 수 있어요.' : '손이 보이면 AI의 예상을 확인할 수 있어요.';
      if (driving && stage === 'robot') {
        $('robot-status').textContent = '손 인식 대기 중 · 조작 모드는 유지돼요. 손을 보여주면 자동으로 이어집니다.';
        if (now - lastCommand > 150) { lastCommand = now; send('stop'); }
      }
    }
    refresh();
  } catch (error) {
    features = null; endCollection(); stopRobot('손 인식에 문제가 생겨 조작을 중지했어요.');
    $('camera-status').textContent = '손 인식 오류가 발생했어요. 페이지를 새로고침해주세요.';
    console.error(error);
  }
  requestAnimationFrame(frame);
}
async function send(command) {
  if (!characteristic || writing || (stopping && command !== 'stop')) return false;
  writing = true;
  try {
    let timer;
    try {
      await Promise.race([characteristic.writeValue(new TextEncoder().encode(command + '\n')), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('전송 시간 초과')), 2000); })]);
    } finally { clearTimeout(timer); }
    return true;
  } catch (error) {
    driving = false; device?.gatt.disconnect(); $('robot-status').textContent = '전송 실패. 로봇을 직접 멈추고 연결을 확인해주세요.'; return false;
  } finally { writing = false; }
}
async function stopRobot(message = '조작을 중지했어요.') {
  driving = false;
  if (!characteristic || stopping) { refresh(); return; }
  stopping = true; refresh();
  let stopped = false;
  for (let i = 0; i < 10 && characteristic; i++) {
    if (await send('stop')) { stopped = true; break; }
    await new Promise(resolve => setTimeout(resolve, 80));
  }
  stopping = false;
  $('robot-status').textContent = stopped ? message : '정지 신호를 확인하지 못했어요. 로봇을 직접 멈추고 연결을 확인해주세요.';
  refresh();
}
$('connect').onclick = async () => {
  try {
    device = await navigator.bluetooth.requestDevice({ filters: [{ namePrefix: 'BBC micro:bit' }], optionalServices: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e'] });
    device.addEventListener('gattserverdisconnected', () => {
      driving = false; characteristic = null; device = null;
      $('bluetooth-status').textContent = '연결이 해제되었어요.';
      $('robot-status').textContent = '연결이 끊겼어요. 로봇의 정지 상태를 확인해주세요.'; refresh();
    });
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
    characteristic = await service.getCharacteristic('6e400003-b5a3-f393-e0a9-e50e24dcca9e');
    $('bluetooth-status').textContent = '연결됨: ' + (device.name.match(/\[(.*?)\]/)?.[1] || device.name);
  } catch (error) {
    device?.gatt.disconnect(); device = null; characteristic = null;
    $('bluetooth-status').textContent = '연결하지 못했어요. 기기를 켜고 다시 시도해주세요.';
  }
  refresh();
};
$('disconnect').onclick = async () => { await stopRobot(); device?.gatt.disconnect(); };
$('robot-start').onclick = () => {
  if (stage !== 'robot' || !lesson.canDrive() || !characteristic || stopping) return;
  if (!fresh()) { notify('손이 보이는 상태에서 시작해주세요.'); return; }
  driving = true; $('robot-status').textContent = '마퀸 조작 중 · 손을 보여주세요.'; refresh();
};
$('robot-stop').onclick = () => stopRobot();
window.addEventListener('blur', () => { endCollection(); stopRobot('창을 벗어나 조작을 중지했어요.'); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { endCollection(); stopRobot(); } });
if (!navigator.bluetooth) $('bluetooth-status').textContent = '이 브라우저는 블루투스를 지원하지 않아요. 학습·테스트는 가능하며, 로봇 연결은 지원되는 Chrome/Edge에서 사용하세요.';
refresh(); renderTests();
