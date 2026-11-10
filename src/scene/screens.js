import * as THREE from 'three';
import { rng } from './geo.js';

/* Generic desktop programs drawn on canvas — the "before" picture on the CEO's monitors. */

const W = 640, H = 400;
const FONT = '"Inter Variable", "Segoe UI", Arial, sans-serif';

function frame(g, title, bar, badge) {
  g.fillStyle = '#f3f3f1';
  g.fillRect(0, 0, W, H);
  g.fillStyle = bar;
  g.fillRect(0, 0, W, 44);
  g.fillStyle = '#fff';
  g.font = `600 17px ${FONT}`;
  g.textBaseline = 'middle';
  g.fillText(title, 18, 23);
  for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(W - 22 - i * 20, 22, 5, 0, 7); g.fill(); }
  if (badge) {
    g.fillStyle = '#e5484d';
    g.beginPath(); g.arc(W - 96, 22, 13, 0, 7); g.fill();
    g.fillStyle = '#fff';
    g.font = `700 13px ${FONT}`;
    g.textAlign = 'center';
    g.fillText(String(badge), W - 96, 23);
    g.textAlign = 'left';
  }
}

function text(g, s, x, y, size = 14, color = '#2b2d29', weight = 500) {
  g.fillStyle = color;
  g.font = `${weight} ${size}px ${FONT}`;
  g.fillText(s, x, y);
}

