import { ANALYSIS_CONFIG } from '../config/analysis-config.js';

export class PoseEngine {
  constructor() {
    if (!window.Pose) {
      throw new Error('The MediaPipe Pose library did not load. Check your connection and try again.');
    }

    this.latestResult = null;
    this.pose = new window.Pose({
      locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`
    });
    this.pose.setOptions(ANALYSIS_CONFIG.pose);
    this.pose.onResults(result => { this.latestResult = result; });
  }

  async estimate(image) {
    this.latestResult = null;
    await this.pose.send({ image });
    return this.latestResult;
  }

  async close() {
    if (typeof this.pose.close === 'function') await this.pose.close();
  }
}
