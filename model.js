(function (root) {
  const labels = ['forward', 'backward', 'left', 'right', 'stop'];
  class LessonModel {
    constructor() { this.samples = []; this.model = []; this.tests = []; this.version = 0; this.dirty = false; }
    add(label, features) {
      if (!labels.includes(label) || !features.length || !features.every(Number.isFinite)) throw Error('유효한 손 데이터가 필요합니다.');
      this.samples.push({ label, features: [...features] }); this.dirty = true;
    }
    count(label) { return this.samples.filter(s => s.label === label).length; }
    remove(label) { this.samples = this.samples.filter(s => s.label !== label); this.dirty = true; }
    train() {
      if (labels.some(label => this.count(label) < 30)) throw Error('다섯 동작을 각각 30개 이상 모아주세요.');
      this.model = this.samples.map(s => ({ label: s.label, features: [...s.features] }));
      this.version++; this.dirty = false;
    }
    testProgress() {
      const current = this.tests.filter(t => t.version === this.version);
      const counts = Object.fromEntries(labels.map(label => [label, current.filter(t => t.expected === label).length]));
      const correct = Object.fromEntries(labels.map(label => [label, current.filter(t => t.expected === label && t.correct).length]));
      const accuracy = Object.fromEntries(labels.map(label => [label, counts[label] ? correct[label] / counts[label] : null]));
      return { counts, correct, accuracy, completed: labels.reduce((sum, label) => sum + Math.min(5, counts[label]), 0), total: current.length };
    }
    canDrive() {
      const progress = this.testProgress();
      return this.model.length > 0 && !this.dirty && labels.every(label => progress.counts[label] >= 5 && progress.correct[label] * 5 > progress.counts[label] * 4);
    }
    feedback(useModel = false) {
      const source = useModel ? this.model : this.samples;
      const counts = Object.fromEntries(labels.map(label => [label, source.filter(s => s.label === label).length]));
      const notes = [];
      const few = labels.filter(label => counts[label] < 30);
      if (few.length) notes.push({ type: 'few', labels: few, counts });
      const min = Math.min(...Object.values(counts)), max = Math.max(...Object.values(counts));
      if (max > 0 && (min === 0 || max >= min * 3)) notes.push({ type: 'imbalance', counts });
      const progress = this.testProgress();
      if (progress.completed < 25) notes.push({ type: 'testing', remaining: 25 - progress.completed });
      const weak = labels.filter(label => progress.counts[label] >= 5 && progress.correct[label] * 5 <= progress.counts[label] * 4);
      if (weak.length) notes.push({ type: 'accuracy', labels: weak });
      const pairs = new Map();
      for (const t of this.tests.filter(t => t.version === this.version && !t.correct)) {
        const key = t.expected + ':' + t.predicted;
        const pair = pairs.get(key) || { type: 'confusion', expected: t.expected, predicted: t.predicted, count: 0 };
        pair.count++; pairs.set(key, pair);
      }
      notes.push(...[...pairs.values()].filter(pair => pair.count >= 2).sort((a,b) => b.count - a.count));
      return notes;
    }
    predict(features) {
      if (!this.model.length) return null;
      const neighbors = this.model.map(s => ({ label: s.label, distance: s.features.reduce((sum, x, i) => sum + (x - features[i]) ** 2, 0) }))
        .sort((a, b) => a.distance - b.distance).slice(0, 5);
      const votes = {};
      neighbors.forEach(n => { votes[n.label] = (votes[n.label] || 0) + 1; });
      const label = neighbors.reduce((best, n) => votes[n.label] > votes[best] ? n.label : best, neighbors[0].label);
      return { label, agreement: votes[label] / neighbors.length };
    }
    record(expected, features) {
      if (this.dirty || !this.model.length) throw Error('먼저 현재 데이터로 학습해주세요.');
      if (!labels.includes(expected)) throw Error('실제 정답을 선택해주세요.');
      const prediction = this.predict(features);
      const test = { version: this.version, expected, predicted: prediction.label, correct: expected === prediction.label };
      this.tests.push(test); return test;
    }
  }
  root.LessonModel = LessonModel;
  if (typeof module !== 'undefined') module.exports = { LessonModel, labels };
})(typeof globalThis !== 'undefined' ? globalThis : window);
