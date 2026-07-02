import { combineReducers } from 'redux';
import storage from 'redux-persist/lib/storage';

// ----------------------------------------------------------------------

export const rootPersistConfig = {
  key: 'root',
  storage,
  keyPrefix: 'redux-',
  whitelist: [] as string[],
};

export const rootReducer = combineReducers({
  noop: (state: boolean = false) => state,
});
