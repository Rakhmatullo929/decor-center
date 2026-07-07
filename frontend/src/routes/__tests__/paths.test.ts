import { paths } from '../paths';

describe('survey + kiosk paths', () => {
  it('admin survey paths', () => {
    expect(paths.app.surveys.blocks(4)).toBe('/surveys/tests/4/blocks');
    expect(paths.app.surveys.block(4, 16)).toBe('/surveys/tests/4/blocks/16');
    expect(paths.app.surveys.results).toBe('/surveys/results');
  });
  it('kiosk paths', () => {
    expect(paths.app.kiosk.root).toBe('/kiosk');
    expect(paths.app.kiosk.due(2)).toBe('/kiosk/2/due');
    expect(paths.app.kiosk.answer).toBe('/kiosk/answer');
    expect(paths.app.kiosk.thankYou).toBe('/kiosk/thank-you');
  });
});
