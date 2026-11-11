import { TOP, floorTop } from './scene/building.js';
import { DECK } from './scene/site.js';

/*
  Each slide = a scene state (tweened as one object), optional follow-up camera moves (`then`),
  and callouts pinned to the model.
  Callout anchors:
    { at: 'name', p? }        — an object registered by the interiors (monitors, laptop, seal…)
    { floor, p:[x,y,z] }      — floor-local point on the tower
    { world:[x,y,z] }         — fixed world point
    { aptId }                 — an apartment cell on the facade
  k: keyframe at which the callout appears (0 = end of the transition), until: keyframe at which it goes.
  n: outward normal, hides callouts on the far side of the model. m:false hides on phones.
  open: floor whose glass dissolves while the camera flies through it.
*/

const OY = floorTop(13);              // office floor surface
const MID_OFFICE = OY + 1.9;
const MID_LOBBY = 3.2;
const BUILD_11 = DECK + 0.02;         // монолит 11 из 14 этажей

export const OPEN = { office: MID_OFFICE, lobby: MID_LOBBY };

export const SLIDES = [
  // 1 — hero
  {
    state: { az: 30, el: 9, dist: 132, ty: 23, sx: 0.21, sy: 0.17, night: 1, orbit: 2.2 },
    mobile: { dist: 118, ty: 26 },
    callouts: [],
  },
  // 2 — problem: inside the developer's office, six screens, six programs
  {
    open: 'office',
    state: { az: 26, el: 13, dist: 3.9, tx: 6.05, ty: OY + 1.22, tz: 4.1, fov: 42, sx: 0.17, sy: 0.24, night: 0.9, office: 1, screens: 1, sway: 0.8 },
    mobile: { dist: 4.6, az: 10, el: 8 },
    callouts: [
      { at: 'mon0', side: 'l', tone: 'warn', title: 'Шахматка в таблице' },
      { at: 'mon1', side: 'r', tone: 'warn', title: 'Чаты прорабов', m: false },
      { at: 'mon2', side: 'r', tone: 'warn', title: 'Почта и согласования' },
      { at: 'mon3', side: 'l', tone: 'warn', title: '1С отдельно от продаж', m: false },
      { at: 'mon4', side: 'r', tone: 'warn', title: 'Акты на бумаге' },
      { at: 'mon5', side: 'r', tone: 'warn', title: 'Табель вручную' },
    ],
  },
  // 3 — solution: the screens go dark, one laptop opens
  {
    open: 'office',
    state: { az: 44, el: 40, dist: 1.8, tx: 6.0, ty: OY + 0.88, tz: 4.66, fov: 40, sx: 0.16, sy: 0.26, night: 0.9, office: 1, screens: 0, laptop: 1, sway: 0.6 },
    mobile: { dist: 2.0, az: 42, el: 42 },
    callouts: [
      { at: 'laptop', side: 'r', title: 'Одна система', text: 'продажи, стройка, деньги, люди' },
    ],
  },
  // 4 — sales: the laptop flies out and shows the шахматка; picked apartments light up
  {
    open: 'office',
    state: { az: 4, el: 4, dist: 150, tx: 14, ty: 30, tz: 6, sx: 0.06, sy: 0.2, night: 0.85, office: 1, laptop: 1, fly: 1, focus: 1, sway: 0.4 },
    mobile: { dist: 165, tx: 4, ty: 52, el: 6, sy: 0.18 },
    callouts: [
      { aptId: 1213, side: 'l', tone: 'bone', title: '№1131, продана', text: 'ДДУ подписан ЭЦП' },
      { aptId: 1100, side: 'l', tone: 'lime', title: '№1122, свободна', text: '1-комн., 50,8 м², 5,5 млн' },
      { aptId: 1101, side: 'r', tone: 'amber', title: '№1125, бронь', text: 'до 18:00, предоплата по QR', m: false },
    ],
  },
  // 5 — AI on calls: the sales office in the lobby
  {
    open: 'lobby',
    state: { az: 22, el: 4, dist: 12.5, tx: -7.4, ty: 3.0, tz: -5.5, fov: 42, sx: 0.12, sy: 0.24, night: 0.9, sales: 1, sway: 0.7 },
    mobile: { dist: 13, az: 14, el: 6, tx: -7.4 },
    callouts: [
      { at: 'wallScore', side: 'r', title: 'Оценка разговора 92 из 100', text: 'итог и следующий шаг готовы' },
      { at: 'manager', side: 'l', title: 'Звонок записан', text: 'расшифровка по ролям', m: false },
    ],
  },
  // 6 — documents on the meeting table
  {
    open: 'lobby',
    state: { az: 8, el: 64, dist: 1.0, tx: 7.5, ty: 0.78, tz: 2.24, fov: 38, sx: 0.15, sy: 0.24, night: 0.9, sign: 1, sway: 0.5 },
    mobile: { dist: 1.15, el: 64 },
    callouts: [
      { at: 'seal', side: 'r', title: 'Подписано ЭЦП', text: 'Инфоком, штамп времени' },
      { at: 'ddu', side: 'l', title: 'ДДУ на согласовании', text: 'юрист, финдиректор, директор', m: false },
      { at: 'tablet', side: 'r', title: 'Архив и 1С', text: 'выгрузка сразу после подписи' },
    ],
  },
  // 7 — finance: budget level on the facade
  {
    state: { az: 30, el: 9, dist: 134, ty: 25, sx: 0.17, sy: 0.17, night: 0.25, fill: TOP * 0.61, fillAmt: 1 },
    mobile: { dist: 122, ty: 27 },
    callouts: [
      { world: [16.2, TOP * 0.61, 6], n: [0.8, 0, 0.6], side: 'r', tone: 'lime', title: 'Освоено 61%', text: 'бюджета ЖК на сегодня' },
      { floor: 13, p: [-6, 4.6, 10.4], n: [0, 0, 1], side: 'l', title: 'План 1,47 млрд сом', text: 'по десяти статьям', m: false },
    ],
  },
  // 8 — construction: straight to the crew on the deck (the crane keeps working behind them)
  {
    dur: 2.3,
    state: { az: 48, el: 20, dist: 17, tx: 3.5, ty: DECK + 1.1, tz: 0.5, fov: 40, dim: 0.86, sx: 0.17, sy: 0.15, night: 0.12, build: BUILD_11, glassLag: 5.4, ghost: 0.5, crane: 1, crew: 1, yard: 1, sway: 0.4 },
    mobile: { dist: 21, el: 30, tx: 4 },
    callouts: [
      { at: 'deckEdge', side: 'r', tone: 'lime', title: 'Монолит: 11 из 14 этажей', text: 'готовность 68%' },
      { at: 'pallet', side: 'r', title: 'Поставка принята', text: 'остаток склада обновлён', m: false },
      { at: 'foreman', side: 'l', title: 'График у прораба', text: 'план и факт по этапам' },
      { at: 'welder', side: 'l', tone: 'warn', title: 'Сварка каркаса 12 этажа', text: 'акт после стройконтроля', m: false },
    ],
  },
  // 9 — supply and staff: the site store, then the turnstile at the entrance
  {
    open: 'lobby',
    state: { az: 68, el: 12, dist: 26, tx: 25.5, ty: 2.6, tz: 10, fov: 38, sx: 0.16, sy: 0.22, night: 0.8, gate: 1, yard: 1, sway: 0.5 },
    mobile: { dist: 30, el: 14 },
    then: [{
      delay: 1.6, dur: 3.2,
      state: { az: 10, el: 7, dist: 8.5, tx: 0, ty: 1.25, tz: 3.6, fov: 40 },
      mobile: { dist: 9.5, el: 9 },
    }],
    callouts: [
      { k: 0, until: 1, world: [25.5, 5.3, 7.2], side: 'l', tone: 'warn', title: 'Склад: арматура Ø12', text: 'ниже минимального остатка' },
      { k: 0, until: 1, world: [24.2, 2.8, 14.2], side: 'r', title: 'Поставка бетона М350', text: 'договор создан после тендера', m: false },
      { k: 1, at: 'faceid', side: 'r', title: 'Face ID: проход 07:48', text: 'отметка сразу в табеле' },
    ],
  },
  // 10 — residents: the house is alive
  {
    state: { az: -26, el: 9, dist: 134, ty: 23, sx: 0.1, sy: 0.17, night: 1.28, sway: 0.7 },
    mobile: { dist: 122, ty: 26, dim: 0.75 },
    callouts: [
      { aptId: 300, side: 'l', tone: 'lime', title: 'Кв. 1045: ключи выданы', text: 'АПП подписан ЭЦП' },
      { world: [-13.8, 3, 2], n: [-1, 0, 0], side: 'l', title: 'Лифт: заявка в работе', text: 'срок по регламенту 4 часа', m: false },
    ],
  },
  // 11 — management: integrations radiate from the building
  {
    state: { az: 28, el: 38, dist: 255, ty: 4, sx: 0.16, sy: 0.18, night: 0.9, nodes: 1, orbit: 1.2 },
    mobile: { dist: 235, ty: 6 },
    callouts: 'nodes',
  },
  // 12 — offer
  {
    state: { az: 210, el: 9, dist: 132, ty: 23, sx: 0.22, sy: 0.17, night: 1, orbit: 2.4 },
    mobile: { dist: 128, ty: 19, sy: 0.3, dim: 0.42 },
    callouts: [],
  },
];