const DRAW = {
  sheet(g) {
    frame(g, 'Шахматка_ЖК_v7_ФИНАЛ(2).xlsx', '#1f7244', 0);
    g.fillStyle = '#e4e8e1';
    g.fillRect(0, 44, W, 30);
    text(g, 'Файл   Главная   Вставка   Формулы   Данные', 18, 60, 13, '#4b5148');
    const r = rng(3);
    const cw = 52, ch = 26, x0 = 46, y0 = 84;
    for (let row = 0; row < 11; row++) {
      text(g, String(14 - row), 14, y0 + row * ch + 14, 12, '#777');
      for (let col = 0; col < 11; col++) {
        const v = r();
        g.fillStyle = v < 0.5 ? '#c6efce' : v < 0.68 ? '#ffeb9c' : v < 0.93 ? '#d9d9d9' : '#ffc7ce';
        g.fillRect(x0 + col * cw, y0 + row * ch, cw - 2, ch - 2);
        text(g, `${14 - row}${String(col + 1).padStart(2, '0')}`, x0 + col * cw + 8, y0 + row * ch + 13, 11, '#555', 500);
      }
    }
    g.strokeStyle = '#e5484d'; g.lineWidth = 3;
    g.strokeRect(x0 + 6 * cw - 2, y0 + 3 * ch - 2, cw + 2, ch + 2);
    text(g, 'продано или бронь??', x0 + 7 * cw + 6, y0 + 3 * ch + 14, 13, '#c2272d', 700);
  },
  chat(g) {
    frame(g, 'Прорабы · Ала-Тоо', '#0d6e5c', 27);
    g.fillStyle = '#e8e1d6';
    g.fillRect(0, 44, W, H - 44);
    const msgs = [
      ['l', 'Бетон опять задерживают до обеда'],
      ['r', 'Кто подписал акт по кладке?'],
      ['l', 'Скиньте фото, не вижу в чате'],
      ['l', 'Арматура Ø12 заканчивается!'],
      ['r', 'Сколько осталось? Посчитайте'],
      ['l', 'Не знаю, склад не отвечает'],
    ];
    let y = 62;
    for (const [side, m] of msgs) {
      g.font = `500 15px ${FONT}`;
      const w = g.measureText(m).width + 28;
      const x = side === 'l' ? 18 : W - 18 - w;
      g.fillStyle = side === 'l' ? '#fff' : '#d9fdd3';
      g.beginPath(); g.roundRect(x, y, w, 40, 10); g.fill();
      text(g, m, x + 14, y + 21, 15, '#222');
      y += 54;
    }
  },
  ledger(g) {
    frame(g, 'Бухгалтерия — Банк и касса', '#c9a400', 0);
    g.fillStyle = '#fff8d6';
    g.fillRect(0, 44, W, 36);
    text(g, 'Выписка  ·  Платёжные поручения  ·  Отчёты', 18, 62, 13, '#6b5a00');
    const rows = [['03.11', 'ОсОО «Бетон Сервис»', '−2 916 000'], ['04.11', 'Поступление ДДУ 1054', '+850 000'], ['04.11', 'Аванс подрядчику', '−4 120 000'], ['05.11', 'Зарплата октябрь', '−3 600 000'], ['06.11', '??? не разнесено', '+297 500'], ['07.11', 'Эскроу, раскрытие', '+12 400 000']];
    let y = 98;
    for (const [d, n, s] of rows) {
      g.fillStyle = y % 2 ? '#fff' : '#fbf7e8';
      g.fillRect(14, y, W - 28, 40);
      text(g, d, 26, y + 21, 14, '#666');
      text(g, n, 100, y + 21, 15, n.startsWith('???') ? '#c2272d' : '#222', n.startsWith('???') ? 700 : 500);
      g.textAlign = 'right';
      text(g, s, W - 28, y + 21, 15, s.startsWith('−') ? '#a3262b' : '#1d7a43', 600);
      g.textAlign = 'left';
      y += 44;
    }
  },
  mail(g) {
    frame(g, 'Почта — Входящие', '#2f5fb3', 43);
    const rows = [['Нурлан', 'Акт №118 — подпишите до пятницы'], ['Бетон Сервис', 'Счёт на оплату №412 (повторно)'], ['Айжан', 'Re: Re: Бронь кв. 1125 ещё в силе?'], ['Юрист', 'ДДУ 3065 — правки, версия 4'], ['Банк', 'Выписка за октябрь.pdf'], ['Прораб', 'Фото дефектов 6 этаж']];
    let y = 56;
    for (const [from, subj] of rows) {
      g.fillStyle = '#fff';
      g.fillRect(12, y, W - 24, 50);
      g.fillStyle = '#2f5fb3';
      g.beginPath(); g.arc(34, y + 25, 5, 0, 7); g.fill();
      text(g, from, 50, y + 17, 14, '#111', 700);
      text(g, subj, 50, y + 36, 14, '#444');
      y += 56;
    }
  },
  scan(g) {
    frame(g, 'Акт КС-2 (скан от прораба).pdf', '#5b5f66', 0);
    g.fillStyle = '#4a4d52';
    g.fillRect(0, 44, W, H - 44);
    g.save();
    g.translate(W / 2, 222);
    g.rotate(-0.045);
    g.fillStyle = '#e9e6dc';
    g.fillRect(-150, -160, 300, 320);
    g.fillStyle = 'rgba(60,60,60,0.55)';
    for (let i = 0; i < 16; i++) g.fillRect(-120, -130 + i * 17, 120 + ((i * 37) % 120), 5);
    g.strokeStyle = 'rgba(40,70,160,0.6)'; g.lineWidth = 3;
    g.beginPath(); g.arc(80, 110, 32, 0, 7); g.stroke();
    g.restore();
    text(g, 'подпись не читается', 24, H - 22, 14, '#ffb4b4', 700);
  },
  timesheet(g) {
    frame(g, 'Табель_октябрь_исправленный.xlsx', '#1f7244', 0);
    const names = ['Асанов', 'Токтобаев', 'Исакова', 'Мамбетов', 'Орлов', 'Ли', 'Садыкова', 'Котова'];
    const r = rng(11);
    names.forEach((n, i) => {
      const y = 62 + i * 40;
      text(g, n, 16, y + 18, 14, '#333');
      for (let d = 0; d < 14; d++) {
        const v = r();
        g.fillStyle = v < 0.08 ? '#ffc7ce' : '#fff';
        g.fillRect(120 + d * 36, y, 33, 32);
        text(g, v < 0.08 ? '?' : v < 0.2 ? 'В' : '8', 132 + d * 36, y + 17, 13, v < 0.08 ? '#c2272d' : '#444', 600);
      }
    });
  },
  call(g, seed = 1) {
    g.fillStyle = '#151711';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#d6f12b';
    g.beginPath(); g.roundRect(20, 20, 160, 34, 8); g.fill();
    text(g, '● Идёт звонок', 34, 38, 15, '#151711', 700);
    text(g, `Покупатель · ${['Ала-Тоо', 'Ордо Park', 'Северный'][seed % 3]}`, 20, 86, 18, '#ecebe3', 600);
    const r = rng(seed * 17);
    for (let i = 0; i < 64; i++) {
      const h = 8 + r() * 70;
      g.fillStyle = i < 40 ? '#d6f12b' : '#4a4d44';
      g.fillRect(24 + i * 9, 190 - h / 2, 5, h);
    }
    text(g, 'Расшифровка…', 20, 270, 16, '#a8ada2', 500);
    for (let i = 0; i < 3; i++) { g.fillStyle = '#2a2d26'; g.fillRect(20, 292 + i * 26, 420 + r() * 160, 12); }
  },
};

const cache = new Map();
export function appTexture(kind, seed) {
  const key = kind + (seed ?? '');
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  DRAW[kind](g, seed);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
}

/** Screenshot with outlined cells (the apartments that light up on the facade). */
export function highlightTexture(img, rects) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0, c.width, c.height);
  for (const { u0, v0, u1, v1, color } of rects) {
    const x = u0 * c.width, y = v0 * c.height, w = (u1 - u0) * c.width, h = (v1 - v0) * c.height;
    g.strokeStyle = color;
    g.lineWidth = 7;
    g.beginPath(); g.roundRect(x - 4, y - 4, w + 8, h + 8, 14); g.stroke();
    g.fillStyle = color + '22';
    g.beginPath(); g.roundRect(x - 4, y - 4, w + 8, h + 8, 14); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
