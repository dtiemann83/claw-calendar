// AudioWorklet processor — runs in the audio rendering thread
// Loaded via ctx.audioWorklet.addModule("/audio-processor.js")

class AudioChunkProcessorImpl extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(0);
    this._targetSamples = 3840; // 80ms at 48kHz
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0]; // mono

    // Append to buffer
    const newBuffer = new Float32Array(this._buffer.length + channelData.length);
    newBuffer.set(this._buffer);
    newBuffer.set(channelData, this._buffer.length);
    this._buffer = newBuffer;

    // Send chunks of targetSamples
    while (this._buffer.length >= this._targetSamples) {
      const chunk = this._buffer.slice(0, this._targetSamples);
      this._buffer = this._buffer.slice(this._targetSamples);

      // Convert float32 to int16
      const int16 = new Int16Array(chunk.length);
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      this.port.postMessage(int16, [int16.buffer]);
    }

    return true; // keep processor alive
  }
}

registerProcessor("audio-chunk-processor", AudioChunkProcessorImpl);
