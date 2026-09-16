const { test } = require('node:test');
const assert = require('node:assert/strict');
const { LessonModel, labels } = require('../model.js');
function trained() {
  const model = new LessonModel();
  labels.forEach((label, index) => { for (let i=0;i<30;i++) model.add(label, [index * 10, i / 100]); });
  model.train(); return model;
}
test('collection does not create a trained model; all gestures need samples', () => {
  const model = new LessonModel(); model.add('forward', [0, 0]);
  assert.equal(model.predict([0, 0]), null); assert.throws(() => model.train());
});
test('training uses an independent snapshot and edits require retraining', () => {
  const model = trained(); model.samples[0].features[0] = 999;
  assert.equal(model.model[0].features[0], 0);
  model.remove('forward'); assert.equal(model.model.length, 150);
  assert.equal(model.dirty, true); assert.throws(() => model.record('left', [20, 0]));
});
test('test records cannot change training samples or model', () => {
  const model = trained(); const before = JSON.stringify([model.samples, model.model]);
  assert.equal(model.record('left', [20, 0]).correct, true);
  assert.equal(model.record('right', [20, 0]).correct, false);
  assert.equal(JSON.stringify([model.samples, model.model]), before);
});
test('retraining versions test history independently', () => {
  const model = trained(); model.record('left', [20, 0]); model.add('stop', [40, 0]); model.train();
  assert.equal(model.version, 2); assert.equal(model.tests[0].version, 1);
  assert.equal(model.record('stop', [40, 0]).version, 2);
});

test('ten trials of one gesture do not unlock driving; each gesture needs five', () => {
  const model = trained();
  for (let i=0;i<10;i++) model.record('forward',[0,0]);
  assert.equal(model.canDrive(), false); assert.equal(model.testProgress().completed,5);
  labels.slice(1).forEach((label,index)=>{for(let i=0;i<5;i++) model.record(label,[(index+1)*10,0]);});
  assert.equal(model.canDrive(),true);
  model.add('forward',[0,0]); assert.equal(model.canDrive(),false);
  model.train(); assert.equal(model.canDrive(),false); assert.equal(model.testProgress().completed,0);
});
test('wrong answers count toward coverage but block driving without changing predictions', () => {
  const model=trained(); const before=model.predict([0,0]);
  labels.forEach((label,index)=>{for(let i=0;i<5;i++) model.record(label,[((index+1)%5)*10,0]);});
  assert.equal(model.tests.every(t=>!t.correct),true); assert.equal(model.testProgress().completed,25); assert.equal(model.canDrive(),false);
  assert.deepEqual(model.predict([0,0]),before);
});
test('feedback reports observed imbalance and repeated confusion without using old model trials', () => {
  const model=trained();
  for(let i=0;i<60;i++) model.add('forward',[0,0]);
  assert.ok(model.feedback().some(n=>n.type==='imbalance'));
  model.train(); model.record('left',[0,0]);
  assert.equal(model.feedback(true).some(n=>n.type==='confusion'),false);
  model.record('left',[0,0]);
  const pair=model.feedback(true).find(n=>n.type==='confusion');
  assert.deepEqual([pair.expected,pair.predicted,pair.count],['left','forward',2]);
  model.train(); assert.equal(model.feedback(true).some(n=>n.type==='confusion'),false);
});
test('invalid test label cannot contribute to progress',()=>{
  const model=trained(); assert.throws(()=>model.record('invalid',[0,0])); assert.equal(model.tests.length,0);
});

test('training requires thirty samples for every gesture',()=>{
  const model=new LessonModel();
  labels.forEach((label,index)=>{for(let i=0;i<(label==='stop'?29:30);i++)model.add(label,[index*10,0]);});
  assert.throws(()=>model.train()); model.add('stop',[40,0]); model.train();
  assert.equal(model.model.length,150);
});
test('one gesture at exactly eighty percent blocks driving even if overall accuracy is high',()=>{
  const model=trained();
  labels.forEach((label,index)=>{for(let i=0;i<5;i++)model.record(label,[index*10,0]);});
  assert.equal(model.canDrive(),true);
  // Forward: 8/10 correct; other classes remain at 100%.
  for(let i=0;i<3;i++)model.record('forward',[0,0]);
  for(let i=0;i<2;i++)model.record('forward',[10,0]);
  assert.equal(model.testProgress().accuracy.forward,.8); assert.equal(model.canDrive(),false);
  assert.ok(model.feedback(true).some(n=>n.type==='accuracy' && n.labels.includes('forward')));
  model.record('forward',[0,0]); // 9/11 > 80%, cumulative accuracy.
  assert.equal(model.canDrive(),true);
});
test('four out of five is rejected; all five correct is accepted',()=>{
  const model=trained();
  labels.forEach((label,index)=>{for(let i=0;i<5;i++)model.record(label,[label==='stop' && i===4 ? 0 : index*10,0]);});
  assert.equal(model.testProgress().correct.stop,4); assert.equal(model.canDrive(),false);
  model.record('stop',[40,0]); assert.equal(model.canDrive(),true);
});
