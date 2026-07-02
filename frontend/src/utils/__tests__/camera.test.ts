import { blobToBase64, captureFrame } from '../camera';

describe('camera utils', () => {
  it('captureFrame returns null when the video has no dimensions', async () => {
    const fakeVideo = { videoWidth: 0 } as unknown as HTMLVideoElement;
    expect(await captureFrame(fakeVideo)).toBeNull();
  });

  it('blobToBase64 resolves to a base64 data URL', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const result = await blobToBase64(blob);
    expect(result).toMatch(/^data:.*;base64,/);
  });
});
