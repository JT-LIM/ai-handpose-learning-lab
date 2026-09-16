const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function app() {
  const elements = {};
  class Element {
    constructor() { this.listeners = {}; this.classList = { add() {}, remove() {} }; this.children = []; this.hidden = false; }
    set innerHTML(value) {
      this.markup = value;
      for (const match of value.matchAll(/id="([^"]+)"/g)) elements[match[1]] = new Element();
      this.collect = value.match(/id="(collect-[^"]+)"/)?.[1];
    }
    get innerHTML() { return this.markup; }
    querySelector(selector) { return selector === '.collect' ? elements[this.collect] : (this.delete ||= new Element()); }
    append(child) { this.children.push(child); }
    replaceChildren() { this.children = []; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    setAttribute() {} removeAttribute() {} setPointerCapture() {}
    getContext() { return { clearRect() {}, beginPath() {}, arc() {}, fill() {} }; }
  }
  const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  for (const m of html.matchAll(/id="([^"]+)"/g)) elements[m[1]] = new Element();
  const context = vm.createContext({ console, performance:{ now:() => 1000 }, navigator:{}, TextEncoder, setTimeout, clearTimeout,
    confirm:() => true, requestAnimationFrame() {}, document: { getElementById: id => elements[id], createElement:() => new Element(), querySelectorAll:() => [], addEventListener() {} } });
  context.window = context; context.addEventListener = () => {};
  vm.runInContext(fs.readFileSync(__dirname + '/../model.js', 'utf8'),context);
  vm.runInContext(fs.readFileSync(__dirname + '/../app.js', 'utf8'),context);
  return { elements, run:code => vm.runInContext(code,context) };
}
test('student flow separates collection, training, testing and retraining', async () => {
  const { elements:e, run } = app();
  assert.equal(e['tab-test'].disabled,true); assert.equal(e.train.disabled,true);
  run("Object.keys(names).forEach((label,index) => { for(let i=0;i<30;i++) lesson.add(label,[index*10,0]); }); refresh()");
  assert.equal(e.train.disabled,false); assert.equal(e['tab-test'].disabled,true);
  await e.train.onclick(); await Promise.resolve();
  assert.equal(run('stage'),'test'); assert.equal(run('lesson.model.length'),150);
  assert.equal(e['tab-robot'].disabled,true);
  run('features=[20,0]; lastSeen=1000'); e.expected.value='left'; e.record.onclick();
  assert.equal(e.accuracy.textContent,'100%'); assert.equal(run('lesson.samples.length'),150);
  assert.equal(e['tab-robot'].disabled,true);
  await run("changeStage('robot')"); assert.equal(run('stage'),'test');
  run("Object.keys(names).forEach((label,index)=>{ for(let i=0;i<5;i++) lesson.record(label,[index*10,0]); }); refresh()");
  assert.equal(e['tab-robot'].disabled,false);
  await e.improve.onclick();
  run("lesson.add('left',[20,0]); refresh()");
  assert.equal(e['tab-test'].disabled,true);
  await e.train.onclick(); await Promise.resolve();
  assert.equal(e.accuracy.textContent,'—'); assert.equal(run('lesson.tests.length'),26); assert.equal(e['tab-robot'].disabled,true);
});
test('robot only starts explicitly and stage transition sends stop while preserving connection', async () => {
  const { elements:e,run }=app();
  run("Object.keys(names).forEach((label,index) => { for(let i=0;i<30;i++) lesson.add(label,[index*10,0]); }); lesson.train(); Object.keys(names).forEach((label,index)=>{for(let i=0;i<5;i++) lesson.record(label,[index*10,0]);}); features=[20,0]; lastSeen=1000; globalThis.commands=[]; characteristic={writeValue:async data=>commands.push(new TextDecoder().decode(data))}");
  // Provide TextDecoder through a mock write that only inspects bytes.
  run("characteristic={writeValue:async data=>commands.push(String.fromCharCode(...data))}");
  await run("changeStage('robot')");
  assert.equal(run('driving'),false);
  e['robot-start'].onclick(); assert.equal(run('driving'),true);
  await run("changeStage('learn')");
  assert.equal(run('driving'),false); assert.equal(run('commands.at(-1)'),'stop\n');
  assert.equal(run('!!characteristic'),true);
});
test('stale camera frames cannot create test records',async()=>{
  const {elements:e,run}=app();
  run("Object.keys(names).forEach((label,index)=>{for(let i=0;i<30;i++)lesson.add(label,[index*10,0]);}); lesson.train();");
  await run("changeStage('test')"); e.expected.value='forward'; e.record.onclick();
  assert.equal(run('lesson.tests.length'),0);
});

test('missing hand preserves driving mode and resumes commands without another start', async () => {
  const {run}=app();
  run("Object.keys(names).forEach((label,index)=>{for(let i=0;i<30;i++)lesson.add(label,[index*10,0]);}); lesson.train(); Object.keys(names).forEach((label,index)=>{for(let i=0;i<5;i++)lesson.record(label,[index*10,0]);}); stage='robot'; driving=true; features=null; globalThis.commands=[]; characteristic={writeValue:async data=>commands.push(String.fromCharCode(...data))}");
  run('frame(1000)'); await Promise.resolve(); await Promise.resolve();
  assert.equal(run('driving'),true); assert.equal(run('commands.at(-1)'),'stop\n');
  run('features=[20,0]; lastSeen=1000; frame(1200)'); await Promise.resolve(); await Promise.resolve();
  assert.equal(run('driving'),true); assert.equal(run('commands.at(-1)'),'left\n');
  await run('stopRobot()'); assert.equal(run('driving'),false);
});
