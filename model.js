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
      if (labels.some(label => this.count(label) < 3)) throw Error('다섯 동작을 각각 3개 이상 모아주세요.');
      this.model = this.samples.map(s => ({ label: s.label, features: [...s.features] }));
      this.version++; this.dirty = false;
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
      const prediction = this.predict(features);
      const test = { version: this.version, expected, predicted: prediction.label, correct: expected === prediction.label };
      this.tests.push(test); return test;
    }
  }
  root.LessonModel = LessonModel;
  if (typeof module !== 'undefined') module.exports = { LessonModel, labels };
})(typeof globalThis !== 'undefined' ? globalThis : window);
