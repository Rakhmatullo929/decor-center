import {
  clearAnswerDraft,
  loadAnswerDraft,
  pruneExpiredDrafts,
  saveAnswerDraft,
} from '../answer-draft';

const HALF_HOUR = 30 * 60 * 1000;

beforeEach(() => window.localStorage.clear());
afterEach(() => jest.restoreAllMocks());

describe('answer-draft', () => {
  it('round-trips answers for a session', () => {
    saveAnswerDraft('7', { 1: { selectedOptionIds: ['a'] }, 2: { textValue: 'hi' } });
    expect(loadAnswerDraft('7')).toEqual({ 1: { selectedOptionIds: ['a'] }, 2: { textValue: 'hi' } });
  });

  it('returns an empty object when no draft exists', () => {
    expect(loadAnswerDraft('nope')).toEqual({});
  });

  it('keeps drafts isolated per session id', () => {
    saveAnswerDraft('7', { 1: { textValue: 'seven' } });
    saveAnswerDraft('8', { 1: { textValue: 'eight' } });
    expect(loadAnswerDraft('7')).toEqual({ 1: { textValue: 'seven' } });
    expect(loadAnswerDraft('8')).toEqual({ 1: { textValue: 'eight' } });
  });

  it('clears a draft after submit', () => {
    saveAnswerDraft('7', { 1: { textValue: 'x' } });
    clearAnswerDraft('7');
    expect(loadAnswerDraft('7')).toEqual({});
  });

  it('does not leave an empty key behind when nothing was entered', () => {
    saveAnswerDraft('7', { 1: { textValue: 'x' } });
    saveAnswerDraft('7', {}); // e.g. the last answer was cleared
    expect(window.localStorage.getItem('decor.survey.draft.7')).toBeNull();
  });

  it('recovers gracefully from corrupt storage', () => {
    window.localStorage.setItem('decor.survey.draft.7', '{not valid json');
    expect(loadAnswerDraft('7')).toEqual({});
  });

  it('drops null / non-object per-answer entries instead of crashing consumers', () => {
    saveAnswerDraft('7', { 1: null as never, 2: { textValue: 'ok' } });
    expect(loadAnswerDraft('7')).toEqual({ 2: { textValue: 'ok' } });
  });

  it('ignores an empty session id', () => {
    saveAnswerDraft('', { 1: { textValue: 'x' } });
    expect(loadAnswerDraft('')).toEqual({});
  });

  it('ignores a draft older than the max age (prefers the server on later resume)', () => {
    jest.spyOn(Date, 'now').mockReturnValue(0);
    saveAnswerDraft('7', { 1: { textValue: 'stale' } });
    jest.spyOn(Date, 'now').mockReturnValue(HALF_HOUR + 1);
    expect(loadAnswerDraft('7')).toEqual({});
  });

  it('prunes expired drafts but keeps fresh ones', () => {
    jest.spyOn(Date, 'now').mockReturnValue(0);
    saveAnswerDraft('old', { 1: { textValue: 'a' } });
    jest.spyOn(Date, 'now').mockReturnValue(HALF_HOUR + 1);
    saveAnswerDraft('new', { 1: { textValue: 'b' } });

    pruneExpiredDrafts(); // now = HALF_HOUR + 1: 'old' is expired, 'new' is fresh
    expect(window.localStorage.getItem('decor.survey.draft.old')).toBeNull();
    expect(loadAnswerDraft('new')).toEqual({ 1: { textValue: 'b' } });
  });
});
