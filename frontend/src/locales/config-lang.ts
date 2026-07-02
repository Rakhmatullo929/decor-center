// @mui
import { enUS, ruRU } from '@mui/material/locale';

// PLEASE REMOVE `LOCAL STORAGE` WHEN YOU CHANGE SETTINGS.
// ----------------------------------------------------------------------

/** MUI does not ship `uz` locale; `enUS` is used for component strings (DatePicker, DataGrid, …). */
export const allLangs = [
  {
    label: 'Oʻzbekcha',
    value: 'uz',
    systemValue: enUS,
    icon: 'flagpack:uz',
  },{
    label: 'Русский',
    value: 'ru',
    systemValue: ruRU,
    icon: 'flagpack:ru',
  },
];

export const defaultLang = allLangs[0];

// GET MORE COUNTRY FLAGS
// https://icon-sets.iconify.design/flagpack/
