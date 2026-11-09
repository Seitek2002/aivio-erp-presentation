import { FLOORS, TOP, floorMid } from './scene/building.js';

/*
  Each slide = a scene state (tweened as one object) + callouts pinned to the model.
  Callout anchors:
    { floor, p:[x,y,z] }  — floor-local point, follows the floor when the tower explodes
    { world:[x,y,z] }     — fixed world point
    { apt:{ side, state, near } } — picks a real apartment cell on the facade
  n: outward normal, used to hide callouts on the far side of the model.
  side: which way the leader line goes ('l' | 'r'); m:false hides it on phones.
*/

const yTop = i => FLOORS[i].y + FLOORS[i].h;
const BUILD_11 = yTop(10) + 0.4; // монолит 11 из 14 этажей (лобби — 1-й этаж)

export const SLIDES = [
  // 1 — hero
  {
    state: { az: 30, el: 9, dist: 128, ty: 22, sx: 0.21, sy: 0.17, night: 1, orbit: 2.2 },
    mobile: { dist: 112, ty: 24 },
    callouts: [],
  },
  // 2 — problem: the tower falls apart into disconnected tools
  {
    state: { az: 48, el: 12, dist: 172, ty: 40, sx: 0.22, sy: 0.16, explode: 1, night: 0.28, dim: 0.85 },
    mobile: { dist: 150, ty: 44 },
    callouts: [
      { floor: 12, p: [-15, 1.6, 8], n: [0, 0, 1], side: 'l', tone: 'warn', title: 'Шахматка в Excel' },
      { floor: 10, p: [15, 1.6, 0], n: [1, 0, 0], side: 'r', tone: 'warn', title: 'Чаты прорабов' },
      { floor: 8, p: [-15, 1.6, 8], n: [0, 0, 1], side: 'l', tone: 'warn', title: '1С отдельно от продаж', m: false },
      { floor: 6, p: [15, 1.6, 0], n: [1, 0, 0], side: 'r', tone: 'warn', title: 'Бумажные акты' },
      { floor: 3, p: [-15, 1.6, 8], n: [0, 0, 1], side: 'l', tone: 'warn', title: 'Звонки без записи', m: false },
      { floor: 1, p: [15, 1.6, 0], n: [1, 0, 0], side: 'r', tone: 'warn', title: 'Табель вручную' },
    ],
  },
  // 3 — solution: one system, modules mapped onto the building
  {
    state: { az: 24, el: 10, dist: 140, ty: 23, sx: 0.1, sy: 0.17, night: 0.85 },
    mobile: { dist: 122, ty: 25 },
    callouts: [
      { floor: 13, p: [7, 4.4, 6], n: [0.5, 0, 1], side: 'r', title: 'Аналитика', text: 'один экран для руководителя' },
      { floor: 11, p: [15, 1.6, 4], n: [1, 0, 0], side: 'r', title: 'Продажи и CRM', text: 'воронка, шахматка, ипотека' },
      { floor: 9, p: [15, 1.6, 4], n: [1, 0, 0], side: 'r', title: 'Документы и ЭДО', text: 'маршруты и подпись ЭЦП', m: false },
      { floor: 7, p: [15, 1.6, 4], n: [1, 0, 0], side: 'r', title: 'Финансы', text: 'деньги, бюджеты, биллинг' },
      { floor: 5, p: [15, 1.6, 4], n: [1, 0, 0], side: 'r', title: 'Стройка и снабжение', text: 'графики, акты, склад', m: false },
      { floor: 3, p: [15, 1.6, 4], n: [1, 0, 0], side: 'r', title: 'Персонал', text: 'табель, СКУД, зарплата' },
      { floor: 0, p: [6.5, 4.4, 12], n: [0, 0, 1], side: 'r', title: 'Эксплуатация', text: 'приёмка, сервис, приложение' },
    ],
  },
  // 4 — sales: the facade becomes the шахматка
  {
    state: { az: 12, el: 7, dist: 116, ty: 26, sx: 0.15, sy: 0.17, chess: 1, night: 0.6, sway: 0.6 },
    mobile: { dist: 104, ty: 27 },
    callouts: [
      { apt: { side: 0, state: 1, near: 13 }, side: 'l', tone: 'amber', title: '№1141, бронь', text: '3-комн., 115,9 м², до 18:00' },
      { apt: { side: 0, state: 0, near: 10 }, side: 'r', tone: 'lime', title: 'Свободна', text: 'цена с акцией пересчитана', m: false },
      { apt: { side: 0, state: 2, near: 8 }, side: 'l', tone: 'bone', title: 'Продана', text: 'ДДУ подписан ЭЦП' },
    ],
  },
  // 5 — AI on calls
  {
    state: { az: -24, el: 14, dist: 200, ty: 30, sx: 0.22, sy: 0.3, night: 0.75, dim: 0.45, hiFloor: 1, hi: 0.9 },
    mobile: { dist: 180, ty: 26, sy: 0.32 },
    callouts: [],
  },
  // 6 — documents
  {
    state: { az: -40, el: 6, dist: 150, ty: 18, sx: 0.24, sy: 0.3, night: 0.7, dim: 0.55 },
    mobile: { dist: 160, ty: 22, sy: 0.32 },
    callouts: [],
  },
  // 7 — finance: budget level on the facade
  {
    state: { az: 30, el: 9, dist: 130, ty: 24, sx: 0.17, sy: 0.17, night: 0.25, fill: TOP * 0.61, fillAmt: 1 },
    mobile: { dist: 118, ty: 25 },
    callouts: [
      { world: [15.6, TOP * 0.61, 8.6], n: [0.7, 0, 0.7], side: 'r', tone: 'lime', title: 'Освоено 61%', text: 'бюджета ЖК на сегодня' },
      { floor: 13, p: [-13, 4.4, 6], n: [0, 0, 1], side: 'l', title: 'План 1,47 млрд сом', text: 'по десяти статьям', m: false },
    ],
  },
  // 8 — construction: frame at floor 11, glazing behind, crane on site
  {
    state: { az: 38, el: 11, dist: 142, ty: 30, sx: 0.18, sy: 0.15, night: 0.12, build: BUILD_11, glassLag: 8.6, ghost: 0.55, crane: 1, sway: 0.5 },
    mobile: { dist: 134, ty: 30 },
    callouts: [
      { world: [15.4, BUILD_11, 8.4], n: [0.7, 0, 0.7], side: 'r', tone: 'lime', title: 'Монолит: 11 из 14 этажей', text: 'готовность 68%' },
      { floor: 8, p: [-15, 1.0, 8], n: [0, 0, 1], side: 'l', title: 'Остекление', text: 'идёт на 9-м этаже', m: false },
      { floor: 5, p: [15.2, 1.6, -3], n: [1, 0, 0], side: 'r', tone: 'warn', title: 'Дефект на 6-м этаже', text: 'предписание до 10 ноября' },
    ],
  },
  // 9 — supply and staff, low angle at the entrance
  {
    state: { az: 30, el: 8, dist: 124, ty: 16, sx: 0.14, sy: 0.2, night: 0.8, sway: 0.5 },
    mobile: { dist: 140, ty: 13, az: 14 },
    callouts: [
      { world: [0, 2.2, 12.6], n: [0, 0, 1], side: 'l', title: 'Турникет и Face ID', text: 'проход отметился в табеле' },
      { world: [25.5, 5.2, 7.2], n: [0.6, 0, 0.8], side: 'r', tone: 'warn', title: 'Склад: арматура Ø12', text: 'ниже минимального остатка' },
      { world: [24.2, 2.8, 14.2], n: [0.6, 0, 0.8], side: 'r', title: 'Поставка бетона М350', text: 'договор создан после тендера', m: false },
    ],
  },
  // 10 — residents: the house is alive
  {
    state: { az: -26, el: 9, dist: 132, ty: 22, sx: 0.1, sy: 0.17, night: 1.28, sway: 0.7 },
    mobile: { dist: 118, ty: 24, dim: 0.75 },
    callouts: [
      { apt: { side: 0, state: 0, near: 3 }, side: 'l', tone: 'lime', title: 'Кв. 1045: ключи выданы', text: 'АПП подписан ЭЦП' },
      { floor: 0, p: [-15.2, 2.4, 3], n: [-1, 0, 0], side: 'l', title: 'Лифт: заявка в работе', text: 'срок по регламенту 4 часа', m: false },
    ],
  },
  // 11 — management: integrations radiate from the building
  {
    state: { az: 28, el: 38, dist: 250, ty: 4, sx: 0.16, sy: 0.18, night: 0.9, nodes: 1, orbit: 1.2 },
    mobile: { dist: 230, ty: 6 },
    callouts: 'nodes',
  },
  // 12 — offer
  {
    state: { az: 210, el: 9, dist: 128, ty: 22, sx: 0.22, sy: 0.17, night: 1, orbit: 2.4 },
    mobile: { dist: 124, ty: 18, sy: 0.3, dim: 0.42 },
    callouts: [],
  },
];

export { floorMid };
