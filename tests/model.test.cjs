const { test } = require('node:test');
const assert = require('node:assert/strict');
const { LessonModel, labels } = require('../model.js');
function trained() {
  const model = new LessonModel();
  labels.forEach((label, index) => { for (let i=0;i<5;i++) model.add(label, [index * 10, i / 100]); });
  model.train(); return model;
}
test('collection does not create a trained model; all gestures need samples', () => {
  const model = new LessonModel(); model.add('forward', [0, 0]);
  assert.equal(model.predict([0, 0]), null); assert.throws(() => model.train());
});
test('training uses an independent snapshot and edits require retraining', () => {
  const model = trained(); model.samples[0].features[0] = 999;
  assert.equal(model.model[0].features[0], 0);
  model.remove('forward'); assert.equal(model.model.length, 25);
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
